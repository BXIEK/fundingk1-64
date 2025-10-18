import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, CheckCircle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🔗 Integração n8n.io
          </CardTitle>
          <CardDescription>
            Configure webhooks n8n para automatizar transferências blockchain e arbitragens, contornando limitações das APIs das exchanges
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
