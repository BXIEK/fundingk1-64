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
  const [showAddForm, setShowAddForm] = useState(false);
  
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
    setShowAddForm(false);
    
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
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="h-5 w-5 text-primary" />
            Conversão Automatizada
          </CardTitle>
          <div className="flex items-center gap-2">
            {configs.filter(c => c.enabled).length > 0 && (
              <Badge variant="default" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                {configs.filter(c => c.enabled).length} Ativo{configs.filter(c => c.enabled).length > 1 ? 's' : ''}
              </Badge>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowAddForm(!showAddForm)}
            >
              {showAddForm ? 'Cancelar' : '+ Nova'}
            </Button>
          </div>
        </div>
        <CardDescription className="text-xs">
          Compre baixo, venda alto automaticamente
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Formulário Compacto */}
        {showAddForm && (
          <div className="p-3 border rounded-lg bg-muted/20 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={newConfig.exchange}
                onValueChange={(value: 'binance' | 'okx') => 
                  setNewConfig({ ...newConfig, exchange: value })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="okx">OKX</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={newConfig.symbol}
                onValueChange={(value) => setNewConfig({ ...newConfig, symbol: value })}
              >
                <SelectTrigger className="h-8 text-xs">
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

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Input
                  type="number"
                  step="0.01"
                  value={newConfig.buyTargetPrice}
                  onChange={(e) => setNewConfig({ 
                    ...newConfig, 
                    buyTargetPrice: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="Compra $"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Input
                  type="number"
                  step="0.01"
                  value={newConfig.sellTargetPrice}
                  onChange={(e) => setNewConfig({ 
                    ...newConfig, 
                    sellTargetPrice: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="Venda $"
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <Input
                  type="number"
                  step="10"
                  value={newConfig.amountUsdt}
                  onChange={(e) => setNewConfig({ 
                    ...newConfig, 
                    amountUsdt: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="USDT"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <Button onClick={addConfig} size="sm" className="w-full h-8 text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Adicionar
            </Button>
          </div>
        )}

        {/* Lista Compacta */}
        {configs.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-xs">
            Nenhuma estratégia ativa
          </div>
        ) : (
          <div className="space-y-2">
            {configs.map((config, index) => {
              const currentPrice = getCurrentPrice(config.exchange, config.symbol);
              const shouldBuy = currentPrice > 0 && currentPrice <= config.buyTargetPrice;
              const shouldSell = currentPrice > 0 && currentPrice >= config.sellTargetPrice;

              return (
                <div key={index} className="p-2 border rounded-lg bg-card text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold">{config.symbol}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {config.exchange.toUpperCase()}
                      </Badge>
                      {shouldBuy && config.enabled && (
                        <Badge className="bg-green-500 text-[10px] h-4 px-1">
                          COMPRAR
                        </Badge>
                      )}
                      {shouldSell && config.enabled && (
                        <Badge className="bg-red-500 text-[10px] h-4 px-1">
                          VENDER
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={() => toggleConfig(index)}
                        className="scale-75"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeConfig(index)}
                        className="h-6 w-6 p-0"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="text-green-600">
                      <TrendingDown className="h-2.5 w-2.5 inline mr-0.5" />
                      ${config.buyTargetPrice.toFixed(0)}
                    </span>
                    <span className="font-mono font-semibold text-foreground">
                      ${currentPrice.toFixed(0)}
                    </span>
                    <span className="text-red-600">
                      <TrendingUp className="h-2.5 w-2.5 inline mr-0.5" />
                      ${config.sellTargetPrice.toFixed(0)}
                    </span>
                    <span>
                      <DollarSign className="h-2.5 w-2.5 inline" />
                      {config.amountUsdt}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {configs.some(c => c.enabled) && (
          <div className="flex items-center gap-1.5 text-[10px] text-primary bg-primary/5 p-2 rounded">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Monitorando e executando automaticamente</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
