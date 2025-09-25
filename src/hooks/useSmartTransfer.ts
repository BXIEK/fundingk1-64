import { useState, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

interface SmartTransferOptions {
  symbol: string;
  requiredAmount: number;
  currentPrice: number;
  arbitrageSpreadPercent: number;
  execute?: boolean;
  binanceApiKey?: string;
  binanceSecretKey?: string;
  pionexDepositAddress?: string;
}

interface SmartTransferResult {
  success: boolean;
  analysis: TransferAnalysis;
  transferExecuted?: boolean;
  transferId?: string;
  transferError?: string;
  estimatedArrivalTime?: number;
  message: string;
}

export const useSmartTransfer = () => {
  const [loading, setLoading] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<TransferAnalysis | null>(null);
  const { toast } = useToast();

  const analyzeTransfer = useCallback(async (
    userId: string,
    options: SmartTransferOptions
  ): Promise<SmartTransferResult | null> => {
    if (!userId || !options.symbol || options.requiredAmount <= 0) {
      toast({
        title: "Dados Inválidos",
        description: "Parâmetros obrigatórios não fornecidos",
        variant: "destructive"
      });
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-cross-exchange-transfer', {
        body: {
          user_id: userId,
          symbol: options.symbol,
          required_amount: options.requiredAmount,
          current_price: options.currentPrice,
          arbitrage_spread_percent: options.arbitrageSpreadPercent,
          execute: false // Apenas análise
        }
      });

      if (error) {
        console.error('Erro na análise de transferência:', error);
        toast({
          title: "Erro na Análise",
          description: error.message || "Erro ao analisar transferência",
          variant: "destructive"
        });
        return null;
      }

      setLastAnalysis(data.analysis);
      return data as SmartTransferResult;

    } catch (error) {
      console.error('Erro na análise:', error);
      toast({
        title: "Erro na Análise",
        description: error.message || "Erro interno",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const executeTransfer = useCallback(async (
    userId: string,
    options: SmartTransferOptions
  ): Promise<SmartTransferResult | null> => {
    if (!options.binanceApiKey || !options.binanceSecretKey) {
      toast({
        title: "API Keys Necessárias",
        description: "Configure as API keys da Binance primeiro",
        variant: "destructive"
      });
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('smart-cross-exchange-transfer', {
        body: {
          user_id: userId,
          symbol: options.symbol,
          required_amount: options.requiredAmount,
          current_price: options.currentPrice,
          arbitrage_spread_percent: options.arbitrageSpreadPercent,
          binance_api_key: options.binanceApiKey,
          binance_secret_key: options.binanceSecretKey,
          pionex_deposit_address: options.pionexDepositAddress,
          execute: true
        }
      });

      if (error) {
        console.error('Erro na execução da transferência:', error);
        toast({
          title: "Erro na Execução",
          description: error.message || "Erro ao executar transferência",
          variant: "destructive"
        });
        return null;
      }

      // Mostrar resultado
      toast({
        title: data.transfer_executed ? "✅ Transferência Executada" : "⚠️ Transferência Não Executada",
        description: data.message,
        duration: data.transfer_executed ? 10000 : 6000
      });

      setLastAnalysis(data.analysis);
      return data as SmartTransferResult;

    } catch (error) {
      console.error('Erro na execução:', error);
      toast({
        title: "Erro na Execução", 
        description: error.message || "Erro interno",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Função auxiliar para calcular se transferência vale a pena
  const isTransferWorthwhile = useCallback((
    spreadPercent: number,
    transferCostPercent: number,
    minProfitThreshold: number = 2.0
  ): boolean => {
    const netSpread = spreadPercent - transferCostPercent;
    return netSpread > 0 && netSpread > (minProfitThreshold / 100);
  }, []);

  return {
    loading,
    lastAnalysis,
    analyzeTransfer,
    executeTransfer,
    isTransferWorthwhile
  };
};