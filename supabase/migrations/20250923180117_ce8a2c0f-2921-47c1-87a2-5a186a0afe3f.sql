-- Criar tabela para registrar operações de arbitragem spot-futures
CREATE TABLE IF NOT EXISTS public.arbitrage_operations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  operation_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  from_token TEXT,
  to_token TEXT,
  spot_price NUMERIC,
  futures_price NUMERIC,
  spread_percent NUMERIC,
  total_costs_percent NUMERIC,
  expected_profit_usd NUMERIC,
  actual_profit_usd NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  conversion_performed BOOLEAN DEFAULT false,
  conversion_amount NUMERIC DEFAULT 0,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.arbitrage_operations ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can view their own arbitrage operations" 
ON public.arbitrage_operations 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create their own arbitrage operations" 
ON public.arbitrage_operations 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own arbitrage operations" 
ON public.arbitrage_operations 
FOR UPDATE 
USING (auth.uid()::text = user_id::text);

-- Criar trigger para updated_at
CREATE TRIGGER update_arbitrage_operations_updated_at
BEFORE UPDATE ON public.arbitrage_operations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para performance
CREATE INDEX idx_arbitrage_operations_user_id ON public.arbitrage_operations(user_id);
CREATE INDEX idx_arbitrage_operations_created_at ON public.arbitrage_operations(created_at);
CREATE INDEX idx_arbitrage_operations_status ON public.arbitrage_operations(status);
CREATE INDEX idx_arbitrage_operations_operation_type ON public.arbitrage_operations(operation_type);