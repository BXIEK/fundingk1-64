-- Limpar todos os dados simulados/históricos da tabela portfolios
TRUNCATE TABLE public.portfolios;

-- Verificar se há dados simulados em outras tabelas
DELETE FROM public.arbitrage_trades WHERE trading_mode = 'simulation';
DELETE FROM public.arbitrage_trades WHERE error_message LIKE '%simulação%';
DELETE FROM public.arbitrage_trades WHERE error_message LIKE '%simulado%';