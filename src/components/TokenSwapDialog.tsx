import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, ArrowDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Balance {
  symbol: string;
  balance: number;
  valueUsd: number;
  priceUsd: number;
}

interface TokenSwapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exchange: 'binance' | 'okx';
  balances: Balance[];
  onSwapComplete: () => void;
}

export const TokenSwapDialog = ({
  open,
  onOpenChange,
  exchange,
  balances,
  onSwapComplete
}: TokenSwapDialogProps) => {
  const { toast } = useToast();
  const [fromToken, setFromToken] = useState<string>('USDT');
  const [toToken, setToToken] = useState<string>('BTC');
  const [amount, setAmount] = useState<string>('');
  const [estimatedReceive, setEstimatedReceive] = useState<number>(0);
  const [swapping, setSwapping] = useState(false);

  const exchangeNames = {
    binance: 'Binance',
    okx: 'OKX'
  };

  // Adicionar USDT aos balances se não existir
  const availableTokens = [...balances];
  if (!availableTokens.find(b => b.symbol === 'USDT')) {
    availableTokens.push({ symbol: 'USDT', balance: 0, valueUsd: 0, priceUsd: 1 });
  }

  const fromBalance = availableTokens.find(b => b.symbol === fromToken);
  const toTokenInfo = availableTokens.find(b => b.symbol === toToken);

  // Calcular estimativa de recebimento
  useEffect(() => {
    if (amount && fromBalance && toTokenInfo && parseFloat(amount) > 0) {
      const amountNum = parseFloat(amount);
      const fromValueUsd = amountNum * fromBalance.priceUsd;
      const estimatedTokens = fromValueUsd / toTokenInfo.priceUsd;
      setEstimatedReceive(estimatedTokens * 0.998); // -0.2% de taxa estimada
    } else {
      setEstimatedReceive(0);
    }
  }, [amount, fromToken, toToken, fromBalance, toTokenInfo]);

  const handleSwap = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "❌ Erro",
        description: "Insira um valor válido",
        variant: "destructive"
      });
      return;
    }

    if (!fromBalance || parseFloat(amount) > fromBalance.balance) {
      toast({
        title: "❌ Saldo insuficiente",
        description: `Você só tem ${fromBalance?.balance.toFixed(6) || 0} ${fromToken}`,
        variant: "destructive"
      });
      return;
    }

    setSwapping(true);
    try {
      // Buscar credenciais do banco de dados Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: configData, error: configError } = await supabase
        .from('exchange_api_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('exchange', exchange)
        .single();

      if (configError || !configData) {
        throw new Error(`Credenciais da ${exchangeNames[exchange]} não configuradas no banco de dados. Configure em Controle de Arbitragem.`);
      }

      const credentials = exchange === 'binance' 
        ? {
            apiKey: configData.api_key,
            secretKey: configData.secret_key
          }
        : {
            apiKey: configData.api_key,
            secretKey: configData.secret_key,
            passphrase: configData.passphrase
          };

      toast({
        title: "🔄 Processando conversão",
        description: `${amount} ${fromToken} → ${toToken}...`,
      });

      // Determinar direção baseada nos tokens
      let direction: 'toUsdt' | 'toToken';
      let symbol: string;

      if (fromToken === 'USDT') {
        direction = 'toToken';
        symbol = toToken;
      } else if (toToken === 'USDT') {
        direction = 'toUsdt';
        symbol = fromToken;
      } else {
        // Conversão entre dois tokens (fazer em 2 steps)
        throw new Error('Conversão direta entre tokens não-USDT não suportada ainda. Converta primeiro para USDT.');
      }

      const functionName = exchange === 'binance' 
        ? 'binance-swap-token' 
        : 'okx-swap-token';

      console.log(`🔄 Chamando ${functionName} com:`, {
        exchange,
        symbol,
        direction,
        amount: parseFloat(amount),
        hasApiKey: !!credentials.apiKey,
        hasSecretKey: !!credentials.secretKey,
        hasPassphrase: exchange === 'okx' ? !!(credentials as any).passphrase : 'N/A'
      });

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          ...credentials, 
          symbol, 
          direction, 
          customAmount: parseFloat(amount) 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "✅ Conversão concluída!",
          description: `${amount} ${fromToken} → ${estimatedReceive.toFixed(6)} ${toToken}`,
        });
        
        onOpenChange(false);
        setAmount('');
        
        // Callback para atualizar saldos
        await onSwapComplete();
      } else {
        throw new Error(data.error || 'Erro na conversão');
      }

    } catch (error: any) {
      console.error('Erro na conversão:', error);
      toast({
        title: "❌ Erro na conversão",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setSwapping(false);
    }
  };

  const handleMaxAmount = () => {
    if (fromBalance) {
      setAmount(fromBalance.balance.toString());
    }
  };

  const handleSwapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Converter Tokens - {exchangeNames[exchange]}</DialogTitle>
          <DialogDescription>
            Converta entre diferentes tokens na sua carteira
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Token de Origem */}
          <div className="space-y-2">
            <Label htmlFor="from-token">De:</Label>
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger id="from-token" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {availableTokens.map((token) => (
                  <SelectItem 
                    key={token.symbol} 
                    value={token.symbol}
                    className="cursor-pointer hover:bg-muted"
                  >
                    <div className="flex items-center justify-between w-full gap-4">
                      <span className="font-semibold">{token.symbol}</span>
                      <span className="text-xs text-muted-foreground">
                        Saldo: {token.balance.toFixed(6)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {fromBalance && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Disponível:</span>
                <Badge variant="outline">
                  {fromBalance.balance.toFixed(6)} {fromToken}
                  {fromBalance.valueUsd > 0 && ` ($${fromBalance.valueUsd.toFixed(2)})`}
                </Badge>
              </div>
            )}
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="amount">Valor:</Label>
            <div className="flex gap-2">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.000001"
                min="0"
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleMaxAmount}
                disabled={!fromBalance || fromBalance.balance <= 0}
              >
                MAX
              </Button>
            </div>
          </div>

          {/* Botão de Inverter */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSwapTokens}
              className="rounded-full"
            >
              <ArrowDown className="h-5 w-5" />
            </Button>
          </div>

          {/* Token de Destino */}
          <div className="space-y-2">
            <Label htmlFor="to-token">Para:</Label>
            <Select value={toToken} onValueChange={setToToken}>
              <SelectTrigger id="to-token" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border z-50">
                {availableTokens
                  .filter(token => token.symbol !== fromToken)
                  .map((token) => (
                    <SelectItem 
                      key={token.symbol} 
                      value={token.symbol}
                      className="cursor-pointer hover:bg-muted"
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        <span className="font-semibold">{token.symbol}</span>
                        <span className="text-xs text-muted-foreground">
                          Preço: ${token.priceUsd.toFixed(2)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            
            {estimatedReceive > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Você receberá (estimado):</span>
                <Badge className="bg-green-500">
                  ≈ {estimatedReceive.toFixed(6)} {toToken}
                </Badge>
              </div>
            )}
          </div>

          {/* Resumo */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 border rounded-lg bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxa estimada:</span>
                <span>≈ 0.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor convertido:</span>
                <span className="font-semibold">
                  ${(parseFloat(amount) * (fromBalance?.priceUsd || 0)).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Botão de Conversão */}
          <Button
            onClick={handleSwap}
            disabled={swapping || !amount || parseFloat(amount) <= 0}
            className="w-full"
            size="lg"
          >
            <ArrowRightLeft className={`h-4 w-4 mr-2 ${swapping ? 'animate-spin' : ''}`} />
            {swapping ? 'Convertendo...' : 'Converter'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
