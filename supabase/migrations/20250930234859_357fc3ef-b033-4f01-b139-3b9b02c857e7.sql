-- Corrigir função check_and_lock_balance_for_arbitrage (sem LIMIT no UPDATE)
DROP FUNCTION IF EXISTS public.check_and_lock_balance_for_arbitrage(uuid, text, numeric, text, text, numeric);

CREATE OR REPLACE FUNCTION public.check_and_lock_balance_for_arbitrage(
  p_user_id uuid,
  p_symbol text,
  p_amount numeric,
  p_buy_exchange text,
  p_sell_exchange text,
  p_current_price numeric DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  usdt_balance NUMERIC := 0;
  usdt_locked NUMERIC := 0;
  required_usdt_total NUMERIC;
  available_usdt NUMERIC;
  portfolio_id UUID;
BEGIN
  -- Calcular USDT necessário total
  required_usdt_total := p_amount * p_current_price * 2;
  
  -- Buscar saldo total de USDT do usuário (todas as exchanges)
  SELECT 
    COALESCE(SUM(balance), 0), 
    COALESCE(SUM(locked_balance), 0)
  INTO usdt_balance, usdt_locked
  FROM public.portfolios
  WHERE user_id = p_user_id AND symbol = 'USDT';
  
  available_usdt := usdt_balance - usdt_locked;
  
  -- Verificar se há USDT suficiente
  IF available_usdt < required_usdt_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo insuficiente de USDT',
      'required_usdt', required_usdt_total,
      'available_usdt', available_usdt
    );
  END IF;
  
  -- Buscar ou criar registro USDT GLOBAL
  SELECT id INTO portfolio_id
  FROM public.portfolios
  WHERE user_id = p_user_id 
    AND symbol = 'USDT'
    AND exchange = 'GLOBAL';
  
  IF portfolio_id IS NULL THEN
    -- Criar novo registro
    INSERT INTO public.portfolios (
      user_id, 
      symbol, 
      balance, 
      locked_balance, 
      exchange, 
      application_title
    )
    VALUES (
      p_user_id, 
      'USDT', 
      0, 
      required_usdt_total, 
      'GLOBAL', 
      'Arbitragem USDT'
    )
    RETURNING id INTO portfolio_id;
  ELSE
    -- Atualizar registro existente
    UPDATE public.portfolios 
    SET 
      locked_balance = locked_balance + required_usdt_total,
      updated_at = now()
    WHERE id = portfolio_id;
  END IF;
  
  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'locked_usdt', required_usdt_total,
    'available_usdt_after', available_usdt - required_usdt_total
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erro interno: ' || SQLERRM
    );
END;
$function$;