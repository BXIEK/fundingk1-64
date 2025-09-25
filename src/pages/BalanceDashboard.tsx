import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import SmartBalanceDashboard from "@/components/SmartBalanceDashboard"
import Web3WalletManager from "@/components/Web3WalletManager"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"

export default function BalanceDashboard() {
  const navigate = useNavigate()
  const { toast } = useToast()

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

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard de Saldos</h1>
        <p className="text-muted-foreground mt-2">
          Monitore e gerencie seus saldos através de carteiras Web3 e alertas automatizados
        </p>
      </div>

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