import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExchangeStatusBannerProps {
  binanceOk: boolean;
  okxOk: boolean;
  bybitOk: boolean;
  onConfigClick: () => void;
}

export const ExchangeStatusBanner = ({ binanceOk, okxOk, bybitOk, onConfigClick }: ExchangeStatusBannerProps) => {
  const allOk = binanceOk && okxOk && bybitOk;
  const someOk = binanceOk || okxOk || bybitOk;
  const noneOk = !binanceOk && !okxOk && !bybitOk;

  if (allOk) {
    return (
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <AlertDescription>
          <strong className="text-green-700 dark:text-green-300">✅ Todas as exchanges conectadas!</strong>
          <p className="text-sm mt-1">Binance, OKX e Bybit estão funcionando corretamente.</p>
        </AlertDescription>
      </Alert>
    );
  }

  if (noneOk) {
    return (
      <Alert variant="destructive">
        <XCircle className="h-5 w-5" />
        <AlertDescription>
          <strong>❌ Nenhuma exchange conectada</strong>
          <p className="text-sm mt-1">
            Todas as conexões falharam. Verifique suas credenciais na aba "Status APIs".
          </p>
          <Button size="sm" variant="outline" className="mt-2" onClick={onConfigClick}>
            Verificar Status
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // Partial connection
  return (
    <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
      <AlertTriangle className="h-5 w-5 text-yellow-600" />
      <AlertDescription>
        <strong className="text-yellow-700 dark:text-yellow-300">⚠️ Conexão parcial</strong>
        <div className="text-sm mt-2 space-y-1">
          <p>
            <span className={binanceOk ? 'text-green-600' : 'text-red-600'}>
              {binanceOk ? '✅' : '❌'} Binance
            </span>
            {' | '}
            <span className={okxOk ? 'text-green-600' : 'text-red-600'}>
              {okxOk ? '✅' : '❌'} OKX
            </span>
            {' | '}
            <span className={bybitOk ? 'text-green-600' : 'text-red-600'}>
              {bybitOk ? '✅' : '❌'} Bybit
            </span>
          </p>
        </div>
        <Button size="sm" variant="outline" className="mt-2" onClick={onConfigClick}>
          Ver Detalhes
        </Button>
      </AlertDescription>
    </Alert>
  );
};
