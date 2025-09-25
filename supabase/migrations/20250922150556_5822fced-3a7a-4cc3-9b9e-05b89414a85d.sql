-- Adicionar colunas de preço e valor USD à tabela portfolios
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS price_usd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS value_usd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS application_title TEXT,
ADD COLUMN IF NOT EXISTS investment_type TEXT;