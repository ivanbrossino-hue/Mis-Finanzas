// ============================================================
//  Mis Finanzas — Resumen semanal (push automático)
//  La dispara pg_cron una vez por semana (ver nube/10-cron-resumen-semanal.sql).
//  No hay usuario logueado disparándola, así que en vez de un JWT se valida
//  un secreto compartido (header x-cron-secret) — mismo patrón que el
//  WEBHOOK_SECRET del bot de Telegram.
//  Recorre TODOS los proyectos, calcula lo gastado en la semana actual y lo
//  que queda del mes, y le manda un push a cada suscripción del proyecto.
//  Secrets: CRON_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ============================================================
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

function headersServicio(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:ivan@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

// El server corre en UTC pero las fechas guardadas (fecha, mes) son en hora
// local Argentina (UTC-3) — restamos 3hs antes de leer año/mes/día para que
// coincidan con el calendario que usa el celular del usuario.
function ahoraArg(): Date {
  return new Date(Date.now() - 3 * 3600 * 1000);
}
function mesActualKey(): string {
  const d = ahoraArg();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function money(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}
function sumaMonto(arr: any[]): number {
  return (arr || []).reduce((s: number, x: any) => s + (Number(x.monto) || 0), 0);
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  try {
    const proyectosRes = await fetch(`${SB_URL}/rest/v1/proyectos?select=id,data`, { headers: headersServicio() });
    const proyectos = proyectosRes.ok ? await proyectosRes.json() : [];

    const key = mesActualKey();
    const [anioStr, mesStr] = key.split("-");
    const anio = parseInt(anioStr, 10), mesNum = parseInt(mesStr, 10);
    const diasEnMes = new Date(Date.UTC(anio, mesNum, 0)).getUTCDate();
    const nSemanas = Math.ceil(diasEnMes / 7);
    const diaHoy = ahoraArg().getUTCDate();
    // Mismo bucket que serieSemanalDelMes() en el cliente (app.js): bloques
    // fijos de 7 días desde el día 1 del mes, no una ventana móvil de 7 días.
    const semanaHoy = Math.min(nSemanas - 1, Math.floor((diaHoy - 1) / 7));
    let enviados = 0;

    for (const p of proyectos) {
      const mes = p?.data?.meses?.[key];
      if (!mes) continue;

      const movs = mes.movimientos || [];
      const gastoSemana = movs
        .filter((mv: any) => {
          const dia = parseInt(String(mv.fecha || "").split("-")[2], 10);
          if (!dia) return false;
          const w = Math.min(nSemanas - 1, Math.floor((dia - 1) / 7));
          return w === semanaHoy;
        })
        .reduce((s: number, mv: any) => s + (Number(mv.monto) || 0), 0);
      if (gastoSemana <= 0) continue; // nada que contar esta semana en este proyecto

      const ingresos = sumaMonto(mes.ingresos);
      const gastosMes = sumaMonto(mes.gastos);
      // Igual que balanceMes() en el cliente: también se resta lo que ya se
      // pagó de cuotas de deuda este mes (no forma parte de "gastos").
      const deudas = p?.data?.deudas || [];
      const pagos = mes.deudasPagadas || {};
      const cuotasPagadas = deudas.reduce((s: number, d: any) => s + (pagos[d.id] ? (Number(d.cuotaMensual) || 0) : 0), 0);
      const teQueda = ingresos - gastosMes - cuotasPagadas;

      const cuerpo = `Esta semana gastaste ${money(gastoSemana)}. Te quedan ${money(teQueda)} este mes.`;

      const subsRes = await fetch(
        `${SB_URL}/rest/v1/push_subscripciones?proyecto_id=eq.${p.id}&select=id,endpoint,p256dh,auth`,
        { headers: headersServicio() },
      );
      const subs = subsRes.ok ? await subsRes.json() : [];
      if (!subs.length) continue;

      const payload = JSON.stringify({ titulo: "Resumen semanal", cuerpo });

      await Promise.all(subs.map(async (s: any) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          enviados++;
        } catch (e: any) {
          if (e && (e.statusCode === 404 || e.statusCode === 410)) {
            await fetch(`${SB_URL}/rest/v1/push_subscripciones?id=eq.${s.id}`, { method: "DELETE", headers: headersServicio() });
          } else {
            console.error("push falló:", s.id, e);
          }
        }
      }));
    }

    return json({ ok: true, proyectos: proyectos.length, enviados });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
