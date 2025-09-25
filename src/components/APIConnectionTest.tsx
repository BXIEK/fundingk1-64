import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TestTube, Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";

interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  error?: string;
}

const APIConnectionTest = () => {
  const { toast } = useToast();
  const [isTestingPionex, setIsTestingPionex] = useState(false);
  const [isTestingBinance, setIsTestingBinance] = useState(false);
  const [pionexResult, setPionexResult] = useState<ConnectionTestResult | null>(null);
  const [binanceResult, setBinanceResult] = useState<ConnectionTestResult | null>(null);

  const testPionexConnection = async () => {
    setIsTestingPionex(true);
    setPionexResult(null);
    
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('real-pionex-api', {
        body: {
          action: 'test_connection'
        }
      });

      const latency = Date.now() - startTime;

      if (error) {
        throw new Error(error.message || 'Erro na conexão');
      }

      if (data?.connected) {
        setPionexResult({
          success: true,
          message: 'Conexão com Pionex estabelecida com sucesso',
          latency
        });
        
        toast({
          title: "✅ Pionex Conectada",
          description: `Latência: ${latency}ms`,
        });
      } else {
        throw new Error(data?.error || 'Falha na conexão');
      }

    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setPionexResult({
        success: false,
        message: 'Falha na conexão com Pionex',
        error: errorMessage,
        latency
      });
      
      toast({
        title: "❌ Erro Pionex",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsTestingPionex(false);
    }
  };

  const testBinanceConnection = async () => {
    setIsTestingBinance(true);
    setBinanceResult(null);
    
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase.functions.invoke('test-binance-connection', {
        body: {}
      });

      const latency = Date.now() - startTime;

      if (error) {
        throw new Error(error.message || 'Erro na conexão');
      }

      if (data?.connected) {
        setBinanceResult({
          success: true,
          message: 'Conexão com Binance estabelecida com sucesso',
          latency
        });
        
        toast({
          title: "✅ Binance Conectada",
          description: `Latência: ${latency}ms`,
        });
      } else {
        throw new Error(data?.error || 'Falha na conexão');
      }

    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      setBinanceResult({
        success: false,
        message: 'Falha na conexão com Binance',
        error: errorMessage,
        latency
      });
      
      toast({
        title: "❌ Erro Binance",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsTestingBinance(false);
    }
  };

  const renderConnectionStatus = (result: ConnectionTestResult | null, isLoading: boolean) => {
    if (isLoading) {
      return <Badge variant="secondary">Testando...</Badge>;
    }
    
    if (!result) {
      return <Badge variant="outline">Não testado</Badge>;
    }
    
    return result.success ? (
      <Badge variant="default" className="bg-green-500">
        <CheckCircle className="h-3 w-3 mr-1" />
        Conectado
      </Badge>
    ) : (
      <Badge variant="destructive">
        <AlertCircle className="h-3 w-3 mr-1" />
        Erro
      </Badge>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Teste de Conectividade</h2>
        <p className="text-muted-foreground">
          Teste a conexão com as APIs das exchanges
        </p>
      </div>

      <Alert>
        <Wifi className="h-4 w-4" />
        <AlertDescription>
          Execute os testes abaixo para verificar se suas credenciais estão funcionando corretamente.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {/* Teste Pionex */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Teste Pionex API
              </CardTitle>
              {renderConnectionStatus(pionexResult, isTestingPionex)}
            </div>
            <CardDescription>
              Verifica conectividade com a API da Pionex
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pionexResult && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{pionexResult.message}</p>
                {pionexResult.latency && (
                  <p className="text-xs text-muted-foreground">
                    Latência: {pionexResult.latency}ms
                  </p>
                )}
                {pionexResult.error && (
                  <p className="text-xs text-red-500">
                    Erro: {pionexResult.error}
                  </p>
                )}
              </div>
            )}
            <Button 
              onClick={testPionexConnection}
              disabled={isTestingPionex}
              className="w-full"
            >
              {isTestingPionex ? (
                <>
                  <WifiOff className="h-4 w-4 mr-2 animate-spin" />
                  Testando Pionex...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-2" />
                  Testar Conexão Pionex
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Teste Binance */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Teste Binance API
              </CardTitle>
              {renderConnectionStatus(binanceResult, isTestingBinance)}
            </div>
            <CardDescription>
              Verifica conectividade com a API da Binance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {binanceResult && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{binanceResult.message}</p>
                {binanceResult.latency && (
                  <p className="text-xs text-muted-foreground">
                    Latência: {binanceResult.latency}ms
                  </p>
                )}
                {binanceResult.error && (
                  <p className="text-xs text-red-500">
                    Erro: {binanceResult.error}
                  </p>
                )}
              </div>
            )}
            <Button 
              onClick={testBinanceConnection}
              disabled={isTestingBinance}
              className="w-full"
              variant="outline"
            >
              {isTestingBinance ? (
                <>
                  <WifiOff className="h-4 w-4 mr-2 animate-spin" />
                  Testando Binance...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4 mr-2" />
                  Testar Conexão Binance
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default APIConnectionTest;