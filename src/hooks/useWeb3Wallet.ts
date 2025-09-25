import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'

interface WalletState {
  address: string | null
  isConnected: boolean
  chainId: number | null
  balance: string | null
}

declare global {
  interface Window {
    ethereum?: any
  }
}

export function useWeb3Wallet() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnected: false,
    chainId: null,
    balance: null
  })
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verificar se MetaMask está instalado
  const isMetaMaskInstalled = useCallback(() => {
    return typeof window !== 'undefined' && Boolean(window.ethereum?.isMetaMask)
  }, [])

  // Conectar carteira
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask não está instalado')
      return false
    }

    setIsConnecting(true)
    setError(null)

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        const address = accounts[0]
        const chainId = await window.ethereum.request({ method: 'eth_chainId' })
        
        // Buscar saldo
        const provider = new ethers.BrowserProvider(window.ethereum)
        const balance = await provider.getBalance(address)
        
        setWallet({
          address,
          isConnected: true,
          chainId: parseInt(chainId, 16),
          balance: ethers.formatEther(balance)
        })

        return true
      }
      
      return false
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar carteira')
      return false
    } finally {
      setIsConnecting(false)
    }
  }, [isMetaMaskInstalled])

  // Desconectar carteira
  const disconnectWallet = useCallback(() => {
    setWallet({
      address: null,
      isConnected: false,
      chainId: null,
      balance: null
    })
    setError(null)
  }, [])

  // Trocar de rede
  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) return false

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${targetChainId.toString(16)}` }]
      })
      return true
    } catch (error: any) {
      if (error.code === 4902) {
        // Rede não está adicionada, tentar adicionar
        return await addNetwork(targetChainId)
      }
      setError(`Erro ao trocar rede: ${error.message}`)
      return false
    }
  }, [])

  // Adicionar nova rede
  const addNetwork = useCallback(async (chainId: number) => {
    const networks: { [key: number]: any } = {
      56: {
        chainId: '0x38',
        chainName: 'Binance Smart Chain',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrls: ['https://bsc-dataseed.binance.org/'],
        blockExplorerUrls: ['https://bscscan.com/']
      },
      137: {
        chainId: '0x89',
        chainName: 'Polygon',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://polygon-rpc.com/'],
        blockExplorerUrls: ['https://polygonscan.com/']
      },
      42161: {
        chainId: '0xa4b1',
        chainName: 'Arbitrum One',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io/']
      }
    }

    const networkConfig = networks[chainId]
    if (!networkConfig) {
      setError('Rede não suportada')
      return false
    }

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [networkConfig]
      })
      return true
    } catch (error: any) {
      setError(`Erro ao adicionar rede: ${error.message}`)
      return false
    }
  }, [])

  // Executar transferência
  const sendTransaction = useCallback(async (
    to: string,
    amount: string,
    tokenAddress?: string
  ) => {
    if (!wallet.isConnected || !window.ethereum) {
      throw new Error('Carteira não conectada')
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()

      if (tokenAddress) {
        // Transferência de token ERC-20
        const tokenContract = new ethers.Contract(
          tokenAddress,
          [
            'function transfer(address to, uint256 amount) returns (bool)',
            'function decimals() view returns (uint8)'
          ],
          signer
        )

        const decimals = await tokenContract.decimals()
        const parsedAmount = ethers.parseUnits(amount, decimals)
        
        const tx = await tokenContract.transfer(to, parsedAmount)
        return tx
      } else {
        // Transferência de ETH nativo
        const tx = await signer.sendTransaction({
          to,
          value: ethers.parseEther(amount)
        })
        return tx
      }
    } catch (error: any) {
      throw new Error(`Erro na transferência: ${error.message}`)
    }
  }, [wallet.isConnected])

  // Atualizar saldo
  const updateBalance = useCallback(async () => {
    if (!wallet.address || !window.ethereum) return

    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const balance = await provider.getBalance(wallet.address)
      
      setWallet(prev => ({
        ...prev,
        balance: ethers.formatEther(balance)
      }))
    } catch (error) {
      console.error('Erro ao atualizar saldo:', error)
    }
  }, [wallet.address])

  // Escutar mudanças na carteira
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet()
      } else if (accounts[0] !== wallet.address) {
        setWallet(prev => ({ ...prev, address: accounts[0] }))
      }
    }

    const handleChainChanged = (chainId: string) => {
      setWallet(prev => ({ ...prev, chainId: parseInt(chainId, 16) }))
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      if (window.ethereum?.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [wallet.address, disconnectWallet])

  // Verificar conexão existente ao carregar
  useEffect(() => {
    if (!isMetaMaskInstalled()) return

    const checkConnection = async () => {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' })
        if (accounts.length > 0) {
          const address = accounts[0]
          const chainId = await window.ethereum.request({ method: 'eth_chainId' })
          
          const provider = new ethers.BrowserProvider(window.ethereum)
          const balance = await provider.getBalance(address)
          
          setWallet({
            address,
            isConnected: true,
            chainId: parseInt(chainId, 16),
            balance: ethers.formatEther(balance)
          })
        }
      } catch (error) {
        console.error('Erro ao verificar conexão:', error)
      }
    }

    checkConnection()
  }, [isMetaMaskInstalled])

  return {
    wallet,
    isConnecting,
    error,
    isMetaMaskInstalled,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    sendTransaction,
    updateBalance
  }
}