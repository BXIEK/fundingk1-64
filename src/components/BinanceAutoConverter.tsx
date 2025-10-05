import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowRightLeft, CheckCircle2, XCircle, AlertTriangle, DollarSign } from 'lucide-react';

interface ConversionResult {
  symbol: string;
  amount: string;
  success: boolean;
  usdtReceived?: number;
  error?: string;
}

export const BinanceAutoConverter = () => {
  const { toast } = useToast();
  const [converting, setConverting] = useState(false);
  const [minUsdValue, setMinUsdValue] = useState(10);
  const [results, setResults] = useState<ConversionResult[]>([]);
  const [totalReceived, setTotalReceived] = useState(0);

  const handleConvert = async () => {
    setConverting(true);
    setResults([]);
    setTotalReceived(0);

    try {
      // Buscar credenciais da Binance
      const binanceCreds = localStorage.getItem('binance_credentials');
      if (!binanceCreds) {
        throw new Error('Credenciais da Binance não encontradas');
      }

      const { apiKey, secretKey } = JSON.parse(binanceCreds);

      toast({
        title: "🔄 Iniciando conversão",
        description: "Convertendo todos os tokens para USDT...",
      });

      const { data, error } = await supabase.functions.invoke('binance-convert-to-usdt', {
        body: { apiKey, secretKey, minUsdValue }
      });

      if (error) throw error;

      if (data.success) {
        setResults(data.conversions || []);
        setTotalReceived(data.totalUsdtReceived || 0);

        const successCount = data.conversions?.filter((c: ConversionResult) => c.success).length || 0;
        const totalCount = data.conversions?.length || 0;

        toast({
          title: "✅ Conversão concluída!",
          description: `${successCount}/${totalCount} tokens convertidos. Total: ${data.totalUsdtReceived?.toFixed(2)} USDT`,
        });
      } else {
        throw new Error(data.error || 'Erro na conversão');
      }

    } catch (error: any) {
      console.error('Erro na conversão:', error);
      toast({
        title: "❌ Erro na conversão",
        description: error.message || 'Erro desconhecido',
        variant: "destructive"
      });
    } finally {
      setConverting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Converter Tudo para USDT
        </CardTitle>
        <CardDescription>
          Converte automaticamente todos os seus tokens na Binance para USDT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> Esta operação venderá TODOS os seus tokens (exceto USDT e BNB) 
            por ordens de mercado. Mantenha BNB para taxas de trading.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="minValue">Valor mínimo por token (USD)</Label>
          <Input
            id="minValue"
            type="number"
            value={minUsdValue}
            onChange={(e) => setMinUsdValue(Number(e.target.value))}
            placeholder="10"
            min="1"
          />
          <p className="text-xs text-muted-foreground">
            Tokens com valor abaixo deste limite serão ignorados
          </p>
        </div>

        <Button
          onClick={handleConvert}
          disabled={converting}
          className="w-full"
          size="lg"
        >
          {converting ? (
            <>
              <ArrowRightLeft className="h-4 w-4 mr-2 animate-spin" />
              Convertendo...
            </>
          ) : (
            <>
              <DollarSign className="h-4 w-4 mr-2" />
              Converter Tudo para USDT
            </>
          )}
        </Button>

        {totalReceived > 0 && (
          <Alert className="bg-green-50 dark:bg-green-950 border-green-200">
            <DollarSign className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong className="text-green-700 dark:text-green-300">
                Total recebido: {totalReceived.toFixed(2)} USDT
              </strong>
            </AlertDescription>
          </Alert>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Resultados da Conversão:</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{result.symbol}</p>
                      <p className="text-xs text-muted-foreground">
                        Quantidade: {parseFloat(result.amount).toFixed(8)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {result.success ? (
                      <>
                        <Badge variant="default" className="bg-green-500">
                          +{result.usdtReceived?.toFixed(2)} USDT
                        </Badge>
                      </>
                    ) : (
                      <Badge variant="destructive" className="text-xs max-w-[200px] truncate">
                        {result.error}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
