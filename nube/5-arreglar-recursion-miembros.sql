-- ============================================================
--  Arreglo: recursión infinita en las políticas de "miembros"
--  Las políticas "ver miembros de mi proyecto", "dueno administra
--  miembros" y "dueno elimina miembros" consultan la propia tabla
--  miembros para decidir el acceso A la tabla miembros — Postgres
--  no permite eso directamente y tira error 500 ("infinite
--  recursion detected in policy for relation miembros").
--  Se soluciona con una función security definer que hace esa
--  consulta "por afuera" de las políticas (rompe el ciclo).
--  Correr esto entero en el SQL Editor de Supabase.
-- ============================================================

create or replace function public.mi_proyecto_como(rol_req text default null)
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select proyecto_id from public.miembros
  where user_id = auth.uid() and estado = 'aceptado'
    and (rol_req is null or rol = rol_req)
$$;

drop policy if exists "ver miembros de mi proyecto" on public.miembros;
create policy "ver miembros de mi proyecto" on public.miembros for select
  to authenticated
  using (
    user_id = auth.uid()
    or proyecto_id in (select public.mi_proyecto_como())
  );

drop policy if exists "dueno administra miembros" on public.miembros;
create policy "dueno administra miembros" on public.miembros for update
  to authenticated
  using (proyecto_id in (select public.mi_proyecto_como('dueno')));

drop policy if exists "dueno elimina miembros" on public.miembros;
create policy "dueno elimina miembros" on public.miembros for delete
  to authenticated
  using (proyecto_id in (select public.mi_proyecto_como('dueno')) and rol <> 'dueno');
