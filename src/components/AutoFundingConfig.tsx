import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/userUtils";
import { Bot, Clock, Target, DollarSign, Settings, Activity, AlertTriangle } from "lucide-react";

interface AutoFundingConfig {
  is_enabled: boolean;
  min_funding_rate: number;
  max_investment_amount: number;
  min_profit_threshold: number;
  symbols_filter: string[];
  auto_close_after_funding: boolean;
}

export const AutoFundingConfig = () => {
  const { toast } = useToast();
  const { isRealMode, hasCredentials } = useTradingMode();
  const [config, setConfig] = useState<AutoFundingConfig>({
    is_enabled: false,
    min_funding_rate: 0.01,
    max_investment_amount: 10,
    min_profit_threshold: 0.5,
    symbols_filter: ["BTCUSDT", "ETHUSDT", "BNBUSDT"],
    auto_close_after_funding: true
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load existing configuration on component mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      // 1) Tenta com usuário autenticado (RLS)
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { data, error } = await supabase
          .from('auto_funding_configs')
          .select('*')
          .eq('user_id', user.id)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (data) {
          setConfig({
            is_enabled: data.is_enabled,
            min_funding_rate: data.min_funding_rate,
            max_investment_amount: data.max_investment_per_trade,
            min_profit_threshold: data.min_profit_threshold,
            symbols_filter: data.symbols || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
            auto_close_after_funding: data.auto_close_after_funding
          });
          return;
        }
      }

      // 2) Fallback sem login: usar função edge (service role)
      const fallbackId = await getUserId();
      const { data: fnRes, error: fnErr } = await supabase.functions.invoke('auto-funding-config', {
        body: { action: 'get', user_id: fallbackId }
      });
      if (fnErr) throw fnErr;
      if (fnRes?.data) {
        const d = fnRes.data;
        setConfig({
          is_enabled: d.is_enabled,
          min_funding_rate: d.min_funding_rate,
          max_investment_amount: d.max_investment_per_trade,
          min_profit_threshold: d.min_profit_threshold,
          symbols_filter: d.symbols || ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
          auto_close_after_funding: d.auto_close_after_funding
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
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
          .from('auto_funding_configs')
          .upsert({
            user_id: user.id,
            is_enabled: config.is_enabled,
            min_funding_rate: config.min_funding_rate,
            max_investment_per_trade: config.max_investment_amount,
            min_profit_threshold: config.min_profit_threshold,
            symbols: config.symbols_filter,
            auto_close_after_funding: config.auto_close_after_funding
          }, {
            onConflict: 'user_id'
          });
        if (error) throw error;
      } else {
        // Fallback sem login: usar função edge (service role)
        const fallbackId = await getUserId();
        const { data: fnRes, error: fnErr } = await supabase.functions.invoke('auto-funding-config', {
          body: {
            action: 'save',
            user_id: fallbackId,
            is_enabled: config.is_enabled,
            min_funding_rate: config.min_funding_rate,
            max_investment_per_trade: config.max_investment_amount,
            min_profit_threshold: config.min_profit_threshold,
            symbols: config.symbols_filter,
            auto_close_after_funding: config.auto_close_after_funding
          }
        });
        if (fnErr || fnRes?.success === false) throw fnErr || new Error('Edge function save failed');
      }
      
      toast({
        title: "Configuração Salva",
        description: config.is_enabled 
          ? "Automação ativada com sucesso! O sistema irá executar operações automaticamente nos horários de funding."
          : "Automação desativada. Nenhuma operação automática será executada.",
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configuração de Automação de Funding
          </CardTitle>
          <CardDescription>
            Configure o sistema para executar automaticamente operações de arbitragem de funding 
            nos horários ideais (00:00, 08:00, 16:00 UTC) quando o spread compensar os custos.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status da Automação */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label className="text-base font-medium">Status da Automação</Label>
              <p className="text-sm text-muted-foreground">
                {config.is_enabled ? "Ativa - Execuções automáticas habilitadas" : "Inativa - Sem execuções automáticas"}
              </p>
            </div>
            <Switch 
              checked={config.is_enabled}
              onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, is_enabled: enabled }))}
            />
          </div>

          <Separator />

          {/* Configurações de Limite */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="min-funding-rate" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Taxa de Funding Mínima (%)
              </Label>
              <Input
                id="min-funding-rate"
                type="number"
                step="0.001"
                value={config.min_funding_rate}
                onChange={(e) => setConfig(prev => ({ ...prev, min_funding_rate: parseFloat(e.target.value) || 0 }))}
                placeholder="0.01"
              />
              <p className="text-xs text-muted-foreground">
                Só executar se a taxa de funding for maior que este valor
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
                Lucro Mínimo (USDT)
              </Label>
              <Input
                id="min-profit"
                type="number"
                step="0.1"
                value={config.min_profit_threshold}
                onChange={(e) => setConfig(prev => ({ ...prev, min_profit_threshold: parseFloat(e.target.value) || 0 }))}
                placeholder="0.5"
              />
              <p className="text-xs text-muted-foreground">
                Lucro mínimo esperado para executar a operação
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Fechar Após Funding
              </Label>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={config.auto_close_after_funding}
                  onCheckedChange={(enabled) => setConfig(prev => ({ ...prev, auto_close_after_funding: enabled }))}
                />
                <Label className="text-sm">Fechar posições automaticamente após receber funding</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Símbolos Permitidos */}
          <div className="space-y-2">
            <Label>Símbolos Permitidos</Label>
            <div className="flex flex-wrap gap-2">
              {config.symbols_filter.map((symbol) => (
                <Badge key={symbol} variant="secondary">{symbol}</Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Apenas operações com estes símbolos serão executadas automaticamente
            </p>
          </div>

          {/* Próximos Horários de Funding */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" />
              Próximos Horários de Funding (UTC)
            </h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 bg-background rounded">00:00</div>
              <div className="text-center p-2 bg-background rounded">08:00</div>
              <div className="text-center p-2 bg-background rounded">16:00</div>
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
                A automação irá executar operações reais com sua conta Binance. 
                Certifique-se de que os limites estão corretos.
              </p>
            </div>
          )}

          <Button 
            onClick={saveConfig} 
            disabled={isSaving}
            className="w-full"
          >
            {isSaving ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </CardContent>
      </Card>

      {/* Histórico de Execuções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Histórico de Execuções Automáticas
          </CardTitle>
          <CardDescription>
            Funcionalidade disponível após executar a migração do banco de dados
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="text-center p-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma execução automática ainda</p>
            <p className="text-sm">Execute a migração do banco de dados primeiro para ativar o histórico</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};