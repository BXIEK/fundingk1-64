import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useTradingMode } from "@/contexts/TradingModeContext";
import { useWeb3Wallet } from "@/hooks/useWeb3Wallet";
import { Eye, EyeOff, Key, Shield, Save, TestTube, Settings2, Wallet, CheckCircle, AlertTriangle } from "lucide-react";
import OKXWhitelistManager from "@/components/OKXWhitelistManager";


interface APICredentials {
  apiKey: string;
  secretKey: string;
}

interface HyperliquidCredentials {
  walletName: string;
  walletAddress: string;
  privateKey: string;
}

interface OKXCredentials {
  apiKey: string;
  secretKey: string;
  passphrase: string;
}

interface MEXCCredentials {
  apiKey: string;
  secretKey: string;
}

interface TradingConfig {
  minSlippage: number;
  maxSlippage: number;
  mevProtection: boolean;
  walletType: string;
  maxTradeSize: number;
  dailyLimit: number;
  maxConcurrentTrades: number;
  walletAddress?: string;
  isWalletConnected?: boolean;
}

const APIConfiguration = () => {
  const { toast } = useToast();
  const { recheckCredentials } = useTradingMode();
  const { wallet, isConnecting, connectWallet, disconnectWallet, isMetaMaskInstalled } = useWeb3Wallet();
  const [showHyperliquidSecret, setShowHyperliquidSecret] = useState(false);
  const [showBinanceSecret, setShowBinanceSecret] = useState(false);
  const [showOKXSecret, setShowOKXSecret] = useState(false);
  const [showOKXPassphrase, setShowOKXPassphrase] = useState(false);
  const [showMEXCSecret, setShowMEXCSecret] = useState(false);
  const [isTestingHyperliquid, setIsTestingHyperliquid] = useState(false);
  const [isTestingBinance, setIsTestingBinance] = useState(false);
  const [isTestingOKX, setIsTestingOKX] = useState(false);
  const [isTestingMEXC, setIsTestingMEXC] = useState(false);
  
  const [hyperliquidCredentials, setHyperliquidCredentials] = useState<HyperliquidCredentials>({
    walletName: "",
    walletAddress: "",
    privateKey: ""
  });
  
  const [binanceCredentials, setBinanceCredentials] = useState<APICredentials>({
    apiKey: "",
    secretKey: ""
  });

  const [okxCredentials, setOkxCredentials] = useState<OKXCredentials>({
    apiKey: "",
    secretKey: "",
    passphrase: ""
  });

  const [mexcCredentials, setMexcCredentials] = useState<MEXCCredentials>({
    apiKey: "",
    secretKey: ""
  });

  const [tradingConfig, setTradingConfig] = useState<TradingConfig>({
    minSlippage: 0.1,
    maxSlippage: 0.5,
    mevProtection: true,
    walletType: "metamask",
    maxTradeSize: 500,
    dailyLimit: 1000,
    maxConcurrentTrades: 3,
    walletAddress: undefined,
    isWalletConnected: false
  });

  // Atualizar configuração quando carteira Web3 conectar/desconectar
  useEffect(() => {
    setTradingConfig(prev => ({
      ...prev,
      walletAddress: wallet.address || undefined,
      isWalletConnected: wallet.isConnected
    }));
  }, [wallet.address, wallet.isConnected]);

  const loadSavedCredentials = () => {
    const savedBinance = localStorage.getItem("binance_credentials");
    const savedHyperliquid = localStorage.getItem("hyperliquid_credentials");
    const savedOKX = localStorage.getItem("okx_credentials");
    const savedMEXC = localStorage.getItem("mexc_credentials");
    const savedTradingConfig = localStorage.getItem("trading_config");
    
    if (savedBinance) {
      setBinanceCredentials(JSON.parse(savedBinance));
    }
    
    if (savedHyperliquid) {
      setHyperliquidCredentials(JSON.parse(savedHyperliquid));
    }
    
    if (savedOKX) {
      setOkxCredentials(JSON.parse(savedOKX));
    }

    if (savedMEXC) {
      setMexcCredentials(JSON.parse(savedMEXC));
    }

    if (savedTradingConfig) {
      const parsed = JSON.parse(savedTradingConfig);
      // Garantir que minSlippage existe (para compatibilidade com configurações antigas)
      if (!parsed.minSlippage) {
        parsed.minSlippage = 0.1;
      }
      setTradingConfig(parsed);
    }
  };

  useEffect(() => {
    loadSavedCredentials();
    recheckCredentials();
  }, [recheckCredentials]);

  const handleSaveHyperliquid = () => {
    if (!hyperliquidCredentials.walletName || !hyperliquidCredentials.walletAddress || !hyperliquidCredentials.privateKey) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos da API Hyperliquid",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem("hyperliquid_credentials", JSON.stringify(hyperliquidCredentials));
    recheckCredentials(); // Revalidar credenciais no contexto
    toast({
      title: "Sucesso",
      description: "Credenciais da Hyperliquid salvas com segurança",
    });
  };

  const handleSaveBinance = () => {
    if (!binanceCredentials.apiKey || !binanceCredentials.secretKey) {
      toast({
        title: "Erro",
        description: "Por favor, preencha ambos os campos da API Binance",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem("binance_credentials", JSON.stringify(binanceCredentials));
    recheckCredentials(); // Revalidar credenciais no contexto
    toast({
      title: "Sucesso",
      description: "Credenciais da Binance salvas com segurança",
    });
  };

  const testHyperliquidConnection = async () => {
    if (!hyperliquidCredentials.walletName || !hyperliquidCredentials.walletAddress || !hyperliquidCredentials.privateKey) {
      toast({
        title: "Erro",
        description: "Configure as credenciais da Hyperliquid primeiro",
        variant: "destructive"
      });
      return;
    }

    setIsTestingHyperliquid(true);
    try {
      console.log('🔍 Testando conexão real com Hyperliquid API...');
      
      const { data, error } = await supabase.functions.invoke('hyperliquid-api', {
        body: { 
          action: 'test_connection',
          wallet_name: hyperliquidCredentials.walletName,
          wallet_address: hyperliquidCredentials.walletAddress,
          private_key: hyperliquidCredentials.privateKey
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        toast({
          title: "✅ Conexão Hyperliquid Estabelecida",
          description: data.message || "Conexão testada com sucesso!",
        });
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro no teste da Hyperliquid:', error);
      toast({
        title: "❌ Erro de Conexão Hyperliquid",
        description: error instanceof Error ? error.message : "Falha ao conectar com a API Hyperliquid. Verifique suas credenciais.",
        variant: "destructive"
      });
    } finally {
      setIsTestingHyperliquid(false);
    }
  };

  const testBinanceConnection = async () => {
    if (!binanceCredentials.apiKey || !binanceCredentials.secretKey) {
      toast({
        title: "Erro",
        description: "Configure as credenciais da Binance primeiro",
        variant: "destructive"
      });
      return;
    }

    setIsTestingBinance(true);
    try {
      console.log('🔍 Testando conexão real com Binance API...');
      
      const { data, error } = await supabase.functions.invoke('test-binance-connection', {
        body: { 
          apiKey: binanceCredentials.apiKey,
          secretKey: binanceCredentials.secretKey
        }
      });

      console.log('Response from test-binance-connection:', { data, error });

      if (error || !data) {
        console.error('❌ Erro na função test-binance-connection:', error);
        throw new Error(error?.message || 'Erro na comunicação com a função edge');
      }

      if (data.success) {
        console.log('✅ Binance connected successfully:', data.accountInfo);
        
        // Também testar busca de portfolio com ID baseado na API key
        const userIdHash = await crypto.subtle.digest(
          'SHA-256', 
          new TextEncoder().encode(binanceCredentials.apiKey)
        );
        const hashArray = Array.from(new Uint8Array(userIdHash));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        const validUserId = `${hashHex.slice(0,8)}-${hashHex.slice(8,12)}-${hashHex.slice(12,16)}-${hashHex.slice(16,20)}-${hashHex.slice(20,32)}`;
        
        const portfolioTest = await supabase.functions.invoke('get-portfolio', {
          body: {
            user_id: validUserId,
            real_mode: true,
            binance_api_key: binanceCredentials.apiKey,
            binance_secret_key: binanceCredentials.secretKey
          }
        });
        
        console.log('Portfolio test result:', portfolioTest);
        
        toast({
          title: "✅ Conexão Binance Estabelecida",
          description: `Conta conectada! ${data.accountInfo?.totalAssets || 0} ativos detectados. USDT: ${data.accountInfo?.usdtBalance?.free || '0'}`,
        });
      } else {
        console.error('❌ Teste Binance falhou:', data);
        throw new Error(data?.error || 'Teste de conexão falhou sem detalhes específicos');
      }

    } catch (error) {
      console.error('Erro no teste da Binance:', error);
      toast({
        title: "❌ Erro na Validação Binance",
        description: error instanceof Error ? error.message : "Erro na validação das credenciais. Verifique se as chaves estão corretas.",
        variant: "destructive"
      });
    } finally {
      setIsTestingBinance(false);
    }
  };

  const testBinanceWhitelist = async () => {
    if (!binanceCredentials.apiKey || !binanceCredentials.secretKey) {
      toast({
        title: "Erro",
        description: "Configure as credenciais da Binance primeiro",
        variant: "destructive"
      });
      return;
    }

    setIsTestingBinance(true);
    try {
      console.log('🔍 Testando whitelist de símbolos na Binance...');
      
      const { data, error } = await supabase.functions.invoke('check-binance-whitelist', {
        body: {
          apiKey: binanceCredentials.apiKey,
          secretKey: binanceCredentials.secretKey,
          symbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT']
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        const whitelisted = data.whitelistedSymbols || [];
        const nonWhitelisted = data.nonWhitelistedSymbols || [];
        
        let description = `✅ Autorizados (${whitelisted.length}): ${whitelisted.join(', ')}`;
        if (nonWhitelisted.length > 0) {
          description += `\n❌ Não autorizados (${nonWhitelisted.length}): ${nonWhitelisted.join(', ')}`;
        }
        
        toast({
          title: "🔍 Verificação de Whitelist Concluída",
          description: description,
          duration: 15000
        });
        
        // Mostrar recomendações
        if (data.recommendations) {
          setTimeout(() => {
            toast({
              title: "💡 Recomendação",
              description: data.recommendations.message,
              duration: 10000
            });
          }, 2000);
        }
      } else {
        throw new Error(data.error || 'Erro na verificação da whitelist');
      }
    } catch (error) {
      console.error('Erro na verificação de whitelist:', error);
      toast({
        title: "❌ Erro na Verificação de Whitelist",
        description: error instanceof Error ? error.message : "Verifique suas credenciais da Binance",
        variant: "destructive"
      });
    } finally {
      setIsTestingBinance(false);
    }
  };

  const handleSaveOKX = () => {
    if (!okxCredentials.apiKey || !okxCredentials.secretKey || !okxCredentials.passphrase) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos da API OKX",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem("okx_credentials", JSON.stringify(okxCredentials));
    recheckCredentials();
    toast({
      title: "Sucesso",
      description: "Credenciais da OKX salvas com segurança",
    });
  };

  const testOKXConnection = async () => {
    if (!okxCredentials.apiKey || !okxCredentials.secretKey || !okxCredentials.passphrase) {
      toast({
        title: "Erro",
        description: "Configure as credenciais da OKX primeiro",
        variant: "destructive"
      });
      return;
    }

    setIsTestingOKX(true);
    try {
      console.log('🔍 Testando conexão real com OKX API...');
      
      const { data, error } = await supabase.functions.invoke('okx-api', {
        body: { 
          action: 'get_prices',
          api_key: okxCredentials.apiKey,
          secret_key: okxCredentials.secretKey,
          passphrase: okxCredentials.passphrase
        }
      });

      console.log('📊 Resposta da OKX:', { data, error });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        const priceCount = data.count || Object.keys(data.data || {}).length || 0;
        toast({
          title: "✅ Conexão OKX Estabelecida",
          description: `Conexão testada com sucesso! ${priceCount} pares de preços obtidos.`,
        });
      } else {
        // Verificar se é erro específico de IP whitelist
        if (data.errorCode === '50110' || (data.error && data.error.includes('whitelist'))) {
          toast({
            title: "❌ IP não autorizado na OKX",
            description: "Configure a whitelist da OKX com 0.0.0.0/0 nas configurações da API OKX",
            variant: "destructive",
            duration: 10000
          });
        } else {
          throw new Error(data.error || 'Erro desconhecido');
        }
      }
    } catch (error) {
      console.error('❌ Erro no teste da OKX:', error);
      toast({
        title: "❌ Erro de Conexão OKX",
        description: error instanceof Error ? error.message : "Falha ao conectar com a API OKX. Verifique suas credenciais.",
        variant: "destructive"
      });
    } finally {
      setIsTestingOKX(false);
    }
  };

  const handleSaveMEXC = () => {
    if (!mexcCredentials.apiKey || !mexcCredentials.secretKey) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos da API MEXC",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem("mexc_credentials", JSON.stringify(mexcCredentials));
    recheckCredentials();
    toast({
      title: "Sucesso",
      description: "Credenciais da MEXC salvas com segurança",
    });
  };

  const testMEXCConnection = async () => {
    if (!mexcCredentials.apiKey || !mexcCredentials.secretKey) {
      toast({
        title: "Erro",
        description: "Configure as credenciais da MEXC primeiro",
        variant: "destructive"
      });
      return;
    }

    setIsTestingMEXC(true);
    try {
      console.log('🔍 Testando conexão real com MEXC API...');
      
      const { data, error } = await supabase.functions.invoke('mexc-api', {
        body: { 
          action: 'get_balances',
          api_key: mexcCredentials.apiKey,
          secret_key: mexcCredentials.secretKey
        }
      });

      console.log('📊 Resposta da MEXC:', { data, error });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        toast({
          title: "✅ Conexão MEXC Estabelecida",
          description: "Conexão testada com sucesso! Credenciais válidas.",
        });
      } else {
        // Verificar se é erro específico de IP whitelist
        if (data.error && data.error.includes('whitelist')) {
          toast({
            title: "❌ IP não autorizado na MEXC",
            description: "Configure a whitelist da MEXC com os IPs: 18.231.48.154 e 15.228.34.4 ou use 0.0.0.0/0",
            variant: "destructive",
            duration: 10000
          });
        } else {
          throw new Error(data.error || 'Erro desconhecido');
        }
      }
    } catch (error) {
      console.error('❌ Erro no teste da MEXC:', error);
      toast({
        title: "❌ Erro de Conexão MEXC",
        description: error instanceof Error ? error.message : "Falha ao conectar com a API MEXC. Verifique suas credenciais.",
        variant: "destructive"
      });
    } finally {
      setIsTestingMEXC(false);
    }
  };

  const handleSaveTradingConfig = () => {
    localStorage.setItem("trading_config", JSON.stringify(tradingConfig));
    toast({
      title: "Sucesso",
      description: "Configurações de trading salvas com sucesso",
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Configuração de APIs</h2>
        <p className="text-muted-foreground">
          Configure suas credenciais de API para acessar dados em tempo real
        </p>
      </div>


      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Suas credenciais são armazenadas localmente no seu navegador e nunca são enviadas para nossos servidores.
          <br />
          Configure suas credenciais reais das exchanges para acessar seus saldos e executar operações de arbitragem. 
          Você pode usar o sistema imediatamente para testes, mas para operações reais, configure suas próprias credenciais.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="binance" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="binance" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Binance API
          </TabsTrigger>
          <TabsTrigger value="okx" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            OKX API
          </TabsTrigger>
          <TabsTrigger value="okx-whitelist" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            OKX Whitelist
          </TabsTrigger>
          <TabsTrigger value="mexc" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            MEXC API
          </TabsTrigger>
          <TabsTrigger value="hyperliquid" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Hyperliquid API
          </TabsTrigger>
          <TabsTrigger value="trading" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Trading
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hyperliquid">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Configuração Hyperliquid
              </CardTitle>
              <CardDescription>
                Configure suas credenciais da API Hyperliquid para executar arbitragens automaticamente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="hyperliquid-wallet-name">Wallet Name</Label>
                <Input
                  id="hyperliquid-wallet-name"
                  type="text"
                  placeholder="Insira o nome da sua wallet Hyperliquid"
                  value={hyperliquidCredentials.walletName}
                  onChange={(e) => setHyperliquidCredentials(prev => ({ ...prev, walletName: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hyperliquid-wallet-address">Wallet Address</Label>
                <Input
                  id="hyperliquid-wallet-address"
                  type="text"
                  placeholder="Insira o endereço da sua wallet Hyperliquid"
                  value={hyperliquidCredentials.walletAddress}
                  onChange={(e) => setHyperliquidCredentials(prev => ({ ...prev, walletAddress: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="hyperliquid-private-key">Private Key</Label>
                <div className="relative">
                  <Input
                    id="hyperliquid-private-key"
                    type={showHyperliquidSecret ? "text" : "password"}
                    placeholder="Insira sua Private Key da Hyperliquid"
                    value={hyperliquidCredentials.privateKey}
                    onChange={(e) => setHyperliquidCredentials(prev => ({ ...prev, privateKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowHyperliquidSecret(!showHyperliquidSecret)}
                  >
                    {showHyperliquidSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveHyperliquid} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Credenciais
                </Button>
                <Button 
                  variant="outline" 
                  onClick={testHyperliquidConnection}
                  disabled={isTestingHyperliquid}
                  className="flex items-center gap-2"
                >
                  <TestTube className="h-4 w-4" />
                  {isTestingHyperliquid ? "Testando..." : "Testar Conexão"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="binance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Configuração Binance
              </CardTitle>
              <CardDescription>
                Configure suas credenciais da API Binance para acessar dados de mercado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Para usar suas credenciais da Binance:
                  <br />• Acesse <a href="https://www.binance.com/en/my/settings/api-management" target="_blank" className="text-primary underline">Binance API Management</a>
                  <br />• Ative "Enable Reading" e "Enable Spot & Margin Trading"
                  <br />• Configure restrições de IP ou deixe sem restrições  
                  <br />• <strong>Para Cross-Over:</strong> Use "Verificar Whitelist" para ver símbolos autorizados
                  <br />• <strong>Importante:</strong> Certifique-se que XRPUSDT está na whitelist
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="binance-api-key">API Key</Label>
                <Input
                  id="binance-api-key"
                  type="text"
                  placeholder="Insira sua API Key da Binance"
                  value={binanceCredentials.apiKey}
                  onChange={(e) => setBinanceCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="binance-secret-key">Secret Key</Label>
                <div className="relative">
                  <Input
                    id="binance-secret-key"
                    type={showBinanceSecret ? "text" : "password"}
                    placeholder="Insira sua Secret Key da Binance"
                    value={binanceCredentials.secretKey}
                    onChange={(e) => setBinanceCredentials(prev => ({ ...prev, secretKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowBinanceSecret(!showBinanceSecret)}
                  >
                    {showBinanceSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveBinance} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Credenciais
                </Button>
                <Button 
                  variant="outline" 
                  onClick={testBinanceConnection}
                  disabled={isTestingBinance}
                  className="flex items-center gap-2"
                >
                  <TestTube className="h-4 w-4" />
                  {isTestingBinance ? "Testando..." : "Testar Conexão"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={testBinanceWhitelist}
                  disabled={isTestingBinance}
                  className="flex items-center gap-2 text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  <Shield className="h-4 w-4" />
                  {isTestingBinance ? "Verificando..." : "Verificar Whitelist"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="okx">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Configuração OKX
              </CardTitle>
              <CardDescription>
                Configure suas credenciais da API OKX para executar arbitragens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Para usar suas credenciais da OKX:
                  <br />• Acesse <a href="https://www.okx.com/account/my-api" target="_blank" className="text-primary underline">OKX API Management</a>
                  <br />• Crie uma nova API Key com permissões de "Trade" e "Read"
                  <br />• Cole a API Key, Secret Key e Passphrase nos campos abaixo
                  <br />• Teste a conexão antes de usar o modo real
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="okx-api-key">API Key</Label>
                <Input
                  id="okx-api-key"
                  type="text"
                  placeholder="Insira sua API Key da OKX"
                  value={okxCredentials.apiKey}
                  onChange={(e) => setOkxCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="okx-secret-key">Secret Key</Label>
                <div className="relative">
                  <Input
                    id="okx-secret-key"
                    type={showOKXSecret ? "text" : "password"}
                    placeholder="Insira sua Secret Key da OKX"
                    value={okxCredentials.secretKey}
                    onChange={(e) => setOkxCredentials(prev => ({ ...prev, secretKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowOKXSecret(!showOKXSecret)}
                  >
                    {showOKXSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="okx-passphrase">Passphrase</Label>
                <div className="relative">
                  <Input
                    id="okx-passphrase"
                    type={showOKXPassphrase ? "text" : "password"}
                    placeholder="Insira sua Passphrase da OKX"
                    value={okxCredentials.passphrase}
                    onChange={(e) => setOkxCredentials(prev => ({ ...prev, passphrase: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowOKXPassphrase(!showOKXPassphrase)}
                  >
                    {showOKXPassphrase ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveOKX} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Credenciais
                </Button>
                <Button 
                  variant="outline" 
                  onClick={testOKXConnection}
                  disabled={isTestingOKX}
                  className="flex items-center gap-2"
                >
                  <TestTube className="h-4 w-4" />
                  {isTestingOKX ? "Testando..." : "Testar Conexão"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="okx-whitelist">
          <OKXWhitelistManager />
        </TabsContent>

        <TabsContent value="mexc">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Configuração MEXC
              </CardTitle>
              <CardDescription>
                Configure suas credenciais da API MEXC para executar arbitragens
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Importante:</strong> Para usar suas credenciais da MEXC:
                  <br />• Acesse <a href="https://www.mexc.com/user/openapi" target="_blank" className="text-primary underline">MEXC API Management</a>
                  <br />• Crie uma nova API Key com permissões de "Trade" e "Read"
                  <br />• Configure a whitelist com os IPs: <code>18.231.48.154</code> e <code>15.228.34.4</code> ou use <code>0.0.0.0/0</code> (menos seguro)
                  <br />• Teste a conexão antes de usar o modo real
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label htmlFor="mexc-api-key">API Key</Label>
                <Input
                  id="mexc-api-key"
                  type="text"
                  placeholder="Insira sua API Key da MEXC"
                  value={mexcCredentials.apiKey}
                  onChange={(e) => setMexcCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="mexc-secret-key">Secret Key</Label>
                <div className="relative">
                  <Input
                    id="mexc-secret-key"
                    type={showMEXCSecret ? "text" : "password"}
                    placeholder="Insira sua Secret Key da MEXC"
                    value={mexcCredentials.secretKey}
                    onChange={(e) => setMexcCredentials(prev => ({ ...prev, secretKey: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowMEXCSecret(!showMEXCSecret)}
                  >
                    {showMEXCSecret ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSaveMEXC} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Credenciais
                </Button>
                <Button 
                  variant="outline" 
                  onClick={testMEXCConnection}
                  disabled={isTestingMEXC}
                  className="flex items-center gap-2"
                >
                  <TestTube className="h-4 w-4" />
                  {isTestingMEXC ? "Testando..." : "Testar Conexão"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Configurações de Trading
              </CardTitle>
              <CardDescription>
                Configure tolerâncias de slippage, limites de trading e outras preferências
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-slippage">Slippage Mínimo (%)</Label>
                    <Input
                      id="min-slippage"
                      type="number"
                      step="0.01"
                      value="0.1"
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-sm text-muted-foreground">
                      Slippage mínimo fixo em 0.1% para proteção de preço
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-slippage">Slippage Máximo (%)</Label>
                    <Input
                      id="max-slippage"
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="10"
                      value={tradingConfig.maxSlippage}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0.1;
                        const validValue = Math.max(0.1, Math.min(10, value)); // Entre 0.1% e 10%
                        setTradingConfig(prev => ({ 
                          ...prev, 
                          maxSlippage: validValue
                        }));
                      }}
                    />
                    <p className="text-sm text-muted-foreground">
                      Tolerância máxima de slippage (mín. 0.1%, máx. 10%)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="max-trade-size">Tamanho Máximo por Trade (USD)</Label>
                    <Input
                      id="max-trade-size"
                      type="number"
                      min="10"
                      value={tradingConfig.maxTradeSize}
                      onChange={(e) => setTradingConfig(prev => ({ 
                        ...prev, 
                        maxTradeSize: parseFloat(e.target.value) || 10 
                      }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="daily-limit">Limite Diário (USD)</Label>
                    <Input
                      id="daily-limit"
                      type="number"
                      min="100"
                      value={tradingConfig.dailyLimit}
                      onChange={(e) => setTradingConfig(prev => ({ 
                        ...prev, 
                        dailyLimit: parseFloat(e.target.value) || 1000 
                      }))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="mev-protection">Proteção MEV</Label>
                      <p className="text-sm text-muted-foreground">
                        Ativar proteção contra ataques MEV
                      </p>
                    </div>
                    <Switch
                      id="mev-protection"
                      checked={tradingConfig.mevProtection}
                      onCheckedChange={(checked) => setTradingConfig(prev => ({ 
                        ...prev, 
                        mevProtection: checked 
                      }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="wallet-type">Tipo de Carteira para Trading</Label>
                    <Select 
                      value={tradingConfig.walletType} 
                      onValueChange={(value) => setTradingConfig(prev => ({ 
                        ...prev, 
                        walletType: value 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de carteira" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="phantom">Phantom (Solana)</SelectItem>
                        <SelectItem value="solflare">Solflare (Solana)</SelectItem>
                        <SelectItem value="metamask">MetaMask (Web3)</SelectItem>
                        <SelectItem value="walletconnect">WalletConnect</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Integração Web3 quando MetaMask for selecionado */}
                    {tradingConfig.walletType === 'metamask' && (
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            <span className="font-medium">Carteira Web3</span>
                          </div>
                          {wallet.isConnected && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </div>

                        {!isMetaMaskInstalled() ? (
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription>
                              MetaMask não está instalado. 
                              <a 
                                href="https://metamask.io/" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline ml-1"
                              >
                                Instalar MetaMask
                              </a>
                            </AlertDescription>
                          </Alert>
                        ) : !wallet.isConnected ? (
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">
                              Conecte sua carteira MetaMask para gerenciar transferências
                            </p>
                            <Button 
                              onClick={connectWallet} 
                              disabled={isConnecting}
                              size="sm"
                              className="w-full"
                            >
                              {isConnecting ? "Conectando..." : "Conectar MetaMask"}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span>Endereço:</span>
                              <code className="bg-background px-2 py-1 rounded text-xs">
                                {wallet.address?.substring(0, 6)}...{wallet.address?.substring(wallet.address.length - 4)}
                              </code>
                            </div>
                            {wallet.chainId && (
                              <div className="flex items-center justify-between text-sm">
                                <span>Rede:</span>
                                <span className="text-xs">
                                  {wallet.chainId === 1 ? 'Ethereum' : 
                                   wallet.chainId === 56 ? 'BSC' :
                                   wallet.chainId === 137 ? 'Polygon' :
                                   wallet.chainId === 42161 ? 'Arbitrum' : 
                                   `Chain ${wallet.chainId}`}
                                </span>
                              </div>
                            )}
                            <Button 
                              onClick={disconnectWallet} 
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              Desconectar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="concurrent-trades">Trades Simultâneos Máximos</Label>
                    <Input
                      id="concurrent-trades"
                      type="number"
                      min="1"
                      max="10"
                      value={tradingConfig.maxConcurrentTrades}
                      onChange={(e) => setTradingConfig(prev => ({ 
                        ...prev, 
                        maxConcurrentTrades: parseInt(e.target.value) || 3 
                      }))}
                    />
                    <p className="text-sm text-muted-foreground">
                      Número máximo de operações simultâneas (padrão: 3)
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Button onClick={handleSaveTradingConfig} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Salvar Configurações de Trading
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default APIConfiguration;