import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Activity,
  Wallet,
  Settings,
  Play,
  Pause,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserId } from '@/lib/userUtils';

interface ValidationResult {
  component: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
}

interface OperationStats {
  total_operations: number;
  real_operations: number;
  test_operations: number;
  success_rate_real: number;
  success_rate_test: number;
  total_profit_real: number;
  total_profit_test: number;
}

export const TradingModeValidator: React.FC = () => {
  const { isRealMode, setIsRealMode, hasCredentials, recheckCredentials } = useTradingMode();
  const { toast } = useToast();
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [operationStats, setOperationStats] = useState<OperationStats | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [balanceValidation, setBalanceValidation] = useState<any>(null);
  
  const validateTradingMode = async () => {
    setIsValidating(true);
    const results: ValidationResult[] = [];
    
    try {
      // 1. Validar credenciais API
      const binanceCredentials = localStorage.getItem('binance_credentials');
      const okxCredentials = localStorage.getItem('okx_credentials');
      
      if (isRealMode) {
        if (!binanceCredentials && !okxCredentials) {
          results.push({
            component: 'API Credentials',
            status: 'error',
            message: 'Modo real ativo mas sem credenciais API configuradas',
            details: { required: ['Binance', 'OKX'], configured: [] }
          });
        } else {
          const configuredAPIs = [];
          if (binanceCredentials) configuredAPIs.push('Binance');
          if (okxCredentials) configuredAPIs.push('OKX');
          
          results.push({
            component: 'API Credentials',
            status: 'success',
            message: `Credenciais configuradas: ${configuredAPIs.join(', ')}`,
            details: { configured: configuredAPIs }
          });
        }
      } else {
        results.push({
          component: 'API Credentials',
          status: 'warning',
          message: 'Modo teste ativo - Credenciais não obrigatórias',
          details: { mode: 'test' }
        });
      }
      
      // 2. Validar conexões das APIs
      if (isRealMode && hasCredentials) {
        try {
          // Obter credenciais para teste de conexão
          const binanceCreds = binanceCredentials ? JSON.parse(binanceCredentials) : null;
          
          const { data: testConnection } = await supabase.functions.invoke('test-binance-connection', {
            body: { 
              apiKey: binanceCreds?.apiKey,
              secretKey: binanceCreds?.secretKey
            }
          });
          
          if (testConnection?.success) {
            results.push({
              component: 'API Connectivity',
              status: 'success',
              message: 'Conexão com APIs estabelecida',
              details: testConnection
            });
          } else {
            results.push({
              component: 'API Connectivity',
              status: 'error',
              message: 'Falha na conexão com APIs',
              details: testConnection
            });
          }
        } catch (error) {
          results.push({
            component: 'API Connectivity',
            status: 'error',
            message: 'Erro ao testar conexão',
            details: { error: error.message }
          });
        }
      }
      
      // 3. Validar configurações ativas
      try {
        const { data: fundingConfigs } = await supabase
          .from('auto_funding_configs')
          .select('*')
          .eq('is_enabled', true);
          
        const { data: crossExchangeConfigs } = await supabase
          .from('auto_cross_exchange_configs')
          .select('*')
          .eq('is_enabled', true);
          
        const totalActiveConfigs = (fundingConfigs?.length || 0) + (crossExchangeConfigs?.length || 0);
        
        if (totalActiveConfigs > 0) {
          results.push({
            component: 'Automation Configs',
            status: 'success',
            message: `${totalActiveConfigs} configurações ativas`,
            details: { funding: fundingConfigs?.length, cross_exchange: crossExchangeConfigs?.length }
          });
        } else {
          results.push({
            component: 'Automation Configs',
            status: 'warning',
            message: 'Nenhuma automação configurada',
            details: { funding: 0, cross_exchange: 0 }
          });
        }
      } catch (error) {
        results.push({
          component: 'Automation Configs',
          status: 'error',
          message: 'Erro ao verificar configurações',
          details: { error: error.message }
        });
      }
      
      // 4. Validar saldos (se modo real)
      if (isRealMode) {
        try {
          // Simular verificação de saldo
          const testAmount = 10; // $10 para teste
          const userId = await getUserId();
          const { data: balanceCheck } = await supabase.rpc('check_and_lock_balance_for_arbitrage', {
            p_user_id: userId,
            p_symbol: 'BTC',
            p_amount: testAmount / 50000, // Pequena quantidade
            p_buy_exchange: 'Binance',
            p_sell_exchange: 'OKX',
            p_current_price: 50000
          });
          
          setBalanceValidation(balanceCheck);
          
          const hasSuccess = (balanceCheck as any)?.success === true;
          if (hasSuccess) {
            results.push({
              component: 'Balance Validation',
              status: 'success',
              message: 'Saldos suficientes para operações',
              details: balanceCheck
            });
          } else {
            results.push({
              component: 'Balance Validation',
              status: 'warning',
              message: 'Saldos insuficientes detectados',
              details: balanceCheck
            });
          }
        } catch (error) {
          results.push({
            component: 'Balance Validation',
            status: 'error',
            message: 'Erro ao verificar saldos',
            details: { error: error.message }
          });
        }
      }
      
      setValidationResults(results);
      
    } catch (error) {
      toast({
        title: 'Erro na Validação',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  const loadOperationStats = async () => {
    try {
      const { data: trades, error } = await supabase
        .from('arbitrage_trades')
        .select('trading_mode, status, net_profit')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Últimos 7 dias
      
      if (error) throw error;
      
      const realTrades = trades?.filter(t => t.trading_mode === 'real') || [];
      const testTrades = trades?.filter(t => t.trading_mode === 'test' || t.trading_mode === 'simulation') || [];
      
      const stats: OperationStats = {
        total_operations: trades?.length || 0,
        real_operations: realTrades.length,
        test_operations: testTrades.length,
        success_rate_real: realTrades.length > 0 ? 
          (realTrades.filter(t => t.status === 'completed').length / realTrades.length) * 100 : 0,
        success_rate_test: testTrades.length > 0 ? 
          (testTrades.filter(t => t.status === 'completed').length / testTrades.length) * 100 : 0,
        total_profit_real: realTrades
          .filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + (t.net_profit || 0), 0),
        total_profit_test: testTrades
          .filter(t => t.status === 'completed')
          .reduce((sum, t) => sum + (t.net_profit || 0), 0)
      };
      
      setOperationStats(stats);
      
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };
  
  const executeTestOperation = async () => {
    try {
      setIsValidating(true);
      
      // Get credentials from localStorage
      const binanceCredentials = localStorage.getItem('binance_credentials');
      const binanceCreds = binanceCredentials ? JSON.parse(binanceCredentials) : null;
      
      // Usar nova função de validação
      const { data: validationResult, error } = await supabase.functions.invoke('validate-trading-system', {
        body: {
          user_id: await getUserId(),
          validation_type: 'full',
          trading_mode: isRealMode ? 'real' : 'test',
          binance_api_key: binanceCreds?.apiKey,
          binance_secret_key: binanceCreds?.secretKey
        }
      });
      
      if (error) throw error;
      
      toast({
        title: 'Validação Completa',
        description: `Sistema validado: ${validationResult.successful_tests}/${validationResult.total_tests} testes aprovados (${validationResult.overall_score.toFixed(1)}%)`,
        variant: validationResult.overall_score >= 80 ? 'default' : 'destructive'
      });
      
      // Atualizar resultados da validação
      setValidationResults(validationResult.results || []);
      
      // Recarregar estatísticas
      await loadOperationStats();
      
    } catch (error) {
      toast({
        title: 'Erro no Teste',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsValidating(false);
    }
  };
  
  useEffect(() => {
    validateTradingMode();
    loadOperationStats();
  }, [isRealMode, hasCredentials]);
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-green-600';
      case 'warning': return 'text-yellow-600';
      case 'error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'error': return <XCircle className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header de Controle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Validação do Sistema de Trading
              </CardTitle>
              <CardDescription>
                Monitoramento e validação dos modos de operação "Teste" vs "Real Ativo"
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Badge 
                variant={isRealMode ? "destructive" : "secondary"}
                className="text-sm font-medium"
              >
                {isRealMode ? "🔴 REAL ATIVO" : "🟡 MODO TESTE"}
              </Badge>
              <div className="flex items-center gap-2">
                <span className="text-sm">Teste</span>
                <Switch 
                  checked={isRealMode} 
                  onCheckedChange={setIsRealMode}
                />
                <span className="text-sm">Real</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button 
              onClick={validateTradingMode} 
              disabled={isValidating}
              variant="outline"
            >
              {isValidating ? <Activity className="h-4 w-4 animate-spin mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
              Validar Sistema
            </Button>
            <Button 
              onClick={executeTestOperation} 
              disabled={isValidating}
              variant="outline"
            >
              {isValidating ? <Activity className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Executar Teste
            </Button>
            <Button 
              onClick={recheckCredentials} 
              variant="outline"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Verificar Credenciais
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="validation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="validation">Validação do Sistema</TabsTrigger>
          <TabsTrigger value="stats">Estatísticas de Operação</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoramento em Tempo Real</TabsTrigger>
        </TabsList>

        <TabsContent value="validation">
          <Card>
            <CardHeader>
              <CardTitle>Resultados da Validação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className={getStatusColor(result.status)}>
                    {getStatusIcon(result.status)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium">{result.component}</h4>
                    <p className="text-sm text-muted-foreground">{result.message}</p>
                    {result.details && (
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
              
              {validationResults.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Execute a validação para ver os resultados</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-muted-foreground">Total de Operações</span>
                </div>
                <p className="text-2xl font-bold">{operationStats?.total_operations || 0}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Operações Reais</span>
                </div>
                <p className="text-2xl font-bold">{operationStats?.real_operations || 0}</p>
                <Progress 
                  value={operationStats?.success_rate_real || 0} 
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {operationStats?.success_rate_real?.toFixed(1) || 0}% taxa de sucesso
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-muted-foreground">Operações Teste</span>
                </div>
                <p className="text-2xl font-bold">{operationStats?.test_operations || 0}</p>
                <Progress 
                  value={operationStats?.success_rate_test || 0} 
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {operationStats?.success_rate_test?.toFixed(1) || 0}% taxa de sucesso
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-muted-foreground">Lucro Real</span>
                </div>
                <p className="text-2xl font-bold">
                  ${operationStats?.total_profit_real?.toFixed(2) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Simulado: ${operationStats?.total_profit_test?.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Alerta de Modo Ativo */}
          <Alert className={isRealMode ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{isRealMode ? 'MODO REAL ATIVO:' : 'MODO TESTE ATIVO:'}</strong>{' '}
              {isRealMode 
                ? 'As operações estão executando transações financeiras reais. Certifique-se de que tem saldos suficientes e credenciais válidas.'
                : 'As operações estão sendo simuladas. Nenhuma transação financeira real será executada.'
              }
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="monitoring">
          <Card>
            <CardHeader>
              <CardTitle>Monitoramento em Tempo Real</CardTitle>
              <CardDescription>
                Status das operações e configurações ativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-2">Status das APIs</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Binance</span>
                        <Badge variant={hasCredentials ? "default" : "secondary"}>
                          {hasCredentials ? "Conectado" : "Desconectado"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>OKX</span>
                        <Badge variant={localStorage.getItem('okx_credentials') ? "default" : "secondary"}>
                          {localStorage.getItem('okx_credentials') ? "Conectado" : "Desconectado"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-lg border">
                    <h4 className="font-medium mb-2">Automações Ativas</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Funding Arbitrage</span>
                        <Badge variant="outline">
                          {isRealMode ? "Real" : "Teste"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Cross-Exchange</span>
                        <Badge variant="outline">
                          {isRealMode ? "Real" : "Teste"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
                
                {balanceValidation && (
                  <div className="p-4 rounded-lg border bg-muted/50">
                    <h4 className="font-medium mb-2">Última Verificação de Saldo</h4>
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(balanceValidation, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};