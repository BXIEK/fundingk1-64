import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Wallet, ExternalLink, Send, RefreshCw, AlertTriangle, Copy, CheckCircle } from "lucide-react"
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet"
import { useWalletBalance } from "@/hooks/useWalletBalance"
import { useToast } from "@/hooks/use-toast"

const NETWORK_INFO = {
  1: { name: 'Ethereum', symbol: 'ETH', color: 'bg-blue-500' },
  56: { name: 'BSC', symbol: 'BNB', color: 'bg-yellow-500' },
  137: { name: 'Polygon', symbol: 'MATIC', color: 'bg-purple-500' },
  42161: { name: 'Arbitrum', symbol: 'ETH', color: 'bg-cyan-500' }
}

interface TransferModalProps {
  onTransfer: (to: string, amount: string, tokenAddress?: string) => Promise<void>
}

function TransferModal({ onTransfer }: TransferModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [tokenType, setTokenType] = useState('native')
  const [isTransferring, setIsTransferring] = useState(false)

  const handleTransfer = async () => {
    if (!recipient || !amount) return

    setIsTransferring(true)
    try {
      await onTransfer(recipient, amount, tokenType === 'native' ? undefined : tokenType)
      setIsOpen(false)
      setRecipient('')
      setAmount('')
    } catch (error) {
      console.error('Erro na transferência:', error)
    } finally {
      setIsTransferring(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="h-4 w-4 mr-2" />
          Transferir
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir Fundos</DialogTitle>
          <DialogDescription>
            Envie tokens para outro endereço ou exchange
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recipient">Endereço Destinatário</Label>
            <Input
              id="recipient"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
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
                  <SelectItem value="native">ETH (Nativo)</SelectItem>
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
                Verifique cuidadosamente o endereço antes de confirmar. Transações não podem ser revertidas.
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

export default function Web3WalletManager() {
  const { wallet, isConnecting, error, isMetaMaskInstalled, connectWallet, disconnectWallet, switchNetwork, sendTransaction, updateBalance } = useWeb3Wallet()
  const { balances, isLoading, refreshBalances, getTotalUSDTBalance } = useWalletBalance(wallet.address || undefined)
  const { toast } = useToast()
  const [copiedAddress, setCopiedAddress] = useState(false)

  const copyAddress = async () => {
    if (wallet.address) {
      await navigator.clipboard.writeText(wallet.address)
      setCopiedAddress(true)
      setTimeout(() => setCopiedAddress(false), 2000)
      toast({
        title: "Endereço copiado",
        description: "Endereço da carteira copiado para a área de transferência"
      })
    }
  }

  const handleTransfer = async (to: string, amount: string, tokenAddress?: string) => {
    try {
      const tx = await sendTransaction(to, amount, tokenAddress)
      
      toast({
        title: "Transferência iniciada",
        description: `Hash da transação: ${tx.hash.substring(0, 10)}...`
      })

      // Aguardar confirmação
      await tx.wait()
      
      toast({
        title: "Transferência confirmada",
        description: "Fundos transferidos com sucesso"
      })

      // Atualizar saldos
      updateBalance()
      refreshBalances()
      
    } catch (error: any) {
      toast({
        title: "Erro na transferência",
        description: error.message,
        variant: "destructive"
      })
      throw error
    }
  }

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  const getNetworkBadge = (chainId: number) => {
    const network = NETWORK_INFO[chainId as keyof typeof NETWORK_INFO]
    if (!network) return <Badge variant="destructive">Rede Desconhecida</Badge>
    
    return (
      <Badge className={`${network.color} text-white`}>
        {network.name}
      </Badge>
    )
  }

  if (!isMetaMaskInstalled()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Carteira Web3
          </CardTitle>
          <CardDescription>
            MetaMask é necessário para gerenciar transferências
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">MetaMask não encontrado</h3>
            <p className="text-muted-foreground mb-4">
              Instale a extensão MetaMask para conectar sua carteira
            </p>
            <Button asChild>
              <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Instalar MetaMask
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status da Carteira */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Carteira Web3 Conectada
          </CardTitle>
          <CardDescription>
            Gerencie seus fundos diretamente da sua carteira
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!wallet.isConnected ? (
            <div className="text-center py-6">
              <Button 
                onClick={connectWallet} 
                disabled={isConnecting}
                size="lg"
              >
                {isConnecting ? "Conectando..." : "Conectar Carteira"}
              </Button>
              {error && (
                <p className="text-destructive text-sm mt-2">{error}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Informações da Carteira */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Endereço:</span>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
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
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">Rede:</span>
                    {wallet.chainId && getNetworkBadge(wallet.chainId)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <TransferModal onTransfer={handleTransfer} />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      updateBalance()
                      refreshBalances()
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Atualizar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={disconnectWallet}
                  >
                    Desconectar
                  </Button>
                </div>
              </div>

              {/* Saldo Nativo */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    Saldo Nativo ({NETWORK_INFO[wallet.chainId! as keyof typeof NETWORK_INFO]?.symbol || 'ETH'})
                  </span>
                  <span className="text-lg font-bold">
                    {wallet.balance ? `${parseFloat(wallet.balance).toFixed(4)}` : '0.0000'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saldos Multi-Chain */}
      {wallet.isConnected && (
        <Card>
          <CardHeader>
            <CardTitle>Saldos Multi-Chain</CardTitle>
            <CardDescription>
              Visualize seus tokens em diferentes redes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : balances ? (
              <div className="space-y-4">
                {/* Resumo USDT Total */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-green-800">Total USDT/USDC</span>
                    <span className="text-xl font-bold text-green-800">
                      ${getTotalUSDTBalance().toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Saldos por Rede */}
                {Object.entries(balances).map(([network, tokens]) => {
                  if (network === 'native' || !Array.isArray(tokens)) return null
                  
                  return (
                    <div key={network} className="border rounded-lg p-4">
                      <h4 className="font-medium mb-3 capitalize flex items-center gap-2">
                        {network}
                        {network === 'ethereum' && getNetworkBadge(1)}
                        {network === 'bsc' && getNetworkBadge(56)}
                        {network === 'polygon' && getNetworkBadge(137)}
                        {network === 'arbitrum' && getNetworkBadge(42161)}
                      </h4>
                      
                      <div className="grid gap-2">
                        {tokens.map((token, index) => (
                          <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{token.symbol}</span>
                              {token.address && (
                                <code className="text-xs bg-muted px-1 rounded">
                                  {formatAddress(token.address)}
                                </code>
                              )}
                            </div>
                            <span className="font-mono">
                              {parseFloat(token.balance).toFixed(6)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Ações Rápidas */}
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => switchNetwork(1)}
                    disabled={wallet.chainId === 1}
                  >
                    Mudar para Ethereum
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => switchNetwork(56)}
                    disabled={wallet.chainId === 56}
                  >
                    Mudar para BSC
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-6">
                Carregue os saldos para visualizar
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}