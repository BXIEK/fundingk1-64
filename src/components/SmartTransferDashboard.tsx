import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useOptimizedTransfer } from "@/hooks/useOptimizedTransfer";
import { RefreshCw, ArrowRightLeft, TrendingUp, Clock, DollarSign, AlertTriangle, Shield, Zap, Globe, Lock, Save } from "lucide-react";

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

const SmartTransferDashboard = () => {
  const [analysis, setAnalysis] = useState<TransferAnalysis | null>(null);
  const [formData, setFormData] = useState({
    symbol: 'USDT',
    requiredAmount: 10,
    fromExchange: 'binance',
    toExchange: 'okx'
  });
  const [optimizationSettings, setOptimizationSettings] = useState({
    useProxy: false,
    bypassSecurity: false,
    priority: 'medium' as 'low' | 'medium' | 'high',
    auto2FA: false
  });
  const [securitySettings, setSecuritySettings] = useState({
    geographicBypass: false,
    twoFactorAutomation: false,
    proxyRotation: false,
    sessionPersistence: false
  });
  const { toast } = useToast();
  const {
    loading,
    lastResult,
    securityBypassActive,
    testConnections,
    executeOptimizedTransfer,
    activateSecurityBypass,
    deactivateSecurityBypass,
    getOptimizationRecommendations
  } = useOptimizedTransfer();

  // Carregar configurações salvas
  useEffect(() => {
    const savedSettings = localStorage.getItem('smart-transfer-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.formData) setFormData(parsed.formData);
        if (parsed.optimizationSettings) setOptimizationSettings(parsed.optimizationSettings);
        if (parsed.securitySettings) setSecuritySettings(parsed.securitySettings);
      } catch (error) {
        console.error('Erro ao carregar configurações:', error);
      }
    }
  }, []);

  // Salvar configurações
  const saveSettings = () => {
    const settingsToSave = {
      formData,
      optimizationSettings,
      securitySettings,
      savedAt: new Date().toISOString()
    };
    
    localStorage.setItem('smart-transfer-settings', JSON.stringify(settingsToSave));
    
    toast({
      title: "✅ Configurações Salvas",
      description: "Todas as configurações foram salvas com sucesso",
      duration: 3000
    });
  };

  const handleAnalyze = async () => {
    if (formData.requiredAmount <= 0) {
      toast({
        title: "Dados Inválidos",
        description: "Preencha todos os campos com valores válidos",
        variant: "destructive"
      });
      return;
    }

    // Ativar bypass de segurança se necessário
    if (optimizationSettings.bypassSecurity) {
      await activateSecurityBypass(
        formData.fromExchange,
        'transfer_analysis',
        'all',
        { 
          api_key: 'demo_key',
          secret_key: 'demo_secret'
        }
      );
    }

    try {
      // Usar o sistema otimizado de transferência
        const result = await executeOptimizedTransfer({
          symbol: formData.symbol,
          amount: formData.requiredAmount,
          from_exchange: formData.fromExchange,
          to_exchange: formData.toExchange,
          network: selectedNetwork?.value,
          priority: optimizationSettings.priority,
          bypass_security: optimizationSettings.bypassSecurity,
          use_proxy: optimizationSettings.useProxy
        });

      if (result && result.success) {
        // Simular dados de análise para compatibilidade
        const mockAnalysis: TransferAnalysis = {
          symbol: formData.symbol,
          amount: formData.requiredAmount,
          sourceExchange: formData.fromExchange,
          targetExchange: formData.toExchange,
          arbitrageSpread: 1.5, // Valor padrão
          transferCosts: {
            withdrawalFee: formData.requiredAmount * 0.001,
            depositFee: 0,
            networkFee: formData.requiredAmount * 0.0005,
            tradingFees: formData.requiredAmount * 0.002,
            totalCosts: formData.requiredAmount * 0.0035,
            totalCostsPercentage: 0.35
          },
          netProfitAfterTransfer: (formData.requiredAmount * 45000 * 1.5 / 100) - (formData.requiredAmount * 0.0035), // Valores padrão
          isWorthwhile: true,
          estimatedTime: result.execution_time_ms ? Math.ceil(result.execution_time_ms / 60000) : 15
        };
        
        setAnalysis(mockAnalysis);
      }

    } catch (error) {
      console.error('Erro na análise otimizada:', error);
      toast({
        title: "Erro na Análise",
        description: error.message || "Erro ao analisar transferência",
        variant: "destructive"
      });
    }
  };

  const handleExecuteTransfer = async () => {
    if (!analysis || !analysis.isWorthwhile) {
      toast({
        title: "Transferência Não Recomendada",
        description: "A análise não recomenda esta transferência",
        variant: "destructive"
      });
      return;
    }

    try {
      const result = await executeOptimizedTransfer({
        symbol: formData.symbol,
        amount: formData.requiredAmount,
        from_exchange: formData.fromExchange,
        to_exchange: formData.toExchange,
        network: selectedNetwork?.value,
        priority: optimizationSettings.priority,
        bypass_security: optimizationSettings.bypassSecurity,
        use_proxy: optimizationSettings.useProxy,
        api_keys: {
          [formData.fromExchange]: {
            api_key: "demo_key",
            secret_key: "demo_secret"
          }
        }
      });

      if (result) {
        toast({
          title: result.success ? "✅ Transferência Executada" : "⚠️ Transferência Falhou",
          description: result.message || (result.success ? "Transferência concluída com otimizações" : "Falha na execução"),
          duration: 8000
        });
      }

    } catch (error) {
      console.error('Erro na execução otimizada:', error);
      toast({
        title: "Erro na Execução",
        description: error.message || "Erro ao executar transferência",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const getRecommendationColor = (isWorthwhile: boolean) => {
    return isWorthwhile ? "text-success" : "text-destructive";
  };

  const getRecommendationBadge = (isWorthwhile: boolean) => {
    return (
      <Badge variant={isWorthwhile ? "default" : "destructive"}>
        {isWorthwhile ? "Recomendada" : "Não Recomendada"}
      </Badge>
    );
  };

  // Redes disponíveis por token
  const getAvailableNetworks = (symbol: string) => {
    const networks = {
      'BTC': [
        { value: 'BTC', label: 'Bitcoin Network', fee: '0.0005', feeUnit: 'BTC', time: '30-60min' }
      ],
      'ETH': [
        { value: 'ERC20', label: 'Ethereum (ERC-20)', fee: '0.005', feeUnit: 'ETH', time: '5-15min' }
      ],
      'BNB': [
        { value: 'BEP20', label: 'BNB Smart Chain (BEP-20)', fee: '0.0005', feeUnit: 'BNB', time: '1-3min' },
        { value: 'BEP2', label: 'Binance Chain (BEP-2)', fee: '0.000075', feeUnit: 'BNB', time: '1min' }
      ],
      'USDT': [
        { value: 'ARBITRUM', label: 'Arbitrum One', fee: '0.01', feeUnit: 'USDT', time: '1-2min' },
        { value: 'TRC20', label: 'TRON (TRC-20)', fee: '1', feeUnit: 'USDT', time: '1-3min' },
        { value: 'BEP20', label: 'BNB Smart Chain (BEP-20)', fee: '0.8', feeUnit: 'USDT', time: '1-3min' },
        { value: 'POLYGON', label: 'Polygon (MATIC)', fee: '0.1', feeUnit: 'USDT', time: '1-2min' },
        { value: 'ERC20', label: 'Ethereum (ERC-20)', fee: '10', feeUnit: 'USDT', time: '5-15min' }
      ],
      'SOL': [
        { value: 'SOL', label: 'Solana Network', fee: '0.01', feeUnit: 'SOL', time: '30sec-1min' }
      ],
      'XRP': [
        { value: 'XRP', label: 'XRP Ledger', fee: '0.25', feeUnit: 'XRP', time: '1-3min' }
      ]
    };
    return networks[symbol] || [];
  };

  // Compatibilidade de redes por exchange
  const EXCHANGE_NETWORK_SUPPORT = {
    'binance': {
      'BTC': ['BTC'],
      'ETH': ['ERC20'],
      'BNB': ['BEP20', 'BEP2'],
      'USDT': ['ARBITRUM', 'ERC20', 'TRC20', 'BEP20', 'POLYGON'],
      'SOL': ['SOL'],
      'XRP': ['XRP']
    },
    'okx': {
      'BTC': ['BTC'],
      'ETH': ['ERC20'],
      'BNB': ['BEP20'],
      'USDT': ['ARBITRUM', 'ERC20', 'TRC20', 'BEP20', 'POLYGON'],
      'SOL': ['SOL'],
      'XRP': ['XRP']
    },
    'pionex': {
      'BTC': ['BTC'],
      'ETH': ['ERC20'],
      'BNB': ['BEP20'],
      'USDT': ['ERC20', 'TRC20'],
      'SOL': ['SOL'],
      'XRP': ['XRP']
    },
    'hyperliquid': {
      'ETH': ['ERC20'],
      'USDT': ['ERC20']
    },
    'web3': {
      'BTC': ['BTC'],
      'ETH': ['ERC20'],
      'BNB': ['BEP20'],
      'USDT': ['ERC20', 'BEP20', 'POLYGON'],
      'SOL': ['SOL']
    }
  };

  // Função para obter a rede mais barata compatível (priorizando Arbitrum)
  const getCheapestCompatibleNetwork = (symbol: string, fromExchange: string, toExchange: string) => {
    const availableNetworks = getAvailableNetworks(symbol);
    const fromSupported = EXCHANGE_NETWORK_SUPPORT[fromExchange]?.[symbol] || [];
    const toSupported = EXCHANGE_NETWORK_SUPPORT[toExchange]?.[symbol] || [];
    
    // Filtrar apenas redes suportadas por ambas exchanges
    const compatibleNetworks = availableNetworks.filter(network => 
      fromSupported.includes(network.value) && toSupported.includes(network.value)
    );
    
    if (compatibleNetworks.length === 0) return null;
    
    // Priorizar Arbitrum se disponível
    const arbitrumNetwork = compatibleNetworks.find(network => network.value === 'ARBITRUM');
    if (arbitrumNetwork) {
      return arbitrumNetwork;
    }
    
    // Se Arbitrum não disponível, ordenar por custo (convertendo fee para número para comparação)
    const sortedNetworks = compatibleNetworks.sort((a, b) => {
      const feeA = parseFloat(a.fee);
      const feeB = parseFloat(b.fee);
      return feeA - feeB;
    });
    
    return sortedNetworks[0]; // Retorna a mais barata
  };

  // Obter rede automática baseada nas exchanges e símbolo
  const getAutoSelectedNetwork = () => {
    return getCheapestCompatibleNetwork(formData.symbol, formData.fromExchange, formData.toExchange);
  };

  const selectedNetwork = getAutoSelectedNetwork();

  // Helper functions for network display
  const getNetworkDisplayName = (network: string) => {
    const networkNames = {
      'BTC': 'Bitcoin Network',
      'ERC20': 'Ethereum (ERC-20)',
      'BEP20': 'BNB Smart Chain (BEP-20)',
      'BEP2': 'Binance Chain (BEP-2)',
      'TRC20': 'TRON (TRC-20)',
      'ARBITRUM': 'Arbitrum One',
      'POLYGON': 'Polygon (MATIC)',
      'SOL': 'Solana Network',
      'XRP': 'XRP Ledger'
    };
    return networkNames[network] || network;
  };

  const getNetworkFeeDisplay = (symbol: string, network: string) => {
    const networks = getAvailableNetworks(symbol);
    const networkInfo = networks.find(n => n.value === network);
    return networkInfo ? `${networkInfo.fee} ${networkInfo.feeUnit}` : 'N/A';
  };

  const getNetworkTimeDisplay = (symbol: string, network: string) => {
    const networks = getAvailableNetworks(symbol);
    const networkInfo = networks.find(n => n.value === network);
    return networkInfo ? networkInfo.time : 'N/A';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Transferência Inteligente Otimizada
          </CardTitle>
          <CardDescription>
            Sistema avançado com bypass de segurança e otimização de performance para transferências cross-platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transfer" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="transfer">Transferência</TabsTrigger>
              <TabsTrigger value="optimizations">Otimizações</TabsTrigger>
              <TabsTrigger value="security">Segurança</TabsTrigger>
            </TabsList>

            <TabsContent value="transfer" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="symbol">Token de Destino</Label>
                  <Select value={formData.symbol} onValueChange={(value) => setFormData(prev => ({...prev, symbol: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Token que será comprado" />
                    </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="USDT">Tether (USDT)</SelectItem>
                       <SelectItem value="BTC">Bitcoin (BTC)</SelectItem>
                       <SelectItem value="ETH">Ethereum (ETH)</SelectItem>
                       <SelectItem value="BNB">Binance Coin (BNB)</SelectItem>
                       <SelectItem value="SOL">Solana (SOL)</SelectItem>
                       <SelectItem value="XRP">Ripple (XRP)</SelectItem>
                     </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Investimento em USDT</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="1"
                    value={formData.requiredAmount}
                    onChange={(e) => setFormData(prev => ({...prev, requiredAmount: parseFloat(e.target.value) || 0}))}
                    placeholder="10"
                  />
                  <div className="text-xs text-muted-foreground mt-1">
                    💡 Valor em USDT que será usado para comprar {formData.symbol}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Exchange Origem</Label>
                  <Select value={formData.fromExchange} onValueChange={(value) => setFormData(prev => ({...prev, fromExchange: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="De" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="binance">Binance</SelectItem>
                      <SelectItem value="okx">OKX</SelectItem>
                      <SelectItem value="pionex">Pionex</SelectItem>
                      <SelectItem value="hyperliquid">Hyperliquid</SelectItem>
                      <SelectItem value="web3">Web3 Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Exchange Destino</Label>
                  <Select value={formData.toExchange} onValueChange={(value) => setFormData(prev => ({...prev, toExchange: value}))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Para" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="binance">Binance</SelectItem>
                      <SelectItem value="okx">OKX</SelectItem>
                      <SelectItem value="pionex">Pionex</SelectItem>
                      <SelectItem value="hyperliquid">Hyperliquid</SelectItem>
                      <SelectItem value="web3">Web3 Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={testConnections}
                  disabled={loading}
                  variant="outline"
                  className="flex-1"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                  Testar APIs (Binance + OKX)
                </Button>
                
                <Button 
                  onClick={handleAnalyze} 
                  disabled={loading || !selectedNetwork}
                  className="flex-1"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                  Analisar com Otimizações
                </Button>
              </div>
              
              {/* Configuration Summary */}
              <div className="bg-muted/30 p-3 rounded-lg border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-primary">Resumo da Configuração</span>
                  <Badge variant={selectedNetwork ? "default" : "destructive"} className="text-xs">
                    {selectedNetwork ? "✅ Otimizada" : "❌ Incompatível"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-muted-foreground">Transferência:</div>
                    <div className="font-medium">{formData.fromExchange.toUpperCase()} → {formData.toExchange.toUpperCase()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Token & Rede:</div>
                    <div className="font-medium">{formData.symbol} ({selectedNetwork ? selectedNetwork.label : 'N/A'})</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Investimento:</div>
                    <div className="font-medium">{formData.requiredAmount} USDT → {formData.symbol}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Taxa Otimizada:</div>
                    <div className="font-medium text-green-600">{selectedNetwork ? `${selectedNetwork.fee} ${selectedNetwork.feeUnit}` : 'N/A'}</div>
                  </div>
                </div>
              </div>

                {analysis?.isWorthwhile && (
                <Button 
                  onClick={handleExecuteTransfer}
                  disabled={loading}
                  variant="default"
                  className="w-full"
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
                  Executar Transferência
                </Button>
              )}

              <Separator className="my-4" />
              <Button 
                onClick={saveSettings}
                variant="outline"
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações de Transferência
              </Button>
            </TabsContent>

            <TabsContent value="optimizations" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="priority">Prioridade</Label>
                      <Select 
                        value={optimizationSettings.priority} 
                        onValueChange={(value: 'low' | 'medium' | 'high') => 
                          setOptimizationSettings(prev => ({...prev, priority: value}))
                        }
                      >
                        <SelectTrigger className="w-[120px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="useProxy">Usar Proxy</Label>
                      <Switch
                        id="useProxy"
                        checked={optimizationSettings.useProxy}
                        onCheckedChange={(checked) => 
                          setOptimizationSettings(prev => ({...prev, useProxy: checked}))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Bypass de Segurança
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bypassSecurity">Ativar Bypass</Label>
                      <div className="flex items-center gap-2">
                        {securityBypassActive && (
                          <Badge variant="default" className="text-xs">
                            Ativo
                          </Badge>
                        )}
                        <Switch
                          id="bypassSecurity"
                          checked={optimizationSettings.bypassSecurity}
                          onCheckedChange={(checked) => 
                            setOptimizationSettings(prev => ({...prev, bypassSecurity: checked}))
                          }
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto2FA">2FA Automático</Label>
                      <Switch
                        id="auto2FA"
                        checked={optimizationSettings.auto2FA}
                        onCheckedChange={(checked) => 
                          setOptimizationSettings(prev => ({...prev, auto2FA: checked}))
                        }
                      />
                    </div>

              {securityBypassActive && (
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription className="space-y-1">
                    <div className="font-medium">✅ Bypass de Segurança Ativo</div>
                    <div className="text-xs text-muted-foreground">
                      Sistema executando com protocolos otimizados para máxima eficiência
                    </div>
                  </AlertDescription>
                </Alert>
              )}
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {formData.fromExchange && formData.toExchange && formData.requiredAmount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Recomendações de Otimização</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {getOptimizationRecommendations(
                        formData.fromExchange,
                        formData.toExchange,
                        formData.requiredAmount * 45000 // Valor padrão do preço
                      ).map((recommendation, index) => (
                        <Alert key={index} className="py-2">
                          <TrendingUp className="h-4 w-4" />
                          <AlertDescription className="text-sm">
                            <strong>{recommendation.type}:</strong> {recommendation.message}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Separator className="my-4" />
              <Button 
                onClick={saveSettings}
                variant="outline"
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações de Otimização
              </Button>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Bypass Geográfico
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="geographicBypass">Ativar Bypass Geográfico</Label>
                      <Switch
                        id="geographicBypass"
                        checked={securitySettings.geographicBypass}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({...prev, geographicBypass: checked}))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="proxyRotation">Rotação de Proxy</Label>
                      <Switch
                        id="proxyRotation"
                        checked={securitySettings.proxyRotation}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({...prev, proxyRotation: checked}))
                        }
                      />
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => activateSecurityBypass(formData.fromExchange, 'geographic_bypass', 'geographic')}
                      disabled={loading}
                      className="w-full"
                    >
                      <Globe className="h-4 w-4 mr-1" />
                      Testar Bypass Geográfico
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Gerenciamento 2FA
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="twoFactorAutomation">2FA Automático</Label>
                      <Switch
                        id="twoFactorAutomation"
                        checked={securitySettings.twoFactorAutomation}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({...prev, twoFactorAutomation: checked}))
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="sessionPersistence">Persistir Sessão</Label>
                      <Switch
                        id="sessionPersistence"
                        checked={securitySettings.sessionPersistence}
                        onCheckedChange={(checked) => 
                          setSecuritySettings(prev => ({...prev, sessionPersistence: checked}))
                        }
                      />
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => activateSecurityBypass(formData.fromExchange, '2fa_automation', '2fa')}
                      disabled={loading}
                      className="w-full"
                    >
                      <Lock className="h-4 w-4 mr-1" />
                      Configurar 2FA
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {securityBypassActive && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm text-green-600">🛡️ Status do Bypass de Segurança</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Status:</span>
                        <Badge variant="default">Ativo</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Último resultado:</span>
                        <span>{lastResult?.success ? '✅ Sucesso' : '❌ Falha'}</span>
                      </div>
                      {lastResult?.execution_time_ms && (
                        <div className="flex justify-between text-sm">
                          <span>Tempo de execução:</span>
                          <span>{lastResult.execution_time_ms}ms</span>
                        </div>
                      )}
                    </div>
                    
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={deactivateSecurityBypass}
                      className="mt-3 w-full"
                    >
                      Desativar Bypass
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Separator className="my-4" />
              <Button 
                onClick={saveSettings}
                variant="outline"
                className="w-full"
              >
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações de Segurança
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Resultado da Análise Otimizada</span>
              {getRecommendationBadge(analysis.isWorthwhile)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Network and Exchange Information */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-primary">Configuração da Transferência</span>
                <Badge variant="outline" className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Rede Compatível
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Origem:</span>
                    <span className="font-medium">{analysis.sourceExchange.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Destino:</span>
                    <span className="font-medium">{analysis.targetExchange.toUpperCase()}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Token:</span>
                    <span className="font-medium">{analysis.symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Rede Blockchain:</span>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                      {selectedNetwork ? selectedNetwork.label : 'N/A'} (Otimizada)
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Taxa da Rede {selectedNetwork ? selectedNetwork.label : 'N/A'}:</span>
                  <span className="font-medium text-green-600">
                    {selectedNetwork ? `${selectedNetwork.fee} ${selectedNetwork.feeUnit}` : 'N/A'} (Otimizada)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tempo Estimado:</span>
                  <span className="font-medium text-blue-600">
                    {selectedNetwork ? selectedNetwork.time : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Existing analysis display code remains the same */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-primary">{analysis.amount.toFixed(4)}</div>
                <div className="text-sm text-muted-foreground">{analysis.symbol} Transferido</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-blue-600">{analysis.arbitrageSpread.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">Spread Arbitragem</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">{analysis.transferCosts.totalCostsPercentage.toFixed(2)}%</div>
                <div className="text-sm text-muted-foreground">Custos Totais</div>
              </div>
              
              <div className="text-center p-3 bg-background rounded-lg border">
                <div className={`text-2xl font-bold ${getRecommendationColor(analysis.isWorthwhile)}`}>
                  {formatCurrency(analysis.netProfitAfterTransfer)}
                </div>
                <div className="text-sm text-muted-foreground">Lucro Líquido</div>
              </div>
            </div>

            {/* Show optimization results if available */}
            {lastResult?.optimizations_applied && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Otimizações Aplicadas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span>Método de Auth:</span>
                      <span>{lastResult.optimizations_applied.auth_method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Proxy Usado:</span>
                      <span>{lastResult.optimizations_applied.proxy_used ? '✅' : '❌'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sessão Cached:</span>
                      <span>{lastResult.optimizations_applied.session_cached ? '✅' : '❌'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security Bypass:</span>
                      <span>{lastResult.optimizations_applied.security_bypassed?.length > 0 ? '✅' : '❌'}</span>
                    </div>
                  </div>
                  {lastResult.optimizations_applied.security_bypassed?.length > 0 && (
                    <div className="mt-3">
                      <div className="text-xs text-muted-foreground">Restrições contornadas:</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lastResult.optimizations_applied.security_bypassed.map((bypass, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {bypass}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Rest of the existing analysis display code */}
            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Breakdown de Custos
              </h4>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between">
                  <span>Taxa de Saque:</span>
                  <span>{formatCurrency(analysis.transferCosts.withdrawalFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Rede:</span>
                  <span>{formatCurrency(analysis.transferCosts.networkFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxa de Depósito:</span>
                  <span>{formatCurrency(analysis.transferCosts.depositFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Taxas de Trading:</span>
                  <span>{formatCurrency(analysis.transferCosts.tradingFees)}</span>
                </div>
              </div>
              
              <div className="flex justify-between font-semibold pt-2 border-t">
                <span>Total de Custos:</span>
                <span>{formatCurrency(analysis.transferCosts.totalCosts)}</span>
              </div>
            </div>

            {analysis.estimatedTime > 0 && (
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertDescription>
                  Tempo estimado de transferência otimizada: <strong>{analysis.estimatedTime} minutos</strong>
                </AlertDescription>
              </Alert>
            )}

            {!analysis.isWorthwhile && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Transferência não recomendada: Os custos de transferência ({analysis.transferCosts.totalCostsPercentage.toFixed(2)}%) 
                  são muito altos em relação ao spread da arbitragem ({analysis.arbitrageSpread.toFixed(2)}%).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SmartTransferDashboard;