-- =====================================================
-- CORREÇÃO DE SEGURANÇA: Habilitar RLS em tabelas com policies
-- =====================================================

-- 1. Habilitar RLS nas tabelas que têm policies mas RLS desabilitado
ALTER TABLE public.miner_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pool_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solana_arbitrage_opportunities ENABLE ROW LEVEL SECURITY;

-- 2. Corrigir função sem search_path
CREATE OR REPLACE FUNCTION public.update_miner_stats(
  p_miner_id uuid, 
  p_shares_submitted bigint DEFAULT 0, 
  p_shares_accepted bigint DEFAULT 0, 
  p_hashrate numeric DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update miner statistics
  UPDATE miners 
  SET 
    total_shares_submitted = total_shares_submitted + p_shares_submitted,
    total_shares_accepted = total_shares_accepted + p_shares_accepted,
    total_hashrate_gh = p_hashrate,
    last_share_at = now(),
    updated_at = now(),
    is_active = true
  WHERE id = p_miner_id;
  
  -- If no rows were updated, the miner doesn't exist
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Miner with id % not found', p_miner_id;
  END IF;
END;
$function$;