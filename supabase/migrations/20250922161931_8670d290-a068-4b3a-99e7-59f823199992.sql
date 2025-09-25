-- Função para verificar e bloquear saldo para operação de arbitragem
CREATE OR REPLACE FUNCTION public.check_and_lock_balance_for_arbitrage(
  p_user_id UUID,
  p_symbol TEXT,
  p_amount NUMERIC,
  p_buy_exchange TEXT,
  p_sell_exchange TEXT,
  p_current_price NUMERIC DEFAULT 100
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  -- Bloquear USDT para compra
  INSERT INTO public.portfolios (user_id, symbol, balance, locked_balance, exchange, application_title)
  VALUES (p_user_id, 'USDT', 0, required_usdt, p_buy_exchange, 'Arbitragem - Bloqueio Temporário')
  ON CONFLICT (user_id, symbol) WHERE exchange IS NULL OR exchange = p_buy_exchange
  DO UPDATE SET 
    locked_balance = portfolios.locked_balance + required_usdt,
    updated_at = now();
  
  -- Se não deu conflito, tentar inserir/atualizar sem exchange
  UPDATE public.portfolios
  SET 
    locked_balance = locked_balance + required_usdt,
    updated_at = now()
  WHERE user_id = p_user_id 
    AND symbol = 'USDT' 
    AND NOT EXISTS (
      SELECT 1 FROM public.portfolios p2 
      WHERE p2.user_id = p_user_id 
        AND p2.symbol = 'USDT' 
        AND p2.exchange = p_buy_exchange
    );
  
  -- Bloquear crypto para venda
  INSERT INTO public.portfolios (user_id, symbol, balance, locked_balance, exchange, application_title)
  VALUES (p_user_id, p_symbol, 0, required_crypto, p_sell_exchange, 'Arbitragem - Bloqueio Temporário')
  ON CONFLICT (user_id, symbol) WHERE exchange IS NULL OR exchange = p_sell_exchange
  DO UPDATE SET 
    locked_balance = portfolios.locked_balance + required_crypto,
    updated_at = now();
  
  -- Se não deu conflito, tentar inserir/atualizar sem exchange
  UPDATE public.portfolios
  SET 
    locked_balance = locked_balance + required_crypto,
    updated_at = now()
  WHERE user_id = p_user_id 
    AND symbol = p_symbol 
    AND NOT EXISTS (
      SELECT 1 FROM public.portfolios p2 
      WHERE p2.user_id = p_user_id 
        AND p2.symbol = p_symbol 
        AND p2.exchange = p_sell_exchange
    );
  
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
$$;

-- Função para desbloquear saldo após operação
CREATE OR REPLACE FUNCTION public.unlock_balance_after_arbitrage(
  p_user_id UUID,
  p_symbol TEXT,
  p_amount NUMERIC,
  p_buy_exchange TEXT,
  p_sell_exchange TEXT,
  p_current_price NUMERIC DEFAULT 100,
  p_success BOOLEAN DEFAULT true
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  required_usdt NUMERIC;
  required_crypto NUMERIC;
BEGIN
  -- Calcular valores que foram bloqueados
  required_usdt := p_amount * p_current_price;
  required_crypto := p_amount;
  
  -- Desbloquear USDT
  UPDATE public.portfolios
  SET 
    locked_balance = GREATEST(0, locked_balance - required_usdt),
    updated_at = now()
  WHERE user_id = p_user_id 
    AND symbol = 'USDT';
  
  -- Desbloquear crypto
  UPDATE public.portfolios
  SET 
    locked_balance = GREATEST(0, locked_balance - required_crypto),
    updated_at = now()
  WHERE user_id = p_user_id 
    AND symbol = p_symbol;
    
END;
$$;