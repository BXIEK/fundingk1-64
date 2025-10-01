import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, DollarSign, Percent, Clock, AlertTriangle, TrendingUp, Network } from "lucide-react";
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
  selectedNetwork?: string;
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
    prioritizeSpeed: true,
    selectedNetwork: undefined
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Obter redes disponíveis para o token atual
  const getAvailableNetworks = (symbol: string): Array<{value: string, label: string, speed: string, fee: string}> => {
    const networks: Record<string, Array<{value: string, label: string, speed: string, fee: string}>> = {
      'USDT': [
        { value: 'ARBITRUM', label: 'Arbitrum', speed: '2-5 min', fee: '$0.10' },
        { value: 'ETH', label: 'Ethereum (ERC-20)', speed: '5-15 min', fee: '$2-5' },
        { value: 'BSC', label: 'BSC (BEP-20)', speed: '1-3 min', fee: '$0.20' },
        { value: 'TRON', label: 'Tron (TRC-20)', speed: '1-3 min', fee: '$1' }
      ],
      'USDC': [
        { value: 'ARBITRUM', label: 'Arbitrum', speed: '2-5 min', fee: '$0.10' },
        { value: 'ETH', label: 'Ethereum (ERC-20)', speed: '5-15 min', fee: '$2-5' },
        { value: 'BSC', label: 'BSC (BEP-20)', speed: '1-3 min', fee: '$0.20' }
      ],
      'ETH': [
        { value: 'ARBITRUM', label: 'Arbitrum', speed: '2-5 min', fee: '$0.10' },
        { value: 'ETH', label: 'Ethereum Mainnet', speed: '5-15 min', fee: '$2-5' }
      ],
      'LINK': [
        { value: 'ARBITRUM', label: 'Arbitrum', speed: '2-5 min', fee: '$0.10' },
        { value: 'ETH', label: 'Ethereum (ERC-20)', speed: '5-15 min', fee: '$2-5' }
      ],
      'UNI': [
        { value: 'ARBITRUM', label: 'Arbitrum', speed: '2-5 min', fee: '$0.10' },
        { value: 'ETH', label: 'Ethereum (ERC-20)', speed: '5-15 min', fee: '$2-5' }
      ],
      'PEPE': [
        { value: 'ARBITRUM', label: 'Arbitrum', speed: '2-5 min', fee: '$0.10' },
        { value: 'ETH', label: 'Ethereum (ERC-20)', speed: '5-15 min', fee: '$2-5' }
      ],
      'SHIB': [
        { value: 'ARBITRUM', label: 'Arbitrum', speed: '2-5 min', fee: '$0.10' },
        { value: 'ETH', label: 'Ethereum (ERC-20)', speed: '5-15 min', fee: '$2-5' }
      ],
      'BTC': [{ value: 'BTC', label: 'Bitcoin', speed: '10-60 min', fee: '$1-3' }],
      'SOL': [{ value: 'SOL', label: 'Solana', speed: '1-2 min', fee: '$0.01' }],
      'AVAX': [{ value: 'AVAXC', label: 'Avalanche C-Chain', speed: '2-5 min', fee: '$0.15' }],
      'DOT': [{ value: 'DOT', label: 'Polkadot', speed: '2-5 min', fee: '$0.05' }],
      'ADA': [{ value: 'ADA', label: 'Cardano', speed: '5-10 min', fee: '$0.17' }],
      'ATOM': [{ value: 'ATOM', label: 'Cosmos', speed: '3-7 min', fee: '$0.01' }],
      'BNB': [
        { value: 'BSC', label: 'BSC', speed: '1-3 min', fee: '$0.20' },
        { value: 'BEP2', label: 'Binance Chain', speed: '1-2 min', fee: '$0.05' }
      ],
      'LTC': [{ value: 'LTC', label: 'Litecoin', speed: '5-15 min', fee: '$0.01' }],
      'DOGE': [{ value: 'DOGE', label: 'Dogecoin', speed: '5-10 min', fee: '$0.50' }],
      'XRP': [{ value: 'XRP', label: 'Ripple (XRP)', speed: '1-3 min', fee: '$0.01' }],
      'FLOKI': [{ value: 'ETH', label: 'Ethereum (ERC-20)', speed: '5-15 min', fee: '$2-5' }],
      'WIF': [{ value: 'SOL', label: 'Solana', speed: '1-2 min', fee: '$0.01' }],
      'FIL': [{ value: 'FIL', label: 'Filecoin', speed: '5-10 min', fee: '$0.01' }]
    };
    
    return networks[symbol] || [{ value: symbol, label: symbol, speed: '5-10 min', fee: '$0.50' }];
  };

  // Auto-selecionar rede padrão quando oportunidade mudar
  React.useEffect(() => {
    if (opportunity) {
      const networks = getAvailableNetworks(opportunity.symbol);
      // Selecionar Arbitrum se disponível, senão primeira opção
      const defaultNetwork = networks.find(n => n.value === 'ARBITRUM') || networks[0];
      setConfig(prev => ({ ...prev, selectedNetwork: defaultNetwork.value }));
    }
  }, [opportunity]);

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
    
    // Taxa da rede selecionada para transferência
    const networkFee = (() => {
      if (!config.selectedNetwork) return 0.10;
      const selectedNetworkDetails = getAvailableNetworks(opportunity?.symbol || '')
        .find(n => n.value === config.selectedNetwork);
      if (!selectedNetworkDetails) return 0.10;
      
      // Extrair valor numérico da taxa (ex: "$0.10" -> 0.10, "$2-5" -> 3.5)
      const feeStr = selectedNetworkDetails.fee.replace('$', '');
      if (feeStr.includes('-')) {
        const [min, max] = feeStr.split('-').map(Number);
        return (min + max) / 2; // Média
      }
      return Number(feeStr) || 0.10;
    })();
    
    // Total de taxas
    const totalFees = tradingFees + networkFee;
    
    // Lucro líquido
    const netProfit = grossProfit - totalFees;
    
    // ROI
    const roi = (netProfit / config.investmentAmount) * 100;
    
    // Spread mínimo necessário para break-even
    // Precisa cobrir: taxas de trading + slippage + taxa de rede
    const breakEvenSpread = config.customFeeRate + config.maxSlippage + ((networkFee / config.investmentAmount) * 100);

    return {
      grossProfit,
      tradingFees,
      networkFee,
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

          {/* Network Selection */}
          <Card className="border-purple-200 bg-purple-50 dark:bg-slate-800 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Network className="h-4 w-4" />
                Seleção de Rede Blockchain
              </CardTitle>
              <CardDescription>
                Escolha a rede para transferência entre exchanges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="network">Rede de Transferência</Label>
                <Select
                  value={config.selectedNetwork}
                  onValueChange={(value) => setConfig(prev => ({ ...prev, selectedNetwork: value }))}
                >
                  <SelectTrigger id="network">
                    <SelectValue placeholder="Selecione a rede" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableNetworks(opportunity?.symbol || '').map((network) => (
                      <SelectItem key={network.value} value={network.value}>
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{network.label}</span>
                          <div className="flex gap-2 text-xs text-muted-foreground ml-4">
                            <span>⏱️ {network.speed}</span>
                            <span>💰 {network.fee}</span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  ⚡ Recomendação: Arbitrum oferece melhor custo-benefício para tokens ERC-20
                </p>
              </div>

              {/* Network details */}
              {config.selectedNetwork && (() => {
                const selectedNetworkDetails = getAvailableNetworks(opportunity?.symbol || '')
                  .find(n => n.value === config.selectedNetwork);
                return selectedNetworkDetails && (
                  <div className="p-3 bg-white dark:bg-slate-900 rounded border border-purple-200 dark:border-slate-600">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-muted-foreground">Tempo Estimado:</div>
                        <div className="font-semibold text-purple-700 dark:text-purple-400">
                          {selectedNetworkDetails.speed}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Taxa Aproximada:</div>
                        <div className="font-semibold text-purple-700 dark:text-purple-400">
                          {selectedNetworkDetails.fee}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
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
                  📊 Spread mínimo necessário para lucro (com slippage {config.maxSlippage}% + taxa de rede):
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$30 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~{(config.customFeeRate + config.maxSlippage + ((projected?.networkFee || 0.10) / 30) * 100).toFixed(2)}% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$50 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~{(config.customFeeRate + config.maxSlippage + ((projected?.networkFee || 0.10) / 50) * 100).toFixed(2)}% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$100 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~{(config.customFeeRate + config.maxSlippage + ((projected?.networkFee || 0.10) / 100) * 100).toFixed(2)}% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$200 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~{(config.customFeeRate + config.maxSlippage + ((projected?.networkFee || 0.10) / 200) * 100).toFixed(2)}% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$500 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~{(config.customFeeRate + config.maxSlippage + ((projected?.networkFee || 0.10) / 500) * 100).toFixed(2)}% spread</span>
                  </div>
                  <div>
                    <span className="text-blue-700 dark:text-blue-400">$1000 →</span>
                    <span className="ml-1 font-semibold text-blue-900 dark:text-blue-200">~{(config.customFeeRate + config.maxSlippage + ((projected?.networkFee || 0.10) / 1000) * 100).toFixed(2)}% spread</span>
                  </div>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  ⚡ Fórmula: Taxa Trading ({config.customFeeRate}%) + Slippage ({config.maxSlippage}%) + Taxa de Rede (${projected?.networkFee.toFixed(2) || '0.10'} ÷ investimento)
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
                      Trading: ${projected.tradingFees.toFixed(2)} + Rede: ${projected.networkFee.toFixed(2)}
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