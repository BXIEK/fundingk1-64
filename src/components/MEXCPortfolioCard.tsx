import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, TrendingUp, DollarSign } from 'lucide-react';
import { useMEXC } from '@/hooks/useMEXC';

export const MEXCPortfolioCard = () => {
  const { loading, getBalances, getPrices } = useMEXC();
  const [balances, setBalances] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState(0);

  const loadData = async () => {
    try {
      // Get balances
      const balancesData = await getBalances();
      setBalances(balancesData);

      // Get prices for all assets
      const symbols = balancesData.map(b => b.asset);
      const pricesData = await getPrices(symbols);
      setPrices(pricesData);

      // Calculate total value
      let total = 0;
      balancesData.forEach(balance => {
        const symbol = `${balance.asset}USDT`;
        const price = pricesData[symbol] || 0;
        total += balance.total * price;
      });
      
      // Add USDT directly
      const usdtBalance = balancesData.find(b => b.asset === 'USDT');
      if (usdtBalance) {
        total += usdtBalance.total;
      }

      setTotalValue(total);
    } catch (error) {
      console.error('Error loading MEXC data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Portfolio MEXC
            </CardTitle>
            <CardDescription>Saldos e valores na MEXC Exchange</CardDescription>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Total Value */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div>
            <p className="text-sm text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            MEXC
          </Badge>
        </div>

        {/* Balances Table */}
        {balances.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead className="text-right">Bloqueado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Valor USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map((balance) => {
                const symbol = `${balance.asset}USDT`;
                const price = balance.asset === 'USDT' ? 1 : (prices[symbol] || 0);
                const valueUSD = balance.total * price;

                return (
                  <TableRow key={balance.asset}>
                    <TableCell className="font-medium">{balance.asset}</TableCell>
                    <TableCell className="text-right">{balance.free.toFixed(8)}</TableCell>
                    <TableCell className="text-right">{balance.locked.toFixed(8)}</TableCell>
                    <TableCell className="text-right font-medium">{balance.total.toFixed(8)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(valueUSD)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {loading ? 'Carregando...' : 'Nenhum saldo encontrado'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
