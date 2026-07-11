// ============================================================
//  Mis Finanzas — Invitar colaborador (Supabase Edge Function)
//  El dueño de un proyecto llama a esto para invitar a alguien por
//  mail. Usa la service_role key (privilegiada) para:
//    1. Verificar que quien llama es realmente el dueño de su proyecto.
//    2. Crear la fila "pendiente" en miembros.
//    3. Mandar el mail de invitación real (vía el sistema de Supabase Auth).
//  Secrets: ninguno nuevo — usa SUPABASE_URL y
//  SUPABASE_SERVICE_ROLE_KEY, que ya se inyectan solos.
// ============================================================

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// La app llama a esto desde el navegador (otro origen), así que necesita
// responder bien el preflight CORS o el fetch queda bloqueado antes de
// siquiera llegar al servidor.
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
    // Quién llama: viene con SU PROPIO token (no la service key) en el header.
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "falta autenticación" }, 401);

    // Validar el token del que llama y sacar su user id.
    const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: "sesión inválida" }, 401);
    const caller = await userRes.json();
    const callerId = caller.id as string;

    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const rol = String(body.rol || "editor");
    if (!email || !["editor", "lector"].includes(rol)) {
      return json({ error: "faltan datos (email y rol válido: editor|lector)" }, 400);
    }

    // Buscar el proyecto donde el que llama es dueño.
    const miembrosRes = await fetch(
      `${SB_URL}/rest/v1/miembros?user_id=eq.${callerId}&rol=eq.dueno&estado=eq.aceptado&select=proyecto_id`,
      { headers: headersServicio() },
    );
    const miembros = await miembrosRes.json();
    if (!miembros[0]) return json({ error: "solo el dueño de un proyecto puede invitar" }, 403);
    const proyectoId = miembros[0].proyecto_id as string;

    if (email === (caller.email || "").toLowerCase()) {
      return json({ error: "no te podés invitar a vos mismo" }, 400);
    }

    // Crear (o reemplazar) la fila pendiente en miembros.
    const upsertRes = await fetch(`${SB_URL}/rest/v1/miembros`, {
      method: "POST",
      headers: headersServicio({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify([{ proyecto_id: proyectoId, email, rol, estado: "pendiente" }]),
    });
    if (!upsertRes.ok) {
      const t = await upsertRes.text();
      return json({ error: "no se pudo crear la invitación", detalle: t }, 500);
    }

    // Mandar el mail de invitación real (Supabase Auth Admin API).
    const inviteRes = await fetch(`${SB_URL}/auth/v1/invite`, {
      method: "POST",
      headers: headersServicio(),
      body: JSON.stringify({
        email,
        data: { invitado_a_proyecto: proyectoId, rol },
      }),
    });
    if (!inviteRes.ok) {
      const t = await inviteRes.text();
      // Si ya existe como usuario (invite falla con "already registered"), no es un
      // error real: esa persona ya tiene cuenta y va a ver la invitación pendiente
      // apenas inicie sesión normalmente.
      if (!/already/i.test(t)) {
        console.error("invite fallo:", inviteRes.status, t);
      }
    }

    return json({ ok: true, proyectoId, email, rol });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
