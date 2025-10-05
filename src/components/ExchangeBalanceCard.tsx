import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  Repeat
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
  const [swapping, setSwapping] = useState(false);
  const [totalValue, setTotalValue] = useState(0);
  const [selectedToken, setSelectedToken] = useState<string>('BTC');
  const [showTokenFilter, setShowTokenFilter] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [realtimePrice, setRealtimePrice] = useState<number | null>(null);
  const [priceChange24h, setPriceChange24h] = useState<number | null>(null);

  const exchangeNames = {
    binance: 'Binance',
    okx: 'OKX'
  };

  const fetchBalances = async (forceRefresh = false) => {
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
          real_mode: true,
          force_refresh: forceRefresh // Adicionar parâmetro para forçar refresh
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

      const functionName = exchange === 'binance' 
        ? 'binance-convert-to-usdt' 
        : 'okx-convert-to-usdt';

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { ...credentials, minUsdValue: 5 }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Conversão concluída!",
          description: `Total: ${data.totalUsdtReceived?.toFixed(2)} USDT recebido. Atualizando saldos...`,
        });
        
        // Aguardar 2 segundos para a exchange processar
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Forçar atualização dos saldos com refresh
        await fetchBalances(true);
        
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
      setConverting(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    const interval = setInterval(fetchBalances, 60000); // Atualiza a cada 60s
    return () => clearInterval(interval);
  }, [exchange]);

  const handleSwapToken = async () => {
    setSwapping(true);
    try {
      const credsKey = `${exchange}_credentials`;
      const credsData = localStorage.getItem(credsKey);
      
      if (!credsData) {
        throw new Error(`Credenciais da ${exchangeNames[exchange]} não encontradas`);
      }

      const credentials = JSON.parse(credsData);

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
    
    toast({
      title: "🔄 Saldos atualizados",
      description: "Os saldos foram sincronizados com a exchange",
    });
  };

  // Buscar preço em tempo real do token selecionado
  const fetchRealtimePrice = async () => {
    if (!selectedToken) return;
    
    try {
      const symbol = `${selectedToken}USDT`;
      
      if (exchange === 'binance') {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        if (response.ok) {
          const data = await response.json();
          setRealtimePrice(parseFloat(data.lastPrice));
          setPriceChange24h(parseFloat(data.priceChangePercent));
          console.log(`✅ Preço Binance ${symbol}: $${data.lastPrice} (${data.priceChangePercent}%)`);
        }
      } else if (exchange === 'okx') {
        // Usar API pública da OKX diretamente
        const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${selectedToken}-USDT`);
        if (response.ok) {
          const data = await response.json();
          if (data.data && data.data[0]) {
            const ticker = data.data[0];
            const price = parseFloat(ticker.last);
            const change24h = ((parseFloat(ticker.last) - parseFloat(ticker.open24h)) / parseFloat(ticker.open24h)) * 100;
            setRealtimePrice(price);
            setPriceChange24h(change24h);
            console.log(`✅ Preço OKX ${symbol}: $${price} (${change24h.toFixed(2)}%)`);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar preço em tempo real:', error);
    }
  };

  // Atualizar preço em tempo real a cada 5 segundos
  useEffect(() => {
    if (selectedToken) {
      fetchRealtimePrice();
      const interval = setInterval(fetchRealtimePrice, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedToken, exchange]);

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
            {exchangeNames[exchange]}
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
              onTokenChange={setSelectedToken}
              showOnlyUptrend={true}
            />
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Preço em Tempo Real do Token Selecionado */}
        <div className="p-3 border rounded-lg bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">{selectedToken}</span>
              <Badge className={priceChange24h !== null && priceChange24h >= 0 ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                {priceChange24h !== null && priceChange24h >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {priceChange24h !== null ? `${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%` : 'Alta'}
              </Badge>
            </div>
            <div className="text-right">
              {realtimePrice ? (
                <p className="text-lg font-bold">
                  ${realtimePrice.toFixed(selectedToken === 'BTC' || selectedToken === 'ETH' ? 2 : 6)}
                </p>
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

        {/* Token Selecionado (se filtro ativo) */}
        {showTokenFilter && selectedTokenBalance && (
          <div className="p-4 border-2 border-primary rounded-lg bg-primary/5 space-y-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold">{selectedTokenBalance.symbol}</p>
                <Badge className={priceChange24h && priceChange24h >= 0 ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                  {priceChange24h && priceChange24h >= 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {priceChange24h ? `${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%` : 'Carregando...'}
                </Badge>
              </div>
            </div>
            
            {/* Preço em Tempo Real */}
            <div className="p-3 border rounded-lg bg-background">
              <p className="text-xs text-muted-foreground mb-1">💹 Preço em Tempo Real ({exchangeNames[exchange]})</p>
              <div className="flex items-center gap-2">
                {realtimePrice ? (
                  <>
                    <p className="text-2xl font-bold">
                      ${realtimePrice.toFixed(selectedToken === 'BTC' || selectedToken === 'ETH' ? 2 : 6)}
                    </p>
                    <Badge variant={priceChange24h && priceChange24h >= 0 ? "default" : "destructive"} className="text-xs">
                      24h: {priceChange24h ? `${priceChange24h >= 0 ? '+' : ''}${priceChange24h.toFixed(2)}%` : '...'}
                    </Badge>
                  </>
                ) : (
                  <p className="text-lg text-muted-foreground">Carregando preço...</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Saldo</p>
                <p className="font-semibold">{selectedTokenBalance.balance.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Valor Total</p>
                <p className="font-semibold text-green-500">${selectedTokenBalance.valueUsd.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Preço Médio</p>
                <p className="font-semibold">${selectedTokenBalance.priceUsd.toFixed(2)}</p>
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
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBalances(false)}
            disabled={loading}
            className="flex-1"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSwapDialog(true)}
            disabled={loading}
            className="flex-1"
          >
            <Repeat className="h-4 w-4 mr-2" />
            Converter
          </Button>
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