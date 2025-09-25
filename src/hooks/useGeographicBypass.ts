import { supabase } from "@/integrations/supabase/client";

interface BypassOptions {
  targetUrl: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
}

export const useGeographicBypass = () => {
  const bypassRequest = async (options: BypassOptions) => {
    try {
      console.log(`🌐 Iniciando bypass para: ${options.targetUrl}`);
      
      const { data, error } = await supabase.functions.invoke('geographic-bypass', {
        body: options
      });

      if (error) {
        console.error('Erro no bypass:', error);
        throw new Error(error.message);
      }

      if (data.success) {
        console.log('✅ Bypass realizado com sucesso');
        return {
          success: true,
          data: data.data,
          source: data.source || 'direct'
        };
      } else {
        console.warn('⚠️ Bypass falhou, usando fallback');
        return {
          success: false,
          error: data.error,
          fallback: data.fallback
        };
      }
    } catch (error) {
      console.error('❌ Erro crítico no bypass:', error);
      throw error;
    }
  };

  return { bypassRequest };
};