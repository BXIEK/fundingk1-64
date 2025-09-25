import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface OptimizedTransferRequest {
  symbol: string;
  amount: number;
  from_exchange: string;
  to_exchange: string;
  priority?: 'low' | 'medium' | 'high';
  bypass_security?: boolean;
  use_proxy?: boolean;
  api_keys?: {
    [exchange: string]: {
      api_key: string;
      secret_key: string;
      passphrase?: string;
      two_fa_secret?: string;
    }
  };
}

interface TransferResult {
  success: boolean;
  transfer_id?: string;
  execution_time_ms?: number;
  optimizations_applied?: {
    performance: any;
    security_bypassed: string[];
    auth_method: string;
    proxy_used: boolean;
    session_cached: boolean;
  };
  status?: string;
  message?: string;
  error?: string;
}

interface SecurityBypassResult {
  success: boolean;
  bypassed_restrictions: string[];
  proxy_used?: any;
  session_created?: boolean;
  recommendations?: string[];
}

export const useOptimizedTransfer = () => {
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<TransferResult | null>(null);
  const [securityBypassActive, setSecurityBypassActive] = useState(false);
  const { toast } = useToast();

  // Função para testar APIs (Binance + OKX)
  const testConnections = useCallback(async (): Promise<any> => {
    setLoading(true);
    
    try {
      // Teste 1: Verificar conexão Binance
      console.log('🔄 Testando conexão Binance...');
      const binanceTest = await supabase.functions.invoke('test-binance-connection', {
        body: { 
          api_key: localStorage.getItem('binance_api_key'),
          secret_key: localStorage.getItem('binance_secret_key')
        }
      });

      // Teste 2: Verificar saldos OKX  
      console.log('🔄 Testando saldos OKX...');
      const okxBalances = await supabase.functions.invoke('okx-api', {
        body: { 
          action: 'get_balances',
          api_key: localStorage.getItem('okx_api_key'),
          secret_key: localStorage.getItem('okx_secret_key'),
          passphrase: localStorage.getItem('okx_passphrase')
        }
      });

      // Teste 3: Verificar preços OKX
      console.log('🔄 Testando preços OKX...');
      const okxPrices = await supabase.functions.invoke('okx-api', {
        body: { action: 'get_prices' }
      });

      // Teste 4: Portfolio completo
      console.log('🔄 Testando portfolio completo...');
      const portfolio = await supabase.functions.invoke('get-portfolio', {
        body: {
          real_mode: true,
          binance_api_key: localStorage.getItem('binance_api_key'),
          binance_secret_key: localStorage.getItem('binance_secret_key'),
          okx_api_key: localStorage.getItem('okx_api_key'),
          okx_secret_key: localStorage.getItem('okx_secret_key'),
          okx_passphrase: localStorage.getItem('okx_passphrase')
        }
      });

      // Teste 5: Detectar oportunidades
      console.log('🔄 Testando detecção de arbitragem...');
      const opportunities = await supabase.functions.invoke('detect-arbitrage-opportunities');

      const results = {
        binance: binanceTest.data || binanceTest.error,
        okx_balances: okxBalances.data || okxBalances.error, 
        okx_prices: okxPrices.data || okxPrices.error,
        portfolio: portfolio.data || portfolio.error,
        opportunities: opportunities.data || opportunities.error
      };

      console.log('📊 Resultados completos dos testes:', results);

      toast({
        title: "🧪 Testes de API Concluídos",
        description: `
          Binance: ${results.binance?.success ? '✅ OK' : '❌ Erro'}
          OKX Saldos: ${results.okx_balances?.success ? '✅ OK' : '❌ Erro'}  
          OKX Preços: ${results.okx_prices?.success ? '✅ OK' : '❌ Erro'}
          Portfolio: ${results.portfolio?.success ? '✅ OK' : '❌ Erro'}
          Arbitragem: ${results.opportunities?.success ? '✅ OK' : '❌ Erro'}
        `,
        duration: 15000
      });

      return results;

    } catch (error) {
      console.error('Erro nos testes de API:', error);
      toast({
        title: "❌ Erro nos Testes",
        description: error.message || "Erro ao executar testes das APIs",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Função para ativar bypass de segurança
  const activateSecurityBypass = useCallback(async (
    exchange: string,
    operation: string,
    bypassType: 'geographic' | '2fa' | 'rate_limit' | 'session' | 'all',
    apiCredentials?: any
  ): Promise<SecurityBypassResult | null> => {
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('security-bypass-manager', {
        body: {
          exchange,
          operation,
          bypass_type: bypassType,
          user_id: "demo-user-id", // Em produção, pegar da sessão
          api_credentials: apiCredentials
        }
      });

      if (error) throw error;

      setSecurityBypassActive(true);
      
      toast({
        title: "🛡️ Bypass de Segurança Ativado",
        description: `Bypassed: ${data.bypass_results.bypassed_restrictions.join(', ')}`,
        duration: 8000
      });

      return data.bypass_results;

    } catch (error) {
      console.error('Erro ao ativar bypass de segurança:', error);
      toast({
        title: "Erro no Bypass",
        description: error.message || "Erro ao ativar bypass de segurança",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Função para executar transferência otimizada
  const executeOptimizedTransfer = useCallback(async (
    request: OptimizedTransferRequest
  ): Promise<TransferResult | null> => {
    if (!request.symbol || !request.amount || !request.from_exchange || !request.to_exchange) {
      toast({
        title: "Dados Inválidos",
        description: "Todos os campos são obrigatórios para transferência otimizada",
        variant: "destructive"
      });
      return null;
    }

    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('smart-transfer-optimizer', {
        body: {
          user_id: "demo-user-id", // Em produção, pegar da sessão
          symbol: request.symbol,
          amount: request.amount,
          from_exchange: request.from_exchange,
          to_exchange: request.to_exchange,
          priority: request.priority || 'medium',
          bypass_security: request.bypass_security || false,
          use_proxy: request.use_proxy || false,
          api_keys: request.api_keys || {}
        }
      });

      if (error) throw error;

      const result: TransferResult = {
        success: data.success,
        transfer_id: data.transfer_id,
        execution_time_ms: data.execution_time_ms,
        optimizations_applied: data.optimizations_applied,
        status: data.status,
        message: data.message
      };

      setLastResult(result);

      // Toast com informações das otimizações
      const optimizations = data.optimizations_applied || {};
      const optimizationsList = [
        optimizations.security_bypassed?.length > 0 && `Bypass: ${optimizations.security_bypassed.join(', ')}`,
        optimizations.proxy_used && 'Proxy Ativo',
        optimizations.session_cached && 'Sessão Otimizada',
        data.execution_time_ms && `Tempo: ${data.execution_time_ms}ms`
      ].filter(Boolean);

      toast({
        title: result.success ? "✅ Transferência Real Executada" : "❌ Transferência Falhou",
        description: result.success 
          ? `${result.message || 'Transferência executada com sucesso nas APIs das exchanges'}\n${optimizationsList.length > 0 ? `Otimizações: ${optimizationsList.join(', ')}` : 'Sem otimizações aplicadas'}`
          : result.message || 'Falha na execução da transferência real',
        duration: result.success ? 10000 : 6000,
        variant: result.success ? "default" : "destructive"
      });

      return result;

    } catch (error) {
      console.error('Erro na transferência otimizada:', error);
      
      const errorResult: TransferResult = {
        success: false,
        error: error.message || "Erro na transferência otimizada"
      };
      
      setLastResult(errorResult);
      
      toast({
        title: "Erro na Transferência",
        description: errorResult.error,
        variant: "destructive"
      });
      
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Função para verificar status de bypass ativo
  const checkBypassStatus = useCallback(() => {
    return {
      isActive: securityBypassActive,
      lastResult: lastResult
    };
  }, [securityBypassActive, lastResult]);

  // Função para desativar bypass de segurança
  const deactivateSecurityBypass = useCallback(() => {
    setSecurityBypassActive(false);
    toast({
      title: "🛡️ Bypass Desativado",
      description: "Voltando aos protocolos de segurança padrão",
      duration: 3000
    });
  }, [toast]);

  // Função para obter recomendações de otimização
  const getOptimizationRecommendations = useCallback((
    fromExchange: string,
    toExchange: string,
    amount: number
  ) => {
    const recommendations = [];

    // Recomendações baseadas no valor
    if (amount > 10000) {
      recommendations.push({
        type: 'security',
        message: 'Para valores altos, considere ativar bypass de segurança completo',
        action: 'activate_full_bypass'
      });
    }

    // Recomendações baseadas nas exchanges
    const highSecurityExchanges = ['binance', 'okx'];
    if (highSecurityExchanges.includes(fromExchange.toLowerCase()) || 
        highSecurityExchanges.includes(toExchange.toLowerCase())) {
      recommendations.push({
        type: 'performance',
        message: 'Exchange com alta segurança detectada - recomendado usar proxy',
        action: 'enable_proxy'
      });
    }

    // Recomendações de horário
    const currentHour = new Date().getUTCHours();
    if (currentHour >= 0 && currentHour <= 6) {
      recommendations.push({
        type: 'timing',
        message: 'Horário de baixa volatilidade - ideal para transferências grandes',
        action: 'increase_priority'
      });
    }

    return recommendations;
  }, []);

  return {
    loading,
    lastResult,
    securityBypassActive,
    testConnections,
    executeOptimizedTransfer,
    activateSecurityBypass,
    deactivateSecurityBypass,
    checkBypassStatus,
    getOptimizationRecommendations
  };
};