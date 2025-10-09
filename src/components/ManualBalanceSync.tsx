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
      // Buscar credenciais do localStorage (formato usado pelo TradingModeContext)
      const okxCredentialsStr = localStorage.getItem('okx_credentials');
      
      if (!okxCredentialsStr) {
        throw new Error('Credenciais da OKX não configuradas. Configure as credenciais primeiro.');
      }

      const okxCredentials = JSON.parse(okxCredentialsStr);
      const { apiKey: okxApiKey, secretKey: okxSecretKey, passphrase: okxPassphrase } = okxCredentials;

      if (!okxApiKey || !okxSecretKey || !okxPassphrase) {
        throw new Error('Credenciais da OKX incompletas');
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
          <div className="mt-4 p-3 bg-muted rounded-lg space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded">
                <div className="font-semibold text-blue-700 dark:text-blue-300">Trading Account</div>
                <div className="text-lg font-bold">{result.trading?.length || 0} ativos</div>
              </div>
              <div className="p-2 bg-green-50 dark:bg-green-950 rounded">
                <div className="font-semibold text-green-700 dark:text-green-300">Funding Account</div>
                <div className="text-lg font-bold">{result.funding?.length || 0} ativos</div>
              </div>
            </div>

            {result.summary && (
              <div className="text-sm space-y-1 pt-2 border-t">
                <div className="flex justify-between">
                  <span>Apenas Trading:</span>
                  <span className="font-semibold">{result.summary.trading_only}</span>
                </div>
                <div className="flex justify-between">
                  <span>Apenas Funding:</span>
                  <span className="font-semibold">{result.summary.funding_only}</span>
                </div>
                <div className="flex justify-between">
                  <span>Em ambas contas:</span>
                  <span className="font-semibold">{result.summary.both_accounts}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold text-primary">
                  <span>Total de registros:</span>
                  <span>{result.summary.total_records}</span>
                </div>
              </div>
            )}
            
            {result.combined && result.combined.length > 0 && (
              <div className="mt-3 space-y-1 pt-2 border-t">
                <div className="text-xs font-semibold mb-2">Detalhes por ativo:</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.combined.map((item: any, i: number) => (
                    <div key={i} className="text-xs flex justify-between items-center p-2 bg-background rounded">
                      <div>
                        <span className="font-mono font-semibold">{item.symbol}</span>
                        <span className="text-muted-foreground ml-2 text-[10px]">
                          ({item.accounts.join(' + ')})
                        </span>
                      </div>
                      <div className="font-mono text-right">
                        {item.trading > 0 && (
                          <div className="text-blue-600 dark:text-blue-400">
                            T: {item.trading.toFixed(8)}
                          </div>
                        )}
                        {item.funding > 0 && (
                          <div className="text-green-600 dark:text-green-400">
                            F: {item.funding.toFixed(8)}
                          </div>
                        )}
                        <div className="font-semibold">
                          = {item.total.toFixed(8)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
