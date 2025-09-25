import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutoFundingConfig {
  user_id: string;
  is_enabled: boolean;
  min_funding_rate: number; // Mínimo 0.01% para executar
  max_investment_per_trade: number; // Máximo por operação
  min_profit_threshold: number; // Lucro mínimo esperado em USD
  symbols: string[]; // Símbolos para monitorar
  auto_close_after_funding: boolean; // Fechar posição após receber funding
}

interface FundingOpportunity {
  symbol: string;
  spotPrice: number;
  futuresPrice: number;
  fundingRate: number;
  spread: number;
  estimatedProfit: number;
  nextFundingTime: number;
  strategy: 'long_spot_short_futures' | 'short_spot_long_futures';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🤖 AUTO-FUNDING-ARBITRAGE: Iniciando verificação automática');
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestData = await req.json();
    const { trigger_type = 'manual' } = requestData; // 'manual' ou 'cron'

    console.log(`🔄 Execução ${trigger_type} iniciada em ${new Date().toISOString()}`);

    // 1. Buscar configurações de usuários que habilitaram automação
    const { data: configs, error: configError } = await supabase
      .from('auto_funding_configs')
      .select('*')
      .eq('is_enabled', true);

    if (configError) {
      console.error('❌ Erro ao buscar configurações:', configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log('📝 Nenhuma configuração de automação ativa encontrada');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhuma automação ativa',
        executed_trades: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`🎯 ${configs.length} configurações ativas encontradas`);

    // 2. Buscar oportunidades de funding atuais
    const fundingResponse = await supabase.functions.invoke('binance-market-data', {
      body: { endpoint: 'funding-arbitrage' }
    });

    if (fundingResponse.error) {
      throw new Error('Falha ao obter dados de funding: ' + fundingResponse.error.message);
    }

    const opportunities: FundingOpportunity[] = fundingResponse.data?.data || [];
    console.log(`📊 ${opportunities.length} oportunidades de funding encontradas`);

    let totalExecutedTrades = 0;
    const executionResults = [];

    // 3. Para cada usuário com automação ativa
    for (const config of configs) {
      console.log(`👤 Processando usuário: ${config.user_id}`);
      
      try {
        // Verificar se o usuário tem credenciais válidas
        const { data: credentials } = await supabase
          .from('user_api_credentials')
          .select('binance_api_key, binance_secret_key')
          .eq('user_id', config.user_id)
          .single();

        if (!credentials || !credentials.binance_api_key) {
          console.log(`⚠️ Usuário ${config.user_id} sem credenciais válidas`);
          continue;
        }

        // Filtrar oportunidades pelos critérios do usuário
        const validOpportunities = opportunities.filter(opp => {
          const meetsMinFunding = Math.abs(opp.fundingRate) >= config.min_funding_rate;
          const meetsMinProfit = opp.estimatedProfit >= config.min_profit_threshold;
          const isSelectedSymbol = config.symbols.includes(opp.symbol);
          
          return meetsMinFunding && meetsMinProfit && isSelectedSymbol;
        });

        console.log(`✅ ${validOpportunities.length} oportunidades válidas para usuário ${config.user_id}`);

        // 4. Executar operações válidas
        for (const opportunity of validOpportunities) {
          try {
            console.log(`🚀 Executando funding arbitrage automático: ${opportunity.symbol}`);
            
            // Calcular quantidade baseada no investimento máximo
            const investmentAmount = Math.min(config.max_investment_per_trade, 1000);
            const tokenAmount = investmentAmount / opportunity.spotPrice;

            // Verificar se já existe uma posição aberta para este símbolo
            const { data: existingTrades } = await supabase
              .from('arbitrage_trades')
              .select('id')
              .eq('user_id', config.user_id)
              .eq('symbol', `${opportunity.symbol}/USDT`)
              .eq('status', 'open')
              .gte('created_at', new Date(Date.now() - 3600000).toISOString()); // Última hora

            if (existingTrades && existingTrades.length > 0) {
              console.log(`⏭️ Posição já aberta para ${opportunity.symbol}, pulando...`);
              continue;
            }

            // Executar via execute-funding-arbitrage
            const executionResponse = await supabase.functions.invoke('execute-funding-arbitrage', {
              body: {
                symbol: opportunity.symbol,
                strategy: opportunity.strategy,
                spotPrice: opportunity.spotPrice,
                futuresPrice: opportunity.futuresPrice,
                fundingRate: opportunity.fundingRate,
                investment_amount: investmentAmount,
                user_id: config.user_id,
                api_keys: {
                  binance_api_key: credentials.binance_api_key,
                  binance_secret_key: credentials.binance_secret_key,
                },
                calculations: {
                  netProfit: opportunity.estimatedProfit,
                  roi: (opportunity.estimatedProfit / investmentAmount) * 100
                },
                trading_mode: 'simulation',
                is_funding_arbitrage: true,
                auto_execution: true // Flag para indicar execução automática
              }
            });

            if (executionResponse.error) {
              console.error(`❌ Erro na execução para ${opportunity.symbol}:`, executionResponse.error);
              continue;
            }

            if (executionResponse.data.success) {
              console.log(`✅ Funding arbitrage executado com sucesso: ${opportunity.symbol}`);
              totalExecutedTrades++;
              
              executionResults.push({
                user_id: config.user_id,
                symbol: opportunity.symbol,
                investment: investmentAmount,
                expected_profit: opportunity.estimatedProfit,
                strategy: opportunity.strategy,
                execution_time: new Date().toISOString()
              });

              // Programar fechamento automático se configurado
              if (config.auto_close_after_funding) {
                await scheduleAutoClose(supabase, config.user_id, opportunity.symbol, executionResponse.data.trade_id);
              }

            } else {
              console.log(`⚠️ Execução falhou para ${opportunity.symbol}:`, executionResponse.data.error);
            }

          } catch (tradeError) {
            console.error(`❌ Erro ao executar trade para ${opportunity.symbol}:`, tradeError);
          }
        }

      } catch (userError) {
        console.error(`❌ Erro ao processar usuário ${config.user_id}:`, userError);
      }
    }

    // 5. Registrar execução da automação
    await supabase
      .from('auto_funding_executions')
      .insert({
        execution_time: new Date().toISOString(),
        trigger_type,
        total_configs_active: configs.length,
        total_opportunities_found: opportunities.length,
        total_trades_executed: totalExecutedTrades,
        execution_results: executionResults
      });

    console.log(`🎯 Automação concluída: ${totalExecutedTrades} trades executados`);

    return new Response(JSON.stringify({
      success: true,
      message: `Automação executada com sucesso`,
      executed_trades: totalExecutedTrades,
      active_configs: configs.length,
      opportunities_found: opportunities.length,
      execution_results: executionResults,
      next_funding_times: getNextFundingTimes()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro na automação de funding arbitrage:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Função para programar fechamento automático
async function scheduleAutoClose(supabase: any, userId: string, symbol: string, tradeId: string) {
  console.log(`📅 Programando fechamento automático para ${symbol} após funding`);
  
  // Programar para 5 minutos após o próximo horário de funding
  const nextFunding = getNextFundingTime();
  const closeTime = new Date(nextFunding + 5 * 60000); // 5 minutos depois
  
  await supabase
    .from('scheduled_actions')
    .insert({
      user_id: userId,
      action_type: 'close_funding_position',
      symbol,
      trade_id: tradeId,
      scheduled_for: closeTime.toISOString(),
      status: 'pending'
    });
}

// Função para calcular próximo horário de funding
function getNextFundingTime(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  let nextHour: number;

  if (utcHour < 8) {
    nextHour = 8;
  } else if (utcHour < 16) {
    nextHour = 16;
  } else {
    nextHour = 24; // Meia-noite do próximo dia
  }

  const next = new Date(now);
  next.setUTCHours(nextHour === 24 ? 0 : nextHour, 0, 0, 0);
  if (nextHour === 24) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next.getTime();
}

// Função para obter os próximos 3 horários de funding
function getNextFundingTimes(): string[] {
  const times = [];
  let current = getNextFundingTime();
  
  for (let i = 0; i < 3; i++) {
    times.push(new Date(current).toISOString());
    current += 8 * 60 * 60 * 1000; // 8 horas
  }
  
  return times;
}