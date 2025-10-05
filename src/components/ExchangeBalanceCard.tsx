import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  ArrowRightLeft,
  Wallet,
  Minus
} from 'lucide-react';

interface Balance {
  symbol: string;
  balance: number;
  valueUsd: number;
  priceUsd: number;
}

interface ExchangeBalanceCardProps {
  exchange: 'binance' | 'okx';
  baseline?: number; // Valor inicial esperado (padrão 100 USD)
  onBalanceChange?: (totalValue: number) => void;
}

export const ExchangeBalanceCard = ({ 
  exchange, 
  baseline = 100,
  onBalanceChange 
}: ExchangeBalanceCardProps) => {
  const { toast } = useToast();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [totalValue, setTotalValue] = useState(0);

  const exchangeNames = {
    binance: 'Binance',
    okx: 'OKX'
  };

  const fetchBalances = async () => {
    setLoading(true);
    try {
      // Buscar ID do usuário baseado na API key da Binance (como é feito no sistema)
      const binanceCreds = localStorage.getItem('binance_credentials');
      if (!binanceCreds) {
        throw new Error('Credenciais da Binance não encontradas');
      }

      const { apiKey } = JSON.parse(binanceCreds);
      
      // Criar hash do API key para obter o user_id
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Criar UUID v3-like do hash
      const userId = `${hashHex.substring(0, 8)}-${hashHex.substring(8, 12)}-3${hashHex.substring(13, 16)}-${hashHex.substring(16, 20)}-${hashHex.substring(20, 32)}`;

      // Buscar portfolio do banco de dados
      const { data: portfolioData, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          user_id: userId,
          real_mode: true 
        }
      });

      if (error) throw error;

      if (!portfolioData?.success || !portfolioData?.data?.portfolio) {
        throw new Error('Dados do portfolio não encontrados');
      }

      // Filtrar por exchange
      const exchangeFilter = exchange === 'binance' ? 'Binance' : 'OKX';
      const portfolioItems = portfolioData.data.portfolio.filter(
        (item: any) => item.exchange === exchangeFilter && item.balance > 0
      );

      // Processar balances
      const processedBalances: Balance[] = portfolioItems.map((item: any) => ({
        symbol: item.symbol,
        balance: parseFloat(item.balance),
        valueUsd: parseFloat(item.value_usd_calculated || item.value_usd || 0),
        priceUsd: parseFloat(item.price_usd || 0)
      }));

      const total = processedBalances.reduce((sum, b) => sum + b.valueUsd, 0);
      
      setBalances(processedBalances);
      setTotalValue(total);
      
      if (onBalanceChange) {
        onBalanceChange(total);
      }

    } catch (error: any) {
      console.error(`Erro ao buscar saldos da ${exchangeNames[exchange]}:`, error);
      toast({
        title: "❌ Erro ao buscar saldos",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToUSDT = async () => {
    setConverting(true);
    try {
      const credsKey = `${exchange}_credentials`;
      const credsData = localStorage.getItem(credsKey);
      
      if (!credsData) {
        throw new Error(`Credenciais da ${exchangeNames[exchange]} não encontradas`);
      }

      const credentials = JSON.parse(credsData);

      toast({
        title: "🔄 Convertendo para USDT",
        description: `Convertendo tokens na ${exchangeNames[exchange]}...`,
      });

      const { data, error } = await supabase.functions.invoke('binance-convert-to-usdt', {
        body: { ...credentials, minUsdValue: 5 }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Conversão concluída!",
          description: `Total: ${data.totalUsdtReceived?.toFixed(2)} USDT`,
        });
        
        // Recarregar saldos
        await fetchBalances();
      } else {
        throw new Error(data.error || 'Erro na conversão');
      }

    } catch (error: any) {
      console.error('Erro na conversão:', error);
      toast({
        title: "❌ Erro na conversão",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setConverting(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 60000); // Atualiza a cada 60s
    return () => clearInterval(interval);
  }, [exchange]);

  const profitLoss = totalValue - baseline;
  const profitLossPercent = baseline > 0 ? (profitLoss / baseline) * 100 : 0;
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            {exchangeNames[exchange]}
          </CardTitle>
          <Badge variant={exchange === 'binance' ? 'default' : 'secondary'}>
            Conectado
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Total Value Display */}
        <div className="text-center py-4 border rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground mb-1">Saldo Total</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-bold">
              US$ {totalValue.toFixed(2)}
            </p>
            {isProfit && (
              <TrendingUp className="h-6 w-6 text-green-500" />
            )}
            {isLoss && (
              <TrendingDown className="h-6 w-6 text-red-500" />
            )}
            {!isProfit && !isLoss && (
              <Minus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          
          {/* Profit/Loss Indicator */}
          <div className="mt-2">
            <Badge 
              variant={isProfit ? "default" : isLoss ? "destructive" : "secondary"}
              className={isProfit ? "bg-green-500" : isLoss ? "bg-red-500" : ""}
            >
              {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} USD ({profitLossPercent.toFixed(2)}%)
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Base: ${baseline.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Assets List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {balances.map((balance) => (
            <div 
              key={balance.symbol}
              className="flex items-center justify-between p-2 border rounded-md text-sm"
            >
              <div>
                <p className="font-semibold">{balance.symbol}</p>
                <p className="text-xs text-muted-foreground">
                  {balance.balance.toFixed(6)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  ${balance.valueUsd.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  @${balance.priceUsd.toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBalances}
            disabled={loading}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          {exchange === 'binance' && (
            <Button
              variant="default"
              size="sm"
              onClick={handleConvertToUSDT}
              disabled={converting || loading}
              className="flex-1"
            >
              <ArrowRightLeft className={`h-4 w-4 mr-2 ${converting ? 'animate-spin' : ''}`} />
              → USDT
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};