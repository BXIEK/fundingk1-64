-- Ativar realtime para as tabelas de configuração
ALTER TABLE public.auto_funding_configs REPLICA IDENTITY FULL;
ALTER TABLE public.auto_cross_exchange_configs REPLICA IDENTITY FULL;
ALTER TABLE public.arbitrage_trades REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação do realtime
SELECT 
  supabase_realtime.manage_realtime('public', 'auto_funding_configs', true);
SELECT 
  supabase_realtime.manage_realtime('public', 'auto_cross_exchange_configs', true);
SELECT 
  supabase_realtime.manage_realtime('public', 'arbitrage_trades', true);