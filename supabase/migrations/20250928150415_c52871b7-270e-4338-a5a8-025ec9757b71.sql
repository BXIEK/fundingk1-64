-- ===============================================
-- CORRIGIR POLÍTICAS RLS DA TABELA PORTFOLIOS
-- ===============================================

-- Primeiro, verificar se a tabela existe
-- DROP EXISTING POLICIES IF EXISTS
DROP POLICY IF EXISTS "Service role can manage all portfolios" ON public.portfolios;
DROP POLICY IF EXISTS "Users can view their own portfolio" ON public.portfolios;
DROP POLICY IF EXISTS "Users can insert their own portfolio entries" ON public.portfolios;
DROP POLICY IF EXISTS "Users can update their own portfolio entries" ON public.portfolios;

-- CRIAR TABELA PORTFOLIOS SE NÃO EXISTIR
CREATE TABLE IF NOT EXISTS public.portfolios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    symbol text NOT NULL,
    balance numeric DEFAULT 0,
    locked_balance numeric DEFAULT 0,
    exchange text,
    application_title text,
    investment_type text DEFAULT 'spot',
    price_usd numeric,
    value_usd numeric,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, symbol, exchange)
);

-- ENABLE RLS
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS CORRIGIDAS PARA PERMITIR ACESSO TOTAL AOS USUÁRIOS
CREATE POLICY "Users can view all portfolio data" 
ON public.portfolios 
FOR SELECT 
USING (true);

CREATE POLICY "Users can insert portfolio data" 
ON public.portfolios 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update portfolio data" 
ON public.portfolios 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete portfolio data" 
ON public.portfolios 
FOR DELETE 
USING (true);

-- POLÍTICA PARA SERVICE ROLE
CREATE POLICY "Service role can manage all portfolios" 
ON public.portfolios 
FOR ALL 
USING (current_setting('role') = 'service_role');

-- ===============================================
-- CRIAR FUNÇÃO PARA SINCRONIZAR SALDOS REAIS
-- ===============================================

CREATE OR REPLACE FUNCTION public.sync_real_balances(
  p_user_id uuid,
  p_exchange text,
  p_balances jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      application_title
    )
    VALUES (
      p_user_id,
      balance_item->>'symbol',
      (balance_item->>'balance')::numeric,
      p_exchange,
      COALESCE((balance_item->>'price_usd')::numeric, 0),
      COALESCE((balance_item->>'value_usd')::numeric, 0),
      'Real Balance - ' || p_exchange
    )
    ON CONFLICT (user_id, symbol, exchange)
    DO UPDATE SET
      balance = EXCLUDED.balance,
      price_usd = EXCLUDED.price_usd,
      value_usd = EXCLUDED.value_usd,
      updated_at = now(),
      application_title = EXCLUDED.application_title;
  END LOOP;
END;
$$;

-- ===============================================
-- FUNÇÃO PARA VERIFICAR SALDOS DISPONÍVEIS
-- ===============================================

CREATE OR REPLACE FUNCTION public.check_available_balance(
  p_user_id uuid,
  p_symbol text,
  p_amount numeric,
  p_exchange text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  available_balance numeric := 0;
  locked_balance numeric := 0;
  total_balance numeric := 0;
BEGIN
  SELECT 
    COALESCE(SUM(balance), 0),
    COALESCE(SUM(locked_balance), 0),
    COALESCE(SUM(balance - locked_balance), 0)
  INTO total_balance, locked_balance, available_balance
  FROM public.portfolios
  WHERE user_id = p_user_id 
    AND symbol = p_symbol
    AND (p_exchange IS NULL OR exchange = p_exchange);
  
  RETURN jsonb_build_object(
    'symbol', p_symbol,
    'total_balance', total_balance,
    'locked_balance', locked_balance,
    'available_balance', available_balance,
    'requested_amount', p_amount,
    'sufficient', available_balance >= p_amount,
    'exchange', p_exchange
  );
END;
$$;

-- ===============================================
-- FUNÇÃO PARA PERMITIR TRADING EM TEMPO REAL
-- ===============================================

CREATE OR REPLACE FUNCTION public.enable_realtime_trading(
  p_user_id uuid,
  p_symbol text,
  p_operation_type text, -- 'buy', 'sell', 'transfer'
  p_amount numeric,
  p_exchange_from text DEFAULT NULL,
  p_exchange_to text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  balance_check jsonb;
  operation_allowed boolean := false;
  error_message text := '';
BEGIN
  -- Verificar saldo disponível
  IF p_operation_type IN ('sell', 'transfer') THEN
    balance_check := public.check_available_balance(p_user_id, p_symbol, p_amount, p_exchange_from);
    
    IF NOT (balance_check->>'sufficient')::boolean THEN
      error_message := 'Saldo insuficiente de ' || p_symbol || '. Disponível: ' || (balance_check->>'available_balance');
      operation_allowed := false;
    ELSE
      operation_allowed := true;
    END IF;
  ELSE
    -- Para operação de compra, verificar USDT/USDC
    balance_check := public.check_available_balance(p_user_id, 'USDT', p_amount, p_exchange_from);
    
    IF NOT (balance_check->>'sufficient')::boolean THEN
      error_message := 'Saldo insuficiente de USDT. Disponível: ' || (balance_check->>'available_balance');
      operation_allowed := false;
    ELSE
      operation_allowed := true;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'operation_allowed', operation_allowed,
    'operation_type', p_operation_type,
    'symbol', p_symbol,
    'amount', p_amount,
    'balance_check', balance_check,
    'error_message', error_message,
    'timestamp', now()
  );
END;
$$;

-- ===============================================
-- TRIGGER PARA ATUALIZAR TIMESTAMP
-- ===============================================

CREATE OR REPLACE FUNCTION public.update_portfolios_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS portfolios_updated_at ON public.portfolios;
CREATE TRIGGER portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_portfolios_updated_at();