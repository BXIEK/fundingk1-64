import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useBalanceSync } from '@/hooks/useBalanceSync';
import { 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  Minus,
  RefreshCw,
  ArrowRightLeft,
  Repeat
} from 'lucide-react';

interface TotalBalanceCardProps {
  binanceBalance;
  okxBalance;
  totalBaseline?;
  selectedToken?;
}

interface PriceData {
  binance;
  okx;
  spread;
}

interface TokenSpreadData {
  symbol;
  binancePrice;
  okxPrice;
  spread;
  absSpread;
}

interface TokenBalance {
  symbol;
  balance;
  valueUsd;
  priceUsd;
  exchange;
}

export const TotalBalanceCard = ({ 
  binanceBalance, 
  okxBalance,
  totalBaseline = 200,
  selectedToken: externalSelectedToken
}: TotalBalanceCardProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalSelectedToken, setInternalSelectedToken] = useState<string>('SOL');
  const { syncAllBalances } = useBalanceSync();
  
  // Usar token externo se fornecido, senão usar interno
  const selectedToken = externalSelectedToken || internalSelectedToken;

  // Sincronizar token externo com interno quando mudar
  useEffect(() => {
    if (externalSelectedToken && externalSelectedToken !== internalSelectedToken) {
      console.log(`🔄 Sincronizando token para ${externalSelectedToken} no Total Balance`);
      setInternalSelectedToken(externalSelectedToken);
    }
  }, [externalSelectedToken]);
  const [tokenPrices, setTokenPrices] = useState<PriceData>({ binance: 0, okx: 0, spread: 0 });
  const [lastExecution, setLastExecution] = useState<string>('');
  const [binanceTokens, setBinanceTokens] = useState<TokenBalance[]>([]);
  const [okxTokens, setOkxTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activeTab, setActiveTab] = useState<'binance' | 'okx'>('binance');

  // Helper para salvar conversões no histórico
  const saveConversionRecord = async (params: {
    fromToken: string;
    toToken: string;
    fromAmount: number;
    toAmount: number;
    exchange: string;
    conversionType: 'market' | 'limit';
    price: number;
    status: 'success' | 'failed';
    errorMessage?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('conversion_history').insert({
        user_id: user.id,
        from_token: params.fromToken,
        to_token: params.toToken,
        from_amount: params.fromAmount,
        to_amount: params.toAmount,
        exchange: params.exchange,
        conversion_type: params.conversionType,
        price: params.price,
        status: params.status,
        error_message: params.errorMessage
      });
    } catch (error) {
      console.error('Erro ao salvar registro de conversão:', error);
    }
  };

  const totalValue = binanceBalance + okxBalance;
  const profitLoss = totalValue - totalBaseline;
  const profitLossPercent = totalBaseline > 0 ? (profitLoss / totalBaseline) * 100 : 0;
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;

  // Buscar tokens de ambas as exchanges
  const fetchAllTokens = async (forceSync = false) => {
    setLoadingTokens(true);
    try {
      // Se forceSync, sincronizar com as exchanges primeiro
      if (forceSync) {
        console.log('🔄 Sincronizando saldos reais de todas as exchanges...');
        await syncAllBalances();
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: portfolioData, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          user_id: user.id,
          real_mode: true,
          force_refresh: false
        }
      });

      if (error) throw error;

      if (!portfolioData?.success || !portfolioData?.data?.portfolio) {
        return;
      }

      // Filtrar tokens por exchange
      const binanceItems = portfolioData.data.portfolio
        .filter((item: any) => item.exchange === 'Binance' && item.balance > 0)
        .map((item: any) => ({
          symbol: item.symbol,
          balance: parseFloat(item.balance),
          valueUsd: parseFloat(item.value_usd_calculated || item.value_usd || 0),
          priceUsd: parseFloat(item.price_usd || 0),
          exchange: 'Binance'
        }));

      const okxItems = portfolioData.data.portfolio
        .filter((item: any) => item.exchange === 'OKX' && item.balance > 0)
        .map((item: any) => ({
          symbol: item.symbol,
          balance: parseFloat(item.balance),
          valueUsd: parseFloat(item.value_usd_calculated || item.value_usd || 0),
          priceUsd: parseFloat(item.price_usd || 0),
          exchange: 'OKX'
        }));

      setBinanceTokens(binanceItems);
      setOkxTokens(okxItems);
    } catch (error) {
      console.error('Erro ao buscar tokens:', error);
    } finally {
      setLoadingTokens(false);
    }
  };

  // Inicialização e listener para sincronização
  useEffect(() => {
    fetchAllTokens();
    
    // Listener para sincronização forçada via evento global
    const handleBalanceSync = () => {
      console.log('🔄 Evento de sincronização recebido - Atualizando Total Balance');
      fetchAllTokens();
    };

    window.addEventListener('balances-synced', handleBalanceSync);
    
    return () => {
      window.removeEventListener('balances-synced', handleBalanceSync);
    };
  }, []);

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PiggyBank className="h-5 w-5" />
            Saldo Total (Todas as Exchanges)
          </CardTitle>
          
          {/* Token Selecionado */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 rounded border border-primary/20">
              <ArrowRightLeft className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-primary">{selectedToken}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Total Value Display */}
        <div className="text-center py-6 border-2 rounded-lg bg-primary/5">
          <p className="text-sm text-muted-foreground mb-2">Patrimônio Total</p>
          <div className="flex items-center justify-center gap-3">
            <p className="text-4xl font-bold text-primary">
              US$ {totalValue.toFixed(2)}
            </p>
            {isProfit && (
              <TrendingUp className="h-8 w-8 text-green-500" />
            )}
            {isLoss && (
              <TrendingDown className="h-8 w-8 text-red-500" />
            )}
            {!isProfit && !isLoss && (
              <Minus className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          
          {/* Profit/Loss Indicator */}
          <div className="mt-3">
            <Badge 
              variant={isProfit ? "default" : isLoss ? "destructive" : "secondary"}
              className={`text-lg px-4 py-1 ${isProfit ? "bg-green-500" : isLoss ? "bg-red-500" : ""}`}
            >
              {profitLoss >= 0 ? '+' : ''}{profitLoss.toFixed(2)} USD ({profitLossPercent.toFixed(2)}%)
            </Badge>
            <p className="text-sm text-muted-foreground mt-2">
              Base inicial: ${totalBaseline.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Exchange Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Binance</p>
            <p className="text-lg font-bold">
              ${binanceBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalValue > 0 ? ((binanceBalance / totalValue) * 100).toFixed(1) : 0}% do total
            </p>
          </div>
          
          <div className="p-3 border rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">OKX</p>
            <p className="text-lg font-bold">
              ${okxBalance.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalValue > 0 ? ((okxBalance / totalValue) * 100).toFixed(1) : 0}% do total
            </p>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="pt-3 border-t">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Investido</p>
              <p className="text-sm font-semibold">${totalBaseline.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atual</p>
              <p className="text-sm font-semibold">${totalValue.toFixed(0)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Retorno</p>
              <p className={`text-sm font-semibold ${isProfit ? 'text-green-500' : isLoss ? 'text-red-500' : ''}`}>
                {profitLossPercent.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>

        {/* Tokens por Exchange */}
        <div className="pt-4 border-t">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'binance' | 'okx')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="binance">
                Binance ({binanceTokens.length})
              </TabsTrigger>
              <TabsTrigger value="okx">
                OKX ({okxTokens.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="binance" className="space-y-2 mt-3">
              {loadingTokens ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : binanceTokens.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {binanceTokens.map((token) => (
                    <div 
                      key={token.symbol}
                      className="flex items-center justify-between p-2 border rounded-md text-sm bg-muted/20"
                    >
                      <div>
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {token.balance.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${token.valueUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @${token.priceUsd.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum token na Binance</p>
              )}
            </TabsContent>

            <TabsContent value="okx" className="space-y-2 mt-3">
              {loadingTokens ? (
                <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
              ) : okxTokens.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {okxTokens.map((token) => (
                    <div 
                      key={token.symbol}
                      className="flex items-center justify-between p-2 border rounded-md text-sm bg-muted/20"
                    >
                      <div>
                        <p className="font-semibold">{token.symbol}</p>
                        <p className="text-xs text-muted-foreground">
                          {token.balance.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          ${token.valueUsd.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          @${token.priceUsd.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum token na OKX</p>
              )}
            </TabsContent>
          </Tabs>

          {/* Botões de Ação */}
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAllTokens(true)}
              disabled={loadingTokens}
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingTokens ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            
            <Button
              variant="secondary"
              size="sm"
              disabled={loadingTokens}
              className="flex-1"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Converter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};