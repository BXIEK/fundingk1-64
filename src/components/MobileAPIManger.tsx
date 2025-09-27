import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Key, 
  TestTube, 
  Eye, 
  EyeOff,
  Smartphone,
  Wifi,
  Settings
} from "lucide-react";

interface MobileAPICredentials {
  binance: { apiKey: string; secretKey: string; };
  okx: { apiKey: string; secretKey: string; passphrase: string; };
  hyperliquid: { walletAddress: string; privateKey: string; };
}

interface MobileConnectionStatus {
  binance: 'connected' | 'configured' | 'error' | 'missing';
  okx: 'connected' | 'configured' | 'error' | 'missing';
  hyperliquid: 'connected' | 'configured' | 'error' | 'missing';
}

const MobileAPIManager = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  const [activeTab, setActiveTab] = useState<'binance' | 'okx' | 'status'>('status');
  const [credentials, setCredentials] = useState<MobileAPICredentials>({
    binance: { apiKey: '', secretKey: '' },
    okx: { apiKey: '', secretKey: '', passphrase: '' },
    hyperliquid: { walletAddress: '', privateKey: '' }
  });

  const [connectionStatus, setConnectionStatus] = useState<MobileConnectionStatus>({
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
        setConnectionStatus(prev => ({ ...prev, binance: 'configured' }));
      }

      if (okxStored) {
        const creds = JSON.parse(okxStored);
        setCredentials(prev => ({ ...prev, okx: creds }));
        setConnectionStatus(prev => ({ ...prev, okx: 'configured' }));
      }

      if (hyperliquidStored) {
        const creds = JSON.parse(hyperliquidStored);
        setCredentials(prev => ({ ...prev, hyperliquid: creds }));
        setConnectionStatus(prev => ({ ...prev, hyperliquid: 'configured' }));
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
          title: "📱 Binance Conectada",
          description: "Conexão móvel estabelecida com sucesso!"
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
          title: "📱 OKX Conectada",
          description: "Conexão móvel estabelecida com sucesso!"
        });
      } else {
        throw new Error(data?.error || 'Erro na conexão');
      }
    } catch (error) {
      setConnectionStatus(prev => ({ ...prev, okx: 'error' }));
      
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
        title: "📱 Credenciais Salvas",
        description: `${exchange.toUpperCase()} configurada no dispositivo móvel`
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao salvar credenciais",
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: MobileConnectionStatus[keyof MobileConnectionStatus]) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-success text-success-foreground text-xs">✅ Online</Badge>;
      case 'configured':
        return <Badge className="bg-info text-info-foreground text-xs">⚙️ Config</Badge>;
      case 'error':
        return <Badge className="bg-destructive text-destructive-foreground text-xs">❌ Erro</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">⚪ Off</Badge>;
    }
  };

  const isReady = () => {
    return Object.values(connectionStatus).filter(status => 
      status === 'connected' || status === 'configured'
    ).length >= 2;
  };

  if (!isMobile) {
    return null; // Não renderizar em desktop
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4 p-4 pb-safe">
      {/* Header Mobile */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">APIs Móvel</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Configure suas exchanges no celular
        </p>
      </div>

      {/* Mobile Navigation */}
      <div className="flex rounded-lg bg-muted p-1">
        <button
          onClick={() => setActiveTab('status')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'status' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="h-4 w-4 mx-auto mb-1" />
          Status
        </button>
        <button
          onClick={() => setActiveTab('binance')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'binance' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wifi className="h-4 w-4 mx-auto mb-1" />
          Binance
        </button>
        <button
          onClick={() => setActiveTab('okx')}
          className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'okx' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className="h-4 w-4 mx-auto mb-1" />
          OKX
        </button>
      </div>

      {/* Content Area */}
      {activeTab === 'status' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Status das APIs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(connectionStatus).map(([exchange, status]) => (
              <div key={exchange} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="font-medium capitalize text-sm">{exchange}</span>
                {getStatusBadge(status)}
              </div>
            ))}

            {isReady() && (
              <Alert className="mt-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  ✅ Sistema móvel pronto! {Object.values(connectionStatus).filter(s => s === 'connected' || s === 'configured').length}/3 exchanges configuradas.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'binance' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Binance API</CardTitle>
            <CardDescription className="text-sm">Configure para trading móvel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showKeys.binance ? "text" : "password"}
                  value={credentials.binance.apiKey}
                  onChange={(e) => setCredentials(prev => ({
                    ...prev,
                    binance: { ...prev.binance, apiKey: e.target.value }
                  }))}
                  placeholder="Sua API Key"
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 touch-target"
                  onClick={() => setShowKeys(prev => ({ ...prev, binance: !prev.binance }))}
                >
                  {showKeys.binance ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Secret Key</Label>
              <Input
                type={showKeys.binance ? "text" : "password"}
                value={credentials.binance.secretKey}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  binance: { ...prev.binance, secretKey: e.target.value }
                }))}
                placeholder="Sua Secret Key"
                className="text-sm"
              />
            </div>

            <div className="mobile-form-stack">
              <Button 
                onClick={() => saveCredentials('binance')}
                className="touch-target"
              >
                <Key className="h-3 w-3 mr-2" />
                Salvar Binance
              </Button>
              <Button 
                variant="outline" 
                onClick={testBinanceConnection}
                disabled={testing.binance}
                className="touch-target"
              >
                {testing.binance ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                ) : (
                  <TestTube className="h-3 w-3 mr-2" />
                )}
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === 'okx' && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">OKX API</CardTitle>
            <CardDescription className="text-sm">Configure para trading móvel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showKeys.okx ? "text" : "password"}
                  value={credentials.okx.apiKey}
                  onChange={(e) => setCredentials(prev => ({
                    ...prev,
                    okx: { ...prev.okx, apiKey: e.target.value }
                  }))}
                  placeholder="Sua API Key"
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 touch-target"
                  onClick={() => setShowKeys(prev => ({ ...prev, okx: !prev.okx }))}
                >
                  {showKeys.okx ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Secret Key</Label>
              <Input
                type={showKeys.okx ? "text" : "password"}
                value={credentials.okx.secretKey}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  okx: { ...prev.okx, secretKey: e.target.value }
                }))}
                placeholder="Sua Secret Key"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Passphrase</Label>
              <Input
                type={showKeys.okx ? "text" : "password"}
                value={credentials.okx.passphrase}
                onChange={(e) => setCredentials(prev => ({
                  ...prev,
                  okx: { ...prev.okx, passphrase: e.target.value }
                }))}
                placeholder="Sua Passphrase"
                className="text-sm"
              />
            </div>

            <div className="mobile-form-stack">
              <Button 
                onClick={() => saveCredentials('okx')}
                className="touch-target"
              >
                <Key className="h-3 w-3 mr-2" />
                Salvar OKX
              </Button>
              <Button 
                variant="outline" 
                onClick={testOKXConnection}
                disabled={testing.okx}
                className="touch-target"
              >
                {testing.okx ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-2"></div>
                ) : (
                  <TestTube className="h-3 w-3 mr-2" />
                )}
                Testar Conexão
              </Button>
            </div>

            {connectionStatus.okx === 'error' && (
              <Alert className="mt-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Configure "0.0.0.0/0" na whitelist da OKX para funcionar no celular.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MobileAPIManager;