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

  // Função para forçar limpeza imediata e iniciar conversões
  const forceCleanupAndStart = async () => {
    if (isProcessing) {
      toast.info('Aguarde a operação atual finalizar');
      return;
    }
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      toast.info('🧹 Iniciando limpeza forçada de tokens indesejados...');

      // Buscar credenciais
      const [{ data: binanceCreds }, { data: okxCreds }] = await Promise.all([
        supabase
          .from('exchange_api_configs')
          .select('*')
          .eq('user_id', user.id)
          .eq('exchange', 'binance')
          .eq('is_active', true)
          .maybeSingle(),
        supabase
          .from('exchange_api_configs')
          .select('*')
          .eq('user_id', user.id)
          .eq('exchange', 'okx')
          .eq('is_active', true)
          .maybeSingle()
      ]);

      if (!binanceCreds || !okxCreds) {
        toast.error('Credenciais não encontradas');
        return;
      }

      // Buscar portfólio atual
      const { data: portfolioData } = await supabase.functions.invoke('get-portfolio', {
        body: { user_id: user.id, real_mode: true, force_refresh: true }
      });

      if (!portfolioData?.success) {
        toast.error('Erro ao buscar portfólio');
        return;
      }

      const portfolio = portfolioData.data.portfolio;
      
      // Filtrar tokens para limpeza (tudo exceto USDT e token selecionado)
      const binanceToClean = portfolio.filter((i: any) => 
        i.exchange === 'Binance' && 
        i.symbol !== 'USDT' && 
        i.symbol !== selectedToken &&
        parseFloat(i.balance) > 0
      );
      
      const okxToClean = portfolio.filter((i: any) => 
        i.exchange === 'OKX' && 
        i.symbol !== 'USDT' && 
        i.symbol !== selectedToken &&
        parseFloat(i.balance) > 0
      );

      const totalToClean = binanceToClean.length + okxToClean.length;
      
      if (totalToClean === 0) {
        toast.success('✅ Nenhum token indesejado encontrado. Pronto para operar!');
        setIsProcessing(false);
        return;
      }

      console.log(`🧹 LIMPEZA FORÇADA: ${totalToClean} tokens serão convertidos para USDT`);
      console.log(`   Binance: ${binanceToClean.map((t: any) => `${t.symbol} (${t.balance})`).join(', ') || 'nenhum'}`);
      console.log(`   OKX: ${okxToClean.map((t: any) => `${t.symbol} (${t.balance})`).join(', ') || 'nenhum'}`);

      // Contadores para feedback correto ao usuário
      let successCount = 0;
      const failedTokens: { exchange: 'Binance' | 'OKX'; symbol: string; error?: string }[] = [];

      // Converter tokens da Binance para USDT
      for (const token of binanceToClean) {
        try {
          console.log(`🔄 Convertendo ${token.balance} ${token.symbol} → USDT na Binance (MARKET)...`);
          toast.info(`🔄 Convertendo ${token.symbol} na Binance...`);
          
          const { data: result } = await supabase.functions.invoke('binance-swap-token', {
            body: {
              apiKey: binanceCreds.api_key,
              secretKey: binanceCreds.secret_key,
              symbol: token.symbol,
              direction: 'toUsdt',
              orderType: 'limit'
            }
          });
          
          if (result?.success) {
            successCount++;
            await saveConversionRecord({
              fromToken: token.symbol,
              toToken: 'USDT',
              fromAmount: token.balance,
              toAmount: result.usdtReceived || 0,
              exchange: 'Binance',
              conversionType: 'market',
              price: result.price || result.avgPrice || 0,
              status: 'success'
            });
            console.log(`✅ ${token.symbol} convertido: ${result.usdtReceived} USDT`);
            toast.success(`✅ ${token.symbol} convertido na Binance`);
          } else {
            failedTokens.push({ exchange: 'Binance', symbol: token.symbol, error: result?.error });
            await saveConversionRecord({
              fromToken: token.symbol,
              toToken: 'USDT',
              fromAmount: token.balance,
              toAmount: 0,
              exchange: 'Binance',
              conversionType: 'market',
              price: 0,
              status: 'failed',
              errorMessage: result?.error || 'Falha desconhecida'
            });
            console.warn(`⚠️ Falha ao converter ${token.symbol} na Binance: ${result?.error || 'desconhecida'}`);
            toast.warning(`Falha na conversão ${token.symbol} (Binance)`, { description: result?.error || 'Verifique tamanho mínimo/notional.' });
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`❌ Erro ao converter ${token.symbol} na Binance:`, err);
          failedTokens.push({ exchange: 'Binance', symbol: token.symbol, error: err instanceof Error ? err.message : 'Erro desconhecido' });
          await saveConversionRecord({
            fromToken: token.symbol,
            toToken: 'USDT',
            fromAmount: token.balance,
            toAmount: 0,
            exchange: 'Binance',
            conversionType: 'market',
            price: 0,
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Erro desconhecido'
          });
        }
      }

      // Converter tokens da OKX para USDT
      for (const token of okxToClean) {
        try {
          console.log(`🔄 Convertendo ${token.balance} ${token.symbol} → USDT na OKX (MARKET)...`);
          toast.info(`🔄 Convertendo ${token.symbol} na OKX...`);
          
          const { data: result } = await supabase.functions.invoke('okx-swap-token', {
            body: {
              apiKey: okxCreds.api_key,
              secretKey: okxCreds.secret_key,
              passphrase: okxCreds.passphrase,
              symbol: token.symbol,
              direction: 'toUsdt',
              orderType: 'limit'
            }
          });
          
          if (result?.success) {
            successCount++;
            await saveConversionRecord({
              fromToken: token.symbol,
              toToken: 'USDT',
              fromAmount: token.balance,
              toAmount: result.usdtReceived || 0,
              exchange: 'OKX',
              conversionType: 'market',
              price: result.price || 0,
              status: 'success'
            });
            console.log(`✅ ${token.symbol} convertido: ${result.usdtReceived} USDT`);
            toast.success(`✅ ${token.symbol} convertido na OKX`);
          } else {
            failedTokens.push({ exchange: 'OKX', symbol: token.symbol, error: result?.error });
            await saveConversionRecord({
              fromToken: token.symbol,
              toToken: 'USDT',
              fromAmount: token.balance,
              toAmount: 0,
              exchange: 'OKX',
              conversionType: 'market',
              price: 0,
              status: 'failed',
              errorMessage: result?.error || 'Falha desconhecida'
            });
            console.warn(`⚠️ Falha ao converter ${token.symbol} na OKX: ${result?.error || 'desconhecida'}`);
            toast.warning(`Falha na conversão ${token.symbol} (OKX)`, { description: result?.error || 'Possível tamanho mínimo não atingido.' });
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (err) {
          console.error(`❌ Erro ao converter ${token.symbol} na OKX:`, err);
          failedTokens.push({ exchange: 'OKX', symbol: token.symbol, error: err instanceof Error ? err.message : 'Erro desconhecido' });
          await saveConversionRecord({
            fromToken: token.symbol,
            toToken: 'USDT',
            fromAmount: token.balance,
            toAmount: 0,
            exchange: 'OKX',
            conversionType: 'market',
            price: 0,
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : 'Erro desconhecido'
          });
        }
      }

      const totalFailed = failedTokens.length;
      const totalConverted = successCount;
      if (totalConverted > 0) {
        toast.success(`✅ Limpeza concluída`, { description: `${totalConverted} conversões realizadas${totalFailed ? `, ${totalFailed} falhas` : ''}` });
      }
      if (totalFailed > 0) {
        const list = failedTokens.map(f => `${f.symbol} (${f.exchange})`).join(', ');
        toast.warning('Alguns tokens não foram convertidos', { description: `${list}. Verifique tamanho mínimo/notional ou saldo disponível.` });
      }
      
      // Aguardar execução das ordens
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Atualizar lista de tokens
      await fetchAllTokens();
      
      toast.info(`🔍 Buscando oportunidades de arbitragem para ${selectedToken}...`);
      
    } catch (error) {
      console.error('Erro na limpeza forçada:', error);
      toast.error('Erro ao executar limpeza');
    } finally {
      setIsProcessing(false);
    }
  };

  // Acionar conversões quando token externo mudar OU quando o componente montar
  useEffect(() => {
    if (externalSelectedToken && externalSelectedToken !== 'USDT' && !isProcessing) {
      console.log(`🔄 Token selecionado: ${externalSelectedToken}. Use o botão "Forçar Limpeza" para converter tokens indesejados.`);
      
      const convertOldTokensAndBuyNew = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

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
            console.log('⚠️ Credenciais não encontradas');
            return;
          }

          // Buscar todos os tokens atuais
          const { data: portfolioData } = await supabase.functions.invoke('get-portfolio', {
            body: { user_id: user.id, real_mode: true, force_refresh: true }
          });

          if (!portfolioData?.success) return;

          const portfolio = portfolioData.data.portfolio;
          
          // CRÍTICO: Filtrar TODOS os tokens diferentes do selecionado e USDT (incluindo BTC)
          const binanceOldTokens = portfolio.filter((i: any) => 
            i.exchange === 'Binance' && 
            i.symbol !== 'USDT' && 
            i.symbol !== externalSelectedToken &&
            parseFloat(i.balance) > 0
          );
          
          const okxOldTokens = portfolio.filter((i: any) => 
            i.exchange === 'OKX' && 
            i.symbol !== 'USDT' && 
            i.symbol !== externalSelectedToken &&
            parseFloat(i.balance) > 0
          );

          console.log(`🔍 Tokens a limpar - Binance: ${binanceOldTokens.map((t: any) => t.symbol).join(', ') || 'nenhum'}`);
          console.log(`🔍 Tokens a limpar - OKX: ${okxOldTokens.map((t: any) => t.symbol).join(', ') || 'nenhum'}`);

          // Alerta especial se BTC for detectado
          const btcInBinance = binanceOldTokens.find((t: any) => t.symbol === 'BTC');
          const btcInOkx = okxOldTokens.find((t: any) => t.symbol === 'BTC');
          if (btcInBinance || btcInOkx) {
            console.log(`🚨 BTC DETECTADO! Será convertido para USDT.`);
            if (btcInBinance) console.log(`   - Binance: ${btcInBinance.balance} BTC`);
            if (btcInOkx) console.log(`   - OKX: ${btcInOkx.balance} BTC`);
          }

          // Se houver tokens antigos, converter para USDT
          if (binanceOldTokens.length > 0 || okxOldTokens.length > 0) {
            console.log(`🧹 LIMPEZA: Convertendo ${binanceOldTokens.length + okxOldTokens.length} tokens indesejados para USDT...`);
            
            // Converter tokens antigos da Binance
            for (const token of binanceOldTokens) {
              try {
                console.log(`🔄 Convertendo ${token.symbol} → USDT na Binance...`);
                const { data: result } = await supabase.functions.invoke('binance-swap-token', {
                  body: {
                    apiKey: binanceCreds.api_key,
                    secretKey: binanceCreds.secret_key,
                    symbol: token.symbol,
                    direction: 'toUsdt',
                    orderType: 'market'
                  }
                });
                
                if (result?.success) {
                  await saveConversionRecord({
                    fromToken: token.symbol,
                    toToken: 'USDT',
                    fromAmount: token.balance,
                    toAmount: result.usdtReceived || 0,
                    exchange: 'Binance',
                    conversionType: 'market',
                    price: result.price || 0,
                    status: 'success'
                  });
                  console.log(`✅ ${token.symbol} convertido na Binance`);
                }
              } catch (err) {
                await saveConversionRecord({
                  fromToken: token.symbol,
                  toToken: 'USDT',
                  fromAmount: token.balance,
                  toAmount: 0,
                  exchange: 'Binance',
                  conversionType: 'market',
                  price: 0,
                  status: 'failed',
                  errorMessage: err instanceof Error ? err.message : 'Erro desconhecido'
                });
                console.error(`❌ Erro ao converter ${token.symbol}:`, err);
              }
            }

            // Converter tokens antigos da OKX
            for (const token of okxOldTokens) {
              try {
                console.log(`🔄 Convertendo ${token.symbol} → USDT na OKX...`);
                const { data: result } = await supabase.functions.invoke('okx-swap-token', {
                  body: {
                    apiKey: okxCreds.api_key,
                    secretKey: okxCreds.secret_key,
                    passphrase: okxCreds.passphrase,
                    symbol: token.symbol,
                    direction: 'toUsdt',
                    orderType: 'market'
                  }
                });
                
                if (result?.success) {
                  await saveConversionRecord({
                    fromToken: token.symbol,
                    toToken: 'USDT',
                    fromAmount: token.balance,
                    toAmount: result.usdtReceived || 0,
                    exchange: 'OKX',
                    conversionType: 'market',
                    price: result.price || 0,
                    status: 'success'
                  });
                  console.log(`✅ ${token.symbol} convertido na OKX`);
                }
              } catch (err) {
                await saveConversionRecord({
                  fromToken: token.symbol,
                  toToken: 'USDT',
                  fromAmount: token.balance,
                  toAmount: 0,
                  exchange: 'OKX',
                  conversionType: 'market',
                  price: 0,
                  status: 'failed',
                  errorMessage: err instanceof Error ? err.message : 'Erro desconhecido'
                });
                console.error(`❌ Erro ao converter ${token.symbol}:`, err);
              }
            }

            toast.info(`🧹 Tokens antigos convertidos para USDT`, {
              description: `${binanceOldTokens.length + okxOldTokens.length} tokens limpos. Aguarde para comprar ${externalSelectedToken}...`,
              duration: 5000
            });

            // Aguardar execução das ordens
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // Buscar preços e executar compra do novo token
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
            }
          }
        } catch (error) {
          console.error('Erro ao processar mudança de token:', error);
        }
      };

      convertOldTokensAndBuyNew();
    }
  }, [externalSelectedToken]);

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
        
        {/* Botão de Limpeza Forçada */}
        <Button 
          onClick={forceCleanupAndStart}
          disabled={isProcessing || !selectedToken || selectedToken === 'USDT'}
          className="w-full mt-2"
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isProcessing ? 'animate-spin' : ''}`} />
          {isProcessing ? 'Processando...' : '🧹 Forçar Limpeza e Iniciar'}
        </Button>
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