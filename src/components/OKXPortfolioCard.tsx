import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RefreshCw, Wallet, Send, DollarSign, TrendingUp, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/integrations/supabase/client"

interface OKXBalance {
  symbol: string
  balance: number
  locked_balance: number
  exchange: string
  price_usd: number
  value_usd: number
  updated_at: string
}

export default function OKXPortfolioCard() {
  const [balances, setBalances] = useState<OKXBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const { toast } = useToast()

  const fetchBalances = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Buscar dados reais do portfólio
      const { data, error } = await supabase.functions.invoke('get-portfolio', {
        body: {
          real_mode: true,
          user_id: user.id
        }
      })

      if (error) throw error

      if (data.success && data.data.portfolio) {
        // Filtrar apenas saldos da OKX
        const okxBalances = data.data.portfolio
          .filter((balance: any) => balance.exchange === 'OKX')
          .map((balance: any) => ({
            symbol: balance.symbol,
            balance: balance.balance,
            locked_balance: balance.locked_balance || 0,
            exchange: balance.exchange,
            price_usd: balance.price_usd,
            value_usd: balance.value_usd,
            updated_at: balance.updated_at
          }))

        setBalances(okxBalances)
      } else {
        throw new Error('Falha ao obter dados do portfólio')
      }
      setLastUpdate(new Date())
      
      toast({
        title: "Saldos OKX Atualizados",
        description: "Dados obtidos com sucesso"
      })
    } catch (error) {
      console.error('Erro ao buscar saldos OKX:', error)
      toast({
        title: "Erro",
        description: "Não foi possível obter os saldos da OKX",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
  }, [])

  const handleQuickTransfer = () => {
    toast({
      title: "Transferência Rápida",
      description: "Use a interface oficial da OKX para transferir $20 USDT para sua carteira Web3. Endereço da carteira copiado para área de transferência.",
    })
    
    // Simular cópia do endereço da carteira Web3 para área de transferência
    const web3Address = localStorage.getItem('web3_wallet_address') || 'Conecte sua carteira Web3 primeiro'
    navigator.clipboard.writeText(web3Address)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value)
  }

  const getTotalBalance = () => {
    return balances.reduce((total, balance) => total + balance.value_usd, 0)
  }

  const getVisibleBalances = () => {
    return balances.filter(balance => balance.balance > 0)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Carteira OKX
            </CardTitle>
            <CardDescription>
              {lastUpdate ? `Última atualização: ${lastUpdate.toLocaleString('pt-BR')}` : 'Carregando...'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBalances}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Resumo do Saldo */}
        <div className="text-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(getTotalBalance())}
          </div>
          <div className="text-sm text-gray-600">Saldo Total Estimado</div>
        </div>

        {/* Lista de Assets */}
        {getVisibleBalances().length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Valor USD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getVisibleBalances().map((balance, index) => (
                <TableRow key={`${balance.symbol}-${index}`}>
                  <TableCell>
                    <Badge variant="secondary">
                      {balance.symbol}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {balance.balance.toFixed(balance.symbol === 'BTC' ? 8 : 6)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(balance.value_usd)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum saldo encontrado
          </div>
        )}

        {/* Quick Transfer Button */}
        <div className="pt-4 border-t">
          <Button
            size="sm"
            variant="secondary"
            className="w-full"
            onClick={handleQuickTransfer}
          >
            <Send className="h-4 w-4 mr-1" />
            Enviar para Web3 ($20)
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}