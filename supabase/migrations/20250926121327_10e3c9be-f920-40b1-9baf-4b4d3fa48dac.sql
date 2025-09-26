-- Corrigir a função check_and_lock_balance_for_arbitrage para evitar erros de constraint duplicate

CREATE OR REPLACE FUNCTION public.check_and_lock_balance_for_arbitrage(p_user_id uuid, p_symbol text, p_amount numeric, p_buy_exchange text, p_sell_exchange text, p_current_price numeric DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  usdt_balance NUMERIC := 0;
  crypto_balance NUMERIC := 0;
  required_usdt NUMERIC;
  required_crypto NUMERIC;
  usdt_locked NUMERIC := 0;
  crypto_locked NUMERIC := 0;
BEGIN
  -- Calcular valores necessários baseados no preço atual
  required_usdt := p_amount * p_current_price; -- Quantidade USDT necessária para comprar
  required_crypto := p_amount; -- Quantidade da crypto necessária para vender
  
  -- Buscar saldos atuais de USDT
  SELECT 
    COALESCE(SUM(balance), 0), 
    COALESCE(SUM(locked_balance), 0)
  INTO usdt_balance, usdt_locked
  FROM public.portfolios
  WHERE user_id = p_user_id AND symbol = 'USDT';
  
  -- Buscar saldos atuais da crypto
  SELECT 
    COALESCE(SUM(balance), 0), 
    COALESCE(SUM(locked_balance), 0)
  INTO crypto_balance, crypto_locked
  FROM public.portfolios
  WHERE user_id = p_user_id AND symbol = p_symbol;
  
  -- Verificar se há saldo suficiente disponível para USDT
  IF (usdt_balance - usdt_locked) < required_usdt THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo insuficiente de USDT para executar a operação',
      'required_usdt', required_usdt,
      'available_usdt', (usdt_balance - usdt_locked),
      'required_crypto', required_crypto,
      'available_crypto', (crypto_balance - crypto_locked),
      'details', jsonb_build_object(
        'operation_type', 'buy',
        'amount', p_amount,
        'price', p_current_price
      )
    );
  END IF;
  
  -- Verificar se há saldo suficiente disponível para crypto
  IF (crypto_balance - crypto_locked) < required_crypto THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo insuficiente de ' || p_symbol || ' para executar a operação',
      'required_usdt', required_usdt,
      'available_usdt', (usdt_balance - usdt_locked),
      'required_crypto', required_crypto,
      'available_crypto', (crypto_balance - crypto_locked),
      'details', jsonb_build_object(
        'operation_type', 'sell',
        'amount', p_amount,
        'symbol', p_symbol
      )
    );
  END IF;
  
  -- Bloquear saldos necessários
  -- Bloquear USDT para compra (UPSERT seguro)
  INSERT INTO public.portfolios (user_id, symbol, balance, locked_balance, exchange, application_title)
  VALUES (p_user_id, 'USDT', 0, required_usdt, NULL, 'Arbitragem - Bloqueio Temporário')
  ON CONFLICT (user_id, symbol) 
  DO UPDATE SET 
    locked_balance = portfolios.locked_balance + required_usdt,
    updated_at = now();
  
  -- Bloquear crypto para venda (UPSERT seguro)
  INSERT INTO public.portfolios (user_id, symbol, balance, locked_balance, exchange, application_title)
  VALUES (p_user_id, p_symbol, 0, required_crypto, NULL, 'Arbitragem - Bloqueio Temporário')
  ON CONFLICT (user_id, symbol) 
  DO UPDATE SET 
    locked_balance = portfolios.locked_balance + required_crypto,
    updated_at = now();
  
  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'locked_usdt', required_usdt,
    'locked_crypto', required_crypto,
    'available_usdt_after', (usdt_balance - usdt_locked - required_usdt),
    'available_crypto_after', (crypto_balance - crypto_locked - required_crypto),
    'operation_details', jsonb_build_object(
      'amount', p_amount,
      'price', p_current_price,
      'buy_exchange', p_buy_exchange,
      'sell_exchange', p_sell_exchange,
      'timestamp', now()
    )
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Erro interno ao verificar saldos: ' || SQLERRM
    );
END;
$function$;