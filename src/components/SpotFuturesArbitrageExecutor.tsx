import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, ArrowLeftRight, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/userUtils";
import { useTradingMode } from "@/contexts/TradingModeContext";

interface ExecutionResult {
  success: boolean;
  operation_id?: string;
  message?: string;
  details?: {
    symbol: string;
    amount_executed: number;
    from_token: string;
    to_token: string;
    spread_captured: number;
    total_costs: number;
    net_profit_percent: number;
    expected_profit_usd: number;
    conversion_performed: boolean;
    conversion_amount: number;
  };
  error?: string;
}

export const SpotFuturesArbitrageExecutor = () => {
  const { isRealMode } = useTradingMode();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  
  const [formData, setFormData] = useState({
    amount: 0.01,
    fromToken: 'BTC',
    toToken: 'USDT'
  });

  const tokens = ['BTC', 'ETH', 'BNB', 'USDT', 'USDC', 'MATIC', 'SOL', 'ADA'];
  
  // Função para determinar o símbolo baseado nos tokens
  const getSymbolFromTokens = (fromToken: string, toToken: string): string => {
    // Priorizar pares principais com USDT
    if (fromToken !== 'USDT' && toToken === 'USDT') {
      return `${fromToken}USDT`;
    }
    if (fromToken === 'USDT' && toToken !== 'USDT') {
      return `${toToken}USDT`;
    }
    // Para outros casos, usar USDT como base
    if (fromToken !== 'USDT' && toToken !== 'USDT') {
      return `${fromToken}USDT`;
    }
    // Caso padrão USDT/USDC
    return 'BTCUSDT';
  };

  const handleExecute = async () => {
    if (!formData.amount || !formData.fromToken || !formData.toToken) {
      toast({
        title: "Erro de Validação",
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (formData.fromToken === formData.toToken) {
      toast({
        title: "Erro de Validação", 
        description: "Token de origem deve ser diferente do token de destino",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const userId = await getUserId();
      if (!userId) {
        throw new Error('Usuário não autenticado - configure suas credenciais de API');
      }

      const symbol = getSymbolFromTokens(formData.fromToken, formData.toToken);

      const { data, error } = await supabase.functions.invoke('spot-futures-arbitrage', {
        body: {
          symbol: symbol,
          amount: formData.amount,
          fromToken: formData.fromToken,
          toToken: formData.toToken,
          userId: userId,
          mode: isRealMode ? 'real' : 'simulated'
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      setResult(data);

      if (data.success) {
        toast({
          title: "✅ Arbitragem Executada!",
          description: `Operação concluída com lucro de ${data.details.net_profit_percent.toFixed(2)}%`,
        });
      } else {
        toast({
          title: "❌ Execução Falhou",
          description: data.error || "Erro desconhecido",
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Erro na execução:', error);
      toast({
        title: "Erro de Execução",
        description: error.message || "Erro ao executar arbitragem",
        variant: "destructive"
      });
      setResult({
        success: false,
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Arbitragem Spot-Futures com Conversão Automática
          </CardTitle>
          <CardDescription>
            Execute arbitragem entre mercados spot e futures com conversão inteligente de tokens
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Quantidade</Label>
              <Input
                id="amount"
                type="number"
                step="0.001"
                min="0.001"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  amount: parseFloat(e.target.value) || 0 
                }))}
                placeholder="0.01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fromToken">Token de Origem</Label>
              <Select value={formData.fromToken} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, fromToken: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map(token => (
                    <SelectItem key={token} value={token}>{token}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="toToken">Token de Destino</Label>
              <Select value={formData.toToken} onValueChange={(value) => 
                setFormData(prev => ({ ...prev, toToken: value }))
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tokens.map(token => (
                    <SelectItem key={token} value={token}>{token}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleExecute} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Executando Arbitragem...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Executar Arbitragem Spot-Futures
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado da Execução */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Resultado da Operação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success && result.details ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {result.details.net_profit_percent.toFixed(2)}%
                    </div>
                    <div className="text-sm text-gray-600">Lucro Líquido</div>
                  </div>
                  
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      ${result.details.expected_profit_usd.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">Lucro USD</div>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {result.details.spread_captured.toFixed(3)}%
                    </div>
                    <div className="text-sm text-gray-600">Spread Capturado</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">Par Negociado:</span>
                    <Badge variant="secondary" className="text-sm">{result.details.symbol}</Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-gray-600">Quantidade Executada:</span>
                    <span className="font-medium text-lg">{result.details.amount_executed} {result.details.symbol.replace('USDT', '').replace('USDC', '')}</span>
                  </div>
                  
                  <div className="border rounded-lg p-3 bg-blue-50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-blue-700 font-medium">Conversão de Tokens:</span>
                      <Badge variant={result.details.conversion_performed ? "default" : "secondary"}>
                        {result.details.conversion_performed ? "✓ Realizada" : "✗ Não Necessária"}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-center space-x-3 text-lg">
                      <div className="text-center">
                        <div className="font-bold text-blue-600">{result.details.from_token}</div>
                        {result.details.conversion_performed && (
                          <div className="text-sm text-gray-600">
                            {result.details.conversion_amount.toFixed(6)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center">
                        <ArrowLeftRight className="h-5 w-5 text-blue-500" />
                      </div>
                      
                      <div className="text-center">
                        <div className="font-bold text-green-600">{result.details.to_token}</div>
                        {result.details.conversion_performed && (
                          <div className="text-sm text-gray-600">
                            {(result.details.conversion_amount * (result.details.expected_profit_usd / result.details.conversion_amount || 1)).toFixed(6)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {result.details.conversion_performed && (
                      <div className="mt-2 text-center text-sm text-gray-600">
                        Taxa de Conversão Aplicada
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="text-red-700">Custos Totais:</span>
                    <span className="font-medium text-red-600">{result.details.total_costs.toFixed(3)}%</span>
                  </div>
                </div>

                {result.operation_id && (
                  <div className="text-center p-2 bg-gray-50 rounded text-sm text-gray-500">
                    ID da Operação: {result.operation_id}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center p-4 text-red-600">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                <p className="font-medium">Falha na Execução</p>
                <p className="text-sm mt-1">{result.error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações da Estratégia */}
      <Card>
        <CardHeader>
          <CardTitle>Como Funciona</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
            <div>
              <strong>Análise de Spread:</strong> Avalia diferenças de preço entre mercados spot e futures
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">2</div>
            <div>
              <strong>Conversão Inteligente:</strong> Converte tokens quando necessário para executar a operação
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">3</div>
            <div>
              <strong>Execução Otimizada:</strong> Só executa se o spread for maior que os custos operacionais
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">4</div>
            <div>
              <strong>Transferência Automática:</strong> Gerencia transferências entre contas spot e futures
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};