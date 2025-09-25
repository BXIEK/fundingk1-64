import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, CheckCircle, Clock, TrendingUp, Zap, Settings, RefreshCw } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface BalanceConfig {
  id: string
  user_id: string
  is_enabled: boolean
  min_usdt_threshold: number
  min_crypto_threshold: number
  target_usdt_buffer: number
  target_crypto_buffer: number
  rebalance_frequency_hours: number
  last_check_at: string
  created_at: string
  updated_at: string
}

interface RebalanceOperation {
  id: string
  from_exchange: string
  to_exchange: string
  symbol: string
  amount: number
  status: string
  priority: string
  reason: string
  trigger_type?: string
  created_at: string
  completed_at?: string
  error_message?: string
  mode?: string
  started_at?: string
  user_id?: string
  updated_at?: string
  withdrawal_tx_id?: string
  deposit_tx_id?: string
}

export default function SmartBalanceDashboard() {
  const [config, setConfig] = useState<BalanceConfig | null>(null)
  const [operations, setOperations] = useState<RebalanceOperation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [monitoringActive, setMonitoringActive] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadConfiguration()
    loadRecentOperations()
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => {
      loadRecentOperations()
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  const loadConfiguration = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('auto_balance_configs')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar configuração:', error)
        return
      }

      if (data) {
        setConfig(data)
        setMonitoringActive(data.is_enabled)
      } else {
        // Criar configuração padrão
        await createDefaultConfig(user.id)
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error)
    }
  }

  const createDefaultConfig = async (userId: string) => {
    const defaultConfig = {
      user_id: userId,
      is_enabled: true,
      min_usdt_threshold: 50,
      min_crypto_threshold: 0.001,
      target_usdt_buffer: 200,
      target_crypto_buffer: 0.005,
      rebalance_frequency_hours: 6
    }

    const { data, error } = await supabase
      .from('auto_balance_configs')
      .insert(defaultConfig)
      .select()
      .single()

    if (error) {
      console.error('Erro ao criar configuração padrão:', error)
      return
    }

    setConfig(data)
    setMonitoringActive(true)
  }

  const loadRecentOperations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('wallet_rebalance_operations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Erro ao carregar operações:', error)
        return
      }

      setOperations(data || [])
    } catch (error) {
      console.error('Erro ao carregar operações:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfiguration = async () => {
    if (!config) return

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('auto_balance_configs')
        .update({
          is_enabled: monitoringActive,
          min_usdt_threshold: config.min_usdt_threshold,
          min_crypto_threshold: config.min_crypto_threshold,
          target_usdt_buffer: config.target_usdt_buffer,
          target_crypto_buffer: config.target_crypto_buffer,
          rebalance_frequency_hours: config.rebalance_frequency_hours,
          updated_at: new Date().toISOString()
        })
        .eq('id', config.id)

      if (error) {
        throw error
      }

      toast({
        title: "Configuração salva",
        description: "As configurações de balanceamento foram atualizadas."
      })

      await loadConfiguration()
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const triggerManualCheck = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('balance-monitor', {
        body: { manual_trigger: true }
      })

      if (error) {
        throw error
      }

      toast({
        title: "Verificação iniciada",
        description: "O monitoramento manual foi iniciado. Os resultados aparecerão em breve."
      })

      // Recarregar operações após alguns segundos
      setTimeout(() => {
        loadRecentOperations()
      }, 3000)

    } catch (error) {
      console.error('Erro ao iniciar verificação manual:', error)
      toast({
        title: "Erro na verificação",
        description: "Não foi possível iniciar a verificação manual.",
        variant: "destructive"
      })
    }
  }

  const getStatusColor = (status: string): "default" | "destructive" | "secondary" | "outline" => {
    switch (status) {
      case 'completed': return 'default'
      case 'failed': return 'destructive' 
      case 'processing': return 'secondary'
      case 'pending': return 'outline'
      default: return 'outline'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'medium': return <Clock className="h-4 w-4 text-yellow-500" />
      case 'low': return <CheckCircle className="h-4 w-4 text-green-500" />
      default: return null
    }
  }

  const formatAmount = (amount: number, symbol: string) => {
    if (symbol === 'USDT') {
      return `$${amount.toFixed(2)}`
    }
    return `${amount.toFixed(6)} ${symbol}`
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
          <div className="h-48 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Monitoramento de Saldos</h2>
          <p className="text-muted-foreground">
            Sistema de monitoramento e alertas de saldos. Transferências devem ser feitas manualmente.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={triggerManualCheck} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar Agora
          </Button>
          <div className="flex items-center gap-2">
            <Switch 
              checked={monitoringActive}
              onCheckedChange={setMonitoringActive}
            />
            <span className="text-sm font-medium">
              {monitoringActive ? "Ativo" : "Inativo"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Status do Sistema */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Status do Sistema
            </CardTitle>
            <CardDescription>
              Monitoramento automático em tempo real
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Sistema</span>
              <Badge variant={monitoringActive ? "default" : "secondary"}>
                {monitoringActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            
            {config && (
              <>
                <div className="flex items-center justify-between">
                  <span>Última Verificação</span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(config.last_check_at).toLocaleString()}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Frequência</span>
                  <span className="text-sm">A cada {config.rebalance_frequency_hours}h</span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Operações Pendentes</span>
                    <span>{operations.filter(op => op.status === 'pending').length}</span>
                  </div>
                  <Progress 
                    value={operations.filter(op => op.status === 'completed').length / Math.max(operations.length, 1) * 100} 
                    className="h-2"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurações
            </CardTitle>
            <CardDescription>
              Limites para alertas de saldo baixo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usdt-threshold">Limite Mínimo USDT (Alerta)</Label>
                    <Input
                      id="usdt-threshold"
                      type="number"
                      value={config.min_usdt_threshold}
                      onChange={(e) => setConfig({...config, min_usdt_threshold: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crypto-threshold">Limite Mínimo Crypto (Alerta)</Label>
                    <Input
                      id="crypto-threshold"
                      type="number"
                      step="0.001"
                      value={config.min_crypto_threshold}
                      onChange={(e) => setConfig({...config, min_crypto_threshold: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="usdt-buffer">Saldo Recomendado USDT</Label>
                    <Input
                      id="usdt-buffer"
                      type="number"
                      value={config.target_usdt_buffer}
                      onChange={(e) => setConfig({...config, target_usdt_buffer: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crypto-buffer">Saldo Recomendado Crypto</Label>
                    <Input
                      id="crypto-buffer"
                      type="number"
                      step="0.001"
                      value={config.target_crypto_buffer}
                      onChange={(e) => setConfig({...config, target_crypto_buffer: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequência (horas)</Label>
                  <Input
                    id="frequency"
                    type="number"
                    value={config.rebalance_frequency_hours}
                    onChange={(e) => setConfig({...config, rebalance_frequency_hours: parseInt(e.target.value)})}
                  />
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <strong>Importante:</strong> Este sistema apenas monitora saldos e gera recomendações. 
                      Transferências entre exchanges devem ser feitas manualmente através das plataformas oficiais.
                    </div>
                  </div>
                </div>
                
                <Button 
                  onClick={saveConfiguration} 
                  disabled={isSaving}
                  className="w-full"
                >
                  {isSaving ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Operações Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recomendações de Transferência
          </CardTitle>
          <CardDescription>
            Alertas e recomendações baseadas nos limites configurados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {operations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma recomendação de transferência encontrada
            </div>
          ) : (
            <div className="space-y-4">
              {operations.map((operation) => (
                <div key={operation.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getPriorityIcon(operation.priority)}
                    <div>
                      <div className="font-medium">
                        {operation.from_exchange} → {operation.to_exchange}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatAmount(operation.amount, operation.symbol)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {operation.reason}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge variant={getStatusColor(operation.status)}>
                      {operation.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(operation.created_at).toLocaleString()}
                    </div>
                    {operation.error_message && (
                      <div className="text-xs text-red-500 mt-1 max-w-48 truncate">
                        {operation.error_message}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}