import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useIsMobile } from "@/hooks/use-mobile"
import SmartBalanceDashboard from "@/components/SmartBalanceDashboard"
import Web3WalletManager from "@/components/Web3WalletManager"
import CrossPlatformTransferHub from "@/components/CrossPlatformTransferHub"
import MobileAPIManager from "@/components/MobileAPIManger"
import { ExchangeBalanceCard } from "@/components/ExchangeBalanceCard"
import { TotalBalanceCard } from "@/components/TotalBalanceCard"
import { AutoTokenConverter } from "@/components/AutoTokenConverter"

export default function BalanceDashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  
  const [binanceBalance, setBinanceBalance] = useState(0)
  const [okxBalance, setOkxBalance] = useState(0)

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
          Visualize e gerencie seus saldos em cada exchange individualmente
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
          />
          
          {/* Saldo OKX */}
          <ExchangeBalanceCard 
            exchange="okx"
            baseline={100}
            onBalanceChange={setOkxBalance}
          />
          
          {/* Saldo Total */}
          <TotalBalanceCard 
            binanceBalance={binanceBalance} 
            okxBalance={okxBalance}
            totalBaseline={200}
          />
        </div>
      </section>

      {/* Conversão Automatizada de Tokens */}
      <section>
        <AutoTokenConverter />
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