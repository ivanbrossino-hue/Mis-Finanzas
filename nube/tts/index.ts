// ============================================================
//  Mis Finanzas — Voz del asistente (texto a voz con ElevenLabs)
//  La llama la app (movil/asistente.js) con {texto, voz} y devuelve audio/mpeg
//  en streaming. Valida el JWT del usuario igual que chat-ia.
//  Secrets: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_1, ELEVENLABS_VOICE_2,
//           ELEVENLABS_MODEL (opcional, por defecto eleven_flash_v2_5)
//  Deploy con verify_jwt ACTIVADO (es el valor por defecto del CLI).
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
const VOCES: Record<string, string> = {
  "1": Deno.env.get("ELEVENLABS_VOICE_1") ?? "",
  "2": Deno.env.get("ELEVENLABS_VOICE_2") ?? "",
};
const MODELO = Deno.env.get("ELEVENLABS_MODEL") || "eleven_flash_v2_5";
// Cada pedido es una frase corta; el tope protege los créditos si alguien manda un texto enorme
const MAX_CARACTERES = 500;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Expose-Headers": "x-caracteres",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    // Misma validación que chat-ia: el token tiene que ser de un usuario real de la app
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "falta autenticación" }, 401);
    const userRes = await fetch(`${SB_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: "sesión inválida" }, 401);

    if (!ELEVENLABS_API_KEY) return json({ error: "la voz no está configurada (falta ELEVENLABS_API_KEY)", code: "config" }, 500);

    const body = await req.json().catch(() => ({}));
    const texto = String(body.texto || "").replace(/\s+/g, " ").trim();
    const voz = String(body.voz || "1");
    if (!texto) return json({ error: "falta texto" }, 400);
    if (texto.length > MAX_CARACTERES) return json({ error: `el texto es muy largo (máximo ${MAX_CARACTERES} caracteres)`, code: "largo" }, 413);
    const voiceId = VOCES[voz];
    if (!voiceId) return json({ error: "voz inválida o sin configurar", code: "config" }, 400);

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify({ text: texto, model_id: MODELO, language_code: "es" }),
      },
    );

    if (!upstream.ok || !upstream.body) {
      const detalle = await upstream.text().catch(() => "");
      console.error("ElevenLabs error:", upstream.status, detalle);
      // Sin créditos o límite de uso: el cliente cambia a la voz del navegador
      const sinCuota = upstream.status === 429 || /quota|limit/i.test(detalle);
      return json({ error: "no pude generar la voz", code: sinCuota ? "quota" : "upstream" }, sinCuota ? 429 : 502);
    }

    // El audio se reenvía tal cual llega (streaming): el cliente empieza a reproducir sin esperar todo
    return new Response(upstream.body, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store", "x-caracteres": String(texto.length), ...CORS_HEADERS },
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
