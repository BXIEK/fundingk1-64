import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  DollarSign, 
  Activity, 
  AlertTriangle,
  Settings,
  ArrowUpDown,
  BarChart3,
  Zap,
  Clock,
  Target
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTradingMode } from '@/contexts/TradingModeContext';
import { getUserId } from '@/lib/userUtils';

interface FundingConfig {
  is_enabled: boolean;
  min_funding_rate: number;
  max_investment_per_trade: number;
  min_profit_threshold: number;
  symbols: string[];
  auto_close_after_funding: boolean;
}

interface CrossExchangeConfig {
  is_enabled: boolean;
  min_spread_percentage: number;
  max_investment_amount: number;
  min_profit_threshold: number;
  max_concurrent_operations: number;
  auto_rebalance_enabled: boolean;
  stop_loss_percentage: number;
  exchanges_enabled: string[];
  risk_management_level: string;
  symbols_filter: string[];
}

interface StrategyStats {
  total_investment_capacity: number;
  funding_allocation: number;
  cross_exchange_allocation: number;
  expected_daily_return: number;
  risk_score: number;
  active_symbols: string[];
  strategy_efficiency: number;
}

export const HybridStrategyDashboard: React.FC = () => {
  const { isRealMode } = useTradingMode();
  const [fundingConfig, setFundingConfig] = useState<FundingConfig | null>(null);
  const [crossExchangeConfig, setCrossExchangeConfig] = useState<CrossExchangeConfig | null>(null);
  const [strategyStats, setStrategyStats] = useState<StrategyStats | null>(null);
  const [recentTrades, setRecentTrades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Carregar configurações das estratégias
  const loadConfigurations = async () => {
    try {
      const userId = await getUserId();

      // Carregar configuração de Funding
      const { data: fundingData } = await supabase.functions.invoke('auto-funding-config', {
        body: { action: 'get', user_id: userId }
      });

      if (fundingData?.success && fundingData.data) {
        setFundingConfig(fundingData.data);
      }

      // Carregar configuração de Cross-Exchange
      const { data: crossExchangeData } = await supabase.functions.invoke('auto-cross-exchange-config', {
        body: { action: 'get', user_id: userId }
      });

      if (crossExchangeData?.success && crossExchangeData.data) {
        setCrossExchangeConfig(crossExchangeData.data);
      }

    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  // Calcular estatísticas da estratégia baseado nas configurações
  const calculateStrategyStats = () => {
    if (!fundingConfig && !crossExchangeConfig) {
      setStrategyStats(null);
      return;
    }

    const fundingInvestment = fundingConfig?.is_enabled ? (fundingConfig.max_investment_per_trade || 0) : 0;
    const crossExchangeInvestment = crossExchangeConfig?.is_enabled ? (crossExchangeConfig.max_investment_amount || 0) : 0;
    
    const totalInvestment = fundingInvestment + crossExchangeInvestment;
    
    // Calcular retorno esperado baseado nas configurações
    const fundingExpectedReturn = fundingConfig?.is_enabled ? 
      (fundingConfig.min_profit_threshold || 0) * 3 : 0; // 3x por dia (funding 8h)
    
    const crossExchangeExpectedReturn = crossExchangeConfig?.is_enabled ? 
      (crossExchangeConfig.min_profit_threshold || 0) * (crossExchangeConfig.max_concurrent_operations || 1) * 2 : 0; // 2x por dia
    
    const totalExpectedReturn = fundingExpectedReturn + crossExchangeExpectedReturn;

    // Calcular score de risco
    let riskScore = 50; // Base
    
    if (fundingConfig?.is_enabled) {
      riskScore += (fundingConfig.min_funding_rate || 0) * 1000; // Funding rate mais alto = mais risco
    }
    
    if (crossExchangeConfig?.is_enabled) {
      const riskLevel = crossExchangeConfig.risk_management_level;
      riskScore += riskLevel === 'high' ? 30 : riskLevel === 'medium' ? 15 : 5;
    }
    
    riskScore = Math.min(100, Math.max(0, riskScore));

    // Símbolos ativos combinados
    const fundingSymbols = fundingConfig?.is_enabled ? (fundingConfig.symbols || []) : [];
    const crossExchangeSymbols = crossExchangeConfig?.is_enabled ? (crossExchangeConfig.symbols_filter || []) : [];
    const activeSymbols = [...new Set([...fundingSymbols, ...crossExchangeSymbols])];

    // Eficiência da estratégia
    const strategiesActive = (fundingConfig?.is_enabled ? 1 : 0) + (crossExchangeConfig?.is_enabled ? 1 : 0);
    const efficiency = strategiesActive > 0 ? (activeSymbols.length * strategiesActive * 20) : 0;

    setStrategyStats({
      total_investment_capacity: totalInvestment,
      funding_allocation: fundingInvestment,
      cross_exchange_allocation: crossExchangeInvestment,
      expected_daily_return: totalExpectedReturn,
      risk_score: riskScore,
      active_symbols: activeSymbols,
      strategy_efficiency: Math.min(100, efficiency)
    });
  };

  // Carregar trades recentes
  const loadRecentTrades = async () => {
    try {
      const { data: trades } = await supabase
        .from('arbitrage_trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentTrades(trades || []);
    } catch (error) {
      console.error('Erro ao carregar trades:', error);
    }
  };

  // Configurar realtime para atualizações automáticas
  useEffect(() => {
    // Carregar dados iniciais
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        loadConfigurations(),
        loadRecentTrades()
      ]);
      setIsLoading(false);
    };

    loadData();

    // Configurar listeners para mudanças nas configurações
    const fundingChannel = supabase
      .channel('funding-config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_funding_configs'
        },
        () => {
          console.log('Configuração de Funding alterada, recarregando...');
          loadConfigurations();
        }
      )
      .subscribe();

    const crossExchangeChannel = supabase
      .channel('cross-exchange-config-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_cross_exchange_configs'
        },
        () => {
          console.log('Configuração de Cross-Exchange alterada, recarregando...');
          loadConfigurations();
        }
      )
      .subscribe();

    const tradesChannel = supabase
      .channel('trades-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arbitrage_trades'
        },
        () => {
          console.log('Novo trade detectado, recarregando...');
          loadRecentTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(fundingChannel);
      supabase.removeChannel(crossExchangeChannel);
      supabase.removeChannel(tradesChannel);
    };
  }, []);

  // Recalcular estatísticas quando configurações mudam
  useEffect(() => {
    calculateStrategyStats();
  }, [fundingConfig, crossExchangeConfig]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumo da Estratégia Híbrida */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Investimento Total</span>
            </div>
            <p className="text-2xl font-bold">
              ${strategyStats?.total_investment_capacity?.toFixed(2) || '0.00'}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              Funding: ${strategyStats?.funding_allocation?.toFixed(2) || '0.00'} | 
              Cross-Exchange: ${strategyStats?.cross_exchange_allocation?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-muted-foreground">Retorno Diário Esperado</span>
            </div>
            <p className="text-2xl font-bold">
              ${strategyStats?.expected_daily_return?.toFixed(2) || '0.00'}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              ROI: {strategyStats?.total_investment_capacity > 0 ? 
                ((strategyStats.expected_daily_return / strategyStats.total_investment_capacity) * 100).toFixed(2) : '0.00'}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-muted-foreground">Símbolos Ativos</span>
            </div>
            <p className="text-2xl font-bold">
              {strategyStats?.active_symbols?.length || 0}
            </p>
            <div className="text-xs text-muted-foreground mt-1">
              {strategyStats?.active_symbols?.slice(0, 3).join(', ') || 'Nenhum configurado'}
              {(strategyStats?.active_symbols?.length || 0) > 3 && '...'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-600" />
              <span className="text-sm text-muted-foreground">Score de Risco</span>
            </div>
            <p className="text-2xl font-bold">
              {strategyStats?.risk_score?.toFixed(0) || '0'}/100
            </p>
            <Progress 
              value={strategyStats?.risk_score || 0} 
              className="mt-1"
            />
            <div className="text-xs text-muted-foreground mt-1">
              {(strategyStats?.risk_score || 0) < 30 ? 'Baixo' : 
               (strategyStats?.risk_score || 0) < 70 ? 'Médio' : 'Alto'} risco
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status das Configurações */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5" />
              Funding Arbitrage (Spot ↔ Futures)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <Badge variant={fundingConfig?.is_enabled ? "default" : "secondary"}>
                {fundingConfig?.is_enabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            
            {fundingConfig?.is_enabled && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Investimento por Trade</span>
                    <p className="font-medium">${fundingConfig.max_investment_per_trade?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Min. Funding Rate</span>
                    <p className="font-medium">{(fundingConfig.min_funding_rate * 100)?.toFixed(3) || '0.000'}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lucro Mínimo</span>
                    <p className="font-medium">${fundingConfig.min_profit_threshold?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Símbolos</span>
                    <p className="font-medium">{fundingConfig.symbols?.length || 0}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Auto-Close após Funding:</span>
                  <Badge variant="outline">
                    {fundingConfig.auto_close_after_funding ? "Sim" : "Não"}
                  </Badge>
                </div>
              </>
            )}
            
            {!fundingConfig?.is_enabled && (
              <p className="text-sm text-muted-foreground">
                Configure na aba "Funding (Spot ↔ Futures)" para ativar esta estratégia
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Cross-Exchange Arbitrage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <Badge variant={crossExchangeConfig?.is_enabled ? "default" : "secondary"}>
                {crossExchangeConfig?.is_enabled ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            
            {crossExchangeConfig?.is_enabled && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Investimento Máximo</span>
                    <p className="font-medium">${crossExchangeConfig.max_investment_amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Spread Mínimo</span>
                    <p className="font-medium">{crossExchangeConfig.min_spread_percentage?.toFixed(2) || '0.00'}%</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Operações Simultâneas</span>
                    <p className="font-medium">{crossExchangeConfig.max_concurrent_operations || 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stop Loss</span>
                    <p className="font-medium">{crossExchangeConfig.stop_loss_percentage?.toFixed(1) || '0.0'}%</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Nível de Risco:</span>
                  <Badge 
                    variant="outline" 
                    className={
                      crossExchangeConfig.risk_management_level === 'high' ? 'text-red-600 border-red-200' :
                      crossExchangeConfig.risk_management_level === 'medium' ? 'text-yellow-600 border-yellow-200' :
                      'text-green-600 border-green-200'
                    }
                  >
                    {crossExchangeConfig.risk_management_level?.toUpperCase() || 'MEDIUM'}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Exchanges:</span>
                  <div className="flex gap-1">
                    {crossExchangeConfig.exchanges_enabled?.map((exchange, idx) => (
                      <Badge key={idx} variant="secondary">
                        {exchange}
                      </Badge>
                    )) || <span className="text-sm text-muted-foreground">Nenhuma</span>}
                  </div>
                </div>
              </>
            )}
            
            {!crossExchangeConfig?.is_enabled && (
              <p className="text-sm text-muted-foreground">
                Configure na aba "Multi-Exchange" para ativar esta estratégia
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Eficiência da Estratégia */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Eficiência da Estratégia Híbrida
          </CardTitle>
          <CardDescription>
            Análise da configuração atual e sugestões de otimização
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm">Eficiência Geral</span>
              <span className="text-sm font-medium">{strategyStats?.strategy_efficiency?.toFixed(0) || '0'}%</span>
            </div>
            <Progress value={strategyStats?.strategy_efficiency || 0} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                (fundingConfig?.is_enabled && crossExchangeConfig?.is_enabled) ? 'bg-green-500' :
                (fundingConfig?.is_enabled || crossExchangeConfig?.is_enabled) ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <span>
                {(fundingConfig?.is_enabled && crossExchangeConfig?.is_enabled) ? 'Estratégia Híbrida Completa' :
                 (fundingConfig?.is_enabled || crossExchangeConfig?.is_enabled) ? 'Estratégia Parcial' : 'Nenhuma Estratégia Ativa'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Operação 24/7: {isRealMode ? 'Real' : 'Simulação'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-gray-500" />
              <span>Modo: {isRealMode ? 'Real Ativo' : 'Teste'}</span>
            </div>
          </div>
          
          {(!fundingConfig?.is_enabled && !crossExchangeConfig?.is_enabled) && (
            <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Nenhuma estratégia configurada</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">
                Configure pelo menos uma estratégia (Funding ou Cross-Exchange) para começar a operar automaticamente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trades Recentes */}
      {recentTrades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Operações Recentes</CardTitle>
            <CardDescription>Últimas 10 operações executadas pela estratégia híbrida</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTrades.slice(0, 5).map((trade: any, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Badge variant={trade.status === 'completed' ? 'default' : 'secondary'}>
                      {trade.symbol}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {trade.buy_exchange} → {trade.sell_exchange}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      trade.net_profit > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${trade.net_profit?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {trade.trading_mode === 'real' ? 'Real' : 'Simulação'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};