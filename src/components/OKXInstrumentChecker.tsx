import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AvailableInstrument {
  symbol: string;
  baseSymbol: string;
  minSize: number;
  maxSize: number;
  lotSize: number;
  tickSize: number;
  state: string;
}

interface RestrictedInstrument {
  symbol: string;
  baseSymbol: string;
  reason: string;
  state: string;
}

interface InstrumentData {
  available: AvailableInstrument[];
  restricted: RestrictedInstrument[];
  total_checked: number;
}

export function OKXInstrumentChecker() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InstrumentData | null>(null);

  const checkInstruments = async () => {
    setLoading(true);
    try {
      // Buscar credenciais do usuário do formato correto (JSON)
      const okxCredentialsStr = localStorage.getItem('okx_credentials');
      
      if (!okxCredentialsStr) {
        toast.error('Credenciais da OKX não encontradas. Configure suas API keys primeiro.');
        return;
      }

      const okxCredentials = JSON.parse(okxCredentialsStr);
      const { apiKey: okxApiKey, secretKey: okxSecretKey, passphrase: okxPassphrase } = okxCredentials;

      if (!okxApiKey || !okxSecretKey || !okxPassphrase) {
        toast.error('Credenciais da OKX incompletas. Verifique suas API keys.');
        return;
      }

      const { data: result, error } = await supabase.functions.invoke('okx-api', {
        body: {
          action: 'get_available_instruments',
          api_key: okxApiKey,
          secret_key: okxSecretKey,
          passphrase: okxPassphrase
        }
      });

      if (error) throw error;

      if (result.success) {
        setData(result);
        toast.success(`Verificados ${result.total_checked} pares: ${result.available.length} disponíveis, ${result.restricted.length} restritos`);
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao verificar instrumentos:', error);
      toast.error('Erro ao verificar pares disponíveis: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          Verificador de Pares OKX
        </CardTitle>
        <CardDescription>
          Verifica quais pares de criptomoedas estão disponíveis para negociação na sua conta OKX
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={checkInstruments} 
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verificando...
            </>
          ) : (
            'Verificar Pares Disponíveis'
          )}
        </Button>

        {data && (
          <div className="space-y-4">
            {/* Pares Disponíveis */}
            <div>
              <h3 className="text-lg font-semibold text-green-400 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Pares Disponíveis ({data.available.length})
              </h3>
              <div className="space-y-3">
                {data.available.map((instrument) => (
                  <div key={instrument.symbol} className="p-3 bg-gray-800 border border-gray-700 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="default" className="bg-green-600 text-white hover:bg-green-700">
                        {instrument.symbol}
                      </Badge>
                      <div className="text-right">
                        <span className="text-xs text-green-400">Estado: {instrument.state}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-green-400">Formato OKX:</span> <span className="text-gray-300">{instrument.symbol}</span>
                      </div>
                      <div>
                        <span className="font-medium text-green-400">Formato Binance:</span> <span className="text-gray-300">{instrument.symbol.replace('-', '')}</span>
                      </div>
                      <div>
                        <span className="font-medium text-green-400">Tamanho Mín:</span> <span className="text-gray-300">{instrument.minSize}</span>
                      </div>
                      <div>
                        <span className="font-medium text-green-400">Tick Size:</span> <span className="text-gray-300">{instrument.tickSize}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {data.available.length > 0 && (
                <div className="mt-3 p-3 bg-gray-800 border border-gray-700 rounded-lg">
                  <p className="text-sm text-green-400 font-medium mb-2">
                    ✅ Compatibilidade de Arbitragem:
                  </p>
                  <ul className="text-sm text-gray-300 space-y-1">
                    <li>• <strong className="text-green-400">OKX:</strong> BTC-USDT ↔ <strong className="text-green-400">Binance:</strong> BTCUSDT</li>
                    <li>• <strong className="text-green-400">OKX:</strong> ETH-USDT ↔ <strong className="text-green-400">Binance:</strong> ETHUSDT</li>
                    <li>• Todos os pares usam USDT como stablecoin de referência</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Pares Restritos */}
            {data.restricted.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Pares Restritos ({data.restricted.length})
                </h3>
                <div className="space-y-2">
                  {data.restricted.map((instrument) => (
                    <div key={instrument.symbol} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                      <Badge variant="destructive" className="bg-red-100 text-red-800">
                        {instrument.symbol}
                      </Badge>
                      <span className="text-sm text-red-600">{instrument.reason}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">
                    ❌ Estes pares não podem ser negociados devido a restrições regionais/KYC
                  </p>
                </div>
              </div>
            )}

            {/* Resumo */}
            <div className="pt-4 border-t">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{data.available.length}</div>
                  <div className="text-sm text-green-700">Disponíveis</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{data.restricted.length}</div>
                  <div className="text-sm text-red-700">Restritos</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}