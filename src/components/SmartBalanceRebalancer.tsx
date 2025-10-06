import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/userUtils";
import { RefreshCw, TrendingUp, DollarSign, Wallet, Settings2, ArrowRight, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TokenAllocation {
  symbol: string;
  targetPercent: number;
  currentPercent: number;
  needsRebalance: boolean;
  currentValue: number;
  targetValue: number;
}

interface ExchangeBalance {
  exchange: string;
  tokens: TokenAllocation[];
  totalValue: number;
}

interface ConversionPreview {
  exchange: string;
  fromToken: string;
  toToken: string;
  amount: number;
  valueUsd: number;
  reason: string;
}

export const SmartBalanceRebalancer = () => {
  const { toast } = useToast();
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [balances, setBalances] = useState<ExchangeBalance[]>([]);
  const [autoRebalanceEnabled, setAutoRebalanceEnabled] = useState(false);
  const [lastRebalance, setLastRebalance] = useState<Date | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [conversionsPreview, setConversionsPreview] = useState<ConversionPreview[]>([]);
  const [portfolioData, setPortfolioData] = useState<any[]>([]);

  useEffect(() => {
    loadBalances();
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const userId = await getUserId();
      const { data } = await supabase
        .from('smart_rebalance_configs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (data) {
        setAutoRebalanceEnabled(data.is_enabled);
        setLastRebalance(data.last_rebalance_at ? new Date(data.last_rebalance_at) : null);
      }
    } catch (error) {
      console.error('Erro ao carregar config:', error);
    }
  };

  const loadBalances = async () => {
    try {
      const userId = await getUserId();
      
      // Buscar saldos reais das exchanges
      const { data: portfolioData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', userId)
        .gt('balance', 0);

      if (!portfolioData) return;

      setPortfolioData(portfolioData);

      // Agrupar por exchange
      const byExchange = portfolioData.reduce((acc: any, item) => {
        const exchange = item.exchange || 'GLOBAL';
        if (!acc[exchange]) {
          acc[exchange] = [];
        }
        acc[exchange].push(item);
        return acc;
      }, {});

      // Calcular alocações
      const balanceData: ExchangeBalance[] = Object.entries(byExchange).map(([exchange, tokens]: [string, any]) => {
        const totalValue = tokens.reduce((sum: number, t: any) => sum + (t.value_usd_calculated || 0), 0);
        
        const tokenAllocations: TokenAllocation[] = tokens.map((t: any) => {
          const currentValue = t.value_usd_calculated || 0;
          const currentPercent = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
          const targetPercent = 25; // 25% cada token (USDT, BTC, ETH, SOL)
          const targetValue = (totalValue * targetPercent) / 100;
          const needsRebalance = Math.abs(currentPercent - targetPercent) > 10; // >10% desvio

          return {
            symbol: t.symbol,
            targetPercent,
            currentPercent,
            currentValue,
            targetValue,
            needsRebalance
          };
        });

        return {
          exchange,
          tokens: tokenAllocations,
          totalValue
        };
      });

      setBalances(balanceData);
    } catch (error) {
      console.error('Erro ao carregar saldos:', error);
    }
  };

  const calculateConversions = () => {
    const conversions: ConversionPreview[] = [];
    const maxDeviation = 10;
    const minTradeValue = 10;

    balances.forEach((balance) => {
      balance.tokens.forEach((token) => {
        const deviation = token.currentPercent - token.targetPercent;
        const deltaValue = Math.abs(token.currentValue - token.targetValue);

        if (Math.abs(deviation) > maxDeviation && deltaValue >= minTradeValue) {
          if (deviation > 0) {
            // Token acima do alvo - vender para USDT
            conversions.push({
              exchange: balance.exchange,
              fromToken: token.symbol,
              toToken: 'USDT',
              amount: deltaValue / (token.currentValue / 100), // estimativa
              valueUsd: deltaValue,
              reason: `${token.currentPercent.toFixed(1)}% → ${token.targetPercent}% (excesso de ${deviation.toFixed(1)}%)`
            });
          } else {
            // Token abaixo do alvo - comprar com USDT
            conversions.push({
              exchange: balance.exchange,
              fromToken: 'USDT',
              toToken: token.symbol,
              amount: deltaValue,
              valueUsd: deltaValue,
              reason: `${token.currentPercent.toFixed(1)}% → ${token.targetPercent}% (falta ${Math.abs(deviation).toFixed(1)}%)`
            });
          }
        }
      });
    });

    return conversions;
  };

  const showConversionsPreview = () => {
    const conversions = calculateConversions();
    setConversionsPreview(conversions);
    setShowPreview(true);
  };

  const executeRebalance = async () => {
    setShowPreview(false);
    setIsRebalancing(true);
    try {
      const userId = await getUserId();

      toast({
        title: "🔄 Iniciando Rebalanceamento",
        description: "Analisando desvios e executando conversões internas...",
      });

      const { data, error } = await supabase.functions.invoke('smart-rebalance', {
        body: { 
          userId,
          targetAllocations: {
            'USDT': 25,
            'BTC': 25,
            'ETH': 25,
            'SOL': 25
          },
          maxDeviation: 10, // % máximo de desvio tolerado
          minTradeValue: 10 // Mínimo $10 por conversão
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Rebalanceamento Concluído",
        description: `${data.conversions} conversões executadas. Portfólio rebalanceado!`,
      });

      setLastRebalance(new Date());
      loadBalances();

    } catch (error: any) {
      console.error('Erro no rebalanceamento:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha no rebalanceamento",
        variant: "destructive"
      });
    } finally {
      setIsRebalancing(false);
    }
  };

  const toggleAutoRebalance = async () => {
    try {
      const userId = await getUserId();
      const newState = !autoRebalanceEnabled;

      const { error } = await supabase
        .from('smart_rebalance_configs')
        .upsert({
          user_id: userId,
          is_enabled: newState,
          rebalance_frequency_hours: 24,
          target_allocations: {
            'USDT': 25,
            'BTC': 25,
            'ETH': 25,
            'SOL': 25
          },
          max_deviation_percent: 10,
          min_trade_value: 10
        }, { onConflict: 'user_id' });

      if (error) throw error;

      setAutoRebalanceEnabled(newState);
      toast({
        title: newState ? "✅ Auto-Rebalanceamento Ativado" : "⏸️ Auto-Rebalanceamento Pausado",
        description: newState 
          ? "Sistema rebalanceará automaticamente a cada 24h"
          : "Rebalanceamento manual apenas",
      });

    } catch (error: any) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5 text-primary" />
          Rebalanceamento Inteligente
        </CardTitle>
        <CardDescription>
          Mantém distribuição equilibrada de tokens em cada exchange
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status e Controles */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">Auto-Rebalanceamento</span>
              <Badge variant={autoRebalanceEnabled ? "default" : "secondary"}>
                {autoRebalanceEnabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            {lastRebalance && (
              <p className="text-sm text-muted-foreground">
                Último: {lastRebalance.toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <Button
            onClick={toggleAutoRebalance}
            variant={autoRebalanceEnabled ? "outline" : "default"}
            size="sm"
          >
            {autoRebalanceEnabled ? "Desativar" : "Ativar"}
          </Button>
        </div>

        {/* Alocações por Exchange */}
        {balances.map((balance) => (
          <div key={balance.exchange} className="space-y-3 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium">{balance.exchange}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                <DollarSign className="h-3 w-3 inline" />
                {balance.totalValue.toFixed(2)}
              </div>
            </div>

            {/* Tokens */}
            <div className="space-y-2">
              {balance.tokens.map((token) => (
                <div key={token.symbol} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{token.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className={token.needsRebalance ? "text-yellow-500" : "text-muted-foreground"}>
                        {token.currentPercent.toFixed(1)}%
                      </span>
                      <span className="text-muted-foreground">→ {token.targetPercent}%</span>
                      {token.needsRebalance && (
                        <Badge variant="outline" className="text-xs">
                          Desbalanceado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={token.currentPercent} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Ação de Rebalanceamento */}
        <div className="space-y-3">
          <Button
            onClick={showConversionsPreview}
            disabled={isRebalancing}
            className="w-full"
            size="lg"
          >
            {isRebalancing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Rebalanceando...
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Visualizar Conversões
              </>
            )}
          </Button>

          <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
            <p className="font-medium mb-1">📊 Como Funciona</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>Mantém 25% do valor em cada token (USDT, BTC, ETH, SOL)</li>
              <li>Conversões internas dentro de cada exchange</li>
              <li>Sem transferências entre exchanges</li>
              <li>Execução automática quando desvio &gt; 10%</li>
            </ul>
          </div>
        </div>

        {/* Dialog de Preview */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Preview de Conversões
              </DialogTitle>
              <DialogDescription>
                Conversões que serão executadas para rebalancear o portfólio
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {conversionsPreview.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="font-medium">✅ Portfólio já está balanceado!</p>
                  <p className="text-sm mt-2">Nenhuma conversão necessária no momento.</p>
                </div>
              ) : (
                <>
                  {/* Resumo */}
                  <div className="bg-primary/10 p-4 rounded-lg">
                    <p className="font-medium text-sm mb-2">📊 Resumo</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total de conversões:</span>
                        <span className="ml-2 font-medium">{conversionsPreview.length}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor total:</span>
                        <span className="ml-2 font-medium">
                          ${conversionsPreview.reduce((sum, c) => sum + c.valueUsd, 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Conversões */}
                  <div className="space-y-3">
                    {conversionsPreview.map((conversion, idx) => (
                      <div key={idx} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{conversion.exchange}</Badge>
                          <span className="text-sm text-muted-foreground">
                            ${conversion.valueUsd.toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg">{conversion.fromToken}</span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-lg text-primary">{conversion.toToken}</span>
                        </div>

                        <p className="text-sm text-muted-foreground">
                          {conversion.reason}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Cancelar
              </Button>
              {conversionsPreview.length > 0 && (
                <Button onClick={executeRebalance} disabled={isRebalancing}>
                  {isRebalancing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Confirmar Rebalanceamento
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
