-- ============================================================
--  Cerrar la tabla legado `finanzas` y borrar el diagnóstico
--  Antes de correr esto, ya se verificó en el código que NADA activo
--  usa `finanzas`: la app con cuenta de Google (modoCuenta) y el bot de
--  Telegram trabajan solo con `proyectos` / `bot_vinculos`.
--  Lo único que todavía la toca es el modo "nube manual" de la app
--  abierta como archivo local (file://), que queda sin acceso al correr
--  esto (ya estaba desactualizado: el bot no escribe más ahí).
--
--  Qué hace:
--  1. Borra la policy abierta "app puede todo en finanzas" (anon podía
--     leer/escribir todo con solo la URL + clave pública).
--  2. Le saca los permisos de tabla a anon (refuerzo; RLS sigue activo,
--     sin policies = nadie entra salvo service_role).
--  3. Borra debug_mi_uid() (era solo diagnóstico y estaba concedida a anon).
--
--  NO borra la tabla ni su fila 'main': quedan como respaldo de los datos
--  viejos. Si ya no la querés: drop table public.finanzas;
--  Es seguro correrlo más de una vez. Pegar en: Supabase → SQL Editor → Run.
-- ============================================================

drop policy if exists "app puede todo en finanzas" on public.finanzas;

revoke all on public.finanzas from anon;

drop function if exists public.debug_mi_uid();

-- Verificación (opcional): no debería devolver ninguna fila para anon.
-- select policyname, roles from pg_policies where tablename = 'finanzas' and schemaname = 'public';
