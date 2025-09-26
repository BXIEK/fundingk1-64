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

async function getActiveWhitelistIP(supabase: any, userId?: string): Promise<string | null> {
  try {
    if (!userId) {
      console.log('⚠️ User ID não fornecido, usando IP genérico');
      return null;
    }

    const { data: whitelistIPs, error } = await supabase
      .from('okx_whitelist_ips')
      .select('ip_address')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Erro ao buscar IP da whitelist:', error);
      return null;
    }

    if (whitelistIPs && whitelistIPs.length > 0) {
      const ip = String(whitelistIPs[0].ip_address);
      console.log(`✅ IP da whitelist encontrado: ${ip}`);
      return ip;
    }

    console.log('⚠️ Nenhum IP ativo encontrado na whitelist');
    return null;
  } catch (error) {
    console.error('❌ Erro ao consultar whitelist IP:', error);
    return null;
  }
}

async function makeOKXRequest(
  endpoint: string, 
  method: 'GET' | 'POST' = 'GET', 
  body?: any,
  creds?: { apiKey?: string; secretKey?: string; passphrase?: string },
  supabase?: any,
  userId?: string
): Promise<any> {
  // Verificar se temos IP da whitelist configurado
  const whitelistIP = await getActiveWhitelistIP(supabase, userId);
  if (whitelistIP && whitelistIP !== '0.0.0.0/0') {
    console.log(`🔒 Usando IP da whitelist: ${whitelistIP}`);
    // Nota: Não é possível forçar IP específico em requisições HTTP do Deno
    // Esta informação serve apenas para logging e validação
  } else {
    console.log(`⚠️ Sem IP específico da whitelist - usando IP padrão do servidor`);
  }

  const apiKey = creds?.apiKey || Deno.env.get('OKX_API_KEY');
  const secretKey = creds?.secretKey || Deno.env.get('OKX_SECRET_KEY');
  const passphrase = creds?.passphrase || Deno.env.get('OKX_PASSPHRASE');

  if (!apiKey || !secretKey || !passphrase) {
    throw new Error('Credenciais da OKX não encontradas');
  }

  const baseUrl = 'https://www.okx.com'; // URL de produção
  const timestamp = new Date().toISOString(); // OKX exige timestamp em ISO8601 UTC (ex: 2025-09-25T21:25:00.000Z)
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

  console.log(`🌐 OKX Production Request for User: ${method} ${baseUrl}${requestPath}`);
  console.log(`🔐 Headers enviados:`, {
    'OK-ACCESS-KEY': apiKey ? `${apiKey.substring(0, 8)}...` : 'MISSING',
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase ? `${passphrase.substring(0, 4)}***` : 'MISSING',
    'OK-ACCESS-SIGN': signature ? `${signature.substring(0, 8)}...` : 'MISSING'
  });

  const response = await fetch(`${baseUrl}${requestPath}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const data = await response.json();
  
  if (!response.ok) {
    console.error('❌ Erro na requisição OKX (Status:', response.status, '):', data);
    console.error('❌ Cabeçalhos da requisição:', headers);
    throw new Error(`OKX API Error: ${data.msg || data.error_message || response.statusText}`);
  }

  return data;
}

async function getOKXPrices(creds?: { apiKey?: string; secretKey?: string; passphrase?: string }, supabase?: any, userId?: string): Promise<any> {
  try {
    console.log('📊 Obtendo preços da OKX...');
    
    // A API da OKX requer o parâmetro instType (SPOT para mercado spot)
    const response = await makeOKXRequest('/api/v5/market/tickers?instType=SPOT', 'GET', undefined, creds, supabase, userId);
    
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
      // Converter formato da OKX (BTC-USDT) para símbolo base (BTC)
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
    
    // Verificar se é erro de IP whitelist
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    if (errorMessage.includes('50110') || errorMessage.includes('IP') || errorMessage.includes('whitelist')) {
      return {
        success: false,
        error: 'IP não autorizado na whitelist da OKX. Configure a whitelist com 0.0.0.0/0 ou adicione todos os IPs dinâmicos do servidor.',
        errorCode: '50110',
        count: 0
      };
    }
    
    return {
      success: false,
      error: errorMessage,
      count: 0
    };
  }
}

// Buscar informações do instrumento (minSz, lotSz, tickSz) com melhor tratamento de erro
async function getOKXInstrument(instId: string, creds?: { apiKey?: string; secretKey?: string; passphrase?: string }, supabase?: any, userId?: string): Promise<{ minSz: number; lotSz: number; tickSz: number }> {
  try {
    const resp = await makeOKXRequest(`/api/v5/public/instruments?instType=SPOT&instId=${instId}`, 'GET', undefined, creds, supabase, userId);
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
    // Retornar regras padrão baseadas no símbolo
    const cleanSymbol = instId.replace('-USDT', '');
    return getDefaultOKXRules(cleanSymbol);
  }
}

function decimalPlacesFromStep(step: number): number {
  const s = step.toString();
  // Handle scientific notation like 1e-8
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

async function executeOKXOrder(orderRequest: OKXOrderRequest, creds?: { apiKey?: string; secretKey?: string; passphrase?: string }, supabase?: any, userId?: string): Promise<OKXOrderResponse> {
  try {
    // Função padronizada para conversão de símbolos
    function convertToOKXFormat(symbol: string): string {
      let cleanSymbol = symbol.replace('-USDT', '').replace('USDT', '').replace('-', '');
      return `${cleanSymbol}-USDT`;
    }
    
    const instId = convertToOKXFormat(orderRequest.symbol);
    console.log(`🔄 Convertendo símbolo: ${orderRequest.symbol} -> ${instId}`);
    
    // Obter regras do instrumento com fallback melhorado
    let rules: { minSz: number; lotSz: number; tickSz: number };
    try {
      rules = await getOKXInstrument(instId, creds, supabase, userId);
    } catch (error) {
      console.warn(`⚠️ Erro ao obter regras para ${instId}, usando defaults:`, error);
      // Defaults mais conservadores baseados no símbolo
      const cleanSymbol = orderRequest.symbol.replace('-USDT', '').replace('USDT', '').toUpperCase();
      rules = getDefaultOKXRules(cleanSymbol);
    }
    
    // Ajustar quantidade com regras inteligentes
    const { qty: adjustedQty } = adjustOKXSize(orderRequest.quantity, rules);
    
    // Validação adicional para evitar ordens muito pequenas
    const totalValue = adjustedQty * (orderRequest.price || 1000); // Estimar valor
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
      
      return await executeOKXOrderInternal(instId, orderRequest, finalQty, creds, supabase, userId);
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
      
      return await executeOKXOrderInternal(instId, orderRequest, adjustedQty, creds, supabase, userId);
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

// Função interna para executar a ordem na OKX
async function executeOKXOrderInternal(instId: string, orderRequest: OKXOrderRequest, quantity: number, creds?: { apiKey?: string; secretKey?: string; passphrase?: string }, supabase?: any, userId?: string): Promise<OKXOrderResponse> {
  const orderData = {
    instId: instId,
    tdMode: 'cash', // Forçar modo cash para evitar problemas de margem
    side: orderRequest.side.toLowerCase(),
    ordType: orderRequest.type.toLowerCase(),
    sz: quantity.toString(),
    // px só em ordens limit
    ...(orderRequest.type === 'limit' && orderRequest.price ? { px: orderRequest.price.toString() } : {}),
    // Para ordens market, ajustar parâmetro tgtCcy baseado no lado
    // BUY: usar quote_ccy (especificar quanto USDT gastar)  
    // SELL: usar base_ccy (especificar quanto da moeda base vender)
    ...(orderRequest.type === 'market' ? { 
      tgtCcy: orderRequest.side === 'buy' ? 'quote_ccy' : 'base_ccy' 
    } : {})
  };

  console.log(`🔧 Dados da ordem OKX (modo=${orderData.tdMode}):`, {
    instId: orderData.instId,
    side: orderData.side,
    ordType: orderData.ordType,
    sz: orderData.sz,
    tgtCcy: orderData.tgtCcy
  });

  const response = await makeOKXRequest('/api/v5/trade/order', 'POST', orderData, creds, supabase, userId);
  
  // Tratamento melhorado de erros da OKX
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
    
    // Tratamento específico para sCode 51008 - saldo insuficiente ou margem baixa
    if (sCode === '51008') {
      console.warn(`🚫 sCode=51008 - Saldo ou margem insuficiente na OKX para ${instId}: ${sMsg}`);
      // Erro específico com guia claro sobre soluções
      const baseSymbol = instId.split('-')[0];
      const errorMsg = sMsg?.includes('margin') 
        ? `Saldo de ${baseSymbol} insuficiente e margem baixa. Deposite mais ${baseSymbol} na carteira Spot ou transfira da carteira Funding.`
        : `Saldo de ${baseSymbol} insuficiente na carteira Spot. Transfira da carteira Funding ou deposite mais.`;
      throw new Error(`OKX_INSUFFICIENT_BALANCE: ${errorMsg} (sCode=${sCode})`);
    }
    
    // Tratamento específico para restrições de conformidade
    if (sCode === '51155') {
      console.warn(`🚫 Par ${instId} restrito por conformidade local na OKX`);
      throw new Error(`OKX_COMPLIANCE_RESTRICTION: ${sMsg || 'Par não permitido por restrições de conformidade local'} (sCode=${sCode})`);
    }
    
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

// Função para obter regras padrão baseadas no símbolo
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

// Novo: obter saldos da conta OKX
async function getOKXBalances(creds?: { apiKey?: string; secretKey?: string; passphrase?: string }, supabase?: any, userId?: string): Promise<any> {
  try {
    const resp = await makeOKXRequest('/api/v5/account/balance', 'GET', undefined, creds, supabase, userId);
    if (resp.code !== '0') {
      throw new Error(`OKX API Error: ${resp.msg}`);
    }

    const balances: Array<{ asset: string; free: number; locked: number } | any> = [];
    const details = resp?.data?.[0]?.details || [];
    for (const d of details) {
      const ccy = d.ccy;
      const avail = Number(d.availBal || d.cashBal || '0');
      const frozen = Number(d.frozenBal || '0');
      if (avail > 0 || frozen > 0) {
        balances.push({ asset: ccy, free: avail, locked: frozen, balance: avail + frozen });
      }
    }

    return { success: true, balances };
  } catch (error) {
    console.error('❌ Erro ao obter saldos da OKX:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// Obter saldos da conta de Funding (carteira crypto)
async function getOKXFundingBalances(creds?: { apiKey?: string; secretKey?: string; passphrase?: string }, supabase?: any, userId?: string): Promise<any> {
  try {
    const resp = await makeOKXRequest('/api/v5/asset/balances', 'GET', undefined, creds, supabase, userId);
    if (resp.code !== '0') {
      throw new Error(`OKX API Error: ${resp.msg}`);
    }

    const balances: Array<{ asset: string; free: number; locked: number; balance: number }> = [];
    for (const d of resp?.data || []) {
      const ccy = d.ccy;
      const bal = Number(d.bal ?? '0');
      const avail = Number(d.availBal ?? '0');
      const frozen = Math.max(0, bal - avail);
      if (bal > 0 || avail > 0) {
        balances.push({ asset: ccy, free: avail, locked: frozen, balance: bal });
      }
    }

    return { success: true, balances };
  } catch (error) {
    console.error('❌ Erro ao obter saldos (Funding) da OKX:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

// Verificar quais pares/instrumentos estão disponíveis para negociação
async function getOKXAvailableInstruments(creds?: { apiKey?: string; secretKey?: string; passphrase?: string }, supabase?: any, userId?: string): Promise<any> {
  try {
    console.log('🔍 Verificando instrumentos disponíveis na OKX...');
    
    const resp = await makeOKXRequest('/api/v5/public/instruments?instType=SPOT', 'GET', undefined, creds, supabase, userId);
    if (resp.code !== '0') {
      throw new Error(`OKX API Error: ${resp.msg}`);
    }

    const commonPairs = ['BTC-USDT', 'ETH-USDT', 'BNB-USDT', 'XRP-USDT', 'ADA-USDT', 'SOL-USDT', 'DOT-USDT', 'MATIC-USDT', 'AVAX-USDT', 'LTC-USDT'];
    const availableInstruments = [];
    const restrictedInstruments = [];

    // Verificar cada par comum
    for (const pair of commonPairs) {
      const instrument = resp.data.find((inst: any) => inst.instId === pair);
      if (instrument) {
        const isActive = instrument.state === 'live';
        const canTrade = !instrument.suspend || instrument.suspend === '0';
        
        if (isActive && canTrade) {
          availableInstruments.push({
            symbol: pair,
            baseSymbol: pair.replace('-USDT', ''),
            minSize: parseFloat(instrument.minSz || '0'),
            maxSize: parseFloat(instrument.maxSz || '999999'),
            lotSize: parseFloat(instrument.lotSz || '0.00001'),
            tickSize: parseFloat(instrument.tickSz || '0.01'),
            state: instrument.state
          });
        } else {
          restrictedInstruments.push({
            symbol: pair,
            baseSymbol: pair.replace('-USDT', ''),
            reason: !isActive ? `Estado: ${instrument.state}` : 'Negociação suspensa',
            state: instrument.state
          });
        }
      } else {
        restrictedInstruments.push({
          symbol: pair,
          baseSymbol: pair.replace('-USDT', ''),
          reason: 'Instrumento não encontrado',
          state: 'not_found'
        });
      }
    }

    console.log(`✅ Instrumentos verificados: ${availableInstruments.length} disponíveis, ${restrictedInstruments.length} restritos`);
    
    return {
      success: true,
      available: availableInstruments,
      restricted: restrictedInstruments,
      total_checked: commonPairs.length
    };
    
  } catch (error) {
    console.error('❌ Erro ao verificar instrumentos da OKX:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}

async function normalizeUserId(id: string) {
  try {
    const generic = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (id === '00000000-0000-0000-0000-000000000000' || generic.test(id)) {
      return id.toLowerCase();
    }
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(id));
    const bytes = Array.from(new Uint8Array(hashBuffer)).slice(0, 16);
    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
  } catch (_) {
    return '00000000-0000-0000-0000-000000000000';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, api_key, secret_key, passphrase, user_id, ...params } = body;
    
    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Normalizar user_id se fornecido
    let normalizedUserId: string | undefined;
    if (user_id && typeof user_id === "string") {
      normalizedUserId = await normalizeUserId(user_id);
      console.log(`🔐 User ID normalizado: ${normalizedUserId} (original: ${user_id})`);
    } else {
      console.log(`⚠️ User ID não fornecido ou inválido: ${user_id}`);
    }
    
    console.log(`🚀 OKX API: Ação ${action} solicitada`);
    console.log(`🔑 Credenciais recebidas:`, {
      api_key: api_key ? `${api_key.substring(0, 8)}...` : 'MISSING',
      secret_key: secret_key ? 'PROVIDED' : 'MISSING',
      passphrase: passphrase ? 'PROVIDED' : 'MISSING'
    });
    
    const creds = { apiKey: api_key, secretKey: secret_key, passphrase };
    let result;
    
    switch (action) {
      case 'test_connection':
        // Testar primeiro com endpoint público
        try {
          console.log('🌐 Testando endpoint público da OKX...');
          const publicTest = await fetch('https://www.okx.com/api/v5/public/time');
          const publicData = await publicTest.json();
          console.log('✅ Teste público da OKX funcionando:', publicData);
          
          // Se as credenciais foram fornecidas, testar endpoint privado
          if (api_key && secret_key && passphrase) {
            console.log('🔐 Testando conexão privada...');
            const privateTest = await getOKXBalances(creds, supabase, normalizedUserId);
            if (privateTest.success) {
              result = {
                success: true,
                message: '✅ Conexão com OKX estabelecida - credenciais válidas',
                public_test: true,
                private_test: true,
                balances_count: privateTest.balances?.length || 0,
                timestamp: new Date().toISOString()
              };
            } else {
              result = {
                success: false,
                message: '❌ Credenciais inválidas da OKX',
                public_test: true,
                private_test: false,
                error: privateTest.error,
                timestamp: new Date().toISOString()
              };
            }
          } else {
            result = {
              success: true,
              message: '⚠️ Conexão pública OK, mas credenciais não fornecidas',
              public_test: true,
              private_test: false,
              timestamp: new Date().toISOString()
            };
          }
        } catch (error) {
          console.error('❌ Erro no teste de conexão OKX:', error);
          result = {
            success: false,
            message: '❌ Falha na conexão com OKX',
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            timestamp: new Date().toISOString()
          };
        }
        break;
      case 'get_prices':
        try {
          result = await getOKXPrices(creds, supabase, normalizedUserId);
        } catch (error) {
          console.error('❌ Erro ao obter preços da OKX:', error);
          result = {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao obter preços da OKX',
            count: 0
          };
        }
        break;
      case 'get_balances':
        result = await getOKXBalances(creds, supabase, normalizedUserId);
        break;
      case 'get_funding_balances':
        result = await getOKXFundingBalances(creds, supabase, normalizedUserId);
        break;
      case 'internal_transfer':
        // Transferência interna entre carteiras
        console.log(`💸 Executando transferência interna: ${params.amount} ${params.currency} de ${params.from} para ${params.to}`)
        
        const transferData = {
          ccy: params.currency,
          amt: params.amount.toString(),
          from: params.from === 'funding' ? '6' : '18', // 6=funding, 18=trading
          to: params.to === 'trading' ? '18' : '6',
          type: '0', // Transferência interna
        }
        
        const transferResult = await makeOKXRequest('/api/v5/asset/transfer', 'POST', transferData, creds, supabase, normalizedUserId)
        
        result = {
          success: transferResult.code === '0',
          transferId: transferResult.data?.[0]?.transId,
          message: transferResult.msg,
          details: transferResult.data?.[0]
        }
        break;
      case 'get_available_instruments':
        result = await getOKXAvailableInstruments(creds, supabase, normalizedUserId);
        break;
      case 'place_order':
        result = await executeOKXOrder(params.order as OKXOrderRequest, creds, supabase, normalizedUserId);
        break;
      default:
        throw new Error(`Ação não suportada: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('❌ Erro na API OKX:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});