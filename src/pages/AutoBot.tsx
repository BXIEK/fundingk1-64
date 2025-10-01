import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import AutoArbitrageBot from '@/components/AutoArbitrageBot';

export default function AutoBot() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/arbitrage-control')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Bot Automático de Arbitragem</h1>
          <p className="text-muted-foreground">
            Automação completa e contínua de arbitragem cross-exchange
          </p>
        </div>
      </div>

      <AutoArbitrageBot />
    </div>
  );
}
