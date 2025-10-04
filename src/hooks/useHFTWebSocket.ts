import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface HFTOpportunity {
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

interface ExchangePrice {
  exchange: string;
  symbol: string;
  price: number;
  timestamp: number;
  volume: number;
}

interface HFTData {
  opportunities: HFTOpportunity[];
  prices: Array<{
    symbol: string;
    prices: ExchangePrice[];
  }>;
  timestamp: number;
}

export const useHFTWebSocket = (
  symbols: string[],
  exchanges: string[],
  enabled: boolean
) => {
  const [data, setData] = useState<HFTData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || symbols.length === 0 || exchanges.length === 0) {
      return;
    }

    let eventSource: EventSource | null = null;

    const connect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const url = new URL(
          'https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/hft-websocket-engine'
        );

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            action: 'start',
            symbols,
            exchanges,
            userId: session?.user?.id,
          }),
        });

        if (!response.ok) {
          throw new Error('Falha ao conectar ao HFT Engine');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('No reader available');
        }

        setIsConnected(true);
        setError(null);

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(line.substring(6));
                setData(jsonData);
              } catch (e) {
                console.error('Erro ao parsear dados:', e);
              }
            }
          }
        }

      } catch (err) {
        console.error('Erro na conexão HFT:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
        setIsConnected(false);
      }
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
      setIsConnected(false);
    };
  }, [symbols, exchanges, enabled]);

  return {
    data,
    isConnected,
    error,
  };
};
