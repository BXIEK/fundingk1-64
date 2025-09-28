-- Atualizar função sync_real_balances para usar value_usd_calculated
CREATE OR REPLACE FUNCTION public.sync_real_balances(p_user_id uuid, p_exchange text, p_balances jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  balance_item jsonb;
BEGIN
  -- Limpar saldos antigos da exchange
  UPDATE public.portfolios 
  SET balance = 0, updated_at = now()
  WHERE user_id = p_user_id 
    AND exchange = p_exchange
    AND balance > 0;
  
  -- Inserir/atualizar novos saldos
  FOR balance_item IN SELECT * FROM jsonb_array_elements(p_balances)
  LOOP
    INSERT INTO public.portfolios (
      user_id, 
      symbol, 
      balance, 
      exchange, 
      price_usd, 
      value_usd,
      value_usd_calculated,
      application_title
    )
    VALUES (
      p_user_id,
      balance_item->>'symbol',
      (balance_item->>'balance')::numeric,
      p_exchange,
      COALESCE((balance_item->>'price_usd')::numeric, 0),
      COALESCE((balance_item->>'value_usd')::numeric, 0),
      (balance_item->>'balance')::numeric * COALESCE((balance_item->>'price_usd')::numeric, 0),
      'Real Balance - ' || p_exchange
    )
    ON CONFLICT (user_id, symbol, exchange)
    DO UPDATE SET
      balance = EXCLUDED.balance,
      price_usd = EXCLUDED.price_usd,
      value_usd = EXCLUDED.value_usd,
      value_usd_calculated = EXCLUDED.value_usd_calculated,
      updated_at = now(),
      application_title = EXCLUDED.application_title;
  END LOOP;
END;
$function$