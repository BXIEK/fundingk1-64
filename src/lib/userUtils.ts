import { supabase } from "@/integrations/supabase/client";

/**
 * Obtém o ID do usuário real ou gera um baseado nas credenciais API
 * Prioriza o usuário autenticado via Supabase, caso contrário usa as API keys
 */
export const getUserId = async (): Promise<string> => {
  try {
    // Tentar obter o usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      console.log('Usando ID do usuário autenticado:', user.id);
      return user.id;
    }
  } catch (error) {
    console.log('Erro ao obter usuário autenticado:', error);
  }

  // Se não há usuário autenticado, gerar ID baseado nas credenciais API
  const binanceCredentials = localStorage.getItem('binance_credentials');
  const pionexCredentials = localStorage.getItem('pionex_credentials');
  
  if (binanceCredentials) {
    try {
      const binanceCreds = JSON.parse(binanceCredentials);
      const apiKey = binanceCreds.apiKey;
      // Gerar hash SHA-256 da API key e converter para UUID válido
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      // Converter os primeiros 32 caracteres do hash em formato UUID válido
      const userId = `${hashHex.substring(0,8)}-${hashHex.substring(8,12)}-${hashHex.substring(12,16)}-${hashHex.substring(16,20)}-${hashHex.substring(20,32)}`;
      console.log('Usando ID baseado no hash da API key da Binance:', userId);
      return userId;
    } catch (error) {
      console.log('Erro ao processar credenciais Binance:', error);
    }
  }
  
  if (pionexCredentials) {
    try {
      const pionexCreds = JSON.parse(pionexCredentials);
      const apiKey = pionexCreds.apiKey;
      // Gerar hash SHA-256 da API key e converter para UUID válido
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      // Converter os primeiros 32 caracteres do hash em formato UUID válido
      const userId = `${hashHex.substring(0,8)}-${hashHex.substring(8,12)}-${hashHex.substring(12,16)}-${hashHex.substring(16,20)}-${hashHex.substring(20,32)}`;
      console.log('Usando ID baseado no hash da API key da Pionex:', userId);
      return userId;
    } catch (error) {
      console.log('Erro ao processar credenciais Pionex:', error);
    }
  }
  
  // Erro: nenhuma credencial válida encontrada
  throw new Error('Nenhuma credencial válida encontrada. Configure suas chaves de API nas configurações.');
};