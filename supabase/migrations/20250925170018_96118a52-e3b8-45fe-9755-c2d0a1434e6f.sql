-- Criar apenas tabela para configurações de balanceamento 
CREATE TABLE IF NOT EXISTS auto_balance_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  is_enabled boolean DEFAULT true,
  min_usdt_threshold numeric DEFAULT 50,
  min_crypto_threshold numeric DEFAULT 0.001,
  target_usdt_buffer numeric DEFAULT 200,
  target_crypto_buffer numeric DEFAULT 0.005,
  rebalance_frequency_hours integer DEFAULT 6,
  last_check_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS policy
ALTER TABLE auto_balance_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own balance configs" ON auto_balance_configs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);