-- Ajustar unicidade da tabela portfolios para suportar por exchange
ALTER TABLE public.portfolios DROP CONSTRAINT IF EXISTS portfolios_user_id_symbol_key;

DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_class c 
  JOIN pg_namespace n ON n.oid = c.relnamespace 
  WHERE c.relname = 'portfolios_user_symbol_exchange_unique' 
    AND n.nspname = 'public'
) THEN
  CREATE UNIQUE INDEX portfolios_user_symbol_exchange_unique 
  ON public.portfolios (user_id, symbol, exchange);
END IF;
END $$;

DO $$ BEGIN
IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname = 'portfolios_user_symbol_exchange_key'
) THEN
  ALTER TABLE public.portfolios 
  ADD CONSTRAINT portfolios_user_symbol_exchange_key 
  UNIQUE USING INDEX portfolios_user_symbol_exchange_unique;
END IF;
END $$;

-- Atualizar função para incluir exchange e usar a nova chave única
CREATE OR REPLACE FUNCTION public.update_portfolio_balance(
  p_user_id uuid, 
  p_symbol text, 
  p_amount_change numeric,
  p_exchange text DEFAULT 'GLOBAL'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.portfolios (user_id, symbol, exchange, balance)
  VALUES (p_user_id, p_symbol, COALESCE(p_exchange, 'GLOBAL'), p_amount_change)
  ON CONFLICT (user_id, symbol, exchange)
  DO UPDATE SET 
    balance = public.portfolios.balance + p_amount_change,
    updated_at = now();
END;
$function$;