import { useState } from 'react';
import CryptoJS from 'crypto-js';

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

  // ==================== BINANCE ====================
  const binanceRequest = async (
    endpoint: string,
    credentials: ExchangeCredentials,
    params: Record<string, any> = {}
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const timestamp = Date.now();
      const queryString = new URLSearchParams({
        ...params,
        timestamp: timestamp.toString(),
      }).toString();

      // Gerar assinatura HMAC SHA256
      const signature = CryptoJS.HmacSHA256(
        queryString,
        credentials.binance_secret_key || ''
      ).toString();

      const url = `https://api.binance.com${endpoint}?${queryString}&signature=${signature}`;

      console.log('🌐 Direct Binance Request from CLIENT IP:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-MBX-APIKEY': credentials.binance_api_key || '',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.msg || `Binance API Error: ${response.status}`);
      }

      const data = await response.json();
      setIsLoading(false);
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Binance Direct Request Error:', err);
      setError(err.message);
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  };

  // Obter saldos da Binance
  const getBinanceBalances = async (credentials: ExchangeCredentials) => {
    return await binanceRequest('/api/v3/account', credentials);
  };

  // Executar saque da Binance
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
      const timestamp = Date.now();
      const params: Record<string, any> = {
        coin,
        address,
        amount,
        timestamp,
      };

      if (network) {
        params.network = network;
      }

      const queryString = new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString();

      const signature = CryptoJS.HmacSHA256(
        queryString,
        credentials.binance_secret_key || ''
      ).toString();

      const url = `https://api.binance.com/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signature}`;

      console.log('💸 Direct Binance Withdrawal from CLIENT IP');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'X-MBX-APIKEY': credentials.binance_api_key || '',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.msg || `Withdrawal failed: ${response.status}`);
      }

      const data = await response.json();
      setIsLoading(false);
      return { success: true, data };
    } catch (err: any) {
      console.error('❌ Binance Withdrawal Error:', err);
      setError(err.message);
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  };

  // ==================== OKX ====================
  const okxRequest = async (
    method: string,
    endpoint: string,
    credentials: ExchangeCredentials,
    body?: any
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const timestamp = new Date().toISOString();
      const bodyStr = body ? JSON.stringify(body) : '';
      const preHash = timestamp + method + endpoint + bodyStr;

      // Gerar assinatura HMAC SHA256 para OKX
      const signature = CryptoJS.HmacSHA256(
        preHash,
        credentials.okx_secret_key || ''
      ).toString(CryptoJS.enc.Base64);

      const url = `https://www.okx.com${endpoint}`;

      console.log('🌐 Direct OKX Request from CLIENT IP:', url);

      const response = await fetch(url, {
        method,
        headers: {
          'OK-ACCESS-KEY': credentials.okx_api_key || '',
          'OK-ACCESS-SIGN': signature,
          'OK-ACCESS-TIMESTAMP': timestamp,
          'OK-ACCESS-PASSPHRASE': credentials.okx_passphrase || '',
          'Content-Type': 'application/json',
        },
        body: bodyStr || undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.msg || `OKX API Error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.code !== '0') {
        throw new Error(data.msg || `OKX Error Code: ${data.code}`);
      }

      setIsLoading(false);
      return { success: true, data: data.data };
    } catch (err: any) {
      console.error('❌ OKX Direct Request Error:', err);
      setError(err.message);
      setIsLoading(false);
      return { success: false, error: err.message };
    }
  };

  // Obter saldos da OKX
  const getOKXBalances = async (credentials: ExchangeCredentials) => {
    return await okxRequest('GET', '/api/v5/account/balance', credentials);
  };

  // Executar saque da OKX
  const executeOKXWithdrawal = async (
    credentials: ExchangeCredentials,
    ccy: string,
    amt: string,
    dest: '3' | '4', // 3=internal, 4=on-chain
    toAddr: string,
    fee: string,
    chain?: string
  ) => {
    const body: any = {
      ccy,
      amt,
      dest,
      toAddr,
      fee,
    };

    if (chain) {
      body.chain = chain;
    }

    return await okxRequest('POST', '/api/v5/asset/withdrawal', credentials, body);
  };

  // Transferência interna OKX (Trading -> Funding)
  const okxInternalTransfer = async (
    credentials: ExchangeCredentials,
    ccy: string,
    amt: string,
    from: string,
    to: string
  ) => {
    const body = {
      ccy,
      amt,
      from,
      to,
      type: '0', // 0 = internal transfer
    };

    return await okxRequest('POST', '/api/v5/asset/transfer', credentials, body);
  };

  return {
    isLoading,
    error,
    // Binance
    getBinanceBalances,
    executeBinanceWithdrawal,
    binanceRequest,
    // OKX
    getOKXBalances,
    executeOKXWithdrawal,
    okxInternalTransfer,
    okxRequest,
  };
};
