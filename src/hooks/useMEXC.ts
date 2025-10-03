import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MEXCBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

interface MEXCOrder {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  quantity: number;
  price?: number;
}

interface MEXCWithdrawal {
  coin: string;
  address: string;
  amount: number;
  network?: string;
  memo?: string;
}

export const useMEXC = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const callMEXCAPI = useCallback(async (action: string, params: any = {}) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('mexc-api', {
        body: { action, ...params }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      return data.data;
    } catch (error: any) {
      console.error('MEXC API Error:', error);
      toast({
        title: "Erro MEXC",
        description: error.message || "Erro ao comunicar com MEXC",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Get account balances
  const getBalances = useCallback(async (): Promise<MEXCBalance[]> => {
    return await callMEXCAPI('get_balances');
  }, [callMEXCAPI]);

  // Get market prices
  const getPrices = useCallback(async (symbols?: string[]): Promise<Record<string, number>> => {
    return await callMEXCAPI('get_prices', { symbols });
  }, [callMEXCAPI]);

  // Place order
  const placeOrder = useCallback(async (orderParams: MEXCOrder) => {
    const result = await callMEXCAPI('place_order', orderParams);
    
    toast({
      title: "Ordem executada",
      description: `${orderParams.side} ${orderParams.quantity} ${orderParams.symbol}`,
    });

    return result;
  }, [callMEXCAPI, toast]);

  // Execute withdrawal
  const withdraw = useCallback(async (withdrawParams: MEXCWithdrawal) => {
    const result = await callMEXCAPI('withdraw', withdrawParams);
    
    toast({
      title: "Saque iniciado",
      description: `${withdrawParams.amount} ${withdrawParams.coin} para ${withdrawParams.address.substring(0, 10)}...`,
    });

    return result;
  }, [callMEXCAPI, toast]);

  // Get withdrawal history
  const getWithdrawHistory = useCallback(async (coin?: string) => {
    return await callMEXCAPI('get_withdraw_history', { coin });
  }, [callMEXCAPI]);

  // Get deposit address
  const getDepositAddress = useCallback(async (coin: string, network?: string) => {
    return await callMEXCAPI('get_deposit_address', { coin, network });
  }, [callMEXCAPI]);

  // Get currency information
  const getCurrencyInfo = useCallback(async () => {
    return await callMEXCAPI('get_currency_info');
  }, [callMEXCAPI]);

  return {
    loading,
    getBalances,
    getPrices,
    placeOrder,
    withdraw,
    getWithdrawHistory,
    getDepositAddress,
    getCurrencyInfo,
  };
};
