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
import { ArrowLeft, Wallet, Activity, Clock, Target, RefreshCw, Settings, Shield, AlertTriangle, Plus } from 'lucide-react';
import APIConfiguration from '@/components/APIConfiguration';
import Web3PortfolioCard from '@/components/Web3PortfolioCard';

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
  trading_mode?: string; // Adicionar campo de modo
  error_message?: string; // Adicionar campo de mensagem de erro
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
        const pionexCredentials = localStorage.getItem('pionex_credentials');
        const hyperliquidCredentials = localStorage.getItem('hyperliquid_credentials');
        
        if (binanceCredentials) {
          const binanceCreds = JSON.parse(binanceCredentials);
          requestBody = { 
            ...requestBody, 
            binance_api_key: binanceCreds.apiKey,
            binance_secret_key: binanceCreds.secretKey
          };
        }
        
        if (pionexCredentials) {
          const pionexCreds = JSON.parse(pionexCredentials);
          requestBody = { 
            ...requestBody, 
            pionex_api_key: pionexCreds.apiKey,
            pionex_secret_key: pionexCreds.secretKey
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
        
        // Log para debug
        console.log('Credenciais enviadas:', {
          hasBinance: !!binanceCredentials,
          hasPionex: !!pionexCredentials,
          hasHyperliquid: !!hyperliquidCredentials,
          realMode: isRealMode
        });
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
        setPortfolio(response.data.portfolio);
        setTrades(response.data.recent_trades);
        setStats(response.data.statistics);
        
        // Mostrar toast indicando o modo e fonte dos dados
        if (isRealMode) {
          if (response.data.data_source === 'real-api') {
            toast({
              title: "✅ Modo Real Ativo",
              description: "Dados obtidos diretamente das APIs das exchanges",
            });
          } else if (response.data.data_source === 'simulated-fallback') {
            toast({
              title: "⚠️ Modo Real com Fallback",
              description: "Problema na autenticação com APIs. Verifique suas credenciais.",
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
        throw new Error(response.error || 'Erro ao carregar dados');
      }
    } catch (error) {
      console.error('Erro ao carregar portfolio:', error);
      toast({
        title: "Erro",
        description: isRealMode ? "Falha ao carregar dados reais. Verifique suas credenciais." : "Falha ao carregar dados do portfolio",
        variant: "destructive"
      });
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

  useEffect(() => {
    loadPortfolioData();
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
          <Button variant="outline" size="sm" onClick={() => setShowDepositModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Depositar
          </Button>
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

      {/* Estatísticas */}
      {stats && (
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

      {/* Tabs: Portfolio e Histórico */}
      <Tabs defaultValue="portfolio" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="portfolio">Meus Saldos</TabsTrigger>
          <TabsTrigger value="history">Histórico de Trades</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Saldos Binance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-yellow-500" />
                  Binance
                </CardTitle>
                <CardDescription>Seus saldos na Binance</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Asset</TableHead>
                      <TableHead className="text-right w-[80px]">Preço</TableHead>
                      <TableHead className="text-right w-[100px]">Saldo Livre</TableHead>
                      <TableHead className="text-right w-[100px]">Bloqueado</TableHead>
                      <TableHead className="text-right w-[100px]">Total</TableHead>
                      <TableHead className="text-right w-[100px]">Valor USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.filter(asset => asset.exchange === 'Binance').length > 0 ? (
                      portfolio.filter(asset => asset.exchange === 'Binance').map((asset) => (
                        <TableRow key={`binance-${asset.symbol}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                              <span className="text-sm font-mono">{asset.symbol}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {asset.price_usd ? `$${asset.price_usd.toFixed(asset.price_usd < 1 ? 4 : 2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {asset.balance.toFixed(asset.balance < 1 ? 6 : 2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {asset.locked_balance.toFixed(asset.locked_balance < 1 ? 6 : 2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {(asset.balance + asset.locked_balance).toFixed((asset.balance + asset.locked_balance) < 1 ? 6 : 2)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium">
                            {asset.price_usd ? formatCurrency(asset.price_usd * (asset.balance + asset.locked_balance)) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {isRealMode ? 'Nenhum saldo encontrado na Binance' : 'Configure a API da Binance no modo real'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Carteira Web3 (substituindo Hyperliquid) */}
            <Web3PortfolioCard />

            {/* Saldos OKX */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-500" />
                  OKX
                </CardTitle>
                <CardDescription>Seus saldos na OKX</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Asset</TableHead>
                      <TableHead className="text-right w-[80px]">Preço</TableHead>
                      <TableHead className="text-right w-[100px]">Saldo Livre</TableHead>
                      <TableHead className="text-right w-[100px]">Bloqueado</TableHead>
                      <TableHead className="text-right w-[100px]">Total</TableHead>
                      <TableHead className="text-right w-[100px]">Valor USD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.filter(asset => asset.exchange === 'OKX').length > 0 ? (
                      portfolio.filter(asset => asset.exchange === 'OKX').map((asset) => (
                        <TableRow key={`okx-${asset.symbol}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <span className="text-sm font-mono">{asset.symbol}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {asset.price_usd ? `$${asset.price_usd.toFixed(asset.price_usd < 1 ? 4 : 2)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {asset.balance.toFixed(asset.balance < 1 ? 6 : 2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-muted-foreground">
                            {asset.locked_balance.toFixed(asset.locked_balance < 1 ? 6 : 2)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            {(asset.balance + asset.locked_balance).toFixed((asset.balance + asset.locked_balance) < 1 ? 6 : 2)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium">
                            {asset.price_usd ? formatCurrency(asset.price_usd * (asset.balance + asset.locked_balance)) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          {isRealMode ? 'Nenhum saldo encontrado na OKX' : 'Configure a API da OKX no modo real'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Saldos Consolidados - apenas se houver dados simulados */}
          {portfolio.some(asset => !asset.exchange) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Saldos Consolidados (Simulados)
                </CardTitle>
                <CardDescription>Dados de demonstração consolidados</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Asset</TableHead>
                      <TableHead className="text-right w-[80px]">Preço</TableHead>
                      <TableHead className="text-right w-[100px]">Saldo Livre</TableHead>
                      <TableHead className="text-right w-[100px]">Bloqueado</TableHead>
                      <TableHead className="text-right w-[100px]">Total</TableHead>
                      <TableHead className="text-right w-[100px]">Valor USD</TableHead>
                      <TableHead className="text-center w-[120px]">Atualização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.filter(asset => !asset.exchange).map((asset) => (
                      <TableRow key={asset.symbol}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" />
                            {asset.symbol}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {asset.balance.toFixed(8)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {asset.locked_balance.toFixed(8)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {asset.price_usd ? `$${asset.price_usd.toFixed(asset.price_usd < 1 ? 4 : 2)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {asset.balance.toFixed(asset.balance < 1 ? 6 : 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {asset.locked_balance.toFixed(asset.locked_balance < 1 ? 6 : 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-medium">
                          {(asset.balance + asset.locked_balance).toFixed((asset.balance + asset.locked_balance) < 1 ? 6 : 2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {asset.price_usd ? formatCurrency(asset.price_usd * (asset.balance + asset.locked_balance)) : '-'}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {new Date(asset.updated_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {/* Aviso sobre diferenciação de modos */}
          {trades.some(t => t.trading_mode === 'real') && !isRealMode && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-800">
                      Histórico Contém Operações Reais
                    </p>
                    <p className="text-sm text-orange-700 mt-1">
                      Você executou operações anteriormente em modo real. Agora está no modo simulação, 
                      então novas operações não afetarão sua carteira física.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico de Operações
              </CardTitle>
              <CardDescription>Suas últimas 20 operações de arbitragem</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Token</TableHead>
                     <TableHead className="text-right">Investimento</TableHead>
                     <TableHead className="text-right">Spread</TableHead>
                     <TableHead className="text-right">Lucro Líq.</TableHead>
                     <TableHead className="text-right">ROI</TableHead>
                     <TableHead className="text-center">Status</TableHead>
                     <TableHead className="text-center">Risco</TableHead>
                     <TableHead className="text-center">Modo</TableHead>
                     <TableHead className="text-center">Data</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {trades
                    .filter(trade => {
                      // Se está em modo simulação, mostrar apenas trades de teste/simulação
                      if (!isRealMode) {
                        return trade.trading_mode === 'test' || trade.trading_mode === 'simulation';
                      }
                      // Se está em modo real, mostrar todos
                      return true;
                    })
                    .map((trade) => (
                    <TableRow key={trade.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-primary" />
                          {trade.symbol}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {trade.buy_exchange} → {trade.sell_exchange}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(trade.investment_amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={trade.spread_percentage > 1.5 ? 'default' : 'secondary'}>
                          {formatPercentage(trade.spread_percentage)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono ${trade.net_profit > 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatCurrency(trade.net_profit)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-medium ${trade.roi_percentage > 0 ? 'text-success' : 'text-destructive'}`}>
                          {formatPercentage(trade.roi_percentage)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant={
                            trade.status === 'completed' ? 'default' : 
                            trade.status === 'pending' ? 'secondary' : 'destructive'
                          }
                        >
                          {trade.status === 'completed' ? 'Executado' : 
                           trade.status === 'pending' ? 'Pendente' : 'Falhou'}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-center">
                         <Badge 
                           variant={
                             trade.risk_level === 'LOW' ? 'default' : 
                             trade.risk_level === 'MEDIUM' ? 'secondary' : 'destructive'
                           }
                           className="text-xs"
                         >
                           {trade.risk_level}
                         </Badge>
                       </TableCell>
                        <TableCell className="text-center">
                          {trade.error_message && trade.error_message.includes('Solicitado modo real') ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge 
                                variant="outline"
                                className="text-xs bg-yellow-50 border-yellow-300 text-yellow-800"
                              >
                                TESTE
                              </Badge>
                              <span className="text-[10px] text-yellow-600">
                                (Real solicitado)
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <Badge 
                                variant={trade.trading_mode === 'real' ? 'default' : 'outline'}
                                className={`text-xs ${
                                  trade.trading_mode === 'real' 
                                    ? 'bg-red-100 border-red-300 text-red-800' 
                                    : 'bg-blue-50 border-blue-300 text-blue-800'
                                }`}
                              >
                                {trade.trading_mode === 'real' ? 'REAL' : 'TESTE'}
                              </Badge>
                              {!isRealMode && trade.trading_mode === 'real' && (
                                <span className="text-[10px] text-orange-600">
                                  ⚠️ Operação anterior em modo real
                                </span>
                              )}
                            </div>
                          )}
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
        </TabsContent>

        
      </Tabs>

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