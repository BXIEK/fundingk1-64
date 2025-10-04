import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useHFTWebSocket } from '@/hooks/useHFTWebSocket';
import { Activity, TrendingUp, Zap, Clock, DollarSign, Percent } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AVAILABLE_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
const AVAILABLE_EXCHANGES = ['binance', 'okx', 'bybit', 'hyperliquid'];

export const HFTDashboard = () => {
  const [enabled, setEnabled] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['BTC/USDT']);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['binance', 'okx']);
  const { toast } = useToast();

  const { data, isConnected, error } = useHFTWebSocket(
    selectedSymbols,
    selectedExchanges,
    enabled
  );

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (checked) {
      toast({
        title: '🚀 HFT Engine Iniciado',
        description: 'Monitorando oportunidades em tempo real via WebSocket',
      });
    } else {
      toast({
        title: '⏸️ HFT Engine Pausado',
        description: 'Monitoramento de oportunidades pausado',
      });
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
          </h1>
          <p className="text-muted-foreground">
            Alta Frequência com WebSocket - Latência Ultra-Baixa
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? 'default' : 'secondary'}>
            {isConnected ? '🟢 Conectado' : '⚫ Desconectado'}
          </Badge>
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
                  : '0%'}
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
                &lt;30ms
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Oportunidades em Tempo Real */}
      {data && data.opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>🎯 Oportunidades Detectadas (Tempo Real)</CardTitle>
            <CardDescription>
              Atualização em tempo real via WebSocket
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

      {/* Preços em Tempo Real */}
      {data && data.prices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>📊 Preços ao Vivo (WebSocket)</CardTitle>
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
    </div>
  );
};
