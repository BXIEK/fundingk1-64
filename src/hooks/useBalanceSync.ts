import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook para sincronizar saldos entre o banco de dados e as exchanges
 * Força atualização dos saldos após operações que modificam os valores
 */
export const useBalanceSync = () => {
  const { toast } = useToast();

  /**
   * Força atualização completa dos saldos de todas as exchanges
   */
  const syncAllBalances = useCallback(async () => {
    try {
      console.log('🔄 Iniciando sincronização completa de saldos...');
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.warn('⚠️ Usuário não autenticado');
        return false;
      }

      // Forçar refresh do portfolio (que sincroniza com exchanges)
      const { data, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          user_id: session.user.id,
          real_mode: true,
          force_refresh: true
        }
      });

      if (error) {
        console.error('❌ Erro ao sincronizar saldos:', error);
        return false;
      }

      console.log('✅ Saldos sincronizados com sucesso');
      
      // Disparar evento personalizado para que outros componentes saibam que os saldos foram atualizados
      window.dispatchEvent(new CustomEvent('balances-synced', { 
        detail: { timestamp: Date.now() } 
      }));

      return true;
    } catch (error: any) {
      console.error('❌ Erro na sincronização:', error);
      return false;
    }
  }, []);

  /**
   * Sincroniza saldos de uma exchange específica
   */
  const syncExchangeBalance = useCallback(async (exchange: 'binance' | 'okx') => {
    try {
      console.log(`🔄 Sincronizando saldos da ${exchange}...`);
      
      // Força refresh completo (pode ser otimizado no futuro para exchange específica)
      const success = await syncAllBalances();
      
      if (success) {
        toast({
          title: "✅ Saldos Atualizados",
          description: `Saldos da ${exchange} sincronizados com sucesso`,
        });
      }
      
      return success;
    } catch (error: any) {
      console.error(`❌ Erro ao sincronizar ${exchange}:`, error);
      return false;
    }
  }, [syncAllBalances, toast]);

  /**
   * Sincroniza após uma operação de conversão/swap
   */
  const syncAfterConversion = useCallback(async (exchange: string, fromToken: string, toToken: string) => {
    console.log(`🔄 Sincronizando após conversão: ${fromToken} → ${toToken} na ${exchange}`);
    
    // Aguardar 2 segundos para a exchange processar a ordem
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return await syncAllBalances();
  }, [syncAllBalances]);

  /**
   * Sincroniza após uma transferência entre exchanges
   */
  const syncAfterTransfer = useCallback(async (fromExchange: string, toExchange: string, symbol: string) => {
    console.log(`🔄 Sincronizando após transferência: ${symbol} de ${fromExchange} → ${toExchange}`);
    
    // Aguardar 5 segundos para a transferência ser processada
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return await syncAllBalances();
  }, [syncAllBalances]);

  /**
   * Sincroniza após execução de arbitragem
   */
  const syncAfterArbitrage = useCallback(async () => {
    console.log('🔄 Sincronizando após operação de arbitragem...');
    
    // Aguardar 3 segundos para as ordens serem processadas
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return await syncAllBalances();
  }, [syncAllBalances]);

  return {
    syncAllBalances,
    syncExchangeBalance,
    syncAfterConversion,
    syncAfterTransfer,
    syncAfterArbitrage
  };
};
