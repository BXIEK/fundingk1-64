import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, TrendingUp, DollarSign, Percent, ArrowRight } from "lucide-react";

interface TriangularArbitrageData {
  // Conversão BRL para USD
  amountBRL: number;
  usdRate: number;
  initialAmount: number;
  // Taxas bancárias
  depositFee: number; // Taxa de depósito (banco -> exchange)
  withdrawalFee: number; // Taxa de saque (exchange -> banco)
  // Primeira conversão (ex: BTC -> ETH)
  rate1: number;
  fee1: number;
  // Segunda conversão (ex: ETH -> USDT)
  rate2: number;
  fee2: number;
  // Terceira conversão (ex: USDT -> BTC)
  rate3: number;
  fee3: number;
  // Moedas envolvidas
  currency1: string;
  currency2: string;
  currency3: string;
}

interface CalculatedResults {
  // Resultados de cada conversão
  afterConversion1: number;
  afterConversion2: number;
  finalAmount: number;
  // Taxas totais
  totalFees: number;
  // Resultados finais
  grossProfit: number;
  netProfit: number;
  roi: number;
  arbitrageRate: number;
}

const FinancialCalculator = () => {
  const [data, setData] = useState<TriangularArbitrageData>({
    // Conversão BRL para USD
    amountBRL: 1000,
    usdRate: 5.50, // 1 USD = 5.50 BRL
    initialAmount: 181.82, // Calculado automaticamente
    // Taxas bancárias
    depositFee: 2.50, // Taxa de depósito em BRL
    withdrawalFee: 2.50, // Taxa de saque em BRL
    rate1: 0.067, // BTC para ETH
    fee1: 0.001,
    rate2: 2400, // ETH para USDT
    fee2: 0.001,
    rate3: 0.000017, // USDT para BTC
    fee3: 0.001,
    currency1: "BTC",
    currency2: "ETH", 
    currency3: "USDT",
  });

  const [results, setResults] = useState<CalculatedResults>({
    afterConversion1: 0,
    afterConversion2: 0,
    finalAmount: 0,
    totalFees: 0,
    grossProfit: 0,
    netProfit: 0,
    roi: 0,
    arbitrageRate: 0,
  });

  const calculateResults = useCallback(() => {
    const { initialAmount, rate1, fee1, rate2, fee2, rate3, fee3, depositFee, withdrawalFee, usdRate } = data;
    
    // Primeira conversão: BTC -> ETH
    const afterConversion1 = (initialAmount * rate1) * (1 - fee1);
    
    // Segunda conversão: ETH -> USDT
    const afterConversion2 = (afterConversion1 * rate2) * (1 - fee2);
    
    // Terceira conversão: USDT -> BTC
    const finalAmount = (afterConversion2 * rate3) * (1 - fee3);
    
    // Cálculos de taxas
    const cryptoFees = (initialAmount * rate1 * fee1) + 
                      (afterConversion1 * rate2 * fee2) + 
                      (afterConversion2 * rate3 * fee3);
    
    // Taxas bancárias convertidas para USD (para somar com as taxas crypto)
    const bankFeesInUSD = (depositFee + withdrawalFee) / usdRate;
    
    const totalFees = cryptoFees + bankFeesInUSD;
    
    // Cálculos de lucro
    const grossProfit = finalAmount - initialAmount;
    const netProfit = grossProfit - bankFeesInUSD;
    const roi = initialAmount > 0 ? (netProfit / initialAmount) * 100 : 0;
    const arbitrageRate = finalAmount / initialAmount;

    setResults({
      afterConversion1,
      afterConversion2,
      finalAmount,
      totalFees,
      grossProfit,
      netProfit,
      roi,
      arbitrageRate,
    });
  }, [data]);

  // Recalcular automaticamente quando os dados mudarem
  useEffect(() => {
    calculateResults();
  }, [calculateResults]);

  const handleInputChange = (field: keyof TriangularArbitrageData, value: string) => {
    if (field === 'currency1' || field === 'currency2' || field === 'currency3') {
      setData(prev => ({
        ...prev,
        [field]: value,
      }));
    } else {
      const numericValue = parseFloat(value) || 0;
      const newData = {
        ...data,
        [field]: numericValue,
      };
      
      // Conversão automática BRL para USD
      if (field === 'amountBRL' || field === 'usdRate') {
        newData.initialAmount = newData.amountBRL / newData.usdRate;
      }
      
      setData(newData);
    }
  };

  const formatCrypto = (value: number, decimals: number = 8) => {
    return value.toFixed(decimals);
  };

  const formatBRL = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatUSD = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(4)}%`;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            SAAT - Sistema de Análise de Arbitragem Triangular
          </h1>
          <p className="text-muted-foreground">
            Calculadora para Arbitragem Triangular de Criptomoedas
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Section */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Configuração da Arbitragem
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Conversor BRL para USD */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-primary">💰 Conversor BRL → USD</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="amountBRL">Valor em Reais (BRL)</Label>
                      <Input
                        id="amountBRL"
                        type="number"
                        step="0.01"
                        value={data.amountBRL}
                        onChange={(e) => handleInputChange('amountBRL', e.target.value)}
                        className="mt-1"
                      />
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatBRL(data.amountBRL)}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="usdRate">Taxa USD/BRL (1 USD = X BRL)</Label>
                      <Input
                        id="usdRate"
                        type="number"
                        step="0.01"
                        value={data.usdRate}
                        onChange={(e) => handleInputChange('usdRate', e.target.value)}
                        className="mt-1"
                      />
                      <div className="text-sm text-muted-foreground mt-1">
                        1 USD = {formatBRL(data.usdRate)}
                      </div>
                    </div>
                    <div className="bg-background p-3 rounded border">
                      <Label className="text-sm font-medium text-muted-foreground">Quantidade Inicial (USD)</Label>
                      <div className="text-xl font-bold text-primary mt-1">
                        {formatUSD(data.initialAmount)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ≈ {formatCrypto(data.initialAmount, 8)} USD para cripto
                      </div>
                    </div>
                  </div>
                </div>

                {/* Taxas Bancárias */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-3 text-primary">🏦 Taxas Bancárias</h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="depositFee">Taxa de Depósito (BRL)</Label>
                      <Input
                        id="depositFee"
                        type="number"
                        step="0.01"
                        value={data.depositFee}
                        onChange={(e) => handleInputChange('depositFee', e.target.value)}
                        className="mt-1"
                      />
                      <div className="text-sm text-muted-foreground mt-1">
                        Custo: {formatBRL(data.depositFee)}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="withdrawalFee">Taxa de Saque (BRL)</Label>
                      <Input
                        id="withdrawalFee"
                        type="number"
                        step="0.01"
                        value={data.withdrawalFee}
                        onChange={(e) => handleInputChange('withdrawalFee', e.target.value)}
                        className="mt-1"
                      />
                      <div className="text-sm text-muted-foreground mt-1">
                        Custo: {formatBRL(data.withdrawalFee)}
                      </div>
                    </div>
                    <div className="bg-background p-3 rounded border">
                      <Label className="text-sm font-medium text-muted-foreground">Taxas Bancárias Totais</Label>
                      <div className="text-lg font-bold text-destructive mt-1">
                        {formatBRL(data.depositFee + data.withdrawalFee)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ≈ {formatUSD((data.depositFee + data.withdrawalFee) / data.usdRate)} em USD
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primeira Conversão */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    1ª Conversão: {data.currency1} → {data.currency2}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="rate1">Taxa de Conversão</Label>
                      <Input
                        id="rate1"
                        type="number"
                        step="0.00000001"
                        value={data.rate1}
                        onChange={(e) => handleInputChange('rate1', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fee1">Taxa (% decimal)</Label>
                      <Input
                        id="fee1"
                        type="number"
                        step="0.0001"
                        value={data.fee1}
                        onChange={(e) => handleInputChange('fee1', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Segunda Conversão */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    2ª Conversão: {data.currency2} → {data.currency3}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="rate2">Taxa de Conversão</Label>
                      <Input
                        id="rate2"
                        type="number"
                        step="0.00000001"
                        value={data.rate2}
                        onChange={(e) => handleInputChange('rate2', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fee2">Taxa (% decimal)</Label>
                      <Input
                        id="fee2"
                        type="number"
                        step="0.0001"
                        value={data.fee2}
                        onChange={(e) => handleInputChange('fee2', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Terceira Conversão */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    3ª Conversão: {data.currency3} → {data.currency1}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="rate3">Taxa de Conversão</Label>
                      <Input
                        id="rate3"
                        type="number"
                        step="0.00000001"
                        value={data.rate3}
                        onChange={(e) => handleInputChange('rate3', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="fee3">Taxa (% decimal)</Label>
                      <Input
                        id="fee3"
                        type="number"
                        step="0.0001"
                        value={data.fee3}
                        onChange={(e) => handleInputChange('fee3', e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <Button onClick={calculateResults} className="w-full">
                  Calcular Arbitragem
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="lg:col-span-2 space-y-4">
            {/* Fluxo de Conversões */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  Fluxo de Conversões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-center">
                    <div className="font-bold text-lg">{formatCrypto(data.initialAmount)} {data.currency1}</div>
                    <div className="text-muted-foreground">Inicial</div>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                  <div className="text-center">
                    <div className="font-bold text-lg">{formatCrypto(results.afterConversion1)} {data.currency2}</div>
                    <div className="text-muted-foreground">Após 1ª</div>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                  <div className="text-center">
                    <div className="font-bold text-lg">{formatCrypto(results.afterConversion2)} {data.currency3}</div>
                    <div className="text-muted-foreground">Após 2ª</div>
                  </div>
                  <ArrowRight className="h-4 w-4" />
                  <div className="text-center">
                    <div className={`font-bold text-lg ${results.finalAmount > data.initialAmount ? 'text-success' : 'text-destructive'}`}>
                      {formatCrypto(results.finalAmount)} {data.currency1}
                    </div>
                    <div className="text-muted-foreground">Final</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resultados Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Taxa de Arbitragem
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${results.arbitrageRate > 1 ? 'text-success' : 'text-destructive'}`}>
                    {results.arbitrageRate.toFixed(8)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Multiplicador da operação
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    ROI
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${results.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatPercentage(results.roi)}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Retorno sobre investimento
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Lucro Bruto
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${results.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCrypto(results.grossProfit)} {data.currency1}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Diferença absoluta
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Total de Taxas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-destructive">
                    {formatCrypto(results.totalFees)} {data.currency1}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Custo das 3 conversões
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Resumo Detalhado */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo da Arbitragem Triangular</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantidade Inicial:</span>
                      <span className="font-semibold">{formatCrypto(data.initialAmount)} {data.currency1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantidade Final:</span>
                      <span className={`font-semibold ${results.finalAmount > data.initialAmount ? 'text-success' : 'text-destructive'}`}>
                        {formatCrypto(results.finalAmount)} {data.currency1}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total de Taxas:</span>
                      <span className="font-semibold text-destructive">{formatCrypto(results.totalFees)} {data.currency1}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lucro/Prejuízo:</span>
                      <span className={`font-semibold ${results.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatCrypto(results.netProfit)} {data.currency1}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Taxa de Arbitragem:</span>
                      <span className={`font-semibold ${results.arbitrageRate > 1 ? 'text-success' : 'text-destructive'}`}>
                        {results.arbitrageRate.toFixed(8)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">ROI:</span>
                      <span className={`font-semibold ${results.roi >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatPercentage(results.roi)}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialCalculator;