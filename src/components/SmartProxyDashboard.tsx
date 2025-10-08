import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSmartProxy } from "@/hooks/useSmartProxy";
import { useToast } from "@/hooks/use-toast";
import { 
  Globe, 
  Zap, 
  Shield, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  MapPin,
  Activity,
  AlertTriangle
} from "lucide-react";

export const SmartProxyDashboard = () => {
  const { toast } = useToast();
  const { executeRequest, requestWithFallback } = useSmartProxy();
  
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<'auto' | 'aggressive' | 'stealth'>('auto');
  const [selectedCountry, setSelectedCountry] = useState<string>('random');
  
  const countries = [
    { code: 'random', name: '🌍 Automático', flag: '🌍' },
    { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
    { code: 'UK', name: 'Reino Unido', flag: '🇬🇧' },
    { code: 'DE', name: 'Alemanha', flag: '🇩🇪' },
    { code: 'SG', name: 'Singapura', flag: '🇸🇬' },
    { code: 'JP', name: 'Japão', flag: '🇯🇵' },
    { code: 'CA', name: 'Canadá', flag: '🇨🇦' }
  ];

  const strategies = [
    { 
      value: 'auto', 
      name: 'Automático', 
      icon: <Zap className="h-4 w-4" />,
      description: 'Balanceamento entre velocidade e sucesso'
    },
    { 
      value: 'stealth', 
      name: 'Stealth', 
      icon: <Shield className="h-4 w-4" />,
      description: 'Máximo disfarce, menor detecção'
    },
    { 
      value: 'aggressive', 
      name: 'Agressivo', 
      icon: <Activity className="h-4 w-4" />,
      description: 'Máximo esforço, todos os proxies'
    }
  ];

  const testBinanceEndpoints = async () => {
    setLoading(true);
    setTestResults([]);
    
    const endpoints = [
      { name: 'Server Time', url: 'https://api.binance.com/api/v3/time' },
      { name: 'Exchange Info', url: 'https://api.binance.com/api/v3/exchangeInfo' },
      { name: 'Ticker Price (BTCUSDT)', url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT' },
      { name: '24h Ticker (ETHUSDT)', url: 'https://api.binance.com/api/v3/ticker/24hr?symbol=ETHUSDT' },
      { name: 'Klines (BNBUSDT)', url: 'https://api.binance.com/api/v3/klines?symbol=BNBUSDT&interval=1h&limit=1' }
    ];

    toast({
      title: "🚀 Iniciando Teste",
      description: "Testando Bright Data Web Unlocker API..."
    });

    const results = [];

    for (const endpoint of endpoints) {
      try {
        const startTime = Date.now();
        
        console.log(`🧪 Testando ${endpoint.name}...`);
        
        const result = await executeRequest({
          targetUrl: endpoint.url,
          method: 'GET',
          strategy: selectedStrategy as any,
          country: selectedCountry as any,
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const endTime = Date.now();
        
        console.log(`✅ Resultado ${endpoint.name}:`, result);
        
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          success: result.success,
          responseTime: endTime - startTime,
          source: result.source || 'bright-data-web-unlocker',
          country: result.country,
          ip: result.ip,
          proxy: result.proxy,
          error: result.error,
          timestamp: new Date()
        });

        // Atualizar em tempo real
        setTestResults([...results]);
        
      } catch (error: any) {
        console.error(`❌ Erro em ${endpoint.name}:`, error);
        results.push({
          name: endpoint.name,
          url: endpoint.url,
          success: false,
          responseTime: 0,
          error: error.message || 'Erro desconhecido',
          timestamp: new Date()
        });
        setTestResults([...results]);
      }
    }

    setTestResults(results);
    setLoading(false);

    const successCount = results.filter(r => r.success).length;
    const successRate = (successCount / results.length) * 100;

    toast({
      title: successCount === results.length ? "✅ Teste Concluído com Sucesso!" : "⚠️ Teste Concluído com Erros",
      description: `${successCount}/${results.length} endpoints acessíveis (${successRate.toFixed(1)}%) via Bright Data Web Unlocker`,
      variant: successRate >= 80 ? "default" : "destructive"
    });
  };

  const getStatusColor = (success: boolean) => {
    return success ? 'text-green-600' : 'text-red-600';
  };

  const getSourceBadge = (source: string) => {
    const variants = {
      'direct': 'default',
      'proxy': 'secondary', 
      'anti-fingerprint': 'outline',
      'bright-data-proxy': 'secondary',
      'bright-data-web-unlocker': 'secondary'
    };
    
    return (
      <Badge variant={variants[source as keyof typeof variants] as any}>
        {source === 'direct' ? 'Direto' : 
         source === 'proxy' ? 'Proxy' : 
         source === 'bright-data-proxy' ? 'Bright Data' :
         source === 'bright-data-web-unlocker' ? 'Web Unlocker' :
         'Anti-Fingerprint'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Bright Data Web Unlocker - Teste Binance API
          </CardTitle>
          <CardDescription>
            Teste de conectividade com APIs públicas da Binance através do Web Unlocker da Bright Data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Seleção de Estratégia */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Estratégia</label>
              <Select value={selectedStrategy} onValueChange={setSelectedStrategy as any}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.value} value={strategy.value}>
                      <div className="flex items-center gap-2">
                        {strategy.icon}
                        {strategy.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seleção de País */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Localização</label>
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((country) => (
                    <SelectItem key={country.code} value={country.code}>
                      <div className="flex items-center gap-2">
                        <span>{country.flag}</span>
                        {country.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botão de Teste */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ação</label>
              <Button 
                onClick={testBinanceEndpoints} 
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Testando...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    Testar Binance
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resultados dos Testes */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Resultados dos Testes
            </CardTitle>
            <CardDescription>
              Status de acesso aos endpoints da Binance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <div>
                      <div className="font-medium">{result.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {result.url.split('.com')[1]?.substring(0, 30)}...
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {result.success && result.source && getSourceBadge(result.source)}
                    
                    {result.country && (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {result.country}
                      </div>
                    )}
                    
                    {result.responseTime > 0 && (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {result.responseTime}ms
                      </div>
                    )}
                    
                    {result.error && (
                      <div className="text-sm text-red-600 max-w-48 truncate">
                        {result.error}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Informações e Documentação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strategies.map((strategy) => (
              <div key={strategy.value} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {strategy.icon}
                  <span className="font-medium">{strategy.name}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {strategy.description}
                </p>
              </div>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">💡 Dica Importante</h4>
            <p className="text-sm text-blue-800">
              Este sistema simula uma VPN através de proxies inteligentes e rotação de IPs. 
              Para máxima eficiência, recomendamos usar a estratégia <strong>Stealth</strong> primeiro, 
              seguida de <strong>Automático</strong>. A estratégia <strong>Agressiva</strong> deve ser 
              usada apenas quando as outras falharem.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};