-- Fix RLS security issue for okx_whitelist_ips table
-- Enable Row Level Security on the table
ALTER TABLE public.okx_whitelist_ips ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can manage their own OKX whitelist IPs" ON public.okx_whitelist_ips;
DROP POLICY IF EXISTS "Service role can manage all OKX whitelist IPs" ON public.okx_whitelist_ips;

-- Create proper RLS policies
CREATE POLICY "Users can manage their own OKX whitelist IPs" 
ON public.okx_whitelist_ips 
FOR ALL 
USING (auth.uid() = user_id OR auth.uid()::text = user_id::text)
WITH CHECK (auth.uid() = user_id OR auth.uid()::text = user_id::text);

CREATE POLICY "Service role can manage all OKX whitelist IPs" 
ON public.okx_whitelist_ips 
FOR ALL 
USING (current_setting('role'::text) = 'service_role'::text);