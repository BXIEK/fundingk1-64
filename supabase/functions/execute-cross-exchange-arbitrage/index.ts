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
        investmentAmount: 10,
        maxSlippage: 0.3,
        customFeeRate: 0.2, // 0.2% para cross-exchange
        stopLossPercentage: 2.0,
        prioritizeSpeed: true
      }
    }: ExecuteCrossExchangeRequest = await req.json();

    console.log(`🚀 ARBITRAGEM CROSS-EXCHANGE [PADRÃO USDT]: ${buyExchange} -> ${sellExchange} | ${symbol}, Valor: $${config.investmentAmount} USDT, Modo: ${mode}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ⭐ NOVA LÓGICA USDT: Usar valor em USDT diretamente
    const usdtInvestment = config.investmentAmount;
    
    // 🔥 VALIDAR VALOR MÍNIMO NOTIONAL (previne erro -1013)
    // Binance exige $10 USDT mínimo POR ORDEM, como dividimos por 2, precisamos de $25 total
    const minNotional = 25; // $25 USDT total = $12.5 por ordem (acima do mínimo de $10)
    if (usdtInvestment < minNotional) {
      const errorMsg = `⚠️ Valor muito baixo: $${usdtInvestment} < $${minNotional} USDT (mínimo: $10/ordem × 2 ordens)`;
      console.error(errorMsg);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'MINIMUM_NOTIONAL',
          message: errorMsg,
          required_minimum: minNotional,
          your_amount: usdtInvestment
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      );
    }
    // Calcular spread real entre as exchanges
    const spread_percentage = Math.abs((sellPrice - buyPrice) / buyPrice * 100);
    
    // Calcular métricas da operação com USDT
    // Spread ajustado por slippage (reduz o spread esperado, mas não é um custo fixo)
    const effectiveSpread = Math.max(0, spread_percentage - config.maxSlippage);
    const gross_profit = (usdtInvestment * effectiveSpread) / 100;
    const trading_fees = usdtInvestment * (config.customFeeRate / 100);
    const transfer_fees = usdtInvestment * 0.001; // Taxa de transferência 0.1%
    const total_fees = trading_fees + transfer_fees;
    let net_profit = Math.max(0, gross_profit - total_fees);
    const roi_percentage = usdtInvestment > 0 ? (net_profit / usdtInvestment) * 100 : 0;

    // Executar sempre, independentemente da lucratividade (validação já feita no frontend)
    let status = 'completed';
    let error_message = null;
    
    // Simular algumas falhas ocasionais (2% de chance se lucrativo)
    if (status === 'completed' && Math.random() < 0.02) {
      status = 'failed';
      error_message = 'Condições de liquidez mudaram durante execução';
    }

    // Simular tempo de execução
    const execution_start = Date.now();
    const base_execution_time = config.prioritizeSpeed ? 1500 : 2000;
    const simulated_execution_time = base_execution_time + Math.floor(Math.random() * 1000);
    
    await new Promise(resolve => setTimeout(resolve, simulated_execution_time));
    
    const execution_end = Date.now();
    const actual_execution_time = execution_end - execution_start;

    const transaction_id = `CROSS_USDT_${symbol.replace('/', '')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

    // ⭐ EXECUÇÃO REAL COM PADRÃO USDT
    let realOperationResults: any = null;
    
    if (mode === 'real' && status === 'completed') {
      try {
        console.log('💰 EXECUTANDO OPERAÇÃO REAL COM PADRÃO USDT...');
        console.log(`📊 Credenciais: Binance=${!!binanceApiKey}, OKX=${!!okxApiKey}`);
        
        // Validar credenciais necessárias
        const needsBinance = buyExchange === 'Binance' || sellExchange === 'Binance';
        const needsOKX = buyExchange === 'OKX' || sellExchange === 'OKX';
        
        if (needsBinance && (!binanceApiKey || !binanceSecretKey)) {
          throw new Error('❌ Credenciais da Binance não fornecidas');
        }
        if (needsOKX && (!okxApiKey || !okxSecretKey || !okxPassphrase)) {
          throw new Error('❌ Credenciais da OKX não fornecidas');
        }
        
        // Dividir USDT entre as duas operações ($12.5 por ordem se total = $25)
        const usdtPerOperation = usdtInvestment / 2;
        console.log(`💵 Valor por operação: $${usdtPerOperation.toFixed(2)} USDT`);
        
        // Step 1: Executar compra na exchange de compra (USDT → Crypto)
        console.log(`🔄 PASSO 1 - COMPRA: $${usdtPerOperation} USDT → ${symbol} na ${buyExchange}...`);
        const buyResult = await executeBuyOrderUSDT(buyExchange, symbol, usdtPerOperation, buyPrice, { binanceApiKey, binanceSecretKey, okxApiKey, okxSecretKey, okxPassphrase });
        console.log('✅ Compra USDT executada:', JSON.stringify(buyResult));
        
        // Step 2: Executar venda na exchange de venda (Crypto → USDT)
        console.log(`🔄 PASSO 2 - VENDA: ${symbol} → $${usdtPerOperation} USDT na ${sellExchange}...`);
        const sellResult = await executeSellOrderUSDT(sellExchange, symbol, usdtPerOperation, sellPrice, { binanceApiKey, binanceSecretKey, okxApiKey, okxSecretKey, okxPassphrase });
        console.log('✅ Venda USDT executada:', JSON.stringify(sellResult));
        
        realOperationResults = {
          buyOrder: buyResult,
          sellOrder: sellResult,
          realExecutionTime: actual_execution_time,
          usdtOperationMode: true,
          totalUsdtUsed: usdtInvestment,
          usdtPerOperation: usdtPerOperation
        };
        
        console.log('🎉 OPERAÇÃO REAL CONCLUÍDA COM SUCESSO!');
        
      } catch (realError) {
        console.error('❌ ERRO NA EXECUÇÃO REAL:', realError);
        console.error('Stack:', realError instanceof Error ? realError.stack : 'N/A');
        
        status = 'failed';
        const errorMessage = realError instanceof Error ? realError.message : String(realError);
        
        // Identificar tipo de erro
        if (errorMessage.includes('IP') && errorMessage.includes('whitelist')) {
          error_message = `Erro OKX: ${errorMessage}. Configure seu IP na whitelist: https://www.okx.com/account/my-api`;
        } else if (errorMessage.includes('NOTIONAL')) {
          error_message = `Erro Binance: Valor mínimo não atingido. Use mínimo $25 USDT.`;
        } else {
          error_message = `Falha na execução real: ${errorMessage}`;
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
      quantity: usdtInvestment / buyPrice, // Quantidade equivalente em crypto
      investment_amount: usdtInvestment, // Valor em USDT
      gross_profit: status === 'completed' ? gross_profit : 0,
      gas_fees: transfer_fees,
      slippage_cost: trading_fees,
      net_profit: status === 'completed' ? net_profit : 0,
      roi_percentage: status === 'completed' ? roi_percentage : 0,
      spread_percentage: spread_percentage,
      execution_time_ms: actual_execution_time,
      risk_level: spread_percentage > 2.0 ? 'HIGH' : spread_percentage > 1.0 ? 'MEDIUM' : 'LOW',
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
      console.log('💾 Trade cross-exchange USDT registrado com sucesso');
    }

    // Marcar oportunidade como executada
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
      usdtOperationMode: true, // ⭐ NOVA FLAG
      buyOrderId: realOperationResults?.buyOrder?.orderId || `${buyExchange}_${Date.now()}`,
      sellOrderId: realOperationResults?.sellOrder?.orderId || `${sellExchange}_${Date.now()}`,
      execution_details: {
        symbol: symbol,
        buy_exchange: buyExchange,
        sell_exchange: sellExchange,
        usdt_investment: usdtInvestment, // ⭐ NOVO: Valor em USDT
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
        cost_percentage: parseFloat(((total_fees / usdtInvestment) * 100).toFixed(3)),
        real_operation: realOperationResults,
        operation_standard: 'USDT_ONLY' // ⭐ NOVO PADRÃO
      },
      strategy: 'cross_exchange_arbitrage_usdt',
      description: `Arbitragem cross-exchange USDT entre ${buyExchange} e ${sellExchange} executada com ${status === 'completed' ? 'sucesso' : 'falha'}`,
      timestamp: new Date().toISOString()
    };

    console.log(`✅ Arbitragem cross-exchange USDT ${status}: ${buyExchange} -> ${sellExchange} | ${symbol}, Lucro: $${net_profit.toFixed(2)} USDT`);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Erro na execução de arbitragem cross-exchange USDT:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        strategy: 'cross_exchange_arbitrage_usdt'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// ⭐ FUNÇÕES DE EXECUÇÃO COM PADRÃO USDT

// Executar ordem de compra na exchange (PADRÃO USDT)
async function executeBuyOrderUSDT(exchange: string, symbol: string, usdtAmount: number, price: number, credentials?: { binanceApiKey?: string; binanceSecretKey?: string; okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }) {
  console.log(`💰 COMPRA USDT: $${usdtAmount} USDT → ${symbol} na ${exchange} (preço: $${price})`);
  
  if (exchange === 'Binance') {
    return await executeBinanceOrderUSDT(symbol, 'BUY', usdtAmount, price, credentials?.binanceApiKey, credentials?.binanceSecretKey);
  } else if (exchange === 'OKX') {
    return await executeOKXOrderUSDT(symbol, 'BUY', usdtAmount, price, { okxApiKey: credentials?.okxApiKey, okxSecretKey: credentials?.okxSecretKey, okxPassphrase: credentials?.okxPassphrase });
  } else {
    throw new Error(`Exchange não suportada: ${exchange}`);
  }
}

// Executar ordem de venda na exchange (PADRÃO USDT)
async function executeSellOrderUSDT(exchange: string, symbol: string, usdtAmount: number, price: number, credentials?: { binanceApiKey?: string; binanceSecretKey?: string; okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }) {
  console.log(`💰 VENDA USDT: ${symbol} → $${usdtAmount} USDT na ${exchange} (preço: $${price})`);
  
  if (exchange === 'Binance') {
    return await executeBinanceOrderUSDT(symbol, 'SELL', usdtAmount, price, credentials?.binanceApiKey, credentials?.binanceSecretKey);
  } else if (exchange === 'OKX') {
    return await executeOKXOrderUSDT(symbol, 'SELL', usdtAmount, price, { okxApiKey: credentials?.okxApiKey, okxSecretKey: credentials?.okxSecretKey, okxPassphrase: credentials?.okxPassphrase });
  } else {
    throw new Error(`Exchange não suportada: ${exchange}`);
  }
}

// ⭐ NOVA FUNÇÃO: Executar ordens Binance baseadas em USDT
async function executeBinanceOrderUSDT(
  symbol: string,
  side: 'BUY' | 'SELL', 
  usdtAmount: number,
  currentPrice: number,
  apiKey?: string,
  secretKey?: string
) {
  console.log(`🚀 ORDEM BINANCE USDT: ${side} $${usdtAmount} USDT de ${symbol} (preço: $${currentPrice})`);
  
  if (!apiKey || !secretKey) {
    throw new Error('API keys da Binance são obrigatórias para execução real');
  }
  
  try {
    // Calcular quantidade de crypto baseada no USDT
    let quantity: number;
    
    if (side === 'BUY') {
      quantity = usdtAmount / currentPrice;
      console.log(`💵 COMPRA: $${usdtAmount} USDT → ${quantity} ${symbol}`);
    } else {
      quantity = usdtAmount / currentPrice;
      console.log(`💵 VENDA: ${quantity} ${symbol} → $${usdtAmount} USDT`);
    }
    
    // Obter informações do símbolo para ajustar precisão
    const symbolInfo = await getBinanceSymbolInfo(symbol);
    
    // Arredondar quantidade baseada no stepSize
    const adjustedQuantity = roundToStepSize(quantity, symbolInfo.stepSize);
    
    // Verificar limites
    if (adjustedQuantity < symbolInfo.minQty) {
      throw new Error(`Quantidade muito pequena: ${adjustedQuantity} < ${symbolInfo.minQty}`);
    }
    
    // Preparar ordem
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}USDT&side=${side}&type=MARKET&quantity=${adjustedQuantity}&timestamp=${timestamp}`;
    
    // Gerar assinatura
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    console.log(`📡 Enviando ordem USDT para Binance: ${side} ${adjustedQuantity} ${symbol}USDT`);
    
    // Executar ordem
    const response = await fetch(
      `https://api.binance.com/api/v3/order?${queryString}&signature=${signatureHex}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Erro Binance: ${errorData}`);
    }
    
    const responseData = await response.json();
    console.log(`✅ Ordem USDT Binance executada:`, responseData);
    
    return {
      success: true,
      orderId: responseData.orderId,
      symbol: symbol,
      side: side,
      executedQty: responseData.executedQty,
      executedUsdtValue: parseFloat(responseData.executedQty) * currentPrice,
      price: currentPrice,
      usdtAmount: usdtAmount,
      commission: responseData.fills?.reduce((sum: number, fill: any) => sum + parseFloat(fill.commission || 0), 0) || 0,
      timestamp: Date.now(),
      operationMode: 'USDT_BASED'
    };
    
  } catch (error) {
    console.error(`❌ Erro na ordem USDT Binance:`, error);
    throw error;
  }
}

// ⭐ NOVA FUNÇÃO: Executar ordens OKX baseadas em USDT
async function executeOKXOrderUSDT(
  symbol: string,
  side: 'BUY' | 'SELL',
  usdtAmount: number,
  currentPrice: number,
  credentials: { okxApiKey?: string; okxSecretKey?: string; okxPassphrase?: string }
) {
  console.log(`🚀 ORDEM OKX USDT: ${side} $${usdtAmount} USDT de ${symbol}`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  try {
    // Calcular quantidade baseada no USDT
    const cryptoQuantity = usdtAmount / currentPrice;
    console.log(`💵 OKX: ${side} ${cryptoQuantity} ${symbol} (valor: $${usdtAmount} USDT)`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/okx-api`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        action: 'place_order',
        symbol: symbol,
        side: side.toLowerCase(),
        type: 'market',
        quantity: cryptoQuantity,
        api_key: credentials.okxApiKey,
        secret_key: credentials.okxSecretKey,
        passphrase: credentials.okxPassphrase
      })
    });
    
    if (!response.ok) {
      throw new Error(`OKX order failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    return {
      success: true,
      orderId: result.orderId || `OKX_USDT_${Date.now()}`,
      executedQty: cryptoQuantity,
      executedUsdtValue: usdtAmount,
      price: currentPrice,
      side: side,
      symbol: symbol,
      timestamp: Date.now(),
      operationMode: 'USDT_BASED'
    };
    
  } catch (error) {
    console.error(`❌ Erro na ordem OKX USDT:`, error);
    throw error;
  }
}

// Funções auxiliares para USDT
async function getBinanceSymbolInfo(symbol: string) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}USDT`);
    const data = await response.json();
    
    if (!data.symbols || data.symbols.length === 0) {
      throw new Error(`Símbolo ${symbol}USDT não encontrado`);
    }
    
    const symbolInfo = data.symbols[0];
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
    
    return {
      stepSize: parseFloat(lotSizeFilter.stepSize),
      minQty: parseFloat(lotSizeFilter.minQty),
      maxQty: parseFloat(lotSizeFilter.maxQty)
    };
  } catch (error) {
    const precisionMap: Record<string, any> = {
      'BTC': { stepSize: 0.00001, minQty: 0.00001, maxQty: 9000 },
      'ETH': { stepSize: 0.0001, minQty: 0.0001, maxQty: 100000 },
      'SOL': { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 }
    };
    return precisionMap[symbol] || { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 };
  }
}

function roundToStepSize(quantity: number, stepSize: number): number {
  const precision = Math.max(0, Math.ceil(Math.log10(1 / stepSize)));
  const rounded = Math.floor(quantity / stepSize) * stepSize;
  return parseFloat(rounded.toFixed(precision));
}