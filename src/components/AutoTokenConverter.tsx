import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TrendingUp, TrendingDown, Zap, DollarSign, RefreshCw, Target } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TokenPrice {
  symbol: string;
  price: number;
  change24h: number;
}

interface ConversionConfig {
  exchange: 'binance' | 'okx';
  symbol: string;
  buyTargetPrice: number;
  sellTargetPrice: number;
  amountUsdt: number;
  enabled: boolean;
}

export const AutoTokenConverter = () => {
  const [configs, setConfigs] = useState<ConversionConfig[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Map<string, TokenPrice>>(new Map());
  const [loading, setLoading] = useState(false);
  
  // Novo config
  const [newConfig, setNewConfig] = useState<ConversionConfig>({
    exchange: 'binance',
    symbol: 'BTC',
    buyTargetPrice: 0,
    sellTargetPrice: 0,
    amountUsdt: 100,
    enabled: true
  });

  // Buscar preços em tempo real
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        // Buscar preços da Binance
        const { data: binanceData } = await supabase.functions.invoke('binance-market-data', {
          body: { action: 'get_spot_prices' }
        });

        // Buscar preços da OKX
        const { data: okxData } = await supabase.functions.invoke('okx-api', {
          body: { action: 'get_prices' }
        });

        const pricesMap = new Map<string, TokenPrice>();

        if (binanceData?.success && binanceData.data) {
          Object.entries(binanceData.data).forEach(([symbol, data]: [string, any]) => {
            pricesMap.set(`binance_${symbol}`, {
              symbol,
              price: data.price,
              change24h: data.priceChangePercent || 0
            });
          });
        }

        if (okxData?.success && okxData.data) {
          Object.entries(okxData.data).forEach(([symbol, data]: [string, any]) => {
            pricesMap.set(`okx_${symbol}`, {
              symbol,
              price: data.price,
              change24h: data.change24h || 0
            });
          });
        }

        setCurrentPrices(pricesMap);
      } catch (error) {
        console.error('Erro ao buscar preços:', error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 5000); // Atualizar a cada 5s

    return () => clearInterval(interval);
  }, []);

  // Monitorar e executar conversões automaticamente
  useEffect(() => {
    const checkAndExecute = async () => {
      for (const config of configs) {
        if (!config.enabled) continue;

        const priceKey = `${config.exchange}_${config.symbol}USDT`;
        const currentPrice = currentPrices.get(priceKey);

        if (!currentPrice) continue;

        // Verificar se deve comprar (preço atual <= preço alvo de compra)
        if (currentPrice.price <= config.buyTargetPrice) {
          console.log(`🔵 Oportunidade de COMPRA: ${config.symbol} na ${config.exchange} a $${currentPrice.price}`);
          await executeConversion(config, 'buy', currentPrice.price);
        }

        // Verificar se deve vender (preço atual >= preço alvo de venda)
        if (currentPrice.price >= config.sellTargetPrice) {
          console.log(`🟢 Oportunidade de VENDA: ${config.symbol} na ${config.exchange} a $${currentPrice.price}`);
          await executeConversion(config, 'sell', currentPrice.price);
        }
      }
    };

    const interval = setInterval(checkAndExecute, 10000); // Verificar a cada 10s
    return () => clearInterval(interval);
  }, [configs, currentPrices]);

  const executeConversion = async (
    config: ConversionConfig,
    action: 'buy' | 'sell',
    currentPrice: number
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar credenciais
      const { data: credsData, error: credsError } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', config.exchange)
        .single();

      if (credsError || !credsData) {
        console.error('Credenciais não encontradas');
        return;
      }

      const credentials = config.exchange === 'binance'
        ? { apiKey: credsData.api_key, secretKey: credsData.secret_key }
        : { apiKey: credsData.api_key, secretKey: credsData.secret_key, passphrase: credsData.passphrase };

      const functionName = config.exchange === 'binance' ? 'binance-swap-token' : 'okx-swap-token';
      const direction = action === 'buy' ? 'toToken' : 'toUsdt';
      const amount = action === 'buy' ? config.amountUsdt : undefined; // Ao vender, usar todo o saldo do token

      console.log(`🔄 Executando ${action.toUpperCase()} de ${config.symbol} na ${config.exchange}`);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: {
          ...credentials,
          symbol: config.symbol,
          direction,
          customAmount: amount
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`✅ ${action === 'buy' ? 'Compra' : 'Venda'} executada!`, {
          description: `${config.symbol} na ${config.exchange} a $${currentPrice.toFixed(2)}`
        });

        // Desabilitar temporariamente para evitar execuções repetidas
        setConfigs(prev => prev.map(c => 
          c.exchange === config.exchange && c.symbol === config.symbol
            ? { ...c, enabled: false }
            : c
        ));
      } else {
        throw new Error(data.error || 'Erro na conversão');
      }

    } catch (error: any) {
      console.error('Erro na conversão automática:', error);
      toast.error(`❌ Erro na conversão`, {
        description: error.message
      });
    }
  };

  const addConfig = () => {
    if (newConfig.buyTargetPrice >= newConfig.sellTargetPrice) {
      toast.error('❌ Preço de compra deve ser menor que preço de venda');
      return;
    }

    if (newConfig.amountUsdt <= 0) {
      toast.error('❌ Valor deve ser maior que zero');
      return;
    }

    setConfigs([...configs, { ...newConfig }]);
    toast.success('✅ Configuração adicionada');
    
    // Reset form
    setNewConfig({
      exchange: 'binance',
      symbol: 'BTC',
      buyTargetPrice: 0,
      sellTargetPrice: 0,
      amountUsdt: 100,
      enabled: true
    });
  };

  const removeConfig = (index: number) => {
    setConfigs(configs.filter((_, i) => i !== index));
    toast.success('🗑️ Configuração removida');
  };

  const toggleConfig = (index: number) => {
    setConfigs(configs.map((c, i) => 
      i === index ? { ...c, enabled: !c.enabled } : c
    ));
  };

  const getCurrentPrice = (exchange: string, symbol: string) => {
    const price = currentPrices.get(`${exchange}_${symbol}USDT`);
    return price?.price || 0;
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Conversão Automatizada de Tokens
            </CardTitle>
            <CardDescription>
              Compre baixo, venda alto automaticamente em cada exchange
            </CardDescription>
          </div>
          <Badge variant={configs.some(c => c.enabled) ? "default" : "outline"}>
            {configs.filter(c => c.enabled).length} Ativos
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Nova Configuração */}
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <h3 className="font-semibold text-sm">Nova Estratégia</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Exchange</Label>
              <Select
                value={newConfig.exchange}
                onValueChange={(value: 'binance' | 'okx') => 
                  setNewConfig({ ...newConfig, exchange: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="okx">OKX</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Token</Label>
              <Select
                value={newConfig.symbol}
                onValueChange={(value) => setNewConfig({ ...newConfig, symbol: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTC">BTC</SelectItem>
                  <SelectItem value="ETH">ETH</SelectItem>
                  <SelectItem value="BNB">BNB</SelectItem>
                  <SelectItem value="SOL">SOL</SelectItem>
                  <SelectItem value="ADA">ADA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Preço de Compra (USD)</Label>
              <div className="flex gap-2 items-center">
                <TrendingDown className="h-4 w-4 text-green-500" />
                <Input
                  type="number"
                  step="0.01"
                  value={newConfig.buyTargetPrice}
                  onChange={(e) => setNewConfig({ 
                    ...newConfig, 
                    buyTargetPrice: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="Ex: 95000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preço de Venda (USD)</Label>
              <div className="flex gap-2 items-center">
                <TrendingUp className="h-4 w-4 text-red-500" />
                <Input
                  type="number"
                  step="0.01"
                  value={newConfig.sellTargetPrice}
                  onChange={(e) => setNewConfig({ 
                    ...newConfig, 
                    sellTargetPrice: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="Ex: 105000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Valor por Operação (USDT)</Label>
              <div className="flex gap-2 items-center">
                <DollarSign className="h-4 w-4 text-primary" />
                <Input
                  type="number"
                  step="10"
                  value={newConfig.amountUsdt}
                  onChange={(e) => setNewConfig({ 
                    ...newConfig, 
                    amountUsdt: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="Ex: 100"
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button onClick={addConfig} className="w-full">
                <Zap className="h-4 w-4 mr-2" />
                Adicionar Estratégia
              </Button>
            </div>
          </div>
        </div>

        {/* Estratégias Ativas */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            Estratégias Configuradas
            <RefreshCw className="h-4 w-4 animate-spin text-primary" />
          </h3>

          {configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma estratégia configurada
            </div>
          ) : (
            <div className="space-y-2">
              {configs.map((config, index) => {
                const currentPrice = getCurrentPrice(config.exchange, config.symbol);
                const shouldBuy = currentPrice > 0 && currentPrice <= config.buyTargetPrice;
                const shouldSell = currentPrice > 0 && currentPrice >= config.sellTargetPrice;

                return (
                  <Card key={index} className="border-muted">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{config.symbol}</h4>
                            <Badge variant="outline" className="text-xs">
                              {config.exchange.toUpperCase()}
                            </Badge>
                            {shouldBuy && config.enabled && (
                              <Badge className="bg-green-500 text-xs">
                                🔵 COMPRAR AGORA
                              </Badge>
                            )}
                            {shouldSell && config.enabled && (
                              <Badge className="bg-red-500 text-xs">
                                🟢 VENDER AGORA
                              </Badge>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Compra:</span>
                              <p className="font-mono text-green-600">
                                ${config.buyTargetPrice.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Atual:</span>
                              <p className="font-mono font-semibold">
                                ${currentPrice.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Venda:</span>
                              <p className="font-mono text-red-600">
                                ${config.sellTargetPrice.toFixed(2)}
                              </p>
                            </div>
                          </div>

                          <div className="text-sm text-muted-foreground">
                            <DollarSign className="h-3 w-3 inline mr-1" />
                            Valor: {config.amountUsdt} USDT
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={config.enabled}
                            onCheckedChange={() => toggleConfig(index)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeConfig(index)}
                          >
                            🗑️
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {configs.some(c => c.enabled) && (
          <Alert className="bg-primary/5 border-primary/20">
            <Zap className="h-4 w-4 text-primary" />
            <AlertDescription>
              ⚡ Sistema monitorando preços e executando conversões automaticamente
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
