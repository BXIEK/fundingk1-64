import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  ArrowRightLeft, 
  Wallet, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Copy,
  ExternalLink,
  RefreshCw
} from "lucide-react"
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"
import { getUserId } from "@/lib/userUtils"

interface PlatformBalance {
  platform: string
  balances: Array<{
    symbol: string
    balance: number
    value_usd: number
    locked?: number
  }>
  total_value_usd: number
  connected: boolean
}

interface TransferOpportunity {
  symbol: string
  from_platform: string
  to_platform: string
  amount_available: number
  arbitrage_opportunity?: {
    spread_percentage: number
    potential_profit: number
    buy_exchange: string
    sell_exchange: string
  }
  transfer_cost: number
  net_benefit: number
  priority: 'high' | 'medium' | 'low'
  recommended: boolean
}

interface TransferAnalysis {
  symbol: string
  amount: number
  from_platform: string
  to_platform: string
  estimated_cost: number
  estimated_time_minutes: number
  success_probability: number
  warnings: string[]
  recommendations: string[]
}

export default function CrossPlatformTransferHub() {
  const [platforms, setPlatforms] = useState<PlatformBalance[]>([])
  const [opportunities, setOpportunities] = useState<TransferOpportunity[]>([])
  const [analysis, setAnalysis] = useState<TransferAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedTransfer, setSelectedTransfer] = useState({
    symbol: '',
    amount: 0,
    from: '',
    to: ''
  })
  
  const { wallet, connectWallet } = useWeb3Wallet()
  const { toast } = useToast()

  useEffect(() => {
    loadPlatformBalances()
    scanTransferOpportunities()
    
    const interval = setInterval(() => {
      scanTransferOpportunities()
    }, 30000)

    return () => clearInterval(interval)
  }, [wallet.isConnected])

  const loadPlatformBalances = async () => {
    try {
        const userId = await getUserId();
        const [portfolioResponse, arbitrageResponse] = await Promise.all([
          supabase.functions.invoke('get-portfolio', {
            body: { real_mode: true, user_id: userId }
          }),
        supabase.functions.invoke('detect-arbitrage-opportunities', {
          body: { type: "cross_exchange", trading_mode: "real" }
        })
      ])

      const platformData: PlatformBalance[] = []

      // Processar dados do portfolio
      if (portfolioResponse.data?.success) {
        const portfolio = portfolioResponse.data.data.portfolio

        // Agrupar por exchange
        const binanceBalances = portfolio.filter((item: any) => item.exchange === 'Binance')
        const okxBalances = portfolio.filter((item: any) => item.exchange === 'OKX')

        if (binanceBalances.length > 0) {
          platformData.push({
            platform: 'Binance',
            balances: binanceBalances.map((item: any) => ({
              symbol: item.symbol,
              balance: item.balance,
              value_usd: item.value_usd,
              locked: item.locked_balance
            })),
            total_value_usd: binanceBalances.reduce((sum: number, item: any) => sum + item.value_usd, 0),
            connected: true
          })
        }

        if (okxBalances.length > 0) {
          platformData.push({
            platform: 'OKX',
            balances: okxBalances.map((item: any) => ({
              symbol: item.symbol,
              balance: item.balance,
              value_usd: item.value_usd,
              locked: item.locked_balance
            })),
            total_value_usd: okxBalances.reduce((sum: number, item: any) => sum + item.value_usd, 0),
            connected: true
          })
        }
      }

      // Adicionar Web3 se conectado
      if (wallet.isConnected) {
        platformData.push({
          platform: 'Web3',
          balances: [
            {
              symbol: 'ETH',
              balance: parseFloat(wallet.balance || '0'),
              value_usd: parseFloat(wallet.balance || '0') * 3920 // Mock price
            }
          ],
          total_value_usd: parseFloat(wallet.balance || '0') * 3920,
          connected: true
        })
      } else {
        platformData.push({
          platform: 'Web3',
          balances: [],
          total_value_usd: 0,
          connected: false
        })
      }

      setPlatforms(platformData)

    } catch (error) {
      console.error('Erro ao carregar saldos das plataformas:', error)
    }
  }

  const scanTransferOpportunities = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-arbitrage-opportunities', {
        body: { type: "cross_exchange", trading_mode: "real" }
      })

      if (error) throw error

      if (data?.success && data.opportunities) {
        const transferOpps: TransferOpportunity[] = data.opportunities.map((opp: any) => {
          const transferCost = 0.001 * opp.buy_price // Mock 0.1% transfer cost
          const netBenefit = opp.potential_profit - transferCost
          
          return {
            symbol: opp.symbol,
            from_platform: opp.buy_exchange,
            to_platform: opp.sell_exchange,
            amount_available: 100 / opp.buy_price, // Mock available amount
            arbitrage_opportunity: {
              spread_percentage: opp.spread_percentage,
              potential_profit: opp.potential_profit,
              buy_exchange: opp.buy_exchange,
              sell_exchange: opp.sell_exchange
            },
            transfer_cost: transferCost,
            net_benefit: netBenefit,
            priority: netBenefit > 5 ? 'high' : netBenefit > 2 ? 'medium' : 'low',
            recommended: netBenefit > 1
          }
        })

        setOpportunities(transferOpps)
      }

    } catch (error) {
      console.error('Erro ao escanear oportunidades:', error)
    }
  }

  const analyzeTransfer = async () => {
    if (!selectedTransfer.symbol || !selectedTransfer.from || !selectedTransfer.to) {
      toast({
        title: "Dados Incompletos",
        description: "Preencha todos os campos para análise",
        variant: "destructive"
      })
      return
    }

    setLoading(true)
    
    try {
      // Simular análise de transferência
      await new Promise(resolve => setTimeout(resolve, 2000))

      const mockAnalysis: TransferAnalysis = {
        symbol: selectedTransfer.symbol,
        amount: selectedTransfer.amount,
        from_platform: selectedTransfer.from,
        to_platform: selectedTransfer.to,
        estimated_cost: selectedTransfer.amount * 0.002, // 0.2% cost
        estimated_time_minutes: selectedTransfer.to === 'Web3' ? 15 : 30,
        success_probability: 95,
        warnings: selectedTransfer.amount > 100 ? ['Valor alto - considere dividir em múltiplas transferências'] : [],
        recommendations: [
          'Verifique os endereços de depósito',
          'Considere horários de menor congestionamento de rede',
          'Mantenha algum saldo para taxas'
        ]
      }

      setAnalysis(mockAnalysis)

      toast({
        title: "Análise Concluída",
        description: `Transferência analisada com ${mockAnalysis.success_probability}% de probabilidade de sucesso`
      })

    } catch (error) {
      toast({
        title: "Erro na Análise",
        description: "Não foi possível analisar a transferência",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const executeTransfer = async (opportunity: TransferOpportunity) => {
    toast({
      title: "Redirecionando",
      description: `Abra a plataforma ${opportunity.from_platform} para executar a transferência de ${opportunity.symbol}`,
    })

    // Mock - em produção, redirecionaria para as plataformas específicas
    if (opportunity.from_platform === 'Web3') {
      // Abrir MetaMask ou interface de transferência Web3
    } else {
      // Abrir exchange específica
      const exchangeUrls = {
        'Binance': 'https://www.binance.com/en/my/wallet/account/main/withdrawal',
        'OKX': 'https://www.okx.com/balance/withdrawal'
      }
      
      const url = exchangeUrls[opportunity.from_platform as keyof typeof exchangeUrls]
      if (url) {
        window.open(url, '_blank')
      }
    }
  }

  const copyAddress = (platform: string) => {
    const addresses = {
      'Binance': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
      'OKX': '0x742d35Cc6634C0532925a3b8D15894D9cf3d7b0e',
      'Web3': wallet.address || 'Conecte sua carteira primeiro'
    }

    const address = addresses[platform as keyof typeof addresses]
    navigator.clipboard.writeText(address)
    
    toast({
      title: "Endereço Copiado",
      description: `Endereço ${platform} copiado para área de transferência`
    })
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500'
      case 'medium': return 'bg-yellow-500'
      case 'low': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transferências Inteligentes Cross-Platform</h2>
          <p className="text-muted-foreground">
            Sistema unificado de transferências entre exchanges e Web3 com análise de oportunidades
          </p>
        </div>
        <Button onClick={scanTransferOpportunities} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="transfer">Transferir</TabsTrigger>
          <TabsTrigger value="addresses">Endereços</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            {platforms.map((platform) => (
              <Card key={platform.platform}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      {platform.platform}
                    </span>
                    <Badge variant={platform.connected ? "default" : "secondary"}>
                      {platform.connected ? "Conectado" : "Desconectado"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {platform.connected ? (
                    <div className="space-y-3">
                      <div className="text-2xl font-bold text-center">
                        {formatCurrency(platform.total_value_usd)}
                      </div>
                      <div className="space-y-2">
                        {platform.balances.filter(b => b.balance > 0).map((balance, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{balance.symbol}</span>
                            <span>{balance.balance.toFixed(6)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      {platform.platform === 'Web3' ? (
                        <Button onClick={connectWallet} variant="outline">
                          Conectar Carteira
                        </Button>
                      ) : (
                        <p className="text-muted-foreground">Não conectado</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Oportunidades de Transferência
              </CardTitle>
              <CardDescription>
                Transferências recomendadas baseadas em arbitragem e otimização de saldos
              </CardDescription>
            </CardHeader>
            <CardContent>
              {opportunities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma oportunidade encontrada no momento
                </div>
              ) : (
                <div className="space-y-4">
                  {opportunities.filter(opp => opp.recommended).map((opportunity, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getPriorityColor(opportunity.priority)}`} />
                        <div>
                          <div className="font-medium">
                            {opportunity.symbol}: {opportunity.from_platform} → {opportunity.to_platform}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Spread: {opportunity.arbitrage_opportunity?.spread_percentage.toFixed(2)}% | 
                            Lucro Líquido: {formatCurrency(opportunity.net_benefit)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant={opportunity.priority === 'high' ? 'destructive' : 'default'}>
                          {opportunity.priority.toUpperCase()}
                        </Badge>
                        <Button 
                          size="sm" 
                          onClick={() => executeTransfer(opportunity)}
                        >
                          <ArrowRightLeft className="h-4 w-4 mr-1" />
                          Executar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfer" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Configurar Transferência</CardTitle>
                <CardDescription>
                  Analise custos e benefícios antes de transferir
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>De</Label>
                    <Select value={selectedTransfer.from} onValueChange={(value) => 
                      setSelectedTransfer(prev => ({...prev, from: value}))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Plataforma origem" />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.filter(p => p.connected).map(platform => (
                          <SelectItem key={platform.platform} value={platform.platform}>
                            {platform.platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Para</Label>
                    <Select value={selectedTransfer.to} onValueChange={(value) => 
                      setSelectedTransfer(prev => ({...prev, to: value}))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Plataforma destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.filter(p => p.connected && p.platform !== selectedTransfer.from).map(platform => (
                          <SelectItem key={platform.platform} value={platform.platform}>
                            {platform.platform}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Token</Label>
                    <Select value={selectedTransfer.symbol} onValueChange={(value) => 
                      setSelectedTransfer(prev => ({...prev, symbol: value}))
                    }>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar token" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                        <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                        <SelectItem value="BNB">Binance Coin (BNB)</SelectItem>
                        <SelectItem value="USDT">Tether (USDT)</SelectItem>
                        <SelectItem value="ADA">Cardano (ADA)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      step="0.000001"
                      placeholder="0.0"
                      value={selectedTransfer.amount || ''}
                      onChange={(e) => setSelectedTransfer(prev => ({...prev, amount: parseFloat(e.target.value) || 0}))}
                    />
                  </div>
                </div>

                <Button 
                  onClick={analyzeTransfer} 
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Analisar Transferência
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {analysis && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Resultado da Análise
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Custo Estimado:</span>
                      <div className="font-medium">{formatCurrency(analysis.estimated_cost)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tempo Estimado:</span>
                      <div className="font-medium">{analysis.estimated_time_minutes} min</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Probabilidade de Sucesso</span>
                      <span className="font-medium">{analysis.success_probability}%</span>
                    </div>
                    <Progress value={analysis.success_probability} className="h-2" />
                  </div>

                  {analysis.warnings.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        {analysis.warnings.join(', ')}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <span className="text-sm font-medium">Recomendações:</span>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {analysis.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {platforms.filter(p => p.connected).map((platform) => (
              <Card key={platform.platform}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Endereços {platform.platform}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {platform.platform === 'Web3' && wallet.address ? (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <div className="font-medium">Ethereum</div>
                          <code className="text-xs text-muted-foreground">
                            {wallet.address.substring(0, 20)}...
                          </code>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => copyAddress('Web3')}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : platform.platform !== 'Web3' ? (
                      <>
                        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <div className="font-medium">Depósito {platform.platform}</div>
                            <div className="text-xs text-muted-foreground">Endereço para receber fundos</div>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => copyAddress(platform.platform)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => window.open(
                            platform.platform === 'Binance' 
                              ? 'https://www.binance.com/en/my/wallet/account/main/deposit' 
                              : 'https://www.okx.com/balance/deposit', 
                            '_blank'
                          )}
                          className="w-full"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Abrir {platform.platform}
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        Conecte sua carteira Web3 para ver endereços
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}