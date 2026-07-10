-- ============================================================
--  Actualización para el bot "carrito" (multi-producto + notas)
--  Pegá esto en:  Supabase → SQL Editor → New query → Run
--  (es seguro, solo agrega una columna para la compra en curso)
-- ============================================================

alter table public.pending_bot add column if not exists sesion jsonb not null default '{}';
