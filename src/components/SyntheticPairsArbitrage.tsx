import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, Clock, Zap, DollarSign, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { getUserId } from "@/lib/userUtils";
import ArbitrageExecutionModal from "./ArbitrageExecutionModal";

interface SyntheticPairOpportunity {
  id: string;
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread: number;
  potential: number;
  net_profit: number;
  risk_level: string;
  base_currency: string;
  quote_currency: string;
  transfer_fee: number;
  transfer_time: number;
  is_active: boolean;
  last_updated: string;
  created_at: string;
}

interface ArbitrageConfig {
  investmentAmount: number;
  maxSlippage: number;
  customFeeRate: number;
  stopLossPercentage: number;
  prioritizeSpeed: boolean;
}

const SyntheticPairsArbitrage = () => {
  const [opportunities, setOpportunities] = useState<SyntheticPairOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState<SyntheticPairOpportunity | null>(null);
  const { isRealMode } = useTradingMode();

  const loadOpportunities = async () => {
    setIsLoading(true);
    try {
      // Primeiro, detectar novas oportunidades
      const { data: detectionData, error: detectionError } = await supabase.functions.invoke(
        'detect-synthetic-pairs-arbitrage',
        {
          body: { action: 'detect' }
        }
      );

      if (detectionError) {
        console.error('Erro na detecção:', detectionError);
        toast.error('Erro ao detectar oportunidades');
      }

      // Em seguida, buscar oportunidades salvas no banco
      const { data: dbData, error: dbError } = await supabase
        .from('realtime_arbitrage_opportunities')
        .select('*')
        .eq('is_active', true)
        .order('potential', { ascending: false })
        .limit(20);

      if (dbError) {
        console.error('Erro ao buscar oportunidades:', dbError);
        toast.error('Erro ao carregar oportunidades');
        return;
      }

      // Mostrar todas as oportunidades (spot vs futures perpétuos)
      const allOpportunities = (dbData || []).filter(opp => 
        opp.symbol && opp.buy_price > 0 && opp.sell_price > 0
      );

      setOpportunities(allOpportunities);
      
      if (detectionData?.opportunities?.length > 0) {
        toast.success(`${detectionData.opportunities.length} oportunidades detectadas!`);
      } else if (allOpportunities.length > 0) {
        toast.success(`${allOpportunities.length} oportunidades ativas carregadas!`);
      }

    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const openExecutionModal = (opportunity: SyntheticPairOpportunity) => {
    setSelectedOpportunity(opportunity);
    setIsModalOpen(true);
  };

  const executeArbitrage = async (opportunity: SyntheticPairOpportunity, config?: ArbitrageConfig) => {
    setExecutingIds(prev => new Set(prev).add(opportunity.id));
    setIsModalOpen(false); // Fechar modal ao executar
    
    try {
      toast.info(`Executando arbitragem ${opportunity.symbol}...`);
      
      // Obter ID do usuário real baseado nas credenciais
      const userId = await getUserId();
      
      // Usar configuração personalizada ou valores padrão
      const executionConfig = config || {
        investmentAmount: 100, // USDT
        maxSlippage: 0.5,
        customFeeRate: 0.2, // Taxa realística para cross-exchange
        stopLossPercentage: 2.0,
        prioritizeSpeed: true
      };
      
      // Chamar edge function de execução cross-exchange
      const { data, error } = await supabase.functions.invoke('execute-cross-exchange-arbitrage', {
        body: {
          opportunityId: opportunity.id,
          userId: userId,
          symbol: opportunity.symbol,
          buyExchange: opportunity.buy_exchange,
          sellExchange: opportunity.sell_exchange,
          buyPrice: opportunity.buy_price,
          sellPrice: opportunity.sell_price,
          mode: isRealMode ? 'real' : 'simulation',
          // credenciais (se existirem no localStorage)
          binanceApiKey: (()=>{try{return JSON.parse(localStorage.getItem('binance_credentials')||'{}').apiKey}catch{return undefined}})(),
          binanceSecretKey: (()=>{try{return JSON.parse(localStorage.getItem('binance_credentials')||'{}').secretKey}catch{return undefined}})(),
          okxApiKey: (()=>{try{return JSON.parse(localStorage.getItem('okx_credentials')||'{}').apiKey}catch{return undefined}})(),
          okxSecretKey: (()=>{try{return JSON.parse(localStorage.getItem('okx_credentials')||'{}').secretKey}catch{return undefined}})(),
          okxPassphrase: (()=>{try{return JSON.parse(localStorage.getItem('okx_credentials')||'{}').passphrase}catch{return undefined}})(),
          config: executionConfig
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        toast.success(
          `Arbitragem ${opportunity.symbol} executada! Lucro: $${data.execution_details.net_profit}`,
          {
            description: `ROI: ${data.execution_details.roi_percentage}% | Tempo: ${data.execution_details.execution_time_ms}ms`
          }
        );
      } else {
        toast.error(`Falha na execução: ${data.execution_details.error_message}`);
      }
      
      // Remover oportunidade da lista após execução
      setOpportunities(prev => prev.filter(opp => opp.id !== opportunity.id));
      
    } catch (error) {
      console.error('Erro na execução:', error);
      toast.error('Erro ao executar arbitragem');
    } finally {
      setExecutingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(opportunity.id);
        return newSet;
      });
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  };

  useEffect(() => {
    loadOpportunities();
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadOpportunities, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Pares Correlacionais REAIS
          </h2>
          <p className="text-muted-foreground mt-1">
            Arbitragem com dados reais: Spot vs Futures + Funding Rates + Pares Sintéticos
          </p>
        </div>
        
        <Button 
          onClick={loadOpportunities} 
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          {isLoading ? 'Detectando...' : 'Buscar Dados Reais'}
        </Button>
      </div>

      {/* Real Data Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg text-primary flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Pares Correlacionais Disponíveis (Dados 100% Reais)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-3 bg-background rounded-lg border">
              <h4 className="font-semibold text-sm mb-2 text-green-600">📊 Spot vs Futures Perpétuos</h4>
              <div className="text-xs space-y-1">
                <div>• BTC, ETH, BNB, SOL, ADA, DOGE</div>
                <div>• XRP, AVAX, MATIC, LINK</div>
                <div>• Spreads e funding rates reais</div>
              </div>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <h4 className="font-semibold text-sm mb-2 text-blue-600">💰 Funding Rate Arbitrage</h4>
              <div className="text-xs space-y-1">
                <div>• Taxas de funding em tempo real</div>
                <div>• Oportunidades de 8h em 8h</div>
                <div>• Lucro sem risco de preço</div>
              </div>
            </div>
            <div className="p-3 bg-background rounded-lg border">
              <h4 className="font-semibold text-sm mb-2 text-purple-600">🔗 Pares Sintéticos</h4>
              <div className="text-xs space-y-1">
                <div>• ETH/BTC através de posições</div>
                <div>• BNB/BTC sintético</div>
                <div>• Combinações Long + Short</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opportunities List */}
      <div className="space-y-4">
        {opportunities.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma oportunidade ativa</h3>
              <p className="text-muted-foreground mb-4">
                Aguarde ou clique em "Detectar Oportunidades" para buscar novos pares sintéticos
              </p>
              <Button onClick={loadOpportunities} variant="outline">
                Buscar Agora
              </Button>
            </CardContent>
          </Card>
        )}

        {opportunities.map((opportunity, index) => (
          <Card key={opportunity.id} className="hover:shadow-lg transition-shadow border-l-4 border-l-primary">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <CardTitle className="text-lg">{opportunity.symbol}</CardTitle>
                    <CardDescription className="text-sm">
                      {opportunity.base_currency === 'ETH_BTC_SYNTH' ? 'ETH/BTC Sintético' :
                       opportunity.base_currency === 'BNB_BTC_SYNTH' ? 'BNB/BTC Sintético' :
                       `${opportunity.base_currency} Spot ↔ ${opportunity.base_currency} Perpétuo`}
                    </CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Badge className={getRiskColor(opportunity.risk_level)}>
                    {opportunity.risk_level.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="text-primary">
                    ROI: {((opportunity.net_profit / 100) * 100).toFixed(2)}%
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Prices */}
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-sm text-green-600 font-medium">
                    {opportunity.base_currency?.includes('SYNTH') ? 'Preço Base' : 'Preço Spot'}
                  </div>
                  <div className="text-lg font-bold text-green-700">
                    {formatCurrency(opportunity.buy_price)}
                  </div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-sm text-blue-600 font-medium">
                    {opportunity.base_currency?.includes('SYNTH') ? 'Preço Sintético' : 'Preço Futures'}
                  </div>
                  <div className="text-lg font-bold text-blue-700">
                    {formatCurrency(opportunity.sell_price)}
                  </div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Spread</div>
                  <div className="font-semibold text-primary">
                    {opportunity.spread.toFixed(3)}%
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Lucro Potencial</div>
                  <div className="font-semibold text-green-600">
                    {formatCurrency(opportunity.potential)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Lucro Líquido</div>
                  <div className="font-semibold text-green-600">
                    {formatCurrency(opportunity.net_profit)}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Taxa/Tempo</div>
                  <div className="font-semibold">
                    {opportunity.transfer_fee.toFixed(3)}% / {Math.round(opportunity.transfer_time/1000)}s
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <Button 
                  onClick={() => openExecutionModal(opportunity)}
                  disabled={executingIds.has(opportunity.id)}
                  className="w-full"
                  size="lg"
                >
                  {executingIds.has(opportunity.id) ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Executando...
                    </>
                  ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Executar Arbitragem Real
                  </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Execution Modal */}
      <ArbitrageExecutionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        opportunity={selectedOpportunity}
        onExecute={executeArbitrage}
        isExecuting={selectedOpportunity ? executingIds.has(selectedOpportunity.id) : false}
      />
    </div>
  );
};

export default SyntheticPairsArbitrage;