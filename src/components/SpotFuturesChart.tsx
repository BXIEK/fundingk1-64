import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine } from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PriceData {
  timestamp: string;
  spotPrice: number;
  futuresPrice: number;
  spread: number;
  spreadPercentage: number;
}

const MAJOR_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT', 'MATICUSDT'];

export const SpotFuturesChart = () => {
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentSpread, setCurrentSpread] = useState<number>(0);
  const [marketCondition, setMarketCondition] = useState<'contango' | 'backwardation' | 'neutral'>('neutral');

  const fetchHistoricalData = async (symbol: string) => {
    setLoading(true);
    try {
      // Buscar dados históricos de spot e futures via Smart Proxy (evita bloqueio geográfico)
      const spotUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`;
      const futuresUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=24`;

      const [{ data: spotRes, error: spotErr }, { data: futuresRes, error: futuresErr }] = await Promise.all([
        supabase.functions.invoke('smart-proxy-service', {
          body: { targetUrl: spotUrl, strategy: 'stealth' }
        }),
        supabase.functions.invoke('smart-proxy-service', {
          body: { targetUrl: futuresUrl, strategy: 'stealth' }
        })
      ]);

      if (spotErr || futuresErr || !spotRes?.success || !futuresRes?.success) {
        throw new Error('Falha ao obter dados via proxy');
      }

      const spotData = spotRes.data;
      const futuresData = futuresRes.data;

      // Processar dados
      const processedData: PriceData[] = spotData.map((spot: any[], index: number) => {
        const futures = futuresData[index];
        const spotPrice = parseFloat(spot[4]); // Close price
        const futuresPrice = parseFloat(futures[4]); // Close price
        const spread = futuresPrice - spotPrice;
        const spreadPercentage = (spread / spotPrice) * 100;

        return {
          timestamp: new Date(spot[6]).toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          spotPrice,
          futuresPrice,
          spread,
          spreadPercentage
        };
      });

      setPriceData(processedData);
      
      // Calcular spread atual e condição do mercado
      const latestData = processedData[processedData.length - 1];
      if (latestData) {
        setCurrentSpread(latestData.spreadPercentage);
        
        if (latestData.spreadPercentage > 0.1) {
          setMarketCondition('contango');
        } else if (latestData.spreadPercentage < -0.1) {
          setMarketCondition('backwardation');
        } else {
          setMarketCondition('neutral');
        }
      }

    } catch (error) {
      console.error('Erro ao buscar dados:', error);
      toast.error('Erro ao carregar dados históricos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistoricalData(selectedSymbol);
    
    // Atualizar dados a cada 5 minutos
    const interval = setInterval(() => {
      fetchHistoricalData(selectedSymbol);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const chartConfig = {
    spotPrice: {
      label: "Preço Spot",
      color: "hsl(var(--primary))"
    },
    futuresPrice: {
      label: "Preço Futures",
      color: "hsl(var(--secondary))"
    }
  };

  const getMarketConditionColor = () => {
    switch (marketCondition) {
      case 'contango':
        return 'bg-green-500/20 text-green-700 border-green-300';
      case 'backwardation':
        return 'bg-red-500/20 text-red-700 border-red-300';
      default:
        return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getMarketConditionIcon = () => {
    switch (marketCondition) {
      case 'contango':
        return <TrendingUp className="h-4 w-4" />;
      case 'backwardation':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getMarketConditionText = () => {
    switch (marketCondition) {
      case 'contango':
        return 'Contango - Futures > Spot';
      case 'backwardation':
        return 'Backwardation - Futures < Spot';
      default:
        return 'Mercado Neutro';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Análise Spot vs Futures
                {getMarketConditionIcon()}
              </CardTitle>
              <CardDescription>
                Monitoramento de Contango e Backwardation para identificar oportunidades
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={getMarketConditionColor()}>
                {getMarketConditionText()}
              </Badge>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAJOR_SYMBOLS.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol.replace('USDT', '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchHistoricalData(selectedSymbol)}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">
                  {currentSpread.toFixed(3)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Spread Atual
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {priceData.length > 0 ? `$${priceData[priceData.length - 1]?.spotPrice.toFixed(2)}` : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Preço Spot Atual
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {priceData.length > 0 ? `$${priceData[priceData.length - 1]?.futuresPrice.toFixed(2)}` : '--'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Preço Futures Atual
                </p>
              </CardContent>
            </Card>
          </div>

          <ChartContainer config={chartConfig} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  fontSize={12}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  fontSize={12}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line 
                  type="monotone" 
                  dataKey="spotPrice" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={false}
                  name="Preço Spot"
                />
                <Line 
                  type="monotone" 
                  dataKey="futuresPrice" 
                  stroke="hsl(var(--secondary))" 
                  strokeWidth={2}
                  dot={false}
                  name="Preço Futures"
                />
                <ReferenceLine 
                  y={0} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="2 2" 
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Análise de Spread (%)</CardTitle>
          <CardDescription>
            Diferença percentual entre Futures e Spot ao longo do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  fontSize={12}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  fontSize={12}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <ChartTooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="font-medium">{label}</p>
                          <p className="text-sm">
                            <span className="font-medium">Spread:</span> {data.spreadPercentage.toFixed(3)}%
                          </p>
                          <p className="text-sm">
                            <span className="font-medium">Valor:</span> ${data.spread.toFixed(2)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="spreadPercentage" 
                  stroke={currentSpread > 0 ? "hsl(var(--chart-2))" : "hsl(var(--destructive))"} 
                  strokeWidth={2}
                  dot={false}
                  name="Spread %"
                />
                <ReferenceLine 
                  y={0} 
                  stroke="hsl(var(--muted-foreground))" 
                  strokeDasharray="2 2" 
                />
                <ReferenceLine 
                  y={0.1} 
                  stroke="hsl(var(--chart-2))" 
                  strokeDasharray="5 5" 
                  label={{ value: "Contango (+0.1%)", position: "top" }}
                />
                <ReferenceLine 
                  y={-0.1} 
                  stroke="hsl(var(--destructive))" 
                  strokeDasharray="5 5" 
                  label={{ value: "Backwardation (-0.1%)", position: "bottom" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};