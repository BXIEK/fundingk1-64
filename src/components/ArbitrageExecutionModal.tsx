import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, DollarSign, Percent, Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { z } from 'zod';
import { toast } from "sonner";

interface SyntheticPairOpportunity {
  id: string;
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  spread: number;
  potential: number;
  net_profit: number;
  risk_level: string;
  base_currency: string;
  quote_currency: string;
  transfer_fee: number;
  transfer_time: number;
}

interface ArbitrageConfig {
  investmentAmount: number;
  maxSlippage: number;
  customFeeRate: number;
  stopLossPercentage: number;
  prioritizeSpeed: boolean;
}

interface ArbitrageExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  opportunity: SyntheticPairOpportunity | null;
  onExecute: (opportunity: SyntheticPairOpportunity, config: ArbitrageConfig) => void;
  isExecuting: boolean;
}

const configSchema = z.object({
  investmentAmount: z.number().min(25, "Valor mínimo: $25 USDT (Binance exige $10/ordem × 2 ordens)").max(1000, "Valor máximo: $1,000"),
  maxSlippage: z.number().min(0.10, "Slippage mínimo: 0.10%").max(5, "Slippage máximo: 5%"),
  customFeeRate: z.number().min(0.1, "Taxa mínima: 0.1%").max(1.0, "Taxa máxima: 1.0%"),
  stopLossPercentage: z.number().min(1, "Stop loss mínimo: 1%").max(10, "Stop loss máximo: 10%"),
});

const ArbitrageExecutionModal: React.FC<ArbitrageExecutionModalProps> = ({
  isOpen,
  onClose,
  opportunity,
  onExecute,
  isExecuting
}) => {
  const [config, setConfig] = useState<ArbitrageConfig>({
    investmentAmount: 25, // USDT (mínimo $25 para 2 ordens de $12.5)
    maxSlippage: 0.10, // Mínimo 0.10% para execução precisa
    customFeeRate: 0.2,
    stopLossPercentage: 2.0,
    prioritizeSpeed: true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateConfig = () => {
    try {
      configSchema.parse(config);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const calculateProjectedResults = () => {
    if (!opportunity) return null;

    // Spread real da oportunidade (%)
    const spreadPercentage = opportunity.spread;
    
    // Slippage reduz o spread efetivo (não dobra o impacto)
    const effectiveSpread = Math.max(0, spreadPercentage - config.maxSlippage);
    
    // Lucro bruto baseado no spread efetivo
    const grossProfit = (config.investmentAmount * effectiveSpread) / 100;
    
    // Preços ajustados para exibição (apenas visual)
    const slippageMultiplier = config.maxSlippage / 100;
    const adjustedBuyPrice = opportunity.buy_price * (1 + slippageMultiplier / 2);
    const adjustedSellPrice = opportunity.sell_price * (1 - slippageMultiplier / 2);
    const quantity = config.investmentAmount / opportunity.buy_price;
    
    // Taxas de trading em ambas exchanges (compra + venda)
    const tradingFees = (config.investmentAmount * config.customFeeRate / 100);
    
    // Taxa fixa da rede Arbitrum para transferência
    const arbitrumFee = 0.10;
    
    // Total de taxas
    const totalFees = tradingFees + arbitrumFee;
    
    // Lucro líquido
    const netProfit = grossProfit - totalFees;
    
    // ROI
    const roi = (netProfit / config.investmentAmount) * 100;
    
    // Spread mínimo necessário para break-even
    // Precisa cobrir: taxas de trading + slippage + taxa Arbitrum
    const breakEvenSpread = config.customFeeRate + config.maxSlippage + ((arbitrumFee / config.investmentAmount) * 100);

    return {
      grossProfit,
      tradingFees,
      arbitrumFee,
      totalFees,
      netProfit,
      roi,
      breakEvenSpread,
      quantity,
      adjustedBuyPrice,
      adjustedSellPrice
    };
  };

  const handleExecute = () => {
    if (!opportunity || !validateConfig()) {
      toast.error("Por favor, corrija os erros de configuração");
      return;
    }

    const projected = calculateProjectedResults();
    if (projected && projected.netProfit <= 0) {
      toast.warning("⚠️ Aviso: Esta operação pode resultar em prejuízo!");
    }

    onExecute(opportunity, config);
  };

  const projected = calculateProjectedResults();
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  };

  if (!opportunity) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Configurar Execução de Arbitragem
          </DialogTitle>
          <DialogDescription>
            Configure os parâmetros para executar a arbitragem {opportunity.symbol}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Opportunity Summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{opportunity.symbol}</CardTitle>
              <CardDescription>
                {opportunity.buy_exchange} → {opportunity.sell_exchange}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Spread Atual</div>
                  <div className="font-semibold text-primary">{opportunity.spread.toFixed(3)}%</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Preço Compra</div>
                  <div className="font-semibold">{formatCurrency(opportunity.buy_price)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Preço Venda</div>
                  <div className="font-semibold">{formatCurrency(opportunity.sell_price)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Network Information */}
          <Card className="border-blue-200 bg-blue-50 dark:bg-slate-800 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Informações da Rede de Transferência
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Rede Utilizada:</div>
                  <div className="font-semibold text-blue-700 dark:text-blue-400">
                    {(() => {
                      const symbol = opportunity.symbol;
                      if (['USDT', 'USDC', 'ETH', 'LINK', 'UNI', 'PEPE', 'SHIB'].includes(symbol)) {
                        return '⚡ Arbitrum (Rápida)';
                      }
                      if (symbol === 'SOL' || symbol === 'WIF') return 'Solana';
                      if (symbol === 'AVAX') return 'Avalanche C-Chain';
                      if (symbol === 'BTC') return 'Bitcoin';
                      if (symbol === 'DOT') return 'Polkadot';
                      if (symbol === 'ADA') return 'Cardano';
                      if (symbol === 'ATOM') return 'Cosmos';
                      if (symbol === 'BNB') return 'BSC';
                      if (symbol === 'LTC') return 'Litecoin';
                      return 'Nativa';
                    })()}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Tempo Estimado:</div>
                  <div className="font-semibold text-blue-700 dark:text-blue-400">
                    {(() => {
                      const symbol = opportunity.symbol;
                      if (['USDT', 'USDC', 'ETH', 'LINK', 'UNI', 'PEPE', 'SHIB'].includes(symbol)) {
                        return '2-5 minutos';
                      }
                      if (symbol === 'SOL' || symbol === 'WIF') return '1-2 minutos';
                      if (symbol === 'AVAX' || symbol === 'DOT') return '2-5 minutos';
                      if (symbol === 'ATOM') return '3-7 minutos';
                      if (symbol === 'BTC') return '10-60 minutos';
                      if (symbol === 'ADA') return '5-10 minutos';
                      return '5-10 minutos';
                    })()}
                  </div>
                </div>
              </div>
              
              <div className="p-2 bg-white dark:bg-slate-900 rounded border border-blue-200 dark:border-slate-600">
                <div className="text-xs text-blue-900 dark:text-blue-300 font-medium mb-1">
                  ⚡ Arbitrum (2-5 min, taxa $0.10):
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {['USDT', 'USDC', 'ETH', 'LINK', 'UNI', 'PEPE', 'SHIB'].map(token => (
                    <Badge 
                      key={token} 
                      variant={opportunity.symbol === token ? "default" : "outline"}
                      className="text-xs"
                    >
                      {token}
                    </Badge>
                  ))}
                </div>
                
                <div className="text-xs text-blue-900 dark:text-blue-300 font-medium mb-1">
                  🚀 Redes Rápidas (1-5 min):
                </div>
                <div className="flex flex-wrap gap-1 mb-3">
                  {['SOL', 'BNB', 'AVAX', 'DOT'].map(token => (
                    <Badge 
                      key={token} 
                      variant={opportunity.symbol === token ? "default" : "outline"}
                      className="text-xs bg-purple-100 hover:bg-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800"
                    >
                      {token}
                    </Badge>
                  ))}
                </div>
                
                <div className="text-xs text-blue-900 dark:text-blue-300 font-medium mb-1">
                  ⏱️ Outras Redes (5-60 min):
                </div>
                <div className="flex flex-wrap gap-1">
                  {['BTC', 'LTC', 'ADA', 'ATOM', 'DOGE'].map(token => (
                    <Badge 
                      key={token} 
                      variant={opportunity.symbol === token ? "default" : "outline"}
                      className="text-xs bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800"
                    >
                      {token}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Investment Amount */}
            <div className="space-y-2">
              <Label htmlFor="investment" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Investimento em USDT
              </Label>
              <Input
                id="investment"
                type="number"
                value={config.investmentAmount}
                onChange={(e) => setConfig(prev => ({ ...prev, investmentAmount: Number(e.target.value) }))}
                placeholder="10"
                className={errors.investmentAmount ? "border-red-500" : ""}
              />
              {errors.investmentAmount && (
                <p className="text-sm text-red-500">{errors.investmentAmount}</p>
              )}
              <p className="text-xs text-muted-foreground">
                💰 Valor em USDT - moeda base universal das exchanges
              </p>
              
              {/* Tabela de referência: Spread mínimo por investimento */}
              <div className="mt-3 p-3 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-slate-600 rounded-lg">
                <div className="text-xs font-medium text-blue-900 dark:text-blue-300 mb-2">
                  📊 Spread mínimo necessário para lucro (com slippage {config.maxSlippage}% + Arbitrum $0.10):
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$30 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~1.03% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$50 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~0.90% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$100 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~0.80% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$200 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~0.75% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$500 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~0.72% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$1000 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~0.71% spread</span>
                  </div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  ⚡ Fórmula: Taxa Trading (0.20%) + Slippage ({config.maxSlippage}%) + Taxa Arbitrum ($0.10 ÷ investimento)
                </p>
              </div>
            </div>

            {/* Max Slippage */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Slippage Máximo: {config.maxSlippage.toFixed(2)}%
              </Label>
              <Slider
                value={[config.maxSlippage]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, maxSlippage: value }))}
                min={0.10}
                max={5}
                step={0.05}
                className="w-full"
              />
              {errors.maxSlippage && (
                <p className="text-sm text-red-500">{errors.maxSlippage}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Tolerância para variação de preço durante execução
              </p>
            </div>

            {/* Custom Fee Rate */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Taxa Personalizada: {config.customFeeRate.toFixed(2)}%
              </Label>
              <Slider
                value={[config.customFeeRate]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, customFeeRate: value }))}
                min={0.1}
                max={1.0}
                step={0.1}
                className="w-full"
              />
              {errors.customFeeRate && (
                <p className="text-sm text-red-500">{errors.customFeeRate}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Taxa de cross-exchange total estimada (inclui transferência)
              </p>
            </div>

            {/* Stop Loss */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Stop Loss: {config.stopLossPercentage.toFixed(1)}%
              </Label>
              <Slider
                value={[config.stopLossPercentage]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, stopLossPercentage: value }))}
                min={1}
                max={10}
                step={0.1}
                className="w-full"
              />
              {errors.stopLossPercentage && (
                <p className="text-sm text-red-500">{errors.stopLossPercentage}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Perda máxima aceitável antes de cancelar
              </p>
            </div>
          </div>

          {/* Projected Results */}
          {projected && (
            <Card className={projected.netProfit > 0 
              ? "border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800" 
              : "border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800"
            }>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Resultados Projetados
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Detalhes da Operação */}
                <div className="mb-4 pb-4 border-b">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Detalhes da Operação</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Quantidade:</span>
                      <span className="ml-2 font-semibold">{projected.quantity.toFixed(6)} {opportunity.symbol.replace('USDT', '')}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Investimento:</span>
                      <span className="ml-2 font-semibold">{formatCurrency(config.investmentAmount)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preço Compra (c/ slippage):</span>
                      <span className="ml-2 font-semibold">{formatCurrency(projected.adjustedBuyPrice)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Preço Venda (c/ slippage):</span>
                      <span className="ml-2 font-semibold">{formatCurrency(projected.adjustedSellPrice)}</span>
                    </div>
                  </div>
                </div>

                {/* Resultados Financeiros */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Lucro Bruto</div>
                    <div className="font-semibold text-green-600">
                      {formatCurrency(projected.grossProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Taxas Total</div>
                    <div className="font-semibold text-red-600">
                      -{formatCurrency(projected.totalFees)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Trading: ${projected.tradingFees.toFixed(2)} + Arbitrum: $0.10
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Lucro Líquido</div>
                    <div className={`font-semibold ${projected.netProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(projected.netProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">ROI</div>
                    <div className={`font-semibold ${projected.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {projected.roi.toFixed(2)}%
                    </div>
                  </div>
                </div>
                
                {projected.netProfit <= 0 && (
                  <div className="mt-3 p-3 bg-red-100 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">Atenção: Configuração resultaria em prejuízo</span>
                    </div>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                      Spread necessário para lucro: {projected.breakEvenSpread.toFixed(2)}%
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                      💡 Para aproveitar este spread de {opportunity.spread.toFixed(2)}%, aumente o investimento para ${Math.ceil((0.10 + (config.investmentAmount * 0.002)) / ((opportunity.spread / 100) - 0.002))} ou mais
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExecuting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleExecute} 
            disabled={isExecuting}
            className="min-w-32"
          >
            {isExecuting ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                Executando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Executar Arbitragem
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ArbitrageExecutionModal;