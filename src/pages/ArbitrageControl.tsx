import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ArbitrageSidebar } from "@/components/ArbitrageSidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { getUserId } from '@/lib/userUtils';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { CredentialsValidator } from '@/components/CredentialsValidator';
import APIConfiguration from '@/components/APIConfiguration';
import AutoArbitrageConfig from '@/components/AutoArbitrageConfig';
import RealModeActivator from '@/components/RealModeActivator';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Settings,
  DollarSign,
  Clock,
  Target,
  Shield,
  Wallet,
  Activity,
  XCircle,
  Power,
  Bot,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ArbitrageExecutionModal from '@/components/ArbitrageExecutionModal';
import { OKXInstrumentChecker } from '@/components/OKXInstrumentChecker';
import Web3PortfolioCard from '@/components/Web3PortfolioCard';
import OKXPortfolioCard from '@/components/OKXPortfolioCard';
import HyperliquidPortfolioCard from '@/components/HyperliquidPortfolioCard';
import SmartTransferDashboard from '@/components/SmartTransferDashboard';
import IPWhitelistHelper from '@/components/IPWhitelistHelper';
import { IPWhitelistGuide } from '@/components/IPWhitelistGuide';
import { DirectIPConnectionTest } from '@/components/DirectIPConnectionTest';
import { ExchangeBalanceCard } from '@/components/ExchangeBalanceCard';
import { TotalBalanceCard } from '@/components/TotalBalanceCard';
import { ConversionHistory } from '@/components/ConversionHistory';
import { SmartBalanceRebalancer } from '@/components/SmartBalanceRebalancer';
import { UnlockBalances } from '@/components/UnlockBalances';
import { AutoCrossExchangeConfig } from '@/components/AutoCrossExchangeConfig';
import { SystemHealthCheck } from '@/components/SystemHealthCheck';
import { N8NIntegration } from '@/components/N8NIntegration';
import { BlockchainTransferHub } from '@/components/BlockchainTransferHub';

import { type ArbitrageOpportunity } from '@/types/arbitrage';

// Force rebuild after TotalBalanceCard changes
interface TradingSettings {
  auto_trading: boolean;
  min_spread: number;
  max_investment: number;
  risk_tolerance: 'LOW' | 'MEDIUM' | 'HIGH';
  selected_symbols: string[];
}

interface TradingConfig {
  minSlippage: number;
  maxSlippage: number;
  mevProtection: boolean;
  walletType: string;
  maxTradeSize: number;
  dailyLimit: number;
  maxConcurrentTrades: number;
}

interface PortfolioAsset {
  symbol: string;
  balance: number;
  locked_balance: number;
  updated_at: string;
  exchange?: string;
  value_usd?: number;
  price_usd?: number;
}

export default function ArbitrageControl() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isRealMode, setIsRealMode, hasCredentials } = useTradingMode();
  const [activeTab, setActiveTab] = useState('status');
  
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [binanceBalance, setBinanceBalance] = useState(0);
  const [okxBalance, setOkxBalance] = useState(0);
  const [binancePrice, setBinancePrice] = useState(0);
  const [okxPrice, setOkxPrice] = useState(0);
  const [selectedToken, setSelectedToken] = useState<string>('SOL');
  
  const [settings, setSettings] = useState<TradingSettings>({
    auto_trading: false,
    min_spread: 0.5,
    max_investment: 10,
    risk_tolerance: 'MEDIUM',
    selected_symbols: ['BTC', 'ETH', 'BNB', 'SOL']
  });
  const [showIPHelper, setShowIPHelper] = useState(false);

  const [tradingConfig, setTradingConfig] = useState<TradingConfig>({
    minSlippage: 0.1,
    maxSlippage: 0.5,
    mevProtection: false,
    walletType: 'phantom',
    maxTradeSize: 10,
    dailyLimit: 1000,
    maxConcurrentTrades: 3
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'text-green-600';
      case 'MEDIUM': return 'text-yellow-600';
      case 'HIGH': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const loadOpportunities = async () => {
    try {
      setIsLoading(true);
      
      const startTime = performance.now();
      
      console.log('🔍 Buscando oportunidades do banco...');
      const { data: dbData, error: dbError } = await supabase
        .from('realtime_arbitrage_opportunities')
        .select('*')
        .eq('is_active', true)
        .order('spread', { ascending: false })
        .limit(50);
      
      const endTime = performance.now();
      const requestLatency = Math.round(endTime - startTime);
      setLatency(requestLatency);
      console.log(`⚡ Latência da requisição: ${requestLatency}ms`);
      
      let formattedOpportunities: ArbitrageOpportunity[] = [];
      
      if (!dbError && Array.isArray(dbData) && dbData.length > 0) {
        console.log(`✅ ${dbData.length} oportunidades encontradas no banco`);
        formattedOpportunities = dbData
          .filter((opp: any) => opp.buy_price > 0 && opp.sell_price > 0)
          .map((opp: any) => ({
            id: opp.id || `${opp.symbol}-${opp.buy_exchange}-${opp.sell_exchange}`,
            symbol: opp.symbol,
            buy_exchange: opp.buy_exchange,
            sell_exchange: opp.sell_exchange,
            buy_price: opp.buy_price,
            sell_price: opp.sell_price,
            spread: opp.spread,
            potential: opp.net_profit ?? opp.potential ?? 0,
            net_profit: opp.net_profit ?? opp.potential ?? 0,
            risk_level: opp.risk_level || 'MEDIUM',
            last_updated: opp.last_updated || new Date().toISOString(),
            buyExchange: opp.buy_exchange,
            sellExchange: opp.sell_exchange,
            buyPrice: opp.buy_price,
            sellPrice: opp.sell_price,
            riskLevel: opp.risk_level || 'MEDIUM',
            spreadPercentage: opp.spread,
            liquidityBuy: 50000,
            liquiditySell: 50000,
            netProfitUsd: opp.net_profit ?? opp.potential ?? 0,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            gasFeeEstimate: opp.transfer_fee ?? 0.0005,
            executionTimeEstimate: (opp.transfer_time ?? 1) * 1000
          }));
      } else {
        console.log('⚠️ Nenhuma oportunidade no banco, tentando API...');
        
        const { data: result, error } = await supabase.functions.invoke('detect-arbitrage-opportunities', {
          body: { 
            type: 'cross_exchange',
            trading_mode: isRealMode ? 'real' : 'simulation'
          }
        });
        
        if (!error && result?.success && Array.isArray(result.opportunities)) {
          console.log(`📡 ${result.opportunities.length} oportunidades da API`);
          formattedOpportunities = result.opportunities.map((opp: any, index: number) => ({
            id: `${opp.symbol}-${index}`,
            symbol: opp.symbol,
            buy_exchange: opp.buy_exchange,
            sell_exchange: opp.sell_exchange,
            buy_price: opp.buy_price,
            sell_price: opp.sell_price,
            spread: opp.spread_percentage,
            potential: opp.potential_profit,
            net_profit: opp.potential_profit,
            risk_level: opp.risk_level || 'MEDIUM',
            last_updated: new Date().toISOString(),
            buyExchange: opp.buy_exchange,
            sellExchange: opp.sell_exchange,
            buyPrice: opp.buy_price,
            sellPrice: opp.sell_price,
            riskLevel: opp.risk_level || 'MEDIUM',
            spreadPercentage: opp.spread_percentage,
            liquidityBuy: opp.liquidity_buy ?? 50000,
            liquiditySell: opp.liquidity_sell ?? 50000,
            netProfitUsd: opp.potential_profit ?? 0,
            expiresAt: opp.expiry_time ?? new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            gasFeeEstimate: opp.transfer_fee ?? 0.0005,
            executionTimeEstimate: opp.execution_time_estimate ?? 1000
          }));
        }
      }

      console.log(`🎯 Total de oportunidades a exibir: ${formattedOpportunities.length}`);
      setOpportunities(formattedOpportunities);
    } catch (error) {
      console.error('❌ Erro ao carregar oportunidades:', error);
      toast({
        title: 'Erro ao carregar oportunidades',
        description: 'Não foi possível carregar as oportunidades de arbitragem',
        variant: 'destructive'
      });
      setOpportunities([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentTrades = async () => {
    try {
      const userId = await getUserId();
      const { data: trades, error } = await supabase
        .from('arbitrage_trades')
        .select('*')
        .eq('user_id', userId)
        .order('executed_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setRecentTrades(trades || []);
    } catch (error) {
      console.error('Erro ao carregar histórico:', error);
    }
  };

  const loadPortfolioData = async () => {
    try {
      let requestBody = {};
      
      if (isRealMode) {
        const binanceCredentials = localStorage.getItem('binance_credentials');
        const okxCredentials = localStorage.getItem('okx_credentials');
        
        if (binanceCredentials) {
          const binanceCreds = JSON.parse(binanceCredentials);
          requestBody = { 
            ...requestBody, 
            binance_api_key: binanceCreds.apiKey,
            binance_secret_key: binanceCreds.secretKey
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
      }

      const userId = await getUserId();
      const { data: response, error } = await supabase.functions.invoke('get-portfolio', {
        body: { 
          ...requestBody, 
          real_mode: isRealMode,
          user_id: userId
        }
      });

      if (error) throw error;
      
      if (response.success) {
        setPortfolio(response.data.portfolio || []);
      }
    } catch (error) {
      console.error('Erro ao carregar portfolio:', error);
    }
  };

  const openExecutionModal = (opportunity: ArbitrageOpportunity) => {
    const modalOpportunity = {
      id: opportunity.id,
      symbol: opportunity.symbol,
      buy_exchange: opportunity.buy_exchange,
      sell_exchange: opportunity.sell_exchange,
      buy_price: opportunity.buy_price,
      sell_price: opportunity.sell_price,
      spread: opportunity.spread,
      potential: opportunity.potential,
      net_profit: opportunity.potential,
      risk_level: opportunity.risk_level,
      base_currency: opportunity.symbol.split('/')[0] || opportunity.symbol,
      quote_currency: opportunity.symbol.split('/')[1] || 'USD',
      transfer_fee: 0.001,
      transfer_time: 120
    };
    setSelectedOpportunity(modalOpportunity as any);
    setIsModalOpen(true);
  };

  const executeArbitrage = async (opportunity: any, config: any) => {
    try {
      console.log('🚀 Iniciando execução de arbitragem:', { opportunity, config });
      setIsExecuting(true);

      const binanceCredentials = localStorage.getItem('binance_credentials');
      const okxCredentials = localStorage.getItem('okx_credentials');
      
      if (!binanceCredentials || !okxCredentials) {
        toast({
          title: "Erro",
          description: "Credenciais API não encontradas. Configure na página inicial.",
          variant: "destructive"
        });
        return;
      }

      const binanceCreds = JSON.parse(binanceCredentials);
      const okxCreds = JSON.parse(okxCredentials);
      const userId = await getUserId();

      console.log('📡 Chamando edge function execute-cross-exchange-arbitrage...');

      const { data, error } = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
        body: {
          opportunityId: opportunity.id || 'manual',
          userId: userId,
          symbol: opportunity.symbol,
          buyExchange: opportunity.buy_exchange,
          sellExchange: opportunity.sell_exchange,
          buyPrice: opportunity.buy_price,
          sellPrice: opportunity.sell_price,
          mode: isRealMode ? 'real' : 'simulation',
          binanceApiKey: binanceCreds.apiKey,
          binanceSecretKey: binanceCreds.secretKey,
          okxApiKey: okxCreds.apiKey,
          okxSecretKey: okxCreds.secretKey,
          okxPassphrase: okxCreds.passphrase,
          config: {
            investmentAmount: config.investmentAmount,
            maxSlippage: config.maxSlippage,
            customFeeRate: 0.2,
            stopLossPercentage: config.stopLossPercentage,
            prioritizeSpeed: true
          }
        }
      });

      if (error) {
        console.error('❌ Erro na edge function:', error);
        throw error;
      }

      console.log('✅ Resposta da edge function:', data);

      if (data.success) {
        toast({
          title: "Arbitragem Executada!",
          description: `Trade ${opportunity.symbol} executado com sucesso. Lucro: $${data.result?.net_profit?.toFixed(2) || '0.00'}`,
        });
        
        await loadOpportunities();
        await loadRecentTrades();
        await loadPortfolioData();
      } else {
        const errorMsg = data.error || data.errorMessage || "Falha ao executar arbitragem";
        
        if (errorMsg.includes('verified address list') || 
            errorMsg.includes('whitelist') || 
            errorMsg.includes('AÇÃO NECESSÁRIA') ||
            errorMsg.includes('address not in whitelist')) {
          
          const isOKX = errorMsg.includes('OKX') || errorMsg.toLowerCase().includes('okx');
          const isBinance = errorMsg.includes('Binance') || errorMsg.toLowerCase().includes('binance');
          
          const exchangeName = isOKX ? 'OKX' : isBinance ? 'Binance' : 'Exchange';
          const whitelistUrl = isOKX 
            ? 'https://www.okx.com/balance/withdrawal-address'
            : 'https://www.binance.com/en/my/security/address-management';
          
          toast({
            title: `⚠️ Endereço não verificado na ${exchangeName}`,
            description: `Acesse ${exchangeName} > Retirada > Gerenciar Endereços e adicione o endereço de depósito na whitelist.`,
            variant: "destructive",
            duration: 12000
          });
          
          console.error(`📋 Instruções completas de whitelist ${exchangeName}:`, errorMsg);
          console.log(`🔗 Link direto: ${whitelistUrl}`);
        } else {
          toast({
            title: "Erro na Execução",
            description: errorMsg.length > 100 ? errorMsg.substring(0, 100) + "..." : errorMsg,
            variant: "destructive"
          });
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao executar arbitragem:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro desconhecido ao executar arbitragem",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
      setIsModalOpen(false);
      setSelectedOpportunity(null);
    }
  };

  useEffect(() => {
    loadOpportunities();
    loadRecentTrades();
    loadPortfolioData();

    const interval = setInterval(() => {
      loadOpportunities();
    }, 30000);

    return () => clearInterval(interval);
  }, [isRealMode]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        <ArbitrageSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        <div className="flex-1 flex flex-col">
          <header className="h-12 flex items-center border-b border-white/10 bg-background/50 backdrop-blur-sm sticky top-0 z-10 px-4">
            <SidebarTrigger className="mr-4" />
            <div className="flex items-center gap-4 flex-1">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h1 className="text-xl font-semibold flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-primary" />
                Arbitragem Cross-Over
                <Badge className="ml-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-none">
                  🚀 MODO HÍBRIDO
                </Badge>
              </h1>
            </div>
            <Button 
              onClick={() => navigate('/auto-bot')}
              className="flex items-center gap-2"
              variant="default"
              size="sm"
            >
              <Bot className="h-4 w-4" />
              Bot Automático
            </Button>
          </header>

          <main className="flex-1 p-4 md:p-8 space-y-6 overflow-auto">
            {/* Status Card */}
            <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                    <div>
                      <p className="font-semibold text-sm">Sistema de Monitoramento Ativo</p>
                      <p className="text-xs text-muted-foreground">
                        {opportunities.length} oportunidades detectadas | 
                        Modo: {isRealMode ? ' Real Trading 🔴' : ' Simulação 🟡'} | 
                        APIs: {hasCredentials ? ' Configuradas ✅' : ' Pendentes ⚠️'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`${
                        latency === null 
                          ? 'bg-gray-50 text-gray-700 border-gray-200'
                          : latency < 100 
                          ? 'bg-green-50 text-green-700 border-green-200' 
                          : latency < 300 
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : 'bg-red-50 text-red-700 border-red-200'
                      }`}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Latência: {latency === null ? '...' : `${latency}ms`}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadOpportunities()}
                      disabled={isLoading}
                    >
                      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {!hasCredentials && isRealMode && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-2 h-12 bg-red-500 rounded-full"></div>
                    <div>
                      <h3 className="font-medium text-red-800">Credenciais API Necessárias para Modo Real</h3>
                      <p className="text-sm text-red-700 mt-1">
                        Para operar em modo real, configure suas credenciais API na página inicial. 
                        Certifique-se de que as APIs tenham permissões "Enable Reading" e "Spot & Margin Trading".
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Card do Bot Automático */}
            <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-600 rounded-lg">
                      <Bot className="h-8 w-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900">Bot Automático de Arbitragem</h3>
                      <p className="text-sm text-blue-700 mt-1">
                        Automação contínua de execução de arbitragens com reinvestimento inteligente
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          <Zap className="h-3 w-3 mr-1" />
                          Execução automática
                        </Badge>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          Compounding
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => navigate('/auto-bot')}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                  >
                    <Bot className="h-5 w-5 mr-2" />
                    Configurar Bot
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Conteúdo dinâmico baseado na aba ativa */}
            {activeTab === 'status' && (
              <div className="space-y-4">
                <CredentialsValidator />
              </div>
            )}

            {activeTab === 'diagnostic' && (
              <div className="space-y-4">
                <SystemHealthCheck />
              </div>
            )}

            {activeTab === 'balances' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <ExchangeBalanceCard 
                    exchange="binance"
                    baseline={100}
                    onBalanceChange={setBinanceBalance}
                    otherExchangePrice={okxPrice}
                    onPriceUpdate={setBinancePrice}
                    selectedToken={selectedToken}
                    onTokenChange={setSelectedToken}
                  />
                  
                  <ExchangeBalanceCard 
                    exchange="okx"
                    baseline={100}
                    onBalanceChange={setOkxBalance}
                    otherExchangePrice={binancePrice}
                    onPriceUpdate={setOkxPrice}
                    selectedToken={selectedToken}
                    onTokenChange={setSelectedToken}
                  />
                  
                  <TotalBalanceCard 
                    binanceBalance={binanceBalance} 
                    okxBalance={okxBalance}
                    totalBaseline={200}
                    selectedToken={selectedToken}
                  />
                </div>

                <UnlockBalances />
                <SmartBalanceRebalancer />
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Dashboard content aqui */}
              </div>
            )}

            {activeTab === 'real-mode' && (
              <div className="space-y-4">
                <RealModeActivator />
              </div>
            )}

            {activeTab === 'opportunities' && (
              <div className="space-y-4">
                {opportunities.some(o => o.potential > 2) && (
                  <Card className="border-2 border-green-500 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-green-600 animate-pulse" />
                        <div>
                          <p className="font-semibold text-green-900">
                            {opportunities.filter(o => o.potential > 2).length} Oportunidades de Alto Lucro Detectadas!
                          </p>
                          <p className="text-sm text-green-700">
                            Aproveite estas oportunidades enquanto estão disponíveis
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Oportunidades em Tempo Real
                    </CardTitle>
                    <CardDescription>
                      {opportunities.length} oportunidades ativas
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {opportunities.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Símbolo</TableHead>
                              <TableHead>Comprar</TableHead>
                              <TableHead>Vender</TableHead>
                              <TableHead>Spread</TableHead>
                              <TableHead>Potencial</TableHead>
                              <TableHead>Risco</TableHead>
                              <TableHead className="text-center">Ação</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {opportunities.map((opportunity) => {
                              const isHighProfit = opportunity.potential > 2;
                              return (
                                <TableRow 
                                  key={opportunity.id}
                                  className={isHighProfit ? 'bg-green-50/50 hover:bg-green-100/50' : ''}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {opportunity.symbol}
                                      {isHighProfit && (
                                        <Badge className="bg-green-600 text-white">
                                          🔥 HOT
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      <div className="font-medium">{opportunity.buy_exchange}</div>
                                      <div className="text-muted-foreground">{formatCurrency(opportunity.buy_price)}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      <div className="font-medium">{opportunity.sell_exchange}</div>
                                      <div className="text-muted-foreground">{formatCurrency(opportunity.sell_price)}</div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={opportunity.spread > 1.0 ? "default" : "secondary"}>
                                      {opportunity.spread.toFixed(3)}%
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <span className={isHighProfit ? 'font-bold text-green-600' : ''}>
                                      {formatCurrency(opportunity.potential)}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={getRiskColor(opportunity.risk_level)}>
                                      {opportunity.risk_level}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      size="sm"
                                      onClick={() => openExecutionModal(opportunity)}
                                      disabled={executingIds.has(opportunity.id)}
                                      className={`min-w-[100px] ${isHighProfit ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                    >
                                      {executingIds.has(opportunity.id) ? (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                          Executando...
                                        </>
                                      ) : (
                                        <>
                                          <Play className="h-3 w-3 mr-1" />
                                          Executar
                                        </>
                                      )}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        {isLoading ? 'Carregando oportunidades...' : 'Nenhuma oportunidade encontrada'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'auto-config' && (
              <div className="space-y-4">
                <AutoArbitrageConfig />
              </div>
            )}

            {activeTab === 'cross-automation' && (
              <div className="space-y-4">
                <AutoCrossExchangeConfig />
              </div>
            )}

            {activeTab === 'api-config' && (
              <div className="space-y-4">
                <APIConfiguration />
              </div>
            )}

            {activeTab === 'whitelist' && (
              <div className="space-y-4">
                <DirectIPConnectionTest />
                <IPWhitelistGuide />
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className="space-y-4">
                <SmartTransferDashboard />
              </div>
            )}

            {activeTab === 'conversions' && (
              <div className="space-y-4">
                <ConversionHistory />
              </div>
            )}

            {activeTab === 'n8n' && (
              <div className="space-y-4">
                <N8NIntegration />
              </div>
            )}

            {activeTab === 'blockchain' && (
              <div className="space-y-4">
                <BlockchainTransferHub />
              </div>
            )}
          </main>
        </div>
      </div>

      {isModalOpen && selectedOpportunity && (
        <ArbitrageExecutionModal
          opportunity={selectedOpportunity}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedOpportunity(null);
          }}
          onExecute={executeArbitrage}
          isExecuting={isExecuting}
          onRefreshOpportunities={loadOpportunities}
        />
      )}

      {showIPHelper && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-2xl w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Assistente de IP Whitelist</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowIPHelper(false)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <IPWhitelistHelper />
          </div>
        </div>
      )}
    </SidebarProvider>
  );
}
