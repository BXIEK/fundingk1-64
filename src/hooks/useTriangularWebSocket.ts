import { useEffect, useState, useCallback } from 'react';

export interface TriangularOpportunity {
  id: string;
  cycle: string[];
  exchange: string;
  profitPercentage: number;
  netProfitUsd: number;
  prices: Record<string, number>;
  timestamp: number;
}

export interface ExchangePrice {
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

export interface TriangularData {
  opportunities: TriangularOpportunity[];
  prices: ExchangePrice[];
  timestamp: number;
}

export const useTriangularWebSocket = (enabled: boolean) => {
  const [data, setData] = useState<TriangularData>({
    opportunities: [],
    prices: [],
    timestamp: 0,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    const wsUrl = `wss://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/triangular-arbitrage-ws`;
    
    console.log('🔗 Connecting to Triangular Arbitrage WebSocket:', wsUrl);
    
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('✅ Triangular WebSocket connected');
      setIsConnected(true);
      setError(null);
      
      // Start detection - only after connection is fully open
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'start' }));
      }
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'update') {
          setData({
            opportunities: message.opportunities || [],
            prices: message.prices || [],
            timestamp: message.timestamp,
          });
        } else if (message.type === 'error') {
          setError(message.message);
        } else if (message.type === 'connection') {
          console.log('📡', message.message);
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    websocket.onerror = (err) => {
      console.error('❌ WebSocket error:', err);
      setError('WebSocket connection error');
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log('🔌 WebSocket disconnected');
      setIsConnected(false);
      
      // Reconnect after 3 seconds if still enabled
      if (enabled) {
        setTimeout(() => connect(), 3000);
      }
    };

    setWs(websocket);
  }, [enabled]);

  const disconnect = useCallback(() => {
    if (ws) {
      // Only send stop message if connection is open
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'stop' }));
        } catch (error) {
          console.error('Error sending stop message:', error);
        }
      }
      ws.close();
      setWs(null);
    }
    setIsConnected(false);
  }, [ws]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return { data, isConnected, error };
};
