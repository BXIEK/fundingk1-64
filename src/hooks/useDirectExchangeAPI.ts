import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
interface ExchangeCredentials {
  binance_api_key?: string;
  binance_secret_key?: string;
  okx_api_key?: string;
  okx_secret_key?: string;
  okx_passphrase?: string;
}

export const useDirectExchangeAPI = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Obter saldos da Binance via Edge Function (evita CORS/bloqueios)
  const getBinanceBalances = async (credentials: ExchangeCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-binance-connection', {
        body: { apiKey: credentials.binance_api_key, secretKey: credentials.binance_secret_key }
      });
      if (error) throw error;
      setIsLoading(false);
      return data;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Erro ao consultar Binance');
      return { success: false, error: err.message || 'Erro ao consultar Binance' };
    }
  };
  // Executar saque da Binance via Edge Function
  const executeBinanceWithdrawal = async (
    credentials: ExchangeCredentials,
    coin: string,
    address: string,
    amount: number,
    network?: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('binance-withdrawal', {
        body: { 
          apiKey: credentials.binance_api_key, 
          secretKey: credentials.binance_secret_key,
          coin,
          address,
          amount,
          network
        }
      });
      if (error) throw error;
      setIsLoading(false);
      return data;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Erro ao realizar saque da Binance');
      return { success: false, error: err.message || 'Erro ao realizar saque da Binance' };
    }
  };

  // Obter saldos da OKX via Edge Function
  const getOKXBalances = async (credentials: ExchangeCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('okx-api', {
        body: { 
          action: 'get_balances',
          api_key: credentials.okx_api_key, 
          secret_key: credentials.okx_secret_key,
          passphrase: credentials.okx_passphrase
        }
      });
      if (error) throw error;
      setIsLoading(false);
      return data;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Erro ao consultar OKX');
      return { success: false, error: err.message || 'Erro ao consultar OKX' };
    }
  };

  // Executar saque da OKX via Edge Function
  const executeOKXWithdrawal = async (
    credentials: ExchangeCredentials,
    ccy: string,
    amt: string,
    dest: '3' | '4',
    toAddr: string,
    fee: string,
    chain?: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('okx-withdrawal', {
        body: { 
          apiKey: credentials.okx_api_key, 
          secretKey: credentials.okx_secret_key,
          passphrase: credentials.okx_passphrase,
          ccy,
          amt,
          dest,
          toAddr,
          fee,
          chain
        }
      });
      if (error) throw error;
      setIsLoading(false);
      return data;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Erro ao realizar saque da OKX');
      return { success: false, error: err.message || 'Erro ao realizar saque da OKX' };
    }
  };

  // Transferência interna OKX via Edge Function
  const okxInternalTransfer = async (
    credentials: ExchangeCredentials,
    ccy: string,
    amt: string,
    from: string,
    to: string
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke('okx-internal-transfer', {
        body: { 
          apiKey: credentials.okx_api_key, 
          secretKey: credentials.okx_secret_key,
          passphrase: credentials.okx_passphrase,
          ccy,
          amt,
          from,
          to
        }
      });
      if (error) throw error;
      setIsLoading(false);
      return data;
    } catch (err: any) {
      setIsLoading(false);
      setError(err.message || 'Erro ao realizar transferência interna OKX');
      return { success: false, error: err.message || 'Erro ao realizar transferência interna OKX' };
    }
  };

  return {
    isLoading,
    error,
    // Binance
    getBinanceBalances,
    executeBinanceWithdrawal,
    // OKX
    getOKXBalances,
    executeOKXWithdrawal,
    okxInternalTransfer,
  };
};
