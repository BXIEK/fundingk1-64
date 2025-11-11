-- Adicionar role de admin (desenvolvedor) para kleberlimaaleluia@gmail.com
insert into public.user_roles (user_id, role) 
select id, 'admin'::app_role 
from auth.users 
where email = 'kleberlimaaleluia@gmail.com'
on conflict (user_id, role) do nothing;