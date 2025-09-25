import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CredentialStatus {
  exchange: string;
  status: 'valid' | 'invalid' | 'error' | 'missing';
  message: string;
  details?: any;
  suggestions?: string[];
}

interface ValidationResult {
  success: boolean;
  summary: string;
  credentials: CredentialStatus[];
  critical_issues: string[];
  next_steps: string[];
  trading_config?: {
    maxTradeSize: number;
    dailyLimit: number;
    maxSlippage: number;
    maxConcurrentTrades: number;
  };
}

export const CredentialsValidator: React.FC = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const getStatusIcon = (status: CredentialStatus['status']) => {
    switch (status) {
      case 'valid':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'missing':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: CredentialStatus['status']) => {
    const variants = {
      valid: 'default',
      invalid: 'destructive',
      error: 'secondary',
      missing: 'outline'
    } as const;

    const labels = {
      valid: 'Válida',
      invalid: 'Inválida',
      error: 'Erro',
      missing: 'Não Configurada'
    };

    return (
      <Badge variant={variants[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const validateCredentials = async () => {
    setIsValidating(true);
    try {
      // Obter credenciais do localStorage (mesma fonte que APIConfiguration usa)
      const binanceCredentials = JSON.parse(localStorage.getItem('binance_credentials') || '{}');
      const binanceApiKey = binanceCredentials.apiKey;
      const binanceSecretKey = binanceCredentials.secretKey;

      const { data, error } = await supabase.functions.invoke('credentials-validator', {
        body: {
          binanceApiKey,
          binanceSecretKey
        }
      });
      
      if (error) {
        throw new Error(error.message);
      }

      setValidationResult(data);
      
      if (data.success) {
        toast.success('Validação concluída!', {
          description: data.summary
        });
      } else {
        toast.error('Problemas encontrados', {
          description: data.summary
        });
      }
    } catch (error) {
      console.error('Erro na validação:', error);
      toast.error('Erro na validação', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl font-semibold">Validador de Credenciais</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Teste e valide suas credenciais das exchanges
          </p>
        </div>
        <Button
          onClick={validateCredentials}
          disabled={isValidating}
          className="min-w-[120px]"
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            'Validar Credenciais'
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {validationResult && (
          <>
            {/* Resumo */}
            <Alert className={validationResult.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertTitle className="flex items-center gap-2">
                {validationResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                Status das Credenciais
              </AlertTitle>
              <AlertDescription className="mt-2">
                {validationResult.summary}
              </AlertDescription>
            </Alert>

            {/* Configurações Atuais de Trading */}
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertTitle>Configurações de Trading Ativas</AlertTitle>
              <AlertDescription className="mt-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Tamanho Máximo:</span><br />
                    <span className="text-blue-700">
                      ${JSON.parse(localStorage.getItem('trading_config') || '{}').maxTradeSize || 500}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Limite Diário:</span><br />
                    <span className="text-blue-700">
                      ${JSON.parse(localStorage.getItem('trading_config') || '{}').dailyLimit || 1000}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Slippage Máximo:</span><br />
                    <span className="text-blue-700">
                      {JSON.parse(localStorage.getItem('trading_config') || '{}').maxSlippage || 0.5}%
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Trades Simultâneos:</span><br />
                    <span className="text-blue-700">
                      {JSON.parse(localStorage.getItem('trading_config') || '{}').maxConcurrentTrades || 3}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-blue-600">
                  💡 Para alterar estes valores, use a aba "Trading" na página "Configuração de API"
                </p>
              </AlertDescription>
            </Alert>

            {/* Status detalhado por exchange */}
            <div className="grid gap-4 md:grid-cols-3">
              {validationResult.credentials.map((cred) => (
                <Card key={cred.exchange} className="border-l-4 border-l-primary/20">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getStatusIcon(cred.status)}
                        {cred.exchange}
                      </CardTitle>
                      {getStatusBadge(cred.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3">
                      {cred.message}
                    </p>
                    
                    {cred.details && (
                      <div className="bg-muted/50 p-3 rounded-md mb-3">
                        <p className="text-xs font-medium mb-1">Detalhes:</p>
                        <pre className="text-xs text-muted-foreground overflow-x-auto">
                          {JSON.stringify(cred.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {cred.suggestions && cred.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Sugestões:</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {cred.suggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start gap-1">
                              <span className="text-primary">•</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Problemas críticos */}
            {validationResult.critical_issues.length > 0 && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Problemas Críticos Encontrados</AlertTitle>
                <AlertDescription className="mt-2">
                  <ul className="list-disc list-inside space-y-1">
                    {validationResult.critical_issues.map((issue, index) => (
                      <li key={index} className="text-sm">{issue}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Próximos passos */}
            {validationResult.next_steps.length > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Próximos Passos Recomendados</AlertTitle>
                <AlertDescription className="mt-2">
                  <ol className="list-decimal list-inside space-y-1">
                    {validationResult.next_steps.slice(0, 5).map((step, index) => (
                      <li key={index} className="text-sm">{step}</li>
                    ))}
                  </ol>
                  {validationResult.next_steps.length > 5 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      +{validationResult.next_steps.length - 5} mais passos...
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </>
        )}

        {/* Informações iniciais */}
        {!validationResult && !isValidating && (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-2">Teste suas credenciais</p>
            <p className="text-sm">
              Clique em "Validar Credenciais" para verificar se suas APIs da Binance, Hyperliquid e OKX estão configuradas corretamente.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};