-- ============================================================
--  OPCIONAL — "Exigir rev = anterior + 1" en proyectos   (NO está aplicado; no hace falta para que funcione el registro rápido)
--
--  Qué hace: una red de seguridad en la base. Si alguien intenta CAMBIAR proyectos.data sin que el nuevo `rev` sea
--  exactamente el anterior + 1, el UPDATE se rechaza (error 40001). Así ningún escritor viejo o a ciegas puede pisar datos
--  de otro: lo peor que le pasa es que su guardado falla (y se entera) en vez de borrar lo ajeno.
--
--  Antes de aplicarlo, tienen que cumplirse TODAS estas condiciones (si no, alguien recibe errores que antes eran silenciosos):
--    1. El bot de Telegram nuevo está deployado (escritura condicional por rev con reintentos y aviso "no se guardó").
--    2. Los celulares y la PC corren la app nueva (Ajustes → "Versión 46 · sincronización segura activa" o superior).
--       Una app vieja que quede abierta, con datos viejos, dejaría de poder guardar (le sale error en vez de pisar).
--    3. Nadie usa la versión de escritorio de la raíz con Google (ahora redirige a /movil/).
--    4. Se hizo un respaldo (Ajustes → Respaldar y export de proyectos).
--
--  Qué NO afecta: los INSERT (crear proyecto), los UPDATE que no cambian `data` (por ejemplo solo updated_by) y los DELETE.
--  Un cambio manual de `data` desde el SQL Editor tiene que subir `rev` en 1 (o desactivar el trigger un momento, ver abajo).
-- ============================================================

create or replace function public.proyectos_exigir_rev()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.data is distinct from old.data and new.rev is distinct from old.rev + 1 then
    raise exception 'conflicto de rev: se esperaba % y llegó %', old.rev + 1, new.rev
      using errcode = '40001', hint = 'Volvé a leer el proyecto y reaplicá el cambio.';
  end if;
  return new;
end $$;

revoke all on function public.proyectos_exigir_rev() from public, anon, authenticated;   -- el trigger dispara igual

drop trigger if exists proyectos_exigir_rev on public.proyectos;
create trigger proyectos_exigir_rev before update on public.proyectos
  for each row execute function public.proyectos_exigir_rev();

-- Verificación (solo lectura): tiene que devolver una fila con el trigger habilitado ('O')
--   select tgname, tgenabled from pg_trigger where tgrelid = 'public.proyectos'::regclass and not tgisinternal;

-- ============================================================
--  CÓMO APAGARLO (copiar y correr; no borra ningún dato)
--
--    drop trigger if exists proyectos_exigir_rev on public.proyectos;
--    drop function if exists public.proyectos_exigir_rev();
--
--  Para una corrección manual puntual sin apagarlo del todo (en una sola transacción):
--    begin;
--      alter table public.proyectos disable trigger proyectos_exigir_rev;
--      -- update public.proyectos set data = '...' where id = '...';
--      alter table public.proyectos enable trigger proyectos_exigir_rev;
--    commit;
-- ============================================================
