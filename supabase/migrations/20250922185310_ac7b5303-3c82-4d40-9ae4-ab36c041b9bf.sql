-- Remove políticas RLS restritivas da tabela arbitrage_trades
DROP POLICY IF EXISTS "Users can view their own trades" ON public.arbitrage_trades;
DROP POLICY IF EXISTS "Users can insert their own trades" ON public.arbitrage_trades;
DROP POLICY IF EXISTS "Users can update their own trades" ON public.arbitrage_trades;

-- Criar políticas mais permissivas para visualização de trades
CREATE POLICY "Anyone can view trades" 
ON public.arbitrage_trades 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert trades" 
ON public.arbitrage_trades 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update trades" 
ON public.arbitrage_trades 
FOR UPDATE 
USING (true);