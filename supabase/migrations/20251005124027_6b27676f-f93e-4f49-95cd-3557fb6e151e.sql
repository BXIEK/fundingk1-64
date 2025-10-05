-- Create conversion_history table for tracking token conversions
CREATE TABLE IF NOT EXISTS public.conversion_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  from_token TEXT NOT NULL,
  to_token TEXT NOT NULL,
  from_amount NUMERIC NOT NULL,
  to_amount NUMERIC NOT NULL,
  exchange TEXT NOT NULL,
  conversion_type TEXT NOT NULL DEFAULT 'market',
  price NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversion_history ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own conversion history
CREATE POLICY "Users can view their own conversion history"
  ON public.conversion_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own conversion history
CREATE POLICY "Users can insert their own conversion history"
  ON public.conversion_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create index on user_id and created_at for faster queries
CREATE INDEX idx_conversion_history_user_id_created_at 
  ON public.conversion_history(user_id, created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversion_history;