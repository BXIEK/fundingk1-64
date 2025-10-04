import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Activity, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import { useTriangularWebSocket } from '@/hooks/useTriangularWebSocket';

export const TriangularArbitrageDashboard = () => {
  const [enabled, setEnabled] = useState(false);
  const { data, isConnected, error } = useTriangularWebSocket(enabled);

  // Memoize stats para evitar re-renders desnecessários
  const stats = useMemo(() => ({
    opportunitiesCount: data.opportunities.length,
    bestProfit: data.opportunities[0]?.profitPercentage.toFixed(3) || '0.000',
    bestProfitUsd: data.opportunities[0]?.netProfitUsd.toFixed(2) || '0.00',
  }), [data.opportunities]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Zap className="w-8 h-8 text-primary" />
            Arbitragem Triangular (WebSocket)
          </h1>
          <p className="text-muted-foreground mt-1">
            Detecção em tempo real via WebSocket (~100ms)
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? '🟢 Conectado' : '⚫ Desconectado'}
          </Badge>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Engine</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.opportunitiesCount}</div>
            <p className="text-xs text-muted-foreground">Ciclos triangulares ativos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Lucro</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.bestProfit}%
            </div>
            <p className="text-xs text-muted-foreground">
              ${stats.bestProfitUsd} USD
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isConnected && enabled ? 'ATIVO' : 'INATIVO'}
            </div>
            <p className="text-xs text-muted-foreground">WebSocket em tempo real</p>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle>Oportunidades de Arbitragem Triangular</CardTitle>
          <CardDescription>
            Ciclos triangulares detectados via WebSocket (atualização a cada ~100ms)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.opportunities.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Activity className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {enabled ? 'Buscando oportunidades...' : 'Engine desligado'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                {enabled 
                  ? 'Conectado via WebSocket. Aguardando ciclos triangulares lucrativos (mínimo 0.3% de lucro líquido).'
                  : 'Ative o engine acima para começar a detectar oportunidades em tempo real.'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.opportunities.map((opp) => (
                <Card key={opp.id} className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {opp.cycle.join(' → ')}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          Exchange: {opp.exchange.toUpperCase()}
                        </CardDescription>
                      </div>
                      <Badge variant="default" className="text-base font-bold">
                        +{opp.profitPercentage.toFixed(3)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      {opp.cycle.map((pair) => (
                        <div key={pair} className="space-y-1">
                          <div className="font-medium text-muted-foreground">{pair}</div>
                          <div className="font-mono text-lg">
                            ${opp.prices[pair]?.toFixed(6) || 'N/A'}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="pt-3 border-t flex items-center justify-between text-sm">
                      <div>
                        <span className="text-muted-foreground">Lucro Líquido:</span>
                        <span className="ml-2 font-bold text-green-600">
                          ${opp.netProfitUsd.toFixed(2)} USD
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(opp.timestamp).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prices Table */}
      {data.prices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preços em Tempo Real</CardTitle>
            <CardDescription>Atualização via WebSocket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {data.prices.map((price) => (
                <div key={price.symbol} className="border rounded-lg p-3">
                  <div className="text-sm font-medium text-muted-foreground">
                    {price.symbol}
                  </div>
                  <div className="text-xl font-mono mt-1">
                    ${price.price.toFixed(6)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Vol: {price.volume.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
