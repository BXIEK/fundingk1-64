// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TriangularOpportunity {
  id: string;
  cycle: string[];
  exchange: string;
  profitPercentage: number;
  netProfitUsd: number;
  prices: Record<string, number>;
  timestamp: number;
}

interface ExchangePrice {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

// Configuração
const CONFIG = {
  UPDATE_INTERVAL_MS: 100, // 100ms para alta frequência
  MIN_PROFIT_PERCENT: 0.3,
  TRADE_SIZE_USD: 1000,
  TAKER_FEE: 0.001, // 0.1% fee
};

// Ciclos triangulares para detectar
const TRIANGULAR_CYCLES = [
  ['BTC/USDT', 'ETH/BTC', 'ETH/USDT'],
  ['BTC/USDT', 'BNB/BTC', 'BNB/USDT'],
  ['ETH/USDT', 'BNB/ETH', 'BNB/USDT'],
  ['SOL/USDT', 'ETH/SOL', 'ETH/USDT'],
];

async function fetchBinancePrices(symbols: string[]): Promise<Map<string, ExchangePrice>> {
  const prices = new Map<string, ExchangePrice>();
  
  try {
    const response = await fetch('https://api.binance.us/api/v3/ticker/24hr');
    if (!response.ok) throw new Error('Failed to fetch Binance prices');
    
    const data = await response.json();
    const timestamp = Date.now();
    
    for (const ticker of data) {
      const symbol = ticker.symbol.replace(/(.+)(USDT|BTC|ETH|BNB)$/, '$1/$2');
      if (symbols.includes(symbol)) {
        prices.set(symbol, {
          symbol,
          price: parseFloat(ticker.lastPrice),
          timestamp,
          volume: parseFloat(ticker.volume),
        });
      }
    }
  } catch (error) {
    console.error('Error fetching Binance prices:', error);
  }
  
  return prices;
}

function calculateTriangularArbitrage(
  cycle: string[],
  prices: Map<string, ExchangePrice>
): TriangularOpportunity | null {
  const [pair1, pair2, pair3] = cycle;
  
  const price1 = prices.get(pair1);
  const price2 = prices.get(pair2);
  const price3 = prices.get(pair3);
  
  if (!price1 || !price2 || !price3) return null;
  
  // Simular ciclo triangular: USDT -> BTC -> ETH -> USDT
  let amount = CONFIG.TRADE_SIZE_USD;
  
  // Passo 1: Comprar primeira moeda
  amount = amount / price1.price;
  amount = amount * (1 - CONFIG.TAKER_FEE);
  
  // Passo 2: Trocar pela segunda moeda
  amount = amount * price2.price;
  amount = amount * (1 - CONFIG.TAKER_FEE);
  
  // Passo 3: Converter de volta para USDT
  amount = amount / price3.price;
  amount = amount * (1 - CONFIG.TAKER_FEE);
  
  const netProfitUsd = amount - CONFIG.TRADE_SIZE_USD;
  const profitPercentage = (netProfitUsd / CONFIG.TRADE_SIZE_USD) * 100;
  
  if (profitPercentage < CONFIG.MIN_PROFIT_PERCENT) return null;
  
  return {
    id: `${cycle.join('-')}-${Date.now()}`,
    cycle,
    exchange: 'binance',
    profitPercentage,
    netProfitUsd,
    prices: {
      [pair1]: price1.price,
      [pair2]: price2.price,
      [pair3]: price3.price,
    },
    timestamp: Date.now(),
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let isActive = false;
  let updateInterval: number | null = null;

  socket.onopen = () => {
    console.log("🔗 WebSocket triangular arbitrage connected");
    socket.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      message: 'Triangular Arbitrage WebSocket Engine',
      timestamp: Date.now()
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("📥 Received message:", message);

      switch (message.type) {
        case 'start':
          if (isActive) break;
          
          isActive = true;
          console.log("🚀 Starting triangular arbitrage detection...");
          
          // Coletar todos os símbolos necessários
          const allSymbols = new Set<string>();
          TRIANGULAR_CYCLES.forEach(cycle => cycle.forEach(s => allSymbols.add(s)));
          
          updateInterval = setInterval(async () => {
            try {
              // Buscar preços
              const prices = await fetchBinancePrices(Array.from(allSymbols));
              
              // Detectar oportunidades
              const opportunities: TriangularOpportunity[] = [];
              
              for (const cycle of TRIANGULAR_CYCLES) {
                const opportunity = calculateTriangularArbitrage(cycle, prices);
                if (opportunity) {
                  opportunities.push(opportunity);
                }
              }
              
              // Enviar dados
              socket.send(JSON.stringify({
                type: 'update',
                opportunities: opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage),
                prices: Array.from(prices.values()),
                timestamp: Date.now(),
              }));
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              console.error('❌ Error in update cycle:', errorMessage);
              socket.send(JSON.stringify({
                type: 'error',
                message: errorMessage,
                timestamp: Date.now()
              }));
            }
          }, CONFIG.UPDATE_INTERVAL_MS);
          break;

        case 'stop':
          isActive = false;
          if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
          }
          console.log("⏹️ Stopped triangular arbitrage detection");
          socket.send(JSON.stringify({
            type: 'stopped',
            timestamp: Date.now()
          }));
          break;

        case 'ping':
          socket.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;

        default:
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type',
            timestamp: Date.now()
          }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error processing message:', errorMessage);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  };

  socket.onerror = (error) => {
    console.error("❌ WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("🔌 WebSocket connection closed");
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  };

  return response;
});
