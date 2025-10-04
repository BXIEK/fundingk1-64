-- Create HFT trades table
CREATE TABLE IF NOT EXISTS public.hft_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL,
  buy_exchange TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  buy_price NUMERIC NOT NULL,
  sell_price NUMERIC NOT NULL,
  spread_percentage NUMERIC NOT NULL,
  trade_amount NUMERIC NOT NULL,
  net_profit NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create triangular trades table
CREATE TABLE IF NOT EXISTS public.triangular_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  cycle TEXT[] NOT NULL,
  exchange TEXT NOT NULL,
  profit_percentage NUMERIC NOT NULL,
  net_profit_usd NUMERIC NOT NULL,
  prices JSONB NOT NULL,
  trade_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.hft_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.triangular_trades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hft_trades
CREATE POLICY "Users can view their own HFT trades"
  ON public.hft_trades
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own HFT trades"
  ON public.hft_trades
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own HFT trades"
  ON public.hft_trades
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all HFT trades"
  ON public.hft_trades
  FOR ALL
  USING (current_setting('role'::text) = 'service_role'::text);

-- RLS Policies for triangular_trades
CREATE POLICY "Users can view their own triangular trades"
  ON public.triangular_trades
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own triangular trades"
  ON public.triangular_trades
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own triangular trades"
  ON public.triangular_trades
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all triangular trades"
  ON public.triangular_trades
  FOR ALL
  USING (current_setting('role'::text) = 'service_role'::text);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_hft_trades_user_id ON public.hft_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_hft_trades_status ON public.hft_trades(status);
CREATE INDEX IF NOT EXISTS idx_hft_trades_created_at ON public.hft_trades(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triangular_trades_user_id ON public.triangular_trades(user_id);
CREATE INDEX IF NOT EXISTS idx_triangular_trades_status ON public.triangular_trades(status);
CREATE INDEX IF NOT EXISTS idx_triangular_trades_created_at ON public.triangular_trades(created_at DESC);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_hft_trades_updated_at ON public.hft_trades;
CREATE TRIGGER update_hft_trades_updated_at
  BEFORE UPDATE ON public.hft_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_triangular_trades_updated_at ON public.triangular_trades;
CREATE TRIGGER update_triangular_trades_updated_at
  BEFORE UPDATE ON public.triangular_trades
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();