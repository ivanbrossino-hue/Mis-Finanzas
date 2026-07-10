-- ============================================================
--  Mis Finanzas — Esquema de la base en Supabase
--  Pegá TODO esto en:  Supabase → SQL Editor → New query → Run
-- ============================================================

-- Tabla principal: guarda TODO el estado de la app en una sola fila (JSON).
create table if not exists public.finanzas (
  id          text primary key,           -- siempre 'main'
  data        jsonb not null default '{}', -- el estado completo (meses, deudas, etc.)
  rev         bigint not null default 0,   -- número de versión (sube en cada cambio)
  updated_by  text,                        -- 'app' o 'bot'
  updated_at  timestamptz not null default now()
);

-- Tabla auxiliar: gasto "pendiente" que el bot deja mientras te pregunta la categoría.
create table if not exists public.pending_bot (
  chat_id     bigint primary key,
  monto       numeric not null default 0,
  nombre      text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
--  Seguridad (RLS): permitimos que la app (clave pública "anon")
--  lea y escriba SOLO la tabla finanzas. El bot usa la clave de
--  servicio (service_role), que saltea estas reglas.
-- ------------------------------------------------------------
alter table public.finanzas   enable row level security;
alter table public.pending_bot enable row level security;

drop policy if exists "app puede todo en finanzas" on public.finanzas;
create policy "app puede todo en finanzas"
  on public.finanzas for all
  to anon
  using (true) with check (true);

-- pending_bot NO se expone a anon (solo la usa el bot con service_role).

-- Fila inicial vacía (por si querés arrancar desde cero en la nube).
insert into public.finanzas (id, data, rev, updated_by)
values ('main', '{"version":1,"meses":{},"deudas":[],"catNombres":{}}', 0, 'init')
on conflict (id) do nothing;
