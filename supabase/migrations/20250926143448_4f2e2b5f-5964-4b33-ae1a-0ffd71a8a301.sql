-- Criar tabela para gerenciar IPs da whitelist da OKX
CREATE TABLE public.okx_whitelist_ips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ip_address INET NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.okx_whitelist_ips ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS
CREATE POLICY "Users can manage their own OKX whitelist IPs"
ON public.okx_whitelist_ips
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role pode gerenciar todos os IPs
CREATE POLICY "Service role can manage all OKX whitelist IPs"
ON public.okx_whitelist_ips
FOR ALL
USING (current_setting('role') = 'service_role');

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_okx_whitelist_ips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE TRIGGER update_okx_whitelist_ips_updated_at
  BEFORE UPDATE ON public.okx_whitelist_ips
  FOR EACH ROW
  EXECUTE FUNCTION public.update_okx_whitelist_ips_updated_at();

-- Inserir IP padrão do Lovable para OKX (caso o usuário tenha adicionado na whitelist)
-- Este é um IP genérico, o usuário deve atualizar com o IP correto da whitelist
INSERT INTO public.okx_whitelist_ips (user_id, ip_address, description, is_active)
SELECT 
  id,
  '0.0.0.0/0'::INET,
  'IP configurado para whitelist OKX - Atualize com o IP correto',
  false
FROM auth.users
WHERE email = 'kleberlimaaleluia@gmail.com'
ON CONFLICT DO NOTHING;