-- Adicionar coluna daily_volume na tabela auto_arbitrage_configs
ALTER TABLE public.auto_arbitrage_configs 
ADD COLUMN IF NOT EXISTS daily_volume NUMERIC NOT NULL DEFAULT 0;