import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHFTWebSocket } from '@/hooks/useHFTWebSocket';
import { Activity, TrendingUp, Zap, Clock, DollarSign, Percent, Wallet, PlayCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getUserId } from '@/lib/userUtils';
import ArbitrageExecutionModal from '@/components/ArbitrageExecutionModal';
import { useTradingMode } from '@/contexts/TradingModeContext';

const AVAILABLE_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
const AVAILABLE_EXCHANGES = ['binance', 'okx', 'bybit', 'hyperliquid'];

interface ExchangeBalance {
  exchange: string;
  totalUsd: number;
  assets: Array<{ symbol: string; balance: number; valueUsd: number }>;
}

export const HFTDashboard = () => {
  const [enabled, setEnabled] = useState(false);
  const [autoExecute, setAutoExecute] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC/USDT']);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['binance', 'okx']);
  const [exchangeBalances, setExchangeBalances] = useState<ExchangeBalance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { isRealMode } = useTradingMode();

  const { data, isConnected, error } = useHFTWebSocket(
    selectedSymbols,
    selectedExchanges,
    enabled,
    autoExecute
  );

  // Carregar saldos das exchanges
  const loadExchangeBalances = async () => {
    setLoadingBalances(true);
    try {
      const userId = await getUserId();
      const { data: response, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          real_mode: true,
          user_id: userId
        }
      });

      if (error) throw error;

      if (response.success && response.data.portfolio) {
        // Agrupar saldos por exchange
        const balancesByExchange = new Map<string, ExchangeBalance>();
        
        response.data.portfolio.forEach((item: any) => {
          const exchange = item.exchange || 'GLOBAL';
          if (!balancesByExchange.has(exchange)) {
            balancesByExchange.set(exchange, {
              exchange,
              totalUsd: 0,
              assets: []
            });
          }
          
          const exchangeData = balancesByExchange.get(exchange)!;
          exchangeData.totalUsd += item.value_usd || 0;
          exchangeData.assets.push({
            symbol: item.symbol,
            balance: item.balance,
            valueUsd: item.value_usd || 0
          });
        });

        // Ordenar exchanges: Binance, OKX, Bybit, Hyperliquid, outros
        const exchangeOrder = ['BINANCE', 'OKX', 'BYBIT', 'HYPERLIQUID'];
        const sortedBalances = Array.from(balancesByExchange.values()).sort((a, b) => {
          const aIndex = exchangeOrder.indexOf(a.exchange.toUpperCase());
          const bIndex = exchangeOrder.indexOf(b.exchange.toUpperCase());
          if (aIndex === -1 && bIndex === -1) return a.exchange.localeCompare(b.exchange);
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        });

        setExchangeBalances(sortedBalances);
      }
    } catch (error) {
      console.error('Error loading balances:', error);
      toast({
        title: '❌ Erro ao carregar saldos',
        description: 'Não foi possível carregar os saldos das exchanges',
        variant: 'destructive'
      });
    } finally {
      setLoadingBalances(false);
    }
  };

  useEffect(() => {
    loadExchangeBalances();
    // Atualizar saldos a cada 30 segundos
    const interval = setInterval(loadExchangeBalances, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (checked) {
      toast({
        title: '🚀 HFT Engine Ativado - MODO HÍBRIDO',
        description: 'Monitorando E executando trades em tempo real',
      });
    } else {
      toast({
        title: '⏸️ HFT Engine Pausado',
        description: 'Sistema pausado',
      });
    }
  };

  const openExecutionModal = (opportunity: any) => {
    const modalOpportunity = {
      id: `hft-${opportunity.symbol}-${Date.now()}`,
      symbol: opportunity.symbol,
      buy_exchange: opportunity.buyExchange,
      sell_exchange: opportunity.sellExchange,
      buy_price: opportunity.buyPrice,
      sell_price: opportunity.sellPrice,
      spread: opportunity.spread,
      potential: opportunity.netProfit,
      net_profit: opportunity.netProfit,
      risk_level: 'MEDIUM',
      base_currency: opportunity.symbol.split('/')[0],
      quote_currency: opportunity.symbol.split('/')[1] || 'USDT',
      transfer_fee: 0.001,
      transfer_time: 120
    };
    setSelectedOpportunity(modalOpportunity);
    setIsModalOpen(true);
  };

  const executeArbitrage = async (opportunity: any, config: any) => {
    try {
      console.log('🚀 Executando HFT arbitragem:', { opportunity, config });
      const oppId = `${opportunity.symbol}-${opportunity.buy_exchange}-${opportunity.sell_exchange}`;
      setExecutingIds(prev => new Set(prev).add(oppId));

      const binanceCredentials = localStorage.getItem('binance_credentials');
      const okxCredentials = localStorage.getItem('okx_credentials');
      
      if (!binanceCredentials || !okxCredentials) {
        toast({
          title: "⚠️ Credenciais Necessárias",
          description: "Configure suas APIs da Binance e OKX primeiro",
          variant: "destructive"
        });
        setExecutingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(oppId);
          return newSet;
        });
        return;
      }

      const binanceCreds = JSON.parse(binanceCredentials);
      const okxCreds = JSON.parse(okxCredentials);
      const userId = await getUserId();

      const { data, error } = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
        body: {
          opportunityId: opportunity.id || 'hft-manual',
          userId: userId,
          symbol: opportunity.symbol,
          buyExchange: opportunity.buy_exchange,
          sellExchange: opportunity.sell_exchange,
          buyPrice: opportunity.buy_price,
          sellPrice: opportunity.sell_price,
          mode: isRealMode ? 'real' : 'simulation',
          binanceApiKey: binanceCreds.apiKey,
          binanceSecretKey: binanceCreds.secretKey,
          okxApiKey: okxCreds.apiKey,
          okxSecretKey: okxCreds.secretKey,
          okxPassphrase: okxCreds.passphrase,
          config: {
            investmentAmount: config.investmentAmount,
            maxSlippage: config.maxSlippage,
            customFeeRate: 0.2,
            stopLossPercentage: config.stopLossPercentage,
            prioritizeSpeed: true
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Trade Executado!",
          description: `${opportunity.symbol} - Lucro: $${data.result?.net_profit?.toFixed(2) || '0.00'}`,
        });
        await loadExchangeBalances();
      } else {
        toast({
          title: "❌ Erro na Execução",
          description: data.error || "Falha ao executar trade",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('❌ Erro:', error);
      toast({
        title: "❌ Erro",
        description: error.message || "Erro ao executar arbitragem",
        variant: "destructive"
      });
    } finally {
      const oppId = `${opportunity.symbol}-${opportunity.buy_exchange}-${opportunity.sell_exchange}`;
      setExecutingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(oppId);
        return newSet;
      });
      setIsModalOpen(false);
      setSelectedOpportunity(null);
    }
  };

  const toggleSymbol = (symbol: string) => {
    setSelectedSymbols((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol]
    );
  };

  const toggleExchange = (exchange: string) => {
    setSelectedExchanges((prev) =>
      prev.includes(exchange)
        ? prev.filter((e) => e !== exchange)
        : [...prev, exchange]
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="h-8 w-8 text-yellow-500" />
            HFT Trading System
            <Badge variant="default" className="ml-2 bg-gradient-to-r from-blue-600 to-purple-600">
              🚀 MODO HÍBRIDO
            </Badge>
          </h1>
          <p className="text-muted-foreground">
            Detecção ultra-rápida + Execução automática de trades cross-exchange
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? 'default' : 'destructive'} className="text-sm">
            {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
          </Badge>
          {error && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Erro: {error}
            </Badge>
          )}
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-execute"
              checked={autoExecute}
              onCheckedChange={setAutoExecute}
              disabled={!enabled}
            />
            <Label htmlFor="auto-execute" className="cursor-pointer">
              {autoExecute ? '🤖 Execução Automática' : '👁️ Monitoramento'}
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="hft-mode"
              checked={enabled}
              onCheckedChange={handleToggle}
            />
            <Label htmlFor="hft-mode">
              {enabled ? 'Ativo' : 'Inativo'}
            </Label>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">❌ Erro de Conexão</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Saldos por Exchange */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Saldos por Exchange
              </CardTitle>
              <CardDescription>Saldo disponível em cada exchange</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadExchangeBalances} disabled={loadingBalances}>
              {loadingBalances ? '🔄' : '🔃'} Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBalances ? (
            <div className="text-center py-8 text-muted-foreground">Carregando saldos...</div>
          ) : exchangeBalances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum saldo encontrado. Configure suas APIs nas exchanges.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {exchangeBalances.map((exchange) => (
                <Card key={exchange.exchange} className="border-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        {exchange.exchange.toUpperCase() === 'BINANCE' && '🟡'}
                        {exchange.exchange.toUpperCase() === 'OKX' && '⚫'}
                        {exchange.exchange.toUpperCase() === 'BYBIT' && '🟠'}
                        {exchange.exchange.toUpperCase() === 'HYPERLIQUID' && '🔵'}
                        {exchange.exchange.toUpperCase()}
                      </span>
                      <Badge variant="default">${exchange.totalUsd.toFixed(2)}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {exchange.assets
                        .filter(asset => asset.valueUsd > 0.01)
                        .sort((a, b) => b.valueUsd - a.valueUsd)
                        .slice(0, 5)
                        .map((asset) => (
                          <div key={asset.symbol} className="flex justify-between text-sm">
                            <span className="font-medium">{asset.symbol}</span>
                            <div className="text-right">
                              <div className="font-mono">{asset.balance.toFixed(6)}</div>
                              <div className="text-xs text-muted-foreground">
                                ${asset.valueUsd.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuração */}
      <Card>
        <CardHeader>
          <CardTitle>⚙️ Configuração HFT</CardTitle>
          <CardDescription>
            Selecione símbolos e exchanges para monitoramento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Símbolos</Label>
            <div className="flex gap-2 mt-2">
              {AVAILABLE_SYMBOLS.map((symbol) => (
                <Button
                  key={symbol}
                  variant={selectedSymbols.includes(symbol) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleSymbol(symbol)}
                >
                  {symbol}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label>Exchanges</Label>
            <div className="flex gap-2 mt-2">
              {AVAILABLE_EXCHANGES.map((exchange) => (
                <Button
                  key={exchange}
                  variant={selectedExchanges.includes(exchange) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleExchange(exchange)}
                >
                  {exchange.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Oportunidades Ativas
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {data.opportunities.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Melhor Spread
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {data.opportunities.length > 0
                    ? `${Math.max(...data.opportunities.map((o) => o.spread)).toFixed(3)}%`
                    : '0.000%'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Lucro Potencial
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  ${data.opportunities.length > 0
                    ? Math.max(...data.opportunities.map((o) => o.netProfit)).toFixed(2)
                    : '0.00'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Latência
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">
                  &lt;100ms
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Melhores Oportunidades com ROI Detalhado */}
          {data.opportunities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>🎯 Melhores Oportunidades de Arbitragem</CardTitle>
                <CardDescription>
                  Análise detalhada de ROI e rentabilidade por oportunidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.opportunities.slice(0, 5).map((opp, index) => {
                    const roi = (opp.netProfit / 25) * 100; // ROI baseado em $25 de capital
                    const volume = 25; // Volume configurado
                    const fees = volume * 0.002; // 0.2% total de fees (0.1% cada lado)
                    const grossProfit = opp.spread / 100 * volume;
                    
                    return (
                      <Card key={`${opp.symbol}-${opp.buyExchange}-${opp.sellExchange}`} 
                            className="border-l-4 border-l-green-500">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {/* Coluna 1: Informação do Par */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Par & Exchanges</div>
                              <div className="font-bold text-lg">{opp.symbol}</div>
                              <div className="flex items-center gap-2 text-sm">
                                <Badge variant="outline" className="bg-green-50">
                                  {opp.buyExchange.toUpperCase()}
                                </Badge>
                                <span>→</span>
                                <Badge variant="outline" className="bg-blue-50">
                                  {opp.sellExchange.toUpperCase()}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Buy: ${opp.buyPrice.toFixed(2)} | Sell: ${opp.sellPrice.toFixed(2)}
                              </div>
                            </div>

                            {/* Coluna 2: Spread & Lucro */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Spread & Lucro</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Spread:</span>
                                  <Badge variant="default" className="text-base">
                                    {opp.spread.toFixed(3)}%
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Lucro Bruto:</span>
                                  <span className="font-mono text-green-600">${grossProfit.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Fees:</span>
                                  <span className="font-mono text-red-600">-${fees.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between border-t pt-1">
                                  <span className="text-xs font-semibold">Lucro Líquido:</span>
                                  <span className="font-mono font-bold text-green-700">
                                    ${opp.netProfit.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Coluna 3: ROI & Capital */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">ROI & Capital</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Capital:</span>
                                  <span className="font-mono">${volume.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">ROI:</span>
                                  <Badge variant="default" className="text-base bg-green-600">
                                    +{roi.toFixed(2)}%
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Retorno:</span>
                                  <span className="font-mono">${(volume + opp.netProfit).toFixed(2)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Coluna 4: Análise de Risco */}
                            <div className="space-y-2">
                              <div className="text-sm font-medium text-muted-foreground">Análise</div>
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Rank:</span>
                                  <Badge variant="outline">#{index + 1}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Risco:</span>
                                  <Badge variant={opp.spread > 0.5 ? 'default' : 'secondary'}>
                                    {opp.spread > 0.5 ? 'Baixo' : 'Médio'}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">Status:</span>
                                  <Badge variant="default" className="bg-blue-600">
                                    Ativo
                                  </Badge>
                                </div>
                              </div>
                              {/* Botão de Execução Manual */}
                              <Button 
                                size="sm" 
                                className="w-full mt-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                onClick={() => openExecutionModal(opp)}
                                disabled={executingIds.has(`${opp.symbol}-${opp.buyExchange}-${opp.sellExchange}`)}
                              >
                                {executingIds.has(`${opp.symbol}-${opp.buyExchange}-${opp.sellExchange}`) ? (
                                  <>⏳ Executando...</>
                                ) : (
                                  <>
                                    <PlayCircle className="h-4 w-4 mr-1" />
                                    Executar Trade
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Preços em Tempo Real */}
          {data.prices.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>📊 Preços ao Vivo (REST API)</CardTitle>
                <CardDescription>
                  Atualização a cada 100ms
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.prices.map((symbolData) => (
                    <div key={symbolData.symbol} className="border rounded-lg p-4">
                      <h3 className="font-semibold mb-3 flex items-center justify-between">
                        <span>{symbolData.symbol}</span>
                        {symbolData.prices.length >= 2 && (
                          <Badge variant="outline">
                            Spread: {(() => {
                              const prices = symbolData.prices.map(p => p.price);
                              const min = Math.min(...prices);
                              const max = Math.max(...prices);
                              const spread = ((max - min) / min * 100);
                              return spread.toFixed(3);
                            })()}%
                          </Badge>
                        )}
                      </h3>
                      <div className="space-y-2">
                        {symbolData.prices.map((price) => (
                          <div
                            key={price.exchange}
                            className="flex items-center justify-between text-sm p-2 bg-muted rounded"
                          >
                            <Badge variant="outline">{price.exchange.toUpperCase()}</Badge>
                            <div className="font-mono font-bold">
                              ${price.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Alerta de Modo */}
      {autoExecute && enabled && (
        <Card className="border-yellow-500 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="text-4xl">⚠️</div>
              <div>
                <h3 className="font-semibold text-yellow-900">
                  Modo de Execução Automática ATIVO
                </h3>
                <p className="text-sm text-yellow-800">
                  O sistema executará trades automaticamente quando detectar oportunidades rentáveis.
                  Volume por trade: $25 USD | Lucro mínimo: $1.00 | Máximo 3 trades simultâneos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trades Executados */}
      {data && data.executedTrades && data.executedTrades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🤖 Trades Executados Automaticamente</CardTitle>
            <CardDescription>
              Histórico de execuções automáticas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.executedTrades.map((trade, index) => (
                <div
                  key={`${trade.timestamp}-${index}`}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    trade.result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {trade.opportunity.symbol}
                      </Badge>
                      <Badge variant={trade.result.success ? 'default' : 'destructive'}>
                        {trade.result.success ? '✅ Sucesso' : '❌ Falha'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {trade.opportunity.buyExchange} → {trade.opportunity.sellExchange}
                      </span>
                      <span>
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {trade.result.error && (
                      <div className="text-sm text-red-600">
                        {trade.result.error}
                      </div>
                    )}
                  </div>

                  <div className="text-right space-y-1">
                    <div className={`text-lg font-bold ${trade.result.success ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.result.success ? '+' : ''}${trade.opportunity.netProfit.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Spread: {trade.opportunity.spread.toFixed(3)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Oportunidades em Tempo Real */}
      {data && data.opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🎯 Oportunidades Detectadas (Tempo Real)</CardTitle>
            <CardDescription>
              Atualização em tempo real via REST API (100ms)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.opportunities.slice(0, 10).map((opp, index) => (
                <div
                  key={`${opp.symbol}-${opp.timestamp}-${index}`}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">
                        {opp.symbol}
                      </Badge>
                      <Badge variant="secondary">
                        {opp.buyExchange} → {opp.sellExchange}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Compra: ${opp.buyPrice.toFixed(2)}</span>
                      <span>Venda: ${opp.sellPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="text-lg font-bold text-green-500">
                      +${opp.netProfit.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Spread: {opp.spread.toFixed(3)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sem Oportunidades */}
      {data && data.opportunities.length === 0 && enabled && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>💡 Nenhuma Oportunidade Detectada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                O sistema está monitorando ativamente, mas não encontrou spreads acima do threshold de lucro ($1.00).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-white rounded-lg border">
                  <div className="font-semibold mb-1">💰 Threshold Atual</div>
                  <div>Lucro mínimo: $1.00 USD por trade</div>
                  <div className="text-xs text-muted-foreground">Volume: $25 USD</div>
                </div>
                <div className="p-3 bg-white rounded-lg border">
                  <div className="font-semibold mb-1">📊 Spreads Atuais</div>
                  <div>BTC/USDT: ~0.002% (muito baixo)</div>
                  <div className="text-xs text-muted-foreground">Mercado muito eficiente</div>
                </div>
              </div>
              <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg">
                <div className="font-semibold text-yellow-900 mb-2">💡 Dica para encontrar oportunidades:</div>
                <div className="text-sm text-yellow-800 space-y-1">
                  <div>• Adicione mais símbolos: ETH/USDT, SOL/USDT, BNB/USDT</div>
                  <div>• Adicione Bybit às exchanges (mais ineficiências)</div>
                  <div>• BTC/USDT é extremamente líquido - spreads mínimos</div>
                  <div>• Altcoins têm spreads 10-100x maiores</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preços em Tempo Real */}
      {data && data.prices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Preços ao Vivo (REST API)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.prices.map((symbolData) => (
                <div key={symbolData.symbol} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">{symbolData.symbol}</h3>
                  <div className="space-y-2">
                    {symbolData.prices.map((price) => (
                      <div
                        key={price.exchange}
                        className="flex items-center justify-between text-sm"
                      >
                        <Badge variant="outline">{price.exchange}</Badge>
                        <div className="font-mono font-bold">
                          ${price.price.toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!enabled && (
        <Card>
          <CardContent className="text-center py-12">
            <Zap className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">
              HFT Engine Desativado
            </h3>
            <p className="text-muted-foreground mb-4">
              Ative o sistema para começar a monitorar oportunidades em tempo real
            </p>
            <Button onClick={() => handleToggle(true)}>
              Ativar HFT Engine
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal de Execução */}
      {selectedOpportunity && (
        <ArbitrageExecutionModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedOpportunity(null);
          }}
          opportunity={selectedOpportunity}
          onExecute={executeArbitrage}
          isExecuting={executingIds.has(`${selectedOpportunity.symbol}-${selectedOpportunity.buy_exchange}-${selectedOpportunity.sell_exchange}`)}
        />
      )}
    </div>
  );
};
