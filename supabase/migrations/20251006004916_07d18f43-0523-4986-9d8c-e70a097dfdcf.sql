-- Tabela de configurações de rebalanceamento inteligente
CREATE TABLE IF NOT EXISTS public.smart_rebalance_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rebalance_frequency_hours INTEGER NOT NULL DEFAULT 24,
  target_allocations JSONB NOT NULL DEFAULT '{"USDT": 25, "BTC": 25, "ETH": 25, "SOL": 25}'::jsonb,
  max_deviation_percent NUMERIC NOT NULL DEFAULT 10,
  min_trade_value NUMERIC NOT NULL DEFAULT 10,
  last_rebalance_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.smart_rebalance_configs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own rebalance configs"
  ON public.smart_rebalance_configs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all rebalance configs"
  ON public.smart_rebalance_configs
  FOR ALL
  USING (current_setting('role') = 'service_role');

-- Índices
CREATE INDEX IF NOT EXISTS idx_smart_rebalance_user ON public.smart_rebalance_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_rebalance_enabled ON public.smart_rebalance_configs(is_enabled) WHERE is_enabled = true;