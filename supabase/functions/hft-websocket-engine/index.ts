import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configurações HFT
const HFT_CONFIG = {
  MAX_DECISION_TIME_MS: 30,
  MIN_PROFIT_THRESHOLD_USD: 1.00,
  TAKER_FEE: 0.001, // 0.1%
  TRADE_SIZE: 0.001, // 0.001 BTC por exemplo
};

interface ExchangePrice {
  exchange: string;
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  netProfit: number;
  roi: number;
  timestamp: number;
}

async function fetchBinancePrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const formattedSymbol = symbol.replace('/', '');
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${formattedSymbol}`);
    const data = await response.json();
    
    return {
      exchange: 'binance',
      symbol,
      price: parseFloat(data.lastPrice),
      timestamp: data.closeTime,
      volume: parseFloat(data.volume),
    };
  } catch (error) {
    console.error(`Erro Binance ${symbol}:`, error);
    return null;
  }
}

async function fetchOKXPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const formattedSymbol = symbol.replace('/', '-');
    const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${formattedSymbol}`);
    const data = await response.json();
    
    if (data.data && data.data[0]) {
      return {
        exchange: 'okx',
        symbol,
        price: parseFloat(data.data[0].last),
        timestamp: parseInt(data.data[0].ts),
        volume: parseFloat(data.data[0].vol24h),
      };
    }
    return null;
  } catch (error) {
    console.error(`Erro OKX ${symbol}:`, error);
    return null;
  }
}

async function fetchBybitPrice(symbol: string): Promise<ExchangePrice | null> {
  try {
    const formattedSymbol = symbol.replace('/', '');
    const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${formattedSymbol}`);
    const data = await response.json();
    
    if (data.result && data.result.list && data.result.list[0]) {
      return {
        exchange: 'bybit',
        symbol,
        price: parseFloat(data.result.list[0].lastPrice),
        timestamp: parseInt(data.time),
        volume: parseFloat(data.result.list[0].volume24h),
      };
    }
    return null;
  } catch (error) {
    console.error(`Erro Bybit ${symbol}:`, error);
    return null;
  }
}

function calculateNetProfit(buyPrice: number, sellPrice: number, tradeSize: number): number {
  const buyFee = buyPrice * tradeSize * HFT_CONFIG.TAKER_FEE;
  const sellFee = sellPrice * tradeSize * HFT_CONFIG.TAKER_FEE;
  const grossProfit = (sellPrice - buyPrice) * tradeSize;
  return grossProfit - buyFee - sellFee;
}

function detectOpportunities(prices: Map<string, ExchangePrice[]>): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const startTime = performance.now();

  for (const [symbol, exchangePrices] of prices.entries()) {
    if (exchangePrices.length < 2) continue;

    // Comparar cada par de exchanges
    for (let i = 0; i < exchangePrices.length; i++) {
      for (let j = i + 1; j < exchangePrices.length; j++) {
        const exchange1 = exchangePrices[i];
        const exchange2 = exchangePrices[j];

        // Oportunidade 1: Comprar em exchange1, vender em exchange2
        const netProfit1 = calculateNetProfit(
          exchange1.price,
          exchange2.price,
          HFT_CONFIG.TRADE_SIZE
        );

        if (netProfit1 > HFT_CONFIG.MIN_PROFIT_THRESHOLD_USD) {
          const spread = ((exchange2.price - exchange1.price) / exchange1.price) * 100;
          opportunities.push({
            symbol,
            buyExchange: exchange1.exchange,
            sellExchange: exchange2.exchange,
            buyPrice: exchange1.price,
            sellPrice: exchange2.price,
            spread,
            netProfit: netProfit1,
            roi: (netProfit1 / (exchange1.price * HFT_CONFIG.TRADE_SIZE)) * 100,
            timestamp: Date.now(),
          });
        }

        // Oportunidade 2: Comprar em exchange2, vender em exchange1
        const netProfit2 = calculateNetProfit(
          exchange2.price,
          exchange1.price,
          HFT_CONFIG.TRADE_SIZE
        );

        if (netProfit2 > HFT_CONFIG.MIN_PROFIT_THRESHOLD_USD) {
          const spread = ((exchange1.price - exchange2.price) / exchange2.price) * 100;
          opportunities.push({
            symbol,
            buyExchange: exchange2.exchange,
            sellExchange: exchange1.exchange,
            buyPrice: exchange2.price,
            sellPrice: exchange1.price,
            spread,
            netProfit: netProfit2,
            roi: (netProfit2 / (exchange2.price * HFT_CONFIG.TRADE_SIZE)) * 100,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  const decisionTime = performance.now() - startTime;
  console.log(`⚡ Detectadas ${opportunities.length} oportunidades em ${decisionTime.toFixed(2)}ms`);

  return opportunities;
}

serve(async (req) => {
  console.log('📨 Requisição recebida:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbols, exchanges } = await req.json();
    console.log('📊 Parâmetros:', { action, symbols, exchanges });

    if (action !== 'start') {
      return new Response(
        JSON.stringify({ error: 'Ação inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar stream de dados
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        console.log('🚀 Iniciando stream HFT...');

        try {
          // Loop para buscar preços periodicamente
          for (let iteration = 0; iteration < 300; iteration++) { // 300 iterações = 30 segundos
            const allPrices = new Map<string, ExchangePrice[]>();

            // Buscar preços de todas as exchanges para cada símbolo
            for (const symbol of symbols) {
              const prices: ExchangePrice[] = [];

              // Buscar de cada exchange habilitada
              const pricePromises: Promise<ExchangePrice | null>[] = [];

              if (exchanges.includes('binance')) {
                pricePromises.push(fetchBinancePrice(symbol));
              }
              if (exchanges.includes('okx')) {
                pricePromises.push(fetchOKXPrice(symbol));
              }
              if (exchanges.includes('bybit')) {
                pricePromises.push(fetchBybitPrice(symbol));
              }

              const results = await Promise.all(pricePromises);
              
              for (const price of results) {
                if (price) prices.push(price);
              }

              if (prices.length > 0) {
                allPrices.set(symbol, prices);
              }
            }

            console.log(`📊 Preços obtidos para ${allPrices.size} símbolos`);

            // Detectar oportunidades
            const opportunities = detectOpportunities(allPrices);

            // Preparar dados para enviar
            const pricesArray = Array.from(allPrices.entries()).map(([symbol, prices]) => ({
              symbol,
              prices,
            }));

            const data = JSON.stringify({
              opportunities,
              prices: pricesArray,
              timestamp: Date.now(),
              iteration,
            });

            // Enviar dados via SSE
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            console.log(`✅ Dados enviados (iteração ${iteration + 1})`);

            // Aguardar 100ms antes da próxima iteração
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          console.log('🏁 Stream finalizado');
          controller.close();

        } catch (error) {
          console.error('❌ Erro no stream:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ Erro no HFT Engine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
