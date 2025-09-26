import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { getUserId } from "@/lib/userUtils";
import { 
  ArrowRightLeft, 
  Clock, 
  Target, 
  DollarSign, 
  Settings, 
  Activity, 
  AlertTriangle,
  TrendingUp,
  Shield,
  Zap
} from "lucide-react";

interface AutoCrossExchangeConfig {
  is_enabled: boolean;
  min_spread_percentage: number;
  max_investment_amount: number;
  min_profit_threshold: number;
  symbols_filter: string[];
  exchanges_enabled: string[];
  max_concurrent_operations: number;
  auto_rebalance_enabled: boolean;
  risk_management_level: string;
  stop_loss_percentage: number;
}

interface CrossExchangeExecution {
  id: string;
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  spread_percentage: number;
  estimated_profit: number;
  actual_profit: number | null;
  execution_status: string;
  executed_at: string;
  total_fees: number;
}

interface TransactionCost {
  exchange: string;
  symbol: string;
  withdrawal_fee_fixed: number;
  deposit_fee_fixed: number;
  trading_fee_maker: number;
  trading_fee_taker: number;
  processing_time_minutes: number;
}

export const AutoCrossExchangeConfig = () => {
  const { toast } = useToast();
  const { isRealMode, hasCredentials } = useTradingMode();
  const [config, setConfig] = useState<AutoCrossExchangeConfig>({
    is_enabled: false,
    min_spread_percentage: 0.5,
    max_investment_amount: 10,
    min_profit_threshold: 1.0,
    symbols_filter: ["BTCUSDT", "ETHUSDT", "BNBUSDT"],
    exchanges_enabled: ["binance", "pionex"],
    max_concurrent_operations: 2,
    auto_rebalance_enabled: true,
    risk_management_level: "medium",
    stop_loss_percentage: 2.0
  });
  const [executions, setExecutions] = useState<CrossExchangeExecution[]>([]);
  const [transactionCosts, setTransactionCosts] = useState<TransactionCost[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadConfig();
    loadExecutions();
    loadTransactionCosts();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      // 1) Tenta com usuário autenticado (RLS)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data, error } = await supabase
          .from('auto_cross_exchange_configs')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          setConfig({
            is_enabled: data.is_enabled,
            min_spread_percentage: data.min_spread_percentage,
            max_investment_amount: data.max_investment_amount,
            min_profit_threshold: data.min_profit_threshold,
            symbols_filter: data.symbols_filter,
            exchanges_enabled: data.exchanges_enabled,
            max_concurrent_operations: data.max_concurrent_operations,
            auto_rebalance_enabled: data.auto_rebalance_enabled,
            risk_management_level: data.risk_management_level,
            stop_loss_percentage: data.stop_loss_percentage
          });
          setIsLoading(false);
          return;
        }
      }

      // 2) Fallback sem login: usar função edge (service role)
      const fallbackId = await getUserId();
      const { data: fnRes, error: fnErr } = await supabase.functions.invoke('auto-cross-exchange-config', {
        body: { action: 'get', user_id: fallbackId }
      });
      if (fnErr) throw fnErr;
      if (fnRes?.data) {
        const d = fnRes.data;
        setConfig({
          is_enabled: d.is_enabled,
          min_spread_percentage: d.min_spread_percentage,
          max_investment_amount: d.max_investment_amount,
          min_profit_threshold: d.min_profit_threshold,
          symbols_filter: d.symbols_filter || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
          exchanges_enabled: d.exchanges_enabled || ['binance', 'pionex'],
          max_concurrent_operations: d.max_concurrent_operations,
          auto_rebalance_enabled: d.auto_rebalance_enabled,
          risk_management_level: d.risk_management_level,
          stop_loss_percentage: d.stop_loss_percentage
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadExecutions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('auto_cross_executions')
        .select(`
          *,
          auto_cross_exchange_configs!inner(user_id)
        `)
        .eq('auto_cross_exchange_configs.user_id', user.id)
        .order('executed_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setExecutions(data || []);
    } catch (error) {
      console.error('Erro ao carregar execuções:', error);
    }
  };

  const loadTransactionCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('exchange_transaction_costs')
        .select('*')
        .eq('is_active', true)
        .in('exchange', config.exchanges_enabled)
        .in('symbol', config.symbols_filter.map(s => s.replace('USDT', '')));

      if (error) throw error;

      setTransactionCosts(data || []);
    } catch (error) {
      console.error('Erro ao carregar custos:', error);
    }
  };

  const saveConfig = async () => {
    if (!hasCredentials && isRealMode) {
      toast({
        title: "Credenciais Necessárias",
        description: "Configure suas credenciais de API primeiro para usar automação no modo real",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user?.id) {
        // Upsert via RLS quando autenticado
        const { error } = await supabase
          .from('auto_cross_exchange_configs')
          .upsert({
            user_id: user.id,
            is_enabled: config.is_enabled,
            min_spread_percentage: config.min_spread_percentage,
            max_investment_amount: config.max_investment_amount,
            min_profit_threshold: config.min_profit_threshold,
            max_concurrent_operations: config.max_concurrent_operations,
            auto_rebalance_enabled: config.auto_rebalance_enabled,
            stop_loss_percentage: config.stop_loss_percentage,
            exchanges_enabled: config.exchanges_enabled,
            risk_management_level: config.risk_management_level,
            symbols_filter: config.symbols_filter
          }, {
            onConflict: 'user_id'
          });
        if (error) throw error;
      } else {
        // Fallback sem login: usar função edge (service role)
        const fallbackId = await getUserId();
        const { data: fnRes, error: fnErr } = await supabase.functions.invoke('auto-cross-exchange-config', {
          body: {
            action: 'save',
            user_id: fallbackId,
            is_enabled: config.is_enabled,
            min_spread_percentage: config.min_spread_percentage,
            max_investment_amount: config.max_investment_amount,
            min_profit_threshold: config.min_profit_threshold,
            max_concurrent_operations: config.max_concurrent_operations,
            auto_rebalance_enabled: config.auto_rebalance_enabled,
            stop_loss_percentage: config.stop_loss_percentage,
            exchanges_enabled: config.exchanges_enabled,
            risk_management_level: config.risk_management_level,
            symbols_filter: config.symbols_filter
          }
        });
        if (fnErr || fnRes?.success === false) throw fnErr || new Error('Edge function save failed');
      }
      
      toast({
        title: "Configuração Salva",
        description: config.is_enabled 
          ? "Automação cross-exchange ativada! O sistema irá executar operações automaticamente nos intervalos entre os horários de funding."
          : "Automação cross-exchange desativada. Nenhuma operação automática será executada.",
      });
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast({
        title: "Erro ao Salvar",
        description: "Não foi possível salvar a configuração. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const calculateEstimatedCosts = (symbol: string) => {
    const binanceCost = transactionCosts.find(c => c.exchange === 'binance' && symbol.includes(c.symbol));
    const pionexCost = transactionCosts.find(c => c.exchange === 'pionex' && symbol.includes(c.symbol));
    
    if (!binanceCost || !pionexCost) return 0;
    
    const totalFees = binanceCost.withdrawal_fee_fixed + pionexCost.deposit_fee_fixed + 
                     (binanceCost.trading_fee_taker + pionexCost.trading_fee_taker) * 10; // Assumindo $10 trade
    
    return totalFees;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Automação Cross-Exchange (Multi-Exchange)
          </CardTitle>
          <CardDescription>
            Sistema complementar que executa operações entre exchanges nos intervalos dos horários de funding (24/7), 
            maximizando oportunidades apenas quando spread &gt; custos totais.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status da Estratégia Híbrida */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Funding Arbitrage</span>
              </div>
              <p className="text-sm text-muted-foreground">00:00, 08:00, 16:00 UTC</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="font-medium">Cross-Exchange</span>
              </div>
              <p className="text-sm text-muted-foreground">Demais horários (a cada 15min)</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="font-medium">Cobertura Total</span>
              </div>
              <p className="text-sm text-muted-foreground">24/7 Otimizada</p>
            </div>
          </div>

          {/* Status da Automação Cross-Exchange */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-medium">Automação Cross-Exchange</Label>
              <p className="text-sm text-muted-foreground">
                {config.is_enabled ? "Ativa - Buscando oportunidades nos intervalos livres" : "Inativa - Sem execuções automáticas"}
              </p>
            </div>
            <Switch 
              checked={config.is_enabled}
              onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, is_enabled: enabled }))}
            />
          </div>

          <Separator />

          {/* Configurações de Limites */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-spread" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Spread Mínimo (%)
              </Label>
              <Input
                id="min-spread"
                type="number"
                step="0.1"
                value={config.min_spread_percentage}
                onChange={(e) => setConfig(prev => ({ ...prev, min_spread_percentage: parseFloat(e.target.value) || 0 }))}
                placeholder="0.5"
              />
              <p className="text-xs text-muted-foreground">
                Só executar se o spread for maior que este valor
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-investment" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Investimento Máximo (USDT)
              </Label>
              <Input
                id="max-investment"
                type="number"
                value={config.max_investment_amount}
                onChange={(e) => setConfig(prev => ({ ...prev, max_investment_amount: parseFloat(e.target.value) || 0 }))}
                placeholder="1000"
              />
              <p className="text-xs text-muted-foreground">
                Valor máximo a ser investido por operação
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-profit" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Lucro Líquido Mínimo (USDT)
              </Label>
              <Input
                id="min-profit"
                type="number"
                step="0.1"
                value={config.min_profit_threshold}
                onChange={(e) => setConfig(prev => ({ ...prev, min_profit_threshold: parseFloat(e.target.value) || 0 }))}
                placeholder="1.0"
              />
              <p className="text-xs text-muted-foreground">
                Lucro líquido mínimo após descontar todos os custos
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="concurrent-ops" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Operações Simultâneas
              </Label>
              <Select
                value={config.max_concurrent_operations.toString()}
                onValueChange={(value) => setConfig(prev => ({ ...prev, max_concurrent_operations: parseInt(value) }))}
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
          </div>

          {/* Configurações Avançadas */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Gerenciamento de Risco
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nível de Risco</Label>
                <Select
                  value={config.risk_management_level}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, risk_management_level: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservador</SelectItem>
                    <SelectItem value="medium">Moderado</SelectItem>
                    <SelectItem value="aggressive">Agressivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Stop Loss (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={config.stop_loss_percentage}
                  onChange={(e) => setConfig(prev => ({ ...prev, stop_loss_percentage: parseFloat(e.target.value) || 0 }))}
                  placeholder="2.0"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch 
                checked={config.auto_rebalance_enabled}
                onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, auto_rebalance_enabled: enabled }))}
              />
              <Label className="text-sm">Rebalanceamento automático de saldos entre exchanges</Label>
            </div>
          </div>

          {/* Custos de Transação Estimados */}
          <div className="space-y-4">
            <h4 className="font-medium">Custos de Transação Estimados por Símbolo</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {config.symbols_filter.map((symbol) => {
                const estimatedCost = calculateEstimatedCosts(symbol);
                return (
                  <div key={symbol} className="p-3 border rounded text-center">
                    <div className="font-medium">{symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      ~{formatCurrency(estimatedCost)} em custos
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warning para modo real */}
          {isRealMode && (
            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Modo Real Ativo</span>
              </div>
              <p className="text-sm text-yellow-600 mt-1">
                A automação irá executar operações reais cross-exchange com sua conta. 
                O sistema só executa quando spread supera custos totais.
              </p>
            </div>
          )}

          <Button 
            onClick={saveConfig} 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Salvando..." : "Salvar Configuração Cross-Exchange"}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de Execuções Cross-Exchange */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de Execuções Cross-Exchange
          </CardTitle>
          <CardDescription>
            Últimas 10 execuções automáticas entre exchanges
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="text-center p-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma execução cross-exchange ainda</p>
            <p className="text-sm">Execute a migração do banco de dados primeiro para ativar o histórico</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};