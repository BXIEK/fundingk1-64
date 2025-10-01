-- Tabela de configurações do bot automático
CREATE TABLE IF NOT EXISTS public.auto_arbitrage_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  min_spread NUMERIC NOT NULL DEFAULT 0.8,
  max_investment_per_trade NUMERIC NOT NULL DEFAULT 100,
  min_profit_threshold NUMERIC NOT NULL DEFAULT 0.5,
  stop_loss_percentage NUMERIC NOT NULL DEFAULT 2.0,
  daily_limit NUMERIC NOT NULL DEFAULT 5000,
  check_interval_seconds INTEGER NOT NULL DEFAULT 30,
  reinvest_profits BOOLEAN NOT NULL DEFAULT true,
  compounding_enabled BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE,
  stopped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela de estado do bot
CREATE TABLE IF NOT EXISTS public.auto_arbitrage_states (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_profit NUMERIC NOT NULL DEFAULT 0,
  trades_executed INTEGER NOT NULL DEFAULT 0,
  daily_volume NUMERIC NOT NULL DEFAULT 0,
  last_execution_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'stopped',
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Tabela de logs de execução
CREATE TABLE IF NOT EXISTS public.bot_execution_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  opportunity_id UUID,
  symbol TEXT NOT NULL,
  investment NUMERIC NOT NULL,
  net_profit NUMERIC NOT NULL,
  spread NUMERIC NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_arbitrage_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auto_arbitrage_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_execution_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage their own bot configs"
  ON public.auto_arbitrage_configs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own bot state"
  ON public.auto_arbitrage_states
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own bot logs"
  ON public.bot_execution_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role policies
CREATE POLICY "Service role can manage bot configs"
  ON public.auto_arbitrage_configs
  FOR ALL
  USING (current_setting('role'::text) = 'service_role');

CREATE POLICY "Service role can manage bot states"
  ON public.auto_arbitrage_states
  FOR ALL
  USING (current_setting('role'::text) = 'service_role');

CREATE POLICY "Service role can manage bot logs"
  ON public.bot_execution_logs
  FOR ALL
  USING (current_setting('role'::text) = 'service_role');

-- Indexes
CREATE INDEX idx_auto_arbitrage_configs_user_id ON public.auto_arbitrage_configs(user_id);
CREATE INDEX idx_auto_arbitrage_states_user_id ON public.auto_arbitrage_states(user_id);
CREATE INDEX idx_bot_execution_logs_user_id ON public.bot_execution_logs(user_id);
CREATE INDEX idx_bot_execution_logs_executed_at ON public.bot_execution_logs(executed_at DESC);