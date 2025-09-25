import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, DollarSign, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/userUtils";

interface FuturesAsset {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  maintMargin: string;
  initialMargin: string;
  positionInitialMargin: string;
  openOrderInitialMargin: string;
}

interface FuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  positionSide: string;
}

interface FuturesBalance {
  totalWalletBalance: string;
  totalUnrealizedProfit: string;  
  totalMarginBalance: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  assets: FuturesAsset[];
  positions: FuturesPosition[];
  source?: string;
  reason?: string;
}

export const BinanceFuturesBalance = () => {
  const { toast } = useToast();
  const [balance, setBalance] = useState<FuturesBalance | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchFuturesBalance = async () => {
    setLoading(true);
    
    try {
      const userId = await getUserId();
      const binanceCredentials = localStorage.getItem('binance_credentials');
      
      if (!binanceCredentials) {
        toast({
          title: "Credenciais não encontradas",
          description: "Configure suas credenciais da Binance primeiro",
          variant: "destructive"
        });
        return;
      }

      const credentials = JSON.parse(binanceCredentials);

      const { data, error } = await supabase.functions.invoke('binance-futures-balance', {
        body: {
          binanceApiKey: credentials.apiKey,
          binanceSecretKey: credentials.secretKey,
          userId: userId
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setBalance(data.balance);
        setLastUpdate(new Date());
        
        if (data.balance.source === 'simulated') {
          toast({
            title: "⚠️ Dados Simulados",
            description: data.message || "Usando dados simulados devido a restrições da API",
            variant: "destructive"
          });
        } else {
          toast({
            title: "✅ Saldo Atualizado",
            description: "Saldo de futures obtido com sucesso da Binance"
          });
        }
      } else {
        throw new Error(data.error);
      }

    } catch (error: any) {
      console.error('Erro ao buscar saldo:', error);
      toast({
        title: "Erro ao buscar saldo",
        description: error.message || "Não foi possível obter o saldo de futures",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFuturesBalance();
  }, []);

  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(num);
  };

  const formatPercentage = (value: string) => {
    const num = parseFloat(value);
    return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
  };

  const getProfitColor = (value: string) => {
    const num = parseFloat(value);
    if (num > 0) return 'text-green-600';
    if (num < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Resumo Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Saldo Binance Futures
              </CardTitle>
              <CardDescription>
                {lastUpdate ? `Última atualização: ${lastUpdate.toLocaleString('pt-BR')}` : 'Carregando...'}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFuturesBalance}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {balance ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(balance.totalWalletBalance)}
                </div>
                <div className="text-sm text-gray-600">Saldo Total</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(balance.totalMarginBalance)}
                </div>
                <div className="text-sm text-gray-600">Margem Total</div>
              </div>
              
              <div className={`text-center p-4 rounded-lg ${
                parseFloat(balance.totalUnrealizedProfit) >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className={`text-2xl font-bold flex items-center justify-center gap-1 ${getProfitColor(balance.totalUnrealizedProfit)}`}>
                  {parseFloat(balance.totalUnrealizedProfit) >= 0 ? 
                    <TrendingUp className="h-5 w-5" /> : 
                    <TrendingDown className="h-5 w-5" />
                  }
                  {formatCurrency(balance.totalUnrealizedProfit)}
                </div>
                <div className="text-sm text-gray-600">PnL Não Realizado</div>
              </div>

              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(balance.totalPositionInitialMargin)}
                </div>
                <div className="text-sm text-gray-600">Margem Posições</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-gray-600">Carregando saldo...</p>
            </div>
          )}

          {balance?.source === 'simulated' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                Dados simulados devido a restrições geográficas da Binance
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assets */}
      {balance && balance.assets && balance.assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Assets em Futures</CardTitle>
            <CardDescription>Seus ativos disponíveis na conta futures</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">PnL Não Realizado</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Margem Inicial</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.assets.map((asset, index) => (
                  <TableRow key={`${asset.asset}-${index}`}>
                    <TableCell>
                      <Badge variant="secondary">{asset.asset}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(asset.walletBalance)}
                    </TableCell>
                    <TableCell className={`text-right ${getProfitColor(asset.unrealizedProfit)}`}>
                      {formatCurrency(asset.unrealizedProfit)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(asset.marginBalance)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(asset.initialMargin)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Posições Abertas */}
      {balance && balance.positions && balance.positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Posições Abertas</CardTitle>
            <CardDescription>Suas posições ativas em futures</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Símbolo</TableHead>
                  <TableHead>Lado</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Preço Entrada</TableHead>
                  <TableHead className="text-right">Preço Atual</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balance.positions.map((position, index) => (
                  <TableRow key={`${position.symbol}-${index}`}>
                    <TableCell>
                      <Badge variant="outline">{position.symbol}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={position.positionSide === 'LONG' ? 'default' : 'destructive'}>
                        {position.positionSide}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{position.positionAmt}</TableCell>
                    <TableCell className="text-right">{formatCurrency(position.entryPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(position.markPrice)}</TableCell>
                    <TableCell className={`text-right ${getProfitColor(position.unRealizedProfit)}`}>
                      {formatCurrency(position.unRealizedProfit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Mensagem quando não há posições */}
      {balance && (!balance.positions || balance.positions.length === 0) && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-600">Nenhuma posição aberta encontrada</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};