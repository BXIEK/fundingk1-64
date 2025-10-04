import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useDirectExchangeAPI } from '@/hooks/useDirectExchangeAPI';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, Globe, Shield, CheckCircle2, AlertCircle } from 'lucide-react';

export const DirectIPConnectionTest = () => {
  const { toast } = useToast();
  const { getBinanceBalances, getOKXBalances, isLoading } = useDirectExchangeAPI();
  const [clientIP, setClientIP] = useState<string | null>(null);
  const [binanceStatus, setBinanceStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [okxStatus, setOkxStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Detectar IP do cliente
  const detectClientIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      setClientIP(data.ip);
      toast({
        title: "IP Detectado",
        description: `Seu IP: ${data.ip}`,
      });
    } catch (error) {
      toast({
        title: "Erro ao detectar IP",
        description: "Não foi possível obter seu IP público",
        variant: "destructive",
      });
    }
  };

  // Testar conexão direta com Binance
  const testBinanceConnection = async () => {
    try {
      setBinanceStatus('idle');
      
      // Buscar credenciais do Supabase
      const { data: credsData, error: credsError } = await supabase.functions.invoke('get-binance-credentials');

      if (credsError) {
        throw new Error(`Erro ao buscar credenciais: ${credsError.message}`);
      }

      if (!credsData?.success) {
        throw new Error(credsData?.error || 'Credenciais da Binance não encontradas');
      }

      const { credentials } = credsData;

      if (!credentials?.apiKey || !credentials?.secretKey) {
        throw new Error('Credenciais da Binance incompletas');
      }

      console.log('🔑 Credenciais Binance obtidas, testando conexão...');

      // Fazer requisição DIRETA do cliente (usando seu IP)
      const result = await getBinanceBalances({
        binance_api_key: credentials.apiKey,
        binance_secret_key: credentials.secretKey,
      });

      if (result.success) {
        setBinanceStatus('success');
        toast({
          title: "✅ Binance Conectada via SEU IP!",
          description: `Saldos obtidos com sucesso usando IP: ${clientIP || 'seu IP'}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setBinanceStatus('error');
      console.error('❌ Erro no teste Binance:', error);
      toast({
        title: "Erro na conexão com Binance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Testar conexão direta com OKX
  const testOKXConnection = async () => {
    try {
      setOkxStatus('idle');
      
      // Buscar credenciais do Supabase
      const { data: credsData, error: credsError } = await supabase.functions.invoke('get-okx-credentials');

      if (credsError) {
        throw new Error(`Erro ao buscar credenciais: ${credsError.message}`);
      }

      if (!credsData?.success) {
        throw new Error(credsData?.error || 'Credenciais da OKX não encontradas');
      }

      const { credentials } = credsData;

      if (!credentials?.apiKey || !credentials?.secretKey || !credentials?.passphrase) {
        throw new Error('Credenciais da OKX incompletas');
      }

      console.log('🔑 Credenciais OKX obtidas, testando conexão...');

      // Fazer requisição DIRETA do cliente (usando seu IP)
      const result = await getOKXBalances({
        okx_api_key: credentials.apiKey,
        okx_secret_key: credentials.secretKey,
        okx_passphrase: credentials.passphrase,
      });

      if (result.success) {
        setOkxStatus('success');
        toast({
          title: "✅ OKX Conectada via SEU IP!",
          description: `Saldos obtidos com sucesso usando IP: ${clientIP || 'seu IP'}`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      setOkxStatus('error');
      console.error('❌ Erro no teste OKX:', error);
      toast({
        title: "Erro na conexão com OKX",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: 'idle' | 'success' | 'error') => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Wifi className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Conexão Direta via IP do Cliente
        </CardTitle>
        <CardDescription>
          Teste a conexão usando <strong>seu IP</strong> ao invés dos IPs dinâmicos do Supabase
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* IP do Cliente */}
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">Seu IP Público</p>
              <p className="text-xs text-blue-700">
                {clientIP ? (
                  <span className="font-mono">{clientIP}</span>
                ) : (
                  'Não detectado'
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={detectClientIP}
            disabled={isLoading}
          >
            Detectar IP
          </Button>
        </div>

        {/* Status das Exchanges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Binance */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(binanceStatus)}
                <span className="font-medium">Binance</span>
              </div>
              <Badge variant={binanceStatus === 'success' ? 'default' : 'outline'}>
                {binanceStatus === 'success' ? 'Conectado' : 'Teste'}
              </Badge>
            </div>
            <Button
              onClick={testBinanceConnection}
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              Testar Conexão
            </Button>
          </div>

          {/* OKX */}
          <div className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(okxStatus)}
                <span className="font-medium">OKX</span>
              </div>
              <Badge variant={okxStatus === 'success' ? 'default' : 'outline'}>
                {okxStatus === 'success' ? 'Conectado' : 'Teste'}
              </Badge>
            </div>
            <Button
              onClick={testOKXConnection}
              disabled={isLoading}
              className="w-full"
              size="sm"
            >
              Testar Conexão
            </Button>
          </div>
        </div>

        {/* Explicação */}
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <div className="flex gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-900">
                Conexão Direta Ativada
              </p>
              <p className="text-xs text-green-700">
                Todas as requisições para Binance e OKX são feitas diretamente do seu navegador,
                usando <strong>seu IP</strong>. Isso permite que você configure o whitelist de IP
                nas exchanges com seu endereço IP fixo.
              </p>
            </div>
          </div>
        </div>

        {/* Instruções */}
        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-yellow-900">
                Configurando Whitelist nas Exchanges
              </p>
              <ol className="text-xs text-yellow-700 space-y-1 list-decimal list-inside">
                <li>Detecte seu IP clicando em "Detectar IP"</li>
                <li>Acesse a página de API das exchanges (Binance/OKX)</li>
                <li>Adicione seu IP à whitelist das chaves API</li>
                <li>Teste a conexão usando os botões acima</li>
              </ol>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
