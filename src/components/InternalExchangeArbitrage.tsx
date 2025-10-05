import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Zap, DollarSign, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ArbitrageOpportunity {
  id: string;
  base_currency: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread_percent: number;
  net_profit: number;
  created_at: string;
  is_active?: boolean;
  last_updated?: string;
  potential?: number;
  quote_currency?: string;
  spread?: number;
  transfer_fee?: number;
  transfer_time?: number;
  risk_level?: string;
}

export const InternalExchangeArbitrage = () => {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [autoExecute, setAutoExecute] = useState(false);
  const [minSpread, setMinSpread] = useState(0.3);
  const [tradeAmount, setTradeAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  useEffect(() => {
    fetchOpportunities();
    const interval = setInterval(fetchOpportunities, 10000); // Atualizar a cada 10s
    return () => clearInterval(interval);
  }, [minSpread]);

  const fetchOpportunities = async () => {
    try {
      const { data, error } = await supabase
        .from('realtime_arbitrage_opportunities')
        .select('*')
        .gte('spread', minSpread)
        .eq('is_active', true)
        .order('spread', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      // Mapear para garantir que tem spread_percent
      const mappedData = (data || []).map(opp => ({
        ...opp,
        spread_percent: opp.spread || 0
      }));
      
      setOpportunities(mappedData);

      // Auto-executar se habilitado
      if (autoExecute && mappedData && mappedData.length > 0) {
        const bestOpportunity = mappedData[0];
        if ((bestOpportunity.spread_percent || 0) >= minSpread) {
          await executeArbitrage(bestOpportunity);
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar oportunidades:', error);
    }
  };

  const executeArbitrage = async (opportunity: ArbitrageOpportunity) => {
    setExecuting(opportunity.id);
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Calcular quantidade baseada no valor em USDT
      const tokenAmount = tradeAmount / opportunity.buy_price;

      console.log(`🎯 Executando arbitragem interna: ${opportunity.base_currency}`);
      console.log(`💰 Comprar ${tokenAmount.toFixed(6)} na ${opportunity.buy_exchange} a $${opportunity.buy_price}`);
      console.log(`💰 Vender ${tokenAmount.toFixed(6)} na ${opportunity.sell_exchange} a $${opportunity.sell_price}`);

      const symbol = `${opportunity.base_currency}USDT`;
      
      const { data, error } = await supabase.functions.invoke('execute-internal-exchange-arbitrage', {
        body: {
          userId: user.id,
          symbol: symbol,
          buyExchange: opportunity.buy_exchange,
          sellExchange: opportunity.sell_exchange,
          amount: tokenAmount,
          buyPrice: opportunity.buy_price,
          sellPrice: opportunity.sell_price,
          spreadPercent: opportunity.spread_percent
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`✅ Arbitragem executada com sucesso!`, {
          description: `${opportunity.base_currency}: ${data.message}\nROI: ${data.profit.roi.toFixed(2)}%`
        });
      } else if (data.buySuccess || data.sellSuccess) {
        toast.warning(`⚠️ Arbitragem parcialmente executada`, {
          description: `Compra: ${data.buySuccess ? '✅' : '❌'} | Venda: ${data.sellSuccess ? '✅' : '❌'}`
        });
      } else {
        toast.error(`❌ Falha na arbitragem`, {
          description: data.buyError || data.sellError || 'Erro desconhecido'
        });
      }

      fetchOpportunities();
    } catch (error: any) {
      console.error('Erro ao executar arbitragem:', error);
      toast.error('❌ Erro ao executar arbitragem', {
        description: error.message
      });
    } finally {
      setLoading(false);
      setExecuting(null);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Arbitragem Interna Automatizada
            </CardTitle>
            <CardDescription>
              Compra e venda simultânea dentro das exchanges Binance e OKX
            </CardDescription>
          </div>
          <Badge variant={autoExecute ? "default" : "outline"} className="text-sm">
            {autoExecute ? "🟢 Ativo" : "⚪ Pausado"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Configurações */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="min-spread">Spread Mínimo (%)</Label>
            <Input
              id="min-spread"
              type="number"
              step="0.1"
              value={minSpread}
              onChange={(e) => setMinSpread(parseFloat(e.target.value) || 0)}
              disabled={autoExecute}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="trade-amount">Valor por Trade (USDT)</Label>
            <Input
              id="trade-amount"
              type="number"
              step="10"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(parseFloat(e.target.value) || 0)}
              disabled={autoExecute}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auto-execute">Execução Automática</Label>
            <div className="flex items-center space-x-2 pt-2">
              <Switch
                id="auto-execute"
                checked={autoExecute}
                onCheckedChange={setAutoExecute}
              />
              <span className="text-sm text-muted-foreground">
                {autoExecute ? "Executando automaticamente" : "Manual"}
              </span>
            </div>
          </div>
        </div>

        {autoExecute && (
          <Alert className="bg-primary/5 border-primary/20">
            <Zap className="h-4 w-4 text-primary" />
            <AlertDescription>
              ⚡ Modo automático ativo: Oportunidades com spread ≥ {minSpread}% serão executadas automaticamente
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de Oportunidades */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Oportunidades Detectadas</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOpportunities}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {opportunities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma oportunidade detectada no momento
            </div>
          ) : (
            <div className="space-y-2">
              {opportunities.map((opp) => (
                <Card key={opp.id} className="border-muted">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{opp.base_currency}</h4>
                          <Badge variant={opp.spread_percent >= 0.5 ? "default" : "secondary"}>
                            {opp.spread_percent.toFixed(3)}%
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <TrendingDown className="h-4 w-4 text-green-500" />
                            <span>Comprar {opp.buy_exchange}</span>
                            <span className="font-mono">${opp.buy_price.toFixed(4)}</span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-4 w-4 text-red-500" />
                            <span>Vender {opp.sell_exchange}</span>
                            <span className="font-mono">${opp.sell_price.toFixed(4)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-sm">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <span>Lucro estimado: ${opp.net_profit.toFixed(2)}</span>
                        </div>
                      </div>

                      <Button
                        onClick={() => executeArbitrage(opp)}
                        disabled={loading || executing === opp.id || autoExecute}
                        size="sm"
                      >
                        {executing === opp.id ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                            Executando...
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4 mr-2" />
                            Executar
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
