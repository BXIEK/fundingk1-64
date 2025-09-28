-- Modificar função check_and_lock_balance_for_arbitrage para usar apenas USDT
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
BEGIN
  -- NOVA LÓGICA: Usar apenas USDT para todas as operações
  -- Calcular USDT necessário total (para compra E venda via conversão)
  required_usdt_total := p_amount * p_current_price * 2; -- 2x para garantir liquidez em ambas as operações
  
  -- Buscar saldo total de USDT do usuário (todas as exchanges)
  SELECT 
    COALESCE(SUM(balance), 0), 
    COALESCE(SUM(locked_balance), 0)
  INTO usdt_balance, usdt_locked
  FROM public.portfolios
  WHERE user_id = p_user_id AND symbol = 'USDT';
  
  available_usdt := usdt_balance - usdt_locked;
  
  -- Verificar se há USDT suficiente para operação completa
  IF available_usdt < required_usdt_total THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo insuficiente de USDT para executar a operação completa',
      'required_usdt', required_usdt_total,
      'available_usdt', available_usdt,
      'operation_type', 'usdt_only_arbitrage',
      'details', jsonb_build_object(
        'symbol', p_symbol,
        'amount', p_amount,
        'price', p_current_price,
        'usdt_needed_total', required_usdt_total,
        'explanation', 'Sistema agora opera exclusivamente com USDT'
      )
    );
  END IF;
  
  -- Bloquear USDT necessário para operação
  INSERT INTO public.portfolios (user_id, symbol, balance, locked_balance, exchange, application_title)
  VALUES (p_user_id, 'USDT', 0, required_usdt_total, NULL, 'Arbitragem USDT - Bloqueio Temporário')
  ON CONFLICT (user_id, symbol) 
  DO UPDATE SET 
    locked_balance = portfolios.locked_balance + required_usdt_total,
    updated_at = now();
  
  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'locked_usdt', required_usdt_total,
    'available_usdt_after', available_usdt - required_usdt_total,
    'operation_details', jsonb_build_object(
      'symbol', p_symbol,
      'amount', p_amount,
      'price', p_current_price,
      'buy_exchange', p_buy_exchange,
      'sell_exchange', p_sell_exchange,
      'operation_mode', 'usdt_only',
      'timestamp', now()
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erro interno ao verificar saldos USDT: ' || SQLERRM
    );
END;
$function$;

-- Criar função auxiliar para desbloquear saldos USDT
CREATE OR REPLACE FUNCTION public.unlock_usdt_balance_after_arbitrage(
  p_user_id uuid, 
  p_amount_to_unlock numeric,
  p_success boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Desbloquear USDT
  UPDATE public.portfolios
  SET 
    locked_balance = GREATEST(0, locked_balance - p_amount_to_unlock),
    updated_at = now()
  WHERE user_id = p_user_id 
    AND symbol = 'USDT';
    
  -- Log da operação
  INSERT INTO public.portfolios (user_id, symbol, balance, exchange, application_title)
  VALUES (p_user_id, 'UNLOCK_LOG', p_amount_to_unlock, NULL, 
          CASE WHEN p_success THEN 'Arbitragem Completa - USDT Desbloqueado' 
               ELSE 'Arbitragem Falhou - USDT Desbloqueado' END)
  ON CONFLICT (user_id, symbol) DO NOTHING;
END;
$function$;