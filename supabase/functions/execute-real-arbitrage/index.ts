// @ts-nocheck
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Automated smart transfer evaluation script
interface TransferEvaluation {
  needsTransfer: boolean;
  fromExchange: string;
  toExchange: string;
  amount: number;
  symbol: string;
  estimatedCost: number;
  estimatedTime: number;
  profitAfterTransfer: number;
  worthExecuting: boolean;
}

async function evaluateSmartTransfer(
  supabase: any,
  userId: string,
  symbol: string,
  requiredAmount: number,
  targetExchange: string,
  expectedProfit: number
): Promise<TransferEvaluation> {
  console.log('🔍 Avaliando necessidade de transferência inteligente...');
  
  try {
    // 1. Verificar saldos em todas as exchanges
    const { data: balances } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .eq('symbol', symbol);

    if (!balances || balances.length === 0) {
      return {
        needsTransfer: false,
        fromExchange: '',
        toExchange: targetExchange,
        amount: requiredAmount,
        symbol,
        estimatedCost: 0,
        estimatedTime: 0,
        profitAfterTransfer: expectedProfit,
        worthExecuting: false
      };
    }

    // 2. Verificar se há saldo suficiente na exchange alvo
    const targetBalance = balances.find(b => 
      b.exchange?.toLowerCase() === targetExchange.toLowerCase()
    );

    const availableAmount = targetBalance 
      ? (targetBalance.balance - (targetBalance.locked_balance || 0))
      : 0;

    if (availableAmount >= requiredAmount) {
      console.log(`✅ Saldo suficiente na ${targetExchange}: ${availableAmount} ${symbol}`);
      return {
        needsTransfer: false,
        fromExchange: '',
        toExchange: targetExchange,
        amount: requiredAmount,
        symbol,
        estimatedCost: 0,
        estimatedTime: 0,
        profitAfterTransfer: expectedProfit,
        worthExecuting: true
      };
    }

    // 3. Encontrar a melhor exchange fonte para transferência
    const sourceExchanges = balances
      .filter(b => b.exchange && b.exchange.toLowerCase() !== targetExchange.toLowerCase())
      .filter(b => (b.balance - (b.locked_balance || 0)) >= requiredAmount)
      .sort((a, b) => b.balance - a.balance);

    if (sourceExchanges.length === 0) {
      console.log('❌ Não há saldo suficiente em nenhuma exchange');
      return {
        needsTransfer: false,
        fromExchange: '',
        toExchange: targetExchange,
        amount: requiredAmount,
        symbol,
        estimatedCost: 0,
        estimatedTime: 0,
        profitAfterTransfer: 0,
        worthExecuting: false
      };
    }

    const sourceExchange = sourceExchanges[0].exchange;
    console.log(`📤 Exchange fonte selecionada: ${sourceExchange}`);

    // 4. Calcular custos de transferência
    const transferCosts = await calculateTransferCosts(
      supabase,
      symbol,
      sourceExchange,
      targetExchange,
      requiredAmount
    );

    // 5. Estimar tempo de transferência
    const estimatedTime = getTransferTime(symbol, sourceExchange, targetExchange);

    // 6. Calcular lucro após transferência
    const profitAfterTransfer = expectedProfit - transferCosts.totalCost;

    // 7. Decidir se vale a pena executar
    const worthExecuting = profitAfterTransfer > 2.0; // Mínimo $2 de lucro líquido

    console.log(`💰 Lucro esperado após transferência: $${profitAfterTransfer.toFixed(2)}`);
    console.log(`⚖️ Vale a pena executar: ${worthExecuting ? 'SIM' : 'NÃO'}`);

    return {
      needsTransfer: true,
      fromExchange: sourceExchange,
      toExchange: targetExchange,
      amount: requiredAmount,
      symbol,
      estimatedCost: transferCosts.totalCost,
      estimatedTime,
      profitAfterTransfer,
      worthExecuting
    };

  } catch (error) {
    console.error('❌ Erro na avaliação de transferência:', error);
    return {
      needsTransfer: false,
      fromExchange: '',
      toExchange: targetExchange,
      amount: requiredAmount,
      symbol,
      estimatedCost: 0,
      estimatedTime: 0,
      profitAfterTransfer: 0,
      worthExecuting: false
    };
  }
}

async function calculateTransferCosts(
  supabase: any,
  symbol: string,
  fromExchange: string,
  toExchange: string,
  amount: number
) {
  // Custos base por exchange e símbolo
  const costDatabase = {
    binance: {
      withdrawal: {
        BTC: 0.0005, ETH: 0.005, USDT: 1.0, BNB: 0.0005,
        SOL: 0.01, ADA: 1.0, DOT: 0.1, MATIC: 0.1
      }
    },
    pionex: {
      deposit: 0, // Pionex não cobra depósito
      trading: 0.05 // 0.05% de taxa de trading
    }
  };

  const withdrawalFee = costDatabase.binance.withdrawal[symbol] || 1.0;
  const networkFee = withdrawalFee * 0.1; // Taxa de rede estimada
  const depositFee = 0; // Hyperliquid não cobra depósito
  const tradingFee = (amount * costDatabase.hyperliquid.trading) / 100;

  const totalCost = withdrawalFee + networkFee + depositFee + tradingFee;

  return {
    withdrawalFee,
    networkFee,
    depositFee,
    tradingFee,
    totalCost
  };
}

function getTransferTime(symbol: string, fromExchange: string, toExchange: string): number {
  // Tempos estimados em minutos
  const transferTimes = {
    BTC: 30, ETH: 15, USDT: 10, BNB: 5,
    SOL: 3, ADA: 10, DOT: 8, MATIC: 5
  };

  return transferTimes[symbol] || 15;
}

async function executeAutomaticTransfer(
  supabase: any,
  evaluation: TransferEvaluation,
  userId: string
): Promise<{ success: boolean; transferId?: string; error?: string }> {
  console.log('🚀 Executando transferência automática...');
  
  try {
    // Chamar a edge function de transferência inteligente
    const { data, error } = await supabase.functions.invoke('smart-cross-exchange-transfer', {
      body: {
        userId,
        fromExchange: evaluation.fromExchange,
        toExchange: evaluation.toExchange,
        symbol: evaluation.symbol,
        amount: evaluation.amount,
        reason: 'Automated arbitrage preparation',
        priority: 'high',
        autoExecute: true
      }
    });

    if (error) {
      console.error('❌ Erro na transferência automática:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Transferência automática iniciada:', data.transferId);
    return { success: true, transferId: data.transferId };

  } catch (error) {
    console.error('❌ Erro na execução da transferência:', error);
    return { success: false, error: error.message };
  }
}

// Interface para execução de trade
interface TradeExecution {
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  amount: number;
  buy_price: number;
  sell_price: number;
  user_id: string;
  trading_mode?: string; // Adicionar suporte ao modo de trading
  api_keys: {
    binance_api_key?: string;
    binance_secret_key?: string;
    okx_api_key?: string;
    okx_secret_key?: string;
    okx_passphrase?: string;
    hyperliquid_wallet_name?: string;
    hyperliquid_wallet_address?: string;
    hyperliquid_private_key?: string;
  };
  // Campos para funding arbitrage
  strategy?: 'long_spot_short_futures' | 'short_spot_long_futures';
  spotPrice?: number;
  futuresPrice?: number;
  calculations?: any;
  investmentAmount?: number;
}

// Função para validar se um símbolo é suportado pela API key
async function validateSymbolPermissions(symbol: string, apiKey: string, secretKey: string) {
  try {
    console.log(`🔍 Validando permissões para ${symbol}USDT...`);
    
    // Primeiro, testar apenas a informação pública do símbolo
    const exchangeInfoResponse = await fetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}USDT`);
    const exchangeInfo = await exchangeInfoResponse.json();
    
    if (!exchangeInfo.symbols || exchangeInfo.symbols.length === 0) {
      return {
        valid: false,
        error: 'symbol_not_found',
        message: `Símbolo ${symbol}USDT não encontrado na Binance.`
      };
    }

    const symbolInfo = exchangeInfo.symbols[0];
    if (symbolInfo.status !== 'TRADING') {
      return {
        valid: false,
        error: 'symbol_not_trading',
        message: `Símbolo ${symbol}USDT não está disponível para negociação no momento (status: ${symbolInfo.status}).`
      };
    }

    // Para validação de API key, fazer uma verificação mais simples
    // Tentar obter informações de conta (sem operações específicas do símbolo)
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    
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

    const accountResponse = await fetch(
      `https://api.binance.com/api/v3/account?${queryString}&signature=${signatureHex}`,
      {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': apiKey,
        }
      }
    );

    if (!accountResponse.ok) {
      const errorData = await accountResponse.text();
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch (e) {
        parsedError = { msg: errorData };
      }
      
      if (parsedError.code === -1022) {
        return {
          valid: false,
          error: 'invalid_signature',
          message: 'Assinatura inválida. Verifique sua secret key da Binance.'
        };
      } else if (parsedError.code === -2015) {
        return {
          valid: false,
          error: 'invalid_api_key',
          message: 'API key inválida ou sem permissões adequadas.'
        };
      } else {
        // Para outros erros, assumir que a API key funciona mas pode ter restrições específicas
        console.log(`⚠️ Aviso na validação da API key: ${parsedError.msg || 'erro desconhecido'}`);
      }
    }

    console.log(`✅ Símbolo ${symbol}USDT validado com sucesso (trading status: ${symbolInfo.status})`);
    return {
      valid: true,
      symbol: symbolInfo.symbol,
      status: symbolInfo.status,
      note: 'Símbolo válido para negociação'
    };

  } catch (error) {
    console.error(`❌ Erro na validação do símbolo ${symbol}:`, error);
    // Em caso de erro de validação, permitir continuar (não bloquear a operação)
    console.log(`⚠️ Continuando sem validação prévia para ${symbol}USDT...`);
    return {
      valid: true, // Permitir continuar mesmo com erro de validação
      error: 'validation_warning',
      message: `Aviso: Não foi possível validar completamente o símbolo ${symbol}USDT. A operação continuará normalmente.`
    };
  }
}

// Função para obter informações do símbolo e ajustar precisão
async function getSymbolInfo(symbol: string) {
  try {
    const response = await fetch(`https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}USDT`);
    const data = await response.json();
    
    if (!data.symbols || data.symbols.length === 0) {
      throw new Error(`Símbolo ${symbol}USDT não encontrado`);
    }
    
    const symbolInfo = data.symbols[0];
    const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    
    if (!lotSizeFilter) {
      throw new Error(`Filtro LOT_SIZE não encontrado para ${symbol}USDT`);
    }
    
    return {
      stepSize: parseFloat(lotSizeFilter.stepSize),
      minQty: parseFloat(lotSizeFilter.minQty),
      maxQty: parseFloat(lotSizeFilter.maxQty)
    };
  } catch (error) {
    console.error('Erro ao obter informações do símbolo:', error);
    // Fallback para valores padrão baseados no símbolo
    const defaultPrecision = getDefaultPrecision(symbol);
    return defaultPrecision;
  }
}

// Função auxiliar para precisão padrão baseada no símbolo
function getDefaultPrecision(symbol: string) {
  const precisionMap = {
    'BTC': { stepSize: 0.00001, minQty: 0.00001, maxQty: 9000 },
    'ETH': { stepSize: 0.0001, minQty: 0.0001, maxQty: 100000 },
    'BNB': { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 },
    'SOL': { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 },
    'ADA': { stepSize: 0.1, minQty: 0.1, maxQty: 90000000 },
    'XRP': { stepSize: 0.1, minQty: 0.1, maxQty: 90000000 },
    'DOT': { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 },
  };
  
  return precisionMap[symbol] || { stepSize: 0.001, minQty: 0.001, maxQty: 10000000 };
}

// Função para arredondar quantidade baseada no stepSize
function roundToStepSize(quantity: number, stepSize: number): number {
  const precision = Math.max(0, Math.ceil(Math.log10(1 / stepSize)));
  const rounded = Math.floor(quantity / stepSize) * stepSize;
  return parseFloat(rounded.toFixed(precision));
}

// Executar ordem na Binance com padrão USDT
async function executeBinanceOrder(
  symbol: string, 
  side: 'BUY' | 'SELL', 
  usdtAmount: number, // ⭐ MUDANÇA: Agora recebe valor em USDT diretamente
  currentPrice: number,
  apiKey: string,
  secretKey: string
) {
  console.log(`🔄 Iniciando ordem Binance ${side}: $${usdtAmount} USDT para ${symbol}`);
  
  try {
    // ⭐ NOVA LÓGICA: Calcular quantidade baseada no USDT
    let quantity: number;
    
    if (side === 'BUY') {
      // Para BUY: USDT → Crypto (quantidade = usdtAmount / preço)
      quantity = usdtAmount / currentPrice;
      console.log(`💰 COMPRA: $${usdtAmount} USDT → ${quantity} ${symbol} (preço: $${currentPrice})`);
    } else {
      // Para SELL: Crypto → USDT (quantidade = usdtAmount / preço)  
      quantity = usdtAmount / currentPrice;
      console.log(`💰 VENDA: ${quantity} ${symbol} → $${usdtAmount} USDT (preço: $${currentPrice})`);
    }
    
    // Obter informações do símbolo para ajustar precisão
    console.log(`🔍 Obtendo informações de precisão para ${symbol}USDT...`);
    const symbolInfo = await getSymbolInfo(symbol);
    console.log(`📊 Informações do símbolo ${symbol}:`, symbolInfo);
    
    // Arredondar quantidade baseada no stepSize
    const adjustedQuantity = roundToStepSize(quantity, symbolInfo.stepSize);
    console.log(`🎯 Quantidade ajustada: ${quantity} -> ${adjustedQuantity} (stepSize: ${symbolInfo.stepSize})`);
    
    // Verificar se a quantidade está dentro dos limites
    if (adjustedQuantity < symbolInfo.minQty) {
      throw new Error(`Quantidade muito pequena. Mínimo: ${symbolInfo.minQty}, Fornecido: ${adjustedQuantity}`);
    }
    
    if (adjustedQuantity > symbolInfo.maxQty) {
      throw new Error(`Quantidade muito grande. Máximo: ${symbolInfo.maxQty}, Fornecido: ${adjustedQuantity}`);
    }
    
    const timestamp = Date.now();
    const queryString = `symbol=${symbol}USDT&side=${side}&type=MARKET&quantity=${adjustedQuantity}&timestamp=${timestamp}`;
    
    console.log('🔐 Preparando assinatura para Binance (Operação baseada em USDT)...');
    console.log('📝 Query string final:', queryString);
    
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

    console.log('Enviando requisição para Binance API...');
    console.log('URL:', `https://api.binance.com/api/v3/order?${queryString}&signature=***`);

    // Executar ordem com timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(
      `https://api.binance.com/api/v3/order?${queryString}&signature=${signatureHex}`,
      {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);
    console.log('Resposta recebida da Binance:', response.status, response.statusText);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erro detalhado da Binance:', errorData);
      
      // Tratamento específico para erros comuns da Binance
      let parsedError;
      try {
        parsedError = JSON.parse(errorData);
      } catch (e) {
        parsedError = { msg: errorData };
      }
      
      // Mapear códigos de erro para mensagens mais amigáveis
      if (parsedError.code === -2010) {
        throw new Error(`❌ API Key não autorizada para negociar ${symbol}USDT. Verifique as permissões da sua API key na Binance ou ative o símbolo ${symbol} para negociação.`);
      } else if (parsedError.code === -1013) {
        throw new Error(`❌ Quantidade inválida para ${symbol}USDT. Verifique os limites mínimos e máximos.`);
      } else if (parsedError.code === -2011) {
        throw new Error(`❌ Ordem cancelada - ${symbol}USDT. Possível problema de conectividade.`);
      } else if (parsedError.code === -1021) {
        throw new Error(`❌ Timestamp fora do intervalo permitido. Verifique se o horário do sistema está correto.`);
      } else if (parsedError.code === -1022) {
        throw new Error(`❌ Assinatura inválida. Verifique sua secret key da Binance.`);
      } else {
        throw new Error(`Binance API Error (${parsedError.code || response.status}): ${parsedError.msg || 'Erro desconhecido'}`);
      }
    }

    const orderData = await response.json();
    console.log(`✅ Ordem Binance executada: ${side} ${quantity} ${symbol} - OrderId: ${orderData.orderId}`);
    console.log('Detalhes da ordem:', orderData);
    
    return {
      success: true,
      orderId: orderData.orderId,
      executedQty: parseFloat(orderData.executedQty),
      fills: orderData.fills || []
    };

  } catch (error) {
    console.error(`❌ Erro na ordem Binance (${side} ${symbol}):`, error);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Timeout na API da Binance (30s)',
        errorType: 'timeout'
      };
    }
    
    // Garantir que sempre temos uma mensagem de erro válida
    let errorMessage = 'Erro desconhecido na API da Binance';
    let errorType = 'unknown';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      // Determinar tipo de erro para melhor tratamento no frontend
      if (errorMessage.includes('API Key não autorizada')) {
        errorType = 'unauthorized_symbol';
      } else if (errorMessage.includes('Quantidade inválida')) {
        errorType = 'invalid_quantity';
      } else if (errorMessage.includes('Assinatura inválida')) {
        errorType = 'invalid_signature';
      } else if (errorMessage.includes('Timestamp fora do intervalo')) {
        errorType = 'timestamp_error';
      }
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      errorMessage = JSON.stringify(error);
    }
    
    return {
      success: false,
      error: errorMessage || 'Erro na execução da ordem',
      errorType: errorType
    };
  }
}

// Executar transferência interna na Binance entre SPOT e FUTURES
async function executeBinanceTransfer(
  asset: string,
  amount: number,
  type: 'MAIN_UMFUTURE' | 'UMFUTURE_MAIN', // SPOT para FUTURES ou FUTURES para SPOT
  apiKey: string,
  secretKey: string
) {
  console.log(`💸 Iniciando transferência Binance: ${amount} ${asset} (${type})`);
  
  try {
    const timestamp = Date.now();
    const params: any = {
      asset,
      amount: amount.toString(),
      type: type === 'MAIN_UMFUTURE' ? 1 : 2, // 1 = SPOT para FUTURES, 2 = FUTURES para SPOT
      timestamp
    };

    // Criar string de query para assinatura
    const queryString = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    // Gerar assinatura HMAC SHA256
    const signature = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ).then(key => 
      crypto.subtle.sign('HMAC', key, new TextEncoder().encode(queryString))
    ).then(signature => 
      Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    );

    const signedParams = { ...params, signature };
    
    console.log('📡 Executando transferência na Binance...');
    
    const response = await fetch('https://api.binance.com/sapi/v1/futures/transfer', {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(signedParams).toString()
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro na transferência Binance:', result);
      return {
        success: false,
        error: result.msg || `HTTP ${response.status}: ${response.statusText}`
      };
    }

    console.log(`✅ Transferência Binance bem-sucedida: ${amount} ${asset}`);
    console.log('Resultado da transferência:', result);
    
    // Aguardar um pouco para a transferência processar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      success: true,
      tranId: result.tranId,
      amount: amount,
      asset: asset,
      type: type
    };

  } catch (error) {
    console.error(`❌ Erro na transferência Binance (${asset}):`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Executar ordem na Hyperliquid - INTEGRAÇÃO REAL
async function executeHyperliquidOrder(
  symbol: string, 
  side: 'BUY' | 'SELL', 
  quantity: number,
  apiKey: string,
  secretKey: string
) {
  console.log(`🔄 Iniciando ordem Hyperliquid REAL ${side}: ${quantity} ${symbol}`);
  
  try {
    // Chamar a edge function da Hyperliquid para execução real
    const { data, error } = await supabase.functions.invoke('hyperliquid-api', {
      body: {
        action: 'place_order',
        symbol: symbol,
        side: side.toLowerCase(),
        type: 'market',
        quantity: quantity,
        apiKey: apiKey,
        secretKey: secretKey
      }
    });

    if (error) {
      console.error('❌ Erro na edge function Hyperliquid:', error);
      throw new Error(`Erro na API Hyperliquid: ${error.message}`);
    }

    if (!data.success) {
      console.error('❌ Ordem Hyperliquid falhou:', data.error);
      throw new Error(`Ordem Hyperliquid falhou: ${data.error}`);
    }

    console.log('✅ Ordem Hyperliquid executada:', data);
    return {
      success: true,
      orderId: data.orderId,
      executedQty: data.executedQty || quantity,
      executedPrice: data.executedPrice,
      status: data.status || 'FILLED',
      transactTime: data.transactTime || Date.now(),
      timestamp: data.timestamp || new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Erro na ordem Hyperliquid ${side}:`, error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido na ordem Hyperliquid',
      side,
      symbol
    };
  }
}

// Executar ordem na OKX - INTEGRAÇÃO REAL  
async function executeOKXOrder(
  symbol: string, 
  side: 'BUY' | 'SELL', 
  quantity: number,
  apiKey: string,
  secretKey: string,
  passphrase: string
) {
  console.log(`🔄 Iniciando ordem OKX ${side}: ${quantity} ${symbol}`);
  
  try {
    // Chamar a edge function da OKX para execução real
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
        quantity: quantity,
        api_key: apiKey,
        secret_key: secretKey,
        passphrase: passphrase
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro HTTP da OKX API:', response.status, errorText);
      throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      console.error('❌ Ordem OKX falhou:', data.error);
      throw new Error(`Ordem OKX falhou: ${data.error}`);
    }

    console.log('✅ Ordem OKX executada:', data);
    return {
      success: true,
      orderId: data.orderId,
      executedQty: data.executedQty || quantity,
      executedPrice: data.executedPrice,
      status: data.status || 'FILLED',
      transactTime: data.transactTime || Date.now(),
      timestamp: data.timestamp || new Date().toISOString()
    };
    
  } catch (error) {
    console.error(`❌ Erro na ordem OKX ${side}:`, error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido na ordem OKX',
      side,
      symbol
    };
  }
}

// Função auxiliar para converter símbolo para formato Hyperliquid
function convertToHyperliquidSymbol(symbol: string): string {
  // Hyperliquid usa formato padrão SYMBOL-USD
  return `${symbol}-USD`;
}

// Analisar necessidade de transferência cross-exchange
async function analyzeTransferNeed(
  userId: string,
  symbol: string,
  amount: number,
  buyPrice: number,
  sellPrice: number,
  buyExchange: string,
  sellExchange: string,
  supabase: any
) {
  console.log(`🔍 Analisando necessidade de transferência para ${symbol}`);
  
  try {
    // Buscar saldos atuais
    const { data: portfolioData, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .in('symbol', [symbol, 'USDT']);

    if (error) {
      console.error('Erro ao buscar portfolio:', error);
      return { shouldTransfer: false, reason: 'Erro ao buscar saldos' };
    }

    let binanceUSDT = 0, hyperliquidUSDT = 0;
    let binanceToken = 0, hyperliquidToken = 0;

    portfolioData?.forEach(balance => {
      const available = balance.balance - (balance.locked_balance || 0);
      
      if (balance.exchange?.toLowerCase() === 'binance' || !balance.exchange) {
        if (balance.symbol === 'USDT') binanceUSDT += available;
        if (balance.symbol === symbol) binanceToken += available;
      } else if (balance.exchange?.toLowerCase() === 'hyperliquid') {
        if (balance.symbol === 'USDT') hyperliquidUSDT += available;
        if (balance.symbol === symbol) hyperliquidToken += available;
      }
    });

    const requiredUSDT = amount * buyPrice;
    const requiredToken = amount;
    
    console.log(`💰 Saldos atuais: Binance USDT: $${binanceUSDT}, Token: ${binanceToken} | Hyperliquid USDT: $${hyperliquidUSDT}, Token: ${hyperliquidToken}`);
    console.log(`💵 Necessário: USDT: $${requiredUSDT}, Token: ${requiredToken}`);

    // Verificar se precisa transferir para compra
    if (buyExchange.toLowerCase() === 'binance' && binanceUSDT < requiredUSDT && hyperliquidUSDT > requiredUSDT) {
      const transferAmount = requiredUSDT - binanceUSDT + 10; // Margem de $10
      const spreadPercentage = ((sellPrice - buyPrice) / buyPrice) * 100;
      
      return {
        shouldTransfer: true,
        transferAmount: transferAmount,
        fromExchange: 'hyperliquid',
        toExchange: 'binance',
        symbol: 'USDT',
        reason: 'Insuficiente USDT na Binance para compra',
        spreadPercentage
      };
    }
    
    if (buyExchange.toLowerCase() === 'hyperliquid' && hyperliquidUSDT < requiredUSDT && binanceUSDT > requiredUSDT) {
      const transferAmount = requiredUSDT - hyperliquidUSDT + 10;
      const spreadPercentage = ((sellPrice - buyPrice) / buyPrice) * 100;
      
      return {
        shouldTransfer: true,
        transferAmount: transferAmount,
        fromExchange: 'binance',
        toExchange: 'hyperliquid',
        symbol: 'USDT',
        reason: 'Insuficiente USDT na Hyperliquid para compra',
        spreadPercentage
      };
    }

    // Verificar se precisa transferir para venda
    if (sellExchange.toLowerCase() === 'binance' && binanceToken < requiredToken && hyperliquidToken > requiredToken) {
      const transferAmount = requiredToken - binanceToken + (requiredToken * 0.01); // Margem de 1%
      const spreadPercentage = ((sellPrice - buyPrice) / buyPrice) * 100;
      
      return {
        shouldTransfer: true,
        transferAmount: transferAmount,
        fromExchange: 'hyperliquid',
        toExchange: 'binance',
        symbol: symbol,
        reason: `Insuficiente ${symbol} na Binance para venda`,
        spreadPercentage
      };
    }

    if (sellExchange.toLowerCase() === 'hyperliquid' && hyperliquidToken < requiredToken && binanceToken > requiredToken) {
      const transferAmount = requiredToken - hyperliquidToken + (requiredToken * 0.01);
      const spreadPercentage = ((sellPrice - buyPrice) / buyPrice) * 100;
      
      return {
        shouldTransfer: true,
        transferAmount: transferAmount,
        fromExchange: 'binance',
        toExchange: 'hyperliquid',
        symbol: symbol,
        reason: `Insuficiente ${symbol} na Hyperliquid para venda`,
        spreadPercentage
      };
    }

    return {
      shouldTransfer: false,
      reason: 'Saldos suficientes em ambas as exchanges'
    };

  } catch (error) {
    console.error('Erro na análise de transferência:', error);
    return { shouldTransfer: false, reason: 'Erro interno' };
  }
}

// Executar transferência inteligente
async function executeSmartTransfer(
  userId: string,
  symbol: string,
  amount: number,
  currentPrice: number,
  spreadPercentage: number,
  binanceApiKey: string,
  binanceSecretKey: string,
  supabase: any
) {
  try {
    console.log(`🚀 Executando transferência inteligente de ${amount} ${symbol}`);
    
    // Chamar o sistema de transferência inteligente
    const transferResponse = await supabase.functions.invoke('smart-cross-exchange-transfer', {
      body: {
        user_id: userId,
        symbol: symbol,
        required_amount: amount,
        current_price: currentPrice,
        arbitrage_spread_percent: spreadPercentage,
        binance_api_key: binanceApiKey,
        binance_secret_key: binanceSecretKey,
        hyperliquid_deposit_address: await getHyperliquidDepositAddress(symbol),
        execute: true
      }
    });

    if (transferResponse.error) {
      console.error('Erro na chamada de transferência:', transferResponse.error);
      return {
        success: false,
        message: `Erro na transferência: ${transferResponse.error.message}`
      };
    }

    return transferResponse.data;

  } catch (error) {
    console.error('Erro na execução de transferência:', error);
    return {
      success: false,
      message: `Erro interno: ${error.message}`
    };
  }
}

// Obter endereço de depósito da Pionex (simulado)
async function getPionexDepositAddress(symbol: string): Promise<string> {
  // Em produção real, isso seria obtido da API da Pionex
  // Por ora, retornar endereços simulados
  const addresses = {
    'BTC': '1PionexBTCAddress123456789',
    'ETH': '0xPionexETHAddress123456789',
    'USDT': 'TPionexUSDTAddress123456789',
    'BNB': 'bnb1pionexbnbaddress123456789',
    'SOL': 'PionexSolAddress123456789',
    'XRP': 'rPionexXRPAddress123456789'
  };
  
  return addresses[symbol] || `Pionex${symbol}Address123456789`;
}

serve(async (req) => {
  console.log('=== EXECUTE-REAL-ARBITRAGE INICIADO ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('Retornando CORS headers');
    return new Response(null, { headers: corsHeaders });
  }

  let requestData: TradeExecution | null = null;

  try {
    console.log('Inicializando cliente Supabase...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Fazendo parse do body da requisição...');
    const body = await req.text();
    console.log('Body recebido (primeiros 200 chars):', body?.substring(0, 200));
    
    // Verificar se o body não está vazio
    if (!body || body.trim() === '') {
      console.error('Body da requisição está vazio');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Body da requisição está vazio',
          error_type: 'empty_request_body'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      console.error('Body que causou erro:', body);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Dados da requisição inválidos - JSON malformado',
          error_type: 'invalid_json',
          details: parseError.message,
          received_body_length: body.length
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('Request data recebida:', {
      symbol: requestData.symbol,
      buy_exchange: requestData.buy_exchange,
      sell_exchange: requestData.sell_exchange,
      amount: requestData.amount,
      user_id: requestData.user_id,
      trading_mode: requestData.trading_mode,
      has_api_keys: !!requestData.api_keys,
      is_funding_arbitrage: !!(requestData.strategy && requestData.spotPrice && requestData.futuresPrice)
    });
    
        // Detectar se é funding arbitrage e ajustar dados
        const isFundingArbitrage = !!(requestData.strategy && requestData.spotPrice && requestData.futuresPrice);
        
        if (isFundingArbitrage) {
          console.log('🔄 Detectada operação de Funding Arbitrage');
          // Converter dados de funding arbitrage para formato padrão
          requestData.buy_exchange = requestData.strategy === 'long_spot_short_futures' ? 'Binance Spot' : 'Binance Futures';
          requestData.sell_exchange = requestData.strategy === 'long_spot_short_futures' ? 'Binance Futures' : 'Binance Spot';
          requestData.buy_price = requestData.strategy === 'long_spot_short_futures' ? requestData.spotPrice : requestData.futuresPrice;
          requestData.sell_price = requestData.strategy === 'long_spot_short_futures' ? requestData.futuresPrice : requestData.spotPrice;
          
          // Para funding arbitrage, o amount é geralmente calculado do investmentAmount
          if (requestData.investmentAmount && !requestData.amount) {
            requestData.amount = requestData.investmentAmount / requestData.buy_price;
          }
          
          // Registrar operação de funding arbitrage como entrada no portfólio
          try {
            const fundingDescription = `Funding Arbitrage: ${requestData.strategy}`;
            const fundingExchange = `Funding: ${requestData.symbol} ${requestData.buy_exchange} → ${requestData.sell_exchange}`;
            
            await supabase
              .from('portfolios')
              .insert({
                user_id: requestData.user_id,
                symbol: requestData.symbol,
                balance: 0, // Será atualizado pelas funções de update_portfolio_balance
                locked_balance: 0,
                exchange: fundingExchange,
                application_title: fundingDescription,
                investment_type: 'funding_arbitrage'
              });
              
            console.log(`📊 Operação de funding arbitrage registrada no portfólio`);
          } catch (portfolioError) {
            console.error('Erro ao registrar operação no portfólio:', portfolioError);
          }
        }
    
    console.log(`Iniciando execução de arbitragem: ${requestData.symbol} ${requestData.buy_exchange} -> ${requestData.sell_exchange}`);
    
    // VERIFICAR SE É MODO SIMULAÇÃO
    if (requestData.trading_mode === 'test') {
      console.log('🎭 MODO SIMULAÇÃO ATIVADO - Executando simulação segura');
      return await executeSimulatedArbitrage(supabase, requestData);
    }
    
    // ETAPA 1: Avaliação Inteligente de Transferência Cross-Exchange
    console.log('🧠 Iniciando avaliação automatizada de arbitragem...');
    console.log(`📊 Parâmetros: ${requestData.symbol} | ${requestData.buy_exchange} → ${requestData.sell_exchange} | ${requestData.amount} ${requestData.symbol}`);

    const estimatedProfit = (requestData.sell_price - requestData.buy_price) * requestData.amount;
    
    const buyEvaluation = await evaluateSmartTransfer(
      supabase, requestData.user_id, 'USDT', requestData.amount * requestData.buy_price, 
      requestData.buy_exchange, estimatedProfit
    );

    const sellEvaluation = await evaluateSmartTransfer(
      supabase, requestData.user_id, requestData.symbol, requestData.amount, 
      requestData.sell_exchange, estimatedProfit
    );

    // ETAPA 2: Executar transferências necessárias automaticamente
    const transferResults = [];
    
    if (buyEvaluation.needsTransfer && buyEvaluation.worthExecuting) {
      console.log('🔄 Executando transferência automática para exchange de compra...');
      const transferResult = await executeAutomaticTransfer(supabase, buyEvaluation, requestData.user_id);
      transferResults.push({
        type: 'buy_exchange_transfer',
        ...transferResult,
        evaluation: buyEvaluation
      });
    }

    if (sellEvaluation.needsTransfer && sellEvaluation.worthExecuting) {
      console.log('🔄 Executando transferência automática para exchange de venda...');
      const transferResult = await executeAutomaticTransfer(supabase, sellEvaluation, requestData.user_id);
      transferResults.push({
        type: 'sell_exchange_transfer',
        ...transferResult,
        evaluation: sellEvaluation
      });
    }

    // ETAPA 3: Aguardar confirmação das transferências se necessário
    if (transferResults.length > 0) {
      console.log('⏳ Aguardando confirmação das transferências...');
      // Aguardar um tempo para as transferências serem processadas
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // SISTEMA DE TRANSFERÊNCIA INTELIGENTE CROSS-EXCHANGE
    if (requestData.buy_exchange !== requestData.sell_exchange) {
      console.log('🔄 Verificando necessidade de transferência automática entre exchanges...');
      
      try {
        // Determinar qual exchange precisa de mais saldo
        const needsTransfer = await analyzeTransferNeed(
          requestData.user_id,
          requestData.symbol,
          requestData.amount,
          requestData.buy_price,
          requestData.sell_price,
          requestData.buy_exchange,
          requestData.sell_exchange,
          supabase
        );
        
        if (needsTransfer.shouldTransfer) {
          console.log('💸 Transferência automática recomendada:', needsTransfer);
          
          // Executar transferência automática
          const transferResult = await executeSmartTransfer(
            requestData.user_id,
            requestData.symbol,
            needsTransfer.transferAmount,
            requestData.buy_price,
            needsTransfer.spreadPercentage,
            requestData.api_keys.binance_api_key,
            requestData.api_keys.binance_secret_key,
            supabase
          );
          
          if (transferResult.success && transferResult.transfer_executed) {
            console.log(`✅ Transferência executada com sucesso. Aguardando ${transferResult.estimated_arrival_time} minutos...`);
            
            // Aguardar um pouco para a transferência processar (simulado)
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            console.log('✅ Prosseguindo com arbitragem após transferência');
          } else if (!transferResult.success) {
            console.log('⚠️ Transferência não executada:', transferResult.message);
          }
        }
      } catch (transferError) {
        console.log('⚠️ Erro na análise de transferência:', transferError.message);
        console.log('Prosseguindo com arbitragem sem transferência...');
      }
    }
    
    // Validar dados da requisição
    if (!requestData.symbol || !requestData.amount || !requestData.user_id || !requestData.buy_price || !requestData.sell_price) {
      throw new Error('Dados incompletos para execução do trade');
    }
    
    // Log detalhado para debug
    console.log('Validando user_id:', {
      user_id: requestData.user_id,
      length: requestData.user_id?.length,
      type: typeof requestData.user_id
    });
    
    // Verificar se é um UUID válido ou o UUID demo específico
    const isDemoUser = requestData.user_id === '00000000-0000-0000-0000-000000000000';
    // Regex mais flexível para aceitar qualquer UUID bem formatado
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(requestData.user_id);
    
    console.log('Validação UUID:', {
      isDemoUser,
      isValidUUID,
      shouldAccept: isDemoUser || isValidUUID,
      regex_test: uuidRegex.test(requestData.user_id)
    });
    
    if (!isDemoUser && !isValidUUID) {
      console.log('UUID rejeitado:', requestData.user_id);
      // Para UUIDs inválidos, retornar erro específico
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de usuário inválido',
        error_type: 'invalid_user_id',
        details: {
          message: 'O ID do usuário fornecido não é um UUID válido.',
          user_id_provided: requestData.user_id,
          suggestion: 'Verifique se você está logado corretamente ou tente usar o modo simulação.',
          regex_pattern: uuidRegex.toString()
        },
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('UUID aceito para processamento:', requestData.user_id);
    
    // Verificar se as chaves API necessárias estão presentes
    if (!requestData.api_keys) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Chaves API não configuradas',
        error_type: 'missing_api_keys',
        details: {
          message: 'É necessário configurar as chaves API da Binance ou Hyperliquid para executar operações reais.',
          suggestion: 'Vá para Configurações e adicione suas chaves API ou use o modo simulação.'
        },
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se as chaves específicas das exchanges estão disponíveis
    const needsBinance = requestData.buy_exchange === 'Binance' || requestData.sell_exchange === 'Binance' ||
                         requestData.buy_exchange === 'Binance Spot' || requestData.sell_exchange === 'Binance Spot' ||
                         requestData.buy_exchange === 'Binance Futures' || requestData.sell_exchange === 'Binance Futures';
    const needsHyperliquid = requestData.buy_exchange === 'Hyperliquid' || requestData.sell_exchange === 'Hyperliquid';
    
    if (needsBinance && (!requestData.api_keys.binance_api_key || !requestData.api_keys.binance_secret_key)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Chaves API da Binance não configuradas',
        error_type: 'missing_binance_keys',
        details: {
          message: 'Esta operação requer chaves API da Binance que não foram encontradas.',
          suggestion: 'Configure suas chaves API da Binance nas Configurações.'
        },
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (needsHyperliquid && (!requestData.api_keys.hyperliquid_private_key || !requestData.api_keys.hyperliquid_wallet_address)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Chaves API da Hyperliquid não configuradas',
        error_type: 'missing_hyperliquid_keys', 
        details: {
          message: 'Esta operação requer chaves API da Hyperliquid que não foram encontradas.',
          suggestion: 'Configure suas chaves API da Hyperliquid nas Configurações.'
        },
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Permitir execução para usuário demo com UUID válido
    if (isDemoUser) {
      console.log('Executando operação para usuário demo com UUID válido');
    }
    
    // Verificar saldos reais antes de executar
    console.log('Verificando saldos para operação real...');
    
    // Em modo real, verificar saldos diretamente das APIs ao invés do banco
    let balanceCheck;
    
    try {
      // Buscar saldos reais via API de portfolio
      const portfolioResponse = await fetch(`${supabaseUrl}/functions/v1/get-portfolio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`
        },
        body: JSON.stringify({
          user_id: requestData.user_id,
          real_mode: true,
          binance_api_key: requestData.api_keys.binance_api_key,
          binance_secret_key: requestData.api_keys.binance_secret_key,
          hyperliquid_wallet_name: requestData.api_keys.hyperliquid_wallet_name,
          hyperliquid_wallet_address: requestData.api_keys.hyperliquid_wallet_address,
          hyperliquid_private_key: requestData.api_keys.hyperliquid_private_key
        })
      });
      
      if (!portfolioResponse.ok) {
        throw new Error('Falha ao buscar saldos reais das APIs');
      }
      
      const portfolioResult = await portfolioResponse.json();
      console.log('Saldos reais obtidos das APIs:', portfolioResult.data?.portfolio?.length || 0, 'ativos');
      
      if (!portfolioResult.success || !portfolioResult.data?.portfolio) {
        throw new Error('Não foi possível obter saldos reais das APIs');
      }
      
      // Verificar saldos necessários
      const requiredUsdt = requestData.amount * requestData.buy_price;
      
      // Buscar saldos de USDT e do token nos dados reais
      const usdtBalance = portfolioResult.data.portfolio.find(asset => asset.symbol === 'USDT');
      const tokenBalance = portfolioResult.data.portfolio.find(asset => asset.symbol === requestData.symbol);
      
      const availableUsdt = usdtBalance ? (usdtBalance.balance - (usdtBalance.locked_balance || 0)) : 0;
      const availableToken = tokenBalance ? (tokenBalance.balance - (tokenBalance.locked_balance || 0)) : 0;
      
      console.log('Verificação de saldos reais (arbitragem):', {
        required_usdt: requiredUsdt,
        available_usdt: availableUsdt,
        available_token: availableToken,
        buy_exchange: requestData.buy_exchange,
        sell_exchange: requestData.sell_exchange,
        symbol: requestData.symbol,
        amount: requestData.amount
      });
      
      // Para funding arbitrage, verificar saldos específicos em spot e futures
      if (isFundingArbitrage) {
        // Para funding arbitrage precisamos verificar saldos separadamente em spot e futures
        const requiredUsdtAmount = requestData.amount * requestData.buy_price;
        const requiredTokenAmount = requestData.amount;
        
        console.log('💰 Verificando saldos para funding arbitrage:', {
          strategy: requestData.strategy,
          required_usdt: requiredUsdtAmount,
          required_token: requiredTokenAmount,
          available_usdt: availableUsdt,
          available_token: availableToken
        });
        
        // Verificar saldo total para transferências automáticas
        const totalUsdt = usdtBalance ? usdtBalance.balance : 0;
        const totalToken = tokenBalance ? tokenBalance.balance : 0;
        
        let transferNeeded = false;
        let transferPlan = [];
        
        // Verificar necessidades para ambas as estratégias
        if (requestData.strategy === 'long_spot_short_futures') {
          // Precisa de USDT em SPOT para comprar + TOKEN em FUTURES para vender
          console.log('📊 Estratégia: Long SPOT + Short FUTURES');
          
          // Verificar se precisa transferir USDT para SPOT
          if (availableUsdt < requiredUsdtAmount) {
            const deficit = requiredUsdtAmount - availableUsdt;
            if (totalUsdt >= requiredUsdtAmount) { // Tem saldo total suficiente
              transferPlan.push({
                asset: 'USDT',
                amount: deficit + 10, // Margem de $10
                type: 'UMFUTURE_MAIN', // FUTURES → SPOT
                reason: `Transferir USDT de FUTURES para SPOT para compra`
              });
              transferNeeded = true;
            }
          }
          
          // Verificar se precisa transferir TOKEN para FUTURES
          if (availableToken < requiredTokenAmount) {
            const deficit = requiredTokenAmount - availableToken;
            if (totalToken >= requiredTokenAmount) { // Tem saldo total suficiente
              transferPlan.push({
                asset: requestData.symbol,
                amount: deficit + (deficit * 0.001), // Margem de 0.1%
                type: 'MAIN_UMFUTURE', // SPOT → FUTURES
                reason: `Transferir ${requestData.symbol} de SPOT para FUTURES para venda`
              });
              transferNeeded = true;
            }
          }
          
        } else if (requestData.strategy === 'short_spot_long_futures') {
          // Precisa de TOKEN em SPOT para vender + USDT em FUTURES para comprar
          console.log('📊 Estratégia: Short SPOT + Long FUTURES');
          
          // Verificar se precisa transferir TOKEN para SPOT
          if (availableToken < requiredTokenAmount) {
            const deficit = requiredTokenAmount - availableToken;  
            if (totalToken >= requiredTokenAmount) { // Tem saldo total suficiente
              transferPlan.push({
                asset: requestData.symbol,
                amount: deficit + (deficit * 0.001), // Margem de 0.1%
                type: 'UMFUTURE_MAIN', // FUTURES → SPOT
                reason: `Transferir ${requestData.symbol} de FUTURES para SPOT para venda`
              });
              transferNeeded = true;
            }
          }
          
          // Verificar se precisa transferir USDT para FUTURES
          if (availableUsdt < requiredUsdtAmount) {
            const deficit = requiredUsdtAmount - availableUsdt;
            if (totalUsdt >= requiredUsdtAmount) { // Tem saldo total suficiente
              transferPlan.push({
                asset: 'USDT',
                amount: transferAmount,
                type: 'MAIN_UMFUTURE', // SPOT para FUTURES
                reason: `Transferir USDT de SPOT para FUTURES`
              });
              transferNeeded = true;
            }
          }
          
        } else if (requestData.strategy === 'long_spot_short_futures') {
          // Precisa de USDT em SPOT para comprar + TOKEN em FUTURES para vender
          
          // Verificar se há USDT suficiente no total mas não em SPOT
          if (availableUsdt < requiredUsdtAmount && totalUsdt >= requiredUsdtAmount) {
            const transferAmount = requiredUsdtAmount - availableUsdt + 10; // Margem de $10
            if (transferAmount <= totalUsdt) {
              transferPlan.push({
                asset: 'USDT',
                amount: transferAmount,
                type: 'UMFUTURE_MAIN', // FUTURES para SPOT
                reason: `Transferir USDT de FUTURES para SPOT`
              });
              transferNeeded = true;
            }
          }
          
          // Verificar se há token suficiente no total mas não em FUTURES
          if (availableToken < requiredTokenAmount && totalToken >= requiredTokenAmount) {
            const transferAmount = requiredTokenAmount - availableToken + 0.001; // Pequena margem
            if (transferAmount <= totalToken) {
              transferPlan.push({
                asset: requestData.symbol,
                amount: transferAmount,
                type: 'MAIN_UMFUTURE', // SPOT para FUTURES
                reason: `Transferir ${requestData.symbol} de SPOT para FUTURES`
              });
              transferNeeded = true;
            }
          }
        }
        
        // Executar transferências se necessário
        if (transferNeeded && transferPlan.length > 0) {
          console.log('🔄 Executando transferências automáticas:', transferPlan);
          
          let allTransfersSuccessful = true;
          const transferResults = [];
          
          for (const transfer of transferPlan) {
            console.log(`💸 ${transfer.reason}: ${transfer.amount} ${transfer.asset}`);
            
            const transferResult = await executeBinanceTransfer(
              transfer.asset,
              transfer.amount,
              transfer.type,
              requestData.api_keys.binance_api_key!,
              requestData.api_keys.binance_secret_key!
            );
            
            transferResults.push(transferResult);
            
            if (!transferResult.success) {
              console.error(`❌ Falha na transferência de ${transfer.asset}:`, transferResult.error);
              allTransfersSuccessful = false;
              break;
            } else {
              console.log(`✅ Transferência de ${transfer.asset} bem-sucedida`);
              
              // Registrar transferência no portfólio
              try {
                const transferDescription = `${transfer.reason} - Funding Arbitrage`;
                const transferSource = transfer.type === 'MAIN_UMFUTURE' ? 'SPOT' : 'FUTURES';
                const transferDestination = transfer.type === 'MAIN_UMFUTURE' ? 'FUTURES' : 'SPOT';
                
                // Inserir registro da transferência no portfólio
                await supabase
                  .from('portfolios')
                  .insert({
                    user_id: requestData.user_id,
                    symbol: transfer.asset,
                    balance: 0, // Não altera saldo total, apenas movimenta entre contas
                    locked_balance: 0,
                    exchange: `Transfer: ${transferSource} → ${transferDestination}`,
                    application_title: transferDescription,
                    investment_type: 'internal_transfer'
                  });
                
                console.log(`📊 Transferência registrada no portfólio: ${transfer.asset} ${transferSource} → ${transferDestination}`);
              } catch (portfolioError) {
                console.error('Erro ao registrar transferência no portfólio:', portfolioError);
              }
            }
          }
          
          if (allTransfersSuccessful) {
            console.log('✅ Todas as transferências concluídas. Prosseguindo com a operação...');
            
            // Re-verificar saldos após transferências
            try {
              console.log('🔄 Aguardando processamento das transferências...');
              await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar processamento
              
              console.log('📊 Re-verificando saldos após transferências...');
              const updatedPortfolioResult = await supabase.functions.invoke('get-portfolio', {
                body: {
                  real_mode: true,
                  user_id: requestData.user_id,
                  binance_api_key: requestData.api_keys.binance_api_key,
                  binance_secret_key: requestData.api_keys.binance_secret_key,
                  pionex_api_key: requestData.api_keys.pionex_api_key,
                  pionex_secret_key: requestData.api_keys.pionex_secret_key
                }
              });
              
              if (updatedPortfolioResult.data?.success) {
                // Atualizar saldos com dados mais recentes
                const updatedUsdtBalance = updatedPortfolioResult.data.data.portfolio.find(asset => asset.symbol === 'USDT');
                const updatedTokenBalance = updatedPortfolioResult.data.data.portfolio.find(asset => asset.symbol === requestData.symbol);
                
                const updatedAvailableUsdt = updatedUsdtBalance ? (updatedUsdtBalance.balance - (updatedUsdtBalance.locked_balance || 0)) : 0;
                const updatedAvailableToken = updatedTokenBalance ? (updatedTokenBalance.balance - (updatedTokenBalance.locked_balance || 0)) : 0;
                
                console.log('💰 Saldos atualizados após transferências:', {
                  before: { usdt: availableUsdt, token: availableToken },
                  after: { usdt: updatedAvailableUsdt, token: updatedAvailableToken },
                  required: { usdt: requiredUsdtAmount, token: requiredTokenAmount }
                });
                
                // Verificar se agora temos saldo suficiente
                if ((requestData.strategy === 'short_spot_long_futures' && 
                     updatedAvailableToken >= requiredTokenAmount && updatedAvailableUsdt >= requiredUsdtAmount) ||
                    (requestData.strategy === 'long_spot_short_futures' && 
                     updatedAvailableUsdt >= requiredUsdtAmount && updatedAvailableToken >= requiredTokenAmount)) {
                  
                  console.log('✅ Saldos suficientes após transferências. Operação aprovada!');
                  balanceCheck = {
                    sufficient: true,
                    message: `Saldo suficiente após transferências automáticas para funding arbitrage (${requestData.strategy})`,
                    available_usdt_after: updatedAvailableUsdt - requiredUsdtAmount,
                    available_token_after: updatedAvailableToken - requiredTokenAmount,
                    operation_type: `funding_arbitrage_${requestData.strategy}`,
                    transfers_executed: transferResults
                  };
                } else {
                  console.log('❌ Saldos ainda insuficientes mesmo após transferências');
                  balanceCheck = {
                    sufficient: false,
                    error: `Mesmo após transferências automáticas, saldo ainda insuficiente para funding arbitrage`,
                    required_usdt: requiredUsdtAmount,
                    available_usdt: updatedAvailableUsdt,
                    required_token: requiredTokenAmount,
                    available_token: updatedAvailableToken,
                    transfers_attempted: transferResults
                  };
                }
              } else {
                console.error('❌ Erro ao obter portfolio atualizado:', updatedPortfolioResult.error);
                balanceCheck = {
                  sufficient: false,
                  error: 'Erro ao verificar saldos após transferências',
                  transfers_attempted: transferResults
                };
              }
            } catch (portfolioError) {
              console.error('❌ Erro ao re-verificar portfolio após transferências:', portfolioError);
              balanceCheck = {
                sufficient: false,
                error: `Erro ao verificar saldos após transferências: ${portfolioError.message}`,
                transfers_attempted: transferResults
              };
            }
          } else {
            console.log('❌ Falha em uma ou mais transferências');
            balanceCheck = {
              sufficient: false,
              error: `Falha nas transferências automáticas necessárias para funding arbitrage`,
              required_usdt: requiredUsdtAmount,
              available_usdt: availableUsdt,
              required_token: requiredTokenAmount,
              available_token: availableToken,
              transfer_failures: transferResults.filter(r => !r.success)
            };
          }
        } else {
          // Verificação normal sem transferências
          if (requestData.strategy === 'short_spot_long_futures') {
            if (availableToken < requiredTokenAmount || availableUsdt < requiredUsdtAmount) {
              balanceCheck = {
                sufficient: false,
                error: `Funding arbitrage requer saldos tanto em SPOT quanto em FUTURES. Token em SPOT: ${availableToken.toFixed(8)}/${requiredTokenAmount.toFixed(8)}, USDT em FUTURES: $${availableUsdt.toFixed(2)}/$${requiredUsdtAmount.toFixed(2)}`,
                required_usdt: requiredUsdtAmount,
                available_usdt: availableUsdt,
                required_token: requiredTokenAmount,
                available_token: availableToken,
                details: {
                  operation_type: 'funding_arbitrage_short_spot_long_futures',
                  strategy: requestData.strategy,
                  note: 'Esta estratégia requer TOKEN em SPOT para vender e USDT em FUTURES para comprar'
                }
              };
            } else {
              balanceCheck = {
                sufficient: true,
                message: 'Saldo suficiente para funding arbitrage (short spot + long futures)',
                available_usdt_after: availableUsdt - requiredUsdtAmount,
                available_token_after: availableToken - requiredTokenAmount,
                operation_type: 'funding_arbitrage_short_spot_long_futures'
              };
            }
          } else if (requestData.strategy === 'long_spot_short_futures') {
            if (availableUsdt < requiredUsdtAmount || availableToken < requiredTokenAmount) {
              balanceCheck = {
                sufficient: false,
                error: `Funding arbitrage requer saldos tanto em SPOT quanto em FUTURES. USDT em SPOT: $${availableUsdt.toFixed(2)}/$${requiredUsdtAmount.toFixed(2)}, Token em FUTURES: ${availableToken.toFixed(8)}/${requiredTokenAmount.toFixed(8)}`,
                required_usdt: requiredUsdtAmount,
                available_usdt: availableUsdt,
                required_token: requiredTokenAmount,
                available_token: availableToken,
                details: {
                  operation_type: 'funding_arbitrage_long_spot_short_futures',
                  strategy: requestData.strategy,
                  note: 'Esta estratégia requer USDT em SPOT para comprar e TOKEN em FUTURES para vender'
                }
              };
            } else {
              balanceCheck = {
                sufficient: true,
                message: 'Saldo suficiente para funding arbitrage (long spot + short futures)',
                available_usdt_after: availableUsdt - requiredUsdtAmount,
                available_token_after: availableToken - requiredTokenAmount,
                operation_type: 'funding_arbitrage_long_spot_short_futures'
              };
            }
          }
        }
      } else {
        // CRITICAL: Para arbitragem cross-exchange, lógica correta:
        // 1. Iniciar com USDT suficiente
        // 2. Comprar token na primeira exchange
        // 3. Transferir/vender token na segunda exchange
        
        // Para operação real, verificar apenas USDT inicial necessário
        if (availableUsdt < requiredUsdt) {
          balanceCheck = {
            sufficient: false,
            error: `Saldo insuficiente de USDT para iniciar a arbitragem. Necessário: $${requiredUsdt.toFixed(2)}, Disponível: $${availableUsdt.toFixed(2)}`,
            required_usdt: requiredUsdt,
            available_usdt: availableUsdt,
            details: {
              operation_type: 'arbitrage_cross_exchange',
              amount: requestData.amount,
              price: requestData.buy_price,
              note: 'Arbitragem inicia com USDT e executa swaps durante a operação'
            }
          };
        } else {
          balanceCheck = {
            sufficient: true,
            message: 'Saldo USDT suficiente para iniciar arbitragem cross-exchange',
            available_usdt_after: availableUsdt - requiredUsdt,
            operation_type: 'arbitrage_cross_exchange'
          };
        }
      }
      
    } catch (error) {
      console.error('Erro ao verificar saldos reais:', error);
      balanceCheck = {
        sufficient: false,
        error: `Erro ao verificar saldos reais: ${error.message}`
      };
    }
    
      if (!balanceCheck.sufficient) {
      // Se não há saldo suficiente para operação real, AVISAR o usuário
      console.log('❌ OPERAÇÃO CANCELADA - Saldo insuficiente para operação real');
      console.log('Detalhes do saldo:', balanceCheck);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Saldo insuficiente para operação real',
        error_type: 'insufficient_balance',
        details: balanceCheck,
        suggestion: 'Adicione mais saldo ou use o modo simulação para testar.',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
      // REMOVIDO: execução automática de simulação quando deveria ser real
      
      // Proceder com simulação mesmo com saldo insuficiente
      const simulationSuccess = Math.random() > 0.2; // 80% chance de sucesso na simulação
      const investmentAmount = requestData.amount * requestData.buy_price;
      const grossProfit = (requestData.sell_price - requestData.buy_price) * requestData.amount;
      const totalFees = investmentAmount * 0.0025; // Taxa simulada
      const netProfit = grossProfit - totalFees;
      const roiPercentage = simulationSuccess ? (netProfit / investmentAmount) * 100 : 0;
      const executionTime = 1200 + Math.random() * 800; // 1.2-2.0 segundos

      const tradeRecord = {
        user_id: requestData.user_id,
        symbol: `${requestData.symbol}/USDT`,
        buy_exchange: requestData.buy_exchange,
        sell_exchange: requestData.sell_exchange,
        buy_price: requestData.buy_price,
        sell_price: requestData.sell_price,
        quantity: requestData.amount,
        investment_amount: investmentAmount,
        gross_profit: simulationSuccess ? grossProfit : 0,
        gas_fees: totalFees,
        net_profit: simulationSuccess ? netProfit : -totalFees,
        roi_percentage: roiPercentage,
        execution_time_ms: Math.round(executionTime),
        status: simulationSuccess ? 'completed' : 'failed',
        pionex_order_id: simulationSuccess ? `SIM${Date.now()}${Math.random().toString(36).substr(2, 6)}` : null,
        error_message: simulationSuccess ? 'Simulação - Saldo insuficiente para operação real' : 'Simulação de falha - Saldo insuficiente',
        executed_at: simulationSuccess ? new Date().toISOString() : null,
        trading_mode: 'simulation',
        risk_level: 'LOW'
      };

      // Salvar simulação no banco
      const { data: trade, error: tradeError } = await supabase
        .from('arbitrage_trades')
        .insert([tradeRecord])
        .select()
        .single();

      if (tradeError) {
        console.error('Erro ao salvar trade simulado:', tradeError);
      }

      console.log(`🎭 Simulação ${simulationSuccess ? 'bem-sucedida' : 'falhou'}: Lucro ${netProfit.toFixed(4)} USDT`);
      console.log('Motivo da simulação: Saldo insuficiente para operação real');

      // Criar detalhes do erro de saldo para informar ao usuário
      const balanceDetails = {
        message: balanceCheck.error,
        required_usdt: balanceCheck.required_usdt || 0,
        available_usdt: balanceCheck.available_usdt || 0,
        operation_details: balanceCheck.details || {},
        explanation: isFundingArbitrage 
          ? 'Para funding arbitrage real, você precisa de saldos tanto em SPOT quanto em FUTURES da Binance. Executamos uma simulação ao invés.'
          : 'Para arbitragem real, você precisa de USDT suficiente. Executamos uma simulação ao invés.'
      };

      // Adicionar informações específicas sobre token se for funding arbitrage
      if (isFundingArbitrage && balanceCheck.required_token !== undefined) {
        balanceDetails.required_token = balanceCheck.required_token;
        balanceDetails.available_token = balanceCheck.available_token || 0;
        balanceDetails.token_symbol = requestData.symbol;
      }

      return new Response(JSON.stringify({
        success: simulationSuccess,
        trade_id: trade?.id,
        execution_status: simulationSuccess ? 'completed' : 'failed',
        net_profit: netProfit,
        roi_percentage: roiPercentage,
        execution_time_ms: Math.round(executionTime),
        simulation_reason: 'insufficient_balance',
        balance_details: balanceDetails,
        // Dados para o modal do funding arbitrage
        spotOrder: {
          orderId: `sim_spot_${Date.now()}`,
          symbol: requestData.symbol,
          side: requestData.strategy === 'long_spot_short_futures' ? 'BUY' : 'SELL',
          quantity: requestData.amount,
          executedPrice: requestData.spotPrice || requestData.buy_price,
          fee: investmentAmount * 0.001,
          status: 'FILLED'
        },
        futuresOrder: {
          orderId: `sim_futures_${Date.now()}`,
          symbol: requestData.symbol,
          side: requestData.strategy === 'long_spot_short_futures' ? 'SELL' : 'BUY',
          quantity: requestData.amount,
          executedPrice: requestData.futuresPrice || requestData.sell_price,
          fee: investmentAmount * 0.0004,
          status: 'FILLED'
        },
        estimatedProfit: grossProfit,
        actualProfit: netProfit,
        fees: totalFees,
        status: simulationSuccess ? 'completed' : 'failed',
        message: simulationSuccess 
          ? `Simulação executada (saldo insuficiente para operação real)! Lucro: $${netProfit.toFixed(2)}`
          : 'Simulação falhou: Saldo insuficiente para operação real',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('Saldos verificados e bloqueados com sucesso:', balanceCheck);
    
    const startTime = Date.now();
    let buyResult: any = { success: false };
    let sellResult: any = { success: false };
    
    console.log('🚀 Iniciando execução das ordens de arbitragem...');
    console.log('Configuração da operação:', {
      symbol: requestData.symbol,
      amount: requestData.amount,
      buy_exchange: requestData.buy_exchange,
      sell_exchange: requestData.sell_exchange,
      buy_price: requestData.buy_price,
      sell_price: requestData.sell_price
    });
    
    console.log('📍 CHECKPOINT 1: Iniciando try block das ordens');
    
    try {
      console.log('📍 CHECKPOINT 2: Dentro do try block, iniciando validações');
      
      // 🔥 VALIDAR VALOR MÍNIMO NOTIONAL (previne erro -1013)
      const investmentAmount = requestData.amount * requestData.buy_price;
      const minNotional = 10; // Mínimo da Binance = $10 USDT
      if (investmentAmount < minNotional) {
        throw new Error(`Valor de investimento muito baixo: $${investmentAmount} < $${minNotional} USDT (mínimo da Binance)`);
      }
      
      // Validar permissões da API key para símbolos da Binance antes de executar
      if (requestData.buy_exchange === 'Binance' || requestData.sell_exchange === 'Binance') {
        console.log('🔍 Validando permissões da API Binance para o símbolo...');
        const validation = await validateSymbolPermissions(
          requestData.symbol,
          requestData.api_keys.binance_api_key!,
          requestData.api_keys.binance_secret_key!
        );
        
        if (!validation.valid) {
          console.error('❌ Validação falhou:', validation);
          throw new Error(`❌ ${validation.message}`);
        }
        
        console.log('✅ Permissões validadas com sucesso');
      }
      
      console.log('📍 CHECKPOINT 3: Iniciando ordem de compra');
      // Executar ordem de compra
      console.log(`📈 Executando ordem de COMPRA: ${requestData.amount} ${requestData.symbol} na ${requestData.buy_exchange}`);
      
      if (requestData.buy_exchange === 'Binance') {
        console.log('📍 CHECKPOINT 4: Executando ordem de compra na Binance...');
        buyResult = await executeBinanceOrder(
          requestData.symbol,
          'BUY',
          requestData.amount,
          requestData.api_keys.binance_api_key!,
          requestData.api_keys.binance_secret_key!
        );
        console.log('📍 CHECKPOINT 5: Resultado da ordem de compra Binance:', buyResult);
      } else if (requestData.buy_exchange === 'OKX') {
        console.log('📍 CHECKPOINT 4: Executando ordem de compra na OKX...');
        buyResult = await executeOKXOrder(
          requestData.symbol,
          'BUY',
          requestData.amount,
          requestData.api_keys.okx_api_key!,
          requestData.api_keys.okx_secret_key!,
          requestData.api_keys.okx_passphrase!
        );
        console.log('📍 CHECKPOINT 5: Resultado da ordem de compra OKX:', buyResult);
      } else if (requestData.buy_exchange === 'Pionex') {
        console.log('📍 CHECKPOINT 4: Executando ordem de compra na Pionex...');
        buyResult = await executePionexOrder(
          requestData.symbol,
          'BUY',
          requestData.amount,
          requestData.api_keys.pionex_api_key!,
          requestData.api_keys.pionex_secret_key!
        );
        console.log('Resultado da ordem de compra Pionex:', buyResult);
      }
      
      if (!buyResult.success) {
        const errorMsg = buyResult.error || 'Erro desconhecido na ordem de compra';
        console.error('❌ Falha na ordem de compra:', errorMsg);
        throw new Error(`Falha na ordem de compra: ${errorMsg}`);
      }
      
      console.log('📍 CHECKPOINT 5: Ordem de compra bem-sucedida, executando ordem de VENDA...');
      
      // SIMULAÇÃO: Se compramos numa exchange simulada e vamos vender numa real,
      // assumimos que temos o saldo necessário na exchange de venda
      if (requestData.buy_exchange === 'Pionex' && requestData.sell_exchange === 'Binance') {
        console.log('💫 SIMULANDO: Assumindo que tokens foram transferidos da Pionex para Binance');
        console.log(`💫 Saldo simulado: ${buyResult.executedQty} ${requestData.symbol} disponível na Binance`);
      }
      
      // Executar ordem de venda
      console.log(`📉 Executando ordem de VENDA: ${buyResult.executedQty} ${requestData.symbol} na ${requestData.sell_exchange}`);
      
      // NOTA IMPORTANTE: Em modo real com exchanges diferentes, seria necessário:
      // 1. Transferir tokens da exchange de compra para exchange de venda
      // 2. Aguardar confirmação da transferência
      // 3. Executar venda na segunda exchange
      // Por ora, assumimos que temos saldos em ambas as exchanges
      
      if (requestData.sell_exchange === 'Binance') {
        console.log('📍 CHECKPOINT 6: Executando ordem de venda na Binance...');
        sellResult = await executeBinanceOrder(
          requestData.symbol,
          'SELL',
          buyResult.executedQty,
          requestData.api_keys.binance_api_key!,
          requestData.api_keys.binance_secret_key!
        );
        console.log('Resultado da ordem de venda Binance:', sellResult);
      } else if (requestData.sell_exchange === 'OKX') {
        console.log('📍 CHECKPOINT 6: Executando ordem de venda na OKX...');
        sellResult = await executeOKXOrder(
          requestData.symbol,
          'SELL',
          buyResult.executedQty,
          requestData.api_keys.okx_api_key!,
          requestData.api_keys.okx_secret_key!,
          requestData.api_keys.okx_passphrase!
        );
        console.log('Resultado da ordem de venda OKX:', sellResult);
      } else if (requestData.sell_exchange === 'Pionex') {
        console.log('Chamando executePionexOrder para VENDA...');
        sellResult = await executePionexOrder(
          requestData.symbol,
          'SELL',
          buyResult.executedQty,
          requestData.api_keys.pionex_api_key!,
          requestData.api_keys.pionex_secret_key!
        );
        console.log('Resultado da ordem de venda Pionex:', sellResult);
      }
      
      if (!sellResult.success) {
        const errorMsg = sellResult.error || 'Erro desconhecido na ordem de venda';
        console.error('❌ Falha na ordem de venda:', errorMsg);
        throw new Error(`Falha na ordem de venda: ${errorMsg}`);
      }
      
      console.log('✅ Ambas as ordens executadas com sucesso!');
      
    } catch (tradeError) {
      // Se uma das ordens falhou, tentar reverter
      console.error('Erro durante execução, tentando reverter:', tradeError);
      
      // Desbloquear saldos que foram bloqueados
      try {
        await supabase.rpc('unlock_balance_after_arbitrage', {
          p_user_id: requestData.user_id,
          p_symbol: requestData.symbol,
          p_amount: requestData.amount,
          p_buy_exchange: requestData.buy_exchange,
          p_sell_exchange: requestData.sell_exchange,
          p_current_price: requestData.buy_price,
          p_success: false
        });
        console.log('Saldos desbloqueados após falha na execução');
      } catch (unlockError) {
        console.error('Erro ao desbloquear saldos após falha:', unlockError);
      }
      
        // Registrar trade como falha
        await supabase
          .from('arbitrage_trades')
          .insert({
            user_id: requestData.user_id,
            symbol: `${requestData.symbol}/USDT`,
            buy_exchange: requestData.buy_exchange,
            sell_exchange: requestData.sell_exchange,
            buy_price: requestData.buy_price,
            sell_price: requestData.sell_price,
            quantity: requestData.amount,
            investment_amount: requestData.amount * requestData.buy_price,
            gross_profit: 0,
            gas_fees: 0.001,
            slippage_cost: 0,
            net_profit: -0.001, // Perda das taxas
            roi_percentage: -0.1,
            spread_percentage: ((requestData.sell_price - requestData.buy_price) / requestData.buy_price) * 100,
            execution_time_ms: Date.now() - startTime,
            status: 'failed',
            error_message: tradeError.message,
            executed_at: new Date().toISOString(),
            trading_mode: requestData.trading_mode || 'simulation' // Usar o modo da requisição ou padrão simulação
          });
      
      throw tradeError;
    }
    
    // Calcular resultados
    const executionTime = Date.now() - startTime;
    const investmentAmount = buyResult.executedQty * requestData.buy_price;
    const grossProfit = sellResult.executedQty * requestData.sell_price - investmentAmount;
    const totalFees = 0.002; // Estimativa de taxas
    const netProfit = grossProfit - totalFees;
    const roiPercentage = (netProfit / investmentAmount) * 100;
    
    // Desbloquear saldos após execução bem-sucedida
    try {
      await supabase.rpc('unlock_balance_after_arbitrage', {
        p_user_id: requestData.user_id,
        p_symbol: requestData.symbol,
        p_amount: requestData.amount,
        p_buy_exchange: requestData.buy_exchange,
        p_sell_exchange: requestData.sell_exchange,
        p_current_price: requestData.buy_price,
        p_success: true
      });
      console.log('Saldos desbloqueados após execução bem-sucedida');
    } catch (unlockError) {
      console.error('Erro ao desbloquear saldos após sucesso:', unlockError);
    }
    
    // Atualizar saldos do portfolio com os resultados reais
    try {
      // Atualizar saldo da moeda comprada (diminuir USDT, aumentar crypto)
      await supabase.rpc('update_portfolio_balance', {
        p_user_id: requestData.user_id,
        p_symbol: 'USDT',
        p_amount_change: -investmentAmount
      });
      
      await supabase.rpc('update_portfolio_balance', {
        p_user_id: requestData.user_id,
        p_symbol: requestData.symbol,
        p_amount_change: buyResult.executedQty
      });
      
      // Atualizar saldo após venda (diminuir crypto, aumentar USDT)
      await supabase.rpc('update_portfolio_balance', {
        p_user_id: requestData.user_id,
        p_symbol: requestData.symbol,
        p_amount_change: -sellResult.executedQty
      });
      
      await supabase.rpc('update_portfolio_balance', {
        p_user_id: requestData.user_id,
        p_symbol: 'USDT',
        p_amount_change: (sellResult.executedQty * requestData.sell_price) - totalFees
      });
      
      console.log('Saldos do portfolio atualizados com sucesso');
    } catch (balanceError) {
      console.error('Erro ao atualizar saldos:', balanceError);
    }

      // Registrar trade bem-sucedido
      const { data: tradeRecord, error: tradeError } = await supabase
        .from('arbitrage_trades')
        .insert({
          user_id: requestData.user_id,
          symbol: `${requestData.symbol}/USDT`,
          buy_exchange: requestData.buy_exchange,
          sell_exchange: requestData.sell_exchange,
          buy_price: requestData.buy_price,
          sell_price: requestData.sell_price,
          quantity: sellResult.executedQty,
          investment_amount: investmentAmount,
          gross_profit: grossProfit,
          gas_fees: totalFees,
          slippage_cost: 0,
          net_profit: netProfit,
          roi_percentage: roiPercentage,
          spread_percentage: ((requestData.sell_price - requestData.buy_price) / requestData.buy_price) * 100,
          execution_time_ms: executionTime,
          status: 'completed',
          pionex_order_id: buyResult.orderId + '|' + sellResult.orderId,
          executed_at: new Date().toISOString(),
          trading_mode: requestData.trading_mode || 'simulation', // Usar o modo da requisição ou padrão simulação
          risk_level: 'MEDIUM' // Adicionar risk_level obrigatório
        })
        .select()
        .single();
      
      if (tradeError) {
        console.error('Erro ao registrar trade:', tradeError);
      }
      
      // Registrar operação concluída no portfólio para histórico
      try {
        const operationDescription = isFundingArbitrage 
          ? `Funding Arbitrage Executada: ${requestData.strategy}` 
          : `Arbitragem Cross-Exchange: ${requestData.buy_exchange} → ${requestData.sell_exchange}`;
        
        await supabase
          .from('portfolios')
          .insert({
            user_id: requestData.user_id,
            symbol: requestData.symbol,
            balance: netProfit, // Lucro líquido da operação
            locked_balance: 0,
            exchange: `Trade: ${requestData.buy_exchange} → ${requestData.sell_exchange}`,
            application_title: operationDescription,
            investment_type: isFundingArbitrage ? 'funding_arbitrage_result' : 'cross_exchange_arbitrage',
            price_usd: requestData.sell_price
          });
          
        console.log(`📊 Resultado da operação registrado no portfólio: ${netProfit.toFixed(4)} USDT`);
      } catch (portfolioResultError) {
        console.error('Erro ao registrar resultado no portfólio:', portfolioResultError);
      }
    
    console.log(`📍 CHECKPOINT FINAL: Arbitragem executada com sucesso - Lucro líquido ${netProfit.toFixed(4)} USDT (ROI: ${roiPercentage.toFixed(2)}%)`);
    
    console.log('📍 CHECKPOINT: Construindo resposta de sucesso...');
    
    return new Response(JSON.stringify({
      success: true,
      trade_id: tradeRecord?.id,
      execution_time_ms: executionTime,
      investment_amount: investmentAmount,
      net_profit: netProfit,
      roi_percentage: roiPercentage,
      buy_order: {
        exchange: requestData.buy_exchange,
        order_id: buyResult.orderId,
        executed_qty: buyResult.executedQty
      },
      sell_order: {
        exchange: requestData.sell_exchange,
        order_id: sellResult.orderId,
        executed_qty: sellResult.executedQty
      },
      automaticTransfers: transferResults,
      executionSummary: {
        symbol: requestData.symbol,
        buyExchange: requestData.buy_exchange,
        sellExchange: requestData.sell_exchange,
        amount: requestData.amount,
        estimatedProfit: grossProfit,
        actualProfit: netProfit,
        executionTime: `${executionTime}ms`,
        transfersExecuted: transferResults.length,
        totalTransferCost: transferResults.reduce((sum, t) => 
          sum + (t.evaluation?.estimatedCost || 0), 0
        )
      },
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    } catch (error) {
      console.error('📍 CHECKPOINT ERROR: Erro capturado na execução de arbitragem:', error);
      console.error('📍 ERROR DETAILS: Stack trace:', error.stack);
      console.error('📍 ERROR DETAILS: Message:', error.message);
      console.error('📍 ERROR DETAILS: Dados da requisição no momento do erro:', requestData ? {
        symbol: requestData.symbol,
        amount: requestData.amount,
        user_id: requestData.user_id,
        trading_mode: requestData.trading_mode
      } : 'Sem dados de requisição');
    
    // Se chegou até aqui, tentar desbloquear saldos em caso de erro não tratado
    if (requestData) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase.rpc('unlock_balance_after_arbitrage', {
          p_user_id: requestData.user_id,
          p_symbol: requestData.symbol,
          p_amount: requestData.amount,
          p_buy_exchange: requestData.buy_exchange,
          p_sell_exchange: requestData.sell_exchange,
          p_current_price: requestData.buy_price || 100,
          p_success: false
        });
        console.log('Saldos desbloqueados após erro geral');
      } catch (unlockError) {
        console.error('Erro ao desbloquear saldos após erro geral:', unlockError);
      }
    }
    
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message,
      error_type: 'internal_error',
      details: {
        message: 'Erro interno durante execução da arbitragem',
        stack: error.stack,
        has_request_data: !!requestData
      },
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Função para executar arbitragem simulada
async function executeSimulatedArbitrage(supabase: any, requestData: TradeExecution) {
  console.log('🎭 Executando arbitragem simulada...');
  
  // 🔥 VALIDAR VALOR MÍNIMO NOTIONAL (previne erro -1013)
  const investmentAmount = requestData.investmentAmount || (requestData.amount * requestData.buy_price);
  const minNotional = 10; // Mínimo da Binance = $10 USDT
  if (investmentAmount < minNotional) {
    throw new Error(`Valor de investimento muito baixo: $${investmentAmount} < $${minNotional} USDT (mínimo da Binance)`);
  }
  
  const startTime = Date.now();
  const simulationSuccess = Math.random() > 0.05; // 95% de sucesso
  
  // Simular resultados
  const executionTime = 400 + Math.random() * 300; // 400-700ms
  const grossProfit = requestData.amount * (requestData.sell_price - requestData.buy_price);
  const totalFees = investmentAmount * 0.001; // 0.1% taxas
  const netProfit = simulationSuccess ? grossProfit - totalFees : 0;
  const roiPercentage = simulationSuccess ? (netProfit / investmentAmount) * 100 : 0;
  
  const tradeRecord = {
    user_id: requestData.user_id, // Usar o user_id da requisição
    symbol: `${requestData.symbol}/USDT`, // Usar formato consistente
    buy_exchange: requestData.buy_exchange,
    sell_exchange: requestData.sell_exchange,
    buy_price: requestData.buy_price,
    sell_price: requestData.sell_price,
    quantity: requestData.amount,
    investment_amount: investmentAmount,
    gross_profit: grossProfit,
    gas_fees: totalFees,
    slippage_cost: 0,
    net_profit: netProfit,
    roi_percentage: roiPercentage,
    spread_percentage: ((requestData.sell_price - requestData.buy_price) / requestData.buy_price) * 100,
    execution_time_ms: Math.round(executionTime),
    status: simulationSuccess ? 'completed' : 'failed',
    pionex_order_id: simulationSuccess ? `SIM${Date.now()}${Math.random().toString(36).substr(2, 6)}` : null,
    error_message: simulationSuccess ? null : 'Simulação de falha de mercado',
    executed_at: simulationSuccess ? new Date().toISOString() : null,
    trading_mode: 'test',
    risk_level: 'LOW' // Adicionar risk_level que é obrigatório
  };
  
  // Salvar no banco
  const { data: trade, error: tradeError } = await supabase
    .from('arbitrage_trades')
    .insert([tradeRecord])
    .select()
    .single();
  
  if (tradeError) {
    console.error('Erro ao salvar trade simulado:', tradeError);
  }
  
  // Atualizar portfolio simulado
  if (simulationSuccess) {
    await supabase.rpc('update_portfolio_balance', {
      p_user_id: requestData.user_id,
      p_symbol: 'USDT',
      p_amount_change: netProfit
    });
  }
  
  console.log(`🎭 Simulação ${simulationSuccess ? 'bem-sucedida' : 'falhou'}: Lucro ${netProfit.toFixed(4)} USDT`);
  
  return new Response(JSON.stringify({
    success: simulationSuccess,
    trade_id: trade?.id,
    execution_status: simulationSuccess ? 'completed' : 'failed',
    net_profit: netProfit,
    roi_percentage: roiPercentage,
    execution_time_ms: Math.round(executionTime),
    // Dados para o modal do funding arbitrage
    spotOrder: {
      orderId: `sim_spot_${Date.now()}`,
      symbol: requestData.symbol,
      side: requestData.strategy === 'long_spot_short_futures' ? 'BUY' : 'SELL',
      quantity: requestData.amount,
      executedPrice: requestData.spotPrice || requestData.buy_price,
      fee: investmentAmount * 0.001,
      status: 'FILLED'
    },
    futuresOrder: {
      orderId: `sim_futures_${Date.now()}`,
      symbol: requestData.symbol,
      side: requestData.strategy === 'long_spot_short_futures' ? 'SELL' : 'BUY',
      quantity: requestData.amount,
      executedPrice: requestData.futuresPrice || requestData.sell_price,
      fee: investmentAmount * 0.0004,
      status: 'FILLED'
    },
    estimatedProfit: grossProfit,
    actualProfit: netProfit,
    fees: totalFees,
    status: simulationSuccess ? 'completed' : 'failed',
    message: simulationSuccess 
      ? `Simulação executada com sucesso! Lucro: $${netProfit.toFixed(2)}`
      : 'Simulação falhou: Condições de mercado desfavoráveis',
    timestamp: new Date().toISOString()
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}