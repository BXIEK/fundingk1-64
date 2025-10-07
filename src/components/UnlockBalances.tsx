import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Unlock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const UnlockBalances = () => {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleUnlockBalances = async (exchange: 'binance' | 'okx' | 'all') => {
    setProcessing(true);
    setResults(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      toast.info('🔄 Cancelando ordens abertas...', {
        description: `Processando ${exchange === 'all' ? 'todas as exchanges' : exchange}`
      });

      const { data, error } = await supabase.functions.invoke('cancel-all-orders', {
        body: { exchange, userId: user.id }
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.results);
        
        if (data.totalCanceled > 0) {
          toast.success('✅ Ordens canceladas!', {
            description: `${data.totalCanceled} ordem(ns) cancelada(s) com sucesso. Os saldos foram liberados.`
          });
        } else {
          toast.info('ℹ️ Nenhuma ordem aberta', {
            description: 'Não há ordens abertas para cancelar nas exchanges.'
          });
        }
      } else {
        throw new Error(data.error || 'Erro ao cancelar ordens');
      }

    } catch (error: any) {
      console.error('Erro ao desbloquear saldos:', error);
      toast.error('❌ Erro ao desbloquear saldos', {
        description: error.message
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Unlock className="h-5 w-5 text-orange-600" />
          Desbloquear Saldos Travados
        </CardTitle>
        <CardDescription className="text-xs">
          Cancele ordens abertas e libere saldos presos em operações incompletas
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <Alert className="border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-xs text-orange-800">
            Esta ação cancela <strong>todas as ordens abertas</strong> nas exchanges selecionadas,
            liberando os saldos que estão presos nessas ordens.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUnlockBalances('binance')}
            disabled={processing}
            className="text-xs"
          >
            Binance
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUnlockBalances('okx')}
            disabled={processing}
            className="text-xs"
          >
            OKX
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={() => handleUnlockBalances('all')}
            disabled={processing}
            className="text-xs"
          >
            Todas
          </Button>
        </div>

        {results && (
          <div className="space-y-2 pt-2">
            {results.binance && (
              <div className="p-2 border rounded-md bg-card text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Binance</span>
                  {results.binance.success ? (
                    <Badge variant="default" className="text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {results.binance.canceledOrders} cancelada(s)
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">
                      Erro
                    </Badge>
                  )}
                </div>
                {results.binance.orders && results.binance.orders.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {results.binance.orders.map((order: any, idx: number) => (
                      <div key={idx} className="text-[10px] text-muted-foreground">
                        {order.symbol} - {order.side} - {order.quantity} @ {order.price}
                      </div>
                    ))}
                  </div>
                )}
                {results.binance.error && (
                  <p className="text-[10px] text-red-600 mt-1">{results.binance.error}</p>
                )}
              </div>
            )}

            {results.okx && (
              <div className="p-2 border rounded-md bg-card text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">OKX</span>
                  {results.okx.success ? (
                    <Badge variant="default" className="text-[10px]">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {results.okx.canceledOrders} cancelada(s)
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">
                      Erro
                    </Badge>
                  )}
                </div>
                {results.okx.orders && results.okx.orders.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {results.okx.orders.map((order: any, idx: number) => (
                      <div key={idx} className="text-[10px] text-muted-foreground">
                        {order.symbol} - {order.side} - {order.quantity} @ {order.price}
                      </div>
                    ))}
                  </div>
                )}
                {results.okx.error && (
                  <p className="text-[10px] text-red-600 mt-1">{results.okx.error}</p>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
