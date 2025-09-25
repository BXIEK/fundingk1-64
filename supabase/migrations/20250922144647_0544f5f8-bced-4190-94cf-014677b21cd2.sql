-- Ativar RLS na tabela portfolios se não estiver ativo
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para a tabela portfolios
CREATE POLICY IF NOT EXISTS "Users can view their own portfolio" 
ON public.portfolios 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own portfolio" 
ON public.portfolios 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own portfolio" 
ON public.portfolios 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own portfolio" 
ON public.portfolios 
FOR DELETE 
USING (auth.uid() = user_id);

-- Service role pode gerenciar todos os portfolios
CREATE POLICY IF NOT EXISTS "Service role can manage all portfolios" 
ON public.portfolios 
FOR ALL 
USING (current_setting('role'::text) = 'service_role'::text);