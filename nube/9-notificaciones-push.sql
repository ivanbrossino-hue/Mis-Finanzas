-- ============================================================
--  Notificaciones push (Web Push) — una fila por dispositivo/navegador
--  suscripto. Un mismo usuario puede tener varias (celu + PC), por eso
--  no hay unique(user_id) como en miembros.
-- ============================================================

create table if not exists public.push_subscripciones (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  creado_en    timestamptz not null default now()
);

alter table public.push_subscripciones enable row level security;

-- Cada quien gestiona (crea/borra) sus propias suscripciones.
drop policy if exists "gestionar mi suscripcion" on public.push_subscripciones;
create policy "gestionar mi suscripcion" on public.push_subscripciones for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (
    select 1 from public.miembros m
    where m.proyecto_id = push_subscripciones.proyecto_id and m.user_id = auth.uid() and m.estado = 'aceptado'
  ));

-- La Edge Function que manda los avisos usa la service_role key (bypassea RLS),
-- así que no hace falta una política de lectura para "los demás miembros".
