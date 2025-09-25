import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'

interface TokenBalance {
  symbol: string
  balance: string
  decimals: number
  address?: string
  usdValue?: number
}

interface WalletBalances {
  ethereum: TokenBalance[]
  bsc: TokenBalance[]
  polygon: TokenBalance[]
  arbitrum: TokenBalance[]
  native: TokenBalance
}

// Tokens principais para monitoramento
const COMMON_TOKENS = {
  ethereum: [
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'USDC', address: '0xA0b86a33E6441605cAb5a2cfB8F5B68d3d7127b7', decimals: 6 },
    { symbol: 'BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  ],
  bsc: [
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    { symbol: 'BTCB', address: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18 },
  ]
}

const NETWORKS = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    rpc: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  bsc: {
    chainId: 56,
    name: 'BSC',
    rpc: 'https://bsc-dataseed.binance.org/',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 }
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpc: 'https://polygon-rpc.com/',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum',
    rpc: 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  }
}

export function useWalletBalance(address?: string) {
  const [balances, setBalances] = useState<WalletBalances | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTokenBalance = useCallback(async (
    provider: ethers.JsonRpcProvider,
    tokenAddress: string,
    walletAddress: string,
    decimals: number
  ): Promise<string> => {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)'],
      provider
    )
    
    const balance = await tokenContract.balanceOf(walletAddress)
    return ethers.formatUnits(balance, decimals)
  }, [])

  const fetchNativeBalance = useCallback(async (
    provider: ethers.JsonRpcProvider,
    walletAddress: string,
    symbol: string
  ): Promise<TokenBalance> => {
    const balance = await provider.getBalance(walletAddress)
    return {
      symbol,
      balance: ethers.formatEther(balance),
      decimals: 18
    }
  }, [])

  const fetchNetworkBalances = useCallback(async (
    network: keyof typeof NETWORKS,
    walletAddress: string
  ): Promise<TokenBalance[]> => {
    try {
      const networkConfig = NETWORKS[network]
      const provider = new ethers.JsonRpcProvider(networkConfig.rpc)
      
      const tokens = COMMON_TOKENS[network] || []
      const balances: TokenBalance[] = []

      // Buscar saldos dos tokens
      for (const token of tokens) {
        try {
          const balance = await fetchTokenBalance(
            provider,
            token.address,
            walletAddress,
            token.decimals
          )
          
          balances.push({
            symbol: token.symbol,
            balance,
            decimals: token.decimals,
            address: token.address
          })
        } catch (error) {
          console.error(`Erro ao buscar saldo ${token.symbol} em ${network}:`, error)
        }
      }

      return balances
    } catch (error) {
      console.error(`Erro ao conectar na rede ${network}:`, error)
      return []
    }
  }, [fetchTokenBalance])

  const loadBalances = useCallback(async () => {
    if (!address) return

    setIsLoading(true)
    setError(null)

    try {
      // Buscar saldos em paralelo
      const [ethBalances, bscBalances, polygonBalances, arbitrumBalances] = await Promise.all([
        fetchNetworkBalances('ethereum', address),
        fetchNetworkBalances('bsc', address),
        fetchNetworkBalances('polygon', address),
        fetchNetworkBalances('arbitrum', address)
      ])

      // Buscar saldo nativo da rede principal (Ethereum)
      const ethProvider = new ethers.JsonRpcProvider(NETWORKS.ethereum.rpc)
      const nativeBalance = await fetchNativeBalance(ethProvider, address, 'ETH')

      setBalances({
        ethereum: ethBalances,
        bsc: bscBalances,
        polygon: polygonBalances,
        arbitrum: arbitrumBalances,
        native: nativeBalance
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar saldos')
    } finally {
      setIsLoading(false)
    }
  }, [address, fetchNetworkBalances, fetchNativeBalance])

  const refreshBalances = useCallback(() => {
    loadBalances()
  }, [loadBalances])

  useEffect(() => {
    if (address) {
      loadBalances()
    }
  }, [address, loadBalances])

  const getTotalUSDTBalance = useCallback(() => {
    if (!balances) return 0

    let total = 0
    
    // Somar USDT de todas as redes
    Object.values(balances).forEach(networkBalances => {
      if (Array.isArray(networkBalances)) {
        const usdtToken = networkBalances.find(token => 
          token.symbol === 'USDT' || token.symbol === 'USDC'
        )
        if (usdtToken) {
          total += parseFloat(usdtToken.balance) || 0
        }
      }
    })

    return total
  }, [balances])

  const getTokenBalance = useCallback((network: keyof WalletBalances, symbol: string): TokenBalance | null => {
    if (!balances) return null

    const networkBalances = balances[network]
    if (Array.isArray(networkBalances)) {
      return networkBalances.find(token => token.symbol === symbol) || null
    }
    
    if (network === 'native' && networkBalances.symbol === symbol) {
      return networkBalances
    }

    return null
  }, [balances])

  return {
    balances,
    isLoading,
    error,
    refreshBalances,
    getTotalUSDTBalance,
    getTokenBalance
  }
}