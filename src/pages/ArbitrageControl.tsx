import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Activity
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ArbitrageExecutionModal from '@/components/ArbitrageExecutionModal';
import { OKXInstrumentChecker } from '@/components/OKXInstrumentChecker';
import Web3PortfolioCard from '@/components/Web3PortfolioCard';
import OKXPortfolioCard from '@/components/OKXPortfolioCard';
import SmartTransferDashboard from '@/components/SmartTransferDashboard';

import { type ArbitrageOpportunity } from '@/types/arbitrage';

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
  
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null);
  const [portfolio, setPortfolio] = useState<PortfolioAsset[]>([]);
  
  const [settings, setSettings] = useState<TradingSettings>({
    auto_trading: false,
    min_spread: 0.5,
    max_investment: 100,
    risk_tolerance: 'MEDIUM',
    selected_symbols: ['BTC', 'ETH', 'BNB', 'SOL']
  });
  const [showIPHelper, setShowIPHelper] = useState(false);

  const [tradingConfig, setTradingConfig] = useState<TradingConfig>({
    minSlippage: 0.1,
    maxSlippage: 0.5,
    mevProtection: false,
    walletType: 'phantom',
    maxTradeSize: 500,
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
      const { data: result, error } = await supabase.functions.invoke('detect-arbitrage-opportunities', {
        body: { 
          type: 'cross_exchange',
          trading_mode: isRealMode ? 'real' : 'simulation'
        }
      });
      if (error) {
        throw new Error(error.message);
      }
      console.log('Resultado da detecção:', result);
      if (result.success && result.opportunities) {
        const formattedOpportunities = result.opportunities.map((opp: any, index: number) => ({
          id: `${opp.symbol}-${index}`,
          symbol: opp.symbol,
          buy_exchange: opp.buy_exchange,
          sell_exchange: opp.sell_exchange,
          buy_price: opp.buy_price,
          sell_price: opp.sell_price,
          spread: opp.spread_percentage,
          potential: opp.potential_profit,
          risk_level: opp.risk_level || 'MEDIUM',
          last_updated: new Date().toISOString()
        }));
        setOpportunities(formattedOpportunities);
      } else {
        setOpportunities([]);
      }
    } catch (error) {
      console.error('Erro ao carregar oportunidades:', error);
      toast({
        title: "Erro ao carregar oportunidades",
        description: "Não foi possível carregar as oportunidades de arbitragem",
        variant: "destructive"
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

  const executeAutomaticArbitrage = async (investmentAmount: number = 10) => {
    try {
      setIsLoading(true);
      toast({
        title: "🚀 Iniciando Arbitragem Automática",
        description: `Buscando a melhor oportunidade com investimento base de ${formatCurrency(investmentAmount)}... (valor será ajustado conforme LOT_SIZE)`,
        duration: 5000,
      });

      // 1. Buscar oportunidades atuais
      const { data: result, error } = await supabase.functions.invoke('detect-arbitrage-opportunities', {
        body: { 
          type: 'cross_exchange',
          trading_mode: isRealMode ? 'real' : 'simulation'
        }
      });

      if (error || !result?.opportunities?.length) {
        throw new Error('Nenhuma oportunidade encontrada no momento');
      }

      // 2. Selecionar a melhor oportunidade (maior spread, menor risco)
      const validOpportunities = result.opportunities.filter((opp: any) => 
        (opp.spreadPercentage || opp.spread_percentage || opp.spread || 0) > 0.5 && // Mínimo 0.5% spread
        (opp.riskLevel || opp.risk_level) !== 'HIGH'
      );

      if (!validOpportunities.length) {
        throw new Error('Nenhuma oportunidade válida encontrada (spread mínimo 0.5%, risco baixo/médio)');
      }

      // Ordenar por spread decrescente e selecionar a melhor
      const bestOpportunity = validOpportunities.sort((a: any, b: any) => {
        const spreadA = a.spreadPercentage || a.spread_percentage || a.spread || 0;
        const spreadB = b.spreadPercentage || b.spread_percentage || b.spread || 0;
        return spreadB - spreadA;
      })[0];

      const spread = bestOpportunity.spreadPercentage || bestOpportunity.spread_percentage || bestOpportunity.spread || 0;
      const buyExchange = bestOpportunity.buyExchange || bestOpportunity.buy_exchange || 'N/A';
      const sellExchange = bestOpportunity.sellExchange || bestOpportunity.sell_exchange || 'N/A';

      toast({
        title: "🎯 Melhor Oportunidade Selecionada",
        description: `${bestOpportunity.symbol}: ${buyExchange} → ${sellExchange} | Spread: ${spread.toFixed(2)}%`,
        duration: 5000,
      });

      // 3. Verificar credenciais necessárias
      const binanceCredentials = localStorage.getItem('binance_credentials');
      const okxCredentials = localStorage.getItem('okx_credentials');
      
      const needsBinance = buyExchange === 'Binance' || sellExchange === 'Binance';
      const needsOKX = buyExchange === 'OKX' || sellExchange === 'OKX';

      if (needsBinance && !binanceCredentials) {
        throw new Error('Credenciais da Binance necessárias para esta oportunidade');
      }
      if (needsOKX && !okxCredentials) {
        throw new Error('Credenciais da OKX necessárias para esta oportunidade');
      }

// Função para ajustar valores conforme LOT_SIZE das exchanges
const adjustInvestmentForLotSize = (symbol: string, investmentAmount: number, buyExchange: string, sellExchange: string) => {
  // Regras específicas de LOT_SIZE por símbolo e exchange
  const lotSizeRules: Record<string, { 
    binance: { minNotional: number; minQty: number; stepSize: number };
    okx: { minSz: number; lotSz: number; tickSz: number };
  }> = {
    'BTC': {
      binance: { minNotional: 10, minQty: 0.00001, stepSize: 0.00001 },
      okx: { minSz: 0.00001, lotSz: 0.00001, tickSz: 0.1 }
    },
    'ETH': {
      binance: { minNotional: 10, minQty: 0.0001, stepSize: 0.0001 },
      okx: { minSz: 0.0001, lotSz: 0.0001, tickSz: 0.01 }
    },
    'BNB': {
      binance: { minNotional: 10, minQty: 0.001, stepSize: 0.001 },
      okx: { minSz: 0.001, lotSz: 0.001, tickSz: 0.001 }
    },
    'XRP': {
      binance: { minNotional: 10, minQty: 0.1, stepSize: 0.1 },
      okx: { minSz: 0.1, lotSz: 0.1, tickSz: 0.0001 }
    },
    'ADA': {
      binance: { minNotional: 10, minQty: 0.1, stepSize: 0.1 },
      okx: { minSz: 1, lotSz: 1, tickSz: 0.00001 }
    },
    'SOL': {
      binance: { minNotional: 10, minQty: 0.001, stepSize: 0.001 },
      okx: { minSz: 0.001, lotSz: 0.001, tickSz: 0.001 }
    }
  };

  const cleanSymbol = symbol.replace('USDT', '').replace('-USDT', '').replace('/', '');
  const rules = lotSizeRules[cleanSymbol];
  
  if (!rules) {
    console.warn(`⚠️ Regras LOT_SIZE não encontradas para ${cleanSymbol}, usando valor padrão`);
    return Math.max(investmentAmount, 11); // Mínimo seguro
  }

  // Ajustar para valores mínimos de cada exchange
  const binanceMinNotional = rules.binance.minNotional;
  const okxMinValue = rules.okx.minSz * 100; // Estimativa conservadora
  
  let adjustedAmount = investmentAmount;
  
  // Garantir que atende ambas as exchanges
  if (buyExchange === 'Binance' || sellExchange === 'Binance') {
    adjustedAmount = Math.max(adjustedAmount, binanceMinNotional);
  }
  if (buyExchange === 'OKX' || sellExchange === 'OKX') {
    adjustedAmount = Math.max(adjustedAmount, okxMinValue);
  }
  
  // Arredondar para valor seguro
  const finalAmount = Math.ceil(adjustedAmount);
  
  if (finalAmount !== investmentAmount) {
    console.log(`🔧 Valor ajustado: $${investmentAmount} → $${finalAmount} para ${cleanSymbol} (${buyExchange}→${sellExchange})`);
  }
  
  return finalAmount;
};

      // 4. Executar automaticamente com valor ajustado
      const adjustedInvestment = adjustInvestmentForLotSize(
        bestOpportunity.symbol, 
        investmentAmount, 
        buyExchange, 
        sellExchange
      );
      
      setExecutingIds(prev => new Set([...prev, bestOpportunity.symbol]));
      const userId = await getUserId();
      
      const { data: executeResult, error: executeError } = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
        body: {
          opportunityId: bestOpportunity.symbol,
          userId: userId,
          symbol: bestOpportunity.symbol,
          buyExchange: buyExchange,
          sellExchange: sellExchange,
          buyPrice: bestOpportunity.buyPrice || bestOpportunity.buy_price,
          sellPrice: bestOpportunity.sellPrice || bestOpportunity.sell_price,
          mode: isRealMode ? 'real' : 'simulation',
          // Enviar credenciais inline
          binanceApiKey: (()=>{try{return JSON.parse(localStorage.getItem('binance_credentials')||'{}').apiKey}catch{return undefined}})(),
          binanceSecretKey: (()=>{try{return JSON.parse(localStorage.getItem('binance_credentials')||'{}').secretKey}catch{return undefined}})(),
          okxApiKey: (()=>{try{return JSON.parse(localStorage.getItem('okx_credentials')||'{}').apiKey}catch{return undefined}})(),
          okxSecretKey: (()=>{try{return JSON.parse(localStorage.getItem('okx_credentials')||'{}').secretKey}catch{return undefined}})(),
          okxPassphrase: (()=>{try{return JSON.parse(localStorage.getItem('okx_credentials')||'{}').passphrase}catch{return undefined}})(),
          config: {
            investmentAmount: adjustedInvestment, // Usar valor ajustado
            maxSlippage: 0.2,
            customFeeRate: 0.2,
            stopLossPercentage: 2.0,
            prioritizeSpeed: true
          }
        }
      });

      if (executeError) {
        throw new Error(executeError.message);
      }

      if (executeResult && executeResult.success) {
        const modeText = executeResult.isSimulation || executeResult.mode === 'simulation' ? '⚠️ Simulação' : '✅ Real';
        let description = `${modeText} | Lucro: ${formatCurrency(executeResult.netProfit || 0)} (ROI: ${(executeResult.roiPercentage || 0).toFixed(2)}%)`;
        
        if (executeResult.buyOrderId && executeResult.sellOrderId) {
          description += ` | Buy: ${executeResult.buyOrderId} | Sell: ${executeResult.sellOrderId}`;
        }
        
        toast({
          title: "🎉 Arbitragem Automática Executada!",
          description: description,
          duration: 10000,
        });
        
        await loadRecentTrades();
        await loadOpportunities();
      } else {
        const details = executeResult?.execution_details?.error_message || executeResult?.errorMessage || executeResult?.error || 'Falha na execução';
        throw new Error(details);
      }

    } catch (error: any) {
      console.error('Erro na arbitragem automática:', error);
      toast({
        title: "❌ Erro na Arbitragem Automática",
        description: error?.message || "Erro inesperado durante a execução automática",
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setIsLoading(false);
      setExecutingIds(new Set());
    }
  };

  const executeArbitrage = async (opportunity: any, config?: any) => {
    try {
      const binanceCredentials = localStorage.getItem('binance_credentials');
      const pionexCredentials = localStorage.getItem('pionex_credentials');
      const okxCredentials = localStorage.getItem('okx_credentials');
      
      const needsBinance = opportunity.buy_exchange === 'Binance' || opportunity.sell_exchange === 'Binance';
      const needsOKX = opportunity.buy_exchange === 'OKX' || opportunity.sell_exchange === 'OKX';
      const needsPionex = opportunity.buy_exchange === 'Pionex' || opportunity.sell_exchange === 'Pionex';

      if (needsBinance && !binanceCredentials) {
        toast({
          title: "Credenciais da Binance Necessárias",
          description: "Configure sua API da Binance antes de executar esta operação",
          variant: "destructive"
        });
        return;
      }

      
      if (needsOKX && !okxCredentials) {
        toast({
          title: "Credenciais da OKX Necessárias", 
          description: "Configure sua API da OKX antes de executar esta operação",
          variant: "destructive"
        });
        return;
      }

      if (needsPionex && !pionexCredentials) {
        toast({
          title: "Credenciais da Pionex Necessárias",
          description: "Configure sua API da Pionex antes de executar esta operação", 
          variant: "destructive"
        });
        return;
      }

      const binanceCreds = binanceCredentials ? JSON.parse(binanceCredentials) : null;
      const pionexCreds = pionexCredentials ? JSON.parse(pionexCredentials) : null;
      const okxCreds = okxCredentials ? JSON.parse(okxCredentials) : null;

      setExecutingIds(prev => new Set([...prev, opportunity.id]));
      setIsModalOpen(false);
      
      const userId = await getUserId();
      
      const { data: result, error } = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
        body: {
          opportunityId: opportunity.id,
          userId: userId,
          symbol: opportunity.symbol,
          buyExchange: opportunity.buy_exchange,
          sellExchange: opportunity.sell_exchange,
          buyPrice: opportunity.buy_price,
          sellPrice: opportunity.sell_price,
          mode: isRealMode ? 'real' : 'simulation',
          // Enviar credenciais para execução real
          binanceApiKey: binanceCreds?.apiKey,
          binanceSecretKey: binanceCreds?.secretKey,
          okxApiKey: okxCreds?.apiKey,
          okxSecretKey: okxCreds?.secretKey,
          okxPassphrase: okxCreds?.passphrase,
          // hyperliquidWalletAddress: hyperliquidCreds?.walletAddress,
          // hyperliquidPrivateKey: hyperliquidCreds?.privateKey,
          config: {
            investmentAmount: tradingConfig.maxTradeSize, // Usar configuração de Trading
            maxSlippage: tradingConfig.maxSlippage,
            customFeeRate: 0.2,
            stopLossPercentage: 2.0,
            prioritizeSpeed: true
          }
        }
      });
      
      // Logar resposta para depuração
      console.log('Resultado da execução de arbitragem:', result);
      
      if (error) {
        throw new Error(error.message);
      }
      
      if (result && result.success) {
        if (result.isSimulation || result.mode === 'simulation') {
          toast({
            title: "⚠️ Operação Simulada Executada",
            description: `Lucro simulado: ${formatCurrency(result.netProfit || 0)} (ROI: ${(result.roiPercentage || 0).toFixed(2)}%) | Motivo: ${result.errorMessage || 'Simulação'}`,
            duration: 8000,
          });
        } else {
          let description = `Lucro líquido: ${formatCurrency(result.netProfit || 0)} (ROI: ${(result.roiPercentage || 0).toFixed(2)}%)`;
          
          if (result.autoTransferExecuted) {
            description += ` | 🔄 Transferência automática executada`;
          }
          
          description += ` | ${opportunity.buy_exchange}: ${result.buyOrderId || 'N/A'} | ${opportunity.sell_exchange}: ${result.sellOrderId || 'N/A'}`;
          
          toast({
            title: "✅ Arbitragem Real Executada",
            description: description,
            duration: 10000,
          });
        }
        
        await loadRecentTrades();
        await loadOpportunities();
        
      } else {
        const details = result?.execution_details?.error_message || result?.errorMessage || result?.error || 'Falha na execução';
        throw new Error(details);
      }
      
    } catch (error: any) {
      console.error('Erro na execução:', error);
      
      let errorTitle = "❌ Erro na Execução";
      let errorMessage = error?.message || "Ocorreu um erro inesperado durante a execução da arbitragem.";
      let errorDescription = "💡 Verifique suas credenciais da API e tente novamente.";

      if (errorMessage.includes('Invalid endpoint')) {
        errorDescription = 'O endpoint de ordem não estava disponível. Já corrigimos isso; por favor tente novamente.';
      } else if (errorMessage.includes('Invalid API key') || errorMessage.includes('Invalid signature')) {
        errorTitle = "🔑 Credenciais da API Inválidas";
        errorDescription = "💡 Solução: Verifique se sua API Key e Secret Key estão corretas na configuração da API. Se necessário, gere novas credenciais na Binance.";
      } else if (errorMessage.includes('Insufficient balance')) {
        errorTitle = "💰 Saldo Insuficiente";
        errorDescription = `💡 Solução: Deposite mais fundos na exchange ou reduza o valor da operação. Para testar, use o modo simulação primeiro.`;
      }

      toast({
        title: errorTitle,
        description: `${errorMessage} ${errorDescription}`,
        variant: "destructive",
        duration: 8000,
      });
      
    } finally {
      setExecutingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(opportunity.id);
        return newSet;
      });
    }
  };

  const toggleAutoTrading = () => {
    setIsAutoTrading(!isAutoTrading);
    toast({
      title: isAutoTrading ? "⏸️ Auto Trading Desativado" : "▶️ Auto Trading Ativado",
      description: isAutoTrading ? "Operações manuais apenas" : "Sistema irá executar automaticamente",
    });
  };

  // Carregar configurações de Trading do localStorage
  const loadTradingConfig = () => {
    try {
      const savedConfig = localStorage.getItem('trading_config');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setTradingConfig(config);
        // Sincronizar max_investment com maxTradeSize da configuração de Trading
        setSettings(prev => ({
          ...prev,
          max_investment: config.maxTradeSize || prev.max_investment
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de trading:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      loadTradingConfig();
      await Promise.all([
        loadOpportunities(),
        loadRecentTrades()
      ]);
    };
    
    loadData();
    loadPortfolioData();
    
    const interval = setInterval(() => {
      loadOpportunities();
      loadRecentTrades();
      loadPortfolioData();
    }, 30000);
    
    // Escutar mudanças nas configurações de trading
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'trading_config') {
        loadTradingConfig();
      }
    };
    
    const handlePortfolioUpdate = () => {
      loadRecentTrades();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('portfolioUpdate', handlePortfolioUpdate);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('portfolioUpdate', handlePortfolioUpdate);
    };
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-8 w-8 text-primary" />
            Arbitragem Cross-Over
          </h1>
          <p className="text-muted-foreground">Operações Cross-Over entre diferentes exchanges (OKX ↔ Binance)</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Controle de Modo de Trading */}
          <div className="flex items-center gap-4 px-4 py-2 bg-background border rounded-lg">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <Badge 
                variant={isRealMode ? "destructive" : "secondary"}
                className="text-xs font-medium"
              >
                {isRealMode ? "🔴 REAL ATIVO" : "🟡 MODO TESTE"}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={!isRealMode ? "font-medium" : ""}>Teste</span>
              <Switch 
                checked={isRealMode} 
                onCheckedChange={setIsRealMode}
                disabled={!hasCredentials}
              />
              <span className={isRealMode ? "font-medium" : ""}>Real</span>
            </div>
          </div>
          
          <Button variant="outline" onClick={loadOpportunities} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <div className="flex gap-2">
            <Button 
              onClick={() => executeAutomaticArbitrage(10)} 
              disabled={isLoading || !hasCredentials}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Play className="h-4 w-4 mr-1" />
              Auto $10
            </Button>
            
            <Button 
              onClick={() => executeAutomaticArbitrage(25)} 
              disabled={isLoading || !hasCredentials}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Play className="h-4 w-4 mr-1" />
              Auto $25
            </Button>
            
            <Button 
              onClick={() => executeAutomaticArbitrage(50)} 
              disabled={isLoading || !hasCredentials}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              <Play className="h-4 w-4 mr-1" />
              Auto $50
            </Button>
          </div>
        </div>
      </div>

      {/* Aviso sobre modo real */}
      {isRealMode && !hasCredentials && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
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

      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="w-2 h-12 bg-blue-500 rounded-full"></div>
            <div>
              <h3 className="font-medium text-blue-700">Cross-Over Arbitrage</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Este painel executa operações entre diferentes exchanges (OKX ↔ Binance). 
                Para operações internas da Binance (Spot ↔ Futures), use a aba "Oportunidades Binance" na página inicial.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Oportunidades</p>
                <p className="text-2xl font-bold">{opportunities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm text-muted-foreground">Potencial Total</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(opportunities.reduce((sum, op) => sum + op.potential, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <p className="font-semibold flex items-center gap-1">
                  {isAutoTrading ? (
                    <>
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      Automático
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      Manual
                    </>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-gray-500" />
              <div>
                <p className="text-sm text-muted-foreground">Risco</p>
                <Badge variant="outline" className={getRiskColor(settings.risk_tolerance)}>
                  {settings.risk_tolerance}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Meus Saldos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Meus Saldos
          </CardTitle>
          <CardDescription>
            Saldos disponíveis para execução das arbitragens
          </CardDescription>
        </CardHeader>
        <CardContent>
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

            {/* Carteira Web3 */}
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
        </CardContent>
      </Card>

      <Tabs defaultValue="opportunities" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="opportunities">Oportunidades Ativas</TabsTrigger>
          <TabsTrigger value="transfers">Transferências Inteligentes</TabsTrigger>
          <TabsTrigger value="pairs">Pares Disponíveis</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>
        
        <TabsContent value="opportunities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Oportunidades Cross-Over
              </CardTitle>
              <CardDescription>
                Operações entre Binance e Pionex - {opportunities.length} oportunidades encontradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {opportunities.length > 0 ? (
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
                    {opportunities.map((opportunity) => (
                      <TableRow key={opportunity.id}>
                        <TableCell className="font-medium">{opportunity.symbol}</TableCell>
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
                        <TableCell className="text-green-600 font-medium">
                          {formatCurrency(opportunity.potential)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className={getRiskColor(opportunity.risk_level)}
                          >
                            {opportunity.risk_level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            onClick={() => openExecutionModal(opportunity)}
                            disabled={executingIds.has(opportunity.id) || (opportunity.spread < settings.min_spread)}
                          >
                            {executingIds.has(opportunity.id) ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}</TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma oportunidade encontrada</p>
                  <p className="text-sm mt-1">As condições de mercado atuais não apresentam spreads suficientes</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-4">
          <SmartTransferDashboard />
        </TabsContent>

        <TabsContent value="pairs" className="space-y-4">
          <OKXInstrumentChecker />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <CredentialsValidator />
          
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Trading</CardTitle>
              <CardDescription>Configure os parâmetros para execução automática</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-trading">Trading Automático</Label>
                  <div className="text-sm text-muted-foreground">
                    Executar operações automaticamente quando critérios forem atendidos
                  </div>
                </div>
                <Switch
                  id="auto-trading"
                  checked={isAutoTrading}
                  onCheckedChange={toggleAutoTrading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-spread">Spread Mínimo (%)</Label>
                  <Input
                    id="min-spread"
                    type="number"
                    value={settings.min_spread}
                    onChange={(e) => setSettings(prev => ({...prev, min_spread: Number(e.target.value)}))}
                    step="0.1"
                    min="0.1"
      />
      
      {/* IP Helper Modal */}
      {showIPHelper && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Erro de IP Whitelist</h2>
              <Button variant="ghost" onClick={() => setShowIPHelper(false)}>✕</Button>
            </div>
            <IPWhitelistHelper />
          </div>
        </div>
      )}
    </div>

                <div className="space-y-2">
                  <Label htmlFor="max-investment">Investimento Máximo (USD)</Label>
                  <Input
                    id="max-investment"
                    type="number"
                    value={tradingConfig.maxTradeSize}
                    disabled
                    min="10"
                  />
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Este valor é controlado pelas "Configurações de Trading" na página inicial. 
                    <br />Valor atual: ${tradingConfig.maxTradeSize}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Operações</CardTitle>
              <CardDescription>Últimas 10 operações de arbitragem executadas</CardDescription>
            </CardHeader>
            <CardContent>
              {recentTrades.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Símbolo</TableHead>
                      <TableHead>Exchanges</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTrades.map((trade, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-sm">
                          {new Date(trade.executed_at).toLocaleString('pt-BR')}
                        </TableCell>
                        <TableCell className="font-medium">{trade.symbol}</TableCell>
                        <TableCell className="text-sm">
                          {trade.buy_exchange} → {trade.sell_exchange}
                        </TableCell>
                        <TableCell>{formatCurrency(trade.investment_amount)}</TableCell>
                        <TableCell className={trade.net_profit > 0 ? "text-green-600" : "text-red-600"}>
                          {formatCurrency(trade.net_profit)}
                        </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant={trade.status === 'completed' ? 'default' : 'destructive'}>
                                {trade.status}
                              </Badge>
                              {trade.status === 'failed' && trade.error_message && (
                                <>
                                  {/* Verificar se é erro de IP whitelist */}
                                  {(trade.error_message.includes('IP não autorizado') || 
                                    trade.error_message.includes('50110') || 
                                    trade.error_message.includes('whitelist') ||
                                    trade.error_message.includes('Sistema adaptativo: undefined') ||
                                    trade.error_message.includes('Sistema adaptativo OKX: undefined')) ? (
                                    <div className="text-xs text-blue-600 max-w-xs">
                                      <strong>🔧 Erro de Configuração:</strong> 
                                      <br />
                                      <span className="text-red-600">Problema de IP whitelist detectado</span>
                                      <br />
                                      <span className="text-blue-600 cursor-pointer underline" 
                                            onClick={() => setShowIPHelper(true)}>
                                        📋 Clique aqui para ver instruções de correção
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-red-600 max-w-xs">
                                      <strong>Erro:</strong> {trade.error_message}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                      </TableRow>
                    ))}</TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma operação encontrada</p>
                  <p className="text-sm mt-1">Execute algumas operações para ver o histórico aqui</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <ArbitrageExecutionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        opportunity={selectedOpportunity}
        onExecute={executeArbitrage}
        isExecuting={selectedOpportunity ? executingIds.has(selectedOpportunity.id) : false}
      />
      
      {/* IP Whitelist Helper Modal */}
      {showIPHelper && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Configuração de IP Whitelist</h2>
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
        </div>
      )}
    </div>
  );
}
