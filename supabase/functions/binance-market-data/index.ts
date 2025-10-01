import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpotPrice {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  lastPrice?: string;
  weightedAvgPrice?: string;
}

interface FuturesPrice {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  lastPrice?: string;
  weightedAvgPrice?: string;
}

interface FundingRateInfo {
  symbol: string;
  lastFundingRate: string;
  nextFundingTime: number;
  markPrice: string;
}

interface FundingArbitrageOpportunity {
  symbol: string;
  spotPrice: number;
  futuresPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  basisSpread: number;
  annualizedFunding: number;
  estimatedProfit: number;
  strategy: 'long_spot_short_futures' | 'short_spot_long_futures';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expiresAt: string;
}

// ⚠️ SISTEMA SIMPLIFICADO: Apenas chamadas diretas autenticadas
// Sem proxies ou bypasses - usando regiões autorizadas (us-east-1)

// Cache simples para reduzir requisições
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 segundos

// Função removida - não mais necessária sem sistema de proxy

function getCachedData(key: string): any | null {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`📋 Cache hit for ${key}`);
    return cached.data;
  }
  return null;
}

function setCachedData(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

function getRealisticPrice(symbol: string, type: 'spot' | 'futures'): number {
  const basePrices: Record<string, number> = {
    'BTCUSDT': 112000,
    'ETHUSDT': 4150, 
    'BNBUSDT': 1015,
    'SOLUSDT': 217,
    'ADAUSDT': 0.815,
    'XRPUSDT': 2.85,
    'MATICUSDT': 0.38,
    'DOTUSDT': 4.0
  };
  
  const basePrice = basePrices[symbol] || 100;
  const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
  const typeVariation = type === 'futures' ? (Math.random() - 0.5) * 0.005 : 0; // Small futures premium/discount
  
  return basePrice * (1 + variation + typeVariation);
}

// Nova função simplificada: Apenas chamadas diretas autenticadas
async function fetchBinanceDirect(endpoint: string, apiKey: string, type: 'spot' | 'futures'): Promise<Response | null> {
  const cacheKey = `${type}-${endpoint}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return new Response(JSON.stringify(cachedData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // URLs diretas da Binance (região permitida: us-east-1)
  const directUrls = type === 'spot' ? [
    'https://api.binance.us',  // Binance US - região permitida
    'https://api.binance.com'
  ] : [
    'https://fapi.binance.com'
  ];

  const baseHeaders = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(apiKey ? { 'X-MBX-APIKEY': apiKey } : {})
  };

  console.log(`🎯 Conexão direta Binance (região us-east-1) para ${type}...`);
  
  for (const baseUrl of directUrls) {
    try {
      const url = `${baseUrl}${endpoint}`;
      console.log(`📡 Tentando: ${url}`);
      
      const response = await fetch(url, {
        headers: baseHeaders,
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Verificar se é bloqueio
        if (data.code === 0 && data.msg?.includes('restricted location')) {
          console.log(`🚫 Região bloqueada pela Binance: ${data.msg}`);
          continue;
        }
        
        console.log(`✅ SUCESSO: ${url}`);
        setCachedData(cacheKey, data);
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        console.log(`⚠️ Falha ${url}: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ Erro ${baseUrl}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Se falhar, retornar null (não usar dados simulados)
  console.log(`❌ Todas tentativas diretas falharam - região pode estar bloqueada`);
  return null;
}

// Função removida - dados simulados não são mais usados

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let endpoint = url.pathname.split('/').pop() || '';

    // Tentar obter do corpo quando chamado via supabase.functions.invoke
    let body: any = {};
    if (req.method !== 'GET') {
      try { body = await req.json(); } catch { body = {}; }
    }
    if (!endpoint || endpoint === 'binance-market-data') {
      endpoint = body?.endpoint || body?.action || '';
    }

    // Get Binance API credentials from Supabase secrets
    // Remover uso de credenciais demo - usar apenas credenciais fornecidas pelos usuários
    console.log('📊 Buscando dados de mercado da Binance via API pública');
    
    console.log(`🚀 Binance API request: ${endpoint}`);

    switch (endpoint) {
      case 'tickers':
        return await getSpotTickers();
      case 'futures':
        return await getFuturesTickers();
      case 'funding-arbitrage':
        return await getFundingArbitrageOpportunities();
      case 'place_order':
        return await executeBinanceOrder(body);
      default:
        return new Response(JSON.stringify({ 
          error: 'Invalid endpoint',
          available_endpoints: ['tickers', 'futures', 'funding-arbitrage', 'place_order'],
          requested: endpoint 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in binance-market-data function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error),
      success: false,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function getSpotTickers(binanceApiKey: string = '') {
  try {
    console.log('🚀 Buscando tickers Spot da Binance (conexão direta, região permitida)...');
    
    const response = await fetchBinanceDirect('/api/v3/ticker/24hr', binanceApiKey, 'spot');
    
    if (!response) {
      console.log('❌ Binance Spot indisponível na região us-east-1');
      return new Response(JSON.stringify({
        success: false,
        error: 'Binance Spot API indisponível. Certifique-se de que a região está autorizada.',
        data: [],
        timestamp: new Date().toISOString(),
        source: 'binance-spot'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const data: any = await response.json();
    
    // Verificar se recebeu erro da Binance
    if (data && typeof data === 'object' && (data.code === 0 || data.msg)) {
      console.log('⚠️ Erro da Binance:', data.msg || 'Unknown error');
      return new Response(JSON.stringify({
        success: false,
        error: data.msg || 'Erro da API Binance',
        data: [],
        timestamp: new Date().toISOString(),
        source: 'binance-spot'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Verificar se os dados estão no formato correto
    let processedData: SpotPrice[];
    if (Array.isArray(data)) {
      processedData = data;
    } else if (typeof data === 'string') {
      // Se for string, tentar fazer parse
      try {
        processedData = JSON.parse(data);
      } catch {
        console.log('❌ Erro ao fazer parse de string JSON');
        throw new Error('Invalid JSON string from proxy');
      }
    } else if (data && typeof data === 'object' && data.data) {
      // Se tiver propriedade 'data' (formato de alguns proxies)
      processedData = Array.isArray(data.data) ? data.data : [];
    } else {
      console.log('❌ Formato de dados inesperado:', typeof data, data);
      throw new Error('Unexpected data format from API/proxy');
    }
    
    if (!Array.isArray(processedData)) {
      console.log('❌ Dados não são um array após processamento');
      throw new Error('Data is not an array after processing');
    }
    
    // Debug: Log first item to see the data structure
    if (processedData && processedData.length > 0) {
      console.log('First spot ticker item structure:', JSON.stringify(processedData[0], null, 2));
    }
    
    // Retornar TODOS os símbolos USDT da Binance (sem filtro)
    const usdtSymbols = processedData.filter(item => 
      item.symbol && item.symbol.endsWith('USDT')
    );
    
    console.log(`Successfully fetched ${usdtSymbols.length} USDT spot tickers from Binance`);
    
    const formattedData = usdtSymbols.map(item => {
      // Try multiple price fields with priority order
      let priceValue = null;
      if (item.price && item.price !== 'undefined' && item.price !== null) {
        priceValue = item.price;
      } else if (item.lastPrice && item.lastPrice !== 'undefined' && item.lastPrice !== null) {
        priceValue = item.lastPrice;
      } else if (item.weightedAvgPrice && item.weightedAvgPrice !== 'undefined' && item.weightedAvgPrice !== null) {
        priceValue = item.weightedAvgPrice;
      }
      
      const price = priceValue ? parseFloat(priceValue.toString()) : null;
      const change24h = item.priceChangePercent ? parseFloat(item.priceChangePercent.toString()) : 0;
      const volume24h = item.volume ? parseFloat(item.volume.toString()) : 0;
      
      return {
        symbol: item.symbol.replace('USDT', '/USDT'),
        price: (price !== null && !isNaN(price) && price > 0) ? price : null,
        change24h: !isNaN(change24h) ? change24h : 0,
        volume24h: !isNaN(volume24h) ? volume24h : 0,
        exchange: 'Binance Spot'
      };
    });

    // Filtrar apenas null/undefined, manter preços válidos incluindo zeros
    const validData = formattedData.filter(item => 
      item.price !== null && 
      !isNaN(item.price) && 
      item.price >= 0
    );

    console.log(`✅ Dados válidos processados: ${validData.length} de ${formattedData.length} símbolos`);

    return new Response(JSON.stringify({
      success: true,
      data: validData,
      timestamp: new Date().toISOString(),
      source: 'binance-spot'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error fetching spot tickers:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: [],
      timestamp: new Date().toISOString(),
      source: 'binance-spot'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function getFuturesTickers(binanceApiKey: string = '') {
  try {
    console.log('🚀 Buscando tickers Futures da Binance (conexão direta, região permitida)...');
    
    const response = await fetchBinanceDirect('/fapi/v1/ticker/24hr', binanceApiKey, 'futures');
    
    if (!response) {
      console.log('❌ Binance Futures indisponível na região us-east-1');
      return new Response(JSON.stringify({
        success: false,
        error: 'Binance Futures API indisponível. Certifique-se de que a região está autorizada.',
        data: [],
        timestamp: new Date().toISOString(),
        source: 'binance-futures'
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const data: any = await response.json();
    
    // Verificar se recebeu erro da Binance
    if (data && typeof data === 'object' && (data.code === 0 || data.msg)) {
      console.log('⚠️ Erro da Binance Futures:', data.msg || 'Unknown error');
      return new Response(JSON.stringify({
        success: false,
        error: data.msg || 'Erro da API Binance Futures',
        data: [],
        timestamp: new Date().toISOString(),
        source: 'binance-futures'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Verificar se os dados estão no formato correto
    let processedData: FuturesPrice[];
    if (Array.isArray(data)) {
      processedData = data;
    } else if (typeof data === 'string') {
      try {
        processedData = JSON.parse(data);
      } catch {
        console.log('❌ Erro ao fazer parse de string JSON');
        throw new Error('Invalid JSON string from proxy');
      }
    } else if (data && typeof data === 'object' && data.data) {
      processedData = Array.isArray(data.data) ? data.data : [];
    } else {
      console.log('❌ Formato de dados inesperado:', typeof data, data);
      throw new Error('Unexpected data format from API/proxy');
    }
    
    if (!Array.isArray(processedData)) {
      console.log('❌ Dados não são um array após processamento');
      throw new Error('Data is not an array after processing');
    }
    
    // Debug: Log first item to see the data structure
    if (processedData && processedData.length > 0) {
      console.log('First futures ticker item structure:', JSON.stringify(processedData[0], null, 2));
    }
    
    // Retornar TODOS os símbolos USDT da Binance Futures (sem filtro)
    const usdtFutures = processedData.filter(item => 
      item.symbol && item.symbol.endsWith('USDT')
    );
    
    console.log(`Successfully fetched ${usdtFutures.length} USDT futures tickers from Binance`);
    
    const formattedData = usdtFutures.map(item => {
      // Try multiple price fields with priority order
      let priceValue = null;
      if (item.price && item.price !== 'undefined' && item.price !== null) {
        priceValue = item.price;
      } else if (item.lastPrice && item.lastPrice !== 'undefined' && item.lastPrice !== null) {
        priceValue = item.lastPrice;
      } else if (item.weightedAvgPrice && item.weightedAvgPrice !== 'undefined' && item.weightedAvgPrice !== null) {
        priceValue = item.weightedAvgPrice;
      }
      
      const price = priceValue ? parseFloat(priceValue.toString()) : null;
      const change24h = item.priceChangePercent ? parseFloat(item.priceChangePercent.toString()) : 0;
      const volume24h = item.volume ? parseFloat(item.volume.toString()) : 0;
      
      return {
        symbol: item.symbol.replace('USDT', '/USDT'),
        price: (price !== null && !isNaN(price) && price > 0) ? price : null,
        change24h: !isNaN(change24h) ? change24h : 0,
        volume24h: !isNaN(volume24h) ? volume24h : 0,
        exchange: 'Binance Futures'
      };
    });

    return new Response(JSON.stringify({
      success: true,
      data: formattedData,
      timestamp: new Date().toISOString(),
      source: 'binance-futures'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error fetching futures tickers:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: [],
      timestamp: new Date().toISOString(),
      source: 'binance-futures'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function getFundingArbitrageOpportunities(binanceApiKey: string = ''): Promise<Response> {
  try {
    console.log('🚀 Buscando oportunidades de funding arbitrage (região permitida)...');
    
    let spotData: SpotPrice[] = [];
    let futuresData: FuturesPrice[] = [];
    let fundingData: FundingRateInfo[] = [];
    
    // Tentar buscar dados via conexão direta
    const spotResponse = await fetchBinanceDirect('/api/v3/ticker/24hr', binanceApiKey, 'spot');
    if (spotResponse?.ok) {
      const rawData = await spotResponse.json();
      spotData = Array.isArray(rawData) ? rawData : (rawData.data && Array.isArray(rawData.data) ? rawData.data : []);
    }
    
    const futuresResponse = await fetchBinanceDirect('/fapi/v1/ticker/24hr', binanceApiKey, 'futures');
    if (futuresResponse?.ok) {
      const rawData = await futuresResponse.json();
      futuresData = Array.isArray(rawData) ? rawData : (rawData.data && Array.isArray(rawData.data) ? rawData.data : []);
    }
    
    const fundingResponse = await fetchBinanceDirect('/fapi/v1/premiumIndex', binanceApiKey, 'futures');
    if (fundingResponse?.ok) {
      const rawData = await fundingResponse.json();
      fundingData = Array.isArray(rawData) ? rawData : (rawData.data && Array.isArray(rawData.data) ? rawData.data : []);
    }
    
    // Se não temos dados suficientes, retornar erro (não usar fallback)
    if (!spotData.length || !futuresData.length || !fundingData.length) {
      console.log('❌ Dados insuficientes da Binance para funding arbitrage');
      return new Response(JSON.stringify({
        success: false,
        error: 'Binance APIs indisponíveis na região us-east-1. Use credenciais válidas ou verifique acesso à região.',
        opportunities: [],
        timestamp: new Date().toISOString()
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Expandir para todos os símbolos whitelistados
    const majorSymbols = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'XRPUSDT', 'MATICUSDT', 'SOLUSDT', 'DOTUSDT',
      'AVAXUSDT', 'LTCUSDT', 'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'FILUSDT', 'TRXUSDT', 
      'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'WIFUSDT'
    ];
    const opportunities: FundingArbitrageOpportunity[] = [];
    
    for (const symbol of majorSymbols) {
      const spotTicker = spotData.find(s => s.symbol === symbol);
      const futuresTicker = futuresData.find(f => f.symbol === symbol);
      const fundingInfo = fundingData.find(f => f.symbol === symbol);
      
      if (spotTicker && futuresTicker && fundingInfo) {
        // Try different price fields for more reliable data
        let spotPriceValue = spotTicker.price || spotTicker.lastPrice || spotTicker.weightedAvgPrice;
        let futuresPriceValue = futuresTicker.price || futuresTicker.lastPrice || futuresTicker.weightedAvgPrice;
        const fundingRateValue = fundingInfo.lastFundingRate;
        
        const spotPrice = spotPriceValue ? parseFloat(spotPriceValue.toString()) : NaN;
        const futuresPrice = futuresPriceValue ? parseFloat(futuresPriceValue.toString()) : NaN;
        const fundingRate = fundingRateValue ? parseFloat(fundingRateValue.toString()) : NaN;
        const nextFundingTime = fundingInfo.nextFundingTime;
        
        // Skip if prices are invalid
        if (isNaN(spotPrice) || isNaN(futuresPrice) || isNaN(fundingRate) || 
            spotPrice <= 0 || futuresPrice <= 0) {
          console.log(`❌ Skipping ${symbol}: invalid prices spot=${spotPrice} futures=${futuresPrice} funding=${fundingRate}`);
          continue;
        }
        
        // Calculate basis spread (futures - spot) / spot * 100
        const basisSpread = ((futuresPrice - spotPrice) / spotPrice) * 100;
        
        // Annualized funding rate (assuming 8-hour funding cycles)
        const annualizedFunding = fundingRate * 365 * 3 * 100; // 3 times per day, convert to percentage
        
        // Estimated profit combines basis arbitrage + funding rate capture
        const estimatedProfit = Math.abs(basisSpread) + Math.abs(fundingRate * 100);
        
        // Determine strategy based on basis spread
        const strategy = basisSpread < 0 ? 'short_spot_long_futures' : 'long_spot_short_futures';
        
        // Risk assessment
        let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (Math.abs(basisSpread) > 2 || Math.abs(fundingRate) > 0.01) {
          riskLevel = 'HIGH';
        } else if (Math.abs(basisSpread) > 0.5 || Math.abs(fundingRate) > 0.005) {
          riskLevel = 'MEDIUM';
        }
        
        opportunities.push({
          symbol,
          spotPrice,
          futuresPrice,
          fundingRate,
          nextFundingTime,
          basisSpread,
          annualizedFunding,
          estimatedProfit,
          strategy,
          riskLevel,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes
        });
        
        console.log(`✅ Opportunity ${symbol}: spot=$${spotPrice.toFixed(2)} futures=$${futuresPrice.toFixed(2)} funding=${(fundingRate*100).toFixed(4)}% profit=${estimatedProfit.toFixed(4)}%`);
      }
    }
    
    opportunities.sort((a, b) => b.estimatedProfit - a.estimatedProfit);
    
    console.log(`🎯 Generated ${opportunities.length} funding arbitrage opportunities`);
    
    return new Response(JSON.stringify({
      success: true,
      data: opportunities,
      timestamp: new Date().toISOString(),
      source: 'binance-funding-arbitrage'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error in funding arbitrage function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      data: [],
      timestamp: new Date().toISOString(),
      source: 'binance-funding-arbitrage'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

// Executar ordem na Binance (simulada para arbitragem)
async function executeBinanceOrder(orderParams: any) {
  try {
    console.log(`📊 Executando ordem simulada na Binance:`, orderParams);
    
    const { symbol, side, type, quantity } = orderParams;
    
    // Simular tempo de execução de ordem
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Simular sucesso (95% de sucesso, 5% de falha)
    if (Math.random() < 0.95) {
      const orderId = `BIN_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      
      return new Response(JSON.stringify({
        success: true,
        orderId: orderId,
        symbol: symbol,
        side: side,
        type: type,
        executedQty: quantity,
        status: 'FILLED',
        transactTime: Date.now(),
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Simular falha ocasional
      throw new Error('Insufficient balance or market conditions changed');
    }
    
  } catch (error) {
    console.error('❌ Erro na execução da ordem Binance:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}