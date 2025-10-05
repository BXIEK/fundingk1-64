import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const [btcPrices, setBtcPrices] = useState<PriceData>({ binance: 0, okx: 0, spread: 0 });
  const [lastExecution, setLastExecution] = useState<string>('');
  const [binanceTokens, setBinanceTokens] = useState<TokenBalance[]>([]);
  const [okxTokens, setOkxTokens] = useState<TokenBalance[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [activeTab, setActiveTab] = useState<'binance' | 'okx'>('binance');

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

  // Buscar preços BTC a cada 15 segundos
  useEffect(() => {
    if (!autoConvertEnabled) return;

    const fetchPrices = async () => {
      try {
        // Buscar preço Binance usando endpoint correto
        const { data: binanceData } = await supabase.functions.invoke('binance-market-data', {
          body: { action: 'tickers', symbols: ['BTCUSDT'] }
        });

        // Buscar preço OKX
        const { data: okxData } = await supabase.functions.invoke('okx-api', {
          body: { action: 'get_prices' }
        });

        if (binanceData?.success && okxData?.success) {
          const binancePrice = binanceData.data?.BTCUSDT?.lastPrice || binanceData.data?.BTCUSDT?.price || 0;
          const okxPrice = okxData.data?.BTC || okxData.data?.BTCUSDT || 0;
          const spread = ((okxPrice - binancePrice) / binancePrice) * 100;

          setBtcPrices({ binance: binancePrice, okx: okxPrice, spread });

          // Se spread > 0.1%, executar conversão
          if (spread > 0.1 && !isProcessing) {
            await executeAutoConversion(binancePrice, okxPrice);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar preços:', error);
      }
    };

    fetchPrices(); // Primeira execução
    const interval = setInterval(fetchPrices, 15000); // A cada 15s

    return () => clearInterval(interval);
  }, [autoConvertEnabled, isProcessing]);

  const executeAutoConversion = async (binancePrice: number, okxPrice: number) => {
    setIsProcessing(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar credenciais
      console.log('🔍 Buscando credenciais da Binance...');
      const { data: binanceCreds, error: binanceError } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', 'binance')
        .eq('is_active', true)
        .maybeSingle();

      console.log('🔍 Buscando credenciais da OKX...');
      const { data: okxCreds, error: okxError } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', 'okx')
        .eq('is_active', true)
        .maybeSingle();

      console.log('Binance creds:', binanceCreds ? 'OK' : 'NÃO ENCONTRADO');
      console.log('OKX creds:', okxCreds ? 'OK' : 'NÃO ENCONTRADO');

      if (!binanceCreds || !okxCreds) {
        console.error('❌ Credenciais não configuradas no banco de dados');
        toast.error('⚠️ Credenciais não encontradas', {
          description: 'Configure suas credenciais da Binance e OKX na aba "Configuração API" antes de usar a conversão automática.',
          duration: 7000
        });
        setAutoConvertEnabled(false);
        return;
      }

      console.log(`🤖 Auto-Conversão: BTC Binance ($${binancePrice}) vs OKX ($${okxPrice})`);
      console.log(`📊 Spread: ${btcPrices.spread.toFixed(3)}%`);

      // Buscar saldos de BTC em ambas as exchanges
      console.log('💰 Verificando saldos de BTC...');
      const { data: portfolioData } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          user_id: user.id,
          real_mode: true,
          force_refresh: false
        }
      });

      if (!portfolioData?.success || !portfolioData?.data?.portfolio) {
        throw new Error('Não foi possível verificar o saldo de BTC');
      }

      // Filtrar saldos de BTC
      const binanceBTC = portfolioData.data.portfolio.find(
        (item: any) => item.exchange === 'Binance' && item.symbol === 'BTC'
      );
      const okxBTC = portfolioData.data.portfolio.find(
        (item: any) => item.exchange === 'OKX' && item.symbol === 'BTC'
      );

      const binanceBTCBalance = binanceBTC ? parseFloat(binanceBTC.balance) : 0;
      const okxBTCBalance = okxBTC ? parseFloat(okxBTC.balance) : 0;

      console.log(`💰 Saldo BTC Binance: ${binanceBTCBalance}`);
      console.log(`💰 Saldo BTC OKX: ${okxBTCBalance}`);

      // Determinar qual exchange tem BTC mais caro e verificar saldo
      const btcMoreExpensiveOnOkx = okxPrice > binancePrice;
      const expensiveExchange = btcMoreExpensiveOnOkx ? 'OKX' : 'Binance';
      const expensivePrice = btcMoreExpensiveOnOkx ? okxPrice : binancePrice;
      const btcBalance = btcMoreExpensiveOnOkx ? okxBTCBalance : binanceBTCBalance;
      
      // Calcular valor mínimo necessário (5 USDT)
      const minNotionalUSD = 5;
      const minBTCNeeded = minNotionalUSD / expensivePrice;

      console.log(`🎯 ESTRATÉGIA: Converter BTC → USDT na ${expensiveExchange} (preço: $${expensivePrice})`);
      console.log(`📊 Saldo disponível: ${btcBalance} BTC`);
      console.log(`📏 Mínimo necessário: ${minBTCNeeded.toFixed(8)} BTC (${minNotionalUSD} USDT)`);

      // Verificar se há saldo suficiente
      if (btcBalance < minBTCNeeded) {
        console.log(`⚠️ Saldo insuficiente. Necessário: ${minBTCNeeded.toFixed(8)} BTC, disponível: ${btcBalance} BTC`);
        toast.warning('⚠️ Saldo BTC insuficiente', {
          description: `Saldo de BTC na ${expensiveExchange} é muito baixo para conversão (mínimo: ${minNotionalUSD} USDT)`,
          duration: 5000
        });
        return;
      }

      // Verificar se vale a pena converter (saldo deve valer pelo menos $10 para compensar)
      const btcValueUSD = btcBalance * expensivePrice;
      if (btcValueUSD < 10) {
        console.log(`⚠️ Valor muito baixo para conversão: $${btcValueUSD.toFixed(2)}`);
        toast.info('💡 Saldo BTC muito baixo', {
          description: `Valor em BTC ($${btcValueUSD.toFixed(2)}) é muito baixo. Aguardando acúmulo maior.`,
          duration: 5000
        });
        return;
      }

      let result, error;

      if (btcMoreExpensiveOnOkx) {
        // Vender BTC na OKX (mais caro)
        console.log('💰 Invocando okx-swap-token (SELL) com saldo disponível...');
        const response = await supabase.functions.invoke('okx-swap-token', {
          body: {
            apiKey: okxCreds.api_key,
            secretKey: okxCreds.secret_key,
            passphrase: okxCreds.passphrase,
            symbol: 'BTC',
            direction: 'toUsdt'
          }
        });
        result = response.data;
        error = response.error;
        console.log('📦 Resultado OKX:', result);
      } else {
        // Vender BTC na Binance (mais caro)
        console.log('💰 Invocando binance-swap-token (SELL) com saldo disponível...');
        const response = await supabase.functions.invoke('binance-swap-token', {
          body: {
            apiKey: binanceCreds.api_key,
            secretKey: binanceCreds.secret_key,
            symbol: 'BTC',
            direction: 'toUsdt'
          }
        });
        result = response.data;
        error = response.error;
        console.log('📦 Resultado Binance:', result);
      }

      if (error) {
        console.error('❌ Erro na requisição:', error);
        throw new Error(`Erro na venda BTC ${expensiveExchange}: ${error.message}`);
      }

      if (!result?.success) {
        const errorMsg = result?.error || 'Erro desconhecido';
        console.error('❌ Venda falhou:', errorMsg);
        throw new Error(`Erro na venda BTC ${expensiveExchange}: ${errorMsg}`);
      }

      console.log(`✅ Venda BTC realizada na ${expensiveExchange}`);

      const profit = result.executedQty * Math.abs(okxPrice - binancePrice);
      
      toast.success(`✅ Conversão automática executada!`, {
        description: `${result.executedQty.toFixed(6)} BTC → USDT | Lucro: $${profit.toFixed(2)}`,
        duration: 7000
      });

      setLastExecution(new Date().toLocaleTimeString('pt-BR'));

    } catch (error: any) {
      console.error('Erro na conversão automática:', error);
      toast.error('Erro na conversão automática', {
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
          
          {/* Switch de Conversão Automatizada */}
          <div className="flex items-center gap-2">
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
            
            {btcPrices.binance > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Binance</p>
                  <p className="font-mono font-semibold">${btcPrices.binance.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">OKX</p>
                  <p className="font-mono font-semibold">${btcPrices.okx.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Spread</p>
                  <p className={`font-mono font-semibold ${btcPrices.spread > 0.1 ? 'text-green-500' : ''}`}>
                    {btcPrices.spread.toFixed(3)}%
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