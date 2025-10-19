import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, Shield, Zap } from "lucide-react";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";

interface ArbitrageParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  buyDex: string;
  sellDex: string;
  minProfit: string;
}

export const BlockchainArbitrageExecutor = () => {
  const { toast } = useToast();
  const { wallet, connectWallet, isConnecting } = useWeb3Wallet();
  const [isExecuting, setIsExecuting] = useState(false);
  const [params, setParams] = useState<ArbitrageParams>({
    tokenIn: "",
    tokenOut: "",
    amountIn: "",
    buyDex: "uniswap",
    sellDex: "sushiswap",
    minProfit: "0.5"
  });
  const [n8nWebhook, setN8nWebhook] = useState("");

  const handleExecute = async () => {
    if (!wallet.isConnected || !wallet.address) {
      toast({
        title: "Carteira não conectada",
        description: "Por favor, conecte sua carteira Web3 primeiro",
        variant: "destructive"
      });
      return;
    }

    if (!n8nWebhook) {
      toast({
        title: "Webhook n8n necessário",
        description: "Configure o webhook do n8n nas configurações",
        variant: "destructive"
      });
      return;
    }

    if (!params.tokenIn || !params.tokenOut || !params.amountIn) {
      toast({
        title: "Parâmetros incompletos",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    setIsExecuting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase.functions.invoke('blockchain-transfer', {
        body: {
          userId: user.id,
          fromAddress: wallet.address,
          toAddress: wallet.address,
          amount: params.amountIn,
          token: params.tokenIn,
          network: `chain-${wallet.chainId}`,
          n8nWebhook,
          operationType: 'arbitrage',
          arbitrageDetails: {
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            amountIn: params.amountIn,
            buyDex: params.buyDex,
            sellDex: params.sellDex,
            minProfit: params.minProfit
          }
        }
      });

      if (error) throw error;

      toast({
        title: "✅ Arbitragem executada!",
        description: data.result?.transactionHash 
          ? `TX: ${data.result.transactionHash.substring(0, 10)}...`
          : "Processando transação on-chain"
      });

      // Reset form
      setParams({
        ...params,
        tokenIn: "",
        tokenOut: "",
        amountIn: ""
      });

    } catch (error) {
      console.error('Erro na arbitragem:', error);
      toast({
        title: "❌ Erro na execução",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Conexão Web3
          </CardTitle>
          <CardDescription>
            Conecte sua carteira para executar arbitragem on-chain
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!wallet.isConnected ? (
            <Button 
              onClick={connectWallet} 
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Conectando...
                </>
              ) : (
                "Conectar MetaMask"
              )}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>Endereço:</strong> {wallet.address?.substring(0, 6)}...{wallet.address?.substring(38)}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Rede:</strong> Chain ID {wallet.chainId}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Saldo:</strong> {wallet.balance} ETH
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* N8N Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Webhook n8n
          </CardTitle>
          <CardDescription>
            URL do webhook n8n para processar arbitragem
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="https://seu-n8n.app/webhook/arbitrage"
            value={n8nWebhook}
            onChange={(e) => setN8nWebhook(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Arbitrage Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Parâmetros de Arbitragem
          </CardTitle>
          <CardDescription>
            Configure os tokens e DEXs para a operação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tokenIn">Token de Entrada</Label>
              <Input
                id="tokenIn"
                placeholder="0x..."
                value={params.tokenIn}
                onChange={(e) => setParams({ ...params, tokenIn: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tokenOut">Token de Saída</Label>
              <Input
                id="tokenOut"
                placeholder="0x..."
                value={params.tokenOut}
                onChange={(e) => setParams({ ...params, tokenOut: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amountIn">Quantidade</Label>
            <Input
              id="amountIn"
              type="number"
              step="0.001"
              placeholder="0.1"
              value={params.amountIn}
              onChange={(e) => setParams({ ...params, amountIn: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyDex">DEX de Compra</Label>
              <Select value={params.buyDex} onValueChange={(v) => setParams({ ...params, buyDex: v })}>
                <SelectTrigger id="buyDex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uniswap">Uniswap V2</SelectItem>
                  <SelectItem value="sushiswap">SushiSwap</SelectItem>
                  <SelectItem value="pancakeswap">PancakeSwap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellDex">DEX de Venda</Label>
              <Select value={params.sellDex} onValueChange={(v) => setParams({ ...params, sellDex: v })}>
                <SelectTrigger id="sellDex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="uniswap">Uniswap V2</SelectItem>
                  <SelectItem value="sushiswap">SushiSwap</SelectItem>
                  <SelectItem value="pancakeswap">PancakeSwap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="minProfit">Lucro Mínimo (%)</Label>
            <Input
              id="minProfit"
              type="number"
              step="0.1"
              placeholder="0.5"
              value={params.minProfit}
              onChange={(e) => setParams({ ...params, minProfit: e.target.value })}
            />
          </div>

          <Button 
            onClick={handleExecute} 
            disabled={!wallet.isConnected || isExecuting || !n8nWebhook}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Executando...
              </>
            ) : (
              "Executar Arbitragem"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
