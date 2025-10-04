import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OKXOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
}

interface OKXOrderResponse {
  success: boolean;
  orderId?: string;
  symbol?: string;
  side?: string;
  type?: string;
  executedQty?: number;
  executedPrice?: number;
  status?: string;
  error?: string;
  transactTime?: number;
  timestamp?: string;
}

async function createOKXSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secretKey: string
): Promise<string> {
  const message = timestamp + method + requestPath + body;
  const keyData = new TextEncoder().encode(secretKey);
  const messageData = new TextEncoder().encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function makeOKXRequest(
  endpoint: string, 
  method: 'GET' | 'POST' = 'GET', 
  body?: any,
  creds?: { apiKey?: string; secretKey?: string; passphrase?: string }
): Promise<any> {
  console.log('🔗 CONEXÃO DIRETA OKX - SEM PROXIES/BYPASS');

  const apiKey = creds?.apiKey || Deno.env.get('OKX_API_KEY');
  const secretKey = creds?.secretKey || Deno.env.get('OKX_SECRET_KEY');
  const passphrase = creds?.passphrase || Deno.env.get('OKX_PASSPHRASE');

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error('Credenciais da OKX não encontradas');
  }

  const baseUrl = 'https://www.okx.com';
  const timestamp = new Date().toISOString();
  const requestPath = endpoint;
  const bodyStr = body ? JSON.stringify(body) : '';
  
  const signature = await createOKXSignature(timestamp, method, requestPath, bodyStr, secretKey);

  const headers: Record<string, string> = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json'
  };

  console.log(`🌐 OKX Direct Request: ${method} ${baseUrl}${requestPath}`);

  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erro na requisição OKX:', data);
    throw new Error(`OKX API Error: ${data.msg || data.error_message || response.statusText}`);
  }

  return data;
}

async function getOKXPrices(creds?: { apiKey?: string; secretKey?: string; passphrase?: string }): Promise<any> {
  try {
    console.log('📊 Obtendo preços da OKX...');
    
    const response = await makeOKXRequest('/api/v5/market/tickers?instType=SPOT', 'GET', undefined, creds);
    
    if (response.code !== '0') {
      const errorMsg = `OKX API Error: ${response.msg}`;
      console.error('❌ Erro da API OKX:', errorMsg);
      throw new Error(errorMsg);
    }

    const prices: Record<string, number> = {};
    
    if (!response.data || !Array.isArray(response.data)) {
      console.error('❌ Dados inválidos da OKX:', response);
      throw new Error('Dados inválidos retornados pela API OKX');
    }
    
    response.data.forEach((ticker: any) => {
      const baseSymbol = ticker.instId.replace('-USDT', '').replace('-', '');
      const price = parseFloat(ticker.last);
      if (price > 0 && ticker.instId.includes('-USDT')) {
        prices[baseSymbol] = price;
      }
    });

    console.log(`✅ Preços da OKX obtidos: ${Object.keys(prices).length} símbolos`);
    return { 
      success: true, 
      data: prices,
      count: Object.keys(prices).length
    };
    
  } catch (error) {
    console.error('❌ Erro ao obter preços da OKX:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return {
      success: false,
      error: errorMessage,
      count: 0
    };
  }
}

async function getOKXInstrument(instId: string, creds?: { apiKey?: string; secretKey?: string; passphrase?: string }): Promise<{ minSz: number; lotSz: number; tickSz: number }> {
  try {
    const resp = await makeOKXRequest(`/api/v5/public/instruments?instType=SPOT&instId=${instId}`, 'GET', undefined, creds);
    const info = resp?.data?.[0];
    if (!info) {
      console.warn(`⚠️ Instrumento ${instId} não encontrado na OKX`);
      throw new Error('Instrument not found');
    }
    
    const toNum = (v: string) => {
      const num = Number(v);
      return isNaN(num) ? 0 : num;
    };
    
    const rules = {
      minSz: toNum(info.minSz ?? '0.001'),
      lotSz: toNum(info.lotSz ?? info.ctVal ?? '0.0001'),
      tickSz: toNum(info.tickSz ?? '0.01')
    };
    
    console.log(`📊 Regras obtidas para ${instId}:`, rules);
    return rules;
    
  } catch (e) {
    console.warn(`⚠️ Falha ao obter regras para ${instId}, usando defaults:`, e);
    const cleanSymbol = instId.replace('-USDT', '');
    return getDefaultOKXRules(cleanSymbol);
  }
}

function decimalPlacesFromStep(step: number): number {
  const s = step.toString();
  const sci = s.match(/^\d+(?:\.\d+)?e-(\d+)$/i);
  if (sci) {
    return parseInt(sci[1], 10);
  }
  const i = s.indexOf('.');
  return i === -1 ? 0 : (s.length - i - 1);
}

function adjustOKXSize(qty: number, rules: { minSz: number; lotSz: number }): { qty: number; precision: number } {
  const base = Math.max(qty, rules.minSz);
  const stepped = Math.floor(base / rules.lotSz) * rules.lotSz;
  const safeQty = Math.max(stepped, rules.minSz);
  const precision = decimalPlacesFromStep(rules.lotSz);
  return { qty: Number(safeQty.toFixed(precision)), precision };
}

async function executeOKXOrder(orderRequest: OKXOrderRequest, creds?: { apiKey?: string; secretKey?: string; passphrase?: string }): Promise<OKXOrderResponse> {
  try {
    function convertToOKXFormat(symbol: string): string {
      let cleanSymbol = symbol.replace('-USDT', '').replace('USDT', '').replace('-', '');
      return `${cleanSymbol}-USDT`;
    }
    
    const instId = convertToOKXFormat(orderRequest.symbol);
    console.log(`🔄 Convertendo símbolo: ${orderRequest.symbol} -> ${instId}`);
    
    let rules: { minSz: number; lotSz: number; tickSz: number };
    try {
      rules = await getOKXInstrument(instId, creds);
    } catch (error) {
      console.warn(`⚠️ Erro ao obter regras para ${instId}, usando defaults:`, error);
      const cleanSymbol = orderRequest.symbol.replace('-USDT', '').replace('USDT', '').toUpperCase();
      rules = getDefaultOKXRules(cleanSymbol);
    }
    
    const { qty: adjustedQty } = adjustOKXSize(orderRequest.quantity, rules);
    
    const totalValue = adjustedQty * (orderRequest.price || 1000);
    if (totalValue < 1) {
      console.warn(`⚠️ Valor da ordem muito baixo: $${totalValue.toFixed(2)}, ajustando...`);
      const minValueQty = Math.max(1 / (orderRequest.price || 1000), rules.minSz);
      const { qty: finalQty } = adjustOKXSize(minValueQty, rules);
      
      console.log(`📋 Executando ordem na OKX:`, {
        symbol: orderRequest.symbol,
        instId: instId,
        side: orderRequest.side,
        type: orderRequest.type,
        originalQty: orderRequest.quantity,
        adjustedQty: finalQty,
        rules,
        totalValue: finalQty * (orderRequest.price || 1000),
        timestamp: Date.now()
      });
      
      return await executeOKXOrderInternal(instId, orderRequest, finalQty, creds);
    } else {
      console.log(`📋 Executando ordem na OKX:`, {
        symbol: orderRequest.symbol,
        instId: instId,
        side: orderRequest.side,
        type: orderRequest.type,
        originalQty: orderRequest.quantity,
        adjustedQty,
        rules,
        totalValue,
        timestamp: Date.now()
      });
      
      return await executeOKXOrderInternal(instId, orderRequest, adjustedQty, creds);
    }
    
  } catch (error) {
    console.error('❌ Falha ao executar ordem na OKX:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      symbol: orderRequest.symbol,
      side: orderRequest.side
    };
  }
}

async function executeOKXOrderInternal(instId: string, orderRequest: OKXOrderRequest, quantity: number, creds?: { apiKey?: string; secretKey?: string; passphrase?: string }): Promise<OKXOrderResponse> {
  const orderData = {
    instId: instId,
    tdMode: 'cash',
    side: orderRequest.side.toLowerCase(),
    ordType: orderRequest.type.toLowerCase(),
    sz: quantity.toString(),
    ...(orderRequest.type === 'limit' && orderRequest.price ? { px: orderRequest.price.toString() } : {}),
    ...(orderRequest.type === 'market' ? { 
      tgtCcy: orderRequest.side === 'buy' ? 'quote_ccy' : 'base_ccy' 
    } : {})
  };

  console.log(`🔧 Dados da ordem OKX:`, orderData);

  const response = await makeOKXRequest('/api/v5/trade/order', 'POST', orderData, creds);
  
  if (response.code !== '0') {
    const first = response?.data?.[0];
    const details = first ? ` | sCode=${first.sCode} sMsg=${first.sMsg}` : '';
    console.error(`❌ Erro OKX (code ${response.code}): ${response.msg}${details}`);
    throw new Error(`OKX API Error: ${response.msg}${details} (code: ${response.code})`);
  }
  
  const orderResult = response.data?.[0];
  if (!orderResult) {
    throw new Error('OKX Order Error: Resposta vazia da API');
  }
  
  const sCode = orderResult.sCode;
  const sMsg = orderResult.sMsg;
  
  if (sCode && sCode !== '0') {
    console.error(`❌ Erro na ordem OKX (sCode ${sCode}):`, sMsg);
    throw new Error(`OKX Order Error: ${sMsg || 'Ordem rejeitada'} (sCode=${sCode})`);
  }

  const result: OKXOrderResponse = {
    success: true,
    orderId: orderResult.ordId,
    symbol: orderRequest.symbol,
    side: orderRequest.side,
    type: orderRequest.type,
    executedQty: quantity,
    executedPrice: orderRequest.price,
    status: 'FILLED',
    transactTime: Date.now(),
    timestamp: new Date().toISOString()
  };
  
  console.log('✅ Ordem executada na OKX:', result);
  return result;
}

function getDefaultOKXRules(symbol: string): { minSz: number; lotSz: number; tickSz: number } {
  const rulesMap: Record<string, { minSz: number; lotSz: number; tickSz: number }> = {
    'BTC': { minSz: 0.00001, lotSz: 0.00000001, tickSz: 0.1 },
    'ETH': { minSz: 0.0001, lotSz: 0.000001, tickSz: 0.01 },
    'BNB': { minSz: 0.001, lotSz: 0.0001, tickSz: 0.01 },
    'XRP': { minSz: 1, lotSz: 0.0001, tickSz: 0.0001 },
    'ADA': { minSz: 1, lotSz: 0.0001, tickSz: 0.0001 },
    'SOL': { minSz: 0.001, lotSz: 0.0001, tickSz: 0.01 },
    'DOT': { minSz: 0.01, lotSz: 0.001, tickSz: 0.001 },
    'MATIC': { minSz: 1, lotSz: 0.0001, tickSz: 0.0001 },
    'AVAX': { minSz: 0.001, lotSz: 0.0001, tickSz: 0.01 },
    'LTC': { minSz: 0.001, lotSz: 0.0001, tickSz: 0.01 }
  };
  
  return rulesMap[symbol] || { minSz: 0.001, lotSz: 0.0001, tickSz: 0.01 };
}

async function getOKXBalances(creds?: { apiKey?: string; secretKey?: string; passphrase?: string }): Promise<any> {
  try {
    console.log('🔍 Obtendo saldos da conta de trading OKX...');
    const resp = await makeOKXRequest('/api/v5/account/balance', 'GET', undefined, creds);
    if (resp.code !== '0') {
      const errorMsg = `OKX API Error: ${resp.msg}`;
      console.error('❌ Erro na resposta da OKX:', errorMsg);
      throw new Error(errorMsg);
    }

    const balances: Array<{ asset: string; free: number; locked: number } | any> = [];
    const details = resp?.data?.[0]?.details || [];
    console.log(`📊 Processando ${details.length} detalhes de saldo da OKX`);
    
    for (const d of details) {
      const ccy = d.ccy;
      const avail = Number(d.availBal || d.cashBal || '0');
      const frozen = Number(d.frozenBal || '0');
      if (avail > 0 || frozen > 0) {
        balances.push({ asset: ccy, free: avail, locked: frozen, balance: avail + frozen });
      }
    }

    console.log(`✅ ${balances.length} saldos obtidos da conta de trading OKX`);
    return { success: true, balances };
  } catch (error) {
    console.error('❌ Erro ao obter saldos da OKX:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return {
      success: false,
      error: errorMessage,
      balances: []
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, side, type, quantity, price, api_key, secret_key, passphrase } = await req.json();
    
    console.log(`🎯 Ação OKX solicitada: ${action}`);

    const creds = api_key && secret_key && passphrase ? {
      apiKey: api_key,
      secretKey: secret_key,
      passphrase: passphrase
    } : undefined;

    switch (action) {
      case 'get_prices':
        const pricesResult = await getOKXPrices(creds);
        return new Response(JSON.stringify(pricesResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'get_balances':
        const balancesResult = await getOKXBalances(creds);
        return new Response(JSON.stringify(balancesResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'place_order':
        if (!symbol || !side || !type || !quantity) {
          throw new Error('Parâmetros obrigatórios faltando: symbol, side, type, quantity');
        }

        const orderRequest: OKXOrderRequest = {
          symbol,
          side,
          type,
          quantity,
          price
        };

        const orderResult = await executeOKXOrder(orderRequest, creds);
        return new Response(JSON.stringify(orderResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      case 'test_connection':
        try {
          await getOKXPrices(creds);
          return new Response(JSON.stringify({
            success: true,
            message: '✅ Conexão com OKX estabelecida com sucesso',
            exchange: 'OKX',
            timestamp: new Date().toISOString()
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (testError) {
          return new Response(JSON.stringify({
            success: false,
            error: testError instanceof Error ? testError.message : 'Erro de conexão'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

      default:
        throw new Error(`Ação não suportada: ${action}`);
    }

  } catch (error) {
    console.error('❌ Erro na API OKX:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido na API OKX'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }
});