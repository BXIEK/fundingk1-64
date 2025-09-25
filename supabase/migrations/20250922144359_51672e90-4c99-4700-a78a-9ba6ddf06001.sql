-- Adicionar coluna exchange à tabela portfolios para identificar a origem dos saldos
ALTER TABLE public.portfolios 
ADD COLUMN IF NOT EXISTS exchange TEXT DEFAULT NULL;

-- Criar índice para otimizar consultas por exchange
CREATE INDEX IF NOT EXISTS idx_portfolios_exchange ON public.portfolios(exchange);

-- Comentário explicativo
COMMENT ON COLUMN public.portfolios.exchange IS 'Exchange de origem do saldo (Binance, Pionex, etc.)';