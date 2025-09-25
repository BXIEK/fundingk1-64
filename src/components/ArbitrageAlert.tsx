import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, TrendingUp, Zap, Settings, DollarSign } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { type ArbitrageOpportunity } from '@/types/arbitrage';

interface ArbitrageAlertProps {
  opportunities: ArbitrageOpportunity[];
  onExecuteArbitrage: (opportunity: ArbitrageOpportunity) => Promise<void>;
}

interface AlertSettings {
  enabled: boolean;
  minSpreadPercentage: number;
  minVolume: number;
  symbols: string[];
  soundEnabled: boolean;
  autoExecute: boolean;
}

export const ArbitrageAlert = ({ opportunities, onExecuteArbitrage }: ArbitrageAlertProps) => {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AlertSettings>({
    enabled: false,
    minSpreadPercentage: 0.5,
    minVolume: 10000,
    symbols: ['BTC/USDT', 'ETH/USDT'],
    soundEnabled: true,
    autoExecute: false
  });
  const [alertHistory, setAlertHistory] = useState<ArbitrageOpportunity[]>([]);
  const [isExecuting, setIsExecuting] = useState<string | null>(null);

  // Filtrar oportunidades que atendem aos critérios
  const filteredOpportunities = opportunities.filter(opp => {
    if (!settings.enabled) return false;
    
    const meetsSpread = Math.abs(opp.spreadPercentage) >= settings.minSpreadPercentage;
    const meetsVolume = opp.liquidityBuy >= settings.minVolume; // Usar liquidityBuy ao invés de volume24h
    const meetsSymbol = settings.symbols.length === 0 || settings.symbols.includes(opp.symbol);
    
    return meetsSpread && meetsVolume && meetsSymbol;
  });

  // Detectar novas oportunidades e disparar alertas
  useEffect(() => {
    if (!settings.enabled) return;

    const newOpportunities = filteredOpportunities.filter(newOpp => 
      !alertHistory.some(oldOpp => 
        oldOpp.symbol === newOpp.symbol && 
        Math.abs(new Date(oldOpp.expiresAt).getTime() - new Date(newOpp.expiresAt).getTime()) < 60000 // 1 minuto
      )
    );

    if (newOpportunities.length > 0) {
      // Adicionar ao histórico
      setAlertHistory(prev => [...prev, ...newOpportunities].slice(-50)); // Manter apenas os últimos 50

      // Disparar alertas
      newOpportunities.forEach(opp => {
        toast({
          title: "🚨 Oportunidade de Arbitragem Detectada!",
          description: `${opp.symbol}: Spread de ${opp.spreadPercentage.toFixed(3)}% - Lucro potencial: $${opp.netProfitUsd.toFixed(2)}`,
          duration: 8000,
        });

        // Som do alerta (se habilitado)
        if (settings.soundEnabled) {
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBz2Y4fPGdywFLIPL89iJNwgZZ7vu55lPEQxPqOTyuOOeEaGq2/LDciYCGYXR8tiJNgkYabvu5+KdHaGo2/LCcyMCGojJ9diINgITbrrv66hUEw5OqOTyuOObEY3O6d6QOwsZZ7zn56hSDAkPkuP3tWIYBC2L0fHacycCC4n');
            audio.volume = 0.3;
            audio.play().catch(console.error);
          } catch (error) {
            console.error('Erro ao reproduzir som de alerta:', error);
          }
        }

        // Auto-execução (se habilitada)
        if (settings.autoExecute && Math.abs(opp.spreadPercentage) >= 1.0) {
          handleAutoExecute(opp);
        }
      });
    }
  }, [filteredOpportunities, settings.enabled, settings.soundEnabled, settings.autoExecute]);

  const handleAutoExecute = async (opportunity: ArbitrageOpportunity) => {
    try {
      setIsExecuting(opportunity.symbol);
      await onExecuteArbitrage(opportunity);
      
      toast({
        title: "✅ Arbitragem Auto-Executada",
        description: `${opportunity.symbol}: Ordem executada automaticamente`,
      });
    } catch (error) {
      toast({
        title: "❌ Erro na Auto-Execução",
        description: `Falha ao executar automaticamente ${opportunity.symbol}`,
        variant: "destructive",
      });
    } finally {
      setIsExecuting(null);
    }
  };

  const handleManualExecute = async (opportunity: ArbitrageOpportunity) => {
    try {
      setIsExecuting(opportunity.symbol);
      await onExecuteArbitrage(opportunity);
    } finally {
      setIsExecuting(null);
    }
  };

  const updateSettings = (key: keyof AlertSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const addSymbol = (symbol: string) => {
    if (symbol && !settings.symbols.includes(symbol)) {
      updateSettings('symbols', [...settings.symbols, symbol]);
    }
  };

  const removeSymbol = (symbol: string) => {
    updateSettings('symbols', settings.symbols.filter(s => s !== symbol));
  };

  return (
    <div className="space-y-6">
      {/* Configurações de Alerta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações de Alerta
          </CardTitle>
          <CardDescription>
            Configure os critérios para receber alertas de oportunidades de arbitragem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="alerts-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => updateSettings('enabled', checked)}
            />
            <Label htmlFor="alerts-enabled">Ativar alertas de arbitragem</Label>
          </div>

          {settings.enabled && (
            <div className="space-y-4 pl-6 border-l-2 border-muted">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="min-spread">Spread Mínimo (%)</Label>
                  <Input
                    id="min-spread"
                    type="number"
                    step="0.1"
                    value={settings.minSpreadPercentage}
                    onChange={(e) => updateSettings('minSpreadPercentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="min-volume">Volume Mínimo (USD)</Label>
                  <Input
                    id="min-volume"
                    type="number"
                    value={settings.minVolume}
                    onChange={(e) => updateSettings('minVolume', parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Símbolos Monitorados</Label>
                <div className="flex flex-wrap gap-2">
                  {settings.symbols.map(symbol => (
                    <Badge
                      key={symbol}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeSymbol(symbol)}
                    >
                      {symbol} ×
                    </Badge>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const symbol = prompt('Digite o símbolo (ex: SOL/USDT):');
                      if (symbol) addSymbol(symbol.toUpperCase());
                    }}
                  >
                    + Adicionar
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="sound-enabled"
                    checked={settings.soundEnabled}
                    onCheckedChange={(checked) => updateSettings('soundEnabled', checked)}
                  />
                  <Label htmlFor="sound-enabled">Som de alerta</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-execute"
                    checked={settings.autoExecute}
                    onCheckedChange={(checked) => updateSettings('autoExecute', checked)}
                  />
                  <Label htmlFor="auto-execute">Auto-execução (&gt;1%)</Label>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Oportunidades Ativas */}
      {settings.enabled && filteredOpportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning" />
              Oportunidades Detectadas ({filteredOpportunities.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredOpportunities.map((opportunity, index) => (
                <Alert key={`${opportunity.symbol}-${index}`} className="border-warning/50">
                  <TrendingUp className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <strong>{opportunity.symbol}</strong> - Spread: {' '}
                        <span className="text-warning font-bold">
                          {opportunity.spreadPercentage.toFixed(3)}%
                        </span>
                        {' '} | Lucro: {' '}
                        <span className="text-success font-bold">
                          ${opportunity.netProfitUsd.toFixed(2)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleManualExecute(opportunity)}
                        disabled={isExecuting === opportunity.symbol}
                        className="ml-4"
                      >
                        {isExecuting === opportunity.symbol ? (
                          <>
                            <Zap className="mr-1 h-3 w-3 animate-pulse" />
                            Executando...
                          </>
                        ) : (
                          <>
                            <DollarSign className="mr-1 h-3 w-3" />
                            Executar
                          </>
                        )}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status dos Alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Status dos Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${settings.enabled ? 'bg-success' : 'bg-muted'}`} />
              <span>{settings.enabled ? 'Ativo' : 'Inativo'}</span>
            </div>
            <div>
              Oportunidades detectadas: <strong>{filteredOpportunities.length}</strong>
            </div>
            <div>
              Histórico: <strong>{alertHistory.length}</strong>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};