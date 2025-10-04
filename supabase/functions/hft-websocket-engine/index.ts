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
  MAX_SLIPPAGE: 0.002, // 0.2%
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

// WebSocket URLs das exchanges
const WS_URLS = {
  binance: (symbol: string) => `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@trade`,
  okx: 'wss://ws.okx.com:8443/ws/v5/public',
  bybit: 'wss://stream.bybit.com/v5/public/spot',
  hyperliquid: 'wss://api.hyperliquid.xyz/ws',
};

class HFTEngine {
  private prices: Map<string, Map<string, ExchangePrice>> = new Map();
  private opportunities: ArbitrageOpportunity[] = [];
  private connections: Map<string, WebSocket> = new Map();

  async start(symbols: string[], enabledExchanges: string[]) {
    console.log('🚀 Iniciando HFT Engine...');
    console.log('Símbolos:', symbols);
    console.log('Exchanges:', enabledExchanges);

    // Conectar WebSockets de todas as exchanges
    for (const exchange of enabledExchanges) {
      for (const symbol of symbols) {
        await this.connectExchangeWS(exchange, symbol);
      }
    }
  }

  private async connectExchangeWS(exchange: string, symbol: string) {
    try {
      const key = `${exchange}-${symbol}`;
      
      if (exchange === 'binance') {
        const ws = new WebSocket(WS_URLS.binance(symbol));
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          this.updatePrice(exchange, symbol, {
            exchange,
            symbol,
            price: parseFloat(data.p),
            timestamp: data.T,
            volume: parseFloat(data.q),
          });
        };

        ws.onopen = () => {
          console.log(`✅ Conectado: ${exchange} - ${symbol}`);
        };

        ws.onerror = (error) => {
          console.error(`❌ Erro WebSocket ${exchange}:`, error);
        };

        this.connections.set(key, ws);
      } 
      else if (exchange === 'okx') {
        const ws = new WebSocket(WS_URLS.okx);
        
        ws.onopen = () => {
          // Subscribe to trades channel
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: [{
              channel: 'trades',
              instId: symbol.replace('/', '-'),
            }],
          }));
          console.log(`✅ Conectado: ${exchange} - ${symbol}`);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.data && data.data[0]) {
            const trade = data.data[0];
            this.updatePrice(exchange, symbol, {
              exchange,
              symbol,
              price: parseFloat(trade.px),
              timestamp: parseInt(trade.ts),
              volume: parseFloat(trade.sz),
            });
          }
        };

        this.connections.set(key, ws);
      }
      else if (exchange === 'bybit') {
        const ws = new WebSocket(WS_URLS.bybit);
        
        ws.onopen = () => {
          ws.send(JSON.stringify({
            op: 'subscribe',
            args: [`publicTrade.${symbol.replace('/', '')}`],
          }));
          console.log(`✅ Conectado: ${exchange} - ${symbol}`);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.data && data.data[0]) {
            const trade = data.data[0];
            this.updatePrice(exchange, symbol, {
              exchange,
              symbol,
              price: parseFloat(trade.p),
              timestamp: parseInt(trade.T),
              volume: parseFloat(trade.v),
            });
          }
        };

        this.connections.set(key, ws);
      }
      else if (exchange === 'hyperliquid') {
        const ws = new WebSocket(WS_URLS.hyperliquid);
        
        ws.onopen = () => {
          ws.send(JSON.stringify({
            method: 'subscribe',
            subscription: {
              type: 'trades',
              coin: symbol.split('/')[0],
            },
          }));
          console.log(`✅ Conectado: ${exchange} - ${symbol}`);
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.channel === 'trades' && data.data) {
            const trade = data.data;
            this.updatePrice(exchange, symbol, {
              exchange,
              symbol,
              price: parseFloat(trade.px),
              timestamp: trade.time,
              volume: parseFloat(trade.sz),
            });
          }
        };

        this.connections.set(key, ws);
      }

    } catch (error) {
      console.error(`Erro ao conectar ${exchange} - ${symbol}:`, error);
    }
  }

  private updatePrice(exchange: string, symbol: string, price: ExchangePrice) {
    if (!this.prices.has(symbol)) {
      this.prices.set(symbol, new Map());
    }
    
    this.prices.get(symbol)!.set(exchange, price);
    
    // Detectar oportunidades após cada atualização de preço
    this.detectOpportunities(symbol);
  }

  private detectOpportunities(symbol: string) {
    const startTime = performance.now();
    const symbolPrices = this.prices.get(symbol);
    
    if (!symbolPrices || symbolPrices.size < 2) return;

    const exchanges = Array.from(symbolPrices.keys());
    
    // Verifica todos os pares de exchanges
    for (let i = 0; i < exchanges.length; i++) {
      for (let j = i + 1; j < exchanges.length; j++) {
        const exchange1 = exchanges[i];
        const exchange2 = exchanges[j];
        
        const price1 = symbolPrices.get(exchange1)!;
        const price2 = symbolPrices.get(exchange2)!;

        // Oportunidade 1: Comprar em exchange1, vender em exchange2
        const netProfit1 = this.calculateNetProfit(
          price1.price,
          price2.price,
          HFT_CONFIG.TAKER_FEE
        );

        if (netProfit1 > HFT_CONFIG.MIN_PROFIT_THRESHOLD_USD) {
          const decisionTime = performance.now() - startTime;
          
          if (decisionTime <= HFT_CONFIG.MAX_DECISION_TIME_MS) {
            const opportunity: ArbitrageOpportunity = {
              symbol,
              buyExchange: exchange1,
              sellExchange: exchange2,
              buyPrice: price1.price,
              sellPrice: price2.price,
              spread: ((price2.price - price1.price) / price1.price) * 100,
              netProfit: netProfit1,
              roi: (netProfit1 / (price1.price * 0.001)) * 100, // ROI baseado em 0.001 BTC
              timestamp: Date.now(),
            };

            this.opportunities.push(opportunity);
            console.log(`🎯 OPORTUNIDADE DETECTADA:`, opportunity);
          }
        }

        // Oportunidade 2: Comprar em exchange2, vender em exchange1
        const netProfit2 = this.calculateNetProfit(
          price2.price,
          price1.price,
          HFT_CONFIG.TAKER_FEE
        );

        if (netProfit2 > HFT_CONFIG.MIN_PROFIT_THRESHOLD_USD) {
          const decisionTime = performance.now() - startTime;
          
          if (decisionTime <= HFT_CONFIG.MAX_DECISION_TIME_MS) {
            const opportunity: ArbitrageOpportunity = {
              symbol,
              buyExchange: exchange2,
              sellExchange: exchange1,
              buyPrice: price2.price,
              sellPrice: price1.price,
              spread: ((price1.price - price2.price) / price2.price) * 100,
              netProfit: netProfit2,
              roi: (netProfit2 / (price2.price * 0.001)) * 100,
              timestamp: Date.now(),
            };

            this.opportunities.push(opportunity);
            console.log(`🎯 OPORTUNIDADE DETECTADA:`, opportunity);
          }
        }
      }
    }

    // Limpar oportunidades antigas (> 5 segundos)
    const now = Date.now();
    this.opportunities = this.opportunities.filter(
      (opp) => now - opp.timestamp < 5000
    );
  }

  private calculateNetProfit(buyPrice: number, sellPrice: number, fee: number): number {
    const amount = 0.001; // 0.001 BTC como exemplo
    const buyFee = buyPrice * amount * fee;
    const sellFee = sellPrice * amount * fee;
    const grossProfit = (sellPrice - buyPrice) * amount;
    return grossProfit - buyFee - sellFee;
  }

  getOpportunities(): ArbitrageOpportunity[] {
    return this.opportunities;
  }

  getCurrentPrices(): Map<string, Map<string, ExchangePrice>> {
    return this.prices;
  }

  disconnect() {
    this.connections.forEach((ws, key) => {
      console.log(`🔌 Desconectando: ${key}`);
      ws.close();
    });
    this.connections.clear();
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbols, exchanges, userId } = await req.json();

    if (action === 'start') {
      const engine = new HFTEngine();
      await engine.start(symbols, exchanges);

      // Retorna stream de oportunidades via SSE
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          
          const interval = setInterval(() => {
            const opportunities = engine.getOpportunities();
            const prices = Array.from(engine.getCurrentPrices().entries()).map(([symbol, priceMap]) => ({
              symbol,
              prices: Array.from(priceMap.values()),
            }));

            const data = JSON.stringify({
              opportunities,
              prices,
              timestamp: Date.now(),
            });

            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }, 100); // Atualiza a cada 100ms

          // Cleanup após 30 segundos
          setTimeout(() => {
            clearInterval(interval);
            engine.disconnect();
            controller.close();
          }, 30000);
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
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no HFT Engine:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
