-- Adicionar coluna value_usd_calculated para armazenar o valor real em USD
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS value_usd_calculated NUMERIC DEFAULT 0;