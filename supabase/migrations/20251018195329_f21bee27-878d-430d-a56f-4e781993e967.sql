-- Tabela para registrar transferências blockchain
CREATE TABLE IF NOT EXISTS public.blockchain_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  token TEXT NOT NULL,
  network TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  tx_hash TEXT,
  block_number INTEGER,
  gas_used TEXT,
  n8n_execution_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela para gerenciar webhooks n8n
CREATE TABLE IF NOT EXISTS public.n8n_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  webhook_url TEXT NOT NULL,
  webhook_type TEXT NOT NULL CHECK (webhook_type IN ('arbitrage', 'transfer', 'monitoring')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, webhook_type)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_blockchain_transfers_user_id ON public.blockchain_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_transfers_status ON public.blockchain_transfers(status);
CREATE INDEX IF NOT EXISTS idx_blockchain_transfers_tx_hash ON public.blockchain_transfers(tx_hash);
CREATE INDEX IF NOT EXISTS idx_n8n_webhooks_user_id ON public.n8n_webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_n8n_webhooks_active ON public.n8n_webhooks(is_active);

-- RLS Policies para blockchain_transfers
ALTER TABLE public.blockchain_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blockchain transfers"
  ON public.blockchain_transfers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blockchain transfers"
  ON public.blockchain_transfers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all blockchain transfers"
  ON public.blockchain_transfers FOR ALL
  USING (current_setting('role') = 'service_role');

-- RLS Policies para n8n_webhooks
ALTER TABLE public.n8n_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own n8n webhooks"
  ON public.n8n_webhooks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all n8n webhooks"
  ON public.n8n_webhooks FOR ALL
  USING (current_setting('role') = 'service_role');