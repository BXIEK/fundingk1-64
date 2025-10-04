import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, CheckCircle2, XCircle } from 'lucide-react';

export const BinanceIPRestrictionHelper = () => {
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          🚨 Problema: Binance Rejeita IPs do Supabase
        </CardTitle>
        <CardDescription>
          A Binance bloqueia automaticamente IPs de servidores AWS/Cloud (incluindo Supabase)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Por que isso acontece?</strong>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>A Binance detecta IPs de data centers (AWS, Google Cloud, etc.)</li>
              <li>Eles bloqueiam para prevenir bots e automação em massa</li>
              <li>É uma política de segurança da exchange</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-3">
          <h3 className="font-semibold text-lg">✅ Soluções (em ordem de preferência):</h3>
          
          {/* Solução 1 - RECOMENDADA */}
          <Card className="bg-green-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Solução 1: Desabilitar Restrição de IP (RECOMENDADO)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal ml-4 space-y-2 text-sm">
                <li>Acesse a página de <strong>API Management</strong> da Binance</li>
                <li>Edite sua API Key</li>
                <li>Em <strong>"IP access restrictions"</strong>, selecione:</li>
                <li className="ml-4">
                  <code className="bg-white px-2 py-1 rounded border">
                    ○ Unrestricted (Less Secure)
                  </code>
                </li>
                <li>Salve as alterações</li>
                <li>Aguarde 2 minutos e teste novamente</li>
              </ol>
              
              <Alert className="mt-3">
                <AlertDescription>
                  <strong>⚠️ Segurança:</strong> Sim, isso é "Less Secure", mas é a única forma de usar 
                  serviços serverless com a Binance. Mantenha sua Secret Key segura e monitore as operações.
                </AlertDescription>
              </Alert>

              <Button 
                className="mt-3 w-full"
                onClick={() => window.open('https://www.binance.com/en/my/settings/api-management', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Binance API Management
              </Button>
            </CardContent>
          </Card>

          {/* Solução 2 - Avançada */}
          <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                Solução 2: Proxy com IP Fixo Dedicado (Avançado, custo extra)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-3">
                Se você PRECISA de restrição de IP por segurança:
              </p>
              <ol className="list-decimal ml-4 space-y-2 text-sm">
                <li>Contrate um serviço de proxy com IP fixo dedicado (ex: Bright Data, Oxylabs)</li>
                <li>Configure o proxy como intermediário entre Supabase e Binance</li>
                <li>Adicione o IP do proxy na whitelist da Binance</li>
              </ol>
              <Alert className="mt-3">
                <AlertDescription>
                  <strong>💰 Custo:</strong> Proxies com IP fixo custam entre $20-100/mês
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Solução 3 - Não recomendada */}
          <Card className="bg-gray-50 border-gray-200">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4 text-gray-600" />
                Solução 3: Mudar de Exchange (Não aplicável)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                OKX e MEXC geralmente aceitam IPs de cloud, então você pode focar suas operações nessas exchanges 
                e usar a Binance apenas manualmente.
              </p>
            </CardContent>
          </Card>
        </div>

        <Alert variant="destructive" className="bg-orange-50 border-orange-300">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription>
            <strong className="text-orange-700">⚠️ ATENÇÃO: Restrições Geográficas</strong>
            <p className="mt-2 text-sm text-orange-900">
              Mesmo com "Unrestricted", a Binance pode bloquear acessos baseado na sua região:
            </p>
            <ul className="list-disc ml-5 mt-2 space-y-1 text-sm text-orange-900">
              <li><strong>Binance Global</strong> (api.binance.com) - Bloqueada em alguns países (EUA, etc.)</li>
              <li><strong>Binance US</strong> (api.binance.us) - Apenas para usuários dos EUA</li>
              <li><strong>Supabase</strong> usa servidores AWS em várias regiões globais</li>
            </ul>
            <p className="mt-2 text-sm font-semibold text-orange-900">
              Se você está em uma região restrita, o Supabase pode conseguir acessar mesmo que você não consiga 
              diretamente, pois os servidores Supabase estão em regiões diferentes.
            </p>
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertDescription>
            <strong>💡 Dica Final:</strong> Após selecionar "Unrestricted", aguarde 1-2 minutos e volte para 
            a aba "Status APIs" para testar a conexão novamente.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
