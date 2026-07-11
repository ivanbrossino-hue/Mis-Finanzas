-- ============================================================
--  Diagnóstico temporal: ¿qué ve el servidor como auth.uid() en un
--  pedido autenticado real desde el navegador? Esto NO se puede ver
--  desde el SQL Editor (corre como superusuario, sin JWT), por eso
--  se prueba a través de una función que la app llama ya logueada.
--  Es solo para diagnóstico — después de resolver el problema se
--  puede borrar con: drop function public.debug_mi_uid();
-- ============================================================

create or replace function public.debug_mi_uid()
returns json
language sql
security invoker
stable
as $$
  select json_build_object(
    'auth_uid', auth.uid(),
    'role', current_setting('request.jwt.claim.role', true),
    'jwt_sub', current_setting('request.jwt.claim.sub', true)
  );
$$;

grant execute on function public.debug_mi_uid() to authenticated, anon;
