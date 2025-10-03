import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEXC_API_KEY = Deno.env.get('MEXC_API_KEY');
const MEXC_SECRET_KEY = Deno.env.get('MEXC_SECRET_KEY');
const MEXC_BASE_URL = 'https://api.mexc.com';

interface MEXCRequestOptions {
  endpoint: string;
  method: 'GET' | 'POST' | 'DELETE';
  params?: Record<string, any>;
  signed?: boolean;
}

// Generate HMAC SHA256 signature
async function generateSignature(queryString: string, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(queryString);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Make authenticated request to MEXC
async function makeMEXCRequest(options: MEXCRequestOptions): Promise<any> {
  const { endpoint, method, params = {}, signed = false } = options;
  
  let url = `${MEXC_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (signed) {
    if (!MEXC_API_KEY || !MEXC_SECRET_KEY) {
      throw new Error('MEXC API credentials not configured');
    }

    headers['X-MEXC-APIKEY'] = MEXC_API_KEY;
    
    // Add timestamp
    params.timestamp = Date.now();
    params.recvWindow = 5000;
    
    // Create query string for signature
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Generate signature
    const signature = await generateSignature(sortedParams, MEXC_SECRET_KEY);
    
    // Add signature to params
    params.signature = signature;
  }

  // Build final URL with params
  if (method === 'GET' || method === 'DELETE') {
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  console.log(`🌐 MEXC ${method} Request: ${url}`);

  const requestOptions: RequestInit = {
    method,
    headers,
  };

  if (method === 'POST' && Object.keys(params).length > 0) {
    requestOptions.body = new URLSearchParams(params).toString();
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }

  const response = await fetch(url, requestOptions);
  const data = await response.json();

  if (!response.ok || (data.code && data.code !== 0)) {
    console.error('❌ MEXC API Error:', data);
    throw new Error(`MEXC API Error: ${data.msg || JSON.stringify(data)}`);
  }

  return data;
}

// Get account balances
async function getMEXCBalances(): Promise<any[]> {
  console.log('🔍 Getting MEXC account balances...');
  
  const data = await makeMEXCRequest({
    endpoint: '/api/v3/account',
    method: 'GET',
    signed: true,
  });

  const balances = data.balances
    .filter((b: any) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
    .map((b: any) => ({
      asset: b.asset,
      free: parseFloat(b.free),
      locked: parseFloat(b.locked),
      total: parseFloat(b.free) + parseFloat(b.locked),
    }));

  console.log(`✅ MEXC balances obtained: ${balances.length} assets`);
  return balances;
}

// Get market prices (24hr ticker)
async function getMEXCPrices(symbols?: string[]): Promise<any> {
  console.log('📊 Getting MEXC market prices...');
  
  const data = await makeMEXCRequest({
    endpoint: '/api/v3/ticker/24hr',
    method: 'GET',
    signed: false,
  });

  // Filter by symbols if provided
  let tickers = Array.isArray(data) ? data : [];
  
  if (symbols && symbols.length > 0) {
    tickers = tickers.filter((t: any) => 
      symbols.some(s => t.symbol === s || t.symbol === `${s}USDT`)
    );
  }

  const prices: Record<string, number> = {};
  tickers.forEach((ticker: any) => {
    if (ticker.lastPrice && parseFloat(ticker.lastPrice) > 0) {
      prices[ticker.symbol] = parseFloat(ticker.lastPrice);
    }
  });

  console.log(`✅ MEXC prices obtained: ${Object.keys(prices).length} symbols`);
  return prices;
}

// Place a new order
async function placeMEXCOrder(params: {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  quantity: number;
  price?: number;
}): Promise<any> {
  console.log(`📝 Placing MEXC order:`, params);
  
  const orderParams: Record<string, any> = {
    symbol: params.symbol,
    side: params.side,
    type: params.type,
    quantity: params.quantity.toString(),
  };

  if (params.type === 'LIMIT' && params.price) {
    orderParams.price = params.price.toString();
    orderParams.timeInForce = 'GTC';
  }

  const data = await makeMEXCRequest({
    endpoint: '/api/v3/order',
    method: 'POST',
    params: orderParams,
    signed: true,
  });

  console.log('✅ Order placed successfully:', data);
  return data;
}

// Execute withdrawal
async function executeMEXCWithdrawal(params: {
  coin: string;
  address: string;
  amount: number;
  network?: string;
  memo?: string;
}): Promise<any> {
  console.log(`💸 Executing MEXC withdrawal:`, params);
  
  const withdrawParams: Record<string, any> = {
    coin: params.coin,
    address: params.address,
    amount: params.amount.toString(),
  };

  if (params.network) {
    withdrawParams.netWork = params.network;
  }

  if (params.memo) {
    withdrawParams.memo = params.memo;
  }

  const data = await makeMEXCRequest({
    endpoint: '/api/v3/capital/withdraw',
    method: 'POST',
    params: withdrawParams,
    signed: true,
  });

  console.log('✅ Withdrawal executed:', data);
  return data;
}

// Get withdrawal history
async function getMEXCWithdrawHistory(coin?: string): Promise<any[]> {
  console.log(`📜 Getting MEXC withdrawal history...`);
  
  const params: Record<string, any> = {};
  if (coin) {
    params.coin = coin;
  }

  const data = await makeMEXCRequest({
    endpoint: '/api/v3/capital/withdraw/history',
    method: 'GET',
    params,
    signed: true,
  });

  console.log(`✅ Withdrawal history obtained: ${data.length || 0} records`);
  return Array.isArray(data) ? data : [];
}

// Get deposit address
async function getMEXCDepositAddress(coin: string, network?: string): Promise<any> {
  console.log(`🏦 Getting MEXC deposit address for ${coin}...`);
  
  const params: Record<string, any> = {
    coin,
  };

  if (network) {
    params.network = network;
  }

  const data = await makeMEXCRequest({
    endpoint: '/api/v3/capital/deposit/address',
    method: 'GET',
    params,
    signed: true,
  });

  console.log('✅ Deposit address obtained:', data);
  return data;
}

// Get currency/network information
async function getMEXCCurrencyInfo(): Promise<any[]> {
  console.log('📋 Getting MEXC currency information...');
  
  const data = await makeMEXCRequest({
    endpoint: '/api/v3/capital/config/getall',
    method: 'GET',
    signed: false,
  });

  console.log(`✅ Currency info obtained: ${data.length || 0} currencies`);
  return Array.isArray(data) ? data : [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();
    console.log(`🎯 MEXC API action: ${action}`);

    let result;

    switch (action) {
      case 'get_balances':
        result = await getMEXCBalances();
        break;

      case 'get_prices':
        result = await getMEXCPrices(params.symbols);
        break;

      case 'place_order':
        result = await placeMEXCOrder(params);
        break;

      case 'withdraw':
        result = await executeMEXCWithdrawal(params);
        break;

      case 'get_withdraw_history':
        result = await getMEXCWithdrawHistory(params.coin);
        break;

      case 'get_deposit_address':
        result = await getMEXCDepositAddress(params.coin, params.network);
        break;

      case 'get_currency_info':
        result = await getMEXCCurrencyInfo();
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ MEXC API Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
