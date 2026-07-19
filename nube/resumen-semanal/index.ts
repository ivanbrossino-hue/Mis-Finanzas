// ============================================================
//  Mis Finanzas — Resumen semanal (push automático)
//  La dispara pg_cron una vez por semana (ver nube/10-cron-resumen-semanal.sql).
//  No hay usuario logueado disparándola, así que en vez de un JWT se valida
//  un secreto compartido (header x-cron-secret) — mismo patrón que el
//  WEBHOOK_SECRET del bot de Telegram.
//  Recorre TODOS los proyectos, calcula lo gastado en los últimos 7 días y
//  lo que queda del mes, y le manda un push a cada suscripción del proyecto.
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

function mesActualKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function money(n: number): string {
  return "$ " + Math.round(n).toLocaleString("es-AR");
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return json({ error: "forbidden" }, 403);
  }

  try {
    const proyectosRes = await fetch(`${SB_URL}/rest/v1/proyectos?select=id,data`, { headers: headersServicio() });
    const proyectos = proyectosRes.ok ? await proyectosRes.json() : [];

    const key = mesActualKey();
    const haceUnaSemana = Date.now() - 7 * 24 * 3600 * 1000;
    let enviados = 0;

    for (const p of proyectos) {
      const mes = p?.data?.meses?.[key];
      if (!mes) continue;

      const movs = mes.movimientos || [];
      const gastoSemana = movs
        .filter((mv: any) => {
          const t = new Date(mv.fecha + "T00:00:00Z").getTime();
          return !isNaN(t) && t >= haceUnaSemana;
        })
        .reduce((s: number, mv: any) => s + (Number(mv.monto) || 0), 0);
      if (gastoSemana <= 0) continue; // nada que contar esta semana en este proyecto

      const ingresos = (mes.ingresos || []).reduce((s: number, i: any) => s + (Number(i.monto) || 0), 0);
      const gastosMes = (mes.gastos || []).reduce((s: number, g: any) => s + (Number(g.monto) || 0), 0);
      const teQueda = ingresos - gastosMes;

      const subsRes = await fetch(
        `${SB_URL}/rest/v1/push_subscripciones?proyecto_id=eq.${p.id}&select=id,endpoint,p256dh,auth`,
        { headers: headersServicio() },
      );
      const subs = subsRes.ok ? await subsRes.json() : [];
      if (!subs.length) continue;

      const payload = JSON.stringify({
        titulo: "Resumen semanal",
        cuerpo: `Esta semana gastaste ${money(gastoSemana)}. Te quedan ${money(teQueda)} este mes.`,
      });

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
