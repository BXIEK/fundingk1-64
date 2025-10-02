-- Criar tabela para rastrear transferências de crypto entre exchanges
CREATE TABLE IF NOT EXISTS public.crypto_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  from_exchange TEXT NOT NULL,
  to_exchange TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  network TEXT NOT NULL,
  withdrawal_id TEXT,
  deposit_address TEXT NOT NULL,
  deposit_memo TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  withdrawal_fee NUMERIC DEFAULT 0,
  tx_hash TEXT,
  estimated_arrival TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crypto_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own transfers"
  ON public.crypto_transfers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transfers"
  ON public.crypto_transfers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all transfers"
  ON public.crypto_transfers
  FOR ALL
  USING (current_setting('role'::text) = 'service_role');

-- Trigger para updated_at
CREATE TRIGGER update_crypto_transfers_updated_at
  BEFORE UPDATE ON public.crypto_transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();