-- Tabela de portfolios dos usuários
CREATE TABLE public.portfolios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  locked_balance DECIMAL(20, 8) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, symbol)
);

-- Tabela de histórico de operações de arbitragem
CREATE TABLE public.arbitrage_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  buy_exchange TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  buy_price DECIMAL(20, 8) NOT NULL,
  sell_price DECIMAL(20, 8) NOT NULL,
  quantity DECIMAL(20, 8) NOT NULL,
  investment_amount DECIMAL(20, 8) NOT NULL,
  gross_profit DECIMAL(20, 8) NOT NULL,
  gas_fees DECIMAL(20, 8) NOT NULL,
  slippage_cost DECIMAL(20, 8) NOT NULL,
  net_profit DECIMAL(20, 8) NOT NULL,
  roi_percentage DECIMAL(10, 4) NOT NULL,
  spread_percentage DECIMAL(10, 4) NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed, failed, cancelled
  pionex_order_id TEXT,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arbitrage_trades ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para portfolios
CREATE POLICY "Users can view their own portfolios" 
ON public.portfolios 
FOR SELECT 
USING (true); -- Por enquanto público para desenvolvimento

CREATE POLICY "Users can insert their own portfolios" 
ON public.portfolios 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own portfolios" 
ON public.portfolios 
FOR UPDATE 
USING (true);

-- Políticas RLS para arbitrage_trades
CREATE POLICY "Users can view their own trades" 
ON public.arbitrage_trades 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert their own trades" 
ON public.arbitrage_trades 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update their own trades" 
ON public.arbitrage_trades 
FOR UPDATE 
USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_portfolios_updated_at
BEFORE UPDATE ON public.portfolios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir saldos iniciais de demonstração
INSERT INTO public.portfolios (user_id, symbol, balance) VALUES
('00000000-0000-0000-0000-000000000000', 'USDT', 10000.00),
('00000000-0000-0000-0000-000000000000', 'BTC', 0.1),
('00000000-0000-0000-0000-000000000000', 'ETH', 2.5),
('00000000-0000-0000-0000-000000000000', 'BNB', 10.0),
('00000000-0000-0000-0000-000000000000', 'SOL', 25.0);