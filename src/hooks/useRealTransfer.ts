import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RealTransferRequest {
  fromExchange: 'binance' | 'okx';
  toExchange: 'binance' | 'okx';
  asset: string;
  amount: number;
  network?: string;
}

interface RealTransferResult {
  success: boolean;
  transfer?: {
    id: string;
    asset: string;
    amount: number;
    from_exchange: string;
    to_exchange: string;
    network: string;
    withdrawal_id: string;
    deposit_address: string;
    status: string;
    estimated_arrival_minutes: number;
    withdrawal_fee: number;
    tx_url?: string;
  };
  message?: string;
  error?: string;
}

export const useRealTransfer = () => {
  const [loading, setLoading] = useState(false);
  const [lastTransfer, setLastTransfer] = useState<RealTransferResult | null>(null);
  const { toast } = useToast();

  // Função para obter credenciais do localStorage
  const getCredentials = useCallback(() => {
    // Binance
    const binanceCredsStr = localStorage.getItem('binance_credentials');
    const binanceCreds = binanceCredsStr ? JSON.parse(binanceCredsStr) : null;
    const binanceApiKey = binanceCreds?.apiKey || localStorage.getItem('binance_api_key');
    const binanceSecretKey = binanceCreds?.secretKey || localStorage.getItem('binance_secret_key');

    // OKX
    const okxCredsStr = localStorage.getItem('okx_credentials');
    const okxCreds = okxCredsStr ? JSON.parse(okxCredsStr) : null;
    const okxApiKey = okxCreds?.apiKey || localStorage.getItem('okx_api_key');
    const okxSecretKey = okxCreds?.secretKey || localStorage.getItem('okx_secret_key');
    const okxPassphrase = okxCreds?.passphrase || localStorage.getItem('okx_passphrase');

    return {
      binanceApiKey,
      binanceSecretKey,
      okxApiKey,
      okxSecretKey,
      okxPassphrase
    };
  }, []);

  // Função para validar credenciais
  const validateCredentials = useCallback((request: RealTransferRequest) => {
    const creds = getCredentials();

    // Verificar credenciais da exchange de origem
    if (request.fromExchange === 'binance') {
      if (!creds.binanceApiKey || !creds.binanceSecretKey) {
        throw new Error('Credenciais da Binance não configuradas. Configure na seção de APIs.');
      }
    } else if (request.fromExchange === 'okx') {
      if (!creds.okxApiKey || !creds.okxSecretKey || !creds.okxPassphrase) {
        throw new Error('Credenciais da OKX não configuradas. Configure na seção de APIs.');
      }
    }

    // Verificar credenciais da exchange de destino
    if (request.toExchange === 'binance') {
      if (!creds.binanceApiKey || !creds.binanceSecretKey) {
        throw new Error('Credenciais da Binance não configuradas. Configure na seção de APIs.');
      }
    } else if (request.toExchange === 'okx') {
      if (!creds.okxApiKey || !creds.okxSecretKey || !creds.okxPassphrase) {
        throw new Error('Credenciais da OKX não configuradas. Configure na seção de APIs.');
      }
    }

    return creds;
  }, [getCredentials]);

  // Função principal para executar transferência REAL
  const executeRealTransfer = useCallback(async (
    request: RealTransferRequest
  ): Promise<RealTransferResult | null> => {
    setLoading(true);

    try {
      // Validar campos obrigatórios
      if (!request.fromExchange || !request.toExchange || !request.asset || !request.amount) {
        throw new Error('Todos os campos são obrigatórios');
      }

      if (request.fromExchange === request.toExchange) {
        throw new Error('Exchange de origem e destino não podem ser iguais');
      }

      if (request.amount <= 0) {
        throw new Error('Valor deve ser maior que zero');
      }

      // Validar e obter credenciais
      const creds = validateCredentials(request);

      // Obter user_id da sessão
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log(`🚀 Iniciando transferência REAL: ${request.amount} ${request.asset} de ${request.fromExchange} → ${request.toExchange}`);

      // Chamar a função auto-transfer-crypto para transferência real
      const { data, error } = await supabase.functions.invoke('auto-transfer-crypto', {
        body: {
          userId: user.id,
          fromExchange: request.fromExchange,
          toExchange: request.toExchange,
          asset: request.asset,
          amount: request.amount,
          network: request.network || 'TRC20', // Default TRC20 para USDT
          binanceApiKey: creds.binanceApiKey,
          binanceSecretKey: creds.binanceSecretKey,
          okxApiKey: creds.okxApiKey,
          okxSecretKey: creds.okxSecretKey,
          okxPassphrase: creds.okxPassphrase
        }
      });

      if (error) {
        throw new Error(error.message || 'Erro na transferência');
      }

      const result: RealTransferResult = {
        success: data.success,
        transfer: data.transfer,
        message: data.message
      };

      setLastTransfer(result);

      if (result.success && result.transfer) {
        toast({
          title: "✅ Transferência Iniciada com Sucesso",
          description: `${result.message}\n\nWithdrawal ID: ${result.transfer.withdrawal_id}\nTempo estimado: ~${result.transfer.estimated_arrival_minutes} minutos\nTaxa: ${result.transfer.withdrawal_fee} ${request.asset}`,
          duration: 15000
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Erro na transferência real:', error);
      
      const errorResult: RealTransferResult = {
        success: false,
        error: error.message || 'Erro desconhecido na transferência'
      };

      setLastTransfer(errorResult);

      toast({
        title: "❌ Erro na Transferência",
        description: errorResult.error,
        variant: "destructive",
        duration: 8000
      });

      return errorResult;

    } finally {
      setLoading(false);
    }
  }, [toast, validateCredentials]);

  // Função para verificar status de transferência
  const checkTransferStatus = useCallback(async (transferId: string) => {
    try {
      const { data, error } = await supabase
        .from('crypto_transfers')
        .select('*')
        .eq('id', transferId)
        .single();

      if (error) throw error;

      return {
        success: true,
        transfer: data
      };

    } catch (error) {
      console.error('Erro ao verificar status:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }, []);

  // Função para listar histórico de transferências
  const getTransferHistory = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('crypto_transfers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return {
        success: true,
        transfers: data
      };

    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      return {
        success: false,
        error: error.message,
        transfers: []
      };
    }
  }, []);

  return {
    loading,
    lastTransfer,
    executeRealTransfer,
    checkTransferStatus,
    getTransferHistory
  };
};
