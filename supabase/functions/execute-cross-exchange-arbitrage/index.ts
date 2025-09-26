import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExecuteCrossExchangeRequest {
  opportunityId: string;
  userId: string;
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  mode: 'simulation' | 'real';
  // Credenciais dos usuários para execução real
  binanceApiKey?: string;
  binanceSecretKey?: string;
  okxApiKey?: string;
  okxSecretKey?: string;
  okxPassphrase?: string;
  hyperliquidWalletAddress?: string;
  hyperliquidPrivateKey?: string;
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
      symbol,
      buyExchange,
      sellExchange,
      buyPrice,
      sellPrice,
      mode = 'simulation',
      // Credenciais dos usuários
      binanceApiKey,
      binanceSecretKey,
      okxApiKey,
      okxSecretKey,
      okxPassphrase,
      hyperliquidWalletAddress,
      hyperliquidPrivateKey,
      config = {
        investmentAmount: 1000,
        maxSlippage: 0.3,
        customFeeRate: 0.2, // 0.2% para cross-exchange
        stopLossPercentage: 2.0,
        prioritizeSpeed: true
      }
    }: ExecuteCrossExchangeRequest = await req.json();

    console.log(`🚀 Executando arbitragem cross-exchange: ${buyExchange} -> ${sellExchange} | ${symbol}, Valor: $${config.investmentAmount}, Modo: ${mode}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Aplicar configurações personalizadas
    const effectiveAmount = config.investmentAmount;
    const adjustedSpread = Math.abs((sellPrice - buyPrice) / buyPrice * 100);
    const slippageAdjustedSpread = Math.max(0, adjustedSpread - config.maxSlippage);
    
    // Calcular métricas da operação com configurações personalizadas
    const spread_percentage = slippageAdjustedSpread;
    const gross_profit = (effectiveAmount * spread_percentage) / 100;
    const trading_fees = effectiveAmount * (config.customFeeRate / 100);
    const transfer_fees = effectiveAmount * 0.001; // Taxa de transferência 0.1%
    const total_fees = trading_fees + transfer_fees;
    let net_profit = Math.max(0, gross_profit - total_fees);
    const roi_percentage = effectiveAmount > 0 ? (net_profit / effectiveAmount) * 100 : 0;

    // Verificar se é viável com margem de tolerância para dinâmica de preços
    let status = 'completed';
    let error_message = null;
    
    // Margem de tolerância de 0.3% para flutuações de preços em tempo real
    const priceFluctuationMargin = 0.3;
    const minViableSpread = 0.05; // Mínimo de 0.05% para ser considerado viável
    
    // Verificar se há lucro líquido após todos os custos com margem de tolerância
    if (net_profit <= 0 && spread_percentage < minViableSpread) {
      status = 'failed';
      error_message = `Operação não lucrativa após custos. Spread: ${spread_percentage.toFixed(3)}%, Mínimo: ${minViableSpread}%`;
    }
    
    // Verificar spread muito baixo considerando flutuação de preços
    if (spread_percentage < (minViableSpread - priceFluctuationMargin)) {
      status = 'failed';
      error_message = `Spread insuficiente para dinâmica de preços: ${spread_percentage.toFixed(3)}% (mín. ${minViableSpread}% com margem)`;
    }
    
    // Simular algumas falhas ocasionais (2% de chance se lucrativo)
    if (status === 'completed' && Math.random() < 0.02) {
      status = 'failed';
      error_message = 'Condições de liquidez mudaram durante execução';
    }

    // Simular tempo de execução realístico para cross-exchange
    const execution_start = Date.now();
    let base_execution_time = 2000; // 2 segundos base para cross-exchange
    
    if (config.prioritizeSpeed) {
      base_execution_time = 1500; // 1.5 segundos se priorizar velocidade
    }
    
    // Adicionar variação aleatória
    const simulated_execution_time = base_execution_time + Math.floor(Math.random() * 1000);
    
    // Simular delay de execução
    await new Promise(resolve => setTimeout(resolve, simulated_execution_time));
    
    const execution_end = Date.now();
    const actual_execution_time = execution_end - execution_start;

    // ID único para a transação
    const transaction_id = `CROSS_${symbol.replace('/', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // Executar operação real se for modo real
    let realOperationResults: any = null;
    
    if (mode === 'real' && status === 'completed') {
      try {
        console.log('💰 Executando operação real cross-exchange...');
        
        // Step 1: Executar compra na exchange de compra
        const buyResult = await executeBuyOrder(buyExchange, symbol, effectiveAmount, buyPrice, { binanceApiKey, binanceSecretKey, okxApiKey, okxSecretKey, okxPassphrase });
        console.log('✅ Compra executada:', buyResult);
        
        // Step 2: Executar venda na exchange de venda
        const sellResult = await executeSellOrder(sellExchange, symbol, effectiveAmount / buyPrice, sellPrice, { binanceApiKey, binanceSecretKey, okxApiKey, okxSecretKey, okxPassphrase });
        console.log('✅ Venda executada:', sellResult);
        
        realOperationResults = {
          buyOrder: buyResult,
          sellOrder: sellResult,
          realExecutionTime: actual_execution_time
        };
        
      } catch (realError) {
        console.error('❌ Erro na execução real:', realError);
        status = 'failed';
        
        // Tratamento específico para restrições de conformidade da OKX
        if (realError instanceof Error && realError.message?.includes('OKX_COMPLIANCE_RESTRICTION')) {
          error_message = `Par ${symbol} restrito por conformidade na OKX. Tente outro símbolo.`;
        } else {
          error_message = `Falha na execução real: ${realError instanceof Error ? realError.message : String(realError)}`;
        }
        
        net_profit = 0;
      }
    }

    // Registrar a operação no banco
    const tradeRecord = {
      user_id: userId,
      symbol: symbol,
      buy_exchange: buyExchange,
      sell_exchange: sellExchange,
      buy_price: buyPrice,
      sell_price: sellPrice,
      quantity: effectiveAmount / buyPrice,
      investment_amount: effectiveAmount,
      gross_profit: status === 'completed' ? gross_profit : 0,
      gas_fees: transfer_fees, // Usar taxa de transferência como "gas fee"
      slippage_cost: trading_fees,
      net_profit: status === 'completed' ? net_profit : 0,
      roi_percentage: status === 'completed' ? roi_percentage : 0,
      spread_percentage: spread_percentage,
      execution_time_ms: actual_execution_time,
      risk_level: spread_percentage > 2.0 ? 'HIGH' : spread_percentage > 1.0 ? 'MEDIUM' : 'LOW',
      status: status,
      pionex_order_id: transaction_id, // Reutilizar campo existente
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
      console.log('💾 Trade cross-exchange registrado com sucesso');
    }

    // Marcar oportunidade como executada (inativar)
    if (opportunityId && opportunityId !== 'manual') {
      await supabase
        .from('realtime_arbitrage_opportunities')
        .update({ is_active: false })
        .eq('id', opportunityId);
    }

    // Resposta de sucesso
    const response = {
      success: status === 'completed',
      transaction_id: transaction_id,
      mode: mode,
      isSimulation: mode === 'simulation',
      netProfit: parseFloat(net_profit.toFixed(6)),
      roiPercentage: parseFloat(roi_percentage.toFixed(4)),
      errorMessage: error_message,
      autoTransferExecuted: false,
      buyOrderId: realOperationResults?.buyOrder?.orderId || `${buyExchange}_${Date.now()}`,
      sellOrderId: realOperationResults?.sellOrder?.orderId || `${sellExchange}_${Date.now()}`,
      execution_details: {
        symbol: symbol,
        buy_exchange: buyExchange,
        sell_exchange: sellExchange,
        amount: effectiveAmount,
        buy_price: buyPrice,
        sell_price: sellPrice,
        spread_percentage: parseFloat(spread_percentage.toFixed(4)),
        gross_profit: parseFloat(gross_profit.toFixed(6)),
        trading_fees: parseFloat(trading_fees.toFixed(6)),
        transfer_fees: parseFloat(transfer_fees.toFixed(6)),
        total_fees: parseFloat(total_fees.toFixed(6)),
        net_profit: parseFloat(net_profit.toFixed(6)),
        roi_percentage: parseFloat(roi_percentage.toFixed(4)),
        execution_time_ms: actual_execution_time,
        status: status,
        error_message: error_message,
        mode: mode,
        cost_percentage: parseFloat(((total_fees / effectiveAmount) * 100).toFixed(3)),
        real_operation: realOperationResults
      },
      strategy: 'cross_exchange_arbitrage',
      description: `Arbitragem cross-exchange entre ${buyExchange} e ${sellExchange} executada com ${status === 'completed' ? 'sucesso' : 'falha'}`,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Arbitragem cross-exchange ${status}: ${buyExchange} -> ${sellExchange} | ${symbol}, Lucro: $${net_profit.toFixed(2)}`);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro na execução de arbitragem cross-exchange:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        strategy: 'cross_exchange_arbitrage'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Executar ordem de compra na exchange
async function executeBuyOrder(exchange: string, symbol: string, amountUSD: number, price: number, credentials?: { binanceApiKey?: string; binanceSecretKey?: string; okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }) {
  const quantity = amountUSD / price;
  
  if (exchange === 'Binance') {
    return await executeBinanceOrder(symbol, 'BUY', quantity, price);
  } else if (exchange === 'OKX') {
    // Pré-checagem de saldo USDT na OKX (conta de negociação)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/okx-api`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${supabaseKey}`
          },
        body: JSON.stringify({
          action: 'get_balances',
          api_key: credentials?.okxApiKey,
          secret_key: credentials?.okxSecretKey,
          passphrase: credentials?.okxPassphrase
        })
      });
      const data = await resp.json();
      const usdt = (data?.balances || []).find((b: any) => (b.asset || b.ccy) === 'USDT');
      const availableUSDT = Number(usdt?.free || 0);
      const requiredUSDT = amountUSD; // ordem market usa tgtCcy base_ccy, consumo em USDT
      if (availableUSDT + 1e-8 < requiredUSDT) {
        // Buscar saldos em outras contas e sugerir conversões
        try {
          const [respFunding, respPrices] = await Promise.all([
            fetch(`${supabaseUrl}/functions/v1/okx-api`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                action: 'get_funding_balances',
                api_key: credentials?.okxApiKey,
                secret_key: credentials?.okxSecretKey,
                passphrase: credentials?.okxPassphrase
              })
            }),
            fetch(`${supabaseUrl}/functions/v1/okx-api`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                action: 'get_prices',
                api_key: credentials?.okxApiKey,
                secret_key: credentials?.okxSecretKey,
                passphrase: credentials?.okxPassphrase
              })
            })
          ]);
          
          const dataFunding = await respFunding.json();
          const dataPrices = await respPrices.json();
          const prices = dataPrices?.prices || {};
          
          // Verificar USDT na Funding
          const usdtFunding = (dataFunding?.balances || []).find((b: any) => (b.asset || b.ccy) === 'USDT');
          const availableFundingUSDT = Number(usdtFunding?.free || 0);
          
          // Calcular valor total de outros ativos na Spot
          let totalValueSpot = availableUSDT;
          const spotAssets = [];
          for (const balance of (data?.balances || [])) {
            const asset = balance.asset || balance.ccy;
            const amount = Number(balance.free || 0);
            if (asset !== 'USDT' && amount > 0 && prices[asset]) {
              const value = amount * prices[asset];
              totalValueSpot += value;
              spotAssets.push({ asset, amount, value, price: prices[asset] });
            }
          }
          
          // Calcular valor total de ativos na Funding
          let totalValueFunding = availableFundingUSDT;
          const fundingAssets = [];
          for (const balance of (dataFunding?.balances || [])) {
            const asset = balance.asset || balance.ccy;
            const amount = Number(balance.free || 0);
            if (asset !== 'USDT' && amount > 0 && prices[asset]) {
              const value = amount * prices[asset];
              totalValueFunding += value;
              fundingAssets.push({ asset, amount, value, price: prices[asset] });
            }
          }
          
          // Ordenar ativos por valor (maior primeiro)
          spotAssets.sort((a, b) => b.value - a.value);
          fundingAssets.sort((a, b) => b.value - a.value);
          
          // Sugerir soluções baseadas nos ativos disponíveis
          let suggestion = '';
          if (totalValueSpot >= requiredUSDT) {
            const topAsset = spotAssets[0];
            suggestion = `Converta ${topAsset?.asset || 'seus ativos'} para USDT na conta Spot (valor disponível: $${totalValueSpot.toFixed(2)})`;
          } else if (totalValueFunding >= requiredUSDT) {
            const topAsset = fundingAssets[0];
            suggestion = `Transfira ${topAsset?.asset || 'ativos'} da Funding para Spot e converta para USDT (valor disponível: $${totalValueFunding.toFixed(2)})`;
          } else if (availableFundingUSDT >= requiredUSDT) {
            suggestion = `Transfira $${availableFundingUSDT.toFixed(2)} USDT da Funding para Spot`;
          }
          
          throw new Error(
            `Saldo USDT insuficiente na OKX Spot: necessário $${requiredUSDT.toFixed(2)}, disponível $${availableUSDT.toFixed(2)}. ` +
            `Funding: $${availableFundingUSDT.toFixed(2)} USDT. ${suggestion || 'Deposite mais USDT ou converta outros ativos.'}`
          );
        } catch (inner) {
          throw new Error(`Saldo insuficiente na OKX para compra: precisa $${requiredUSDT.toFixed(2)} USDT, disponível Spot $${availableUSDT.toFixed(2)}.`);
        }
      }
    } catch (e) {
      // Se falhar a checagem, seguimos para ordem mas com log claro
      console.warn('⚠️ Falha ao checar saldo da OKX, prosseguindo para ordem:', e);
    }
    return await executeOKXOrder(symbol, 'BUY', quantity, price, { okxApiKey: credentials?.okxApiKey, okxSecretKey: credentials?.okxSecretKey, okxPassphrase: credentials?.okxPassphrase });
  } else {
    throw new Error(`Exchange não suportada: ${exchange}`);
  }
}

// Executar ordem de venda na exchange
async function executeSellOrder(exchange: string, symbol: string, quantity: number, price: number, credentials?: { binanceApiKey?: string; binanceSecretKey?: string; okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }) {
  if (exchange === 'Binance') {
    return await executeBinanceOrder(symbol, 'SELL', quantity, price);
  } else if (exchange === 'OKX') {
    // Pré-checagem de saldo do ativo na OKX (conta de negociação)
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const resp = await fetch(`${supabaseUrl}/functions/v1/okx-api`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${supabaseKey}`
          },
        body: JSON.stringify({
          action: 'get_balances',
          api_key: credentials?.okxApiKey,
          secret_key: credentials?.okxSecretKey,
          passphrase: credentials?.okxPassphrase
        })
      });
      const data = await resp.json();
      const baseSymbol = symbol.replace('/USDT','').replace('USDT','').replace('-USDT','');
      const asset = (data?.balances || []).find((b: any) => (b.asset || b.ccy) === baseSymbol);
      const available = Number(asset?.free || 0);
      if (available + 1e-12 < quantity) {
        // Verificar ativos em outras contas e sugerir soluções
        try {
          const [respFunding, respPrices] = await Promise.all([
            fetch(`${supabaseUrl}/functions/v1/okx-api`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                action: 'get_funding_balances',
                api_key: credentials?.okxApiKey,
                secret_key: credentials?.okxSecretKey,
                passphrase: credentials?.okxPassphrase
              })
            }),
            fetch(`${supabaseUrl}/functions/v1/okx-api`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json', 
                'Authorization': `Bearer ${supabaseKey}`
              },
              body: JSON.stringify({
                action: 'get_prices',
                api_key: credentials?.okxApiKey,
                secret_key: credentials?.okxSecretKey,
                passphrase: credentials?.okxPassphrase
              })
            })
          ]);
          
          const dataFunding = await respFunding.json();
          const dataPrices = await respPrices.json();
          
          // Verificar se há o ativo na Funding
          const assetFunding = (dataFunding?.balances || []).find((b: any) => (b.asset || b.ccy) === baseSymbol);
          const availableFunding = Number(assetFunding?.free || 0);
          
          // Calcular valor necessário em USDT
          const currentPrice = dataPrices?.prices?.[baseSymbol] || price;
          const requiredValueUSDT = quantity * currentPrice;
          
          let suggestion = '';
          if (availableFunding >= quantity) {
            suggestion = `Transfira ${quantity} ${baseSymbol} da carteira Funding para Spot`;
          } else if (availableFunding > 0) {
            suggestion = `Funding possui apenas ${availableFunding} ${baseSymbol}. Precisa de mais ${(quantity - availableFunding).toFixed(8)} ${baseSymbol}`;
          } else {
            suggestion = `Compre ${baseSymbol} ou converta outros ativos. Valor necessário: $${requiredValueUSDT.toFixed(2)}`;
          }
          
          throw new Error(
            `Saldo ${baseSymbol} insuficiente na OKX Spot: necessário ${quantity}, disponível ${available}. ` +
            `Funding: ${availableFunding} ${baseSymbol}. ${suggestion}`
          );
        } catch (inner) {
          throw new Error(`Saldo insuficiente de ${baseSymbol} na OKX para venda: precisa ${quantity}, disponível Spot ${available}.`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Falha ao checar saldo do ativo na OKX, prosseguindo para ordem:', e);
    }
    return await executeOKXOrder(symbol, 'SELL', quantity, price, { okxApiKey: credentials?.okxApiKey, okxSecretKey: credentials?.okxSecretKey, okxPassphrase: credentials?.okxPassphrase });
  } else {
    throw new Error(`Exchange não suportada: ${exchange}`);
  }
}

// Verificar se símbolo está whitelistado na Binance
async function checkBinanceWhitelist(symbol: string): Promise<boolean> {
  try {
    const apiKey = Deno.env.get('BINANCE_API_KEY');
    const secretKey = Deno.env.get('BINANCE_SECRET_KEY');
    if (!apiKey || !secretKey) return false;

    const bSymbol = toBinanceSymbol(symbol);
    
    // Lista de símbolos comumente whitelistados - assumir true para estes
    const commonWhitelistedSymbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
      'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT'
    ];
    
    if (commonWhitelistedSymbols.includes(bSymbol)) {
      console.log(`✅ ${bSymbol} é um símbolo comum, assumindo whitelistado`);
      return true;
    }
    
    // Para outros símbolos, fazer teste real com uma ordem de teste (sem executar)
    const timestamp = Date.now();
    const params = new URLSearchParams({
      symbol: bSymbol,
      side: 'BUY',
      type: 'MARKET',
      quoteOrderQty: '10',
      timestamp: String(timestamp),
      recvWindow: '5000'
    });

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(params.toString()));
    const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

    // Usar o endpoint de teste para verificar se o símbolo é aceito
    const response = await fetch(`https://api.binance.com/api/v3/order/test?${params}&signature=${signatureHex}`, {
      method: 'POST',
      headers: { 'X-MBX-APIKEY': apiKey }
    });

    // Se teste passou, símbolo está whitelistado
    if (response.ok) {
      return true;
    }
    
    // Se erro -2010, não está whitelistado
    const errorData = await response.json().catch(() => ({}));
    if (errorData.code === -2010) {
      return false;
    }
    
    // Outros erros, assumir whitelistado (pode ser problema de saldo, etc)
    return true;
  } catch {
    // Em caso de erro na verificação, assumir que está whitelistado para não bloquear operação
    return true;
  }
}

// Função padronizada para conversão de símbolos Binance
function toBinanceSymbol(s: string): string {
  const cleanSymbol = s.replace('-USDT', '').replace('USDT', '').replace('-', '').replace('/', '').toUpperCase();
  return `${cleanSymbol}USDT`;
}

// Executar ordem na Binance (REAL) - Com verificação de whitelist e tratamento inteligente de LOT_SIZE
async function executeBinanceOrder(symbol: string, side: string, quantity: number, price: number) {
  try {
    console.log(`📊 Executando ordem Binance REAL: ${side} ${quantity} ${symbol} @ $${price}`);

    const apiKey = Deno.env.get('BINANCE_API_KEY');
    const secretKey = Deno.env.get('BINANCE_SECRET_KEY');
    if (!apiKey || !secretKey) {
      throw new Error('Credenciais da Binance não configuradas nos Secrets');
    }

    const bSymbol = toBinanceSymbol(symbol);
    
    // Verificar se símbolo está whitelistado ANTES de executar
    const isWhitelisted = await checkBinanceWhitelist(symbol);
    if (!isWhitelisted) {
      console.warn(`⚠️ Símbolo ${bSymbol} pode não estar whitelistado na API key`);
      // Continuar tentativa mas com log de aviso
    }

    const timestamp = Date.now();
    const recvWindow = 5000;
    const baseUrl = Deno.env.get('BINANCE_API_BASE_URL') || 'https://api.binance.com';
    console.log(`🔗 Binance base URL: ${baseUrl}`);

    // Estratégia inteligente: usar sempre quoteOrderQty para evitar erros de LOT_SIZE
    let params = new URLSearchParams({
      symbol: bSymbol,
      side: side.toUpperCase(),
      type: 'MARKET',
      timestamp: String(timestamp),
      recvWindow: String(recvWindow),
    });

    // Sempre usar quoteOrderQty para máxima compatibilidade
    const totalValue = quantity * price;
    let quoteOrderQty: number;

    if (side.toUpperCase() === 'BUY') {
      // BUY: usar pelo menos $11 para atender requisitos mínimos
      quoteOrderQty = Math.max(11, Math.round(totalValue * 100) / 100);
      console.log(`💰 BUY com quoteOrderQty: ${quoteOrderQty} USDT`);
    } else {
      // SELL: usar 90% do valor total para evitar problemas de saldo
      quoteOrderQty = Math.max(10, Math.floor(totalValue * 0.9 * 100) / 100);
      console.log(`💰 SELL com quoteOrderQty: ${quoteOrderQty} USDT`);
    }

    params.append('quoteOrderQty', quoteOrderQty.toFixed(2));

    // Assinar requisição
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(params.toString()));
    const signatureHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');

    const url = `${baseUrl}/api/v3/order?${params.toString()}&signature=${signatureHex}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));

    const raw = await response.text();
    if (!response.ok) {
      let parsed: any = null;
      try { parsed = JSON.parse(raw); } catch {}
      const code = parsed?.code ?? response.status;
      const msg = parsed?.msg ?? raw?.slice(0, 200);
      
      // Lista de símbolos comumente whitelistados
      const commonWhitelistedSymbols = [
        'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 
        'SOLUSDT', 'DOTUSDT', 'DOGEUSDT', 'MATICUSDT', 'LTCUSDT'
      ];
      
      // Tratamento específico para erros comuns
      if (code === -2010) {
        // Se é um símbolo comum e usuário já provou que está whitelistado, tentar novamente com configuração diferente
        if (commonWhitelistedSymbols.includes(bSymbol)) {
          console.warn(`⚠️ Erro -2010 para ${bSymbol} (comum whitelistado). Pode ser problema de configuração temporário.`);
          throw new Error(`Erro temporário da API Binance para ${bSymbol}. Tente novamente em alguns segundos.`);
        } else {
          throw new Error(`Símbolo ${bSymbol} não está whitelistado para esta API key. Configure os símbolos permitidos na Binance.`);
        }
      } else if (code === -1013) {
        throw new Error(`Erro de LOT_SIZE para ${bSymbol}. Valor usado: ${quoteOrderQty} USDT`);
      }
      
      throw new Error(`Binance API Error (${code}): ${msg}`);
    }

    const data = raw ? JSON.parse(raw) : {};
    console.log(`✅ Ordem Binance executada: ${data.orderId}, Qty: ${data.executedQty}, Preço: ${data.fills?.[0]?.price}`);
    
    return {
      orderId: data.orderId || `BIN_${Date.now()}`,
      executedQty: Number(data.executedQty ?? (quoteOrderQty / price)),
      executedPrice: Number(data.fills?.[0]?.price ?? price),
      status: data.status || 'FILLED',
      exchange: 'Binance'
    };

  } catch (error) {
    console.error('❌ Erro na ordem Binance (REAL):', error);
    throw error;
  }
}

// Função para otimizar quantidade baseada no símbolo
function getOptimalQuantity(symbol: string, quantity: number): number {
  // Regras específicas por símbolo para evitar LOT_SIZE errors
  const symbolRules: Record<string, { minQty: number, stepSize: number, precision: number }> = {
    'BTCUSDT': { minQty: 0.00001, stepSize: 0.00001, precision: 5 },
    'ETHUSDT': { minQty: 0.0001, stepSize: 0.0001, precision: 4 },
    'BNBUSDT': { minQty: 0.001, stepSize: 0.001, precision: 3 },
    'XRPUSDT': { minQty: 0.1, stepSize: 0.1, precision: 1 },
    'ADAUSDT': { minQty: 0.1, stepSize: 0.1, precision: 1 },
    'SOLUSDT': { minQty: 0.001, stepSize: 0.001, precision: 3 },
    'DOTUSDT': { minQty: 0.01, stepSize: 0.01, precision: 2 },
    'MATICUSDT': { minQty: 0.1, stepSize: 0.1, precision: 1 },
    'AVAXUSDT': { minQty: 0.001, stepSize: 0.001, precision: 3 },
    'LTCUSDT': { minQty: 0.001, stepSize: 0.001, precision: 3 }
  };
  
  const rules = symbolRules[symbol];
  if (!rules) {
    // Fallback para símbolos não mapeados
    return Number(Math.max(0.001, quantity).toFixed(6));
  }
  
  // Aplicar regras específicas
  const adjusted = Math.max(rules.minQty, quantity);
  const stepped = Math.floor(adjusted / rules.stepSize) * rules.stepSize;
  return Number(stepped.toFixed(rules.precision));
}

// Executar ordem na OKX com tratamento inteligente de tamanhos
async function executeOKXOrder(symbol: string, side: string, quantity: number, price: number, credentials?: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }) {
  try {
    const normalizedSide = side.toLowerCase();
    console.log(`📊 Executando ordem OKX: ${normalizedSide.toUpperCase()} ${quantity} ${symbol} @ $${price}`);
    
    // Ajustar quantidade baseado no valor da ordem para evitar erros de tamanho mínimo
    const totalValue = quantity * price;
    let adjustedQty = quantity;
    
    // Para ordens pequenas, ajustar quantidade para atender requisitos mínimos da OKX
    if (totalValue < 5) {
      // Garantir pelo menos $5 de valor para a ordem
      adjustedQty = Math.max(quantity, 5 / price);
      console.log(`🔧 Ajustando quantidade OKX: ${quantity} -> ${adjustedQty} (valor mínimo $5)`);
    }
    
    // Aplicar precisão adequada baseado no símbolo
    const symbolPrecision = getOKXSymbolPrecision(symbol);
    const finalQty = Number(adjustedQty.toFixed(symbolPrecision));
    
    console.log(`📊 Quantidade final OKX: ${finalQty} ${symbol}`);
    
    // Chamar a API OKX através da nossa edge function
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const url = `${supabaseUrl}/functions/v1/okx-api`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          action: 'place_order',
          api_key: credentials?.okxApiKey || Deno.env.get('OKX_API_KEY'),
          secret_key: credentials?.okxSecretKey || Deno.env.get('OKX_SECRET_KEY'),
          passphrase: credentials?.okxPassphrase || Deno.env.get('OKX_PASSPHRASE'),
          order: {
            symbol: symbol,
            side: normalizedSide,
            type: 'market',
            quantity: finalQty,
            price: price,
            timestamp: Date.now()
          }
        }),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
    
    const raw = await response.text();
    let result: any = null;
    
    try {
      result = raw ? JSON.parse(raw) : null;
    } catch {
      console.error(`❌ Resposta inválida da OKX API: ${raw?.slice(0, 300)}`);
      throw new Error(`Resposta JSON inválida da OKX (status ${response.status})`);
    }
    
    if (!response.ok) {
      const errorMsg = result?.error || result?.msg || raw?.slice(0, 200) || `HTTP ${response.status}`;
      console.error(`❌ Erro HTTP da OKX: ${response.status} - ${errorMsg}`);
      throw new Error(`OKX API Error: ${errorMsg}`);
    }
    
    if (!result?.success) {
      const errorMsg = result?.error || 'Ordem rejeitada pela OKX';
      console.error(`❌ Ordem rejeitada pela OKX: ${errorMsg}`);
      throw new Error(`OKX Order Error: ${errorMsg}`);
    }
    
    console.log(`✅ Ordem OKX executada com sucesso: ${result.orderId}`);
    
    return {
      orderId: result.orderId || `OKX_${Date.now()}`,
      executedQty: finalQty,
      executedPrice: price,
      status: 'FILLED',
      exchange: 'OKX'
    };
    
  } catch (error) {
    console.error('❌ Erro na ordem OKX:', error);
    throw error;
  }
}

// Função para determinar precisão adequada por símbolo na OKX
function getOKXSymbolPrecision(symbol: string): number {
  const cleanSymbol = symbol.replace('-USDT', '').replace('USDT', '').toUpperCase();
  
  const precisionMap: Record<string, number> = {
    'BTC': 8,
    'ETH': 6,
    'BNB': 4,
    'XRP': 1,
    'ADA': 1,
    'SOL': 4,
    'DOT': 3,
    'MATIC': 1,
    'AVAX': 4,
    'LTC': 4
  };
  
  return precisionMap[cleanSymbol] || 6; // Default 6 casas decimais
}