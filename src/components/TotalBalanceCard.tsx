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
  selectedToken?: string;
}

interface PriceData {
  binance: number;
  okx: number;
  spread: number;
}

interface TokenSpreadData {
  symbol: string;
  binancePrice: number;
  okxPrice: number;
  spread: number;
  absSpread: number;
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
  totalBaseline = 200,
  selectedToken: externalSelectedToken
}: TotalBalanceCardProps) => {
  const [autoConvertEnabled, setAutoConvertEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalSelectedToken, setInternalSelectedToken] = useState<string>('SOL');
  
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
  const [bestToken, setBestToken] = useState<TokenSpreadData | null>(null);

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

  // Acionar conversões quando token externo mudar
  useEffect(() => {
    if (externalSelectedToken && externalSelectedToken !== 'USDT' && !isProcessing) {
      console.log(`🔄 Token externo mudou para ${externalSelectedToken}, verificando oportunidades...`);
      
      // Buscar preços do token selecionado e verificar spread
      const checkTokenSpread = async () => {
        try {
          const symbol = `${externalSelectedToken}USDT`;
          const { data: binanceData } = await supabase.functions.invoke('binance-market-data', {
            body: { action: 'tickers', symbols: [symbol] }
          });

          const { data: okxData } = await supabase.functions.invoke('okx-api', {
            body: { action: 'get_prices' }
          });

          if (binanceData?.success && okxData?.success) {
            const binancePrice = binanceData.data?.[symbol]?.lastPrice || binanceData.data?.[symbol]?.price || 0;
            const okxPrice = okxData.data?.[externalSelectedToken] || 0;

            if (binancePrice > 0 && okxPrice > 0) {
              const spread = ((okxPrice - binancePrice) / binancePrice) * 100;
              setTokenPrices({ binance: binancePrice, okx: okxPrice, spread });
              
              console.log(`📊 ${externalSelectedToken} - Binance: $${binancePrice}, OKX: $${okxPrice}, Spread: ${spread.toFixed(3)}%`);
              
              if (Math.abs(spread) > 0.3) {
                console.log(`✅ Executando conversão automática para ${externalSelectedToken}...`);
                await executeAutoConversion(binancePrice, okxPrice, externalSelectedToken);
              } else {
                console.log(`⏸️ Spread insuficiente (${spread.toFixed(3)}%) - aguardando melhor oportunidade`);
              }
            }
          }
        } catch (error) {
          console.error('Erro ao verificar spread do token:', error);
        }
      };

      checkTokenSpread();
    }
  }, [externalSelectedToken]);

  // Monitorar todos os tokens e escolher o melhor spread automaticamente
  useEffect(() => {
    if (!autoConvertEnabled) return;

    const fetchAllPrices = async () => {
      try {
        // Buscar preços Binance para todos os tokens
        const symbols = availableTokens.map(t => `${t}USDT`);
        const { data: binanceData } = await supabase.functions.invoke('binance-market-data', {
          body: { action: 'tickers', symbols }
        });

        // Buscar preços OKX
        const { data: okxData } = await supabase.functions.invoke('okx-api', {
          body: { action: 'get_prices' }
        });

        if (binanceData?.success && okxData?.success) {
          const spreads: TokenSpreadData[] = [];

          // Calcular spreads para todos os tokens
          for (const token of availableTokens) {
            const symbol = `${token}USDT`;
            const binancePrice = binanceData.data?.[symbol]?.lastPrice || binanceData.data?.[symbol]?.price || 0;
            const okxPrice = okxData.data?.[token] || 0;

            if (binancePrice > 0 && okxPrice > 0) {
              const spread = ((okxPrice - binancePrice) / binancePrice) * 100;
              spreads.push({
                symbol: token,
                binancePrice,
                okxPrice,
                spread,
                absSpread: Math.abs(spread)
              });
            }
          }

          // Ordenar por spread absoluto (maior primeiro)
          spreads.sort((a, b) => b.absSpread - a.absSpread);

          // Pegar o melhor token
          const best = spreads[0];
          if (best) {
            setBestToken(best);
            setInternalSelectedToken(best.symbol);
            setTokenPrices({ 
              binance: best.binancePrice, 
              okx: best.okxPrice, 
              spread: best.spread 
            });

            console.log(`🔍 Análise de ${spreads.length} tokens - Melhor: ${best.symbol} (${best.spread.toFixed(3)}%)`);
            
            // Se o melhor spread for > 0.3%, executar conversão
            if (best.absSpread > 0.3 && !isProcessing) {
              console.log(`✅ Melhor oportunidade encontrada: ${best.symbol} com ${best.spread.toFixed(3)}% spread!`);
              await executeAutoConversion(best.binancePrice, best.okxPrice, best.symbol);
            } else {
              console.log(`⏸️ Melhor spread disponível: ${best.symbol} (${best.spread.toFixed(3)}%) - aguardando threshold > 0.3%`);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar preços:', error);
      }
    };

    fetchAllPrices();
    const interval = setInterval(fetchAllPrices, 15000);

    return () => clearInterval(interval);
  }, [autoConvertEnabled, isProcessing]);

  const executeAutoConversion = async (binancePrice: number, okxPrice: number, tokenSymbol?: string) => {
    const token = tokenSymbol || selectedToken;
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
      const binanceToken = portfolio.find((i: any) => i.exchange === 'Binance' && i.symbol === token);
      const okxToken = portfolio.find((i: any) => i.exchange === 'OKX' && i.symbol === token);
      const binanceUSDT = portfolio.find((i: any) => i.exchange === 'Binance' && i.symbol === 'USDT');
      const okxUSDT = portfolio.find((i: any) => i.exchange === 'OKX' && i.symbol === 'USDT');

      const binanceTokenBalance = binanceToken ? parseFloat(binanceToken.balance) : 0;
      const okxTokenBalance = okxToken ? parseFloat(okxToken.balance) : 0;
      const binanceUSDTBalance = binanceUSDT ? parseFloat(binanceUSDT.balance) : 0;
      const okxUSDTBalance = okxUSDT ? parseFloat(okxUSDT.balance) : 0;

      console.log(`💰 Saldos - Binance: ${binanceTokenBalance} ${token}, ${binanceUSDTBalance} USDT`);
      console.log(`💰 Saldos - OKX: ${okxTokenBalance} ${token}, ${okxUSDTBalance} USDT`);
      console.log(`📊 Preços - Binance: $${binancePrice}, OKX: $${okxPrice}, Spread: ${tokenPrices.spread.toFixed(3)}%`);

      const minNotionalUSD = 10;
      let result, error, executedAction;

      // Decidir estratégia baseado no spread (comprar no mais barato ou vender no mais caro)
      if (okxPrice > binancePrice && tokenPrices.spread > 0.3) {
        // OKX mais caro: preferir vender token na OKX; se não tiver token, comprar na Binance com USDT
        const minTokenNeeded = minNotionalUSD / okxPrice;

        if (okxTokenBalance >= minTokenNeeded) {
        console.log(`🎯 Executando: Vender ${token} → USDT na OKX ($${okxPrice}) [LIMIT ORDER]`);
          const response = await supabase.functions.invoke('okx-swap-token', {
            body: {
              apiKey: okxCreds.api_key,
              secretKey: okxCreds.secret_key,
              passphrase: okxCreds.passphrase,
              symbol: token,
              direction: 'toUsdt',
              orderType: 'limit'
            }
          });
          result = response.data;
          error = response.error;
          executedAction = `${token} → USDT (OKX)`;
          console.log('📊 Resultado OKX:', result);
        } else if (binanceUSDTBalance >= minNotionalUSD) {
          const buyAmountUsd = Math.min(binanceUSDTBalance, minNotionalUSD);
          console.log(`🟦 Alternativa: Comprar ${token} com ${buyAmountUsd} USDT na Binance (preço $${binancePrice}) [LIMIT ORDER]`);
          const response = await supabase.functions.invoke('binance-swap-token', {
            body: {
              apiKey: binanceCreds.api_key,
              secretKey: binanceCreds.secret_key,
              symbol: token,
              direction: 'toToken',
              customAmount: buyAmountUsd,
              orderType: 'limit'
            }
          });
          result = response.data;
          error = response.error;
          executedAction = `USDT → ${token} (Binance)`;
          console.log('📊 Resultado Binance (compra):', result);
        } else {
          console.log(`❌ Saldo insuficiente para operar: token OKX (${okxTokenBalance}) e USDT Binance (${binanceUSDTBalance})`);
          toast.warning(`Saldo insuficiente para operar ${token}`, {
            description: `Necessário ≥ ${minNotionalUSD} USDT ou ${minTokenNeeded.toFixed(6)} ${token}`,
            duration: 5000
          });
          return;
        }

      } else if (binancePrice > okxPrice && Math.abs(tokenPrices.spread) > 0.3) {
        // Binance mais caro: preferir vender token na Binance; se não tiver token, comprar na OKX com USDT
        const minTokenNeeded = minNotionalUSD / binancePrice;

        if (binanceTokenBalance >= minTokenNeeded) {
          console.log(`🎯 Executando: Vender ${token} → USDT na Binance ($${binancePrice}) [LIMIT ORDER]`);
          const response = await supabase.functions.invoke('binance-swap-token', {
            body: {
              apiKey: binanceCreds.api_key,
              secretKey: binanceCreds.secret_key,
              symbol: token,
              direction: 'toUsdt',
              orderType: 'limit'
            }
          });
          result = response.data;
          error = response.error;
          executedAction = `${token} → USDT (Binance)`;
          console.log('📊 Resultado Binance:', result);
        } else if (okxUSDTBalance >= minNotionalUSD) {
          const buyAmountUsd = Math.min(okxUSDTBalance, minNotionalUSD);
          console.log(`🟧 Alternativa: Comprar ${token} com ${buyAmountUsd} USDT na OKX (preço $${okxPrice}) [LIMIT ORDER]`);
          const response = await supabase.functions.invoke('okx-swap-token', {
            body: {
              apiKey: okxCreds.api_key,
              secretKey: okxCreds.secret_key,
              passphrase: okxCreds.passphrase,
              symbol: token,
              direction: 'toToken',
              customAmount: buyAmountUsd,
              orderType: 'limit'
            }
          });
          result = response.data;
          error = response.error;
          executedAction = `USDT → ${token} (OKX)`;
          console.log('📊 Resultado OKX (compra):', result);
        } else {
          console.log(`❌ Saldo insuficiente para operar: token Binance (${binanceTokenBalance}) e USDT OKX (${okxUSDTBalance})`);
          toast.warning(`Saldo insuficiente para operar ${token}`, {
            description: `Necessário ≥ ${minNotionalUSD} USDT ou ${minTokenNeeded.toFixed(6)} ${token}`,
            duration: 5000
          });
          return;
        }
      } else {
        console.log(`⏸️ Spread insuficiente (${tokenPrices.spread.toFixed(3)}%) - aguardando melhor oportunidade`);
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
            <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 rounded border border-primary/20">
              <ArrowRightLeft className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-primary">{selectedToken}</span>
            </div>
            
            <Label htmlFor="auto-convert" className="text-sm font-normal cursor-pointer flex items-center gap-1">
              <Zap className={`h-4 w-4 ${autoConvertEnabled ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
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
              <div className="flex items-center gap-2">
                <RefreshCw className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''} text-primary`} />
                <span className="text-primary font-medium">
                  {isProcessing ? 'Executando conversão...' : `Escaneando ${availableTokens.length} tokens`}
                </span>
                {bestToken && !isProcessing && (
                  <span className="text-green-500 font-bold">
                    {bestToken.symbol}: {bestToken.spread > 0 ? '+' : ''}{bestToken.spread.toFixed(3)}%
                  </span>
                )}
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