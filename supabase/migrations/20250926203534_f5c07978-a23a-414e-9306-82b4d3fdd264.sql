-- Fix RLS policies for auto_cross_exchange_configs table

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can manage their own cross-exchange configs" ON public.auto_cross_exchange_configs;

-- Enable RLS if not already enabled
ALTER TABLE public.auto_cross_exchange_configs ENABLE ROW LEVEL SECURITY;

-- Create comprehensive RLS policies for auto_cross_exchange_configs
CREATE POLICY "Users can view their own cross-exchange configs" 
ON public.auto_cross_exchange_configs 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cross-exchange configs" 
ON public.auto_cross_exchange_configs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cross-exchange configs" 
ON public.auto_cross_exchange_configs 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cross-exchange configs" 
ON public.auto_cross_exchange_configs 
FOR DELETE 
USING (auth.uid() = user_id);

-- Also allow service role to manage all configs
CREATE POLICY "Service role can manage all cross-exchange configs" 
ON public.auto_cross_exchange_configs 
FOR ALL 
USING (current_setting('role'::text) = 'service_role'::text);