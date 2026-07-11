-- ============================================================
--  Invitar por link (WhatsApp, etc.) sin saber el mail de antemano
--  El dueño genera un link con un rol ya definido (editor/lector).
--  Quien lo abre elige la cuenta de Google que quiera y queda sumado
--  automáticamente al proyecto con ese rol — no hace falta que el
--  dueño sepa con qué mail se va a loguear.
--  Requiere haber corrido antes 5-arreglar-recursion-miembros.sql
--  (usa la función mi_proyecto_como(...) de ese archivo).
-- ============================================================

create table if not exists public.invitaciones_link (
  token        text primary key default gen_random_uuid()::text,
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,
  rol          text not null check (rol in ('editor','lector')),
  creado_por   uuid not null references auth.users(id),
  usado_por    uuid references auth.users(id),
  expira_en    timestamptz not null default (now() + interval '7 days'),
  created_at   timestamptz not null default now()
);

alter table public.invitaciones_link enable row level security;

-- El dueño genera links solo para su propio proyecto.
drop policy if exists "dueno crea links de su proyecto" on public.invitaciones_link;
create policy "dueno crea links de su proyecto" on public.invitaciones_link for insert
  to authenticated
  with check (creado_por = auth.uid() and proyecto_id in (select public.mi_proyecto_como('dueno')));

-- El dueño puede ver y borrar los links que generó (para revocarlos).
drop policy if exists "dueno ve sus links" on public.invitaciones_link;
create policy "dueno ve sus links" on public.invitaciones_link for select
  to authenticated
  using (proyecto_id in (select public.mi_proyecto_como('dueno')));

drop policy if exists "dueno borra sus links" on public.invitaciones_link;
create policy "dueno borra sus links" on public.invitaciones_link for delete
  to authenticated
  using (proyecto_id in (select public.mi_proyecto_como('dueno')));

-- No hay política de SELECT para quien todavía no es miembro: el canje del
-- token lo hace la función unirse-por-link (service_role), no el cliente
-- directo, así un token no se puede "adivinar" listando la tabla.
