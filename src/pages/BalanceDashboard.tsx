import { useNavigate } from "react-router-dom"
import { useIsMobile } from "@/hooks/use-mobile"
import SmartBalanceDashboard from "@/components/SmartBalanceDashboard"
import Web3WalletManager from "@/components/Web3WalletManager"
import CrossPlatformTransferHub from "@/components/CrossPlatformTransferHub"
import MobileAPIManager from "@/components/MobileAPIManger"

export default function BalanceDashboard() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()

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
          Monitore e gerencie seus saldos através de carteiras Web3 e alertas automatizados
        </p>
      </div>

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