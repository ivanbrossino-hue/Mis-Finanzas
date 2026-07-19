-- ============================================================
--  Resumen semanal por push — corre solo, una vez por semana, sin
--  que nadie tenga la app abierta. pg_cron y pg_net vienen incluidas
--  gratis en el plan Free de Supabase (son extensiones de Postgres,
--  no un servicio aparte).
--
--  IMPORTANTE antes de correr esto:
--  1. Reemplazá 'REEMPLAZAR_CON_UN_SECRETO_PROPIO' por una palabra
--     secreta inventada por vos (cualquier texto largo al azar).
--  2. Cargá esa MISMA palabra como secreto de la Edge Function
--     `resumen-semanal` con el nombre CRON_SECRET (Edge Functions →
--     esa función → Secrets). Así nadie más puede disparar el cron
--     pegándole a la URL de la función a mano.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Domingos 23:00 UTC = domingo 20:00 hora Argentina. Para cambiar el
-- día/hora, ajustá el patrón cron (siempre en UTC): "minuto hora * * día"
-- (día: 0=domingo … 6=sábado).
select cron.schedule(
  'resumen-semanal-mis-finanzas',
  '0 23 * * 0',
  $$
  select net.http_post(
    url := 'https://iivjrpfkwkxgxzgyzrvq.supabase.co/functions/v1/resumen-semanal',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'REEMPLAZAR_CON_UN_SECRETO_PROPIO'),
    body := '{}'::jsonb
  );
  $$
);

-- Para borrar el cron job si en algún momento hace falta:
-- select cron.unschedule('resumen-semanal-mis-finanzas');
