import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/userUtils";
import { Settings, Play, Pause, AlertTriangle, CheckCircle, DollarSign, Timer } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface AutoArbitrageConfig {
  id?: string;
  user_id: string;
  is_enabled: boolean;
  min_spread_percentage: number;
  max_investment_per_trade: number;
  daily_limit_usd: number;
  max_concurrent_operations: number;
  trading_mode: 'real' | 'simulation';
  target_exchanges: string[];
  enabled_symbols: string[];
  risk_level: 'conservative' | 'moderate' | 'aggressive';
  stop_loss_percentage: number;
  created_at?: string;
  updated_at?: string;
}

const AutoArbitrageConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AutoArbitrageConfig>({
    user_id: '',
    is_enabled: false,
    min_spread_percentage: 0.5,
    max_investment_per_trade: 100,
    daily_limit_usd: 1000,
    max_concurrent_operations: 3,
    trading_mode: 'simulation',
    target_exchanges: ['Binance', 'OKX'],
    enabled_symbols: ['BTC', 'ETH', 'SOL', 'BNB', 'ADA'],
    risk_level: 'moderate',
    stop_loss_percentage: 2.0
  });

  const [apiStatus, setApiStatus] = useState({
    binance: 'unknown',
    okx: 'unknown',
    hyperliquid: 'unknown'
  });

  useEffect(() => {
    loadConfiguration();
    checkApiStatus();
  }, []);

  const loadConfiguration = async () => {
    setLoading(true);
    try {
      const userId = await getUserId();
      setConfig(prev => ({ ...prev, user_id: userId }));

      const { data, error } = await supabase
        .from('cross_exchange_configs')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setConfig({
          ...data,
          target_exchanges: data.target_exchanges || ['Binance', 'OKX'],
          enabled_symbols: data.enabled_symbols || ['BTC', 'ETH', 'SOL', 'BNB', 'ADA']
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar configuração. Usando valores padrão.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const checkApiStatus = async () => {
    const binanceCredentials = localStorage.getItem("binance_credentials");
    const okxCredentials = localStorage.getItem("okx_credentials");
    const hyperliquidCredentials = localStorage.getItem("hyperliquid_credentials");

    const newStatus = {
      binance: binanceCredentials ? 'configured' : 'missing',
      okx: okxCredentials ? 'configured' : 'missing',
      hyperliquid: hyperliquidCredentials ? 'configured' : 'missing'
    };

    // Testar conexões se credenciais estão configuradas
    if (binanceCredentials) {
      try {
        const credentials = JSON.parse(binanceCredentials);
        if (credentials.apiKey && !credentials.apiKey.includes('demo')) {
          const { data } = await supabase.functions.invoke('test-binance-connection', {
            body: {
              apiKey: credentials.apiKey,
              secretKey: credentials.secretKey
            }
          });
          newStatus.binance = data?.success ? 'connected' : 'error';
        }
      } catch (e) {
        newStatus.binance = 'error';
      }
    }

    if (okxCredentials) {
      try {
        const credentials = JSON.parse(okxCredentials);
        if (credentials.apiKey && !credentials.apiKey.includes('demo')) {
          const { data } = await supabase.functions.invoke('okx-api', {
            body: {
              action: 'get_prices',
              api_key: credentials.apiKey,
              secret_key: credentials.secretKey,
              passphrase: credentials.passphrase
            }
          });
          newStatus.okx = data?.success ? 'connected' : 'error';
        }
      } catch (e) {
        newStatus.okx = 'error';
      }
    }

    setApiStatus(newStatus);
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('cross_exchange_configs')
        .upsert({
          ...config,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "✅ Configuração Salva",
        description: "Configuração de arbitragem automática salva com sucesso!",
      });

      // Se habilitado, iniciar automação
      if (config.is_enabled) {
        await triggerAutomation();
      }

    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const triggerAutomation = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('auto-cross-exchange-arbitrage');
      
      if (error) throw error;

      toast({
        title: config.is_enabled ? "🚀 Automação Iniciada" : "⏸️ Automação Pausada",
        description: config.is_enabled ? 
          "Sistema de arbitragem automática ativado" : 
          "Sistema de arbitragem automática pausado",
      });
    } catch (error) {
      console.error('Erro ao controlar automação:', error);
      toast({
        title: "Erro",
        description: "Erro ao controlar sistema de automação",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'configured': return <CheckCircle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado';
      case 'configured': return 'Configurado';
      case 'error': return 'Erro de conexão';
      default: return 'Não configurado';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Carregando configuração...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status das APIs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Status das Conexões API
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(apiStatus).map(([exchange, status]) => (
              <div key={exchange} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium capitalize">{exchange}</span>
                <div className="flex items-center gap-2">
                  {getStatusIcon(status)}
                  <span className="text-sm">{getStatusText(status)}</span>
                </div>
              </div>
            ))}
          </div>
          {Object.values(apiStatus).some(status => status === 'missing' || status === 'error') && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Configure as APIs necessárias na aba "Configuração de APIs" para habilitar operações reais.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuração Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Configuração de Arbitragem Automática
          </CardTitle>
          <CardDescription>
            Configure o sistema para executar arbitragem automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle Principal */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <Label className="text-base font-medium">Sistema de Automação</Label>
              <p className="text-sm text-muted-foreground">
                Ativar/desativar execução automática de arbitragem
              </p>
            </div>
            <Switch
              checked={config.is_enabled}
              onCheckedChange={(checked) => 
                setConfig(prev => ({ ...prev, is_enabled: checked }))
              }
            />
          </div>

          {/* Modo de Trading */}
          <div className="space-y-2">
            <Label>Modo de Trading</Label>
            <Select 
              value={config.trading_mode} 
              onValueChange={(value: 'real' | 'simulation') => 
                setConfig(prev => ({ ...prev, trading_mode: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="simulation">
                  🎯 Simulação (Recomendado para testes)
                </SelectItem>
                <SelectItem value="real">
                  💰 Real (Operações com dinheiro real)
                </SelectItem>
              </SelectContent>
            </Select>
            {config.trading_mode === 'real' && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ ATENÇÃO: Modo real executará operações com dinheiro real. 
                  Certifique-se de que suas APIs estão configuradas corretamente.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Parâmetros Financeiros */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Spread Mínimo (%)</Label>
              <div className="px-3">
                <Slider
                  value={[config.min_spread_percentage]}
                  onValueChange={([value]) => 
                    setConfig(prev => ({ ...prev, min_spread_percentage: value }))
                  }
                  max={2}
                  min={0.1}
                  step={0.1}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.1%</span>
                  <span>{config.min_spread_percentage}%</span>
                  <span>2.0%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Stop Loss (%)</Label>
              <div className="px-3">
                <Slider
                  value={[config.stop_loss_percentage]}
                  onValueChange={([value]) => 
                    setConfig(prev => ({ ...prev, stop_loss_percentage: value }))
                  }
                  max={5}
                  min={0.5}
                  step={0.1}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.5%</span>
                  <span>{config.stop_loss_percentage}%</span>
                  <span>5.0%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Investimento Máximo por Trade (USD)</Label>
              <Input
                type="number"
                value={config.max_investment_per_trade}
                onChange={(e) => 
                  setConfig(prev => ({ 
                    ...prev, 
                    max_investment_per_trade: Number(e.target.value) 
                  }))
                }
                min={10}
                max={10000}
              />
            </div>

            <div className="space-y-2">
              <Label>Limite Diário (USD)</Label>
              <Input
                type="number"
                value={config.daily_limit_usd}
                onChange={(e) => 
                  setConfig(prev => ({ 
                    ...prev, 
                    daily_limit_usd: Number(e.target.value) 
                  }))
                }
                min={100}
                max={100000}
              />
            </div>
          </div>

          {/* Configurações Avançadas */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Operações Simultâneas Máximas</Label>
              <Select 
                value={config.max_concurrent_operations.toString()} 
                onValueChange={(value) => 
                  setConfig(prev => ({ 
                    ...prev, 
                    max_concurrent_operations: Number(value) 
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 operação</SelectItem>
                  <SelectItem value="2">2 operações</SelectItem>
                  <SelectItem value="3">3 operações</SelectItem>
                  <SelectItem value="5">5 operações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Nível de Risco</Label>
              <Select 
                value={config.risk_level} 
                onValueChange={(value: 'conservative' | 'moderate' | 'aggressive') => 
                  setConfig(prev => ({ ...prev, risk_level: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">🛡️ Conservador</SelectItem>
                  <SelectItem value="moderate">⚖️ Moderado</SelectItem>
                  <SelectItem value="aggressive">🚀 Agressivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex gap-4">
            <Button 
              onClick={saveConfiguration}
              disabled={saving}
              className="flex-1"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Settings className="h-4 w-4 mr-2" />
                  Salvar Configuração
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={checkApiStatus}
              disabled={saving}
            >
              <Timer className="h-4 w-4 mr-2" />
              Verificar APIs
            </Button>
          </div>

          {/* Status de Execução */}
          {config.is_enabled && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                ✅ Sistema ativo! Executando em modo <strong>{config.trading_mode}</strong>
                <br />
                • Spread mínimo: {config.min_spread_percentage}%
                • Máximo por trade: ${config.max_investment_per_trade}
                • Limite diário: ${config.daily_limit_usd}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AutoArbitrageConfig;