-- Criar tabela para configurações de arbitragem automática cross-exchange
CREATE TABLE public.cross_exchange_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  min_spread_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.5,
  max_investment_per_trade NUMERIC(10,2) NOT NULL DEFAULT 100,
  daily_limit_usd NUMERIC(12,2) NOT NULL DEFAULT 1000,
  max_concurrent_operations INTEGER NOT NULL DEFAULT 3,
  trading_mode TEXT NOT NULL DEFAULT 'simulation' CHECK (trading_mode IN ('real', 'simulation')),
  target_exchanges JSONB NOT NULL DEFAULT '["Binance", "OKX"]',
  enabled_symbols JSONB NOT NULL DEFAULT '["BTC", "ETH", "SOL", "BNB", "ADA"]',
  risk_level TEXT NOT NULL DEFAULT 'moderate' CHECK (risk_level IN ('conservative', 'moderate', 'aggressive')),
  stop_loss_percentage NUMERIC(5,2) NOT NULL DEFAULT 2.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.cross_exchange_configs ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Usuários podem ver suas próprias configurações" 
ON public.cross_exchange_configs 
FOR SELECT 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Usuários podem criar suas próprias configurações" 
ON public.cross_exchange_configs 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Usuários podem atualizar suas próprias configurações" 
ON public.cross_exchange_configs 
FOR UPDATE 
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Usuários podem deletar suas próprias configurações" 
ON public.cross_exchange_configs 
FOR DELETE 
USING (auth.uid()::text = user_id::text);

-- Trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_cross_exchange_configs_updated_at
BEFORE UPDATE ON public.cross_exchange_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_cross_exchange_configs_user_id ON public.cross_exchange_configs(user_id);
CREATE INDEX idx_cross_exchange_configs_is_enabled ON public.cross_exchange_configs(is_enabled) WHERE is_enabled = true;