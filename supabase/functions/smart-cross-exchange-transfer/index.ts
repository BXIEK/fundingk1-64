// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TransferAnalysis {
  symbol: string;
  amount: number;
  sourceExchange: string;
  targetExchange: string;
  arbitrageSpread: number;
  transferCosts: TransferCosts;
  netProfitAfterTransfer: number;
  isWorthwhile: boolean;
  estimatedTime: number;
}

interface TransferCosts {
  withdrawalFee: number;
  depositFee: number;
  networkFee: number;
  tradingFees: number;
  totalCosts: number;
  totalCostsPercentage: number;
}

interface ExchangeBalance {
  symbol: string;
  available: number;
  locked: number;
  exchange: string;
}

// Tabela de custos de transferência por símbolo e rede blockchain
const TRANSFER_COSTS = {
  'BTC': {
    'BTC': {
      withdrawal_fee: 0.0005,
      network_fee: 0.0001,
      deposit_fee: 0,
      min_withdrawal: 0.001,
      estimated_time: 30
    }
  },
  'ETH': {
    'ERC20': {
      withdrawal_fee: 0.005,
      network_fee: 0.002,
      deposit_fee: 0,
      min_withdrawal: 0.01,
      estimated_time: 15
    }
  },
  'BNB': {
    'BEP20': {
      withdrawal_fee: 0.0005,
      network_fee: 0.0001,
      deposit_fee: 0,
      min_withdrawal: 0.01,
      estimated_time: 3
    },
    'BEP2': {
      withdrawal_fee: 0.000075,
      network_fee: 0.000005,
      deposit_fee: 0,
      min_withdrawal: 0.01,
      estimated_time: 1
    }
  },
  'USDT': {
    'ERC20': {
      withdrawal_fee: 10.0,
      network_fee: 2.0,
      deposit_fee: 0,
      min_withdrawal: 20,
      estimated_time: 15
    },
    'TRC20': {
      withdrawal_fee: 1.0,
      network_fee: 0.1,
      deposit_fee: 0,
      min_withdrawal: 10,
      estimated_time: 3
    },
    'BEP20': {
      withdrawal_fee: 0.8,
      network_fee: 0.1,
      deposit_fee: 0,
      min_withdrawal: 10,
      estimated_time: 3
    },
    'POLYGON': {
      withdrawal_fee: 0.1,
      network_fee: 0.05,
      deposit_fee: 0,
      min_withdrawal: 5,
      estimated_time: 2
    }
  },
  'SOL': {
    'SOL': {
      withdrawal_fee: 0.01,
      network_fee: 0.000005,
      deposit_fee: 0,
      min_withdrawal: 0.01,
      estimated_time: 1
    }
  },
  'XRP': {
    'XRP': {
      withdrawal_fee: 0.25,
      network_fee: 0.00001,
      deposit_fee: 0,
      min_withdrawal: 20,
      estimated_time: 3
    }
  }
};

// Calcular custos de transferência baseado na rede
function calculateTransferCosts(symbol: string, network: string, amount: number, currentPrice: number): TransferCosts {
  const costs = TRANSFER_COSTS[symbol]?.[network] || {
    withdrawal_fee: currentPrice * 0.001, // 0.1% como fallback
    network_fee: currentPrice * 0.0001,
    deposit_fee: 0,
    min_withdrawal: currentPrice * 0.01,
    estimated_time: 15
  };

  const withdrawalFeeUsd = costs.withdrawal_fee * currentPrice;
  const networkFeeUsd = costs.network_fee * currentPrice;
  const depositFeeUsd = costs.deposit_fee;
  
  // Taxa de trading (assumindo 0.1% em cada exchange)
  const tradingFeesUsd = (amount * currentPrice) * 0.002; // 0.1% + 0.1%
  
  const totalCostsUsd = withdrawalFeeUsd + networkFeeUsd + depositFeeUsd + tradingFeesUsd;
  const totalCostsPercentage = (totalCostsUsd / (amount * currentPrice)) * 100;

  return {
    withdrawalFee: withdrawalFeeUsd,
    depositFee: depositFeeUsd,
    networkFee: networkFeeUsd,
    tradingFees: tradingFeesUsd,
    totalCosts: totalCostsUsd,
    totalCostsPercentage: totalCostsPercentage
  };
}

// Buscar saldos nas exchanges
async function getExchangeBalances(userId: string, symbol: string, supabase: any): Promise<{binance: ExchangeBalance, pionex: ExchangeBalance}> {
  try {
    // Buscar saldos do portfólio
    const { data: portfolioData, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol);

    if (error) {
      console.error('Erro ao buscar saldos:', error);
      throw error;
    }

    let binanceBalance = { symbol, available: 0, locked: 0, exchange: 'binance' };
    let pionexBalance = { symbol, available: 0, locked: 0, exchange: 'pionex' };

    // Somar saldos por exchange
    portfolioData?.forEach(balance => {
      const available = balance.balance - (balance.locked_balance || 0);
      
      if (balance.exchange?.toLowerCase() === 'binance' || !balance.exchange) {
        binanceBalance.available += available;
        binanceBalance.locked += balance.locked_balance || 0;
      } else if (balance.exchange?.toLowerCase() === 'pionex') {
        pionexBalance.available += available;
        pionexBalance.locked += balance.locked_balance || 0;
      }
    });

    return { binance: binanceBalance, pionex: pionexBalance };
  } catch (error) {
    console.error('Erro ao buscar saldos das exchanges:', error);
    return {
      binance: { symbol, available: 0, locked: 0, exchange: 'binance' },
      pionex: { symbol, available: 0, locked: 0, exchange: 'pionex' }
    };
  }
}

// Executar transferência da Binance para Pionex
async function executeBinanceToPionexTransfer(
  symbol: string,
  amount: number,
  binanceApiKey: string,
  binanceSecretKey: string,
  pionexAddress: string
): Promise<{success: boolean, txId?: string, error?: string}> {
  
  console.log(`💸 Executando transferência: ${amount} ${symbol} da Binance para Pionex`);
  
  try {
    const timestamp = Date.now();
    const params = {
      coin: symbol,
      address: pionexAddress,
      amount: amount.toString(),
      timestamp: timestamp
    };

    // Criar query string para assinatura
    const queryString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    // Gerar assinatura HMAC-SHA256
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(binanceSecretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const fullUrl = `https://api.binance.com/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signatureHex}`;
    
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': binanceApiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro na transferência Binance:', result);
      return {
        success: false,
        error: result.msg || `Erro HTTP: ${response.status}`
      };
    }

    console.log(`✅ Transferência iniciada com sucesso: ${result.id}`);
    
    return {
      success: true,
      txId: result.id
    };

  } catch (error) {
    console.error(`❌ Erro na transferência ${symbol}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Analisar se vale a pena fazer transferência para arbitragem
async function analyzeTransferWorthiness(
  symbol: string,
  network: string,
  requiredAmount: number,
  currentPrice: number,
  arbitrageSpreadPercent: number,
  balances: {binance: ExchangeBalance, pionex: ExchangeBalance}
): Promise<TransferAnalysis> {
  
  console.log(`🔍 Analisando viabilidade de transferência para ${symbol}`);
  
  // Verificar se há saldo suficiente na Binance
  const availableInBinance = balances.binance.available;
  const availableInPionex = balances.pionex.available;
  const shortfall = Math.max(0, requiredAmount - availableInPionex);
  
  console.log(`💰 Saldos: Binance: ${availableInBinance}, Pionex: ${availableInPionex}, Necessário: ${requiredAmount}`);
  
  if (shortfall === 0) {
    return {
      symbol,
      amount: requiredAmount,
      sourceExchange: 'binance',
      targetExchange: 'pionex',
      arbitrageSpread: arbitrageSpreadPercent,
      transferCosts: { withdrawalFee: 0, depositFee: 0, networkFee: 0, tradingFees: 0, totalCosts: 0, totalCostsPercentage: 0 },
      netProfitAfterTransfer: (requiredAmount * currentPrice * arbitrageSpreadPercent) / 100,
      isWorthwhile: true,
      estimatedTime: 0
    };
  }

  if (availableInBinance < shortfall) {
    console.log(`❌ Saldo insuficiente na Binance para transferência`);
    return {
      symbol,
      amount: shortfall,
      sourceExchange: 'binance',
      targetExchange: 'pionex',
      arbitrageSpread: arbitrageSpreadPercent,
      transferCosts: { withdrawalFee: 0, depositFee: 0, networkFee: 0, tradingFees: 0, totalCosts: 0, totalCostsPercentage: 0 },
      netProfitAfterTransfer: -1,
      isWorthwhile: false,
      estimatedTime: 0
    };
  }

  // Calcular custos de transferência
  const transferCosts = calculateTransferCosts(symbol, network, shortfall, currentPrice);
  
  // Calcular lucro bruto da arbitragem
  const grossProfitUsd = (requiredAmount * currentPrice * arbitrageSpreadPercent) / 100;
  
  // Lucro líquido após custos de transferência
  const netProfitAfterTransfer = grossProfitUsd - transferCosts.totalCosts;
  
  // Vale a pena se o lucro líquido for positivo e maior que $2
  const isWorthwhile = netProfitAfterTransfer > 2.0;
  
  const costs = TRANSFER_COSTS[symbol]?.[network];
  const estimatedTime = costs?.estimated_time || 15;
  
  console.log(`📊 Análise de transferência:`);
  console.log(`   Spread: ${arbitrageSpreadPercent.toFixed(2)}%`);
  console.log(`   Lucro bruto: $${grossProfitUsd.toFixed(2)}`);
  console.log(`   Custos transferência: $${transferCosts.totalCosts.toFixed(2)} (${transferCosts.totalCostsPercentage.toFixed(2)}%)`);
  console.log(`   Lucro líquido: $${netProfitAfterTransfer.toFixed(2)}`);
  console.log(`   Vale a pena: ${isWorthwhile ? '✅' : '❌'}`);

  return {
    symbol,
    amount: shortfall,
    sourceExchange: 'binance',
    targetExchange: 'pionex',
    arbitrageSpread: arbitrageSpreadPercent,
    transferCosts,
    netProfitAfterTransfer,
    isWorthwhile,
    estimatedTime
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== SMART CROSS-EXCHANGE TRANSFER INICIADO ===');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Dados recebidos:', body);

    const {
      user_id,
      symbol,
      network,
      required_amount,
      current_price,
      arbitrage_spread_percent,
      binance_api_key,
      binance_secret_key,
      pionex_deposit_address,
      execute = false
    } = body;

    // Validar dados obrigatórios
    if (!user_id || !symbol || !network || !required_amount || !current_price || !arbitrage_spread_percent) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados obrigatórios: user_id, symbol, network, required_amount, current_price, arbitrage_spread_percent'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar saldos nas exchanges
    const balances = await getExchangeBalances(user_id, symbol, supabase);
    
    // Analisar viabilidade da transferência
    const analysis = await analyzeTransferWorthiness(
      symbol,
      network,
      required_amount,
      current_price,
      arbitrage_spread_percent,
      balances
    );

    // Se foi solicitado para executar e é viável
    if (execute && analysis.isWorthwhile && analysis.amount > 0) {
      if (!binance_api_key || !binance_secret_key || !pionex_deposit_address) {
        return new Response(JSON.stringify({
          success: false,
          error: 'API keys da Binance e endereço de depósito da Pionex são obrigatórios para execução'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('🚀 Executando transferência automática...');
      
      const transferResult = await executeBinanceToPionexTransfer(
        symbol,
        analysis.amount,
        binance_api_key,
        binance_secret_key,
        pionex_deposit_address
      );

      // Registrar a transferência no banco
      if (transferResult.success) {
        await supabase.from('wallet_rebalance_operations').insert({
          user_id,
          symbol,
          amount: analysis.amount,
          from_exchange: 'binance',
          to_exchange: 'pionex',
          status: 'pending',
          withdrawal_tx_id: transferResult.txId,
          reason: `Transferência automática para arbitragem (spread: ${arbitrage_spread_percent.toFixed(2)}%)`,
          mode: 'real',
          priority: 'high'
        });
      }

      return new Response(JSON.stringify({
        success: true,
        analysis,
        transfer_executed: transferResult.success,
        transfer_id: transferResult.txId,
        transfer_error: transferResult.error,
        estimated_arrival_time: analysis.estimatedTime,
        message: transferResult.success 
          ? `Transferência de ${analysis.amount} ${symbol} iniciada com sucesso. Aguarde ${analysis.estimatedTime} minutos para processamento.`
          : `Análise concluída, mas transferência falhou: ${transferResult.error}`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Retornar apenas análise
    return new Response(JSON.stringify({
      success: true,
      analysis,
      transfer_executed: false,
      message: analysis.isWorthwhile 
        ? `Transferência recomendada: Lucro líquido estimado de $${analysis.netProfitAfterTransfer.toFixed(2)}`
        : `Transferência não recomendada: ${analysis.netProfitAfterTransfer < 0 ? 'Custos excedem lucros' : 'Lucro insuficiente'}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no sistema de transferência inteligente:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do sistema'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});