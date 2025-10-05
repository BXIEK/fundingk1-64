import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  Minus,
  Zap,
  RefreshCw,
  ArrowRightLeft,
  Repeat
} from 'lucide-react';

interface TotalBalanceCardProps {
  binanceBalance: number;
  okxBalance: number;
  totalBaseline?: number;
}

interface PriceData {
  binance: number;
  okx: number;
  spread: number;
}

interface TokenBalance {
  symbol: string;
  balance: number;
  valueUsd: number;
  priceUsd: number;
  exchange: string;
}

export const TotalBalanceCard = ({ 
  binanceBalance, 
  okxBalance,
  totalBaseline = 200
}: TotalBalanceCardProps) => {
  const [autoConvertEnabled, setAutoConvertEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<string>('BTC');
  const [tokenPrices, setTokenPrices] = useState<PriceData>({ binance: 0, okx: 0, spread: 0 });
  const [lastExecution, setLastExecution] = useState<string>('');
  const [binanceTokens, setBinanceTokens] = useState<TokenBalance[]>([]);
  const [okxTokens, setOkxTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activeTab, setActiveTab] = useState<'binance' | 'okx'>('binance');

  // Lista de tokens disponíveis para conversão automática
  const availableTokens = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'XRP', 'DOT', 'LINK', 'UNI', 'AVAX'];

  const totalValue = binanceBalance + okxBalance;
  const profitLoss = totalValue - totalBaseline;
  const profitLossPercent = totalBaseline > 0 ? (profitLoss / totalBaseline) * 100 : 0;
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;

  // Buscar tokens de ambas as exchanges
  const fetchAllTokens = async () => {
    setLoadingTokens(true);
    try {
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

  // Atualizar tokens periodicamente
  useEffect(() => {
    fetchAllTokens();
    const interval = setInterval(fetchAllTokens, 60000); // A cada 60s
    return () => clearInterval(interval);
  }, []);

  // Buscar preços do token selecionado a cada 15 segundos
  useEffect(() => {
    if (!autoConvertEnabled || !selectedToken) return;

    const fetchPrices = async () => {
      try {
        const symbol = `${selectedToken}USDT`;
        
        // Buscar preço Binance
        const { data: binanceData } = await supabase.functions.invoke('binance-market-data', {
          body: { action: 'tickers', symbols: [symbol] }
        });

        // Buscar preço OKX
        const { data: okxData } = await supabase.functions.invoke('okx-api', {
          body: { action: 'get_prices' }
        });

        if (binanceData?.success && okxData?.success) {
          const binancePrice = binanceData.data?.[symbol]?.lastPrice || binanceData.data?.[symbol]?.price || 0;
          const okxPrice = okxData.data?.[selectedToken] || 0;
          
          if (binancePrice > 0 && okxPrice > 0) {
            const spread = ((okxPrice - binancePrice) / binancePrice) * 100;
            setTokenPrices({ binance: binancePrice, okx: okxPrice, spread });

            // Se spread absoluto > 0.3%, executar conversão
            if (Math.abs(spread) > 0.3 && !isProcessing) {
              await executeAutoConversion(binancePrice, okxPrice);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar preços:', error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 15000);

    return () => clearInterval(interval);
  }, [autoConvertEnabled, isProcessing, selectedToken]);

  const executeAutoConversion = async (binancePrice: number, okxPrice: number) => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar credenciais
      const { data: binanceCreds } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', 'binance')
        .eq('is_active', true)
        .maybeSingle();

      const { data: okxCreds } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', 'okx')
        .eq('is_active', true)
        .maybeSingle();

      if (!binanceCreds || !okxCreds) {
        toast.error('⚠️ Credenciais não encontradas', {
          description: 'Configure suas credenciais da Binance e OKX.',
          duration: 5000
        });
        setAutoConvertEnabled(false);
        return;
      }

      // Buscar saldos do token e USDT
      const { data: portfolioData } = await supabase.functions.invoke('get-portfolio', {
        body: { user_id: user.id, real_mode: true, force_refresh: false }
      });

      if (!portfolioData?.success) throw new Error('Erro ao buscar saldos');

      const portfolio = portfolioData.data.portfolio;
      
      // Filtrar saldos por exchange
      const binanceToken = portfolio.find((i: any) => i.exchange === 'Binance' && i.symbol === selectedToken);
      const okxToken = portfolio.find((i: any) => i.exchange === 'OKX' && i.symbol === selectedToken);
      const binanceUSDT = portfolio.find((i: any) => i.exchange === 'Binance' && i.symbol === 'USDT');
      const okxUSDT = portfolio.find((i: any) => i.exchange === 'OKX' && i.symbol === 'USDT');

      const binanceTokenBalance = binanceToken ? parseFloat(binanceToken.balance) : 0;
      const okxTokenBalance = okxToken ? parseFloat(okxToken.balance) : 0;
      const binanceUSDTBalance = binanceUSDT ? parseFloat(binanceUSDT.balance) : 0;
      const okxUSDTBalance = okxUSDT ? parseFloat(okxUSDT.balance) : 0;

      console.log(`💰 Saldos - Binance: ${binanceTokenBalance} ${selectedToken}, ${binanceUSDTBalance} USDT`);
      console.log(`💰 Saldos - OKX: ${okxTokenBalance} ${selectedToken}, ${okxUSDTBalance} USDT`);
      console.log(`📊 Preços - Binance: $${binancePrice}, OKX: $${okxPrice}, Spread: ${tokenPrices.spread.toFixed(3)}%`);

      const minNotionalUSD = 5;
      let result, error, executedAction;

      // Decidir estratégia baseado no spread
      if (okxPrice > binancePrice && tokenPrices.spread > 0.3) {
        // OKX mais caro: Vender token na OKX por USDT
        const minTokenNeeded = minNotionalUSD / okxPrice;
        
        if (okxTokenBalance < minTokenNeeded) {
          toast.warning(`⚠️ Saldo ${selectedToken} insuficiente na OKX`, {
            description: `Necessário: ${minTokenNeeded.toFixed(6)} ${selectedToken}`,
            duration: 5000
          });
          return;
        }

        console.log(`🎯 Vender ${selectedToken} → USDT na OKX ($${okxPrice})`);
        const response = await supabase.functions.invoke('okx-swap-token', {
          body: {
            apiKey: okxCreds.api_key,
            secretKey: okxCreds.secret_key,
            passphrase: okxCreds.passphrase,
            symbol: selectedToken,
            direction: 'toUsdt'
          }
        });
        result = response.data;
        error = response.error;
        executedAction = `${selectedToken} → USDT (OKX)`;

      } else if (binancePrice > okxPrice && Math.abs(tokenPrices.spread) > 0.3) {
        // Binance mais caro: Vender token na Binance por USDT
        const minTokenNeeded = minNotionalUSD / binancePrice;
        
        if (binanceTokenBalance < minTokenNeeded) {
          toast.warning(`⚠️ Saldo ${selectedToken} insuficiente na Binance`, {
            description: `Necessário: ${minTokenNeeded.toFixed(6)} ${selectedToken}`,
            duration: 5000
          });
          return;
        }

        console.log(`🎯 Vender ${selectedToken} → USDT na Binance ($${binancePrice})`);
        const response = await supabase.functions.invoke('binance-swap-token', {
          body: {
            apiKey: binanceCreds.api_key,
            secretKey: binanceCreds.secret_key,
            symbol: selectedToken,
            direction: 'toUsdt'
          }
        });
        result = response.data;
        error = response.error;
        executedAction = `${selectedToken} → USDT (Binance)`;
      } else {
        console.log('⏸️ Spread insuficiente para conversão');
        return;
      }

      if (error || !result?.success) {
        throw new Error(result?.error || error?.message || 'Erro na conversão');
      }

      const profit = result.executedQty * Math.abs(okxPrice - binancePrice);
      
      toast.success(`✅ Rebalanceamento automático!`, {
        description: `${executedAction} | Lucro: $${profit.toFixed(2)}`,
        duration: 7000
      });

      setLastExecution(new Date().toLocaleTimeString('pt-BR'));

    } catch (error: any) {
      console.error('Erro no rebalanceamento:', error);
      toast.error('Erro no rebalanceamento', {
        description: error.message
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PiggyBank className="h-5 w-5" />
            Saldo Total (Todas as Exchanges)
          </CardTitle>
          
          {/* Controles de Conversão Automatizada */}
          <div className="flex items-center gap-2">
            <Select value={selectedToken} onValueChange={setSelectedToken} disabled={autoConvertEnabled}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTokens.map((token) => (
                  <SelectItem key={token} value={token} className="text-xs">
                    {token}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Label htmlFor="auto-convert" className="text-sm font-normal cursor-pointer flex items-center gap-1">
              <Zap className={`h-4 w-4 ${autoConvertEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
              Auto
            </Label>
            <Switch
              id="auto-convert"
              checked={autoConvertEnabled}
              onCheckedChange={setAutoConvertEnabled}
              disabled={isProcessing}
            />
          </div>
        </div>
        
        {/* Status da Conversão Automática */}
        {autoConvertEnabled && (
          <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <RefreshCw className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''} text-primary`} />
                <span className="text-primary font-medium">
                  {isProcessing ? 'Processando...' : 'Monitorando preços'}
                </span>
              </div>
              {lastExecution && (
                <span className="text-muted-foreground">
                  Última: {lastExecution}
                </span>
              )}
            </div>
            
            {tokenPrices.binance > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Binance</p>
                  <p className="font-mono font-semibold">${tokenPrices.binance.toFixed(tokenPrices.binance < 1 ? 6 : 2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">OKX</p>
                  <p className="font-mono font-semibold">${tokenPrices.okx.toFixed(tokenPrices.okx < 1 ? 6 : 2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Spread</p>
                  <p className={`font-mono font-semibold ${Math.abs(tokenPrices.spread) > 0.3 ? 'text-green-500' : ''}`}>
                    {tokenPrices.spread > 0 ? '+' : ''}{tokenPrices.spread.toFixed(3)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
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
              onClick={fetchAllTokens}
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