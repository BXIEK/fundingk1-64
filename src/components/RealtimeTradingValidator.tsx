import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Shield, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { getUserId } from '@/lib/userUtils';

interface TradingValidation {
  operation_allowed: boolean;
  operation_type: string;
  symbol: string;
  amount: number;
  balance_check: {
    symbol: string;
    total_balance: number;
    locked_balance: number;
    available_balance: number;
    requested_amount: number;
    sufficient: boolean;
    exchange?: string;
  };
  error_message?: string;
  timestamp: string;
}

export default function RealtimeTradingValidator() {
  const [symbol, setSymbol] = useState('BTC');
  const [operationType, setOperationType] = useState<'buy' | 'sell' | 'transfer'>('buy');
  const [amount, setAmount] = useState('');
  const [exchangeFrom, setExchangeFrom] = useState('Binance');
  const [exchangeTo, setExchangeTo] = useState('OKX');
  const [validation, setValidation] = useState<TradingValidation | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const validateTradingOperation = async () => {
    if (!amount || isNaN(parseFloat(amount))) {
      toast({
        title: "Erro de Validação",
        description: "Por favor, insira um valor válido",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const userId = await getUserId();
      
      const { data, error } = await supabase.rpc('enable_realtime_trading', {
        p_user_id: userId,
        p_symbol: symbol,
        p_operation_type: operationType,
        p_amount: parseFloat(amount),
        p_exchange_from: operationType !== 'buy' ? exchangeFrom : null,
        p_exchange_to: operationType === 'transfer' ? exchangeTo : null
      });

      if (error) {
        throw error;
      }

      setValidation(data as unknown as TradingValidation);

      if ((data as unknown as TradingValidation).operation_allowed) {
        toast({
          title: "✅ Operação Permitida",
          description: `Operação de ${operationType} autorizada para ${amount} ${symbol}`,
        });
      } else {
        toast({
          title: "❌ Operação Negada",
          description: (data as unknown as TradingValidation).error_message || "Saldo insuficiente para a operação",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro na validação:', error);
      toast({
        title: "Erro",
        description: "Erro ao validar operação de trading",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Validador de Trading em Tempo Real
        </CardTitle>
        <CardDescription>
          Valide operações de trading antes da execução para garantir saldos suficientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="operation-type">Tipo de Operação</Label>
            <Select value={operationType} onValueChange={(value: 'buy' | 'sell' | 'transfer') => setOperationType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">Comprar</SelectItem>
                <SelectItem value="sell">Vender</SelectItem>
                <SelectItem value="transfer">Transferir</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="symbol">Ativo</Label>
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                <SelectItem value="BNB">BNB</SelectItem>
                <SelectItem value="SOL">Solana (SOL)</SelectItem>
                <SelectItem value="USDT">Tether (USDT)</SelectItem>
                <SelectItem value="USDC">USD Coin (USDC)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Quantidade</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              placeholder="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          {(operationType === 'sell' || operationType === 'transfer') && (
            <div className="space-y-2">
              <Label htmlFor="exchange-from">Exchange Origem</Label>
              <Select value={exchangeFrom} onValueChange={setExchangeFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Binance">Binance</SelectItem>
                  <SelectItem value="OKX">OKX</SelectItem>
                  <SelectItem value="Bybit">Bybit</SelectItem>
                  <SelectItem value="MEXC">MEXC</SelectItem>
                  <SelectItem value="Hyperliquid">Hyperliquid</SelectItem>
                  <SelectItem value="Pionex">Pionex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {operationType === 'transfer' && (
            <div className="space-y-2">
              <Label htmlFor="exchange-to">Exchange Destino</Label>
              <Select value={exchangeTo} onValueChange={setExchangeTo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Binance">Binance</SelectItem>
                  <SelectItem value="OKX">OKX</SelectItem>
                  <SelectItem value="Bybit">Bybit</SelectItem>
                  <SelectItem value="MEXC">MEXC</SelectItem>
                  <SelectItem value="Hyperliquid">Hyperliquid</SelectItem>
                  <SelectItem value="Pionex">Pionex</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <Button onClick={validateTradingOperation} disabled={isLoading} className="w-full">
          {isLoading ? (
            <Clock className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Shield className="h-4 w-4 mr-2" />
          )}
          Validar Operação
        </Button>

        {validation && (
          <Card className={`border-2 ${validation.operation_allowed ? 'border-green-500' : 'border-red-500'}`}>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {validation.operation_allowed ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {validation.operation_allowed ? 'Operação Autorizada' : 'Operação Negada'}
                  </span>
                </div>
                <Badge variant={validation.operation_allowed ? 'default' : 'destructive'}>
                  {validation.operation_type.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Ativo</p>
                  <p className="font-mono">{validation.symbol}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Quantidade</p>
                  <p className="font-mono">{validation.amount}</p>
                </div>
              </div>

              {validation.balance_check && (
                <div className="space-y-2">
                  <h4 className="font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Verificação de Saldo
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Saldo Total</p>
                      <p className="font-mono">{validation.balance_check.total_balance}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Disponível</p>
                      <p className="font-mono text-green-600">{validation.balance_check.available_balance}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Bloqueado</p>
                      <p className="font-mono text-orange-600">{validation.balance_check.locked_balance}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Necessário</p>
                      <p className="font-mono">{validation.balance_check.requested_amount}</p>
                    </div>
                  </div>
                </div>
              )}

              {validation.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{validation.error_message}</p>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                Validado em: {new Date(validation.timestamp).toLocaleString('pt-BR')}
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}