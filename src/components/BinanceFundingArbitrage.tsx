import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, TrendingUp, TrendingDown, Clock, Target, DollarSign, AlertTriangle, Play, Calculator, Info, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { getUserId } from "@/lib/userUtils";
import { AutoCrossExchangeConfig } from "./AutoCrossExchangeConfig";
import { AutoFundingConfig } from "./AutoFundingConfig";

interface FundingArbitrageOpportunity {
  symbol: string;
  spotPrice: number;
  futuresPrice: number;
  fundingRate: number;
  nextFundingTime: number;
  basisSpread: number;
  annualizedFunding: number;
  estimatedProfit: number;
  strategy: 'long_spot_short_futures' | 'short_spot_long_futures';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expiresAt: string;
}

interface MarketData {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  exchange: string;
}

export const BinanceFundingArbitrage = () => {
  const { toast } = useToast();
  const { isRealMode, setIsRealMode, hasCredentials, setHasCredentials } = useTradingMode();
  const [spotData, setSpotData] = useState<MarketData[]>([]);
  const [futuresData, setFuturesData] = useState<MarketData[]>([]);
  const [fundingOpportunities, setFundingOpportunities] = useState<FundingArbitrageOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<FundingArbitrageOpportunity | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState<number>(1000);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResults, setExecutionResults] = useState<any>(null);

  const handleModeToggle = (enabled: boolean) => {
    if (enabled && !hasCredentials) {
      toast({
        title: "Credenciais Necessárias",
        description: "Configure suas credenciais de API primeiro para usar o modo real",
        variant: "destructive"
      });
      return;
    }
    
    setIsRealMode(enabled);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [spotRes, futuresRes, fundingRes] = await Promise.all([
        supabase.functions.invoke('binance-market-data', { body: { endpoint: 'tickers' } }),
        supabase.functions.invoke('binance-market-data', { body: { endpoint: 'futures' } }),
        supabase.functions.invoke('binance-market-data', { body: { endpoint: 'funding-arbitrage' } })
      ]);

      if (spotRes.error) throw new Error(spotRes.error.message);
      if (futuresRes.error) throw new Error(futuresRes.error.message);
      if (fundingRes.error) throw new Error(fundingRes.error.message);

      const spotResult = spotRes.data as any;
      const futuresResult = futuresRes.data as any;
      const fundingResult = fundingRes.data as any;

      setSpotData(spotResult?.data || []);
      setFuturesData(futuresResult?.data || []);
      setFundingOpportunities(fundingResult?.data || []);

      const highProfitOps = (fundingResult?.data || []).filter((op: FundingArbitrageOpportunity) => op.estimatedProfit > 1.0);
      if (highProfitOps.length > 0) {
        toast({
          title: "🎯 Oportunidade de Alto Lucro!",
          description: `${highProfitOps.length} oportunidades de funding com >1% de lucro estimado`,
        });
      }

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados da Binance",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(4)}%`;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('pt-BR');
  };

  const getStrategyIcon = (strategy: string) => {
    return strategy === 'long_spot_short_futures' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />;
  };

  const getStrategyLabel = (strategy: string) => {
    return strategy === 'long_spot_short_futures' ? 'Long Spot + Short Futures' : 'Short Spot + Long Futures';
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const calculateDetailedROI = (opportunity: FundingArbitrageOpportunity, amount: number) => {
    const spotAmount = amount;
    const futuresNotional = amount;
    
    // Trading fees (0.1% for spot, 0.02% for futures)
    const spotTradingFee = spotAmount * 0.001;
    const futuresTradingFee = futuresNotional * 0.0002;
    const totalTradingFees = spotTradingFee + futuresTradingFee;
    
    // Funding payment calculation
    const fundingHours = 8; // 3 funding periods per day
    const annualHours = 365 * 24;
    const fundingPeriods = fundingHours / 8; // Number of funding periods to hold
    
    const fundingPayment = futuresNotional * opportunity.fundingRate * fundingPeriods;
    
    // Basis spread profit/loss
    const basisProfitLoss = spotAmount * (opportunity.basisSpread / 100);
    
    // Net profit calculation
    let netProfit = 0;
    if (opportunity.strategy === 'long_spot_short_futures') {
      // Long spot, short futures - collect negative funding
      netProfit = basisProfitLoss - Math.abs(fundingPayment) - totalTradingFees;
    } else {
      // Short spot, long futures - pay positive funding
      netProfit = -basisProfitLoss + Math.abs(fundingPayment) - totalTradingFees;
    }
    
    const roi = (netProfit / amount) * 100;
    const annualizedROI = roi * (annualHours / fundingHours);
    
    return {
      investmentAmount: amount,
      spotTradingFee,
      futuresTradingFee,
      totalTradingFees,
      fundingPayment,
      basisProfitLoss,
      netProfit,
      roi,
      annualizedROI,
      fundingPeriods,
      strategy: opportunity.strategy,
      riskLevel: opportunity.riskLevel
    };
  };

  const handleExecuteArbitrage = async (opportunity: FundingArbitrageOpportunity) => {
    setIsExecuting(true);
    try {
      const calculations = calculateDetailedROI(opportunity, investmentAmount);
      
      // Verificar credenciais disponíveis
      const binanceCredentials = localStorage.getItem('binance_credentials');
      const pionexCredentials = localStorage.getItem('pionex_credentials');
      
      // Se modo real ativo mas sem credenciais, mostrar aviso
      if (isRealMode && !binanceCredentials && !pionexCredentials) {
        toast({
          title: "⚠️ Credenciais Necessárias",
          description: "Configure suas credenciais da Binance/Pionex para execuções reais ou alterne para modo simulação.",
          variant: "destructive"
        });
        return;
      }
      
      let apiKeys = {};
      if (isRealMode && binanceCredentials) {
        const binanceCreds = JSON.parse(binanceCredentials);
        apiKeys = {
          binance_api_key: binanceCreds.apiKey,
          binance_secret_key: binanceCreds.secretKey,
        };
      }
      if (isRealMode && pionexCredentials) {
        const pionexCreds = JSON.parse(pionexCredentials);
        apiKeys = {
          ...apiKeys,
          pionex_api_key: pionexCreds.apiKey,
          pionex_secret_key: pionexCreds.secretKey,
        };
      }
      
      // Usar execute-funding-arbitrage específico para funding arbitrage
      const functionName = 'execute-funding-arbitrage';
      
      const userId = await getUserId();
      
      const response = await supabase.functions.invoke(functionName, {
        body: {
          symbol: opportunity.symbol.replace('/USDT', ''),
          strategy: opportunity.strategy,
          spotPrice: opportunity.spotPrice,
          futuresPrice: opportunity.futuresPrice,
          fundingRate: opportunity.fundingRate,
          investment_amount: investmentAmount,
          user_id: userId,
          api_keys: apiKeys,
          calculations,
          trading_mode: isRealMode ? 'real' : 'test',
          is_funding_arbitrage: true
        }
      });

      if (response.error) {
        // Se for erro de saldo insuficiente, mostrar detalhes
        if (response.data?.error_type === 'insufficient_balance') {
          const details = response.data.details;
          let errorMessage = details.message;
          
          // Verificar se houve tentativa de transferência
          if (details.transfers_attempted && details.transfers_attempted.length > 0) {
            const failedTransfers = details.transfers_attempted.filter(t => !t.success);
            if (failedTransfers.length > 0) {
              errorMessage += '\n\n🔄 Transferências automáticas tentadas mas falharam:';
              failedTransfers.forEach(transfer => {
                errorMessage += `\n❌ ${transfer.asset}: ${transfer.error}`;
              });
            } else {
              errorMessage += '\n\n✅ Transferências realizadas, mas ainda insuficiente.';
            }
          }
          
          // Se tiver informações de token, incluir na mensagem
          if (details.required_token !== undefined) {
            errorMessage += `\nDisponível: $${details.available_usdt?.toFixed(2) || 0} USDT, ${details.available_token?.toFixed(8) || 0} ${details.token_symbol || opportunity.symbol}`;
          } else {
            errorMessage += `\nDisponível: $${details.available_usdt?.toFixed(2) || 0} USDT`;
          }
          
          toast({
            title: "Saldo Insuficiente",
            description: errorMessage,
            variant: "destructive"
          });
          return;
        }
        throw new Error(response.error.message);
      }

      setExecutionResults(response.data);
      
      // Verificar se foi simulação por saldo insuficiente
      if (response.data.simulation_reason === 'insufficient_balance') {
        const balanceDetails = response.data.balance_details;
        let balanceMessage = `⚠️ Saldo insuficiente para operação real. Simulação executada:\n\n`;
        
        if (balanceDetails.required_usdt && balanceDetails.available_usdt !== undefined) {
          balanceMessage += `💰 USDT necessário: $${balanceDetails.required_usdt.toFixed(2)}\n`;
          balanceMessage += `💰 USDT disponível: $${balanceDetails.available_usdt.toFixed(2)}\n`;
        }
        
        if (balanceDetails.required_token && balanceDetails.available_token !== undefined) {
          balanceMessage += `🪙 ${balanceDetails.token_symbol} necessário: ${balanceDetails.required_token.toFixed(8)}\n`;
          balanceMessage += `🪙 ${balanceDetails.token_symbol} disponível: ${balanceDetails.available_token.toFixed(8)}\n`;
        }
        
        balanceMessage += `\n${balanceDetails.explanation}`;
        
        toast({
          title: "⚠️ Simulação por Saldo Insuficiente",
          description: balanceMessage,
          variant: "default",
        });
      } else if (response.data.simulation_reason === 'geographic_restriction') {
        const details = response.data.balance_details;
        toast({
          title: "🌍 Restrição Geográfica da Binance",
          description: `${details.explanation}\n\n${details.suggestion}`,
          variant: "destructive",
        });
      } else {
        // Verificar se transferências automáticas foram executadas
        if (response.data.transfers_executed && response.data.transfers_executed.length > 0) {
          const transferMessage = response.data.transfers_executed
            .map(transfer => `💸 ${transfer.amount} ${transfer.asset} transferido`)
            .join('\n');
          
          toast({
            title: "🔄 Transferências Automáticas Executadas",
            description: `Transferências realizadas para viabilizar a operação:\n${transferMessage}\n\n✅ Todas as operações foram registradas no seu portfólio.`,
            variant: "default",
            duration: 6000,
          });
        }
        
        // Toast normal para execuções reais ou simulações normais
        const modeDescription = isRealMode 
          ? response.data.simulation_reason 
            ? `simulação (motivo: ${response.data.simulation_reason === 'insufficient_balance' ? 'saldo insuficiente' : 
                                    response.data.simulation_reason === 'geographic_restriction' ? 'restrição geográfica' :
                                    response.data.simulation_reason === 'execution_error' ? 'erro na execução' : 
                                    response.data.simulation_reason})`
            : 'real'
          : 'simulação';
          
        toast({
          title: isRealMode && !response.data.simulation_reason ? "✅ Operação Real Executada!" : 
                 isRealMode && response.data.simulation_reason ? "⚠️ Executado como Simulação" :
                 "✅ Simulação Executada!",
          description: `Operação de ${opportunity.symbol} executada em modo ${modeDescription}. ROI: ${calculations.roi.toFixed(2)}%${
            isRealMode && !response.data.simulation_reason ? '. Resultado registrado no portfólio.' : 
            isRealMode && response.data.simulation_reason ? '. Modo real solicitado mas executado como simulação.' : ''
          }`,
        });
      }
      
      // Atualizar portfolio se foi execução real
      if (isRealMode) {
        window.dispatchEvent(new CustomEvent('portfolioUpdate'));
      }

    } catch (error) {
      console.error('Erro na execução:', error);
      toast({
        title: "Erro na Execução",
        description: error instanceof Error ? error.message : "Falha ao executar arbitragem",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const ExecutionModal = ({ opportunity, onExecute }: { opportunity: FundingArbitrageOpportunity, onExecute: () => void }) => {
    const calculations = calculateDetailedROI(opportunity, investmentAmount);
    
    return (
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Detalhes da Execução - {opportunity.symbol}
          </DialogTitle>
          <DialogDescription>
            Análise detalhada da operação de funding arbitrage
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid gap-4">
            <div>
              <Label htmlFor="investment-amount">Valor do Investimento (USD)</Label>
              <Input
                id="investment-amount"
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                min="100"
                max="100000"
                step="100"
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Info className="h-4 w-4" />
              Estratégia e Preços
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Estratégia:</span>
                  <span className="font-medium">{getStrategyLabel(opportunity.strategy)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Preço Spot:</span>
                  <span>{formatCurrency(opportunity.spotPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Preço Futures:</span>
                  <span>{formatCurrency(opportunity.futuresPrice)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Funding Rate:</span>
                  <span className={opportunity.fundingRate > 0 ? 'text-red-600' : 'text-green-600'}>
                    {formatPercentage(opportunity.fundingRate)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Base Spread:</span>
                  <span className={opportunity.basisSpread > 0 ? 'text-green-600' : 'text-red-600'}>
                    {formatPercentage(opportunity.basisSpread)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Nível de Risco:</span>
                  <Badge variant={opportunity.riskLevel === 'LOW' ? 'default' : opportunity.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'}>
                    {opportunity.riskLevel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Cálculo Detalhado do ROI
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Investimento Total:</span>
                  <span className="font-medium">{formatCurrency(calculations.investmentAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa Trading Spot:</span>
                  <span className="text-red-600">-{formatCurrency(calculations.spotTradingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa Trading Futures:</span>
                  <span className="text-red-600">-{formatCurrency(calculations.futuresTradingFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total em Taxas:</span>
                  <span className="text-red-600 font-medium">-{formatCurrency(calculations.totalTradingFees)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Funding Payment:</span>
                  <span className={calculations.fundingPayment > 0 ? 'text-green-600' : 'text-red-600'}>
                    {calculations.fundingPayment > 0 ? '+' : ''}{formatCurrency(calculations.fundingPayment)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Basis P&L:</span>
                  <span className={calculations.basisProfitLoss > 0 ? 'text-green-600' : 'text-red-600'}>
                    {calculations.basisProfitLoss > 0 ? '+' : ''}{formatCurrency(calculations.basisProfitLoss)}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-base">
                  <span>Lucro Líquido:</span>
                  <span className={calculations.netProfit > 0 ? 'text-green-600' : 'text-red-600'}>
                    {calculations.netProfit > 0 ? '+' : ''}{formatCurrency(calculations.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-base">
                  <span>ROI:</span>
                  <span className={calculations.roi > 0 ? 'text-green-600' : 'text-red-600'}>
                    {calculations.roi > 0 ? '+' : ''}{formatPercentage(calculations.roi)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>ROI Anualizado Estimado:</span>
              <span className={calculations.annualizedROI > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                {calculations.annualizedROI > 0 ? '+' : ''}{formatPercentage(calculations.annualizedROI)}
              </span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Período de Funding:</span>
              <span>{calculations.fundingPeriods} período(s) - {calculations.fundingPeriods * 8}h</span>
            </div>
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={onExecute}
              disabled={isExecuting || calculations.netProfit <= 0}
              className="flex-1"
            >
              {isExecuting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Executando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Executar Arbitragem
                </>
              )}
            </Button>
          </div>
          
          {calculations.netProfit <= 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Operação não recomendada</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                Esta operação resultaria em prejuízo. Considere aguardar melhores oportunidades.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    );
  };

  return (
    <div className="space-y-6">
      {/* Informações sobre o tipo de operação */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-2 h-12 bg-green-500 rounded-full"></div>
            <div>
              <h3 className="font-medium text-green-700">Funding Arbitrage (Binance)</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Operações apenas dentro da Binance entre mercado Spot e Futures. 
                Para operações multi-exchange (Binance ↔ Pionex), use o painel "Multi-Exchange".
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controle de Modo Real/Simulação */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isRealMode ? (
                  <Shield className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
                <Label htmlFor="real-mode" className="font-medium">
                  {isRealMode ? "Modo Real Ativo" : "Modo Simulação"}
                </Label>
              </div>
              <Switch
                id="real-mode"
                checked={isRealMode}
                onCheckedChange={handleModeToggle}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {isRealMode ? (
                hasCredentials ? (
                  "Dados obtidos das APIs reais das exchanges"
                ) : (
                  "Configure suas credenciais para usar o modo real"
                )
              ) : (
                "Usando dados simulados para demonstração"
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Funding Arbitrage - Binance (Spot ↔ Futures)
              </CardTitle>
              <CardDescription>
                Monitore oportunidades entre mercado Spot e Futures dentro da Binance
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isLoading ? "secondary" : "default"}>
                {isLoading ? "Atualizando..." : "Conectado"}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          {lastUpdate && (
            <p className="text-sm text-muted-foreground">
              Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}
            </p>
          )}
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="funding-opportunities" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="funding-opportunities">Oportunidades de Funding</TabsTrigger>
              <TabsTrigger value="spot-market">Mercado Spot</TabsTrigger>
              <TabsTrigger value="futures-market">Mercado Futures</TabsTrigger>
              <TabsTrigger value="automation">🤖 Funding</TabsTrigger>
              <TabsTrigger value="cross-exchange">⚡ Cross-Exchange</TabsTrigger>
            </TabsList>

            <TabsContent value="funding-opportunities" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Oportunidades de Arbitragem de Funding</h3>
                  <Badge variant="outline">
                    {fundingOpportunities.length} oportunidades ativas
                  </Badge>
                </div>

                {fundingOpportunities.length > 0 ? (
                  <div className="space-y-2">
                    {fundingOpportunities.slice(0, 3).map((opportunity, index) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg border">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{opportunity.symbol}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              Spread: {opportunity.basisSpread.toFixed(2)}% | 
                              Lucro: {opportunity.estimatedProfit.toFixed(2)}%
                            </span>
                          </div>
                          <Badge variant={opportunity.riskLevel === 'LOW' ? 'default' : opportunity.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'}>
                            {opportunity.riskLevel}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aguardando oportunidades de funding...</p>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Símbolo</TableHead>
                        <TableHead>Estratégia</TableHead>
                        <TableHead>Preço Spot</TableHead>
                        <TableHead>Preço Futures</TableHead>
                        <TableHead>Base Spread</TableHead>
                        <TableHead>Funding Rate</TableHead>
                        <TableHead>Lucro Est.</TableHead>
                        <TableHead>Risco</TableHead>
                        <TableHead>Próximo Funding</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fundingOpportunities.map((opportunity, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{opportunity.symbol}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStrategyIcon(opportunity.strategy)}
                              <span className="text-xs">
                                {getStrategyLabel(opportunity.strategy)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(opportunity.spotPrice)}</TableCell>
                          <TableCell>{formatCurrency(opportunity.futuresPrice)}</TableCell>
                          <TableCell>
                            <span className={opportunity.basisSpread > 0 ? 'text-green-600' : 'text-red-600'}>
                              {formatPercentage(opportunity.basisSpread)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className={opportunity.fundingRate > 0 ? 'text-red-600' : 'text-green-600'}>
                              {formatPercentage(opportunity.fundingRate)}
                            </span>
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {formatPercentage(opportunity.estimatedProfit)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={opportunity.riskLevel === 'LOW' ? 'default' : opportunity.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'}>
                              {opportunity.riskLevel}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatTime(opportunity.nextFundingTime)}
                          </TableCell>
                          <TableCell>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="default"
                                  className="bg-gradient-to-r from-primary to-primary/80"
                                  onClick={() => setSelectedOpportunity(opportunity)}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Executar
                                </Button>
                              </DialogTrigger>
                              {selectedOpportunity && selectedOpportunity.symbol === opportunity.symbol && (
                                <ExecutionModal 
                                  opportunity={selectedOpportunity} 
                                  onExecute={() => handleExecuteArbitrage(selectedOpportunity)}
                                />
                              )}
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="spot-market">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Preços Spot - Binance</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Símbolo</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Variação 24h</TableHead>
                        <TableHead>Volume 24h</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {spotData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.symbol}</TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell className={item.change24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercentage(item.change24h)}
                          </TableCell>
                          <TableCell>{item.volume24h.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="futures-market">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Preços Futures - Binance</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Símbolo</TableHead>
                        <TableHead>Preço</TableHead>
                        <TableHead>Variação 24h</TableHead>
                        <TableHead>Volume 24h</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {futuresData.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{item.symbol}</TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell className={item.change24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {formatPercentage(item.change24h)}
                          </TableCell>
                          <TableCell>{item.volume24h.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="automation">
              <AutoFundingConfig />
            </TabsContent>
            
            <TabsContent value="cross-exchange" className="space-y-4">
              <AutoCrossExchangeConfig />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Execution Results Modal */}
      {executionResults && (
        <Dialog open={!!executionResults} onOpenChange={() => setExecutionResults(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {executionResults.success ? (
                  <>
                    <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    Arbitragem Executada com Sucesso!
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Falha na Execução
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                ID da Execução: {executionResults.executionId}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {executionResults.success ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-semibold">Ordem Spot</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>ID da Ordem:</span>
                          <span className="font-mono">{executionResults.spotOrder?.orderId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lado:</span>
                          <span>{executionResults.spotOrder?.side}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Preço Executado:</span>
                          <span>{formatCurrency(executionResults.spotOrder?.executedPrice || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quantidade:</span>
                          <span>{executionResults.spotOrder?.quantity?.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxa:</span>
                          <span className="text-red-600">{formatCurrency(executionResults.spotOrder?.fee || 0)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold">Ordem Futures</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>ID da Ordem:</span>
                          <span className="font-mono">{executionResults.futuresOrder?.orderId}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lado:</span>
                          <span>{executionResults.futuresOrder?.side}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Preço Executado:</span>
                          <span>{formatCurrency(executionResults.futuresOrder?.executedPrice || 0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quantidade:</span>
                          <span>{executionResults.futuresOrder?.quantity?.toFixed(6)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Taxa:</span>
                          <span className="text-red-600">{formatCurrency(executionResults.futuresOrder?.fee || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-3">
                    <h4 className="font-semibold">Resultado da Operação</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Lucro Estimado:</span>
                          <span className="text-green-600">{formatCurrency(executionResults.estimatedProfit)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Lucro Real:</span>
                          <span className={executionResults.actualProfit > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                            {formatCurrency(executionResults.actualProfit || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Taxas Totais:</span>
                          <span className="text-red-600">{formatCurrency(executionResults.fees)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <Badge variant="default">{executionResults.status?.toUpperCase() || 'DESCONHECIDO'}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <div className="h-4 w-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="font-medium">Operação Concluída</span>
                    </div>
                    <p className="text-sm text-green-600 mt-1">
                      Sua operação de funding arbitrage foi executada com sucesso! 
                      Os resultados foram registrados em seu histórico.
                    </p>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Erro na Execução</span>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    {executionResults.error || 'Ocorreu um erro inesperado durante a execução.'}
                  </p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button onClick={() => setExecutionResults(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};