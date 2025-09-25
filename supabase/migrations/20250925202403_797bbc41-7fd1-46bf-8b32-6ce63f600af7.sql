-- Criar tabela para configurações de transferência inteligente
CREATE TABLE public.smart_transfer_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  symbol TEXT NOT NULL DEFAULT 'BTC',
  required_amount NUMERIC NOT NULL DEFAULT 0.1,
  from_exchange TEXT NOT NULL DEFAULT 'binance',
  to_exchange TEXT NOT NULL DEFAULT 'okx',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  use_proxy BOOLEAN NOT NULL DEFAULT false,
  bypass_security BOOLEAN NOT NULL DEFAULT false,
  auto_2fa BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.smart_transfer_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own transfer configs" 
ON public.smart_transfer_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own transfer configs" 
ON public.smart_transfer_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transfer configs" 
ON public.smart_transfer_configs 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own transfer configs" 
ON public.smart_transfer_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_smart_transfer_configs_updated_at
BEFORE UPDATE ON public.smart_transfer_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();