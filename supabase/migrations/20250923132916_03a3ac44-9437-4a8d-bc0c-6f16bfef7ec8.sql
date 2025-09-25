-- Ajustar o constraint do campo trading_mode na tabela arbitrage_trades
-- Primeiro, verificar constraint atual
DO $$
BEGIN
  -- Dropar constraint existente se houver
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'arbitrage_trades_trading_mode_check' 
    AND table_name = 'arbitrage_trades'
  ) THEN
    ALTER TABLE public.arbitrage_trades DROP CONSTRAINT arbitrage_trades_trading_mode_check;
  END IF;
END $$;

-- Criar novo constraint que aceita os valores corretos
ALTER TABLE public.arbitrage_trades 
ADD CONSTRAINT arbitrage_trades_trading_mode_check 
CHECK (trading_mode IN ('real', 'test', 'simulation'));

-- Comentário explicativo
COMMENT ON CONSTRAINT arbitrage_trades_trading_mode_check ON public.arbitrage_trades IS 'Permite valores: real (operação com APIs reais), test (modo de teste), simulation (simulação/fallback)';