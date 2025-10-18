import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SUPPORTED_NETWORKS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'bsc', name: 'BSC', symbol: 'BNB' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH' },
];

export const BlockchainTransferHub = () => {
  const { toast } = useToast();
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState("USDT");
  const [network, setNetwork] = useState("ethereum");
  const [isLoading, setIsLoading] = useState(false);
  const [useN8N, setUseN8N] = useState(true);

  const handleTransfer = async () => {
    if (!fromAddress || !toAddress || !amount) {
      toast({
        title: "Campos Obrigatórios",
        description: "Preencha todos os campos para continuar",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Buscar webhook n8n se ativo
      let n8nWebhook = null;
      if (useN8N) {
        const { data: webhookData } = await supabase.functions.invoke('n8n-webhook-manager', {
          body: {
            action: 'get_webhooks',
            userId: user.id
          }
        });

        const transferWebhook = webhookData?.webhooks?.find(
          (w: any) => w.webhook_type === 'transfer' && w.is_active
        );
        n8nWebhook = transferWebhook?.webhook_url;
      }

      const { data, error } = await supabase.functions.invoke('blockchain-transfer', {
        body: {
          userId: user.id,
          fromAddress,
          toAddress,
          amount,
          token,
          network,
          n8nWebhook
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Transferência Iniciada",
        description: n8nWebhook 
          ? "Transferência delegada para n8n workflow"
          : "Transferência blockchain em processamento"
      });

      // Limpar formulário
      setAmount("");
      setToAddress("");
    } catch (error: any) {
      console.error("Erro na transferência:", error);
      toast({
        title: "Erro na Transferência",
        description: error.message || "Falha ao processar transferência blockchain",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔗 Transferência Blockchain Direta
        </CardTitle>
        <CardDescription>
          Transfira tokens diretamente via blockchain, sem depender das APIs das exchanges
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Rede Blockchain</Label>
          <Select value={network} onValueChange={setNetwork}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_NETWORKS.map((net) => (
                <SelectItem key={net.id} value={net.id}>
                  {net.name} ({net.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Token</Label>
          <Select value={token} onValueChange={setToken}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USDT">USDT</SelectItem>
              <SelectItem value="USDC">USDC</SelectItem>
              <SelectItem value="ETH">ETH</SelectItem>
              <SelectItem value="BTC">WBTC</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Endereço de Origem</Label>
          <Input
            placeholder="0x..."
            value={fromAddress}
            onChange={(e) => setFromAddress(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Endereço de Destino</Label>
          <Input
            placeholder="0x..."
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Quantidade</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="use-n8n"
            checked={useN8N}
            onChange={(e) => setUseN8N(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="use-n8n" className="cursor-pointer">
            Usar n8n.io para processar transferência
          </Label>
        </div>

        <Button
          onClick={handleTransfer}
          disabled={isLoading || !fromAddress || !toAddress || !amount}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Enviar Transferência
            </>
          )}
        </Button>

        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Dica:</strong> Configure um webhook n8n na aba "Integração n8n" para automatizar
            o processamento de transferências blockchain e contornar limitações das APIs das exchanges.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
