import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle, ExternalLink, Shield, Zap } from "lucide-react"
import { supabase } from "@/integrations/supabase/client"
import { useState } from "react"

interface IPInstructions {
  problem: string
  current_ip: string
  disclaimer?: string
  solution: {
    step1: string
    step2: string
    step3: string
    step4: string
    step5: string
    step6: string
    options: Array<{
      recommended: boolean
      title: string
      steps: string[]
    }>
  }
  important_notes: string[]
  troubleshooting: Record<string, string>
}

export default function IPWhitelistHelper() {
  const [instructions, setInstructions] = useState<IPInstructions | null>(null)
  const [loading, setLoading] = useState(false)

  const getIPInstructions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('okx-ip-whitelist-helper')
      if (error) throw error
      setInstructions(data)
    } catch (error) {
      console.error('Erro ao obter instruções:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!instructions) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Erro de IP Whitelist Detectado
          </CardTitle>
          <CardDescription>
            O sistema adaptativo está falhando devido a restrições de IP na OKX
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h4 className="font-medium text-amber-800">Importante: Limitação da OKX</h4>
            </div>
            <p className="text-sm text-amber-700 mt-2">
              A OKX pode não ter a opção "IP Restriction" disponível para todas as contas ou pode ter mudado a interface recentemente.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-semibold">1</span>
              </div>
              <div>
                <h4 className="font-medium text-foreground">Acesse o OKX API Management</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Faça login → Account → API → API Management
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-sm font-semibold">2</span>
              </div>
              <div>
                <h4 className="font-medium text-foreground">Procure por IP Restriction</h4>
                <div className="text-sm text-muted-foreground mt-1 space-y-1">
                  <p>• Clique em "Edit" na sua API key</p>
                  <p>• Procure por "IP Restriction", "IP Whitelist" ou "Allowed IPs"</p>
                  <p>• Se encontrar, configure como: <code className="bg-muted px-2 py-1 rounded text-xs">0.0.0.0/0</code></p>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                <span className="text-orange-600 text-sm font-semibold">⚠</span>
              </div>
              <div>
                <h4 className="font-medium text-foreground">Se não encontrar a opção</h4>
                <div className="text-sm text-muted-foreground mt-1 space-y-1">
                  <p>• A OKX pode não ter essa funcionalidade na sua conta</p>
                  <p>• Ou pode estar em uma seção diferente da interface</p>
                  <p>• Tente contatar o suporte da OKX para mais informações</p>
                  <p>• Como alternativa, use apenas a Binance para arbitragem</p>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={getIPInstructions} disabled={loading} className="w-full">
            {loading ? 'Analisando...' : 'Ver Instruções Detalhadas'}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Problema Identificado */}
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="font-semibold">
          {instructions.problem}
        </AlertDescription>
      </Alert>

      {/* Aviso sobre disponibilidade da opção */}
      {instructions.disclaimer && (
        <Alert variant="default" className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            {instructions.disclaimer}
          </AlertDescription>
        </Alert>
      )}

      {/* IP Atual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">IP Atual da Edge Function</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="outline" className="font-mono">
            {instructions.current_ip}
          </Badge>
          <p className="text-sm text-muted-foreground mt-2">
            ⚠️ Este IP muda dinamicamente a cada execução
          </p>
        </CardContent>
      </Card>

      {/* Solução Passo a Passo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Solução Passo a Passo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline">1</Badge>
              <p>{instructions.solution.step1}</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">2</Badge>
              <p>{instructions.solution.step2}</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">3</Badge>
              <p>{instructions.solution.step3}</p>
            </div>
          </div>

          <Separator />

          {/* Opções de Configuração */}
          <div className="space-y-4">
            {instructions.solution.options.map((option, index) => (
              <Card key={index} className={option.recommended ? "border-green-200 bg-green-50" : ""}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {option.recommended && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {option.title}
                    {option.recommended && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        Recomendado
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {option.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline">4</Badge>
              <p>{instructions.solution.step4}</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">5</Badge>
              <p>{instructions.solution.step5}</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">6</Badge>
              <p>{instructions.solution.step6}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notas Importantes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-600">
            <AlertTriangle className="h-5 w-5" />
            Notas Importantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {instructions.important_notes.map((note, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-orange-500">•</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-purple-500" />
            Solução de Problemas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(instructions.troubleshooting).map(([issue, solution]) => (
              <div key={issue} className="border-l-2 border-purple-200 pl-4">
                <p className="font-medium text-sm capitalize">
                  {issue.replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-muted-foreground">{solution}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Botão para OKX */}
      <div className="flex justify-center">
        <Button asChild className="w-full max-w-sm">
          <a
            href="https://www.okx.com/account/my-api"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir OKX API Management
          </a>
        </Button>
      </div>
    </div>
  )
}