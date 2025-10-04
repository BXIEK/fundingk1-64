import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { AutoWhitelistAssistant } from './AutoWhitelistAssistant';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const IPWhitelistGuide = () => {
  const { toast } = useToast();
  const [copiedIP, setCopiedIP] = useState<string | null>(null);

  // IPs do Supabase (região us-east-1 - AWS São Paulo e outros datacenters)
  const supabaseIPs = [
    '18.228.156.0',
    '15.228.253.28',
    '18.228.48.232',
    '16.228.34.4',
    '15.228.149.59',
    '18.228.214.242',
    '15.228.28.2',
    '18.231.153.4',
    // IPs adicionais da região AWS us-east-1
    '54.94.0.0/16',
    '177.71.128.0/17',
    '18.231.0.0/16',
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIP(text);
    toast({
      title: "IP copiado!",
      description: `${text} copiado para a área de transferência`,
    });
    setTimeout(() => setCopiedIP(null), 2000);
  };

  const copyAllIPs = () => {
    const allIPs = supabaseIPs.join(', ');
    navigator.clipboard.writeText(allIPs);
    toast({
      title: "Todos os IPs copiados!",
      description: "Cole na whitelist da exchange",
    });
  };

  return (
    <Tabs defaultValue="assistant" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="assistant">🤖 Assistente Automático</TabsTrigger>
        <TabsTrigger value="manual">📋 Guia Manual</TabsTrigger>
      </TabsList>

      <TabsContent value="assistant">
        <AutoWhitelistAssistant />
      </TabsContent>

      <TabsContent value="manual" className="space-y-6">
        <Alert>
          <AlertDescription>
            <strong>⚠️ IMPORTANTE:</strong> Adicione TODOS estes IPs na whitelist de cada exchange para garantir que as requisições do Supabase sejam aceitas.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              IPs do Supabase para Whitelist
              <Button size="sm" onClick={copyAllIPs}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Todos
              </Button>
            </CardTitle>
            <CardDescription>
              Estes são os IPs dos servidores Supabase (AWS us-east-1) que fazem requisições às exchanges
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {supabaseIPs.map((ip) => (
                <div
                  key={ip}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <code className="font-mono text-sm">{ip}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(ip)}
                  >
                    {copiedIP === ip ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📍 Onde Adicionar os IPs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Binance */}
            <div className="border-l-4 border-yellow-500 pl-4">
              <h3 className="font-semibold text-lg mb-2">🟡 Binance</h3>
              <ol className="list-decimal ml-4 space-y-2 text-sm">
                <li>Acesse: <strong>API Management</strong> no site da Binance</li>
                <li>Clique em <strong>"Edit"</strong> na sua API Key</li>
                <li>Em <strong>"Restrições de acesso por IP"</strong>, selecione "Restringir acesso apenas a IPs confiáveis"</li>
                <li>Cole TODOS os IPs acima (um por linha ou separados por vírgula)</li>
                <li>Salve as alterações</li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open('https://www.binance.com/en/my/settings/api-management', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir Binance API Management
              </Button>
            </div>

            {/* OKX */}
            <div className="border-l-4 border-black dark:border-white pl-4">
              <h3 className="font-semibold text-lg mb-2">⚫ OKX</h3>
              <ol className="list-decimal ml-4 space-y-2 text-sm">
                <li>Acesse: <strong>API</strong> no site da OKX</li>
                <li>Clique em <strong>"Modify API key"</strong></li>
                <li>Em <strong>"IP address allowlist"</strong>, adicione cada IP</li>
                <li>A OKX aceita múltiplos IPs separados por vírgula</li>
                <li>Clique em <strong>"Confirm"</strong></li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open('https://www.okx.com/account/my-api', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir OKX API Management
              </Button>
            </div>

            {/* MEXC */}
            <div className="border-l-4 border-blue-500 pl-4">
              <h3 className="font-semibold text-lg mb-2">🔵 MEXC</h3>
              <ol className="list-decimal ml-4 space-y-2 text-sm">
                <li>Acesse: <strong>API Management</strong> no site da MEXC</li>
                <li>Encontre sua API Key e clique em <strong>"Editar"</strong></li>
                <li>Em <strong>"Endereço de IP Vinculado"</strong>, adicione cada IP</li>
                <li>Separe múltiplos IPs por vírgula</li>
                <li>Clique em <strong>"Gerar"</strong> ou "Salvar"</li>
              </ol>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => window.open('https://www.mexc.com/user/openapi', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir MEXC API Management
              </Button>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertDescription>
            <strong>💡 Dica:</strong> Após adicionar os IPs, aguarde 1-2 minutos para que as mudanças sejam aplicadas. 
            Depois, retorne à aba "Status APIs" e clique em "Revalidar" para testar as conexões.
          </AlertDescription>
        </Alert>
      </TabsContent>
    </Tabs>
  );
};
