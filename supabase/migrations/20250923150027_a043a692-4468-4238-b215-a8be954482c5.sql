-- Criar tabela para configurações de automação cross-exchange
CREATE TABLE public.auto_cross_exchange_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  min_spread_percentage NUMERIC NOT NULL DEFAULT 0.5,
  max_investment_amount NUMERIC NOT NULL DEFAULT 1000,
  min_profit_threshold NUMERIC NOT NULL DEFAULT 1.0,
  symbols_filter TEXT[] NOT NULL DEFAULT ARRAY['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
  exchanges_enabled TEXT[] NOT NULL DEFAULT ARRAY['binance', 'pionex'],
  max_concurrent_operations INTEGER NOT NULL DEFAULT 2,
  auto_rebalance_enabled BOOLEAN NOT NULL DEFAULT true,
  risk_management_level TEXT NOT NULL DEFAULT 'medium',
  stop_loss_percentage NUMERIC DEFAULT 2.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para histórico de execuções cross-exchange
CREATE TABLE public.auto_cross_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.auto_cross_exchange_configs(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  buy_exchange TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  buy_price NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  amount NUMERIC NOT NULL,
  spread_percentage NUMERIC NOT NULL,
  estimated_profit NUMERIC NOT NULL,
  actual_profit NUMERIC,
  total_fees NUMERIC NOT NULL DEFAULT 0,
  withdrawal_fee NUMERIC DEFAULT 0,
  deposit_fee NUMERIC DEFAULT 0,
  trading_fee_buy NUMERIC DEFAULT 0,
  trading_fee_sell NUMERIC DEFAULT 0,
  execution_time_ms INTEGER,
  execution_status TEXT NOT NULL DEFAULT 'pending',
  execution_results JSONB,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Criar tabela para custos de transação detalhados por exchange
CREATE TABLE public.exchange_transaction_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange TEXT NOT NULL,
  symbol TEXT NOT NULL,
  network TEXT,
  withdrawal_fee_fixed NUMERIC DEFAULT 0,
  withdrawal_fee_percentage NUMERIC DEFAULT 0,
  deposit_fee_fixed NUMERIC DEFAULT 0,
  deposit_fee_percentage NUMERIC DEFAULT 0,
  trading_fee_maker NUMERIC DEFAULT 0.001,
  trading_fee_taker NUMERIC DEFAULT 0.001,
  minimum_withdrawal NUMERIC DEFAULT 0,
  processing_time_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(exchange, symbol, network)
);

-- Criar tabela para tracking de estratégia híbrida
CREATE TABLE public.hybrid_strategy_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  funding_operations INTEGER DEFAULT 0,
  cross_exchange_operations INTEGER DEFAULT 0,
  funding_profit NUMERIC DEFAULT 0,
  cross_exchange_profit NUMERIC DEFAULT 0,
  total_profit NUMERIC DEFAULT 0,
  total_fees NUMERIC DEFAULT 0,
  net_profit NUMERIC DEFAULT 0,
  roi_percentage NUMERIC DEFAULT 0,
  active_hours INTEGER DEFAULT 0,
  missed_opportunities INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Habilitar RLS
ALTER TABLE public.auto_cross_exchange_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_cross_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_transaction_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hybrid_strategy_tracking ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para auto_cross_exchange_configs
CREATE POLICY "Users can manage their own cross-exchange configs"
ON public.auto_cross_exchange_configs FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para auto_cross_executions
CREATE POLICY "Users can view their own cross-exchange executions"
ON public.auto_cross_executions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.auto_cross_exchange_configs
  WHERE id = config_id AND user_id = auth.uid()
));

CREATE POLICY "Service role can manage cross-exchange executions"
ON public.auto_cross_executions FOR ALL
USING (current_setting('role') = 'service_role');

-- Políticas RLS para exchange_transaction_costs
CREATE POLICY "Transaction costs are viewable by everyone"
ON public.exchange_transaction_costs FOR SELECT
USING (true);

CREATE POLICY "Service role can manage transaction costs"
ON public.exchange_transaction_costs FOR ALL
USING (current_setting('role') = 'service_role');

-- Políticas RLS para hybrid_strategy_tracking
CREATE POLICY "Users can view their own strategy tracking"
ON public.hybrid_strategy_tracking FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage strategy tracking"
ON public.hybrid_strategy_tracking FOR ALL
USING (current_setting('role') = 'service_role');

-- Inserir custos de transação iniciais (dados realísticos)
INSERT INTO public.exchange_transaction_costs (exchange, symbol, network, withdrawal_fee_fixed, deposit_fee_fixed, trading_fee_maker, trading_fee_taker, minimum_withdrawal, processing_time_minutes) VALUES
-- Binance
('binance', 'BTCUSDT', 'BTC', 0.0005, 0, 0.001, 0.001, 0.001, 30),
('binance', 'ETHUSDT', 'ETH', 0.005, 0, 0.001, 0.001, 0.01, 15),
('binance', 'BNBUSDT', 'BNB', 0.005, 0, 0.001, 0.001, 0.01, 15),
('binance', 'ADAUSDT', 'ADA', 1.0, 0, 0.001, 0.001, 1.0, 20),
('binance', 'SOLUSDT', 'SOL', 0.01, 0, 0.001, 0.001, 0.01, 20),
('binance', 'XRPUSDT', 'XRP', 0.25, 0, 0.001, 0.001, 0.25, 10),
('binance', 'DOTUSDT', 'DOT', 0.1, 0, 0.001, 0.001, 0.1, 25),
('binance', 'MATICUSDT', 'MATIC', 0.1, 0, 0.001, 0.001, 0.1, 15),

-- Pionex
('pionex', 'BTCUSDT', 'BTC', 0.0008, 0, 0.0005, 0.0005, 0.001, 45),
('pionex', 'ETHUSDT', 'ETH', 0.008, 0, 0.0005, 0.0005, 0.01, 25),
('pionex', 'BNBUSDT', 'BNB', 0.008, 0, 0.0005, 0.0005, 0.01, 25),
('pionex', 'ADAUSDT', 'ADA', 1.5, 0, 0.0005, 0.0005, 1.0, 30),
('pionex', 'SOLUSDT', 'SOL', 0.02, 0, 0.0005, 0.0005, 0.01, 30),
('pionex', 'XRPUSDT', 'XRP', 0.5, 0, 0.0005, 0.0005, 0.25, 20),
('pionex', 'DOTUSDT', 'DOT', 0.2, 0, 0.0005, 0.0005, 0.1, 35),
('pionex', 'MATICUSDT', 'MATIC', 0.2, 0, 0.0005, 0.0005, 0.1, 25);

-- Configurar cron job para automação cross-exchange (executa a cada 15 minutos, exceto nos horários de funding)
SELECT cron.schedule(
  'auto-cross-exchange-arbitrage',
  '*/15 * * * *', -- A cada 15 minutos
  $$
  SELECT
    net.http_post(
      url:='https://uxhcsjlfwkhwkvhfacho.supabase.co/functions/v1/auto-cross-exchange-arbitrage',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aGNzamxmd2tod2t2aGZhY2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0MDEzMzQsImV4cCI6MjA2Njk3NzMzNH0.WLA9LhdQHPZJpTC1qasafl3Gb7IqRvXN61XVcKnzx0U"}'::jsonb,
      body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);