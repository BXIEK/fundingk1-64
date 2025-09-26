import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/userUtils";
import { Settings, Play, AlertTriangle, CheckCircle } from "lucide-react";

const AutoArbitrageConfig = () => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    user_id: '',
    is_enabled: false,
    min_spread_percentage: 0.5,
    max_investment_amount: 100,
    min_profit_threshold: 1.0,
    max_concurrent_operations: 3,
    auto_rebalance_enabled: true,
    exchanges_enabled: ['binance', 'okx'],
    symbols_filter: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
    risk_management_level: 'medium',
    stop_loss_percentage: 2.0
  });

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      const userId = await getUserId();
      setConfig(prev => ({ ...prev, user_id: userId }));

      const { data } = await supabase
        .from('auto_cross_exchange_configs')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setConfig(data);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('auto_cross_exchange_configs')
        .upsert(config);

      if (error) throw error;

      toast({
        title: "✅ Configuração Salva",
        description: "Sistema de arbitragem configurado!"
      });

    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar configuração",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Configuração de Arbitragem Automática
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Sistema Ativo</Label>
          <Switch
            checked={config.is_enabled}
            onCheckedChange={(checked) => 
              setConfig(prev => ({ ...prev, is_enabled: checked }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Spread Mínimo (%)</Label>
            <Input
              type="number"
              value={config.min_spread_percentage}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                min_spread_percentage: Number(e.target.value) 
              }))}
              step="0.1"
            />
          </div>
          <div className="space-y-2">
            <Label>Investimento Máximo (USD)</Label>
            <Input
              type="number"
              value={config.max_investment_amount}
              onChange={(e) => setConfig(prev => ({ 
                ...prev, 
                max_investment_amount: Number(e.target.value) 
              }))}
            />
          </div>
        </div>

        <Button onClick={saveConfiguration} disabled={saving} className="w-full">
          {saving ? "Salvando..." : "Salvar Configuração"}
        </Button>

        {config.is_enabled && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              ✅ Sistema ativo! Arbitragem automática habilitada.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AutoArbitrageConfig;