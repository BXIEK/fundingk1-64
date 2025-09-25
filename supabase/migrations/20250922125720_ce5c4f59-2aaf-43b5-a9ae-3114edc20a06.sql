-- Função para atualizar saldo do portfolio
CREATE OR REPLACE FUNCTION public.update_portfolio_balance(
  p_user_id UUID,
  p_symbol TEXT,
  p_amount_change NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir ou atualizar saldo
  INSERT INTO public.portfolios (user_id, symbol, balance)
  VALUES (p_user_id, p_symbol, p_amount_change)
  ON CONFLICT (user_id, symbol)
  DO UPDATE SET 
    balance = portfolios.balance + p_amount_change,
    updated_at = now();
END;
$$;