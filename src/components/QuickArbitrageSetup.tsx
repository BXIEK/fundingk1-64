import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/userUtils";
import { Activity, CheckCircle, Settings, TrendingUp, Shield, Zap } from "lucide-react";

export const QuickArbitrageSetup = () => {
  const { toast } = useToast();
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);

  useEffect(() => {
    checkCurrentConfig();
  }, []);

  const checkCurrentConfig = async () => {
    try {
      const userId = await getUserId();
      const { data } = await supabase
        .from('auto_cross_exchange_configs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (data) {
        setCurrentConfig(data);
        setIsActive(data.is_enabled);
      }
    } catch (error) {
      console.error('Erro ao verificar configuração:', error);
    }
  };

  const activateMonitoring = async () => {
    setIsConfiguring(true);
    try {
      const userId = await getUserId();
      
      // Configuração otimizada para USDT
      const config = {
        user_id: userId,
        is_enabled: true,
        min_spread_percentage: 0.5, // Spread mínimo de 0.5%
        max_investment_amount: 100, // Máximo $100 por operação
        min_profit_threshold: 1.0, // Mínimo $1 de lucro líquido
        max_concurrent_operations: 3, // Até 3 operações simultâneas
        auto_rebalance_enabled: true, // Auto-rebalance ativo
        exchanges_enabled: ['binance', 'okx'], // Binance e OKX
        symbols_filter: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'], // Principais pares
        risk_management_level: 'medium', // Risco moderado
        stop_loss_percentage: 2.0, // Stop loss 2%
        trading_mode: 'simulation' // Iniciar em simulação
      };

      const { error } = await supabase
        .from('auto_cross_exchange_configs')
        .upsert(config, { onConflict: 'user_id' });

      if (error) throw error;

      setIsActive(true);
      setCurrentConfig(config);

      toast({
        title: "✅ Monitoramento Ativado!",
        description: "Sistema configurado e buscando oportunidades de arbitragem 24/7",
      });

    } catch (error: any) {
      console.error('Erro ao ativar:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível ativar o monitoramento",
        variant: "destructive"
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const deactivateMonitoring = async () => {
    setIsConfiguring(true);
    try {
      const userId = await getUserId();
      
      const { error } = await supabase
        .from('auto_cross_exchange_configs')
        .update({ is_enabled: false })
        .eq('user_id', userId);

      if (error) throw error;

      setIsActive(false);

      toast({
        title: "Monitoramento Desativado",
        description: "Sistema pausado. Nenhuma operação será executada.",
      });

    } catch (error: any) {
      console.error('Erro ao desativar:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível desativar o monitoramento",
        variant: "destructive"
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Sistema de Monitoramento 24/7
        </CardTitle>
        <CardDescription>
          Configuração rápida com limites otimizados para suas carteiras USDT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Atual */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">Status do Sistema</span>
              {isActive ? (
                <Badge className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Ativo
                </Badge>
              ) : (
                <Badge variant="secondary">Inativo</Badge>
              )}
            </div>
            {isActive && (
              <p className="text-sm text-muted-foreground">
                Monitorando oportunidades de arbitragem em tempo real
              </p>
            )}
          </div>
        </div>

        {/* Configurações Aplicadas */}
        {currentConfig && isActive && (
          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Spread Mínimo
              </div>
              <p className="text-lg font-semibold">{currentConfig.min_spread_percentage}%</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Settings className="h-4 w-4" />
                Investimento Máx.
              </div>
              <p className="text-lg font-semibold">${currentConfig.max_investment_amount}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                Lucro Mínimo
              </div>
              <p className="text-lg font-semibold">${currentConfig.min_profit_threshold}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                Nível de Risco
              </div>
              <p className="text-lg font-semibold capitalize">{currentConfig.risk_management_level}</p>
            </div>
          </div>
        )}

        {/* Estratégia Ativa */}
        {isActive && (
          <div className="space-y-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 font-medium">
              <Zap className="h-4 w-4 text-blue-500" />
              Estratégia Cross-Exchange Ativa
            </div>
            <p className="text-sm text-muted-foreground">
              O sistema está monitorando spreads entre Binance e OKX para BTC, ETH, SOL e BNB.
              Operações serão executadas automaticamente quando:
            </p>
            <ul className="text-sm space-y-1 ml-6 list-disc text-muted-foreground">
              <li>Spread ≥ 0.5%</li>
              <li>Lucro líquido estimado ≥ $1</li>
              <li>Saldo USDT suficiente nas exchanges</li>
            </ul>
          </div>
        )}

        {/* Botão de Ação */}
        <div className="flex gap-3">
          {!isActive ? (
            <Button 
              onClick={activateMonitoring} 
              disabled={isConfiguring}
              className="flex-1"
              size="lg"
            >
              {isConfiguring ? "Configurando..." : "Ativar Monitoramento"}
            </Button>
          ) : (
            <Button 
              onClick={deactivateMonitoring} 
              disabled={isConfiguring}
              variant="destructive"
              className="flex-1"
              size="lg"
            >
              {isConfiguring ? "Processando..." : "Pausar Monitoramento"}
            </Button>
          )}
        </div>

        {/* Aviso */}
        <div className="text-xs text-muted-foreground p-3 bg-muted/30 rounded">
          <p className="font-medium mb-1">ℹ️ Sistema Inteligente</p>
          <p>
            O monitoramento é automático e seguro. As operações só serão executadas quando 
            todos os critérios forem atendidos. Você pode pausar a qualquer momento.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
