import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserId } from '@/lib/userUtils';
import { 
  Bot, 
  Play, 
  Square, 
  TrendingUp, 
  DollarSign, 
  Zap,
  Activity,
  Clock,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function AutoArbitrageBot() {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Configurações
  const [config, setConfig] = useState({
    minSpread: 0.80,
    maxInvestmentPerTrade: 100,
    minProfitThreshold: 0.50,
    stopLossPercentage: 2.0,
    dailyLimit: 5000,
    checkIntervalSeconds: 30,
    reinvestProfits: true,
    compoundingEnabled: true
  });

  // Estado do bot
  const [botState, setBotState] = useState({
    totalProfit: 0,
    tradesExecuted: 0,
    dailyVolume: 0,
    lastExecutionTime: null,
    status: 'stopped'
  });

  // Logs recentes
  const [recentLogs, setRecentLogs] = useState<any[]>([]);

  useEffect(() => {
    loadBotStatus();
    loadRecentLogs();

    // Atualizar status a cada 10 segundos
    const interval = setInterval(() => {
      if (isRunning) {
        loadBotStatus();
        loadRecentLogs();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const loadBotStatus = async () => {
    try {
      const userId = await getUserId();
      const { data, error } = await supabase.functions.invoke('auto-arbitrage-bot', {
        body: { action: 'status', config: { userId } }
      });

      if (error) throw error;

      if (data.config) {
        setIsRunning(data.config.is_enabled);
      }

      if (data.state) {
        setBotState({
          totalProfit: data.state.total_profit || 0,
          tradesExecuted: data.state.trades_executed || 0,
          dailyVolume: data.state.daily_volume || 0,
          lastExecutionTime: data.state.last_execution_time,
          status: data.state.status || 'stopped'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar status:', error);
    }
  };

  const loadRecentLogs = async () => {
    try {
      const userId = await getUserId();
      const { data, error } = await supabase
        .from('bot_execution_logs' as any)
        .select('*')
        .eq('user_id', userId)
        .order('executed_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentLogs(data || []);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const startBot = async () => {
    setIsLoading(true);
    try {
      const userId = await getUserId();
      
      const { data, error } = await supabase.functions.invoke('auto-arbitrage-bot', {
        body: {
          action: 'start',
          config: {
            userId,
            isEnabled: true,
            ...config
          }
        }
      });

      if (error) throw error;

      if (data.success) {
        setIsRunning(true);
        toast({
          title: "🤖 Bot Iniciado!",
          description: `Buscando oportunidades a cada ${config.checkIntervalSeconds}s`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao iniciar bot",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopBot = async () => {
    setIsLoading(true);
    try {
      const userId = await getUserId();
      
      const { data, error } = await supabase.functions.invoke('auto-arbitrage-bot', {
        body: {
          action: 'stop',
          config: { userId }
        }
      });

      if (error) throw error;

      if (data.success) {
        setIsRunning(false);
        toast({
          title: "⏹️ Bot Parado",
          description: "Automação finalizada",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao parar bot",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusBadge = () => {
    if (isRunning) {
      return <Badge variant="default" className="bg-green-600"><Activity className="h-3 w-3 mr-1 animate-pulse" /> Ativo</Badge>;
    }
    return <Badge variant="secondary"><Square className="h-3 w-3 mr-1" /> Parado</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header com Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>Auto-Arbitrage Bot</CardTitle>
                <CardDescription>Automação contínua de arbitragem cross-exchange</CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <DollarSign className="h-5 w-5 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(botState.totalProfit)}
              </div>
              <div className="text-xs text-muted-foreground">Lucro Total</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <TrendingUp className="h-5 w-5 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold">{botState.tradesExecuted}</div>
              <div className="text-xs text-muted-foreground">Trades Executados</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <Zap className="h-5 w-5 mx-auto mb-2 text-yellow-600" />
              <div className="text-2xl font-bold">
                {formatCurrency(botState.dailyVolume)}
              </div>
              <div className="text-xs text-muted-foreground">Volume Hoje</div>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-2 text-purple-600" />
              <div className="text-sm font-semibold">
                {botState.lastExecutionTime 
                  ? new Date(botState.lastExecutionTime).toLocaleTimeString('pt-BR')
                  : '--:--'
                }
              </div>
              <div className="text-xs text-muted-foreground">Última Execução</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações do Bot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Spread Mínimo */}
          <div className="space-y-2">
            <Label>Spread Mínimo: {config.minSpread.toFixed(2)}%</Label>
            <Slider
              value={[config.minSpread]}
              onValueChange={([value]) => setConfig(prev => ({ ...prev, minSpread: value }))}
              min={0.50}
              max={2.00}
              step={0.10}
              disabled={isRunning}
            />
            <p className="text-xs text-muted-foreground">
              Somente executar trades com spread acima deste valor
            </p>
          </div>

          {/* Investimento por Trade */}
          <div className="space-y-2">
            <Label htmlFor="investment">Investimento por Trade (USDT)</Label>
            <Input
              id="investment"
              type="number"
              value={config.maxInvestmentPerTrade}
              onChange={(e) => setConfig(prev => ({ ...prev, maxInvestmentPerTrade: Number(e.target.value) }))}
              disabled={isRunning}
            />
          </div>

          {/* Lucro Mínimo */}
          <div className="space-y-2">
            <Label htmlFor="minProfit">Lucro Mínimo (USDT)</Label>
            <Input
              id="minProfit"
              type="number"
              step="0.10"
              value={config.minProfitThreshold}
              onChange={(e) => setConfig(prev => ({ ...prev, minProfitThreshold: Number(e.target.value) }))}
              disabled={isRunning}
            />
          </div>

          {/* Limite Diário */}
          <div className="space-y-2">
            <Label htmlFor="dailyLimit">Limite Diário de Volume (USDT)</Label>
            <Input
              id="dailyLimit"
              type="number"
              value={config.dailyLimit}
              onChange={(e) => setConfig(prev => ({ ...prev, dailyLimit: Number(e.target.value) }))}
              disabled={isRunning}
            />
          </div>

          {/* Intervalo de Verificação */}
          <div className="space-y-2">
            <Label htmlFor="interval">Intervalo de Verificação (segundos)</Label>
            <Input
              id="interval"
              type="number"
              value={config.checkIntervalSeconds}
              onChange={(e) => setConfig(prev => ({ ...prev, checkIntervalSeconds: Number(e.target.value) }))}
              disabled={isRunning}
            />
          </div>

          {/* Compounding */}
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <Label htmlFor="compounding">Compounding (Reinvestir Lucros)</Label>
              <p className="text-xs text-muted-foreground">
                Aumentar investimento automaticamente com 50% dos lucros
              </p>
            </div>
            <Switch
              id="compounding"
              checked={config.compoundingEnabled}
              onCheckedChange={(checked) => setConfig(prev => ({ 
                ...prev, 
                compoundingEnabled: checked,
                reinvestProfits: checked 
              }))}
              disabled={isRunning}
            />
          </div>

          {/* Controles */}
          <div className="flex gap-3 pt-4">
            {!isRunning ? (
              <Button 
                onClick={startBot} 
                disabled={isLoading}
                className="flex-1"
                size="lg"
              >
                <Play className="h-5 w-5 mr-2" />
                {isLoading ? 'Iniciando...' : 'Iniciar Bot'}
              </Button>
            ) : (
              <Button 
                onClick={stopBot} 
                disabled={isLoading}
                variant="destructive"
                className="flex-1"
                size="lg"
              >
                <Square className="h-5 w-5 mr-2" />
                {isLoading ? 'Parando...' : 'Parar Bot'}
              </Button>
            )}
            
            <Button 
              onClick={loadBotStatus} 
              variant="outline"
              size="lg"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Recentes */}
      <Card>
        <CardHeader>
          <CardTitle>Últimas Execuções</CardTitle>
        </CardHeader>
        <CardContent>
          {recentLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma execução ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-semibold">{log.symbol}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.executed_at).toLocaleString('pt-BR')}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-green-600">
                      +{formatCurrency(log.net_profit)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Spread: {log.spread.toFixed(2)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aviso */}
      {config.compoundingEnabled && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-yellow-900">Compounding Ativado</p>
                <p className="text-yellow-700">
                  O bot reinvestirá 50% dos lucros automaticamente, aumentando exponencialmente 
                  o investimento por trade conforme os lucros acumulam.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
