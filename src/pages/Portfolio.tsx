import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Wallet, RefreshCw, Settings, Shield, AlertTriangle, Plus, AlertCircle } from 'lucide-react';
import APIConfiguration from '@/components/APIConfiguration';
import { BinanceAutoConverter } from '@/components/BinanceAutoConverter';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { getUserId } from '@/lib/userUtils';

interface PortfolioAsset {
  symbol: string;
  balance: number;
  locked_balance: number;
  updated_at: string;
  exchange?: string;
  value_usd?: number;
  investment_type?: string;
  application_title?: string;
  price_usd?: number;
}

interface ArbitrageTrade {
  id: string;
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  investment_amount: number;
  net_profit: number;
  roi_percentage: number;
  spread_percentage: number;
  status: string;
  executed_at: string;
  created_at: string;
  risk_level: string;
  trading_mode?: string;
  error_message?: string;
}

interface PortfolioStats {
  total_value_usd: number;
  total_trades: number;
  successful_trades: number;
  total_profit_usd: number;
  success_rate_percent: number;
}

export default function Portfolio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isRealMode, setIsRealMode, hasCredentials, setHasCredentials } = useTradingMode();
  
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [trades, setTrades] = useState<ArbitrageTrade[]>([]);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAPIConfig, setShowAPIConfig] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [dataSource, setDataSource] = useState('');
  const [exchangeStatuses, setExchangeStatuses] = useState({ 
    binance: false, 
    okx: false, 
    bybit: false,
    mexc: false,
    hyperliquid: false,
    pionex: false
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(3)}%`;
  };

  const loadPortfolioData = async () => {
    try {
      setIsLoading(true);
      
      let requestBody = {};
      
      // Se modo real estiver ativo, incluir credenciais
      if (isRealMode) {
        const binanceCredentials = localStorage.getItem('binance_credentials');
        const hyperliquidCredentials = localStorage.getItem('hyperliquid_credentials');
        const okxCredentials = localStorage.getItem('okx_credentials');
        const bybitCredentials = localStorage.getItem('bybit_credentials');
        
        if (binanceCredentials) {
          const binanceCreds = JSON.parse(binanceCredentials);
          requestBody = { 
            ...requestBody, 
            binance_api_key: binanceCreds.apiKey,
            binance_secret_key: binanceCreds.secretKey
          };
        }
        
        if (hyperliquidCredentials) {
          const hyperliquidCreds = JSON.parse(hyperliquidCredentials);
          requestBody = { 
            ...requestBody, 
            hyperliquid_wallet_name: hyperliquidCreds.walletName,
            hyperliquid_wallet_address: hyperliquidCreds.walletAddress,
            hyperliquid_private_key: hyperliquidCreds.privateKey
          };
        }

        if (okxCredentials) {
          const okxCreds = JSON.parse(okxCredentials);
          requestBody = {
            ...requestBody,
            okx_api_key: okxCreds.apiKey,
            okx_secret_key: okxCreds.secretKey,
            okx_passphrase: okxCreds.passphrase
          };
        }

        // Bybit desativado: não enviar credenciais para evitar chamadas indevidas
        // (Se necessário no futuro, reativar este bloco com uma configuração explícita)
        // if (bybitCredentials) {
        //   const bybitCreds = JSON.parse(bybitCredentials);
        //   requestBody = {
        //     ...requestBody,
        //     bybit_api_key: bybitCreds.apiKey,
        //     bybit_secret_key: bybitCreds.secretKey
        //   };
        // }
      }

      const userId = await getUserId();

      const { data: response, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          ...requestBody, 
          real_mode: isRealMode,
          user_id: userId
        }
      });

      if (error) {
        throw new Error(error.message || 'Failed to load portfolio');
      }
      
      if (response.success) {
        setPortfolio(response.data.portfolio || []);
        setTrades(response.data.recent_trades || []);
        setStats(response.data.statistics || null);
        setDataSource(response.data.data_source || 'unknown');
        
        // Check which exchanges have data
        const hasExchangeData = (exchange: string) => {
          return (response.data.portfolio || []).some((asset: PortfolioAsset) => 
            asset.exchange?.toLowerCase() === exchange.toLowerCase() && asset.balance > 0
          );
        };
        
        setExchangeStatuses({
          binance: hasExchangeData('binance'),
          okx: hasExchangeData('okx'),
          bybit: hasExchangeData('bybit'),
          mexc: hasExchangeData('mexc'),
          hyperliquid: hasExchangeData('hyperliquid'),
          pionex: hasExchangeData('pionex')
        });
        
        // Mostrar toast baseado na fonte dos dados
        if (isRealMode) {
          const source = response.data.data_source;
          
          if (source === 'real-api') {
            toast({
              title: "✅ Modo Real Ativo",
              description: "Dados obtidos diretamente das APIs das exchanges",
            });
          } else if (source === 'invalid-credentials') {
            toast({
              title: "🚨 Credenciais Inválidas",
              description: "Verifique suas API Keys das exchanges",
              variant: "destructive"
            });
          } else if (source === 'geo-blocked') {
            toast({
              title: "🌍 Restrição Geográfica",
              description: "Servidor bloqueado geograficamente pela exchange",
              variant: "destructive"
            });
          } else if (source === 'no-data' || source === 'api-error') {
            toast({
              title: "❌ Sem Dados Reais",
              description: "Não foi possível obter saldos reais das exchanges",
              variant: "destructive"
            });
          }
        } else {
          toast({
            title: "📊 Modo Simulação",
            description: "Usando dados simulados para demonstração",
          });
        }
      } else {
        // Se response.success for false, mostrar erro
        const errorInfo = response.data?.error_info || response.error || 'Erro desconhecido';
        toast({
          title: "❌ Erro ao Carregar Portfolio",
          description: errorInfo,
          variant: "destructive"
        });
        
        // Limpar dados se houver erro
        setPortfolio([]);
        setTrades([]);
        setStats(null);
        setDataSource('error');
      }
    } catch (error) {
      console.error('Erro ao carregar portfolio:', error);
      toast({
        title: "Erro",
        description: isRealMode ? "Falha ao carregar dados reais. Verifique suas credenciais." : "Falha ao carregar dados do portfolio",
        variant: "destructive"
      });
      setPortfolio([]);
      setTrades([]);
      setStats(null);
      setDataSource('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeToggle = (enabled: boolean) => {
    if (enabled && !hasCredentials) {
      toast({
        title: "Credenciais Necessárias",
        description: "Configure suas credenciais de API primeiro para usar o modo real",
        variant: "destructive"
      });
      setShowAPIConfig(true);
      return;
    }
    
    setIsRealMode(enabled);
  };

  const handleDeposit = async () => {
    try {
      const amount = parseFloat(depositAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Valor inválido",
          description: "Por favor, insira um valor válido maior que zero",
          variant: "destructive"
        });
        return;
      }

      const userId = await getUserId();

      // Adicionar USDT ao portfolio
      const { error } = await supabase.functions.invoke('update-portfolio-balance', {
        body: {
          user_id: userId,
          symbol: 'USDT',
          amount_change: amount
        }
      });

      if (error) {
        throw new Error(error.message || 'Falha ao depositar');
      }

      toast({
        title: "Depósito realizado",
        description: `${formatCurrency(amount)} foram adicionados ao seu portfolio`,
      });

      setShowDepositModal(false);
      setDepositAmount('');
      loadPortfolioData();
    } catch (error) {
      console.error('Erro no depósito:', error);
      toast({
        title: "Erro no depósito",
        description: "Não foi possível adicionar os fundos. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Garante carregar credenciais dos Supabase Secrets quando localStorage estiver vazio
  const ensureCredentialsLoaded = async () => {
    try {
      const hasBinance = !!localStorage.getItem('binance_credentials');
      const hasOKX = !!localStorage.getItem('okx_credentials');
      if (hasBinance || hasOKX) return;

      const [binanceResp, okxResp] = await Promise.all([
        supabase.functions.invoke('get-binance-credentials'),
        supabase.functions.invoke('get-okx-credentials'),
      ]);

      if (binanceResp.data?.success && binanceResp.data.credentials) {
        localStorage.setItem('binance_credentials', JSON.stringify(binanceResp.data.credentials));
      }
      if (okxResp.data?.success && okxResp.data.credentials) {
        localStorage.setItem('okx_credentials', JSON.stringify(okxResp.data.credentials));
      }

      setHasCredentials(
        !!localStorage.getItem('binance_credentials') || !!localStorage.getItem('okx_credentials')
      );
    } catch (e) {
      console.warn('ensureCredentialsLoaded: falha ao carregar secrets', e);
    }
  };

  useEffect(() => {
    (async () => {
      await ensureCredentialsLoaded();
      await loadPortfolioData();
    })();
  }, [isRealMode]);

  useEffect(() => {
    // Listener para recarregar portfolio quando trade for executado
    const handlePortfolioUpdate = () => {
      loadPortfolioData();
    };
    
    window.addEventListener('portfolioUpdate', handlePortfolioUpdate);
    
    return () => {
      window.removeEventListener('portfolioUpdate', handlePortfolioUpdate);
    };
  }, []);

  // Determinar se devemos mostrar dados ou uma mensagem de erro/vazio
  const shouldShowEmptyState = isRealMode && (!portfolio || portfolio.length === 0 || dataSource.includes('error') || dataSource.includes('invalid') || dataSource.includes('blocked'));
  const hasRealData = isRealMode && portfolio && portfolio.length > 0 && !dataSource.includes('error');

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando portfolio...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showAPIConfig) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" onClick={() => setShowAPIConfig(false)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao Portfolio
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Configuração de APIs</h1>
            <p className="text-muted-foreground">Configure suas credenciais para acessar dados reais</p>
          </div>
        </div>
        <APIConfiguration />
        <div className="flex justify-center">
          <Button onClick={() => {
            setShowAPIConfig(false);
          }}>
            Finalizar Configuração
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-8 w-8 text-primary" />
            Meu Portfolio
          </h1>
          <p className="text-muted-foreground">Acompanhe seus saldos e histórico de operações</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowAPIConfig(true)}>
            <Settings className="h-4 w-4 mr-2" />
            APIs
          </Button>
          <Button variant="outline" onClick={loadPortfolioData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Controle de Modo Real/Simulação */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {isRealMode ? (
                  <Shield className="h-5 w-5 text-success" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning" />
                )}
                <Label htmlFor="real-mode" className="font-medium">
                  {isRealMode ? "Modo Real Ativo" : "Modo Simulação"}
                </Label>
              </div>
              <Switch
                id="real-mode"
                checked={isRealMode}
                onCheckedChange={handleModeToggle}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {isRealMode ? (
                hasCredentials ? (
                  "Dados obtidos das APIs reais das exchanges"
                ) : (
                  "Configure suas credenciais para usar o modo real"
                )
              ) : (
                <div className="flex flex-col items-end">
                  <span>Usando dados simulados para demonstração</span>
                  <span className="text-xs text-orange-600 mt-1">
                    ⚠️ Operações de teste não afetam sua carteira real
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversor e Saldos por Exchange */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isRealMode && exchangeStatuses.binance && (
          <BinanceAutoConverter />
        )}
        
        {/* Cards de Saldos por Exchange */}
        {Object.entries(exchangeStatuses)
          .filter(([_, hasData]) => hasData)
          .map(([exchange]) => {
            const exchangeAssets = portfolio.filter(
              asset => asset.exchange?.toLowerCase() === exchange.toLowerCase() && asset.balance > 0
            );
            const totalValue = exchangeAssets.reduce((sum, asset) => sum + (asset.value_usd || 0), 0);
            
            return (
              <Card key={exchange}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="capitalize">{exchange}</span>
                    <Badge variant="outline">{exchangeAssets.length} ativos</Badge>
                  </CardTitle>
                  <CardDescription>
                    Valor Total: {formatCurrency(totalValue)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {exchangeAssets.map((asset, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{asset.symbol}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.balance.toFixed(8)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-sm">
                            {formatCurrency(asset.value_usd || 0)}
                          </p>
                          {asset.price_usd && (
                            <p className="text-xs text-muted-foreground">
                              @{formatCurrency(asset.price_usd)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })
        }
      </div>

      {/* Mostrar estado vazio se não há dados reais em modo real */}
      {shouldShowEmptyState ? (
        <div className="text-center py-12">
          <Card>
            <CardContent className="p-12">
              <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
              <h2 className="text-2xl font-semibold text-foreground mb-4">
                Nenhum Saldo Real Encontrado
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Para ver seus saldos reais das exchanges, verifique se:
              </p>
              <div className="text-left max-w-md mx-auto mb-6 space-y-2">
                <p className="text-sm text-muted-foreground">• Suas credenciais de API estão corretas</p>
                <p className="text-sm text-muted-foreground">• As APIs têm permissões de leitura</p>
                <p className="text-sm text-muted-foreground">• Os IPs estão na whitelist (se configurado)</p>
                <p className="text-sm text-muted-foreground">• Você possui saldos nas exchanges conectadas</p>
              </div>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => setShowAPIConfig(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurar APIs
                </Button>
                <Button variant="outline" onClick={loadPortfolioData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                Status: {dataSource}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Estatísticas - mostrar apenas se há dados */}
          {stats && (hasRealData || !isRealMode) && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Valor Total</p>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(stats.total_value_usd)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Total de Trades</p>
                    <p className="text-2xl font-bold">{stats.total_trades}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                    <p className="text-2xl font-bold text-success">{stats.success_rate_percent.toFixed(1)}%</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Lucro Total</p>
                    <p className={`text-2xl font-bold ${stats.total_profit_usd > 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(stats.total_profit_usd)}
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Sucesso</p>
                    <p className="text-2xl font-bold text-success">{stats.successful_trades}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Histórico de Trades - mostrar apenas se há dados reais ou modo simulação */}
          {(hasRealData || !isRealMode) && (
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Trades</CardTitle>
                <CardDescription>Suas operações de arbitragem mais recentes</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Símbolo</TableHead>
                      <TableHead>Compra</TableHead>
                      <TableHead>Venda</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Lucro Líquido</TableHead>
                      <TableHead className="text-right">ROI</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-center">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.map((trade) => (
                      <TableRow key={trade.id}>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell className="text-sm">{trade.buy_exchange}</TableCell>
                        <TableCell className="text-sm">{trade.sell_exchange}</TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatCurrency(trade.investment_amount)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-xs ${
                          trade.net_profit > 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {formatCurrency(trade.net_profit)}
                        </TableCell>
                        <TableCell className={`text-right font-mono text-xs ${
                          trade.roi_percentage > 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {formatPercentage(trade.roi_percentage)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="space-y-1">
                            <Badge variant={trade.status === 'completed' ? 'default' : 'secondary'}>
                              {trade.status === 'completed' ? 'Concluído' : 
                               trade.status === 'failed' ? 'Falhado' : 'Pendente'}
                            </Badge>
                            {trade.trading_mode && (
                              <div className="flex flex-col items-center gap-1">
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    trade.trading_mode === 'real' 
                                      ? 'bg-red-100 border-red-300 text-red-800' 
                                      : 'bg-blue-50 border-blue-300 text-blue-800'
                                  }`}
                                >
                                  {trade.trading_mode === 'real' ? 'REAL' : 'TESTE'}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {new Date(trade.created_at).toLocaleString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal de Depósito */}
      <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Depositar Fundos</DialogTitle>
            <DialogDescription>
              Adicione USDT ao seu portfolio para executar operações de arbitragem reais.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="amount">Valor em USDT</Label>
              <Input
                id="amount"
                type="number"
                placeholder="1000.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              Este é um depósito simulado para fins de demonstração. Em um ambiente real, este seria integrado com um sistema de pagamento.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleDeposit}>
              Depositar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}