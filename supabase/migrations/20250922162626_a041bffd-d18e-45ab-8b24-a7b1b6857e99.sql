-- Corrigir problemas de segurança: Habilitar RLS em todas as tabelas que têm políticas mas RLS desabilitado

-- Habilitar RLS nas tabelas que têm políticas mas não têm RLS ativo
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approved_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gaia_node_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.miners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_workers ENABLE ROW LEVEL SECURITY;

-- Adicionar coluna de modo (real/teste) na tabela de trades
ALTER TABLE public.arbitrage_trades ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'test' CHECK (trading_mode IN ('test', 'real'));

-- Atualizar trigger para incluir search_path nas funções que não têm
CREATE OR REPLACE FUNCTION public.update_updated_at_timestamp()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id uuid)
RETURNS TABLE(role app_role)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT ur.role
  FROM public.user_roles ur
  WHERE ur.user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_triangular_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('triangular_pro', 'admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.has_saat_lite_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Admin total (kleberlimaaleluia@gmail.com)
  SELECT CASE 
    WHEN EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = _user_id 
      AND email = 'kleberlimaaleluia@gmail.com'
    ) THEN true
    -- Novos usuários têm acesso gratuito ao SAAT Lite por 48h
    WHEN EXISTS (
      SELECT 1 FROM auth.users 
      WHERE id = _user_id 
      AND created_at > now() - INTERVAL '48 hours'
    ) THEN true
    -- Usuários com trial ativo
    WHEN EXISTS (
      SELECT 1 FROM public.approved_users 
      WHERE user_id = _user_id 
      AND is_active = true 
      AND is_trial = true 
      AND trial_ends_at > now()
    ) THEN true
    -- Usuários com assinatura SAAT Lite ativa
    WHEN EXISTS (
      SELECT 1 FROM public.user_subscriptions us
      JOIN public.subscription_plans_new sp ON us.plan_id = sp.id
      WHERE us.user_id = _user_id 
      AND us.status = 'active'
      AND us.ends_at > now()
      AND sp.name LIKE 'SAAT Lite%'
    ) THEN true
    ELSE false
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_exchange_symbol_stats()
RETURNS TABLE(exchange text, symbol_count bigint, last_updated timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    esm.exchange,
    COUNT(*) as symbol_count,
    MAX(esm.last_seen) as last_updated
  FROM public.exchange_symbol_mappings esm
  WHERE esm.is_active = true
  GROUP BY esm.exchange
  ORDER BY esm.exchange;
$$;