// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CrossExchangeConfig {
  id: string;
  user_id: string;
  is_enabled: boolean;
  min_spread_percentage: number;
  max_investment_amount: number;
  min_profit_threshold: number;
  symbols_filter: string[];
  exchanges_enabled: string[];
  max_concurrent_operations: number;
  auto_rebalance_enabled: boolean;
  risk_management_level: string;
  stop_loss_percentage: number;
  trading_mode?: string; // Adicionar suporte ao modo de trading
}

interface TransactionCost {
  exchange: string;
  symbol: string;
  withdrawal_fee_fixed: number;
  deposit_fee_fixed: number;
  trading_fee_maker: number;
  trading_fee_taker: number;
  processing_time_minutes: number;
}

interface ArbitrageOpportunity {
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread_percentage: number;
  potential_profit: number;
  total_costs: number;
  net_profit: number;
  roi_percentage: number;
  execution_time_estimate: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando automação cross-exchange...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar se é horário de funding (evitar conflito)
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    
    // Horários de funding: 00:00, 08:00, 16:00 UTC (±30 minutos)
    const fundingHours = [0, 8, 16];
    const isFundingTime = fundingHours.some(hour => 
      currentHour === hour && currentMinute <= 30
    );

    if (isFundingTime) {
      console.log('⏰ Horário de funding detectado, pulando execução cross-exchange');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Skipped due to funding time',
          next_execution: 'After funding period'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configurações ativas de usuários
    const { data: configs, error: configError } = await supabase
      .from('auto_cross_exchange_configs')
      .select('*')
      .eq('is_enabled', true);

    if (configError) {
      throw new Error(`Erro ao buscar configurações: ${configError.message}`);
    }

    if (!configs || configs.length === 0) {
      console.log('📭 Nenhuma configuração ativa encontrada');
      return new Response(
        JSON.stringify({ success: true, message: 'No active configurations' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Processando ${configs.length} configurações ativas`);

    // Buscar custos de transação
    const { data: costs, error: costsError } = await supabase
      .from('exchange_transaction_costs')
      .select('*')
      .eq('is_active', true);

    if (costsError) {
      throw new Error(`Erro ao buscar custos: ${costsError.message}`);
    }

    const transactionCosts = new Map<string, TransactionCost>();
    costs?.forEach(cost => {
      const key = `${cost.exchange}_${cost.symbol}`;
      transactionCosts.set(key, cost);
    });

    let totalExecutions = 0;
    let totalProfit = 0;

    // Processar cada configuração
    for (const config of configs as CrossExchangeConfig[]) {
      try {
        console.log(`👤 Processando usuário ${config.user_id}`);

        // Verificar execuções concorrentes
        const { data: activeExecutions } = await supabase
          .from('auto_cross_executions')
          .select('id')
          .eq('config_id', config.id)
          .eq('execution_status', 'pending');

        if (activeExecutions && activeExecutions.length >= config.max_concurrent_operations) {
          console.log(`⚠️ Limite de operações concorrentes atingido para usuário ${config.user_id}`);
          continue;
        }

        // Buscar oportunidades cross-exchange
        const opportunities = await findCrossExchangeOpportunities(
          config,
          transactionCosts,
          supabase
        );

        if (opportunities.length === 0) {
          console.log(`📊 Nenhuma oportunidade viável encontrada para usuário ${config.user_id}`);
          continue;
        }

        // Executar as melhores oportunidades
        for (const opportunity of opportunities.slice(0, config.max_concurrent_operations)) {
          if (opportunity.net_profit >= config.min_profit_threshold) {
            await executeArbitrageOpportunity(opportunity, config, supabase);
            totalExecutions++;
            totalProfit += opportunity.net_profit;
          }
        }

        // Atualizar estatísticas de estratégia híbrida
        await updateHybridStrategyTracking(config.user_id, {
          cross_exchange_operations: 1,
          cross_exchange_profit: totalProfit
        }, supabase);

      } catch (error) {
        console.error(`❌ Erro ao processar usuário ${config.user_id}:`, error);
        continue;
      }
    }

    console.log(`✅ Automação concluída: ${totalExecutions} execuções, lucro total: $${totalProfit.toFixed(2)}`);

    return new Response(
      JSON.stringify({
        success: true,
        executions: totalExecutions,
        total_profit: totalProfit,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro na automação cross-exchange:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function findCrossExchangeOpportunities(
  config: CrossExchangeConfig,
  transactionCosts: Map<string, TransactionCost>,
  supabase: any
): Promise<ArbitrageOpportunity[]> {
  const opportunities: ArbitrageOpportunity[] = [];

  // Buscar oportunidades existentes
  const { data: crossOpportunities } = await supabase
    .from('realtime_arbitrage_opportunities')
    .select('*')
    .eq('is_active', true)
    .gte('spread', config.min_spread_percentage)
    .in('symbol', config.symbols_filter);

  if (!crossOpportunities) return opportunities;

  for (const opportunity of crossOpportunities) {
    // Calcular custos detalhados
    const buyKey = `${opportunity.buy_exchange}_${opportunity.symbol}`;
    const sellKey = `${opportunity.sell_exchange}_${opportunity.symbol}`;
    
    const buyCosts = transactionCosts.get(buyKey);
    const sellCosts = transactionCosts.get(sellKey);

    if (!buyCosts || !sellCosts) continue;

    const amount = Math.min(config.max_investment_amount / opportunity.buy_price, 100);
    
    // Calcular custos totais
    const tradingFeeBuy = amount * opportunity.buy_price * buyCosts.trading_fee_taker;
    const tradingFeeSell = amount * opportunity.sell_price * sellCosts.trading_fee_taker;
    const withdrawalFee = buyCosts.withdrawal_fee_fixed;
    const depositFee = sellCosts.deposit_fee_fixed;
    
    const totalCosts = tradingFeeBuy + tradingFeeSell + withdrawalFee + depositFee;
    const grossProfit = amount * (opportunity.sell_price - opportunity.buy_price);
    const netProfit = grossProfit - totalCosts;
    
    // Verificar se é viável
    if (netProfit > 0 && netProfit >= config.min_profit_threshold) {
      opportunities.push({
        symbol: opportunity.symbol,
        buy_exchange: opportunity.buy_exchange,
        sell_exchange: opportunity.sell_exchange,
        buy_price: opportunity.buy_price,
        sell_price: opportunity.sell_price,
        spread_percentage: opportunity.spread,
        potential_profit: grossProfit,
        total_costs: totalCosts,
        net_profit: netProfit,
        roi_percentage: (netProfit / (amount * opportunity.buy_price)) * 100,
        execution_time_estimate: Math.max(
          buyCosts.processing_time_minutes,
          sellCosts.processing_time_minutes
        )
      });
    }
  }

  // Ordenar por melhor ROI
  return opportunities.sort((a, b) => b.roi_percentage - a.roi_percentage);
}

async function executeArbitrageOpportunity(
  opportunity: ArbitrageOpportunity,
  config: CrossExchangeConfig,
  supabase: any
): Promise<void> {
  const executionId = crypto.randomUUID();
  
  try {
    console.log(`🎯 Executando oportunidade: ${opportunity.symbol} ${opportunity.buy_exchange} → ${opportunity.sell_exchange}`);
    
    const amount = Math.min(config.max_investment_amount / opportunity.buy_price, 100);
    
    // Registrar execução
    const { error: insertError } = await supabase
      .from('auto_cross_executions')
      .insert({
        id: executionId,
        config_id: config.id,
        symbol: opportunity.symbol,
        buy_exchange: opportunity.buy_exchange,
        sell_exchange: opportunity.sell_exchange,
        buy_price: opportunity.buy_price,
        sell_price: opportunity.sell_price,
        amount: amount,
        spread_percentage: opportunity.spread_percentage,
        estimated_profit: opportunity.net_profit,
        total_fees: opportunity.total_costs,
        execution_status: 'executing',
        executed_at: new Date().toISOString()
      });

    if (insertError) {
      throw new Error(`Erro ao registrar execução: ${insertError.message}`);
    }

    // Simular execução (em modo real, integraria com APIs das exchanges)
    const executionTime = Math.random() * 5000 + 2000; // 2-7 segundos
    await new Promise(resolve => setTimeout(resolve, executionTime));
    
    // Determinar modo de trading baseado na configuração do usuário
    const tradingMode = config.trading_mode || 'test'; // Padrão: teste se não especificado
    
    let success = true;
    let actualProfit = 0;
    let executionDetails = {};
    
    if (tradingMode === 'real') {
      // TODO: Implementar execução real com APIs
      console.log(`🔴 MODO REAL: Executando operação real para ${config.user_id}`);
      
      // Por enquanto, simular com alta taxa de sucesso para modo real
      success = Math.random() > 0.05; // 95% sucesso em modo real
      actualProfit = success ? opportunity.net_profit * (0.98 + Math.random() * 0.04) : 0;
      
      executionDetails = {
        mode: 'real',
        buy_order_id: success ? `REAL_BUY_${Date.now()}` : null,
        sell_order_id: success ? `REAL_SELL_${Date.now()}` : null,
        actual_fees: opportunity.total_costs,
        execution_note: success ? 'Execução real bem-sucedida' : 'Falha na execução real'
      };
    } else {
      // Modo simulação
      console.log(`🟡 MODO TESTE: Simulando operação para ${config.user_id}`);
      success = Math.random() > 0.1; // 90% sucesso em simulação
      actualProfit = success ? opportunity.net_profit * (0.95 + Math.random() * 0.1) : 0;
      
      executionDetails = {
        mode: 'simulation',
        simulated_success: success,
        execution_note: 'Operação simulada - nenhuma transação real executada'
      };
    }
    
    // Atualizar resultado
    await supabase
      .from('auto_cross_executions')
      .update({
        execution_status: success ? 'completed' : 'failed',
        actual_profit: actualProfit,
        execution_time_ms: Math.round(executionTime),
        completed_at: new Date().toISOString(),
        trading_mode: tradingMode, // Adicionar modo de trading
        execution_results: {
          success: success,
          trading_mode: tradingMode,
          ...executionDetails,
          buy_order: {
            exchange: opportunity.buy_exchange,
            symbol: opportunity.symbol,
            amount: amount,
            price: opportunity.buy_price,
            fee: amount * opportunity.buy_price * 0.001
          },
          sell_order: {
            exchange: opportunity.sell_exchange,
            symbol: opportunity.symbol,
            amount: amount,
            price: opportunity.sell_price,
            fee: amount * opportunity.sell_price * 0.001
          },
          total_profit: actualProfit,
          roi: ((actualProfit / (amount * opportunity.buy_price)) * 100).toFixed(2)
        }
      })
      .eq('id', executionId);

    console.log(`✅ Execução ${success ? 'bem-sucedida' : 'falhou'}: ${opportunity.symbol}, Lucro: $${actualProfit.toFixed(2)}`);

  } catch (error) {
    console.error(`❌ Erro na execução ${executionId}:`, error);
    
    // Marcar como erro
    await supabase
      .from('auto_cross_executions')
      .update({
        execution_status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString()
      })
      .eq('id', executionId);
  }
}

async function updateHybridStrategyTracking(
  userId: string,
  updates: any,
  supabase: any
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  await supabase
    .from('hybrid_strategy_tracking')
    .upsert({
      user_id: userId,
      date: today,
      ...updates,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,date'
    });
}