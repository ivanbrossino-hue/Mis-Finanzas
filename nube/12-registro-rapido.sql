-- ============================================================
--  Registro rápido de gastos (atajo del iPhone, detector de Android, propuestas en la app)
--  Requiere haber corrido antes 4 y 5 (tablas proyectos / miembros y la función mi_proyecto_como).
--  Es idempotente: se puede correr más de una vez.
--  Lo usa la Edge Function `gasto-rapido` con la service_role key (bypassea RLS).
-- ============================================================

-- ------------------------------------------------------------
-- 1) tokens_atajo — una fila por dispositivo vinculado
--    El token en sí NUNCA se guarda: la app lo genera en el navegador, calcula su SHA-256 y sube solo el hash.
--    Se muestra una única vez al usuario. Para "recuperar" uno perdido hay que generar otro.
-- ------------------------------------------------------------
create table if not exists public.tokens_atajo (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  proyecto_id       uuid not null references public.proyectos(id) on delete cascade,
  token_hash        text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),   -- SHA-256 en hexa
  dispositivo       text not null check (char_length(dispositivo) between 1 and 60),
  alcance           text not null check (alcance in ('gasto', 'detector')),       -- gasto = iPhone, detector = Android
  creado_en         timestamptz not null default now(),
  ultimo_uso        timestamptz,
  revocado          boolean not null default false,
  revocado_en       timestamptz,
  -- cupo de pedidos por hora (ventana fija); lo maneja consumir_cupo_atajo()
  ventana_inicio    timestamptz not null default now(),
  pedidos_ventana   integer not null default 0
);

create index if not exists tokens_atajo_user_idx on public.tokens_atajo (user_id);
create index if not exists tokens_atajo_proyecto_idx on public.tokens_atajo (proyecto_id);

alter table public.tokens_atajo enable row level security;

-- Cada usuario ve solo los suyos.
drop policy if exists "ver mis tokens de atajo" on public.tokens_atajo;
create policy "ver mis tokens de atajo" on public.tokens_atajo for select
  to authenticated
  using (user_id = auth.uid());

-- Crear: solo para sí mismo y solo en un proyecto donde sea dueño o editor aceptado (un lector no registra gastos).
drop policy if exists "crear mi token de atajo" on public.tokens_atajo;
create policy "crear mi token de atajo" on public.tokens_atajo for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and revocado = false
    and exists (
      select 1 from public.miembros m
      where m.proyecto_id = tokens_atajo.proyecto_id and m.user_id = auth.uid()
        and m.estado = 'aceptado' and m.rol in ('dueno', 'editor')
    )
  );

-- Revocar: solo los propios. (Las columnas editables se limitan más abajo con GRANT.)
drop policy if exists "revocar mi token de atajo" on public.tokens_atajo;
create policy "revocar mi token de atajo" on public.tokens_atajo for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Sin política de DELETE: no se borran, se revocan (queda el historial de qué dispositivos hubo).

-- Permisos por columna: el cliente puede insertar solo estos datos y solo puede cambiar el estado de revocación.
-- No puede tocar ultimo_uso, el cupo ni el hash de uno existente.
revoke all on public.tokens_atajo from anon, authenticated;
grant select on public.tokens_atajo to authenticated;
grant insert (user_id, proyecto_id, token_hash, dispositivo, alcance) on public.tokens_atajo to authenticated;
grant update (revocado, revocado_en) on public.tokens_atajo to authenticated;

-- Una vez revocado no se puede "des-revocar".
create or replace function public.tokens_atajo_no_desrevocar()
returns trigger language plpgsql as $$
begin
  if old.revocado and not new.revocado then
    raise exception 'un token revocado no se puede reactivar';
  end if;
  if new.revocado and not old.revocado and new.revocado_en is null then
    new.revocado_en := now();
  end if;
  return new;
end $$;

drop trigger if exists tokens_atajo_no_desrevocar on public.tokens_atajo;
create trigger tokens_atajo_no_desrevocar before update on public.tokens_atajo
  for each row execute function public.tokens_atajo_no_desrevocar();

-- Cupo atómico: suma un pedido a la ventana de la hora y devuelve si todavía entra.
-- Solo la service_role (la Edge Function) puede llamarla.
create or replace function public.consumir_cupo_atajo(p_token_id uuid, p_limite integer default 60)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedidos integer;
begin
  update public.tokens_atajo
     set pedidos_ventana = case when ventana_inicio < now() - interval '1 hour' then 1 else pedidos_ventana + 1 end,
         ventana_inicio  = case when ventana_inicio < now() - interval '1 hour' then now() else ventana_inicio end,
         ultimo_uso      = now()
   where id = p_token_id and not revocado
   returning pedidos_ventana into v_pedidos;
  if v_pedidos is null then return false; end if;      -- token inexistente o revocado
  return v_pedidos <= p_limite;
end $$;

revoke all on function public.consumir_cupo_atajo(uuid, integer) from public, anon, authenticated;
grant execute on function public.consumir_cupo_atajo(uuid, integer) to service_role;

-- ------------------------------------------------------------
-- 2) movimientos_pendientes — propuestas de gasto (notificaciones de Android, comprobantes del iPhone, etc.)
--    NO se guarda el texto original de la notificación ni la imagen: solo lo ya interpretado.
-- ------------------------------------------------------------
create table if not exists public.movimientos_pendientes (
  id                  uuid primary key default gen_random_uuid(),
  proyecto_id         uuid not null references public.proyectos(id) on delete cascade,
  creado_por          uuid references auth.users(id) on delete set null,
  token_id            uuid references public.tokens_atajo(id) on delete set null,
  origen              text not null check (origen in ('android-notif', 'ios-comprobante', 'manual')),
  tipo                text not null default 'gasto' check (tipo in ('gasto', 'ingreso')),
  monto               numeric(14, 2) not null check (monto > 0),
  comercio            text check (comercio is null or char_length(comercio) <= 80),
  comercio_norm       text check (comercio_norm is null or char_length(comercio_norm) <= 80),   -- minúsculas y sin tildes: para aprender comercio -> categoría
  fecha               date not null,
  categoria_sugerida  text,
  fila_sugerida       text check (fila_sugerida is null or char_length(fila_sugerida) <= 60),
  confianza           numeric(3, 2) check (confianza is null or (confianza >= 0 and confianza <= 1)),
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente', 'registrado', 'ignorado', 'auto_registrado')),
  -- Lo que finalmente se registró (puede diferir de lo sugerido): de acá aprende el mapa de comercios.
  categoria_final     text,
  fila_final          text check (fila_final is null or char_length(fila_final) <= 60),
  movimiento_id       text,                       -- id del movimiento creado en proyectos.data (para deshacer / rastrear)
  huella              text not null check (char_length(huella) between 16 and 128),
  creado_en           timestamptz not null default now(),
  resuelto_en         timestamptz,
  resuelto_por        uuid references auth.users(id) on delete set null,
  -- Evita duplicados: la misma huella (monto + comercio + ventana de tiempo) no entra dos veces en un proyecto.
  constraint movimientos_pendientes_huella_unica unique (proyecto_id, huella)
);

create index if not exists movimientos_pendientes_estado_idx on public.movimientos_pendientes (proyecto_id, estado, creado_en desc);
create index if not exists movimientos_pendientes_comercio_idx on public.movimientos_pendientes (proyecto_id, comercio_norm) where comercio_norm is not null;

alter table public.movimientos_pendientes enable row level security;

-- Ver: cualquier miembro aceptado del proyecto.
drop policy if exists "ver pendientes de mi proyecto" on public.movimientos_pendientes;
create policy "ver pendientes de mi proyecto" on public.movimientos_pendientes for select
  to authenticated
  using (proyecto_id in (select public.mi_proyecto_como()));

-- Resolver (registrar / ignorar desde la app): solo dueño o editor, y solo filas que siguen pendientes.
drop policy if exists "resolver pendientes de mi proyecto" on public.movimientos_pendientes;
create policy "resolver pendientes de mi proyecto" on public.movimientos_pendientes for update
  to authenticated
  using (
    estado = 'pendiente'
    and exists (
      select 1 from public.miembros m
      where m.proyecto_id = movimientos_pendientes.proyecto_id and m.user_id = auth.uid()
        and m.estado = 'aceptado' and m.rol in ('dueno', 'editor')
    )
  )
  with check (
    estado in ('registrado', 'ignorado')
    and resuelto_por = auth.uid()
  );

-- Sin política de INSERT ni DELETE: las propuestas las crea solo la Edge Function (service_role).
-- Desde la app solo se pueden cambiar estas columnas.
revoke all on public.movimientos_pendientes from anon, authenticated;
grant select on public.movimientos_pendientes to authenticated;
grant update (estado, categoria_final, fila_final, movimiento_id, resuelto_en, resuelto_por) on public.movimientos_pendientes to authenticated;

-- Para ver el contador "Pendientes" en vivo en la app (opcional; si ya estaba agregada no pasa nada).
do $$
begin
  alter publication supabase_realtime add table public.movimientos_pendientes;
exception when duplicate_object then null;
          when undefined_object then null;
end $$;
