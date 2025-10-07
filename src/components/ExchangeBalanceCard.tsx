import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCachedPrice } from '@/hooks/useCachedPrice';
import { TokenFilter } from './TokenFilter';
import { TokenSwapDialog } from './TokenSwapDialog';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  ArrowRightLeft,
  Wallet,
  Minus,
  Filter,
  Repeat,
  Zap,
  Settings,
  Circle,
  Scale,
  Clock,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  otherExchangePrice?: number; // Preço do token na outra exchange para comparação
  onPriceUpdate?: (price: number) => void; // Callback para enviar preço atualizado
  selectedToken?: string; // Token selecionado externamente
  onTokenChange?: (token: string) => void; // Callback quando token muda
}

export const ExchangeBalanceCard = ({ 
  exchange, 
  baseline = 100,
  onBalanceChange,
  otherExchangePrice,
  onPriceUpdate,
  selectedToken: externalSelectedToken,
  onTokenChange
}: ExchangeBalanceCardProps) => {
  const { toast } = useToast();
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [internalSelectedToken, setInternalSelectedToken] = useState<string>('SOL');
  const [showTokenFilter, setShowTokenFilter] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);
  const [rebalancing, setRebalancing] = useState(false);
  const [operationLogs, setOperationLogs] = useState<any[]>([]);

  // Usar token externo se fornecido, senão usar interno
  const selectedToken = externalSelectedToken || internalSelectedToken;

  const exchangeNames = {
    binance: 'Binance',
    okx: 'OKX'
  };

  // Sincronizar token externo com interno quando mudar
  useEffect(() => {
    if (externalSelectedToken && externalSelectedToken !== internalSelectedToken) {
      console.log(`🔄 Sincronizando token de ${internalSelectedToken} para ${externalSelectedToken} na ${exchangeNames[exchange]}`);
      setInternalSelectedToken(externalSelectedToken);
    }
  }, [externalSelectedToken]);

  // Forçar refresh dos balances quando o dialog de swap é aberto
  useEffect(() => {
    if (showSwapDialog) {
      console.log(`🔄 Dialog de swap aberto - Forçando refresh dos saldos da ${exchangeNames[exchange]}`);
      fetchBalances(true);
    }
  }, [showSwapDialog]);

  // Auto-refresh dos saldos a cada 10 segundos
  useEffect(() => {
    fetchBalances();
    fetchOperationLogs();
    
    const interval = setInterval(() => {
      fetchBalances(true);
      fetchOperationLogs();
    }, 10000); // 10 segundos

    // Listener para sincronização forçada via evento global
    const handleBalanceSync = () => {
      console.log(`🔄 Evento de sincronização recebido - Atualizando ${exchangeNames[exchange]}`);
      fetchBalances(true);
      fetchOperationLogs();
    };

    window.addEventListener('balances-synced', handleBalanceSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('balances-synced', handleBalanceSync);
    };
  }, [exchange]);

  // Função para formatar números no padrão brasileiro
  const formatBRL = (value: number, decimals: number = 2): string => {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const fetchOperationLogs = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const exchangeName = exchange === 'binance' ? 'Binance' : 'OKX';
      
      const { data, error } = await supabase
        .from('conversion_history')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('exchange', exchangeName)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setOperationLogs(data);
      }
    } catch (error) {
      console.error('Erro ao buscar logs:', error);
    }
  };

  const fetchBalances = async (forceRefresh = false) => {
    setLoading(true);
    try {
      // Buscar sessão ativa primeiro
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.warn('⚠️ Sessão não encontrada, tentando obter usuário...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.error('❌ Erro de autenticação:', userError);
          return; // Silenciosamente falhar sem toast para evitar spam
        }
      }
      
      const user = session?.user;

      // Buscar portfolio do banco de dados usando o user_id real
      const { data: portfolioData, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          user_id: user.id,
          real_mode: true,
          force_refresh: forceRefresh
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

      console.log(`✅ Saldos atualizados da ${exchangeNames[exchange]}: $${total.toFixed(2)}`);

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
    console.log('🔄 Iniciando conversão para USDT...');
    setConverting(true);
    
    try {
      // Verificar sessão antes de continuar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.error('❌ Usuário não autenticado');
        toast({
          title: "⚠️ Sessão expirada",
          description: "Por favor, faça login novamente",
          variant: "destructive"
        });
        return;
      }
      
      const user = session.user;

      console.log(`🔍 Buscando credenciais para ${exchangeNames[exchange]}...`);
      
      const { data: configData, error: configError } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', exchange)
        .eq('is_active', true)
        .maybeSingle();

      console.log('📋 Resultado da busca:', { configData, configError });

      if (configError) {
        console.error('❌ Erro ao buscar credenciais:', configError);
        throw new Error(`Erro ao buscar credenciais: ${configError.message}`);
      }

      if (!configData) {
        console.error('❌ Credenciais não encontradas');
        toast({
          title: "⚠️ Credenciais não configuradas",
          description: `Configure suas credenciais da ${exchangeNames[exchange]} na aba "Configuração API" em Controle de Arbitragem.`,
          variant: "destructive",
          duration: 7000
        });
        throw new Error(`Credenciais da ${exchangeNames[exchange]} não configuradas no banco de dados.`);
      }

      const credentials = {
        apiKey: configData.api_key,
        secretKey: configData.secret_key,
        passphrase: configData.passphrase
      };

      console.log('✅ Credenciais encontradas, iniciando conversão...');

      // Se tiver token selecionado no filtro, converter apenas ele
      if (showTokenFilter && selectedToken && selectedToken !== 'USDT') {
        const tokenBalance = balances.find(b => b.symbol === selectedToken);
        
        if (!tokenBalance || tokenBalance.balance <= 0) {
          throw new Error(`Saldo insuficiente de ${selectedToken}`);
        }

        console.log(`🎯 Convertendo apenas ${selectedToken} para USDT...`);

        toast({
          title: "🔄 Convertendo para USDT",
          description: `Convertendo ${selectedToken} para USDT na ${exchangeNames[exchange]}...`,
        });

        const functionName = exchange === 'binance' 
          ? 'binance-swap-token' 
          : 'okx-swap-token';

        console.log(`📡 Chamando edge function: ${functionName} com token: ${selectedToken}`);

        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { 
            ...credentials, 
            symbol: selectedToken, 
            direction: 'toUsdt'
          }
        });

        console.log('📬 Resposta da edge function:', { data, error });

        if (error) {
          console.error('❌ Erro na edge function:', error);
          throw error;
        }

        if (data.success) {
          console.log('✅ Conversão bem-sucedida!');
          toast({
            title: "✅ Conversão concluída!",
            description: `${selectedToken} convertido para USDT com sucesso! Atualizando saldos...`,
          });
          
          // Aguardar 2 segundos para a exchange processar
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Forçar atualização dos saldos com refresh
          await fetchBalances(true);
          
          // Atualizar logs
          await fetchOperationLogs();
          
          toast({
            title: "🔄 Saldos atualizados",
            description: "Os saldos foram sincronizados com a exchange",
          });
        } else {
          console.error('❌ Erro retornado pela função:', data.error);
          throw new Error(data.error || 'Erro na conversão');
        }
      } else {
        // Converter todos os tokens para USDT (comportamento original)
        toast({
          title: "🔄 Convertendo para USDT",
          description: `Convertendo todos os tokens na ${exchangeNames[exchange]}...`,
        });

        const functionName = exchange === 'binance' 
          ? 'binance-convert-to-usdt' 
          : 'okx-convert-to-usdt';

        console.log(`📡 Chamando edge function: ${functionName}`);

        const { data, error } = await supabase.functions.invoke(functionName, {
          body: { ...credentials, minUsdValue: 5 }
        });

        console.log('📬 Resposta da edge function:', { data, error });

        if (error) {
          console.error('❌ Erro na edge function:', error);
          throw error;
        }

        if (data.success) {
          console.log('✅ Conversão bem-sucedida!');
          toast({
            title: "✅ Conversão concluída!",
            description: `Total: ${data.totalUsdtReceived?.toFixed(2)} USDT recebido. Atualizando saldos...`,
          });
          
          // Aguardar 2 segundos para a exchange processar
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Forçar atualização dos saldos com refresh
          await fetchBalances(true);
          
          // Atualizar logs
          await fetchOperationLogs();
          
          toast({
            title: "🔄 Saldos atualizados",
            description: "Os saldos foram sincronizados com a exchange",
          });
        } else {
          console.error('❌ Erro retornado pela função:', data.error);
          throw new Error(data.error || 'Erro na conversão');
        }
      }

    } catch (error: any) {
      console.error('❌ Erro na conversão:', error);
      toast({
        title: "❌ Erro na conversão",
        description: error.message || 'Erro desconhecido ao converter tokens',
        variant: "destructive"
      });
    } finally {
      console.log('🏁 Finalizando conversão...');
      setConverting(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    fetchOperationLogs();
    const balanceInterval = setInterval(fetchBalances, 60000); // Atualiza a cada 60s
    const logsInterval = setInterval(fetchOperationLogs, 30000); // Atualiza logs a cada 30s
    return () => {
      clearInterval(balanceInterval);
      clearInterval(logsInterval);
    };
  }, [exchange]);

  // Notificar mudança de token selecionado para o pai
  useEffect(() => {
    if (onTokenChange && internalSelectedToken !== externalSelectedToken && internalSelectedToken) {
      console.log(`🔄 Token alterado para ${internalSelectedToken} na ${exchangeNames[exchange]}`);
      onTokenChange(internalSelectedToken);
    }
  }, [internalSelectedToken]);

  const handleSwapToken = async () => {
    setSwapping(true);
    try {
      // Verificar sessão antes de continuar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "⚠️ Sessão expirada",
          description: "Por favor, faça login novamente",
          variant: "destructive"
        });
        setSwapping(false);
        return;
      }
      
      const user = session.user;

      const { data: configData, error: configError } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', exchange)
        .eq('is_active', true)
        .maybeSingle();

      if (configError || !configData) {
        throw new Error(`Credenciais da ${exchangeNames[exchange]} não configuradas no banco de dados`);
      }

      const credentials = {
        apiKey: configData.api_key,
        secretKey: configData.secret_key,
        passphrase: configData.passphrase
      };

      // Verificar se tem saldo do token ou de USDT
      const tokenBalance = balances.find(b => b.symbol === selectedToken);
      const usdtBalance = balances.find(b => b.symbol === 'USDT');

      let direction = 'toToken'; // Padrão: USDT → Token
      
      // Se tem saldo do token, converter para USDT
      if (tokenBalance && tokenBalance.balance > 0) {
        direction = 'toUsdt';
      } else if (!usdtBalance || usdtBalance.balance <= 0) {
        throw new Error('Saldo insuficiente para conversão');
      }

      const directionLabel = direction === 'toUsdt' 
        ? `${selectedToken} → USDT` 
        : `USDT → ${selectedToken}`;

      toast({
        title: "🔄 Convertendo",
        description: `${directionLabel}...`,
      });

      const functionName = exchange === 'binance' 
        ? 'binance-swap-token' 
        : 'okx-swap-token';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { ...credentials, symbol: selectedToken, direction }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Conversão concluída!",
          description: `${data.message}. Atualizando saldos...`,
        });
        
        // Aguardar 2 segundos para a exchange processar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Forçar atualização dos saldos com refresh
        await fetchBalances(true);
        
        // Atualizar logs
        await fetchOperationLogs();
        
        toast({
          title: "🔄 Saldos atualizados",
          description: "Os saldos foram sincronizados com a exchange",
        });
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
      setSwapping(false);
    }
  };

  const handleSwapComplete = async () => {
    // Aguardar 2 segundos para a exchange processar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Forçar atualização dos saldos com refresh
    await fetchBalances(true);
    
    // Atualizar logs
    await fetchOperationLogs();
    
    toast({
      title: "🔄 Saldos atualizados",
      description: "Os saldos foram sincronizados com a exchange",
    });
  };

  // Usar hook de cache para preços (evita sobrecarga de requisições)
  const { price: cachedPrice, change24h: cachedChange } = useCachedPrice(selectedToken, exchange);

  // Sincronizar preços do cache com o estado local
  useEffect(() => {
    if (cachedPrice !== null) {
      setRealtimePrice(cachedPrice);
    }
    if (cachedChange !== null) {
      setPriceChange24h(cachedChange);
    }
  }, [cachedPrice, cachedChange]);

  // Não precisa mais de intervalo - o hook useCachedPrice já gerencia isso

  // Notificar preço atualizado ao componente pai
  useEffect(() => {
    if (realtimePrice && onPriceUpdate) {
      onPriceUpdate(realtimePrice);
    }
  }, [realtimePrice, onPriceUpdate]);

  const handleRebalance = async () => {
    setRebalancing(true);
    try {
      // Verificar sessão antes de continuar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "⚠️ Sessão expirada",
          description: "Por favor, faça login novamente",
          variant: "destructive"
        });
        return;
      }
      
      const user = session.user;

      const exchangeName = exchange === 'binance' ? 'Binance' : 'OKX';

      console.log(`🔄 Iniciando rebalanceamento manual na ${exchangeName}...`);
      
      toast({
        title: "🔄 Rebalanceando Carteira",
        description: `Iniciando rebalanceamento na ${exchangeName}...`,
      });

      const { data, error } = await supabase.functions.invoke('smart-rebalance', {
        body: { 
          userId: user.id,
          targetAllocations: {
            'USDT': 25,
            'BTC': 25,
            'ETH': 25,
            'SOL': 25
          },
          maxDeviation: 10,
          minTradeValue: 10,
          specificExchange: exchangeName
        }
      });

      console.log('📊 Resultado do rebalanceamento:', data);

      if (error) {
        console.error('❌ Erro no rebalanceamento:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Falha no rebalanceamento');
      }

      toast({
        title: "✅ Rebalanceamento Concluído",
        description: `${data.conversions || 0} conversões executadas na ${exchangeName}!`,
      });

      // Aguardar e atualizar saldos
      await new Promise(resolve => setTimeout(resolve, 2000));
      await fetchBalances(true);
      await fetchOperationLogs();

    } catch (error: any) {
      console.error('❌ Erro no rebalanceamento:', error);
      toast({
        title: "❌ Erro no Rebalanceamento",
        description: error.message || "Falha ao rebalancear portfólio",
        variant: "destructive"
      });
    } finally {
      setRebalancing(false);
    }
  };

  const profitLoss = totalValue - baseline;
  const profitLossPercent = baseline > 0 ? (profitLoss / baseline) * 100 : 0;
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;

  // Filtrar balance do token selecionado
  const selectedTokenBalance = balances.find(b => b.symbol === selectedToken);

  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            <span>{exchangeNames[exchange]}</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTokenFilter(!showTokenFilter)}
              className="h-8 px-2"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Badge variant={exchange === 'binance' ? 'default' : 'secondary'}>
              Conectado
            </Badge>
          </div>
        </div>
        
        {showTokenFilter && (
          <div className="mt-3">
            <TokenFilter
              selectedToken={selectedToken}
              onTokenChange={(token) => {
                setInternalSelectedToken(token);
                if (onTokenChange) {
                  onTokenChange(token);
                }
              }}
              showOnlyUptrend={true}
            />
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Preço em Tempo Real do Token Selecionado */}
        <div className="p-3 border rounded-lg bg-muted/20 relative gpu-accelerated" style={{ minHeight: '60px' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 price-stable" style={{ minWidth: '120px' }}>
              <span className="text-sm font-medium text-muted-foreground">{selectedToken}</span>
              {priceChange24h !== null && (
                <Badge className={priceChange24h >= 0 ? "bg-green-500 text-white" : "bg-red-500 text-white"} style={{ willChange: 'auto' }}>
                  {priceChange24h >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {`${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`}
                </Badge>
              )}
            </div>
            <div className="text-right flex items-center gap-2 justify-end price-stable" style={{ minWidth: '140px' }}>
              {realtimePrice ? (
                <>
                  {/* Indicador de preço comparativo */}
                  {otherExchangePrice && Math.abs(realtimePrice - otherExchangePrice) > 0.01 && (
                    <Circle 
                      className={`h-4 w-4 flex-shrink-0 ${
                        realtimePrice < otherExchangePrice 
                          ? 'fill-green-500 text-green-500' 
                          : 'fill-red-500 text-red-500'
                      }`}
                    />
                  )}
                  <p className="text-lg font-bold tabular-nums price-transition gpu-accelerated" style={{ 
                    willChange: 'auto',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    ${formatBRL(realtimePrice, selectedToken === 'BTC' || selectedToken === 'ETH' ? 2 : 6)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              )}
            </div>
          </div>
        </div>
        {/* Total Value Display */}
        <div className="text-center py-4 border rounded-lg bg-muted/30">
          <p className="text-sm text-muted-foreground mb-1">Saldo Total</p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-3xl font-bold">
              US$ {formatBRL(totalValue)}
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
              {profitLoss >= 0 ? '+' : ''}{formatBRL(profitLoss)} USD ({profitLossPercent.toFixed(2)}%)
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">
              Base: ${formatBRL(baseline)}
            </p>
          </div>
        </div>

        {/* Token Selecionado (se filtro ativo) */}
        {showTokenFilter && selectedTokenBalance && (
          <div className="p-4 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
            <div className="flex items-center justify-between mb-2 min-h-[32px]">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">{selectedTokenBalance.symbol}</p>
                {priceChange24h !== null && (
                  <Badge className={priceChange24h >= 0 ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                    {priceChange24h >= 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {`${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`}
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Preço em Tempo Real */}
            <div className="p-3 border rounded-lg bg-background gpu-accelerated" style={{ minHeight: '80px' }}>
              <p className="text-xs text-muted-foreground mb-1">💹 Preço em Tempo Real ({exchangeNames[exchange]})</p>
              <div className="flex items-center gap-2">
                {realtimePrice ? (
                  <>
                    <p className="text-2xl font-bold tabular-nums price-transition gpu-accelerated price-stable" style={{ 
                      willChange: 'auto',
                      fontVariantNumeric: 'tabular-nums'
                    }}>
                      ${formatBRL(realtimePrice, selectedToken === 'BTC' || selectedToken === 'ETH' ? 2 : 6)}
                    </p>
                    {priceChange24h !== null && (
                      <Badge variant={priceChange24h >= 0 ? "default" : "destructive"} className="text-xs" style={{ willChange: 'auto' }}>
                        24h: {`${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%`}
                      </Badge>
                    )}
                  </>
                ) : (
                  <p className="text-lg text-muted-foreground">Carregando preço...</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Saldo</p>
                <p className="font-semibold">{formatBRL(selectedTokenBalance.balance, 6)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Valor Total</p>
                <p className="font-semibold text-green-500">${formatBRL(selectedTokenBalance.valueUsd)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Preço Médio</p>
                <p className="font-semibold">${formatBRL(selectedTokenBalance.priceUsd)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Exchange</p>
                <p className="font-semibold">{exchangeNames[exchange]}</p>
              </div>
            </div>
            
            {/* Botão de Swap */}
            <Button
              onClick={() => setShowSwapDialog(true)}
              disabled={loading}
              className="w-full"
              size="sm"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Converter Tokens
            </Button>
          </div>
        )}

        {/* Assets List (quando filtro desabilitado ou resumo) */}
        {!showTokenFilter && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {balances.map((balance) => (
              <div 
                key={balance.symbol}
                className="flex items-center justify-between p-2 border rounded-md text-sm"
              >
                <div>
                  <p className="font-semibold">{balance.symbol}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(balance.balance, 6)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium">
                    ${formatBRL(balance.valueUsd)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    @${formatBRL(balance.priceUsd)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBalances(false)}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <Button
            variant="default"
            size="sm"
            onClick={handleConvertToUSDT}
            disabled={converting || loading}
          >
            <ArrowRightLeft className={`h-4 w-4 mr-2 ${converting ? 'animate-spin' : ''}`} />
            → USDT
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSwapDialog(true)}
            disabled={loading}
          >
            <Repeat className="h-4 w-4 mr-2" />
            Converter
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRebalance}
            disabled={rebalancing || loading}
            className="bg-primary/10 hover:bg-primary/20 border-primary/30"
            title={`Rebalancear portfólio na ${exchangeNames[exchange]}`}
          >
            {rebalancing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Scale className="h-4 w-4 mr-2" />
            )}
            {rebalancing ? 'Rebalanceando...' : 'Rebalancear'}
          </Button>
        </div>

        {/* Logs de Operações */}
        <div className="border-t pt-4 mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h4 className="text-sm font-semibold">Histórico de Operações</h4>
          </div>
          
          <ScrollArea className="h-32 w-full rounded-md border bg-muted/10">
            <div className="p-3 space-y-2">
              {operationLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhuma operação registrada ainda
                </p>
              ) : (
                operationLogs.map((log, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 p-2 rounded-md bg-background text-xs"
                  >
                    {log.status === 'success' ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {log.from_token} → {log.to_token}
                      </p>
                      <p className="text-muted-foreground">
                        {log.from_amount?.toFixed(4)} {log.from_token} = {log.to_amount?.toFixed(4)} {log.to_token}
                      </p>
                      <p className="text-muted-foreground text-[10px]">
                        {new Date(log.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {log.status === 'success' && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        Sucesso
                      </Badge>
                    )}
                    {log.status === 'failed' && (
                      <Badge variant="destructive" className="text-[10px] h-5">
                        Erro
                      </Badge>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>

      {/* Dialog de Conversão */}
      <TokenSwapDialog
        open={showSwapDialog}
        onOpenChange={setShowSwapDialog}
        exchange={exchange}
        balances={balances}
        onSwapComplete={handleSwapComplete}
      />
    </Card>
  );
};