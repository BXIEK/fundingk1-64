import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/userUtils";

interface OptimizedTransferRequest {
  symbol: string;
  amount: number;
  from_exchange: string;
  to_exchange: string;
  network?: string;
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
      // Suporta formatos antigos e novos de armazenamento
      const binanceCredsStr = localStorage.getItem('binance_credentials');
      const binanceCreds = binanceCredsStr ? JSON.parse(binanceCredsStr) : null;
      const binanceApiKey = binanceCreds?.apiKey || localStorage.getItem('binance_api_key');
      const binanceSecretKey = binanceCreds?.secretKey || localStorage.getItem('binance_secret_key');
      
      console.log('🔍 Credenciais Binance:', { 
        hasApiKey: !!binanceApiKey, 
        hasSecret: !!binanceSecretKey,
        apiKeyStart: binanceApiKey ? binanceApiKey.substring(0, 8) + '...' : '—',
        secretStart: binanceSecretKey ? binanceSecretKey.substring(0, 8) + '...' : '—'
      });

      // Verificar se credenciais da Binance existem
      if (!binanceApiKey || !binanceSecretKey) {
        toast({
          title: "⚠️ Credenciais Não Configuradas",
          description: "Configure suas credenciais da Binance e OKX na seção 'Configuração de APIs' antes de testar as conexões.",
          variant: "destructive",
          duration: 8000
        });
        return null;
      }
      
      const binanceTest = await supabase.functions.invoke('test-binance-connection', {
        body: { 
          apiKey: binanceApiKey,
          secretKey: binanceSecretKey
        }
      });

      // Teste 2: Verificar saldos OKX  
      console.log('🔄 Testando saldos OKX...');
      // Suporta formatos antigos e novos de armazenamento
      const okxCredsStr = localStorage.getItem('okx_credentials');
      const okxCreds = okxCredsStr ? JSON.parse(okxCredsStr) : null;
      const okxApiKey = okxCreds?.apiKey || localStorage.getItem('okx_api_key');
      const okxSecretKey = okxCreds?.secretKey || localStorage.getItem('okx_secret_key');
      const okxPassphrase = okxCreds?.passphrase || localStorage.getItem('okx_passphrase');
      
      console.log('🔍 Credenciais OKX:', { 
        hasApiKey: !!okxApiKey, 
        hasSecret: !!okxSecretKey,
        hasPassphrase: !!okxPassphrase,
        apiKeyStart: okxApiKey ? okxApiKey.substring(0, 8) + '...' : '—'
      });

      // Verificação opcional para OKX (pode não estar configurada)
      let okxBalances = { data: { success: false, error: 'Credenciais OKX não configuradas' } };
      if (okxApiKey && okxSecretKey && okxPassphrase) {
        okxBalances = await supabase.functions.invoke('okx-api', {
          body: { 
            action: 'get_balances',
            api_key: okxApiKey,
            secret_key: okxSecretKey,
            passphrase: okxPassphrase
          }
        });
      }

      // Teste 3: Verificar preços OKX
      console.log('🔄 Testando preços OKX...');
      const okxPrices = await supabase.functions.invoke('okx-api', {
        body: { 
          action: 'get_prices',
          api_key: okxApiKey,
          secret_key: okxSecretKey,
          passphrase: okxPassphrase
        }
      });

      // Teste 4: Portfolio completo
      console.log('🔄 Testando portfolio completo...');
      const userId = await getUserId();
      const portfolio = await supabase.functions.invoke('get-portfolio', {
        body: {
          user_id: userId,
          real_mode: true,
          binance_api_key: binanceApiKey,
          binance_secret_key: binanceSecretKey,
          okx_api_key: okxApiKey,
          okx_secret_key: okxSecretKey,
          okx_passphrase: okxPassphrase
        }
      });

      // Teste 5: Detectar oportunidades
      console.log('🔄 Testando detecção de arbitragem...');
      const opportunities = await supabase.functions.invoke('detect-arbitrage-opportunities', {
        body: {
          type: 'cross_exchange',
          trading_mode: 'real',
          binance_api_key: binanceApiKey,
          binance_secret_key: binanceSecretKey,
          okx_api_key: okxApiKey,
          okx_secret_key: okxSecretKey,
          okx_passphrase: okxPassphrase
        }
      });

      // Processar resultados corretamente
      const processOkxPrices = (pricesData: any) => {
        console.log('🔍 Processando preços OKX:', pricesData);
        if (pricesData?.prices && typeof pricesData.prices === 'object') {
          return Object.keys(pricesData.prices).length;
        }
        if (pricesData && typeof pricesData === 'object' && !pricesData.error) {
          return Object.keys(pricesData).length;
        }
        return 0;
      };

      const processOkxBalances = (balancesData: any) => {
        console.log('🔍 Processando saldos OKX:', balancesData);
        if (balancesData?.balances && Array.isArray(balancesData.balances)) {
          return balancesData.balances.filter((b: any) => parseFloat(b.availBal || b.bal || 0) > 0).length;
        }
        if (balancesData?.data && Array.isArray(balancesData.data)) {
          return balancesData.data.filter((b: any) => parseFloat(b.availBal || b.bal || 0) > 0).length;
        }
        return 0;
      };

      const processBinanceTest = (binanceData: any) => {
        console.log('🔍 Processando teste Binance:', binanceData);
        if (binanceData?.success) return { success: true };
        if (binanceData?.error) return { success: false, error: binanceData.error };
        return { success: false, error: 'Erro desconhecido' };
      };

      const results = {
        binance: processBinanceTest(binanceTest.data || binanceTest.error),
        okx_balances: okxBalances.data || (okxBalances as any).error, 
        okx_prices: okxPrices.data || okxPrices.error,
        portfolio: portfolio.data || portfolio.error,
        opportunities: opportunities.data || opportunities.error,
        // Contadores processados
        okx_prices_count: processOkxPrices(okxPrices.data),
        okx_balances_count: processOkxBalances(okxBalances.data),
        // Erros específicos
        binance_error: binanceTest.error?.message || (binanceTest.data?.error),
        okx_balances_error: (okxBalances as any).error?.message || (okxBalances.data?.error === 'Credenciais OKX não configuradas' ? okxBalances.data.error : undefined),
        okx_prices_error: okxPrices.error?.message
      };

      console.log('📊 Resultados completos dos testes:', results);
      console.log('🔍 Detalhes OKX Preços:', results.okx_prices_count, 'pares encontrados');
      console.log('🔍 Detalhes OKX Saldos:', results.okx_balances_count, 'saldos encontrados');
      console.log('🔍 Erro Binance:', results.binance_error);

      toast({
        title: "🧪 Testes de API Concluídos",
        description: `
          Binance: ${results.binance?.success ? '✅ OK' : `❌ ${results.binance_error || 'Erro'}`}
          OKX Saldos: ${results.okx_balances?.success ? `✅ OK (${results.okx_balances_count} saldos)` : `❌ ${results.okx_balances_error || 'Erro'}`}  
          OKX Preços: ${results.okx_prices?.success ? `✅ OK (${results.okx_prices_count} pares)` : `❌ ${results.okx_prices_error || 'Erro'}`}
          Portfolio: ${results.portfolio?.success ? '✅ OK' : '❌ Erro'}
          Arbitragem: ${results.opportunities?.success ? '✅ OK' : '❌ Erro'}
        `,
        duration: 20000
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

      // Determinar se é realmente uma operação real ou simulação
      const isRealOperation = data.optimizations_applied?.real_apis_used || false;
      const isSimulation = data.message?.includes('simulado') || data.message?.includes('simulação') || !isRealOperation;
      
      toast({
        title: result.success 
          ? (isSimulation ? "🧪 Transferência Simulada Executada" : "✅ Transferência Real Executada")
          : "❌ Transferência Falhou",
        description: result.success 
          ? `${result.message || (isSimulation ? 'Transferência simulada com sucesso (modo demo)' : 'Transferência executada com sucesso nas APIs das exchanges')}\n${optimizationsList.length > 0 ? `Otimizações: ${optimizationsList.join(', ')}` : 'Sem otimizações aplicadas'}${isSimulation ? '\n⚠️ ATENÇÃO: Nenhum dinheiro real foi movimentado' : ''}`
          : result.message || 'Falha na execução da transferência real',
        duration: result.success ? 10000 : 6000,
        variant: result.success ? (isSimulation ? "default" : "default") : "destructive"
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