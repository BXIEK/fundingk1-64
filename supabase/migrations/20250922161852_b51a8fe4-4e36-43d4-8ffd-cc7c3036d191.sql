-- Função para verificar e bloquear saldo para operação de arbitragem
CREATE OR REPLACE FUNCTION public.check_and_lock_balance_for_arbitrage(
  p_user_id UUID,
  p_symbol TEXT,
  p_amount NUMERIC,
  p_buy_exchange TEXT,
  p_sell_exchange TEXT
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
  result JSONB;
BEGIN
  -- Calcular valores necessários (assumindo preço médio de $100 para simplificar)
  required_usdt := p_amount * 100; -- Quantidade USDT necessária para comprar
  required_crypto := p_amount; -- Quantidade da crypto necessária para vender
  
  -- Buscar saldos atuais de USDT
  SELECT COALESCE(balance, 0), COALESCE(locked_balance, 0)
  INTO usdt_balance, usdt_locked
  FROM public.portfolios
  WHERE user_id = p_user_id AND symbol = 'USDT' AND (exchange IS NULL OR exchange = p_buy_exchange);
  
  -- Buscar saldos atuais da crypto
  SELECT COALESCE(balance, 0), COALESCE(locked_balance, 0)
  INTO crypto_balance, crypto_locked
  FROM public.portfolios
  WHERE user_id = p_user_id AND symbol = p_symbol AND (exchange IS NULL OR exchange = p_sell_exchange);
  
  -- Verificar se há saldo suficiente disponível
  IF (usdt_balance - usdt_locked) < required_usdt THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo insuficiente de USDT',
      'required_usdt', required_usdt,
      'available_usdt', (usdt_balance - usdt_locked),
      'required_crypto', required_crypto,
      'available_crypto', (crypto_balance - crypto_locked)
    );
  END IF;
  
  IF (crypto_balance - crypto_locked) < required_crypto THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Saldo insuficiente de ' || p_symbol,
      'required_usdt', required_usdt,
      'available_usdt', (usdt_balance - usdt_locked),
      'required_crypto', required_crypto,
      'available_crypto', (crypto_balance - crypto_locked)
    );
  END IF;
  
  -- Bloquear saldos necessários
  -- Bloquear USDT para compra
  INSERT INTO public.portfolios (user_id, symbol, balance, locked_balance, exchange)
  VALUES (p_user_id, 'USDT', 0, required_usdt, p_buy_exchange)
  ON CONFLICT (user_id, symbol, COALESCE(exchange, ''))
  DO UPDATE SET 
    locked_balance = portfolios.locked_balance + required_usdt,
    updated_at = now();
  
  -- Bloquear crypto para venda
  INSERT INTO public.portfolios (user_id, symbol, balance, locked_balance, exchange)
  VALUES (p_user_id, p_symbol, 0, required_crypto, p_sell_exchange)
  ON CONFLICT (user_id, symbol, COALESCE(exchange, ''))
  DO UPDATE SET 
    locked_balance = portfolios.locked_balance + required_crypto,
    updated_at = now();
  
  -- Retornar sucesso
  RETURN jsonb_build_object(
    'success', true,
    'locked_usdt', required_usdt,
    'locked_crypto', required_crypto,
    'available_usdt_after', (usdt_balance - usdt_locked - required_usdt),
    'available_crypto_after', (crypto_balance - crypto_locked - required_crypto)
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
  p_success BOOLEAN
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
  required_usdt := p_amount * 100; -- Assumindo preço médio de $100
  required_crypto := p_amount;
  
  -- Desbloquear USDT
  UPDATE public.portfolios
  SET 
    locked_balance = GREATEST(0, locked_balance - required_usdt),
    updated_at = now()
  WHERE user_id = p_user_id 
    AND symbol = 'USDT' 
    AND (exchange IS NULL OR exchange = p_buy_exchange);
  
  -- Desbloquear crypto
  UPDATE public.portfolios
  SET 
    locked_balance = GREATEST(0, locked_balance - required_crypto),
    updated_at = now()
  WHERE user_id = p_user_id 
    AND symbol = p_symbol 
    AND (exchange IS NULL OR exchange = p_sell_exchange);
    
END;
$$;

-- Política RLS para a tabela portfolios
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own portfolio"
ON public.portfolios FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio"
ON public.portfolios FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio"
ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all portfolios"
ON public.portfolios FOR ALL USING (current_setting('role') = 'service_role');