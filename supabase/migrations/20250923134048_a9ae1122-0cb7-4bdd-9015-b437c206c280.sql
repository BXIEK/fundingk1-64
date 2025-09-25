-- Adicionar tabela para configurações de proxy/VPN
CREATE TABLE IF NOT EXISTS public.exchange_proxy_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exchange TEXT NOT NULL,
  proxy_url TEXT,
  proxy_enabled BOOLEAN DEFAULT false,
  last_successful_connection TIMESTAMPTZ,
  connection_errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exchange_proxy_configs ENABLE ROW LEVEL SECURITY;

-- Service role can manage proxy configs
CREATE POLICY "Service role can manage proxy configs" 
ON public.exchange_proxy_configs 
FOR ALL 
USING (current_setting('role') = 'service_role');

-- Insert default config for Pionex
INSERT INTO public.exchange_proxy_configs (exchange, proxy_enabled)
VALUES ('pionex', true)
ON CONFLICT (exchange) DO NOTHING;