import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useIsMobile } from "@/hooks/use-mobile"
import SmartBalanceDashboard from "@/components/SmartBalanceDashboard"
import Web3WalletManager from "@/components/Web3WalletManager"
import CrossPlatformTransferHub from "@/components/CrossPlatformTransferHub"
import MobileAPIManager from "@/components/MobileAPIManger"
import { ExchangeBalanceCard } from "@/components/ExchangeBalanceCard"
import { TotalBalanceCard } from "@/components/TotalBalanceCard"

export default function BalanceDashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  
  const [binanceBalance, setBinanceBalance] = useState(0)
  const [okxBalance, setOkxBalance] = useState(0)
  const [binancePrice, setBinancePrice] = useState<number | null>(null)
  const [okxPrice, setOkxPrice] = useState<number | null>(null)

  // Determinar qual exchange é melhor para comprar/vender
  const getBestExchange = () => {
    if (binancePrice === null || okxPrice === null) return null;
    
    return {
      buy: binancePrice < okxPrice ? 'binance' : 'okx',  // Comprar na mais barata
      sell: binancePrice > okxPrice ? 'binance' : 'okx',  // Vender na mais cara
      spread: Math.abs(binancePrice - okxPrice),
      spreadPercent: ((Math.abs(binancePrice - okxPrice) / Math.min(binancePrice, okxPrice)) * 100).toFixed(2)
    };
  };

  const bestExchange = getBestExchange();

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mobile-container">
          <div>
            <h1 className="text-2xl font-bold mb-2">📱 Dashboard Móvel</h1>
            <p className="text-muted-foreground mb-6 text-sm">
              Gerencie suas exchanges e saldos diretamente do celular
            </p>
          </div>

          {/* Mobile API Manager */}
          <MobileAPIManager />

          {/* Mobile Web3 Section */}
          <div className="mt-8">
            <Web3WalletManager />
          </div>

          {/* Mobile Balance Section */}
          <div className="mt-8">
            <SmartBalanceDashboard />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard de Saldos</h1>
        <p className="text-muted-foreground mt-2">
          Monitore e gerencie seus saldos com baseline de $100 USD por exchange
        </p>
      </div>

      {/* Cards de Saldo por Exchange e Total */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Saldo Binance */}
          <ExchangeBalanceCard 
            exchange="binance"
            baseline={100}
            onBalanceChange={setBinanceBalance}
            onPriceUpdate={(ex, price) => setBinancePrice(price)}
            bestAction={bestExchange?.buy === 'binance' ? 'buy' : bestExchange?.sell === 'binance' ? 'sell' : null}
          />
          
          {/* Saldo OKX */}
          <ExchangeBalanceCard 
            exchange="okx"
            baseline={100}
            onBalanceChange={setOkxBalance}
            onPriceUpdate={(ex, price) => setOkxPrice(price)}
            bestAction={bestExchange?.buy === 'okx' ? 'buy' : bestExchange?.sell === 'okx' ? 'sell' : null}
          />
          
          {/* Saldo Total */}
          <TotalBalanceCard 
            binanceBalance={binanceBalance}
            okxBalance={okxBalance}
            totalBaseline={200}
          />
        </div>
      </section>

      {/* Hub de Transferências Cross-Platform */}
      <section>
        <CrossPlatformTransferHub />
      </section>

      {/* Carteira Web3 */}
      <section>
        <Web3WalletManager />
      </section>

      {/* Sistema de Monitoramento */}
      <section>
        <SmartBalanceDashboard />
      </section>
    </div>
  )
}