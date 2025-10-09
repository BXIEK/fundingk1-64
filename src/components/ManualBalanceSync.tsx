import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

export function ManualBalanceSync() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const syncOKXBalances = async () => {
    setSyncing(true);
    setResult(null);

    try {
      // Buscar credenciais do localStorage
      const okxApiKey = localStorage.getItem('okx_api_key');
      const okxSecretKey = localStorage.getItem('okx_secret_key');
      const okxPassphrase = localStorage.getItem('okx_passphrase');

      if (!okxApiKey || !okxSecretKey || !okxPassphrase) {
        throw new Error('Credenciais da OKX não configuradas');
      }

      // Buscar user_id
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      console.log('🔄 Sincronizando saldos completos da OKX...');

      const { data, error } = await supabase.functions.invoke('sync-okx-all-balances', {
        body: {
          userId: user.id,
          okxApiKey,
          okxSecretKey,
          okxPassphrase
        }
      });

      if (error) throw error;

      console.log('✅ Sincronização completa:', data);
      setResult(data);

      toast({
        title: "✅ Sincronização concluída",
        description: `${data.combined?.length || 0} ativos sincronizados da OKX`,
      });

      // Recarregar página para atualizar portfolio
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      toast({
        title: "❌ Erro na sincronização",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Sincronização Manual de Saldos</h3>
          <p className="text-sm text-muted-foreground">
            Sincroniza todos os saldos da OKX (Trading + Funding) com o sistema.
            Use isto se suspeitar que há saldo não detectado.
          </p>
        </div>

        <Button 
          onClick={syncOKXBalances} 
          disabled={syncing}
          className="w-full"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar Saldos OKX'}
        </Button>

        {result && (
          <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
            <div className="text-sm">
              <strong>Trading Account:</strong> {result.trading?.length || 0} ativos
            </div>
            <div className="text-sm">
              <strong>Funding Account:</strong> {result.funding?.length || 0} ativos
            </div>
            <div className="text-sm font-semibold text-primary">
              <strong>Total Combinado:</strong> {result.combined?.length || 0} ativos únicos
            </div>
            
            {result.combined && result.combined.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-xs font-semibold">Detalhes:</div>
                {result.combined.map((item: any, i: number) => (
                  <div key={i} className="text-xs">
                    <span className="font-mono">{item.symbol}:</span> {item.total.toFixed(8)} 
                    <span className="text-muted-foreground ml-1">
                      ({item.accounts.join(' + ')})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
