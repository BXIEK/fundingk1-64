import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PriceCache {
  price: number;
  change24h: number;
  timestamp: number;
}

// Cache global de preços para evitar requisições duplicadas
const priceCache = new Map<string, PriceCache>();
const CACHE_DURATION = 30000; // 30 segundos

// Controle de requisições em andamento para evitar duplicatas
const pendingRequests = new Map<string, Promise<PriceCache | null>>();

export const useCachedPrice = (symbol: string, exchange: 'binance' | 'okx') => {
  const [price, setPrice] = useState<number | null>(null);
  const [change24h, setChange24h] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const cacheKey = `${exchange}-${symbol}`;

  const fetchPrice = useCallback(async () => {
    // Verificar se há dados em cache válidos
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setPrice(cached.price);
      setChange24h(cached.change24h);
      return;
    }

    // Verificar se já há uma requisição em andamento
    const pending = pendingRequests.get(cacheKey);
    if (pending) {
      const result = await pending;
      if (result) {
        setPrice(result.price);
        setChange24h(result.change24h);
      }
      return;
    }

    // Fazer nova requisição
    setLoading(true);
    const fetchPromise = (async () => {
      try {
        const pairSymbol = `${symbol}USDT`;
        
        const { data, error } = await supabase.functions.invoke('binance-market-data', {
          body: { 
            action: 'tickers',
            symbols: [pairSymbol]
          }
        });

        if (error || !data?.success || !data.data?.length) {
          return null;
        }

        const ticker = data.data[0];
        const priceValue = parseFloat(ticker.lastPrice);
        const changeValue = parseFloat(ticker.priceChangePercent);

        const cacheData: PriceCache = {
          price: priceValue,
          change24h: changeValue,
          timestamp: Date.now()
        };

        priceCache.set(cacheKey, cacheData);
        return cacheData;
      } catch (error) {
        console.error(`Erro ao buscar preço ${cacheKey}:`, error);
        return null;
      } finally {
        pendingRequests.delete(cacheKey);
      }
    })();

    pendingRequests.set(cacheKey, fetchPromise);
    const result = await fetchPromise;
    
    if (result) {
      setPrice(result.price);
      setChange24h(result.change24h);
    }
    
    setLoading(false);
  }, [symbol, exchange, cacheKey]);

  useEffect(() => {
    fetchPrice();
    
    // Atualizar a cada 60 segundos
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return { price, change24h, loading, refetch: fetchPrice };
};
