-- ============================================================
--  Diagnóstico + refuerzo de la política que permite crear tu
--  primer proyecto (estaba fallando con error 42501 / RLS).
--  Correr TODO esto en el SQL Editor. El SELECT de abajo (paso 1)
--  te va a mostrar qué política existe hoy — pegame el resultado
--  si después de esto sigue sin andar.
-- ============================================================

-- Paso 1: ver la política actual (para diagnóstico).
select policyname, cmd, roles, with_check
from pg_policies
where tablename = 'proyectos' and schemaname = 'public';

-- Paso 2: recrearla desde cero, por si quedó mal aplicada.
drop policy if exists "crear proyecto propio" on public.proyectos;
create policy "crear proyecto propio" on public.proyectos for insert
  to authenticated
  with check (dueno_id = auth.uid());

-- Paso 3: reforzar también los permisos de tabla base (por si el
-- proyecto no los tenía otorgados — no debería hacer falta, pero
-- no está de más asegurarlo).
grant select, insert, update, delete on public.proyectos to authenticated;
grant select, insert, update, delete on public.miembros to authenticated;
grant select, insert, update, delete on public.invitaciones_link to authenticated;
grant select, insert, update, delete on public.bot_vinculos to authenticated;
grant select, insert, update, delete on public.bot_codigos_vinculo to authenticated;
