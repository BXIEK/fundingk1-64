// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteSyntheticArbitrageRequest {
  opportunityId: string;
  userId: string;
  amount: number;
  symbol: string;
  buy_price: number;
  sell_price: number;
  mode: 'simulation' | 'real';
  config?: {
    investmentAmount: number;
    maxSlippage: number;
    customFeeRate: number;
    stopLossPercentage: number;
    prioritizeSpeed: boolean;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      opportunityId, 
      userId, 
      amount = 100, 
      symbol, 
      buy_price, 
      sell_price, 
      mode = 'simulation',
      config = {
        investmentAmount: 100,
        maxSlippage: 0.5,
        customFeeRate: 0.1,
        stopLossPercentage: 2.0,
        prioritizeSpeed: true
      }
    }: ExecuteSyntheticArbitrageRequest = await req.json();

    console.log(`🚀 Executando arbitragem sintética: ${symbol}, Valor: $${config.investmentAmount}, Modo: ${mode}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Aplicar configurações personalizadas
    const effectiveAmount = config.investmentAmount;
    const adjustedSpread = Math.abs((sell_price - buy_price) / buy_price * 100);
    const slippageAdjustedSpread = Math.max(0, adjustedSpread - config.maxSlippage);
    
    // Calcular métricas da operação com configurações personalizadas
    const spread_percentage = slippageAdjustedSpread;
    const gross_profit = (effectiveAmount * spread_percentage) / 100;
    const trading_fees = effectiveAmount * (config.customFeeRate / 100);
    const net_profit = Math.max(0, gross_profit - trading_fees);
    const roi_percentage = effectiveAmount > 0 ? (net_profit / effectiveAmount) * 100 : 0;

    // Verificar stop loss
    let status = 'completed';
    let error_message = null;
    
    // Verificar se o spread ajustado resulta em prejuízo
    if (net_profit <= 0) {
      status = 'failed';
      error_message = `Spread insuficiente após slippage. Necessário: ${(config.customFeeRate + config.maxSlippage).toFixed(2)}%`;
    }
    
    // Simular algumas falhas ocasionais (3% de chance se lucrativo)
    if (status === 'completed' && Math.random() < 0.03) {
      status = 'failed';
      error_message = 'Condições de mercado mudaram durante execução';
    }

    // Simular tempo de execução com base na prioridade
    const execution_start = Date.now();
    const base_execution_time = config.prioritizeSpeed ? 600 : 800;
    const simulated_execution_time = base_execution_time + Math.floor(Math.random() * 400);
    
    // Simular delay de execução
    await new Promise(resolve => setTimeout(resolve, simulated_execution_time));
    
    const execution_end = Date.now();
    const actual_execution_time = execution_end - execution_start;

    // ID único para a transação
    const transaction_id = `SYNTH_${symbol.replace('/', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Registrar a operação no banco
    const tradeRecord = {
      user_id: userId,
      symbol: symbol,
      buy_exchange: 'Binance Spot',
      sell_exchange: 'Binance Sintético',
      buy_price: buy_price,
      sell_price: sell_price,
      quantity: effectiveAmount / buy_price,
      investment_amount: effectiveAmount,
      gross_profit: gross_profit,
      gas_fees: 0, // Não há gas fees em exchanges centralizadas
      slippage_cost: trading_fees,
      net_profit: status === 'completed' ? net_profit : 0,
      roi_percentage: status === 'completed' ? roi_percentage : 0,
      spread_percentage: spread_percentage,
      execution_time_ms: actual_execution_time,
      risk_level: spread_percentage > 1.0 ? 'HIGH' : spread_percentage > 0.5 ? 'MEDIUM' : 'LOW',
      status: status,
      pionex_order_id: transaction_id,
      error_message: error_message,
      executed_at: new Date().toISOString(),
      trading_mode: mode
    };

    const { error: insertError } = await supabase
      .from('arbitrage_trades')
      .insert(tradeRecord);

    if (insertError) {
      console.error('❌ Erro ao salvar trade:', insertError);
    } else {
      console.log('💾 Trade registrado com sucesso');
    }

    // Marcar oportunidade como executada (inativar)
    await supabase
      .from('realtime_arbitrage_opportunities')
      .update({ is_active: false })
      .eq('id', opportunityId);

    // Resposta de sucesso
    const response = {
      success: status === 'completed',
      transaction_id: transaction_id,
      execution_details: {
        symbol: symbol,
        amount: effectiveAmount,
        buy_price: buy_price,
        sell_price: sell_price,
        spread_percentage: spread_percentage.toFixed(4),
        gross_profit: gross_profit.toFixed(6),
        trading_fees: trading_fees.toFixed(6),
        net_profit: net_profit.toFixed(6),
        roi_percentage: roi_percentage.toFixed(4),
        execution_time_ms: actual_execution_time,
        status: status,
        error_message: error_message,
        mode: mode
      },
      strategy: 'synthetic_pairs',
      description: `Arbitragem entre ${symbol} spot e sintético executada com ${status === 'completed' ? 'sucesso' : 'falha'}`,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Arbitragem sintética ${status}: ${symbol}, Lucro: $${net_profit.toFixed(2)}`);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro na execução de arbitragem sintética:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        strategy: 'synthetic_pairs'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});