-- ============================================================
--  Login con Google + proyectos compartidos con roles
--  NO correr esto todavía en el proyecto en uso — se aplica recién
--  cuando Iván esté listo para hacer el primer login y migrar datos
--  (rompe el acceso viejo por URL+clave apenas se aplica el último
--  bloque de políticas, que reemplaza la política abierta actual).
-- ============================================================

-- Un "proyecto" = un espacio de finanzas compartido (lo que antes era
-- la única fila 'main'). Cada usuario de Google pertenece A LO SUMO A UNO.
create table if not exists public.proyectos (
  id          uuid primary key default gen_random_uuid(),
  data        jsonb not null default '{"version":1,"meses":{},"deudas":[],"catNombres":{},"presupuestos":{}}',
  rev         bigint not null default 0,
  dueno_id    uuid not null references auth.users(id) on delete cascade,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Quién pertenece a cada proyecto y con qué rol.
-- user_id es NULL mientras la invitación está "pendiente" (todavía no
-- inició sesión con ese mail). Un mismo user_id no puede estar en dos
-- filas (un usuario = un solo proyecto a la vez).
create table if not exists public.miembros (
  id           uuid primary key default gen_random_uuid(),
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  email        text not null,
  rol          text not null check (rol in ('dueno','editor','lector')),
  estado       text not null default 'pendiente' check (estado in ('pendiente','aceptado')),
  created_at   timestamptz not null default now(),
  unique (user_id),                 -- un usuario, un solo proyecto
  unique (proyecto_id, email)       -- no invitar dos veces el mismo mail al mismo proyecto
);

-- El bot de Telegram: a qué proyecto escribe cada chat_id (antes escribía
-- siempre a la fila fija 'main'). Se llena cuando alguien vincula su
-- Telegram desde la app (ver PASO "vincular bot" más abajo).
create table if not exists public.bot_vinculos (
  chat_id      bigint primary key,
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,
  vinculado_por uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

-- Códigos temporales de un solo uso para vincular el bot a un proyecto
-- (la app genera uno, el usuario se lo manda al bot, el bot lo consume).
create table if not exists public.bot_codigos_vinculo (
  codigo       text primary key,
  proyecto_id  uuid not null references public.proyectos(id) on delete cascade,
  creado_por   uuid not null references auth.users(id),
  usado        boolean not null default false,
  expira_en    timestamptz not null default (now() + interval '15 minutes'),
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
--  Seguridad (RLS)
-- ------------------------------------------------------------
alter table public.proyectos          enable row level security;
alter table public.miembros           enable row level security;
alter table public.bot_vinculos       enable row level security;
alter table public.bot_codigos_vinculo enable row level security;

-- PROYECTOS: leer si sos miembro aceptado (cualquier rol); escribir
-- (actualizar data/rev) solo si sos dueño o editor.
drop policy if exists "leer mi proyecto" on public.proyectos;
create policy "leer mi proyecto" on public.proyectos for select
  to authenticated
  using (exists (
    select 1 from public.miembros m
    where m.proyecto_id = proyectos.id and m.user_id = auth.uid() and m.estado = 'aceptado'
  ));

drop policy if exists "editar mi proyecto" on public.proyectos;
create policy "editar mi proyecto" on public.proyectos for update
  to authenticated
  using (exists (
    select 1 from public.miembros m
    where m.proyecto_id = proyectos.id and m.user_id = auth.uid()
      and m.estado = 'aceptado' and m.rol in ('dueno','editor')
  ));

-- Crear un proyecto propio nuevo: cualquier usuario autenticado (se usa
-- la primera vez que alguien loguea sin invitación pendiente).
drop policy if exists "crear proyecto propio" on public.proyectos;
create policy "crear proyecto propio" on public.proyectos for insert
  to authenticated
  with check (dueno_id = auth.uid());

-- MIEMBROS: ver la lista de compañeros de TU proyecto.
drop policy if exists "ver miembros de mi proyecto" on public.miembros;
create policy "ver miembros de mi proyecto" on public.miembros for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.miembros yo
      where yo.proyecto_id = miembros.proyecto_id and yo.user_id = auth.uid() and yo.estado = 'aceptado'
    )
  );

-- Reclamar tu propia invitación pendiente (aparece con tu mail, sin user_id).
drop policy if exists "reclamar mi invitacion" on public.miembros;
create policy "reclamar mi invitacion" on public.miembros for update
  to authenticated
  using (user_id is null and email = (auth.jwt() ->> 'email') and estado = 'pendiente')
  with check (user_id = auth.uid() and estado = 'aceptado');

-- Crearte a vos mismo como dueño de tu proyecto nuevo (el insert de la
-- invitación de OTROS mails la hace la función segura, no esto).
drop policy if exists "crearme como dueno" on public.miembros;
create policy "crearme como dueno" on public.miembros for insert
  to authenticated
  with check (user_id = auth.uid() and rol = 'dueno' and estado = 'aceptado');

-- Dueño puede cambiar rol / quitar miembros de su proyecto.
drop policy if exists "dueno administra miembros" on public.miembros;
create policy "dueno administra miembros" on public.miembros for update
  to authenticated
  using (exists (
    select 1 from public.miembros yo
    where yo.proyecto_id = miembros.proyecto_id and yo.user_id = auth.uid() and yo.rol = 'dueno'
  ));
drop policy if exists "dueno elimina miembros" on public.miembros;
create policy "dueno elimina miembros" on public.miembros for delete
  to authenticated
  using (exists (
    select 1 from public.miembros yo
    where yo.proyecto_id = miembros.proyecto_id and yo.user_id = auth.uid() and yo.rol = 'dueno'
  ) and rol <> 'dueno'); -- no te podés auto-eliminar como dueño desde acá

-- BOT_VINCULOS: solo dueño/editor de un proyecto pueden ver/crear su vínculo.
drop policy if exists "gestionar vinculo de mi proyecto" on public.bot_vinculos;
create policy "gestionar vinculo de mi proyecto" on public.bot_vinculos for all
  to authenticated
  using (exists (
    select 1 from public.miembros m
    where m.proyecto_id = bot_vinculos.proyecto_id and m.user_id = auth.uid()
      and m.estado = 'aceptado' and m.rol in ('dueno','editor')
  ));

-- BOT_CODIGOS_VINCULO: solo quien lo creó (dueño/editor) puede verlo/crearlo.
drop policy if exists "gestionar mis codigos" on public.bot_codigos_vinculo;
create policy "gestionar mis codigos" on public.bot_codigos_vinculo for all
  to authenticated
  using (creado_por = auth.uid())
  with check (creado_por = auth.uid());

-- ------------------------------------------------------------
--  IMPORTANTE — orden de aplicación (no correr todo de una):
--  1. Correr este archivo ENTERO crea las tablas nuevas sin tocar
--     la tabla vieja `finanzas` — en este punto el acceso actual
--     (URL+clave anon) sigue funcionando exactamente igual.
--  2. Recién cuando la app nueva esté lista y probada, y el usuario
--     haya hecho su primer login (creando su fila en `proyectos`),
--     se migra `finanzas.data` (la fila 'main') a esa fila nueva y
--     se puede borrar/deshabilitar la política abierta de `finanzas`.
-- ------------------------------------------------------------
