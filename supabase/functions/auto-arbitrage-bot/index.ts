import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BotConfig {
  userId: string;
  isEnabled: boolean;
  minSpread: number;
  maxInvestmentPerTrade: number;
  minProfitThreshold: number;
  stopLossPercentage: number;
  dailyLimit: number;
  checkIntervalSeconds: number;
  reinvestProfits: boolean;
  compoundingEnabled: boolean;
}

interface BotState {
  isRunning: boolean;
  totalProfit: number;
  tradesExecuted: number;
  dailyVolume: number;
  lastExecutionTime: string;
  currentBalance: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, config } = await req.json();

    console.log(`🤖 Auto-Arbitrage Bot - Ação: ${action}`);

    if (action === 'start') {
      return await startBot(supabase, config);
    } else if (action === 'stop') {
      return await stopBot(supabase, config.userId);
    } else if (action === 'status') {
      return await getBotStatus(supabase, config.userId);
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no Auto-Arbitrage Bot:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function startBot(supabase: any, config: BotConfig) {
  console.log('🚀 Iniciando Auto-Arbitrage Bot...');

  // Salvar configuração do bot
  const { error: configError } = await supabase
    .from('auto_arbitrage_configs')
    .upsert({
      user_id: config.userId,
      is_enabled: true,
      min_spread: config.minSpread,
      max_investment_per_trade: config.maxInvestmentPerTrade,
      min_profit_threshold: config.minProfitThreshold,
      stop_loss_percentage: config.stopLossPercentage,
      daily_limit: config.dailyLimit,
      check_interval_seconds: config.checkIntervalSeconds,
      reinvest_profits: config.reinvestProfits,
      compounding_enabled: config.compoundingEnabled,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (configError) {
    console.error('❌ Erro ao salvar config:', configError);
    throw configError;
  }

  // Iniciar loop de execução em background
  EdgeRuntime.waitUntil(runBotLoop(supabase, config));

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Bot iniciado com sucesso',
      config: {
        minSpread: config.minSpread,
        maxInvestment: config.maxInvestmentPerTrade,
        checkInterval: config.checkIntervalSeconds,
        compounding: config.compoundingEnabled
      }
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function runBotLoop(supabase: any, config: BotConfig) {
  console.log('🔄 Loop do bot iniciado');

  let iteration = 0;
  const maxIterations = 100; // Limite de segurança para evitar loops infinitos

  while (iteration < maxIterations) {
    try {
      // Verificar se o bot ainda está ativo
      const { data: botConfig } = await supabase
        .from('auto_arbitrage_configs')
        .select('is_enabled, daily_volume, daily_limit')
        .eq('user_id', config.userId)
        .single();

      if (!botConfig?.is_enabled) {
        console.log('⏸️ Bot desativado pelo usuário');
        break;
      }

      // Verificar limite diário
      if (botConfig.daily_volume >= botConfig.daily_limit) {
        console.log('⚠️ Limite diário atingido');
        await updateBotState(supabase, config.userId, { status: 'daily_limit_reached' });
        break;
      }

      // Buscar oportunidades lucrativas
      const opportunities = await findProfitableOpportunities(supabase, config);

      if (opportunities.length > 0) {
        console.log(`✅ ${opportunities.length} oportunidades encontradas`);

        // Executar a melhor oportunidade
        const bestOpp = opportunities[0];
        await executeArbitrage(supabase, config, bestOpp);
      } else {
        console.log('⏳ Nenhuma oportunidade lucrativa no momento');
      }

      // Aguardar intervalo configurado
      await new Promise(resolve => setTimeout(resolve, config.checkIntervalSeconds * 1000));
      iteration++;

    } catch (error) {
      console.error('❌ Erro no loop do bot:', error);
      await updateBotState(supabase, config.userId, { 
        status: 'error',
        last_error: error.message 
      });
      break;
    }
  }

  console.log('🏁 Loop do bot finalizado');
}

async function findProfitableOpportunities(supabase: any, config: BotConfig) {
  console.log(`🔍 Buscando oportunidades com spread > ${config.minSpread}%`);

  const { data: opportunities, error } = await supabase
    .from('realtime_arbitrage_opportunities')
    .select('*')
    .eq('is_active', true)
    .gte('spread', config.minSpread)
    .order('spread', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Erro ao buscar oportunidades:', error);
    return [];
  }

  // Filtrar oportunidades com lucro líquido positivo
  const profitableOpps = opportunities.filter((opp: any) => {
    const investment = config.maxInvestmentPerTrade;
    const tradingFee = investment * 0.002; // 0.20%
    const arbitrumFee = 0.10;
    const effectiveSpread = opp.spread - 0.10; // Slippage padrão
    const grossProfit = (investment * effectiveSpread) / 100;
    const netProfit = grossProfit - tradingFee - arbitrumFee;

    return netProfit >= config.minProfitThreshold;
  });

  console.log(`💰 ${profitableOpps.length} oportunidades lucrativas após filtros`);
  return profitableOpps;
}

async function executeArbitrage(supabase: any, config: BotConfig, opportunity: any) {
  console.log(`⚡ Executando arbitragem: ${opportunity.symbol} - Spread: ${opportunity.spread.toFixed(3)}%`);

  try {
    // Obter credenciais do usuário
    const { data: credentials } = await supabase
      .from('exchange_api_configs')
      .select('*')
      .eq('user_id', config.userId)
      .eq('is_active', true);

    if (!credentials || credentials.length === 0) {
      console.error('❌ Credenciais não encontradas');
      return;
    }

    const binanceCred = credentials.find((c: any) => c.exchange === 'binance');
    const okxCred = credentials.find((c: any) => c.exchange === 'okx');

    // Calcular investimento (com compounding se habilitado)
    let investmentAmount = config.maxInvestmentPerTrade;
    
    if (config.compoundingEnabled && config.reinvestProfits) {
      const { data: botState } = await supabase
        .from('auto_arbitrage_states')
        .select('total_profit')
        .eq('user_id', config.userId)
        .single();

      if (botState && botState.total_profit > 0) {
        // Adicionar 50% dos lucros ao próximo trade (compounding moderado)
        investmentAmount += (botState.total_profit * 0.5);
        console.log(`📈 Compounding ativado: Investimento aumentado para $${investmentAmount.toFixed(2)}`);
      }
    }

    // Chamar edge function de execução
    const { data: result, error } = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
      body: {
        opportunityId: opportunity.id,
        userId: config.userId,
        symbol: opportunity.symbol,
        buyExchange: opportunity.buy_exchange,
        sellExchange: opportunity.sell_exchange,
        buyPrice: opportunity.buy_price,
        sellPrice: opportunity.sell_price,
        mode: 'real',
        binanceApiKey: binanceCred?.api_key,
        binanceSecretKey: binanceCred?.secret_key,
        okxApiKey: okxCred?.api_key,
        okxSecretKey: okxCred?.secret_key,
        okxPassphrase: okxCred?.passphrase,
        config: {
          investmentAmount: investmentAmount,
          maxSlippage: 0.10,
          customFeeRate: 0.2,
          stopLossPercentage: config.stopLossPercentage,
          prioritizeSpeed: true
        }
      }
    });

    if (error) {
      console.error('❌ Erro na execução:', error);
      return;
    }

    if (result?.success) {
      console.log(`✅ Trade executado! Lucro: $${result.result?.net_profit?.toFixed(2)}`);

      // Atualizar estado do bot
      await updateBotState(supabase, config.userId, {
        trades_executed: { increment: 1 },
        total_profit: { increment: result.result?.net_profit || 0 },
        daily_volume: { increment: investmentAmount },
        last_execution_time: new Date().toISOString(),
        status: 'running'
      });

      // Registrar log
      await supabase.from('bot_execution_logs').insert({
        user_id: config.userId,
        opportunity_id: opportunity.id,
        symbol: opportunity.symbol,
        investment: investmentAmount,
        net_profit: result.result?.net_profit,
        spread: opportunity.spread,
        executed_at: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Erro ao executar trade:', error);
  }
}

async function updateBotState(supabase: any, userId: string, updates: any) {
  const { error } = await supabase
    .from('auto_arbitrage_states')
    .upsert({
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('❌ Erro ao atualizar estado:', error);
  }
}

async function stopBot(supabase: any, userId: string) {
  console.log('⏹️ Parando Auto-Arbitrage Bot...');

  const { error } = await supabase
    .from('auto_arbitrage_configs')
    .update({ 
      is_enabled: false,
      stopped_at: new Date().toISOString() 
    })
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  await updateBotState(supabase, userId, { status: 'stopped' });

  return new Response(
    JSON.stringify({ success: true, message: 'Bot parado com sucesso' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getBotStatus(supabase: any, userId: string) {
  const { data: config } = await supabase
    .from('auto_arbitrage_configs')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: state } = await supabase
    .from('auto_arbitrage_states')
    .select('*')
    .eq('user_id', userId)
    .single();

  return new Response(
    JSON.stringify({
      success: true,
      config: config || null,
      state: state || null
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
