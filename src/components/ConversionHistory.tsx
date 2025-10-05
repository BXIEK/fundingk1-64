import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRightLeft, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversionRecord {
  id: string;
  user_id: string;
  from_token: string;
  to_token: string;
  from_amount: number;
  to_amount: number;
  exchange: string;
  conversion_type: 'market' | 'limit';
  price: number;
  status: 'success' | 'failed';
  error_message?: string;
  created_at: string;
}

export const ConversionHistory = () => {
  const [conversions, setConversions] = useState<ConversionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadConversions = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('conversion_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setConversions((data || []) as ConversionRecord[]);
    } catch (error) {
      console.error('Erro ao carregar histórico de conversões:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConversions();

    // Inscrever-se para atualizações em tempo real
    const channel = supabase
      .channel('conversion_history_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversion_history'
        },
        (payload) => {
          setConversions((prev) => [payload.new as ConversionRecord, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(value);
  };

  const getExchangeColor = (exchange: string) => {
    switch (exchange.toLowerCase()) {
      case 'binance':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'okx':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'success'
      ? 'bg-green-500/10 text-green-500 border-green-500/20'
      : 'bg-red-500/10 text-red-500 border-red-500/20';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Histórico de Conversões
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={loadConversions}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {conversions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma conversão registrada ainda</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Exchange</TableHead>
                  <TableHead>Conversão</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.map((conversion) => (
                  <TableRow key={conversion.id}>
                    <TableCell className="font-mono text-xs">
                      {format(new Date(conversion.created_at), 'dd/MM/yyyy HH:mm:ss', {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getExchangeColor(conversion.exchange)}>
                        {conversion.exchange}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{conversion.from_token}</span>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{conversion.to_token}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {conversion.conversion_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <div className="flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-1 text-red-500">
                          <TrendingDown className="h-3 w-3" />
                          {formatCurrency(conversion.from_amount)} {conversion.from_token}
                        </div>
                        <div className="flex items-center gap-1 text-green-500">
                          <TrendingUp className="h-3 w-3" />
                          {formatCurrency(conversion.to_amount)} {conversion.to_token}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ${formatCurrency(conversion.price)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(conversion.status)}>
                        {conversion.status === 'success' ? 'Sucesso' : 'Falha'}
                      </Badge>
                      {conversion.error_message && (
                        <p className="text-xs text-red-500 mt-1">{conversion.error_message}</p>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
