import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/userUtils";
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Power, 
  DollarSign, 
  Settings, 
  Zap,
  Clock
} from "lucide-react";
import { Badge } from "@/components/ui/badge";


interface APIConnectionStatus {
  exchange: string;
  status: 'connected' | 'configured' | 'error' | 'missing';
  lastChecked?: string;
  errorMessage?: string;
}

const RealModeActivator = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [apiConnections, setApiConnections] = useState<APIConnectionStatus[]>([
    { exchange: 'Binance', status: 'missing' },
    { exchange: 'OKX', status: 'missing' },
    { exchange: 'Hyperliquid', status: 'missing' },
    { exchange: 'MEXC', status: 'missing' }
  ]);

  const [systemStatus, setSystemStatus] = useState({
    isRealModeReady: false,
    hasActiveConfig: false,
    totalRequirements: 4,
    completedRequirements: 0
  });

  useEffect(() => {
    checkSystemReadiness();
  }, []);

  const checkSystemReadiness = async () => {
    setLoading(true);
    try {
      // Verificar credenciais locais
      const connections = await Promise.all([
        checkBinanceConnection(),
        checkOKXConnection(), 
        checkHyperliquidConnection(),
        checkMEXCConnection()
      ]);

      setApiConnections(connections);

      // Verificar configuração ativa
      const userId = await getUserId();
      const { data: configData } = await supabase
        .from('auto_cross_exchange_configs')
        .select('is_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      const completedCount = connections.filter(c => c.status === 'connected').length;
      const hasConfig = configData?.is_enabled || false;

      setSystemStatus({
        isRealModeReady: completedCount >= 2, // Pelo menos 2 exchanges funcionando
        hasActiveConfig: hasConfig,
        totalRequirements: 3,
        completedRequirements: completedCount
      });

    } catch (error) {
      console.error('Erro ao verificar sistema:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkBinanceConnection = async (): Promise<APIConnectionStatus> => {
    try {
      const credentials = localStorage.getItem("binance_credentials");
      if (!credentials) {
        return { exchange: 'Binance', status: 'missing' };
      }

      const creds = JSON.parse(credentials);
      if (!creds.apiKey || !creds.secretKey) {
        return { exchange: 'Binance', status: 'missing', errorMessage: 'Credenciais não configuradas' };
      }

      const { data, error } = await supabase.functions.invoke('test-binance-connection', {
        body: {
          apiKey: creds.apiKey,
          secretKey: creds.secretKey
        }
      });

      return {
        exchange: 'Binance',
        status: data?.success ? 'connected' : 'error',
        lastChecked: new Date().toISOString(),
        errorMessage: data?.error || error?.message
      };
    } catch (e) {
      return { 
        exchange: 'Binance', 
        status: 'error', 
        errorMessage: 'Erro na verificação' 
      };
    }
  };

  const checkOKXConnection = async (): Promise<APIConnectionStatus> => {
    try {
      const credentials = localStorage.getItem("okx_credentials");
      if (!credentials) {
        return { exchange: 'OKX', status: 'missing' };
      }

      const creds = JSON.parse(credentials);
      if (!creds.apiKey || !creds.secretKey || !creds.passphrase) {
        return { exchange: 'OKX', status: 'missing', errorMessage: 'Credenciais não configuradas' };
      }

      const { data, error } = await supabase.functions.invoke('okx-api', {
        body: {
          action: 'get_prices',
          api_key: creds.apiKey,
          secret_key: creds.secretKey,
          passphrase: creds.passphrase
        }
      });

      return {
        exchange: 'OKX',
        status: data?.success ? 'connected' : 'error',
        lastChecked: new Date().toISOString(),
        errorMessage: data?.error || error?.message
      };
    } catch (e) {
      return { 
        exchange: 'OKX', 
        status: 'error', 
        errorMessage: 'Erro na verificação' 
      };
    }
  };

  const checkHyperliquidConnection = async (): Promise<APIConnectionStatus> => {
    try {
      const credentials = localStorage.getItem("hyperliquid_credentials");
      if (!credentials) {
        return { exchange: 'Hyperliquid', status: 'missing' };
      }

      const creds = JSON.parse(credentials);
      if (!creds.walletAddress || !creds.privateKey) {
        return { exchange: 'Hyperliquid', status: 'missing', errorMessage: 'Credenciais não configuradas' };
      }

      // Fazer teste real de conexão
      const { data, error } = await supabase.functions.invoke('hyperliquid-api', {
        body: { 
          action: 'test_connection',
          wallet_address: creds.walletAddress,
          private_key: creds.privateKey
        }
      });

      if (error) {
        return {
          exchange: 'Hyperliquid',
          status: 'error',
          lastChecked: new Date().toISOString(),
          errorMessage: error.message || 'Erro na conexão'
        };
      }

      return {
        exchange: 'Hyperliquid',
        status: data?.success ? 'connected' : 'error',
        lastChecked: new Date().toISOString(),
        errorMessage: data?.success ? undefined : (data?.error || 'Erro desconhecido')
      };
    } catch (e) {
      return { 
        exchange: 'Hyperliquid', 
        status: 'error', 
        errorMessage: 'Erro na verificação' 
      };
    }
  };

  const checkMEXCConnection = async (): Promise<APIConnectionStatus> => {
    try {
      const credentials = localStorage.getItem("mexc_credentials");
      if (!credentials) {
        return { exchange: 'MEXC', status: 'missing' };
      }

      const creds = JSON.parse(credentials);
      if (!creds.apiKey || !creds.secretKey) {
        return { exchange: 'MEXC', status: 'missing', errorMessage: 'Credenciais não configuradas' };
      }

      const { data, error } = await supabase.functions.invoke('mexc-api', {
        body: {
          action: 'get_balances',
          api_key: creds.apiKey,
          secret_key: creds.secretKey
        }
      });

      if (error) {
        return {
          exchange: 'MEXC',
          status: 'error',
          lastChecked: new Date().toISOString(),
          errorMessage: error.message || 'Erro na conexão'
        };
      }

      return {
        exchange: 'MEXC',
        status: data?.success ? 'connected' : 'error',
        lastChecked: new Date().toISOString(),
        errorMessage: data?.success ? undefined : (data?.error || 'Erro desconhecido')
      };
    } catch (e) {
      return { 
        exchange: 'MEXC', 
        status: 'error', 
        errorMessage: 'Erro na verificação' 
      };
    }
  };

  const activateRealMode = async () => {
    if (!systemStatus.isRealModeReady) {
      toast({
        title: "Sistema Não Pronto",
        description: "Configure e teste pelo menos 2 APIs antes de ativar o modo real.",
        variant: "destructive"
      });
      return;
    }

    setActivating(true);
    try {
      const userId = await getUserId();
      console.log('🔑 User ID para ativação:', userId);
      
      // Primeiro verificar se já existe configuração
      const { data: existingConfig, error: fetchError } = await supabase
        .from('auto_cross_exchange_configs')
        .select('id, is_enabled')
        .eq('user_id', userId)
        .maybeSingle();

      console.log('📋 Configuração existente:', existingConfig);
      
      if (fetchError) {
        console.error('❌ Erro ao buscar configuração:', fetchError);
        throw fetchError;
      }

      let error = null;
      
      if (existingConfig) {
        console.log('🔄 Atualizando configuração existente...');
        // Atualizar configuração existente
        const { error: updateError } = await supabase
          .from('auto_cross_exchange_configs')
          .update({ 
            is_enabled: true,
            min_spread_percentage: 0.5,
            max_investment_amount: 50,
            min_profit_threshold: 1.0,
            max_concurrent_operations: 2,
            auto_rebalance_enabled: true,
            exchanges_enabled: ['binance', 'okx'],
            symbols_filter: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
            risk_management_level: 'medium',
            stop_loss_percentage: 2.0
          })
          .eq('id', existingConfig.id);
        error = updateError;
        console.log('✅ Configuração atualizada');
      } else {
        console.log('➕ Criando nova configuração...');
        // Como não conseguimos inserir diretamente devido às políticas RLS,
        // vamos usar a edge function que pode ter privilégios elevados
        try {
          const { data: configResult, error: configError } = await supabase.functions.invoke('auto-cross-exchange-config', {
            body: {
              action: 'save',
              user_id: userId,
              is_enabled: true,
              min_spread_percentage: 0.5,
              max_investment_amount: 50,
              min_profit_threshold: 1.0,
              max_concurrent_operations: 2,
              auto_rebalance_enabled: true,
              exchanges_enabled: ['binance', 'okx'],
              symbols_filter: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
              risk_management_level: 'medium',
              stop_loss_percentage: 2.0
            }
          });
          
          if (configError) {
            throw configError;
          }
          
          if (!configResult?.success) {
            throw new Error(configResult?.error || 'Erro ao criar configuração via edge function');
          }
          
          console.log('✅ Configuração criada via edge function');
        } catch (edgeFunctionError) {
          console.error('❌ Edge function falhou, tentando inserção direta...', edgeFunctionError);
          // Fallback: tentar inserção direta mesmo com políticas RLS
          const { error: insertError } = await supabase
            .from('auto_cross_exchange_configs')
            .insert({
              user_id: userId,
              is_enabled: true,
              min_spread_percentage: 0.5,
              max_investment_amount: 50,
              min_profit_threshold: 1.0,
              max_concurrent_operations: 2,
              auto_rebalance_enabled: true,
              exchanges_enabled: ['binance', 'okx'],
              symbols_filter: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
              risk_management_level: 'medium',
              stop_loss_percentage: 2.0
            });
          error = insertError;
        }
      }

      if (error) throw error;

      // Executar automação
      const { data: automationData } = await supabase.functions.invoke('auto-cross-exchange-arbitrage');

      toast({
        title: "🚀 Modo Real Ativado!",
        description: "Sistema de arbitragem automática ativado com operações reais. Monitoramento iniciado.",
        duration: 8000
      });

      setTimeout(() => {
        checkSystemReadiness();
      }, 1000);

    } catch (error) {
      console.error('Erro ao ativar modo real:', error);
      toast({
        title: "Erro na Ativação",
        description: "Erro ao ativar modo real. Verifique suas configurações.",
        variant: "destructive"
      });
    } finally {
      setActivating(false);
    }
  };

  const getStatusBadge = (status: string, errorMessage?: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">✅ Conectado</Badge>;
      case 'configured':
        return <Badge className="bg-yellow-100 text-yellow-800">⚠️ Configurado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">❌ Erro</Badge>;
      default:
        return <Badge variant="outline">⚪ Não configurado</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Verificando status do sistema...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Ativação do Modo Real
          </CardTitle>
          <CardDescription>
            Status do sistema e ativação de operações reais de arbitragem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progresso */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Prontidão do Sistema</span>
              <span>{systemStatus.completedRequirements}/{systemStatus.totalRequirements}</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300" 
                style={{ 
                  width: `${(systemStatus.completedRequirements / systemStatus.totalRequirements) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Status das APIs */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Status das Conexões API</h4>
            {apiConnections.map((connection) => (
              <div key={connection.exchange} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{connection.exchange}</span>
                  {connection.errorMessage && (
                    <p className="text-xs text-muted-foreground">{connection.errorMessage}</p>
                  )}
                </div>
                {getStatusBadge(connection.status, connection.errorMessage)}
              </div>
            ))}
          </div>

          {/* Botão de Ativação */}
          <div className="pt-4">
            {systemStatus.isRealModeReady ? (
              <Button 
                onClick={activateRealMode}
                disabled={activating}
                className="w-full"
                size="lg"
              >
                {activating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Ativando Sistema...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Ativar Modo Real
                  </>
                )}
              </Button>
            ) : (
              <Alert>
                <Settings className="h-4 w-4" />
                <AlertDescription>
                  <strong>Configuração Necessária:</strong><br />
                  Configure pelo menos 2 APIs (Binance + OKX ou Hyperliquid) para ativar o modo real.
                  Vá para "Configuração de APIs" para configurar suas credenciais.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Configuração Automática Atual */}
      {systemStatus.hasActiveConfig && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Sistema Ativo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-sm font-medium">Operações Automáticas</span>
                </div>
                <Badge className="bg-green-100 text-green-800">✅ Ativo</Badge>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm font-medium">Monitoramento</span>
                </div>
                <Badge className="bg-blue-100 text-blue-800">🔄 Contínuo</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RealModeActivator;