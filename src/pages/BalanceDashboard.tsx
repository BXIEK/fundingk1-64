import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useIsMobile } from "@/hooks/use-mobile"
import SmartBalanceDashboard from "@/components/SmartBalanceDashboard"
import Web3WalletManager from "@/components/Web3WalletManager"
import CrossPlatformTransferHub from "@/components/CrossPlatformTransferHub"
import MobileAPIManager from "@/components/MobileAPIManger"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export default function BalanceDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error || !user) {
        toast({
          title: "Acesso negado",
          description: "Você precisa estar logado para acessar esta página.",
          variant: "destructive"
        })
        navigate("/")
        return
      }
    }

    checkAuth()
  }, [navigate, toast])

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