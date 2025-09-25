import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wallet, RefreshCw, ExternalLink, AlertTriangle, CheckCircle, Send, Copy, ArrowUpDown } from "lucide-react"
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet"
import { useWalletBalance } from "@/hooks/useWalletBalance"
import { useToast } from "@/hooks/use-toast"

const NETWORK_INFO = {
  1: { name: 'Ethereum', symbol: 'ETH', color: 'bg-blue-500', explorer: 'https://etherscan.io' },
  56: { name: 'BSC', symbol: 'BNB', color: 'bg-yellow-500', explorer: 'https://bscscan.com' },
  137: { name: 'Polygon', symbol: 'MATIC', color: 'bg-purple-500', explorer: 'https://polygonscan.com' },
  42161: { name: 'Arbitrum', symbol: 'ETH', color: 'bg-cyan-500', explorer: 'https://arbiscan.io' }
}

interface TransferModalProps {
  onTransfer: (to: string, amount: string, tokenAddress?: string, network?: string) => Promise<void>
  currentNetwork: number | null
  walletAddress: string | null
}

function TransferModal({ onTransfer, currentNetwork, walletAddress }: TransferModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [tokenType, setTokenType] = useState('native')
  const [targetNetwork, setTargetNetwork] = useState(currentNetwork?.toString() || '1')
  const [isTransferring, setIsTransferring] = useState(false)

  const handleTransfer = async () => {
    if (!recipient || !amount) return

    setIsTransferring(true)
    try {
      await onTransfer(recipient, amount, tokenType === 'native' ? undefined : tokenType, targetNetwork)
      setIsOpen(false)
      setRecipient('')
      setAmount('')
    } catch (error) {
      console.error('Erro na transferência:', error)
    } finally {
      setIsTransferring(false)
    }
  }

  // Sugestões de endereços de depósito de exchanges
  const exchangeAddresses = [
    { name: 'Binance', address: '0x28C6c06298d514Db089934071355E5743bf21d60' },
    { name: 'Coinbase', address: '0xA090e606E30bD747d4E6245a1517EbE430F0057e' },
    { name: 'Kraken', address: '0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2' },
  ]

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="h-3 w-3 mr-2" />
          Enviar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Fundos</DialogTitle>
          <DialogDescription>
            Envie tokens para exchanges ou outros endereços
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Endereço Destinatário</Label>
            <div className="space-y-2">
              <Input
                id="recipient"
                placeholder="0x..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
              
              {/* Endereços sugeridos */}
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Sugestões de Exchanges:</span>
                <div className="grid gap-1 mt-1">
                  {exchangeAddresses.map((exchange) => (
                    <button
                      key={exchange.name}
                      type="button"
                      onClick={() => setRecipient(exchange.address)}
                      className="text-left hover:text-primary transition-colors"
                    >
                      {exchange.name}: {exchange.address.substring(0, 8)}...
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Quantidade</Label>
              <Input
                id="amount"
                type="number"
                step="0.000001"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="token">Token</Label>
              <Select value={tokenType} onValueChange={setTokenType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">
                    {currentNetwork === 1 ? 'ETH' : 
                     currentNetwork === 56 ? 'BNB' :
                     currentNetwork === 137 ? 'MATIC' : 'ETH'} (Nativo)
                  </SelectItem>
                  <SelectItem value="0xdAC17F958D2ee523a2206206994597C13D831ec7">USDT</SelectItem>
                  <SelectItem value="0xA0b86a33E6441605cAb5a2cfB8F5B68d3d7127b7">USDC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <strong>Atenção:</strong> Verifique o endereço e rede. Transferências incorretas podem resultar em perda de fundos.
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleTransfer} 
            disabled={!recipient || !amount || isTransferring}
          >
            {isTransferring ? "Enviando..." : "Confirmar Transferência"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function Web3PortfolioCard() {
  const { wallet, isConnecting, connectWallet, isMetaMaskInstalled, switchNetwork, sendTransaction, updateBalance } = useWeb3Wallet()
  const { balances, isLoading, refreshBalances, getTotalUSDTBalance } = useWalletBalance(wallet.address || undefined)
  const { toast } = useToast()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  }

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  const copyAddress = async () => {
    if (wallet.address) {
      await navigator.clipboard.writeText(wallet.address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
      toast({
        title: "Endereço copiado",
        description: "Endereço da carteira copiado"
      })
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      refreshBalances()
      updateBalance()
      toast({
        title: "Saldos atualizados",
        description: "Dados Web3 atualizados com sucesso"
      })
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar os saldos",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleTransfer = async (to: string, amount: string, tokenAddress?: string, network?: string) => {
    try {
      // Se network diferente da atual, sugerir troca de rede primeiro
      if (network && parseInt(network) !== wallet.chainId) {
        const switched = await switchNetwork(parseInt(network))
        if (!switched) {
          toast({
            title: "Erro de rede",
            description: "Não foi possível trocar para a rede selecionada",
            variant: "destructive"
          })
          return
        }
      }

      const tx = await sendTransaction(to, amount, tokenAddress)
      
      toast({
        title: "Transferência iniciada",
        description: `Hash: ${tx.hash.substring(0, 10)}...`,
      })

      // Aguardar confirmação
      await tx.wait()
      
      toast({
        title: "Transferência confirmada",
        description: "Fundos transferidos com sucesso"
      })

      // Atualizar saldos
      handleRefresh()
      
    } catch (error: any) {
      toast({
        title: "Erro na transferência",
        description: error.message,
        variant: "destructive"
      })
      throw error
    }
  }

  const openExplorer = (chainId: number, address: string) => {
    const network = NETWORK_INFO[chainId as keyof typeof NETWORK_INFO]
    if (network) {
      window.open(`${network.explorer}/address/${address}`, '_blank')
    }
  }

  const getNetworkBadge = (chainId: number) => {
    const network = NETWORK_INFO[chainId as keyof typeof NETWORK_INFO]
    if (!network) return <Badge variant="destructive">Desconhecida</Badge>
    
    return (
      <Badge className={`${network.color} text-white text-xs`}>
        {network.name}
      </Badge>
    )
  }

  // Não mostrar o card se MetaMask não estiver instalado
  if (!isMetaMaskInstalled()) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-500" />
          Carteiras Web3
        </CardTitle>
        <CardDescription>
          Controle total dos seus fundos através do MetaMask
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!wallet.isConnected ? (
          <div className="text-center py-6">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-medium mb-2">Conectar Carteira</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Conecte sua carteira MetaMask para gerenciar saldos
            </p>
            <Button 
              onClick={connectWallet} 
              disabled={isConnecting}
              size="sm"
            >
              {isConnecting ? "Conectando..." : "Conectar MetaMask"}
            </Button>
          </div>
        ) : (
          <div className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Asset</TableHead>
                  <TableHead className="w-[80px]">Rede</TableHead>
                  <TableHead className="text-right w-[100px]">Saldo</TableHead>
                  <TableHead className="text-right w-[100px]">Valor USD</TableHead>
                  <TableHead className="text-center w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Saldo Nativo */}
                <TableRow>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm font-mono">
                        {NETWORK_INFO[wallet.chainId! as keyof typeof NETWORK_INFO]?.symbol || 'ETH'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {wallet.chainId && getNetworkBadge(wallet.chainId)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {parseFloat(wallet.balance || '0').toFixed(6)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">
                    -
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => wallet.chainId && openExplorer(wallet.chainId, wallet.address!)}
                        className="h-6 w-6 p-0"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {/* Tokens Multi-Chain */}
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Carregando saldos...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : balances ? (
                  Object.entries(balances).map(([network, tokens]) => {
                    if (network === 'native' || !Array.isArray(tokens)) return null
                    
                    const networkChainId = {
                      'ethereum': 1,
                      'bsc': 56,
                      'polygon': 137,
                      'arbitrum': 42161
                    }[network]

                    return tokens.map((token, index) => (
                      <TableRow key={`${network}-${index}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="text-sm font-mono">{token.symbol}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {networkChainId && getNetworkBadge(networkChainId)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {parseFloat(token.balance).toFixed(6)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {(token.symbol === 'USDT' || token.symbol === 'USDC') ? 
                            formatCurrency(parseFloat(token.balance)) : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center gap-1">
                            {networkChainId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => switchNetwork(networkChainId)}
                                disabled={wallet.chainId === networkChainId}
                                className="h-6 px-2 text-xs"
                              >
                                <ArrowUpDown className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-sm">
                      <AlertTriangle className="h-4 w-4 mx-auto mb-2" />
                      Erro ao carregar saldos
                    </TableCell>
                  </TableRow>
                )}

                {/* Resumo Total */}
                {balances && getTotalUSDTBalance() > 0 && (
                  <TableRow className="bg-green-50">
                    <TableCell className="font-semibold text-green-800">
                      Total Stablecoins
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                    <TableCell className="text-right font-bold text-green-800">
                      {formatCurrency(getTotalUSDTBalance())}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Controles da Carteira */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <code className="text-xs bg-background px-2 py-1 rounded">
                    {formatAddress(wallet.address!)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyAddress}
                    className="h-6 w-6 p-0"
                  >
                    {copiedAddress ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center gap-2">
                  <TransferModal 
                    onTransfer={handleTransfer}
                    currentNetwork={wallet.chainId}
                    walletAddress={wallet.address}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="h-8 px-3"
                  >
                    <RefreshCw className={`h-3 w-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Atualizar
                  </Button>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="flex gap-2 mb-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => switchNetwork(1)}
                  disabled={wallet.chainId === 1}
                  className="flex-1 text-xs"
                >
                  Ethereum
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => switchNetwork(56)}
                  disabled={wallet.chainId === 56}
                  className="flex-1 text-xs"
                >
                  BSC
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => switchNetwork(137)}
                  disabled={wallet.chainId === 137}
                  className="flex-1 text-xs"
                >
                  Polygon
                </Button>
              </div>

              {/* Quick Transfer Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    toast({
                      title: "Transferência Rápida para OKX",
                      description: "Use o modal de transferência acima. Endereço OKX sugerido: 0x98EC...A128",
                    });
                  }}
                >
                  <Send className="h-4 w-4 mr-1" />
                  OKX ($20)
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    toast({
                      title: "Transferência Rápida para Binance",
                      description: "Use o modal de transferência acima. Endereço Binance sugerido: 0x3f5C...0bE",
                    });
                  }}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Binance ($20)
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}