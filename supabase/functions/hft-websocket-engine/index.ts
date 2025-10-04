import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Configurações HFT
const HFT_CONFIG = {
  MAX_DECISION_TIME_MS: 30,
  MIN_PROFIT_THRESHOLD_USD: 1.00,
  TAKER_FEE: 0.001, // 0.1%
  TRADE_SIZE_USD: 25, // $25 por trade
  AUTO_EXECUTE: true, // Executar trades automaticamente
  MAX_CONCURRENT_TRADES: 3,
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

interface ExchangeCredentials {
  binance?: { apiKey: string; secretKey: string };
  okx?: { apiKey: string; secretKey: string; passphrase: string };
  bybit?: { apiKey: string; secretKey: string };
}

// Função para criar assinatura HMAC SHA256
async function createSignature(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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

async function executeBinanceBuy(
  symbol: string,
  usdtAmount: number,
  price: number,
  credentials: { apiKey: string; secretKey: string }
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const formattedSymbol = symbol.replace('/', '');
    const quantity = (usdtAmount / price).toFixed(8);
    const timestamp = Date.now();
    
    const queryString = `symbol=${formattedSymbol}&side=BUY&type=MARKET&quoteOrderQty=${usdtAmount}&timestamp=${timestamp}`;
    const signature = await createSignature(credentials.secretKey, queryString);
    
    const response = await fetch(`https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
      },
    });
    
    const data = await response.json();
    
    if (data.orderId) {
      console.log(`✅ Binance BUY executado: ${symbol} - Order ID: ${data.orderId}`);
      return { success: true, orderId: data.orderId.toString() };
    } else {
      console.error(`❌ Erro Binance BUY:`, data);
      return { success: false, error: data.msg || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error(`❌ Erro ao executar BUY na Binance:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
}

async function executeBinanceSell(
  symbol: string,
  quantity: number,
  credentials: { apiKey: string; secretKey: string }
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const formattedSymbol = symbol.replace('/', '');
    const timestamp = Date.now();
    
    const queryString = `symbol=${formattedSymbol}&side=SELL&type=MARKET&quantity=${quantity.toFixed(8)}&timestamp=${timestamp}`;
    const signature = await createSignature(credentials.secretKey, queryString);
    
    const response = await fetch(`https://api.binance.com/api/v3/order?${queryString}&signature=${signature}`, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': credentials.apiKey,
      },
    });
    
    const data = await response.json();
    
    if (data.orderId) {
      console.log(`✅ Binance SELL executado: ${symbol} - Order ID: ${data.orderId}`);
      return { success: true, orderId: data.orderId.toString() };
    } else {
      console.error(`❌ Erro Binance SELL:`, data);
      return { success: false, error: data.msg || 'Erro desconhecido' };
    }
  } catch (error) {
    console.error(`❌ Erro ao executar SELL na Binance:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
}

async function executeArbitrageTrade(
  opportunity: ArbitrageOpportunity,
  credentials: ExchangeCredentials
): Promise<{ success: boolean; details?: any; error?: string }> {
  console.log(`🎯 Executando arbitragem: ${opportunity.symbol}`);
  console.log(`   Comprar em ${opportunity.buyExchange} @ $${opportunity.buyPrice}`);
  console.log(`   Vender em ${opportunity.sellExchange} @ $${opportunity.sellPrice}`);
  console.log(`   Lucro esperado: $${opportunity.netProfit.toFixed(2)}`);

  try {
    // Fase 1: Compra na exchange de origem
    let buyResult;
    if (opportunity.buyExchange === 'binance' && credentials.binance) {
      buyResult = await executeBinanceBuy(
        opportunity.symbol,
        HFT_CONFIG.TRADE_SIZE_USD,
        opportunity.buyPrice,
        credentials.binance
      );
    } else {
      return { success: false, error: `Exchange ${opportunity.buyExchange} não suportada para compra` };
    }

    if (!buyResult.success) {
      console.error(`❌ Falha na compra:`, buyResult.error);
      return { success: false, error: `Falha na compra: ${buyResult.error}` };
    }

    const boughtQuantity = HFT_CONFIG.TRADE_SIZE_USD / opportunity.buyPrice;

    // Fase 2: Venda na exchange de destino
    let sellResult;
    if (opportunity.sellExchange === 'binance' && credentials.binance) {
      sellResult = await executeBinanceSell(
        opportunity.symbol,
        boughtQuantity,
        credentials.binance
      );
    } else {
      console.error(`❌ Exchange ${opportunity.sellExchange} não suportada para venda`);
      return { 
        success: false, 
        error: `Exchange ${opportunity.sellExchange} não suportada - ATENÇÃO: Você tem ${boughtQuantity} ${opportunity.symbol} na ${opportunity.buyExchange}` 
      };
    }

    if (!sellResult.success) {
      console.error(`❌ Falha na venda:`, sellResult.error);
      return { 
        success: false, 
        error: `Falha na venda: ${sellResult.error} - ATENÇÃO: Você tem ${boughtQuantity} ${opportunity.symbol} na ${opportunity.buyExchange}` 
      };
    }

    console.log(`🎉 ARBITRAGEM COMPLETA!`);
    return {
      success: true,
      details: {
        buyOrderId: buyResult.orderId,
        sellOrderId: sellResult.orderId,
        quantity: boughtQuantity,
        estimatedProfit: opportunity.netProfit,
      },
    };

  } catch (error) {
    console.error(`❌ Erro na execução da arbitragem:`, error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
}

function calculateNetProfit(buyPrice: number, sellPrice: number, tradeSizeUSD: number): number {
  const quantity = tradeSizeUSD / buyPrice;
  const buyFee = tradeSizeUSD * HFT_CONFIG.TAKER_FEE;
  const sellValue = quantity * sellPrice;
  const sellFee = sellValue * HFT_CONFIG.TAKER_FEE;
  const grossProfit = sellValue - tradeSizeUSD;
  return grossProfit - buyFee - sellFee;
}

function detectOpportunities(prices: Map<string, ExchangePrice[]>): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];
  const startTime = performance.now();

  for (const [symbol, exchangePrices] of prices.entries()) {
    if (exchangePrices.length < 2) continue;

    for (let i = 0; i < exchangePrices.length; i++) {
      for (let j = i + 1; j < exchangePrices.length; j++) {
        const exchange1 = exchangePrices[i];
        const exchange2 = exchangePrices[j];

        const netProfit1 = calculateNetProfit(
          exchange1.price,
          exchange2.price,
          HFT_CONFIG.TRADE_SIZE_USD
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
            roi: (netProfit1 / HFT_CONFIG.TRADE_SIZE_USD) * 100,
            timestamp: Date.now(),
          });
        }

        const netProfit2 = calculateNetProfit(
          exchange2.price,
          exchange1.price,
          HFT_CONFIG.TRADE_SIZE_USD
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
            roi: (netProfit2 / HFT_CONFIG.TRADE_SIZE_USD) * 100,
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  const decisionTime = performance.now() - startTime;
  console.log(`⚡ Detectadas ${opportunities.length} oportunidades em ${decisionTime.toFixed(2)}ms`);

  return opportunities.sort((a, b) => b.netProfit - a.netProfit);
}

serve(async (req) => {
  console.log('📨 Requisição recebida:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbols, exchanges, userId, autoExecute } = await req.json();
    console.log('📊 Parâmetros:', { action, symbols, exchanges, userId, autoExecute });

    if (action !== 'start') {
      return new Response(
        JSON.stringify({ error: 'Ação inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar credenciais do usuário
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const credentials: ExchangeCredentials = {};
    
    // Buscar credenciais Binance
    if (exchanges.includes('binance')) {
      const binanceApiKey = Deno.env.get('BINANCE_API_KEY');
      const binanceSecretKey = Deno.env.get('BINANCE_SECRET_KEY');
      
      if (binanceApiKey && binanceSecretKey) {
        credentials.binance = { apiKey: binanceApiKey, secretKey: binanceSecretKey };
        console.log('✅ Credenciais Binance carregadas');
      } else {
        console.warn('⚠️ Credenciais Binance não encontradas');
      }
    }

    // Buscar credenciais OKX
    if (exchanges.includes('okx')) {
      const okxApiKey = Deno.env.get('OKX_API_KEY');
      const okxSecretKey = Deno.env.get('OKX_SECRET_KEY');
      const okxPassphrase = Deno.env.get('OKX_PASSPHRASE');
      
      if (okxApiKey && okxSecretKey && okxPassphrase) {
        credentials.okx = { apiKey: okxApiKey, secretKey: okxSecretKey, passphrase: okxPassphrase };
        console.log('✅ Credenciais OKX carregadas');
      } else {
        console.warn('⚠️ Credenciais OKX não encontradas');
      }
    }

    // Buscar credenciais Bybit
    if (exchanges.includes('bybit')) {
      const bybitApiKey = Deno.env.get('BYBIT_API_KEY');
      const bybitSecretKey = Deno.env.get('BYBIT_SECRET_KEY');
      
      if (bybitApiKey && bybitSecretKey) {
        credentials.bybit = { apiKey: bybitApiKey, secretKey: bybitSecretKey };
        console.log('✅ Credenciais Bybit carregadas');
      } else {
        console.warn('⚠️ Credenciais Bybit não encontradas');
      }
    }

    const shouldAutoExecute = autoExecute === true && HFT_CONFIG.AUTO_EXECUTE;
    console.log(`🤖 Modo de execução: ${shouldAutoExecute ? 'AUTOMÁTICO' : 'MONITORAMENTO'}`);

    let activeTrades = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        console.log('🚀 Iniciando stream HFT...');

        try {
          for (let iteration = 0; iteration < 300; iteration++) {
            const allPrices = new Map<string, ExchangePrice[]>();

            for (const symbol of symbols) {
              const prices: ExchangePrice[] = [];
              const pricePromises: Promise<ExchangePrice | null>[] = [];

              if (exchanges.includes('binance')) pricePromises.push(fetchBinancePrice(symbol));
              if (exchanges.includes('okx')) pricePromises.push(fetchOKXPrice(symbol));
              if (exchanges.includes('bybit')) pricePromises.push(fetchBybitPrice(symbol));

              const results = await Promise.all(pricePromises);
              
              for (const price of results) {
                if (price) prices.push(price);
              }

              if (prices.length > 0) allPrices.set(symbol, prices);
            }

            const opportunities = detectOpportunities(allPrices);

            // Executar trades automaticamente se habilitado
            const executedTrades = [];
            if (shouldAutoExecute && opportunities.length > 0 && activeTrades < HFT_CONFIG.MAX_CONCURRENT_TRADES) {
              const topOpportunity = opportunities[0];
              
              console.log(`🎯 Melhor oportunidade: ${topOpportunity.symbol} - Lucro: $${topOpportunity.netProfit.toFixed(2)}`);
              
              activeTrades++;
              const tradeResult = await executeArbitrageTrade(topOpportunity, credentials);
              activeTrades--;

              executedTrades.push({
                opportunity: topOpportunity,
                result: tradeResult,
                timestamp: Date.now(),
              });

              if (tradeResult.success) {
                console.log(`🎉 Trade executado com sucesso!`);
              } else {
                console.error(`❌ Falha no trade:`, tradeResult.error);
              }
            }

            const pricesArray = Array.from(allPrices.entries()).map(([symbol, prices]) => ({
              symbol,
              prices,
            }));

            const data = JSON.stringify({
              opportunities,
              prices: pricesArray,
              executedTrades,
              activeTrades,
              autoExecuteEnabled: shouldAutoExecute,
              timestamp: Date.now(),
              iteration,
            });

            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            
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
