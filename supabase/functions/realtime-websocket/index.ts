// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  symbols?: string[];
  exchange?: string;
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  
  let subscribedSymbols: string[] = [];
  let priceUpdateInterval: number | null = null;

  socket.onopen = () => {
    console.log("WebSocket connection established");
    socket.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      timestamp: new Date().toISOString()
    }));
  };

  socket.onmessage = async (event) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      console.log("Received message:", message);

      switch (message.type) {
        case 'subscribe':
          if (message.symbols) {
            subscribedSymbols = [...new Set([...subscribedSymbols, ...message.symbols])];
            console.log("Subscribed to symbols:", subscribedSymbols);
            
            // Start sending real-time price updates
            if (priceUpdateInterval) {
              clearInterval(priceUpdateInterval);
            }
            
            priceUpdateInterval = setInterval(async () => {
              try {
                // Fetch real-time data from Binance WebSocket API
                const binanceApiKey = Deno.env.get('BINANCE_API_KEY');
                if (!binanceApiKey) {
                  throw new Error('Binance API key not configured');
                }

                // Get current prices for subscribed symbols
                const priceUpdates = await Promise.all(
                  subscribedSymbols.map(async (symbol) => {
                    const binanceSymbol = symbol.replace('/', '');
                    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`, {
                      headers: { 'X-MBX-APIKEY': binanceApiKey }
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      return {
                        symbol: symbol,
                        price: parseFloat(data.price),
                        timestamp: new Date().toISOString(),
                        exchange: 'binance'
                      };
                    }
                    return null;
                  })
                );

                const validUpdates = priceUpdates.filter(update => update !== null);
                
                if (validUpdates.length > 0) {
                  socket.send(JSON.stringify({
                    type: 'price_update',
                    data: validUpdates,
                    timestamp: new Date().toISOString()
                  }));
                }
              } catch (error) {
                console.error('Error fetching price updates:', error);
                socket.send(JSON.stringify({
                  type: 'error',
                  message: 'Error fetching price updates',
                  timestamp: new Date().toISOString()
                }));
              }
            }, 5000); // Update every 5 seconds
          }
          break;

        case 'unsubscribe':
          if (message.symbols) {
            subscribedSymbols = subscribedSymbols.filter(s => !message.symbols!.includes(s));
            console.log("Remaining subscribed symbols:", subscribedSymbols);
            
            if (subscribedSymbols.length === 0 && priceUpdateInterval) {
              clearInterval(priceUpdateInterval);
              priceUpdateInterval = null;
            }
          }
          break;

        case 'ping':
          socket.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;

        default:
          socket.send(JSON.stringify({
            type: 'error',
            message: 'Unknown message type',
            timestamp: new Date().toISOString()
          }));
      }
    } catch (error) {
      console.error('Error processing message:', error);
      socket.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format',
        timestamp: new Date().toISOString()
      }));
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed");
    if (priceUpdateInterval) {
      clearInterval(priceUpdateInterval);
    }
  };

  return response;
});