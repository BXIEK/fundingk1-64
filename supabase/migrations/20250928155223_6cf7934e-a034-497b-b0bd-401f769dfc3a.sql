-- Limpar registros antigos de whitelist OKX (antes das 11h de hoje)
DELETE FROM public.okx_whitelist_ips 
WHERE created_at < '2025-09-28 11:00:00'::timestamp;