import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, ExternalLink, Copy, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Step {
  id: number;
  exchange: string;
  status: 'pending' | 'in-progress' | 'completed';
  description: string;
  url: string;
}

export const AutoWhitelistAssistant = () => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  const supabaseIPs = [
    '18.228.156.0',
    '15.228.253.28',
    '18.228.48.232',
    '16.228.34.4',
    '15.228.149.59',
    '18.228.214.242',
    '15.228.28.2',
    '18.231.153.4',
  ];

  const [steps, setSteps] = useState<Step[]>([
    {
      id: 1,
      exchange: 'Binance',
      status: 'pending',
      description: 'Abrir página de API Management e copiar IPs',
      url: 'https://www.binance.com/en/my/settings/api-management'
    },
    {
      id: 2,
      exchange: 'OKX',
      status: 'pending',
      description: 'Abrir página de API Management e copiar IPs',
      url: 'https://www.okx.com/account/my-api'
    },
    {
      id: 3,
      exchange: 'MEXC',
      status: 'pending',
      description: 'Abrir página de API Management e copiar IPs',
      url: 'https://www.mexc.com/user/openapi'
    }
  ]);

  const copyAllIPs = () => {
    const ipsText = supabaseIPs.join(', ');
    navigator.clipboard.writeText(ipsText);
    toast({
      title: "✅ IPs copiados!",
      description: "Cole na whitelist da exchange",
    });
  };

  const startAutomation = async () => {
    setIsRunning(true);
    
    // Passo 1: Copiar IPs
    copyAllIPs();
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Processar cada exchange
    for (let i = 0; i < steps.length; i++) {
      setCurrentStep(i);
      
      // Marcar como em progresso
      setSteps(prev => prev.map((step, idx) => 
        idx === i ? { ...step, status: 'in-progress' } : step
      ));

      // Copiar IPs novamente (caso o usuário tenha colado em outra exchange)
      copyAllIPs();

      toast({
        title: `📋 Passo ${i + 1}: ${steps[i].exchange}`,
        description: `Abrindo página de API Management. Cole os IPs copiados!`,
        duration: 5000,
      });

      // Abrir a página da exchange
      window.open(steps[i].url, '_blank');

      // Aguardar um tempo antes da próxima exchange
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Marcar como completo (usuário deve marcar manualmente)
    }

    toast({
      title: "✨ Assistente concluído!",
      description: "Verifique se adicionou os IPs em todas as exchanges abertas",
      duration: 8000,
    });

    setIsRunning(false);
  };

  const markStepCompleted = (stepId: number) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId ? { ...step, status: 'completed' } : step
    ));

    const completedCount = steps.filter(s => s.status === 'completed').length + 1;
    
    if (completedCount === steps.length) {
      toast({
        title: "🎉 Todas as exchanges configuradas!",
        description: "Agora teste a conexão na aba 'Status APIs'",
      });
    }
  };

  const resetSteps = () => {
    setSteps(prev => prev.map(step => ({ ...step, status: 'pending' })));
    setCurrentStep(0);
    setIsRunning(false);
  };

  const allCompleted = steps.every(s => s.status === 'completed');

  return (
    <div className="space-y-6">
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>⚠️ Atenção:</strong> Por questões de segurança, as exchanges NÃO permitem modificar a whitelist via API. 
          Este assistente irá <strong>facilitar muito o processo</strong> abrindo as páginas corretas e copiando os IPs automaticamente.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>🤖 Assistente Automático de Whitelist</CardTitle>
          <CardDescription>
            Clique no botão abaixo para iniciar o processo guiado. O assistente irá:
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Copiar automaticamente todos os IPs para sua área de transferência</li>
              <li>Abrir a página de API Management de cada exchange</li>
              <li>Guiá-lo pelo processo de adicionar os IPs</li>
            </ul>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button 
              onClick={startAutomation} 
              disabled={isRunning || allCompleted}
              size="lg"
              className="flex-1"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Processando...
                </>
              ) : allCompleted ? (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Concluído
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5 mr-2" />
                  Iniciar Assistente Automático
                </>
              )}
            </Button>

            {(isRunning || allCompleted) && (
              <Button onClick={resetSteps} variant="outline" size="lg">
                Resetar
              </Button>
            )}
          </div>

          {/* Lista de IPs */}
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                IPs que serão copiados
                <Button size="sm" variant="ghost" onClick={copyAllIPs}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copiar Agora
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {supabaseIPs.map(ip => (
                  <code key={ip} className="text-xs bg-background p-2 rounded border">
                    {ip}
                  </code>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Progresso */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Progresso:</h3>
            {steps.map((step, idx) => (
              <div 
                key={step.id}
                className={`p-4 border rounded-lg transition-all ${
                  step.status === 'completed' 
                    ? 'bg-green-50 border-green-200' 
                    : step.status === 'in-progress' 
                    ? 'bg-blue-50 border-blue-200 animate-pulse' 
                    : 'bg-background'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : step.status === 'in-progress' ? (
                      <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                    <div>
                      <div className="font-semibold">{step.exchange}</div>
                      <div className="text-sm text-muted-foreground">{step.description}</div>
                    </div>
                  </div>
                  
                  {step.status !== 'pending' && step.status !== 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markStepCompleted(step.id)}
                    >
                      Marcar como Concluído
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">📝 Instruções Detalhadas</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal ml-5 space-y-2 text-sm">
            <li>Clique em "Iniciar Assistente Automático"</li>
            <li>Os IPs serão copiados automaticamente para sua área de transferência</li>
            <li>Uma aba será aberta para cada exchange</li>
            <li>Em cada aba, encontre o campo "IP Whitelist" ou "IP Address Allowlist"</li>
            <li>Cole os IPs copiados (Ctrl+V ou Cmd+V)</li>
            <li>Clique em "Marcar como Concluído" após adicionar os IPs</li>
            <li>Aguarde a confirmação por email (se necessário)</li>
            <li>Retorne à aba "Status APIs" e clique em "Revalidar"</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
};
