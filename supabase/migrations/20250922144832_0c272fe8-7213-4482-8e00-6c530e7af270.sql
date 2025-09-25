-- Ativar RLS na tabela portfolios se não estiver ativo
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- Tentar criar políticas RLS para a tabela portfolios (ignora se já existirem)
DO $$ 
BEGIN
    -- Policy para SELECT
    BEGIN
        CREATE POLICY "Users can view their own portfolio" 
        ON public.portfolios 
        FOR SELECT 
        USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Policy already exists
    END;

    -- Policy para INSERT
    BEGIN
        CREATE POLICY "Users can insert their own portfolio" 
        ON public.portfolios 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Policy already exists
    END;

    -- Policy para UPDATE
    BEGIN
        CREATE POLICY "Users can update their own portfolio" 
        ON public.portfolios 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Policy already exists
    END;

    -- Policy para DELETE
    BEGIN
        CREATE POLICY "Users can delete their own portfolio" 
        ON public.portfolios 
        FOR DELETE 
        USING (auth.uid() = user_id);
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Policy already exists
    END;

    -- Service role pode gerenciar todos os portfolios
    BEGIN
        CREATE POLICY "Service role can manage all portfolios" 
        ON public.portfolios 
        FOR ALL 
        USING (current_setting('role'::text) = 'service_role'::text);
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Policy already exists
    END;
END $$;