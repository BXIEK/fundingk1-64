import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, CheckCircle, AlertCircle, Copy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const N8NIntegration = () => {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookType, setWebhookType] = useState<"arbitrage" | "transfer" | "monitoring">("arbitrage");
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [savedWebhooks, setSavedWebhooks] = useState<any[]>([]);

  const handleSaveWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Erro",
        description: "Por favor, insira a URL do webhook n8n",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke('n8n-webhook-manager', {
        body: {
          action: 'save_webhook',
          userId: user.id,
          webhookUrl,
          webhookType
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Webhook Configurado",
        description: "Webhook n8n salvo e testado com sucesso"
      });

      setWebhookUrl("");
      loadWebhooks();
    } catch (error: any) {
      console.error("Erro ao salvar webhook:", error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao configurar webhook",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) return;

    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('n8n-webhook-manager', {
        body: {
          action: 'test_webhook',
          webhookUrl
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Teste Bem-Sucedido",
          description: "Webhook n8n está respondendo corretamente"
        });
      } else {
        throw new Error("Webhook não respondeu corretamente");
      }
    } catch (error: any) {
      toast({
        title: "Erro no Teste",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  const loadWebhooks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase.functions.invoke('n8n-webhook-manager', {
        body: {
          action: 'get_webhooks',
          userId: user.id
        }
      });

      if (error) throw error;
      setSavedWebhooks(data.webhooks || []);
    } catch (error) {
      console.error("Erro ao carregar webhooks:", error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "✅ Copiado",
      description: `${label} copiado para a área de transferência`
    });
  };

  const SUPABASE_URL = "https://uxhcsjlfwkhwkvhfacho.supabase.co";

  return (
    <div className="space-y-6">
      {/* Card com informações de configuração do Supabase para n8n */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            ⚙️ Credenciais do Supabase para n8n
          </CardTitle>
          <CardDescription>
            Use estas informações ao configurar a conexão Supabase no n8n
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Ao adicionar o nó "Supabase" no n8n, preencha os campos com as informações abaixo:
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Host</Label>
              <div className="flex gap-2">
                <Input 
                  value={SUPABASE_URL}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(SUPABASE_URL, "Host")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Service Role Secret</Label>
              <div className="flex gap-2">
                <Input 
                  value="••••••••••••••••••••••••••••••••••••"
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "🔐 Acesse o Supabase Dashboard",
                      description: "Copie o Service Role Key em: Settings > API > service_role (secret)",
                      duration: 5000
                    });
                    window.open('https://supabase.com/dashboard/project/uxhcsjlfwkhwkvhfacho/settings/api', '_blank');
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Clique no botão ao lado para acessar o Supabase Dashboard e copiar sua Service Role Key
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Allowed HTTP Request Domains</Label>
              <div className="flex gap-2">
                <Input 
                  value="All"
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard("All", "Domínios permitidos")}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Selecione "All" no dropdown do n8n
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Configuração de Webhooks n8n
          </CardTitle>
          <CardDescription>
            Configure webhooks n8n para automatizar transferências blockchain e arbitragens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Webhook</Label>
            <Select value={webhookType} onValueChange={(value: any) => setWebhookType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="arbitrage">Arbitragem</SelectItem>
                <SelectItem value="transfer">Transferências</SelectItem>
                <SelectItem value="monitoring">Monitoramento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>URL do Webhook n8n</Label>
            <Input
              placeholder="https://seu-n8n.app.n8n.cloud/webhook/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Cole a URL do webhook do seu workflow n8n
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleTestWebhook}
              disabled={!webhookUrl || isTesting}
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                "Testar Webhook"
              )}
            </Button>

            <Button
              onClick={handleSaveWebhook}
              disabled={!webhookUrl || isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar e Ativar"
              )}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-2">📚 Como Configurar:</h3>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Acesse seu n8n.io e crie um novo workflow</li>
              <li>Adicione um nó "Webhook" como trigger</li>
              <li>Copie a URL do webhook gerada</li>
              <li>Cole a URL acima e clique em "Salvar e Ativar"</li>
              <li>Configure as ações desejadas no n8n (transferências, conversões, etc.)</li>
            </ol>
            
            <Button
              variant="link"
              className="mt-2 p-0 h-auto"
              onClick={() => window.open('https://n8n.io', '_blank')}
            >
              Acessar n8n.io
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </div>

          {savedWebhooks.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-3">Webhooks Configurados:</h3>
              <div className="space-y-2">
                {savedWebhooks.map((webhook) => (
                  <div
                    key={webhook.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center gap-2">
                      {webhook.is_active ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning" />
                      )}
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {webhook.webhook_type}
                        </p>
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {webhook.webhook_url}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
