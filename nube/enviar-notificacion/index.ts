// ============================================================
//  Mis Finanzas — Enviar notificación push (Web Push)
//  La llama la propia app (después de guardar, de pasarse de un
//  presupuesto, etc.) para avisarle a los OTROS miembros del proyecto.
//  Usa service_role para leer las suscripciones (RLS de esa tabla es
//  "cada quien la suya", no "todo el proyecto").
//  Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
// ============================================================
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function headersServicio(extra: Record<string, string> = {}) {
  return { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json", ...extra };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:ivan@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "falta autenticación" }, 401);

    const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: "sesión inválida" }, 401);
    const caller = await userRes.json();

    const body = await req.json().catch(() => ({}));
    const proyectoId = String(body.proyectoId || "").trim();
    const titulo = String(body.titulo || "Mis Finanzas").trim();
    const cuerpo = String(body.cuerpo || "").trim();
    const url = body.url ? String(body.url) : "./";
    const excluirUserId = body.excluirUserId ? String(body.excluirUserId) : caller.id;
    if (!proyectoId) return json({ error: "falta proyectoId" }, 400);

    // Solo un miembro aceptado de ESE proyecto puede disparar avisos ahí.
    const miembroRes = await fetch(
      `${SB_URL}/rest/v1/miembros?proyecto_id=eq.${proyectoId}&user_id=eq.${caller.id}&estado=eq.aceptado&select=id`,
      { headers: headersServicio() },
    );
    const miembros = miembroRes.ok ? await miembroRes.json() : [];
    if (!miembros[0]) return json({ error: "no sos miembro de ese proyecto" }, 403);

    const subsRes = await fetch(
      `${SB_URL}/rest/v1/push_subscripciones?proyecto_id=eq.${proyectoId}&user_id=neq.${excluirUserId}&select=id,endpoint,p256dh,auth`,
      { headers: headersServicio() },
    );
    const subs = subsRes.ok ? await subsRes.json() : [];

    const payload = JSON.stringify({ titulo, cuerpo, url });
    let enviados = 0;
    await Promise.all(subs.map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        enviados++;
      } catch (e: any) {
        // 404/410 = el navegador anuló la suscripción (desinstaló la app, etc.) — la borramos.
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await fetch(`${SB_URL}/rest/v1/push_subscripciones?id=eq.${s.id}`, { method: "DELETE", headers: headersServicio() });
        } else {
          console.error("push falló:", s.id, e);
        }
      }
    }));

    return json({ ok: true, enviados, total: subs.length });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
