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
  executedTrades?: Array<{
    opportunity: HFTOpportunity;
    result: {
      success: boolean;
      details?: any;
      error?: string;
    };
    timestamp: number;
  }>;
  activeTrades?: number;
  autoExecuteEnabled?: boolean;
  timestamp: number;
}

export const useHFTWebSocket = (
  symbols: string[],
  exchanges: string[],
  enabled: boolean,
  autoExecute: boolean = false
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
        console.log('🔌 Iniciando conexão HFT Engine...');
        console.log('Símbolos:', symbols);
        console.log('Exchanges:', exchanges);

        const { data: { session } } = await supabase.auth.getSession();
        
        const url = 'https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/hft-websocket-engine';

        console.log('📡 Fazendo POST para:', url);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aGNzamxmd2tod2t2aGZhY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDEzMzQsImV4cCI6MjA2Njk3NzMzNH0.WLA9LhdQHPZJpTC1qasafl3Gb7IqRvXN61XVcKnzx0U',
          },
          body: JSON.stringify({
            action: 'start',
            symbols,
            exchanges,
            userId: session?.user?.id || 'anonymous',
            autoExecute,
          }),
        });

        console.log('📨 Response status:', response.status);
        console.log('📨 Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Erro na resposta:', errorText);
          setError(`Falha ao conectar: ${response.status}`);
          setIsConnected(false);
          throw new Error(`Falha ao conectar: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
          setError('Sem resposta do servidor');
          setIsConnected(false);
          throw new Error('No response body');
        }

        // Marca como conectado IMEDIATAMENTE ao receber o stream
        console.log('✅ Conexão estabelecida, iniciando leitura do stream...');
        setIsConnected(true);
        setError(null);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          
          if (done) {
            console.log('🏁 Stream finalizado');
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.trim().startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(line.trim().substring(6));
                console.log('📊 Dados recebidos:', jsonData);
                setData(jsonData);
              } catch (e) {
                console.error('⚠️ Erro ao parsear dados:', e, 'linha:', line);
              }
            }
          }
        }

      } catch (err) {
        console.error('❌ Erro na conexão HFT:', err);
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
  }, [symbols, exchanges, enabled, autoExecute]);

  return {
    data,
    isConnected,
    error,
  };
};
