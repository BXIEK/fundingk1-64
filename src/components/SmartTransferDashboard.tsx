import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, ArrowRightLeft, TrendingUp, Clock, DollarSign, AlertTriangle } from "lucide-react";

interface TransferAnalysis {
  symbol: string;
  amount: number;
  sourceExchange: string;
  targetExchange: string;
  arbitrageSpread: number;
  transferCosts: {
    withdrawalFee: number;
    depositFee: number;
    networkFee: number;
    tradingFees: number;
    totalCosts: number;
    totalCostsPercentage: number;
  };
  netProfitAfterTransfer: number;
  isWorthwhile: boolean;
  estimatedTime: number;
}

const SmartTransferDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<TransferAnalysis | null>(null);
  const [formData, setFormData] = useState({
    symbol: 'BTC',
    requiredAmount: 0.1,
    currentPrice: 45000,
    spreadPercent: 1.5
  });
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (formData.requiredAmount <= 0 || formData.currentPrice <= 0 || formData.spreadPercent <= 0) {
      toast({
        title: "Dados Inválidos",
        description: "Preencha todos os campos com valores válidos",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Simular user_id para demo (em produção seria obtido da sessão)
      const userId = "56a7ead2-d318-958c-1fa9-4b981bbfd3fc";
      
      const { data, error } = await supabase.functions.invoke('smart-cross-exchange-transfer', {
        body: {
          user_id: userId,
          symbol: formData.symbol,
          required_amount: formData.requiredAmount,
          current_price: formData.currentPrice,
          arbitrage_spread_percent: formData.spreadPercent,
          execute: false // Apenas análise
        }
      });

      if (error) throw error;

      setAnalysis(data.analysis);
      
      toast({
        title: data.analysis.isWorthwhile ? "✅ Transferência Recomendada" : "⚠️ Transferência Não Recomendada",
        description: data.message,
        duration: 5000
      });

    } catch (error) {
      console.error('Erro na análise:', error);
      toast({
        title: "Erro na Análise",
        description: error.message || "Erro ao analisar transferência",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTransfer = async () => {
    if (!analysis || !analysis.isWorthwhile) {
      toast({
        title: "Transferência Não Recomendada",
        description: "A análise não recomenda esta transferência",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const userId = "56a7ead2-d318-958c-1fa9-4b981bbfd3fc";
      
      const { data, error } = await supabase.functions.invoke('smart-cross-exchange-transfer', {
        body: {
          user_id: userId,
          symbol: formData.symbol,
          required_amount: formData.requiredAmount,
          current_price: formData.currentPrice,
          arbitrage_spread_percent: formData.spreadPercent,
          binance_api_key: "demo_key",
          binance_secret_key: "demo_secret",
          pionex_deposit_address: "demo_address",
          execute: true
        }
      });

      if (error) throw error;

      toast({
        title: data.transfer_executed ? "✅ Transferência Executada" : "⚠️ Transferência Não Executada",
        description: data.message,
        duration: 8000
      });

    } catch (error) {
      console.error('Erro na execução:', error);
      toast({
        title: "Erro na Execução",
        description: error.message || "Erro ao executar transferência",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const getRecommendationColor = (isWorthwhile: boolean) => {
    return isWorthwhile ? "text-success" : "text-destructive";
  };

  const getRecommendationBadge = (isWorthwhile: boolean) => {
    return (
      <Badge variant={isWorthwhile ? "default" : "destructive"}>
        {isWorthwhile ? "Recomendada" : "Não Recomendada"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferência Inteligente Cross-Exchange
          </CardTitle>
          <CardDescription>
            Analise custos vs lucros antes de transferir saldos entre exchanges para arbitragem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Token/Símbolo</Label>
              <Select value={formData.symbol} onValueChange={(value) => setFormData(prev => ({...prev, symbol: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                  <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                  <SelectItem value="BNB">Binance Coin (BNB)</SelectItem>
                  <SelectItem value="USDT">Tether (USDT)</SelectItem>
                  <SelectItem value="SOL">Solana (SOL)</SelectItem>
                  <SelectItem value="XRP">Ripple (XRP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount">Quantidade Necessária</Label>
              <Input
                id="amount"
                type="number"
                step="0.0001"
                value={formData.requiredAmount}
                onChange={(e) => setFormData(prev => ({...prev, requiredAmount: parseFloat(e.target.value) || 0}))}
                placeholder="0.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Preço Atual ($)</Label>
              <Input
                id="price"
                type="number"
                value={formData.currentPrice}
                onChange={(e) => setFormData(prev => ({...prev, currentPrice: parseFloat(e.target.value) || 0}))}
                placeholder="45000"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="spread">Spread da Arbitragem (%)</Label>
              <Input
                id="spread"
                type="number"
                step="0.01"
                value={formData.spreadPercent}
                onChange={(e) => setFormData(prev => ({...prev, spreadPercent: parseFloat(e.target.value) || 0}))}
                placeholder="1.5"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleAnalyze} 
              disabled={loading}
              className="flex-1"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
              Analisar Transferência
            </Button>
            
            {analysis?.isWorthwhile && (
              <Button 
                onClick={handleExecuteTransfer}
                disabled={loading}
                variant="default"
                className="flex-1"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                Executar Transferência
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultado da Análise</span>
              {getRecommendationBadge(analysis.isWorthwhile)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-primary">{analysis.amount.toFixed(4)}</div>
                <div className="text-sm text-muted-foreground">{analysis.symbol} Necessário</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{analysis.arbitrageSpread.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">Spread Arbitragem</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">{analysis.transferCosts.totalCostsPercentage.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">Custos Totais</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className={`text-2xl font-bold ${getRecommendationColor(analysis.isWorthwhile)}`}>
                  {formatCurrency(analysis.netProfitAfterTransfer)}
                </div>
                <div className="text-sm text-muted-foreground">Lucro Líquido</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Breakdown de Custos
              </h4>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span>Taxa de Saque:</span>
                  <span>{formatCurrency(analysis.transferCosts.withdrawalFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Rede:</span>
                  <span>{formatCurrency(analysis.transferCosts.networkFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Depósito:</span>
                  <span>{formatCurrency(analysis.transferCosts.depositFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxas de Trading:</span>
                  <span>{formatCurrency(analysis.transferCosts.tradingFees)}</span>
                </div>
              </div>
              
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total de Custos:</span>
                <span>{formatCurrency(analysis.transferCosts.totalCosts)}</span>
              </div>
            </div>

            {analysis.estimatedTime > 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Tempo estimado de transferência: <strong>{analysis.estimatedTime} minutos</strong>
                </AlertDescription>
              </Alert>
            )}

            {!analysis.isWorthwhile && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Transferência não recomendada: Os custos de transferência ({analysis.transferCosts.totalCostsPercentage.toFixed(2)}%) 
                  são muito altos em relação ao spread da arbitragem ({analysis.arbitrageSpread.toFixed(2)}%).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartTransferDashboard;