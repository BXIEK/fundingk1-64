import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/userUtils";
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Key, 
  TestTube, 
  Eye, 
  EyeOff,
  Zap
} from "lucide-react";

interface APICredentials {
  binance: { apiKey: string; secretKey: string; };
  okx: { apiKey: string; secretKey: string; passphrase: string; };
  hyperliquid: { walletAddress: string; privateKey: string; };
}

interface ConnectionStatus {
  binance: 'connected' | 'configured' | 'error' | 'missing';
  okx: 'connected' | 'configured' | 'error' | 'missing';
  hyperliquid: 'connected' | 'configured' | 'error' | 'missing';
}

const APICredentialsManager = () => {
  const { toast } = useToast();
  const [credentials, setCredentials] = useState<APICredentials>({
    binance: { apiKey: '', secretKey: '' },
    okx: { apiKey: '', secretKey: '', passphrase: '' },
    hyperliquid: { walletAddress: '', privateKey: '' }
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    binance: 'missing',
    okx: 'missing', 
    hyperliquid: 'missing'
  });

  const [showKeys, setShowKeys] = useState({
    binance: false,
    okx: false,
    hyperliquid: false
  });

  const [testing, setTesting] = useState({
    binance: false,
    okx: false,
    hyperliquid: false
  });

  useEffect(() => {
    loadStoredCredentials();
  }, []);

  const loadStoredCredentials = () => {
    try {
      const binanceStored = localStorage.getItem("binance_credentials");
      const okxStored = localStorage.getItem("okx_credentials");
      const hyperliquidStored = localStorage.getItem("hyperliquid_credentials");

      if (binanceStored) {
        const creds = JSON.parse(binanceStored);
        setCredentials(prev => ({ ...prev, binance: creds }));
        setConnectionStatus(prev => ({ 
          ...prev, 
          binance: creds.apiKey.includes('demo') ? 'configured' : 'configured'
        }));
      }

      if (okxStored) {
        const creds = JSON.parse(okxStored);
        setCredentials(prev => ({ ...prev, okx: creds }));
        setConnectionStatus(prev => ({ 
          ...prev, 
          okx: creds.apiKey.includes('demo') ? 'configured' : 'configured'
        }));
      }

      if (hyperliquidStored) {
        const creds = JSON.parse(hyperliquidStored);
        setCredentials(prev => ({ ...prev, hyperliquid: creds }));
        setConnectionStatus(prev => ({ 
          ...prev, 
          hyperliquid: creds.privateKey.includes('demo') ? 'configured' : 'configured'
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error);
    }
  };

  const testBinanceConnection = async () => {
    if (!credentials.binance.apiKey || !credentials.binance.secretKey) {
      toast({
        title: "Erro",
        description: "Preencha as credenciais da Binance primeiro",
        variant: "destructive"
      });
      return;
    }

    setTesting(prev => ({ ...prev, binance: true }));
    try {
      const { data, error } = await supabase.functions.invoke('test-binance-connection', {
        body: {
          apiKey: credentials.binance.apiKey,
          secretKey: credentials.binance.secretKey
        }
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus(prev => ({ ...prev, binance: 'connected' }));
        toast({
          title: "✅ Binance Conectada",
          description: "Conexão estabelecida com sucesso!"
        });
      } else {
        throw new Error(data?.error || 'Erro na conexão');
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, binance: 'error' }));
      toast({
        title: "❌ Erro Binance",
        description: error instanceof Error ? error.message : "Erro na conexão",
        variant: "destructive"
      });
    } finally {
      setTesting(prev => ({ ...prev, binance: false }));
    }
  };

  const testOKXConnection = async () => {
    if (!credentials.okx.apiKey || !credentials.okx.secretKey || !credentials.okx.passphrase) {
      toast({
        title: "Erro",
        description: "Preencha todas as credenciais da OKX primeiro",
        variant: "destructive"
      });
      return;
    }

    setTesting(prev => ({ ...prev, okx: true }));
    try {
      const { data, error } = await supabase.functions.invoke('okx-api', {
        body: {
          action: 'get_prices',
          api_key: credentials.okx.apiKey,
          secret_key: credentials.okx.secretKey,
          passphrase: credentials.okx.passphrase
        }
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus(prev => ({ ...prev, okx: 'connected' }));
        toast({
          title: "✅ OKX Conectada",
          description: "Conexão estabelecida com sucesso!"
        });
      } else {
        throw new Error(data?.error || 'Erro na conexão');
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, okx: 'error' }));
      
      // Tratamento especial para erro de IP whitelist
      const isWhitelistError = error instanceof Error && 
        (error.message.includes('50110') || error.message.includes('whitelist'));
      
      toast({
        title: "❌ Erro OKX",
        description: isWhitelistError ? 
          "Erro de IP whitelist. Configure IP 0.0.0.0/0 na OKX." : 
          (error instanceof Error ? error.message : "Erro na conexão"),
        variant: "destructive",
        duration: isWhitelistError ? 10000 : 5000
      });
    } finally {
      setTesting(prev => ({ ...prev, okx: false }));
    }
  };

  const saveCredentials = (exchange: 'binance' | 'okx' | 'hyperliquid') => {
    try {
      const creds = credentials[exchange];
      localStorage.setItem(`${exchange}_credentials`, JSON.stringify(creds));
      
      toast({
        title: "Credenciais Salvas",
        description: `Credenciais da ${exchange.toUpperCase()} salvas com segurança`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar credenciais",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: ConnectionStatus[keyof ConnectionStatus]) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800">✅ Conectado</Badge>;
      case 'configured':
        return <Badge className="bg-blue-100 text-blue-800">⚙️ Configurado</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800">❌ Erro</Badge>;
      default:
        return <Badge variant="outline">⚪ Não configurado</Badge>;
    }
  };

  const isRealModeReady = () => {
    return Object.values(connectionStatus).filter(status => 
      status === 'connected' || status === 'configured'
    ).length >= 2;
  };

  return (
    <div className="space-y-4 px-2 pb-safe">
      {/* Status Geral */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-4 w-4" />
            Status das Conexões API
          </CardTitle>
          <CardDescription className="text-sm">
            Configure e teste suas credenciais para habilitar operações reais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(connectionStatus).map(([exchange, status]) => (
              <div key={exchange} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Key className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="font-medium capitalize text-sm sm:text-base">{exchange}</span>
                </div>
                {getStatusBadge(status)}
              </div>
            ))}
          </div>

          {isRealModeReady() && (
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                ✅ Sistema pronto para operações reais! Você tem {Object.values(connectionStatus).filter(s => s === 'connected' || s === 'configured').length}/3 exchanges configuradas.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Configuração Binance */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Binance API</CardTitle>
          <CardDescription className="text-sm">Configure suas credenciais da Binance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKeys.binance ? "text" : "password"}
                value={credentials.binance.apiKey}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  binance: { ...prev.binance, apiKey: e.target.value }
                }))}
                placeholder="Sua API Key da Binance"
                className="text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setShowKeys(prev => ({ ...prev, binance: !prev.binance }))}
              >
                {showKeys.binance ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Secret Key</Label>
            <Input
              type={showKeys.binance ? "text" : "password"}
              value={credentials.binance.secretKey}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                binance: { ...prev.binance, secretKey: e.target.value }
              }))}
              placeholder="Sua Secret Key da Binance"
              className="text-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => saveCredentials('binance')}
              className="flex-1 sm:flex-none"
            >
              <Key className="h-3 w-3 mr-2" />
              Salvar
            </Button>
            <Button 
              variant="outline" 
              onClick={testBinanceConnection}
              disabled={testing.binance}
              className="flex-1 sm:flex-none"
            >
              {testing.binance ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
              ) : (
                <TestTube className="h-3 w-3 mr-2" />
              )}
              Testar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Configuração OKX */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">OKX API</CardTitle>
          <CardDescription className="text-sm">Configure suas credenciais da OKX</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">API Key</Label>
            <div className="flex gap-2">
              <Input
                type={showKeys.okx ? "text" : "password"}
                value={credentials.okx.apiKey}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  okx: { ...prev.okx, apiKey: e.target.value }
                }))}
                placeholder="Sua API Key da OKX"
                className="text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => setShowKeys(prev => ({ ...prev, okx: !prev.okx }))}
              >
                {showKeys.okx ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Secret Key</Label>
            <Input
              type={showKeys.okx ? "text" : "password"}
              value={credentials.okx.secretKey}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                okx: { ...prev.okx, secretKey: e.target.value }
              }))}
              placeholder="Sua Secret Key da OKX"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Passphrase</Label>
            <Input
              type={showKeys.okx ? "text" : "password"}
              value={credentials.okx.passphrase}
              onChange={(e) => setCredentials(prev => ({
                ...prev,
                okx: { ...prev.okx, passphrase: e.target.value }
              }))}
              placeholder="Sua Passphrase da OKX"
              className="text-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              onClick={() => saveCredentials('okx')}
              className="flex-1 sm:flex-none"
            >
              <Key className="h-3 w-3 mr-2" />
              Salvar
            </Button>
            <Button 
              variant="outline" 
              onClick={testOKXConnection}
              disabled={testing.okx}
              className="flex-1 sm:flex-none"
            >
              {testing.okx ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
              ) : (
                <TestTube className="h-3 w-3 mr-2" />
              )}
              Testar
            </Button>
          </div>

          {connectionStatus.okx === 'error' && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Erro de IP Whitelist:</strong> Configure "0.0.0.0/0" em OKX → API Management → Edit API → IP Restriction para permitir Edge Functions.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Status Final */}
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            {isRealModeReady() ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <Zap className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-semibold text-green-700">Sistema Pronto!</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Suas APIs estão configuradas. Você pode ativar operações reais.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <span className="text-lg font-semibold text-yellow-700">Configuração Necessária</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure pelo menos 2 exchanges para habilitar operações reais.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default APICredentialsManager;