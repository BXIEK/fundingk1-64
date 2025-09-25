import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Calculator, DollarSign, TrendingUp, AlertTriangle, Clock, Target, Activity, Loader2 } from 'lucide-react';
import { type ArbitrageOpportunity } from '@/types/arbitrage';
import { supabase } from '@/integrations/supabase/client';
import { getUserId } from '@/lib/userUtils';

export default function ArbitrageCalculator() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [investmentAmount, setInvestmentAmount] = useState<number>(1000);
  const [opportunity, setOpportunity] = useState<ArbitrageOpportunity | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [isRealMode, setIsRealMode] = useState<boolean>(false);

  useEffect(() => {
    // Recuperar dados da oportunidade dos parâmetros da URL
    const opportunityData = searchParams.get('data');
    if (opportunityData) {
      try {
        const parsed = JSON.parse(decodeURIComponent(opportunityData));
        setOpportunity(parsed);
      } catch (error) {
        console.error('Erro ao parsear dados da oportunidade:', error);
        toast({
          title: "Erro",
          description: "Dados da oportunidade inválidos",
          variant: "destructive"
        });
        navigate('/');
      }
    } else {
      navigate('/');
    }
  }, [searchParams, navigate, toast]);

  // Detectar modo real/simulação
  useEffect(() => {
    // Verificar se há credenciais das APIs armazenadas
    const binanceCredentials = localStorage.getItem('binance_credentials');
    const pionexCredentials = localStorage.getItem('pionex_credentials');
    
    // Se há credenciais, ativar modo real por padrão
    if (binanceCredentials || pionexCredentials) {
      setIsRealMode(true);
    }
  }, []);

  if (!opportunity) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Carregando dados da oportunidade...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`;
  };

  // Cálculos detalhados
  const totalInvestment = investmentAmount;
  const spotQuantity = totalInvestment / opportunity.buyPrice;
  const futuresValue = spotQuantity * opportunity.sellPrice;
  const grossProfit = futuresValue - totalInvestment;
  const gasFees = opportunity.gasFeeEstimate * spotQuantity;
  const slippageCost = (opportunity.gasFeeEstimate * 100 * totalInvestment) / 100;
  const netProfit = grossProfit - gasFees - slippageCost;
  const roi = (netProfit / totalInvestment) * 100;
  const breakEvenPrice = opportunity.buyPrice * (1 + (gasFees + slippageCost) / totalInvestment);
  const maxLiquidity = Math.min(opportunity.liquidityBuy, opportunity.liquiditySell);
  const maxInvestment = maxLiquidity * 0.1; // 10% da liquidez disponível
  const timeToExecute = opportunity.executionTimeEstimate / 1000;

  const executeArbitrage = async () => {
    try {
      setIsExecuting(true);
      toast({
        title: "Executando Arbitragem",
        description: `Iniciando operação de ${opportunity.symbol} com ${formatCurrency(investmentAmount)}`,
      });

      let response;
      
      // Preparar credenciais se em modo real
      let apiKeys: any = {};
      let userId = await getUserId();
      
      if (isRealMode) {
        // Verificar credenciais para modo real
        const binanceCredentials = localStorage.getItem('binance_credentials');
        const pionexCredentials = localStorage.getItem('pionex_credentials');
        
        if (!binanceCredentials && !pionexCredentials) {
          toast({
            title: "Credenciais Necessárias",
            description: "Configure suas credenciais da API para executar operações reais",
            variant: "destructive"
          });
          return;
        }
        
        if (binanceCredentials) {
          const binanceCreds = JSON.parse(binanceCredentials);
          apiKeys.binance_api_key = binanceCreds.apiKey;
          apiKeys.binance_secret_key = binanceCreds.secretKey;
        }
        
        if (pionexCredentials) {
          const pionexCreds = JSON.parse(pionexCredentials);
          apiKeys.pionex_api_key = pionexCreds.apiKey;
          apiKeys.pionex_secret_key = pionexCreds.secretKey;
        }
      }

      // Executar arbitragem
      response = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
        body: {
          opportunityId: `${opportunity.symbol}-calc`,
          userId: userId,
          symbol: opportunity.symbol.replace('/USDT', ''),
          buyExchange: opportunity.buyExchange,
          sellExchange: opportunity.sellExchange,
          buyPrice: opportunity.buyPrice,
          sellPrice: opportunity.sellPrice,
          mode: isRealMode ? 'real' : 'simulation',
          config: {
            investmentAmount: spotQuantity * opportunity.buyPrice,
            maxSlippage: 0.3,
            customFeeRate: 0.2,
            stopLossPercentage: 2,
            prioritizeSpeed: true
          }
        }
      });

      let result;
      if (isRealMode) {
        result = response.data;
        if (response.error) {
          throw new Error(response.error.message);
        }
      } else {
        result = await response.json();
      }

      if (result.success) {
        toast({
          title: `${isRealMode ? '✅ Operação Real Executada!' : '✅ Simulação Executada!'}`,
          description: result.message || `Operação de ${opportunity.symbol} executada com sucesso`,
        });
        
        // Redirecionar para histórico ou atualizar dados
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        toast({
          title: "Falha na Execução",
          description: result.error || result.message || "Erro desconhecido na execução",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro ao executar arbitragem:', error);
      toast({
        title: "Falha na Execução", 
        description: `Falha na execução: ${error.message || "Erro desconhecido"}`,
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calculator className="h-8 w-8 text-primary" />
              Calculadora de Arbitragem
            </h1>
            <p className="text-muted-foreground">Análise detalhada da oportunidade {opportunity.symbol}</p>
          </div>
        </div>
        
        {/* Indicador de modo e controles */}
        <div className="flex items-center gap-3">
          <Badge variant={isRealMode ? "default" : "secondary"} className="text-xs font-medium">
            {isRealMode ? "🔥 MODO REAL ATIVO" : "🧪 MODO SIMULAÇÃO"}
          </Badge>
          <Button 
            onClick={() => setIsRealMode(!isRealMode)} 
            variant="outline" 
            size="sm"
            className="text-xs"
          >
            {isRealMode ? "Alternar p/ Simulação" : "Alternar p/ Real"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados da Oportunidade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Dados da Oportunidade
            </CardTitle>
            <CardDescription>Informações em tempo real da {opportunity.symbol}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Token</Label>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{opportunity.symbol}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Risco</Label>
                <Badge variant={
                  opportunity.riskLevel === 'LOW' ? 'default' : 
                  opportunity.riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'
                }>
                  {opportunity.riskLevel}
                </Badge>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Preço Spot</Label>
                <p className="font-mono font-medium">{formatCurrency(opportunity.buyPrice)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Preço Futures</Label>
                <p className="font-mono font-medium">{formatCurrency(opportunity.sellPrice)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Spread</Label>
                <p className={`font-medium ${opportunity.spreadPercentage > 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatPercentage(opportunity.spreadPercentage)}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Tempo Exec.</Label>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-sm">{timeToExecute}s</span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Liquidez Disponível</Label>
              <p className="text-sm">
                Compra: {formatCurrency(opportunity.liquidityBuy)} | 
                Venda: {formatCurrency(opportunity.liquiditySell)}
              </p>
              <p className="text-xs text-muted-foreground">
                Investimento máximo recomendado: {formatCurrency(maxInvestment)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Calculadora de Investimento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Simulação de Investimento
            </CardTitle>
            <CardDescription>Configure o valor do investimento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="investment">Valor do Investimento (USD)</Label>
              <Input
                id="investment"
                type="number"
                value={investmentAmount}
                onChange={(e) => setInvestmentAmount(Number(e.target.value))}
                min="1"
                max={maxInvestment}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Máximo recomendado: {formatCurrency(maxInvestment)}
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Quantidade Spot:</span>
                <span className="font-mono text-sm">{spotQuantity.toFixed(6)} tokens</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Valor Futures:</span>
                <span className="font-mono text-sm">{formatCurrency(futuresValue)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Lucro Bruto:</span>
                <span className="font-mono text-sm text-success">{formatCurrency(grossProfit)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Taxas de Gas:</span>
                <span className="font-mono text-sm text-destructive">-{formatCurrency(gasFees)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Slippage Est.:</span>
                <span className="font-mono text-sm text-destructive">-{formatCurrency(slippageCost)}</span>
              </div>

              <Separator />
              
              <div className="flex justify-between text-base font-semibold">
                <span>Lucro Líquido:</span>
                <span className={`font-mono ${netProfit > 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(netProfit)}
                </span>
              </div>
              
              <div className="flex justify-between text-base font-semibold">
                <span>ROI:</span>
                <span className={`font-mono ${roi > 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatPercentage(roi)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Risco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Análise de Risco e Viabilidade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Ponto de Equilíbrio</Label>
              <p className="font-mono text-sm">{formatCurrency(breakEvenPrice)}</p>
              <p className="text-xs text-muted-foreground">
                Preço mínimo para não ter prejuízo
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Margem de Segurança</Label>
              <p className="font-mono text-sm">
                {formatCurrency(opportunity.sellPrice - breakEvenPrice)}
              </p>
              <p className="text-xs text-muted-foreground">
                Diferença entre preço de venda e ponto de equilíbrio
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Eficiência de Capital</Label>
              <p className="font-mono text-sm">{(roi / timeToExecute * 3600).toFixed(2)}% /hora</p>
              <p className="text-xs text-muted-foreground">
                Retorno por hora de exposição
              </p>
            </div>
          </div>

          {investmentAmount > maxInvestment && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Investimento acima do recomendado. Pode haver problemas de liquidez.
              </AlertDescription>
            </Alert>
          )}

          {roi < 0.5 && (
            <Alert>
              <AlertDescription>
                ROI baixo. Considere aguardar uma oportunidade melhor ou reduzir o investimento.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Botão de Execução */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Executar Arbitragem</h3>
              <p className="text-sm text-muted-foreground">
                Confirme os dados acima antes de executar a operação
              </p>
            </div>
            <Button
              size="lg"
              onClick={executeArbitrage}
              disabled={netProfit <= 0 || investmentAmount > maxInvestment || isExecuting}
              className="min-w-[150px]"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executando...
                </>
              ) : (
                <>
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Executar
                  <span className="ml-2 font-mono">
                    {formatCurrency(netProfit)}
                  </span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}