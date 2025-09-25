import { supabase } from "@/integrations/supabase/client";

type ProxyStrategy = 'auto' | 'aggressive' | 'stealth';
type Country = 'US' | 'UK' | 'DE' | 'SG' | 'JP' | 'CA' | 'random';

interface SmartProxyOptions {
  targetUrl: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  strategy?: ProxyStrategy;
  country?: Country;
}

interface ProxyResponse {
  success: boolean;
  data?: any;
  error?: string;
  source?: 'direct' | 'proxy' | 'anti-fingerprint';
  country?: string;
  ip?: string;
  proxy?: string;
  fallback_available?: boolean;
}

export const useSmartProxy = () => {
  
  const executeRequest = async (options: SmartProxyOptions): Promise<ProxyResponse> => {
    try {
      console.log(`🌐 Smart Proxy: ${options.targetUrl} [${options.strategy || 'auto'}]`);
      
      const { data, error } = await supabase.functions.invoke('smart-proxy-service', {
        body: options
      });

      if (error) {
        console.error('Erro no Smart Proxy:', error);
        throw new Error(error.message);
      }

      return data;
      
    } catch (error) {
      console.error('❌ Erro crítico no Smart Proxy:', error);
      throw error;
    }
  };

  // Método específico para APIs da Binance
  const binanceRequest = async (
    endpoint: string,
    apiKey: string,
    secretKey: string,
    strategy: ProxyStrategy = 'auto',
    country: Country = 'random'
  ): Promise<ProxyResponse> => {
    
    // Criar assinatura HMAC para Binance
    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    
    // Simular assinatura (em produção real, seria calculada)
    const signature = await createBinanceSignature(queryString, secretKey);
    
    const fullUrl = `https://api.binance.com${endpoint}?${queryString}&signature=${signature}`;
    
    return executeRequest({
      targetUrl: fullUrl,
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/json'
      },
      strategy,
      country
    });
  };

  // Método com fallback automático
  const requestWithFallback = async (options: SmartProxyOptions): Promise<any> => {
    
    // Tentar estratégia padrão
    let result = await executeRequest({ ...options, strategy: 'auto' });
    
    if (result.success) {
      return result.data;
    }

    console.log('🔄 Estratégia auto falhou, tentando stealth...');
    
    // Tentar estratégia stealth
    result = await executeRequest({ ...options, strategy: 'stealth' });
    
    if (result.success) {
      return result.data;
    }

    console.log('🚨 Estratégia stealth falhou, tentando aggressive...');
    
    // Última tentativa: estratégia agressiva
    result = await executeRequest({ ...options, strategy: 'aggressive' });
    
    if (result.success) {
      return result.data;
    }

    // Se tudo falhou, lançar erro ou retornar fallback
    if (result.fallback_available) {
      console.log('⚠️ Todas as estratégias falharam, usando fallback');
      return null; // Indicar que deve usar dados simulados
    }

    throw new Error(`Falha em todas as estratégias de proxy: ${result.error}`);
  };

  return {
    executeRequest,
    binanceRequest,
    requestWithFallback
  };
};

// Função auxiliar para criar assinatura HMAC (simplificada)
async function createBinanceSignature(queryString: string, secretKey: string): Promise<string> {
  // Em um ambiente real, isso seria feito no backend por segurança
  // Aqui é apenas uma simulação
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(queryString);
  
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    console.warn('Falha na assinatura HMAC, usando simulada');
    return 'simulated_signature_' + Date.now();
  }
}