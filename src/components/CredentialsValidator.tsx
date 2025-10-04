import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExchangeStatus {
  name: string;
  status: 'checking' | 'ok' | 'error' | 'ip_blocked';
  message: string;
  details?: any;
}

export const CredentialsValidator = () => {
  const [statuses, setStatuses] = useState<ExchangeStatus[]>([
    { name: 'Binance', status: 'checking', message: 'Verificando...' },
    { name: 'OKX', status: 'checking', message: 'Verificando...' },
  ]);
  const [isValidating, setIsValidating] = useState(false);
  const { toast } = useToast();

  const validateAll = async () => {
    setIsValidating(true);
    
    // Reset statuses
    setStatuses([
      { name: 'Binance', status: 'checking', message: 'Verificando...' },
      { name: 'OKX', status: 'checking', message: 'Verificando...' },
    ]);

    // Validate Binance
    try {
      const binanceCreds = localStorage.getItem('binance_credentials');
      if (!binanceCreds) {
        throw new Error('Credenciais não encontradas no localStorage');
      }

      const { apiKey, secretKey } = JSON.parse(binanceCreds);
      
      const response = await fetch(
        `https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/test-binance-connection`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aGNzamxmd2tod2t2aGZhY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDEzMzQsImV4cCI6MjA2Njk3NzMzNH0.WLA9LhdQHPZJpTC1qasafl3Gb7IqRvXN61XVcKnzx0U`
          },
          body: JSON.stringify({ apiKey, secretKey })
        }
      );

      const data = await response.json();

      if (data.success) {
        setStatuses(prev => prev.map(s => 
          s.name === 'Binance' 
            ? { ...s, status: 'ok', message: `✅ CONECTADA - ${(data.accountInfo?.totalAssets ?? 0)} ativos encontrados`, details: data }
            : s
        ));
      } else {
        const isIPError = data.error?.includes('IP') || data.error?.includes('whitelist');
        const isCredError = data.error?.includes('API Key') || data.error?.includes('inválida') || data.error?.includes('Invalid API-key');
        setStatuses(prev => prev.map(s => 
          s.name === 'Binance' 
            ? { 
                ...s, 
                status: isIPError ? 'ip_blocked' : 'error', 
                message: isCredError ? '❌ API Key ou Secret Key INVÁLIDAS' : data.error || 'Erro desconhecido',
                details: data
              }
            : s
        ));
      }
    } catch (error: any) {
      setStatuses(prev => prev.map(s => 
        s.name === 'Binance' 
          ? { ...s, status: 'error', message: 'Erro ao conectar: ' + (error.message || 'Desconhecido') }
          : s
      ));
    }

    // Validate OKX - TESTE REAL DE BALANCES
    try {
      const okxCreds = localStorage.getItem('okx_credentials');
      if (!okxCreds) {
        throw new Error('Credenciais OKX não encontradas');
      }

      const { apiKey, secretKey, passphrase } = JSON.parse(okxCreds);
      
      const response = await fetch(
        `https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/okx-api`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aGNzamxmd2tod2t2aGZhY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDEzMzQsImV4cCI6MjA2Njk3NzMzNH0.WLA9LhdQHPZJpTC1qasafl3Gb7IqRvXN61XVcKnzx0U`
          },
          body: JSON.stringify({ 
            action: 'get_balances',
            api_key: apiKey,
            secret_key: secretKey,
            passphrase: passphrase
          })
        }
      );

      const data = await response.json();

      if (data.success && data.balances) {
        const balanceCount = data.balances.length || 0;
        setStatuses(prev => prev.map(s => 
          s.name === 'OKX' 
            ? { ...s, status: 'ok', message: `✅ CONECTADA - ${balanceCount} saldos encontrados`, details: data }
            : s
        ));
      } else {
        const isIPError = data.error?.includes('IP') || data.error?.includes('whitelist') || data.error?.includes('not included');
        setStatuses(prev => prev.map(s => 
          s.name === 'OKX' 
            ? { 
                ...s, 
                status: isIPError ? 'ip_blocked' : 'error', 
                message: data.error || 'Falha ao obter saldos',
                details: data
              }
            : s
        ));
      }
    } catch (error: any) {
      setStatuses(prev => prev.map(s => 
        s.name === 'OKX' 
          ? { ...s, status: 'error', message: 'Erro ao conectar: ' + (error.message || 'Desconhecido') }
          : s
      ));
    }

    // Validações adicionais desativadas temporariamente para evitar chamadas indevidas (Bybit/MEXC/Hyperliquid/Pionex)
    setIsValidating(false);
    return;

    setIsValidating(false);
    
    const allOk = statuses.every(s => s.status === 'ok');
    if (allOk) {
      toast({
        title: "✅ Todas as exchanges OK",
        description: "Todas as conexões estão funcionando corretamente",
      });
    }
  };

  useEffect(() => {
    validateAll();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'ip_blocked':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return <Badge variant="default" className="bg-green-500">OK</Badge>;
      case 'error':
        return <Badge variant="destructive">ERRO</Badge>;
      case 'ip_blocked':
        return <Badge variant="secondary" className="bg-yellow-500 text-black">IP BLOQUEADO</Badge>;
      default:
        return <Badge variant="outline">Verificando...</Badge>;
    }
  };

  const getFixInstructions = (exchange: ExchangeStatus) => {
    if (exchange.status === 'ip_blocked') {
      return (
        <Alert className="mt-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription>
            <strong className="text-yellow-700 dark:text-yellow-300">🔒 IP BLOQUEADO</strong>
            <p className="mt-2 text-sm">
              O servidor Supabase não tem permissão para acessar sua conta {exchange.name}.
            </p>
            <p className="mt-2 text-sm font-semibold">
              Vá para a aba "IP Whitelist" nesta página para ver os IPs que devem ser adicionados na whitelist da sua API Key {exchange.name}.
            </p>
          </AlertDescription>
        </Alert>
      );
    }

    if (exchange.status === 'error') {
      if (exchange.name === 'Binance') {
        return (
          <Alert className="mt-2" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>⚠️ CREDENCIAIS INVÁLIDAS - Ação Imediata Necessária:</strong>
              <ol className="list-decimal ml-4 mt-2 space-y-2 text-sm">
                <li><strong>Verifique a API Key</strong> - Confirme que copiou TODA a chave sem espaços</li>
                <li><strong>Verifique a Secret Key</strong> - Deve ter sido copiada no momento da criação</li>
                <li><strong>Permissões obrigatórias</strong>: "Enable Reading" + "Enable Spot & Margin Trading"</li>
                <li className="text-red-600 font-semibold">
                  <strong>🚨 RESTRIÇÃO DE IP (PROBLEMA COMUM)</strong>: 
                  A Binance REJEITA IPs de servidores AWS/Cloud. 
                  <strong> SOLUÇÃO → Selecione "Unrestricted (Less Secure)"</strong> em vez de adicionar IPs específicos.
                </li>
                <li><strong>Última tentativa</strong>: Delete a API Key atual e crie uma NOVA na Binance</li>
              </ol>
              <div className="flex gap-2 mt-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open('https://www.binance.com/en/my/settings/api-management', '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Binance API Management
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        );
      }

      if (exchange.name === 'OKX') {
        return (
          <Alert className="mt-2" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Soluções:</strong>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Verifique API Key, Secret Key e Passphrase</li>
                <li>Confirme as permissões de leitura na API</li>
                <li>Verifique se a API está ativa</li>
              </ol>
            </AlertDescription>
          </Alert>
        );
      }

      if (exchange.name === 'Bybit') {
        return (
          <Alert className="mt-2" variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Soluções:</strong>
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Verifique API Key e Secret Key</li>
                <li>Confirme as permissões de leitura na API</li>
                <li>Verifique se a API está ativa</li>
                <li>Certifique-se de que a conta Unified está habilitada</li>
              </ol>
            </AlertDescription>
          </Alert>
        );
      }

      return (
        <Alert className="mt-2" variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Erro:</strong> {exchange.message}
            <br />
            Verifique suas credenciais na exchange.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Status das Conexões
          <Button
            onClick={validateAll}
            disabled={isValidating}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
            Revalidar
          </Button>
        </CardTitle>
        <CardDescription>
          Validação automática das credenciais de cada exchange
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {statuses.map((exchange) => (
          <div key={exchange.name} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                {getStatusIcon(exchange.status)}
                <span className="font-semibold">{exchange.name}</span>
              </div>
              {getStatusBadge(exchange.status)}
            </div>
            
            <p className="text-sm text-muted-foreground mb-2">{exchange.message}</p>
            
            {getFixInstructions(exchange)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
