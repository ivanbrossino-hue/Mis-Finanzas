-- ============================================================
--  Verificación de 12-registro-rapido.sql — SOLO LECTURA (solo hace SELECT, no modifica nada).
--  Correr en el SQL Editor después de 12-registro-rapido.sql. Cada bloque dice qué debería dar.
-- ============================================================

-- 1) RLS activado en las dos tablas.  Esperado: rls_activado = true en ambas.
select c.relname as tabla, c.relrowsecurity as rls_activado, c.relforcerowsecurity as rls_forzado
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('tokens_atajo', 'movimientos_pendientes')
order by 1;

-- 2) Policies.  Esperado: todas con roles = {authenticated} (ninguna para anon ni public).
--    tokens_atajo: select (propios), insert (propios, dueño/editor), update (propios).
--    movimientos_pendientes: select (miembros) y update (dueño/editor, solo pendientes). Sin insert ni delete.
select tablename as tabla, policyname as policy, cmd as operacion, roles, qual as using_expr, with_check
from pg_policies
where schemaname = 'public' and tablename in ('tokens_atajo', 'movimientos_pendientes')
order by tablename, cmd, policyname;

-- 3) Privilegios sobre las tablas.  Esperado: ninguna fila para 'anon' ni 'PUBLIC'.
--    authenticated: tokens_atajo = SELECT; movimientos_pendientes = SELECT.  (INSERT/UPDATE se dan por columna, ver el punto 4.)
select table_name as tabla, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privilegios
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('tokens_atajo', 'movimientos_pendientes')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
group by table_name, grantee
order by 1, 2;

-- 4) Privilegios por columna.  Esperado (para authenticated):
--    tokens_atajo: INSERT en user_id, proyecto_id, token_hash, dispositivo, alcance · UPDATE solo en revocado y revocado_en.
--    movimientos_pendientes: UPDATE solo en estado, categoria_final, fila_final, movimiento_id, resuelto_en, resuelto_por.
--    Ninguna fila para 'anon'.
select table_name as tabla, grantee, privilege_type as privilegio, string_agg(column_name, ', ' order by column_name) as columnas
from information_schema.column_privileges
where table_schema = 'public' and table_name in ('tokens_atajo', 'movimientos_pendientes')
  and grantee in ('anon', 'authenticated', 'PUBLIC')
  and privilege_type in ('INSERT', 'UPDATE')
group by table_name, grantee, privilege_type
order by 1, 2, 3;

-- 5) Funciones: SECURITY DEFINER, search_path fijo y quién puede ejecutarlas.
--    Esperado: consumir_cupo_atajo -> security_definer = true, search_path = public,
--    puede_service_role = true y TODO lo demás false.  tokens_atajo_no_desrevocar -> search_path = public, nadie salvo el dueño de la función.
select p.proname as funcion,
       p.prosecdef as security_definer,
       array_to_string(p.proconfig, ', ') as config,
       has_function_privilege('anon', p.oid, 'execute') as puede_anon,
       has_function_privilege('authenticated', p.oid, 'execute') as puede_authenticated,
       has_function_privilege('service_role', p.oid, 'execute') as puede_service_role,
       -- PUBLIC (acl con grantee 0): si es true, cualquiera puede ejecutarla
       coalesce((select bool_or(a.grantee = 0) from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.privilege_type = 'EXECUTE'), false) as puede_public
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('consumir_cupo_atajo', 'tokens_atajo_no_desrevocar');

-- 6) Triggers de tokens_atajo.  Esperado: tokens_atajo_no_desrevocar (BEFORE UPDATE).
select tgname as trigger, tgenabled as habilitado
from pg_trigger
where tgrelid = 'public.tokens_atajo'::regclass and not tgisinternal;

-- 7) Restricciones únicas (anti-duplicados y hash único).  Esperado: movimientos_pendientes_huella_unica y tokens_atajo_token_hash_key.
select conrelid::regclass as tabla, conname as restriccion, pg_get_constraintdef(oid) as definicion
from pg_constraint
where conrelid in ('public.tokens_atajo'::regclass, 'public.movimientos_pendientes'::regclass) and contype = 'u'
order by 1, 2;

-- 8) La tabla movimientos_pendientes NO tiene columnas de texto original ni de imagen.  Esperado: ninguna fila.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'movimientos_pendientes'
  and column_name ~* '(texto|original|raw|imagen|body|contenido)';
