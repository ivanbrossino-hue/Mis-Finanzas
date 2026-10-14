-- ============================================================
--  Verificación de 12-registro-rapido.sql — UNA sola consulta, SOLO LECTURA (no modifica nada).
--  Pegarla entera en el SQL Editor y copiar todas las filas del resultado.
--  Columnas: chequeo | resultado (lo que hay) | esperado (lo que debería haber). Donde difieren, hay algo para revisar.
-- ============================================================
select chequeo, resultado, esperado
from (

  -- 1) RLS activado
  select 10 as ord, 'RLS activado: ' || c.relname as chequeo, c.relrowsecurity::text as resultado, 'true' as esperado
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('tokens_atajo', 'movimientos_pendientes')

  union all
  -- 2) Cantidad de policies por tabla
  select 20, 'Cantidad de policies: ' || t.tabla,
         (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = t.tabla)::text,
         t.cuantas
  from (values ('tokens_atajo', '3'), ('movimientos_pendientes', '2')) as t(tabla, cuantas)

  union all
  -- 3) Cada policy: operación y roles (solo authenticated, ninguna para anon ni public)
  select 30, 'Policy ' || p.tablename || ' / ' || p.policyname || ' (' || p.cmd || ')',
         p.roles::text,
         '{authenticated}'
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('tokens_atajo', 'movimientos_pendientes')

  union all
  -- 4) Las policies usan mi_proyecto_como() y no consultan la tabla miembros directo
  select 40, 'Policy sin subconsulta directa a miembros: ' || p.tablename || ' / ' || p.policyname,
         ((coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '')) !~* 'miembros')::text,
         'true'
  from pg_policies p
  where p.schemaname = 'public' and p.tablename in ('tokens_atajo', 'movimientos_pendientes')

  union all
  -- 5) anon no tiene ningún privilegio sobre las tablas (ni a nivel tabla ni de columna)
  select 50, 'anon sin acceso a ' || t.tabla,
         (not has_table_privilege('anon', 'public.' || t.tabla, 'select,insert,update,delete,truncate,references,trigger')
          and not has_any_column_privilege('anon', 'public.' || t.tabla, 'select,insert,update,references'))::text,
         'true'
  from (values ('tokens_atajo'), ('movimientos_pendientes')) as t(tabla)

  union all
  -- 6) PUBLIC (todos los roles) no tiene privilegios sobre las tablas
  select 60, 'PUBLIC sin acceso a ' || c.relname,
         (not exists (select 1 from aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a where a.grantee = 0))::text,
         'true'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('tokens_atajo', 'movimientos_pendientes')

  union all
  -- 7) Privilegios de authenticated a nivel tabla: solo SELECT
  select 70, 'authenticated, privilegios de tabla: ' || t.tabla,
         coalesce((select string_agg(pr, ', ' order by pr)
                   from unnest(array['DELETE', 'INSERT', 'REFERENCES', 'SELECT', 'TRIGGER', 'TRUNCATE', 'UPDATE']) pr
                   where has_table_privilege('authenticated', 'public.' || t.tabla, pr)), '(ninguno)'),
         'SELECT'
  from (values ('tokens_atajo'), ('movimientos_pendientes')) as t(tabla)

  union all
  -- 8) tokens_atajo: UPDATE solo en revocado y revocado_en
  select 80, 'authenticated, UPDATE por columna: tokens_atajo',
         coalesce((select string_agg(a.attname, ', ' order by a.attname) from pg_attribute a
                   where a.attrelid = 'public.tokens_atajo'::regclass and a.attnum > 0 and not a.attisdropped
                     and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')), '(ninguna)'),
         'revocado, revocado_en'

  union all
  -- 9) tokens_atajo: INSERT solo en estas columnas
  select 90, 'authenticated, INSERT por columna: tokens_atajo',
         coalesce((select string_agg(a.attname, ', ' order by a.attname) from pg_attribute a
                   where a.attrelid = 'public.tokens_atajo'::regclass and a.attnum > 0 and not a.attisdropped
                     and has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT')), '(ninguna)'),
         'alcance, dispositivo, proyecto_id, token_hash, user_id'

  union all
  -- 10) movimientos_pendientes: UPDATE solo en estas columnas
  select 100, 'authenticated, UPDATE por columna: movimientos_pendientes',
         coalesce((select string_agg(a.attname, ', ' order by a.attname) from pg_attribute a
                   where a.attrelid = 'public.movimientos_pendientes'::regclass and a.attnum > 0 and not a.attisdropped
                     and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')), '(ninguna)'),
         'categoria_final, estado, fila_final, movimiento_id, resuelto_en, resuelto_por'

  union all
  -- 11) movimientos_pendientes: authenticated no puede insertar
  select 110, 'authenticated sin INSERT en movimientos_pendientes',
         (not has_table_privilege('authenticated', 'public.movimientos_pendientes', 'insert')
          and not has_any_column_privilege('authenticated', 'public.movimientos_pendientes', 'insert'))::text,
         'true'

  union all
  -- 12) Funciones: SECURITY DEFINER, search_path fijo
  select 120, 'Función ' || p.proname || ': security definer / search_path',
         p.prosecdef::text || ' / ' || coalesce(array_to_string(p.proconfig, ','), '(sin search_path)'),
         case p.proname when 'consumir_cupo_atajo' then 'true / search_path=public' else 'false / search_path=public' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('consumir_cupo_atajo', 'tokens_atajo_no_desrevocar')

  union all
  -- 13) Funciones: quién puede ejecutarlas (anon / authenticated / PUBLIC / service_role)
  select 130, 'Función ' || p.proname || ': EXECUTE anon / authenticated / PUBLIC / service_role',
         has_function_privilege('anon', p.oid, 'execute')::text || ' / ' ||
         has_function_privilege('authenticated', p.oid, 'execute')::text || ' / ' ||
         coalesce((select bool_or(a.grantee = 0) from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.privilege_type = 'EXECUTE'), false)::text || ' / ' ||
         has_function_privilege('service_role', p.oid, 'execute')::text,
         case p.proname when 'consumir_cupo_atajo' then 'false / false / false / true' else 'false / false / false / false' end
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('consumir_cupo_atajo', 'tokens_atajo_no_desrevocar')

  union all
  -- 14) Trigger que impide reactivar un token revocado
  select 140, 'Trigger en tokens_atajo',
         coalesce((select string_agg(tg.tgname, ', ') from pg_trigger tg where tg.tgrelid = 'public.tokens_atajo'::regclass and not tg.tgisinternal), '(ninguno)'),
         'tokens_atajo_no_desrevocar'

  union all
  -- 15) Restricciones únicas (hash del token y anti-duplicados de propuestas)
  select 150, 'Restricción única: ' || x.conrelid::regclass::text,
         coalesce(string_agg(x.conname, ', ' order by x.conname), '(ninguna)'),
         case when x.conrelid = 'public.tokens_atajo'::regclass then 'tokens_atajo_token_hash_key' else 'movimientos_pendientes_huella_unica' end
  from pg_constraint x
  where x.conrelid in ('public.tokens_atajo'::regclass, 'public.movimientos_pendientes'::regclass) and x.contype = 'u'
  group by x.conrelid

  union all
  -- 16) No se guarda el texto original ni imágenes en movimientos_pendientes
  select 160, 'Columnas de texto original o imagen en movimientos_pendientes',
         (select count(*) from information_schema.columns c
          where c.table_schema = 'public' and c.table_name = 'movimientos_pendientes'
            and c.column_name ~* '(texto|original|raw|imagen|body|contenido)')::text,
         '0'

  union all
  -- 17) (Opcional) la tabla de propuestas está en Realtime para el contador en vivo
  select 170, 'Realtime activo en movimientos_pendientes (opcional)',
         exists (select 1 from pg_publication_tables pt where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = 'movimientos_pendientes')::text,
         'true (si es false, el contador se actualiza al abrir la app)'

) v
order by ord, chequeo;
