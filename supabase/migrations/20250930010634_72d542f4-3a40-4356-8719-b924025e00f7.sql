-- Adicionar constraint única para portfolios
CREATE UNIQUE INDEX IF NOT EXISTS portfolios_user_symbol_exchange_unique 
ON public.portfolios (user_id, symbol, exchange);