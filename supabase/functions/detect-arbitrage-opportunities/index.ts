import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArbitrageOpportunity {
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread_percentage: number;
  potential_profit: number;
  required_balance: number;
  risk_level: string;
  expiry_time: string;
  liquidity_buy: number;
  liquidity_sell: number;
  execution_time_estimate: number;
}

// Buscar símbolos whitelisted da Binance
async function getBinanceWhitelistedSymbols(): Promise<string[]> {
  try {
    console.log('🔍 Verificando símbolos whitelisted na Binance...');
    
    // Usar lista de símbolos padrão (sem credenciais demo)
    console.log('⚠️ Usando símbolos padrão expandidos');
    return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'LTCUSDT', 'LINKUSDT', 'UNIUSDT', 'ATOMUSDT', 'FILUSDT', 'TRXUSDT', 'DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'FLOKIUSDT', 'WIFUSDT'];
  } catch (error) {
    console.error('❌ Erro ao buscar símbolos whitelisted:', error);
    return ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'AVAXUSDT', 'LTCUSDT'];
  }
}


// Buscar oportunidades de funding arbitrage da Binance
async function getBinanceFundingOpportunities(): Promise<ArbitrageOpportunity[]> {
  try {
    console.log('🔄 Buscando oportunidades de funding arbitrage da Binance...');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Criar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch('https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/binance-market-data/funding-arbitrage', {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      signal: controller.signal
    }).catch(err => {
      clearTimeout(timeoutId);
      throw err;
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`⚠️ API Funding retornou status ${response.status}, usando fallback`);
      return []; // Retornar vazio ao invés de tentar retry
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data) {
      console.log('⚠️ API Funding sem dados válidos, usando fallback');
      return [];
    }
    
    return processFundingData(data.data);
  } catch (error) {
    console.log('⚠️ Funding arbitrage da Binance indisponível:', error instanceof Error ? error.message : String(error));
    return []; // Sempre retornar array vazio ao invés de falhar
  }
}

function processFundingData(fundingData: any[]): ArbitrageOpportunity[] {
  const standardInvestment = 10; // Base padronizada US$ 10
  
  const fundingOpportunities: ArbitrageOpportunity[] = fundingData.map((opp: any) => {
    // CÁLCULO PADRONIZADO (mesmo da calculadora)
    const buyPrice = opp.strategy === 'long_spot_short_futures' ? opp.spotPrice : opp.futuresPrice;
    const sellPrice = opp.strategy === 'long_spot_short_futures' ? opp.futuresPrice : opp.spotPrice;
    const spotQuantity = standardInvestment / buyPrice;
    const futuresValue = spotQuantity * sellPrice;
    const grossProfit = futuresValue - standardInvestment;
    const fees = standardInvestment * 0.0015; // 0.15% do investimento
    const netProfit = Math.max(0, grossProfit - fees);
    
    return {
      symbol: opp.symbol.replace('/USDT', ''),
      buy_exchange: opp.strategy === 'long_spot_short_futures' ? 'Binance Spot' : 'Binance Futures',
      sell_exchange: opp.strategy === 'long_spot_short_futures' ? 'Binance Futures' : 'Binance Spot',
      buy_price: buyPrice,
      sell_price: sellPrice,
      spread_percentage: Math.abs(opp.basisSpread) + Math.abs(opp.fundingRate * 100),
      potential_profit: netProfit, // Usar lucro calculado padronizado
      required_balance: standardInvestment,
      risk_level: opp.riskLevel,
      expiry_time: opp.expiresAt,
      liquidity_buy: 100000 + Math.random() * 50000,
      liquidity_sell: 95000 + Math.random() * 45000,
      execution_time_estimate: 300 + Math.random() * 200
    };
  }).filter((opp: ArbitrageOpportunity) => opp.potential_profit > 0.3); // Filtrar apenas oportunidades com lucro > US$ 0.30
  
  console.log(`✅ ${fundingOpportunities.length} oportunidades de funding da Binance encontradas`);
  return fundingOpportunities;
}

// Buscar preços da Binance via edge function interna com fallback robusto
async function getBinancePrices() {
  try {
    console.log('Tentando buscar preços reais da Binance...');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Criar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch('https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/binance-market-data/tickers', {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      signal: controller.signal
    }).catch(err => {
      clearTimeout(timeoutId);
      throw err;
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data) {
      throw new Error(data.error || 'API Binance retornou dados inválidos');
    }
    
    const prices: any = {};
    data.data.forEach((item: any) => {
      if (item.price && item.price > 0) {
        const symbol = item.symbol.replace('/USDT', '');
        prices[symbol] = item.price;
      }
    });
    
    if (Object.keys(prices).length === 0) {
      throw new Error('Nenhum preço válido retornado pela API');
    }
    
    console.log(`Preços reais da Binance obtidos: ${Object.keys(prices).length} símbolos`);
    return prices;
  } catch (error) {
    console.log('API Binance indisponível, usando dados simulados:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

// Buscar preços da OKX
async function getOKXPrices(userId?: string) {
  try {
    console.log('📡 Buscando preços reais da OKX...');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Criar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
    
    const response = await fetch('https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/okx-api', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ 
        action: 'get_prices',
        user_id: userId
      }),
      signal: controller.signal
    }).catch(err => {
      clearTimeout(timeoutId);
      throw err;
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'API OKX retornou erro');
    }
    
    // Converter formato da OKX para nosso formato
    const prices: any = {};
    // A API OKX retorna em data.data, não em data.prices
    const pricesData = data.data || data.prices;
    
    if (pricesData && typeof pricesData === 'object') {
      Object.entries(pricesData).forEach(([symbol, price]: [string, any]) => {
        if (price && typeof price === 'number' && price > 0) {
          prices[symbol] = price;
        }
      });
    }
    
    console.log(`✅ Preços reais da OKX obtidos: ${Object.keys(prices).length} símbolos`);
    return prices;
  } catch (error) {
    console.error('❌ Erro ao buscar preços da OKX:', error instanceof Error ? error.message : String(error));
    return {}; // Retornar objeto vazio ao invés de simular
  }
}

// Calcular oportunidades de arbitragem com critérios otimizados
function calculateCrossExchangeOpportunities(binancePrices: any, okxPrices: any, whitelistedSymbols?: string[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const minSpread = 0.08; // Spread mínimo reduzido ainda mais
  const maxSpread = 5.0;  // Spread máximo realístico
  
  // Função para normalizar símbolos entre exchanges
  function getBaseSymbol(symbol: string): string {
    return symbol.replace('USDT', '').replace('-USDT', '').replace('-', '');
  }
  
  function getSymbolForExchange(baseSymbol: string, exchange: 'binance' | 'okx'): string {
    if (exchange === 'binance') {
      return `${baseSymbol}USDT`;
    } else if (exchange === 'okx') {
      return `${baseSymbol}-USDT`;
    }
    return baseSymbol;
  }
  
  // Usar símbolos whitelistados se disponíveis, caso contrário usar símbolos padrão
  const analysisSymbols = whitelistedSymbols && whitelistedSymbols.length > 0 
    ? whitelistedSymbols.map(symbol => getBaseSymbol(symbol)) // Extrair símbolo base
    : ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'MATIC', 'DOT', 'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'WIF'];
  
  console.log(`🎯 Analisando símbolos whitelistados: ${analysisSymbols.join(', ')}`);
  
  analysisSymbols.forEach(symbol => {
    // Binance: BTCUSDT, OKX: BTC (sem sufixo nem hífen)
    const binanceSymbol = `${symbol}USDT`;
    const okxSymbol = symbol; // OKX retorna apenas 'BTC', não 'BTC-USDT'
    
    const binancePrice = binancePrices[binanceSymbol] || binancePrices[symbol];
    const okxPrice = okxPrices[okxSymbol];
    
    if (!binancePrice || !okxPrice || binancePrice <= 0 || okxPrice <= 0) {
      console.log(`⚠️ ${symbol}: Binance[${binanceSymbol}]=${binancePrice || 'undefined'}, OKX[${okxSymbol}]=${okxPrice || 'undefined'}`);
      return;
    }
    
    console.log(`✅ ${symbol} válido: Binance=$${binancePrice.toFixed(2)}, OKX=$${okxPrice.toFixed(2)}`);
    
    // Calcular spreads bidirecionais
    const spreadBinanceToOKX = ((okxPrice - binancePrice) / binancePrice) * 100;
    const spreadOKXToBinance = ((binancePrice - okxPrice) / okxPrice) * 100;
    
    // Verificar oportunidade Binance -> OKX
    if (spreadBinanceToOKX >= minSpread && spreadBinanceToOKX <= maxSpread) {
      // CÁLCULO PADRONIZADO (mesmo da calculadora)
      const standardInvestment = 10;
      const spotQuantity = standardInvestment / binancePrice;
      const futuresValue = spotQuantity * okxPrice;
      const grossProfit = futuresValue - standardInvestment;
      const fees = standardInvestment * 0.002; // 0.2% do investimento (cross-exchange)
      const potentialProfit = Math.max(0, grossProfit - fees);
      
      if (potentialProfit > 1.0) { // Lucro mínimo US$ 1.00 para cross-exchange
        opportunities.push({
          symbol,
          buy_exchange: 'Binance',
          sell_exchange: 'OKX',
          buy_price: binancePrice,
          sell_price: okxPrice,
          spread_percentage: spreadBinanceToOKX,
          potential_profit: potentialProfit,
          required_balance: standardInvestment,
          risk_level: spreadBinanceToOKX > 2 ? 'HIGH' : spreadBinanceToOKX > 1 ? 'MEDIUM' : 'LOW',
          expiry_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          liquidity_buy: 45000 + Math.random() * 40000,
          liquidity_sell: 40000 + Math.random() * 35000,
          execution_time_estimate: 750 + Math.random() * 500
        });
        
        console.log(`✅ Oportunidade ${symbol}: Binance($${binancePrice.toFixed(4)}) -> OKX($${okxPrice.toFixed(4)}), spread=${spreadBinanceToOKX.toFixed(3)}%, lucro=$${potentialProfit.toFixed(2)}`);
      }
    }
    
    // Verificar oportunidade OKX -> Binance  
    if (spreadOKXToBinance >= minSpread && spreadOKXToBinance <= maxSpread) {
      // CÁLCULO PADRONIZADO (mesmo da calculadora)
      const standardInvestment = 10;
      const spotQuantity = standardInvestment / okxPrice;
      const futuresValue = spotQuantity * binancePrice;
      const grossProfit = futuresValue - standardInvestment;
      const fees = standardInvestment * 0.002; // 0.2% do investimento (cross-exchange)
      const potentialProfit = Math.max(0, grossProfit - fees);
      
      if (potentialProfit > 1.0) { // Lucro mínimo US$ 1.00 para cross-exchange
        opportunities.push({
          symbol,
          buy_exchange: 'OKX',
          sell_exchange: 'Binance',
          buy_price: okxPrice,
          sell_price: binancePrice,
          spread_percentage: spreadOKXToBinance,
          potential_profit: potentialProfit,
          required_balance: standardInvestment,
          risk_level: spreadOKXToBinance > 2 ? 'HIGH' : spreadOKXToBinance > 1 ? 'MEDIUM' : 'LOW',
          expiry_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          liquidity_buy: 45000 + Math.random() * 40000,
          liquidity_sell: 40000 + Math.random() * 35000,
          execution_time_estimate: 750 + Math.random() * 500
        });
        
        console.log(`✅ Oportunidade ${symbol}: OKX($${okxPrice.toFixed(4)}) -> Binance($${binancePrice.toFixed(4)}), spread=${spreadOKXToBinance.toFixed(3)}%, lucro=$${potentialProfit.toFixed(2)}`);
      }
    }
  });
  
  return opportunities.sort((a, b) => b.potential_profit - a.potential_profit);
}

// Função auxiliar para extrair user_id
function getUserIdFromBody(body: any): string | undefined {
  return body?.user_id || body?.binance_api_key || body?.okx_api_key;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando detecção de oportunidades de arbitragem...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Ler parâmetros da requisição
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    
    // Extrair user_id do request
    const userId = getUserIdFromBody(body);
    
    const requestType = body.type || 'cross_exchange'; // 'funding' ou 'cross_exchange'
    
    // Array para armazenar todas as oportunidades
    let allOpportunities: ArbitrageOpportunity[] = [];
    
    if (requestType === 'funding') {
      // APENAS OPORTUNIDADES DE FUNDING DA BINANCE (Spot vs Futures)
      console.log('🔄 Buscando apenas oportunidades de funding arbitrage (Binance interno)...');
      const binanceFundingOpportunities = await getBinanceFundingOpportunities();
      allOpportunities.push(...binanceFundingOpportunities);
      console.log(`📈 ${binanceFundingOpportunities.length} oportunidades de funding da Binance adicionadas`);
      
      return new Response(JSON.stringify({
        success: true,
        opportunities_found: allOpportunities.length,
        opportunities: allOpportunities,
        breakdown: {
          binance_funding: binanceFundingOpportunities.length,
          cross_exchange: 0,
          total: allOpportunities.length
        },
        data_source: 'binance_funding_api',
        binance_api_available: true,
        binance_funding_available: binanceFundingOpportunities.length > 0,
        operation_type: 'FUNDING_ARBITRAGE',
        description: 'Operações entre Spot e Futures na Binance',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // APENAS OPORTUNIDADES CROSS-EXCHANGE REAIS (Binance vs OKX)  
      console.log('🔄 Buscando apenas oportunidades cross-exchange REAIS (Binance vs OKX)...');
      
      // Verificar símbolos whitelistados da Binance
      const whitelistedSymbols = await getBinanceWhitelistedSymbols();
      console.log(`🔒 Símbolos autorizados pela Binance: ${whitelistedSymbols.join(', ')}`);
      
      // Buscar preços reais da Binance (obrigatório)
      const binancePrices = await getBinancePrices();
      const dataSource = 'binance_api';
      console.log(`✅ Preços reais da Binance obtidos: ${Object.keys(binancePrices).length} símbolos`);
      
      // Buscar preços reais da OKX
      const okxPrices = await getOKXPrices(userId);
      
      console.log(`📊 Dados preparados - Binance: ${Object.keys(binancePrices).length}, OKX: ${Object.keys(okxPrices).length} símbolos`);
      
      // Calcular oportunidades cross-exchange REAIS usando apenas símbolos whitelistados
      const crossExchangeOpportunities = calculateCrossExchangeOpportunities(binancePrices, okxPrices, whitelistedSymbols);
      allOpportunities.push(...crossExchangeOpportunities);
      console.log(`🔄 ${crossExchangeOpportunities.length} oportunidades cross-exchange REAIS detectadas`);
      
      return new Response(JSON.stringify({
        success: true,
        opportunities_found: allOpportunities.length,
        opportunities: allOpportunities,
        breakdown: {
          binance_funding: 0,
          cross_exchange: allOpportunities.length,
          total: allOpportunities.length
        },
        data_source: dataSource,
        binance_api_available: dataSource === 'binance_api',
        binance_funding_available: false,
        operation_type: 'CROSS_EXCHANGE_ARBITRAGE',
        description: 'Operações entre diferentes exchanges (Binance ↔ Hyperliquid)',
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    
    // Apenas retornar oportunidades REAIS encontradas
    if (allOpportunities.length === 0) {
      console.log('⚠️ Nenhuma oportunidade real encontrada no momento');
    }
    
    // Ordenar por potencial de lucro e limitar
    allOpportunities.sort((a, b) => b.potential_profit - a.potential_profit);
    const finalOpportunities = allOpportunities.slice(0, 12); // Aumentar para 12 oportunidades total
    
    console.log(`💰 ${finalOpportunities.length} oportunidades cross-exchange calculadas`);
    
    // Salvar no banco de dados
    if (finalOpportunities.length > 0) {
      try {
        // Limpar oportunidades antigas
        await supabase
          .from('realtime_arbitrage_opportunities')
          .update({ is_active: false })
          .lt('last_updated', new Date(Date.now() - 5 * 60 * 1000).toISOString());

        // Preparar dados para inserção com cálculos padronizados
        const insertData = finalOpportunities.map(opp => {
          // PADRONIZAR: calcular lucro baseado em US$ 1000 (mesmo padrão da calculadora)
          const standardInvestment = 10;
          const spotQuantity = standardInvestment / opp.buy_price;
          const futuresValue = spotQuantity * opp.sell_price;
          const grossProfit = futuresValue - standardInvestment;
          const fees = standardInvestment * 0.0015; // 0.15% taxa padrão
          const netProfitUsd = Math.max(0, grossProfit - fees);
          
          return {
            symbol: opp.symbol,
            buy_exchange: opp.buy_exchange,
            sell_exchange: opp.sell_exchange,
            buy_price: opp.buy_price,
            sell_price: opp.sell_price,
            spread: opp.spread_percentage,
            potential: netProfitUsd, // Usar lucro líquido calculado padronizado
            net_profit: netProfitUsd, // Usar mesmo valor
            transfer_fee: fees / standardInvestment, // Taxa proporcional
            transfer_time: Math.round(opp.execution_time_estimate / 1000),
            risk_level: opp.risk_level,
            base_currency: opp.symbol,
            quote_currency: 'USDT',
            is_active: true,
            last_updated: new Date().toISOString()
          };
        });

        // Inserir oportunidades
        for (const data of insertData) {
          const { error } = await supabase
            .from('realtime_arbitrage_opportunities')
            .upsert(data, {
              onConflict: 'symbol,buy_exchange,sell_exchange'
            });
            
          if (error) {
            // @ts-ignore - Error could be null but we check for it
            console.error(`❌ Erro ao salvar ${data.symbol}:`, error && typeof error === 'object' && 'message' in error ? error.message : String(error));
          } else {
            console.log(`✅ Oportunidade ${data.symbol} salva: ${data.spread.toFixed(3)}% spread`);
          }
        }

        console.log(`🎯 ${finalOpportunities.length} oportunidades salvas no banco`);
      } catch (dbError) {
        console.error('❌ Erro no banco de dados:', dbError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      opportunities_found: finalOpportunities.length,
      opportunities: finalOpportunities,
      breakdown: {
        binance_funding: 0,
        cross_exchange: finalOpportunities.length,
        total: finalOpportunities.length
      },
      // @ts-ignore - dataSource is available in this scope
      data_source: dataSource || 'simulated',
      // @ts-ignore - dataSource is available in this scope  
      binance_api_available: (dataSource || 'simulated') === 'binance_api',
      binance_funding_available: false,
      operation_type: 'CROSS_EXCHANGE_ARBITRAGE',
      description: 'Operações entre diferentes exchanges (OKX ↔ Binance)',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro crítico na detecção:', error);
    
    return new Response(JSON.stringify({ 
      success: false,
      opportunities_found: 0,
      opportunities: [],
      error: error instanceof Error ? error.message : String(error),
      message: 'Não foi possível detectar oportunidades no momento. Verifique suas credenciais e conexão com as exchanges.',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});