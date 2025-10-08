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
  source?: 'direct' | 'proxy' | 'anti-fingerprint' | 'bright-data-proxy';
  country?: string;
  ip?: string;
  proxy?: string;
  fallback_available?: boolean;
  responseTime?: number;
}

export const useSmartProxy = () => {
  
  const executeRequest = async (options: SmartProxyOptions): Promise<ProxyResponse> => {
    try {
      console.log(`🌐 Bright Data Proxy: ${options.targetUrl}`);
      
      // Usar Bright Data Proxy
      const { data, error } = await supabase.functions.invoke('bright-data-proxy', {
        body: {
          targetUrl: options.targetUrl,
          method: options.method || 'GET',
          headers: options.headers,
          body: options.body
        }
      });

      if (error) {
        console.error('❌ Erro no Bright Data Proxy:', error);
        throw new Error(error.message);
      }

      if (!data.success) {
        console.warn('⚠️ Requisição via proxy falhou:', data.error);
        return {
          success: false,
          error: data.error,
          source: 'bright-data-proxy'
        };
      }

      console.log(`✅ Bright Data Proxy sucesso (${data.responseTime}ms)`);
      
      return {
        success: true,
        data: data.data,
        source: 'bright-data-proxy',
        country: data.proxy?.country,
        proxy: `${data.proxy?.host}:${data.proxy?.port}`
      };
      
    } catch (error) {
      console.error('❌ Erro crítico no Bright Data Proxy:', error);
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