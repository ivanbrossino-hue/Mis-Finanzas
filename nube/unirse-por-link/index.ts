// ============================================================
//  Mis Finanzas — Unirse a un proyecto por link de invitación
//  Quien abre el link elige su propia cuenta de Google (no hace falta
//  que el dueño sepa de antemano con qué mail se va a loguear) y esta
//  función lo suma como miembro del proyecto con el rol que el dueño
//  eligió al generar el link. Usa la service_role key porque el que
//  llama todavía no es miembro de nada (no tiene permisos propios).
//  Secrets: ninguno nuevo — usa SUPABASE_URL y
//  SUPABASE_SERVICE_ROLE_KEY, que ya se inyectan solos.
// ============================================================

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
    const inviteToken = String(body.token || "").trim();
    if (!inviteToken) return json({ error: "falta el token de invitación" }, 400);

    // Buscar el link (todavía no usado).
    const linkRes = await fetch(
      `${SB_URL}/rest/v1/invitaciones_link?token=eq.${encodeURIComponent(inviteToken)}&usado_por=is.null&select=proyecto_id,rol,expira_en`,
      { headers: headersServicio() },
    );
    if (!linkRes.ok) return json({ error: "no se pudo validar el link" }, 500);
    const links = await linkRes.json();
    const link = links[0];
    if (!link) return json({ error: "el link de invitación no es válido o ya se usó" }, 404);
    if (new Date(link.expira_en).getTime() < Date.now()) {
      return json({ error: "el link de invitación venció" }, 410);
    }

    // Sumarlo como miembro del proyecto con el rol que definió el dueño.
    const miembroRes = await fetch(`${SB_URL}/rest/v1/miembros`, {
      method: "POST",
      headers: headersServicio({ Prefer: "return=representation" }),
      body: JSON.stringify([{
        proyecto_id: link.proyecto_id,
        user_id: caller.id,
        email: (caller.email || "").toLowerCase(),
        rol: link.rol,
        estado: "aceptado",
      }]),
    });
    if (!miembroRes.ok) {
      const t = await miembroRes.text();
      // El esquema solo permite un proyecto por usuario (unique en user_id).
      if (/duplicate key|unique/i.test(t)) {
        return json({ error: "esa cuenta de Google ya pertenece a otro proyecto de Mis Finanzas" }, 409);
      }
      return json({ error: "no se pudo sumar al proyecto", detalle: t }, 500);
    }

    // Marcar el link como usado para que no se pueda volver a canjear.
    await fetch(`${SB_URL}/rest/v1/invitaciones_link?token=eq.${encodeURIComponent(inviteToken)}`, {
      method: "PATCH",
      headers: headersServicio(),
      body: JSON.stringify({ usado_por: caller.id }),
    });

    return json({ ok: true, proyectoId: link.proyecto_id, rol: link.rol });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
