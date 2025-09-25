-- Ativar realtime para as tabelas de configuração
ALTER TABLE public.auto_funding_configs REPLICA IDENTITY FULL;
ALTER TABLE public.auto_cross_exchange_configs REPLICA IDENTITY FULL;
ALTER TABLE public.arbitrage_trades REPLICA IDENTITY FULL;