import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  PiggyBank,
  Minus,
  Zap,
  RefreshCw
} from 'lucide-react';

interface TotalBalanceCardProps {
  binanceBalance: number;
  okxBalance: number;
  totalBaseline?: number;
  spreadData?: {
    symbol: string;
    spreadPercent: number;
    buyExchange: string;
    sellExchange: string;
    buyPrice: number;
    sellPrice: number;
    priceChange24h?: number;
  } | null;
  onAutoArbitrage?: (enabled: boolean) => void;
}

export const TotalBalanceCard = ({ 
  binanceBalance, 
  okxBalance,
  totalBaseline = 200,
  spreadData,
  onAutoArbitrage
}: TotalBalanceCardProps) => {
  const { toast } = useToast();
  const [autoArbitrageEnabled, setAutoArbitrageEnabled] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastExecution, setLastExecution] = useState<Date | null>(null);
  
  const totalValue = binanceBalance + okxBalance;
  const profitLoss = totalValue - totalBaseline;
  const profitLossPercent = totalBaseline > 0 ? (profitLoss / totalBaseline) * 100 : 0;
  const isProfit = profitLoss > 0;
  const isLoss = profitLoss < 0;

  // Arbitragem automática REAL - executa a cada 60 segundos se token estiver em tendência de alta
  useEffect(() => {
    if (!autoArbitrageEnabled || !spreadData) {
      return;
    }

    const executeArbitrage = async () => {
      // Verificar se o token está em tendência de alta (priceChange24h > 0)
      const isUptrend = spreadData.priceChange24h && spreadData.priceChange24h > 0;
      
      if (!isUptrend) {
        console.log(`⏸️ Token ${spreadData.symbol} não está em tendência de alta (${spreadData.priceChange24h?.toFixed(2)}%). Aguardando...`);
        toast({
          title: "⏸️ Aguardando Tendência de Alta",
          description: `${spreadData.symbol} em ${spreadData.priceChange24h?.toFixed(2)}% nas últimas 24h. Arbitragem pausada.`,
        });
        return;
      }

      // Verificar se há spread positivo
      if (spreadData.spreadPercent <= 0) {
        console.log(`⏸️ Spread negativo ou neutro (${spreadData.spreadPercent.toFixed(4)}%). Aguardando spread positivo...`);
        return;
      }

      setIsExecuting(true);
      
      try {
        // Obter user_id do Supabase
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Usuário não autenticado');
        }

        console.log(`🤖 Executando arbitragem REAL (Token em alta +${spreadData.priceChange24h.toFixed(2)}%):
          • Comprar ${spreadData.symbol} na ${spreadData.buyExchange} por $${spreadData.buyPrice.toFixed(4)}
          • Vender ${spreadData.symbol} na ${spreadData.sellExchange} por $${spreadData.sellPrice.toFixed(4)}
          • Spread: ${spreadData.spreadPercent.toFixed(4)}%`);

        toast({
          title: "🤖 Arbitragem Automática Executando",
          description: `${spreadData.symbol} em alta +${spreadData.priceChange24h.toFixed(2)}%! Comprando na ${spreadData.buyExchange} e vendendo na ${spreadData.sellExchange}.`,
        });

        // Executar arbitragem real via edge function
        const { data, error } = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
          body: {
            user_id: user.id,
            symbol: spreadData.symbol.replace('USDT', ''), // Remover USDT do símbolo
            buy_exchange: spreadData.buyExchange,
            sell_exchange: spreadData.sellExchange,
            buy_price: spreadData.buyPrice,
            sell_price: spreadData.sellPrice,
            investment_amount: 25, // Valor fixo de investimento por operação
            trading_mode: 'real'
          }
        });

        if (error) {
          throw error;
        }

        setLastExecution(new Date());
        
        if (data.success) {
          toast({
            title: "✅ Arbitragem Concluída",
            description: `${spreadData.symbol} - Lucro: $${data.net_profit?.toFixed(2) || '0.00'} (${spreadData.spreadPercent.toFixed(4)}%)`,
          });
        } else {
          toast({
            title: "⚠️ Arbitragem Não Executada",
            description: data.message || "Verifique os logs para mais detalhes",
            variant: "destructive"
          });
        }

      } catch (error: any) {
        console.error('Erro na arbitragem automática:', error);
        toast({
          title: "❌ Erro na Arbitragem",
          description: error.message || "Falha ao executar arbitragem automática",
          variant: "destructive"
        });
      } finally {
        setIsExecuting(false);
      }
    };

    // Executar imediatamente
    executeArbitrage();

    // Depois executar a cada 60 segundos
    const interval = setInterval(executeArbitrage, 60000);

    return () => clearInterval(interval);
  }, [autoArbitrageEnabled, spreadData, toast]);

  return (
    <Card className="relative overflow-hidden border-2 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PiggyBank className="h-5 w-5" />
          Saldo Total (Todas as Exchanges)
        </CardTitle>
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

        {/* Arbitragem Automática */}
        {spreadData && (
          <div className="pt-3 border-t">
            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {autoArbitrageEnabled ? (
                    <Zap className="h-5 w-5 text-primary animate-pulse" />
                  ) : (
                    <RefreshCw className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <Label htmlFor="auto-arbitrage" className="text-sm font-semibold cursor-pointer">
                      {autoArbitrageEnabled ? "🤖 Arbitragem Automática Ativa" : "🎯 Arbitragem Automática"}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {autoArbitrageEnabled 
                        ? `A cada 60s quando token em alta • Última: ${lastExecution?.toLocaleTimeString() || 'Aguardando...'}` 
                        : "Compra/venda automática em tendência de alta"}
                    </p>
                  </div>
                </div>
                <Switch
                  id="auto-arbitrage"
                  checked={autoArbitrageEnabled}
                  disabled={isExecuting}
                  onCheckedChange={(checked) => {
                    setAutoArbitrageEnabled(checked);
                    onAutoArbitrage?.(checked);
                    const trendText = spreadData.priceChange24h 
                      ? ` (Tendência: ${spreadData.priceChange24h > 0 ? '+' : ''}${spreadData.priceChange24h.toFixed(2)}%)`
                      : '';
                    toast({
                      title: checked ? "🤖 Arbitragem Automática Ativada" : "⏸️ Arbitragem Automática Pausada",
                      description: checked 
                        ? `Monitorando ${spreadData.symbol} a cada 60s. Executará quando em tendência de alta${trendText}` 
                        : "Arbitragem automática foi pausada",
                    });
                  }}
                />
              </div>

              <div className="space-y-2">
                {/* Spread em Tempo Real */}
                <div className="p-3 rounded-lg border-2 bg-gradient-to-r from-primary/10 to-primary/20 border-primary/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">Spread em Tempo Real</span>
                    </div>
                    <span className={`text-xl font-bold ${
                      spreadData.spreadPercent > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {spreadData.spreadPercent > 0 ? '+' : ''}{spreadData.spreadPercent.toFixed(4)}%
                    </span>
                  </div>
                </div>

                {/* Status da Tendência */}
                <div className={`p-2 rounded border ${
                  spreadData.priceChange24h && spreadData.priceChange24h > 0 
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-orange-500/10 border-orange-500/20'
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Tendência 24h:</span>
                    <span className={`font-semibold ${
                      spreadData.priceChange24h && spreadData.priceChange24h > 0 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                    }`}>
                      {spreadData.priceChange24h 
                        ? `${spreadData.priceChange24h > 0 ? '📈 +' : '📉 '}${spreadData.priceChange24h.toFixed(2)}%`
                        : 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Spreads e Exchanges */}
                {spreadData.spreadPercent > 0 && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-green-500/10 border border-green-500/20 rounded">
                      <p className="text-muted-foreground">Comprar em</p>
                      <p className="font-semibold text-green-600">{spreadData.buyExchange}</p>
                      <p className="text-muted-foreground">${spreadData.buyPrice.toFixed(4)}</p>
                    </div>
                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded">
                      <p className="text-muted-foreground">Vender em</p>
                      <p className="font-semibold text-red-600">{spreadData.sellExchange}</p>
                      <p className="text-muted-foreground">${spreadData.sellPrice.toFixed(4)}</p>
                    </div>
                  </div>
                )}

                {spreadData.spreadPercent <= 0 && (
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="text-xs text-muted-foreground">
                      ⏸️ Spread negativo ou neutro. Aguardando spread positivo.
                    </p>
                  </div>
                )}

                {/* Aviso sobre tendência */}
                {(!spreadData.priceChange24h || spreadData.priceChange24h <= 0) && (
                  <div className="text-center p-2 bg-orange-500/10 border border-orange-500/20 rounded">
                    <p className="text-xs text-orange-600">
                      ⚠️ Arbitragem pausada: aguardando tendência de alta
                    </p>
                  </div>
                )}
              </div>

              {isExecuting && (
                <div className="text-center">
                  <Badge variant="secondary" className="animate-pulse">
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Executando arbitragem...
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};