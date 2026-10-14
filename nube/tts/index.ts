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
// Los secretos se limpian por si se pegaron con espacios, saltos de línea o comillas
const limpiar = (v: string | undefined) => (v ?? "").replace(/["'\s]/g, "");
const ELEVENLABS_API_KEY = limpiar(Deno.env.get("ELEVENLABS_API_KEY"));
const VOCES: Record<string, string> = {
  "1": limpiar(Deno.env.get("ELEVENLABS_VOICE_1")),
  "2": limpiar(Deno.env.get("ELEVENLABS_VOICE_2")),
};
const MODELO = limpiar(Deno.env.get("ELEVENLABS_MODEL")) || "eleven_flash_v2_5";
// Expresividad (se pueden cambiar con secretos, sin tocar código):
//  ELEVENLABS_STABILITY  0 a 1  (más bajo = más variación de tono y emoción; más alto = más monótona). Por defecto 0.4
//  ELEVENLABS_SIMILARITY 0 a 1  (parecido a la voz original). Por defecto 0.8
//  ELEVENLABS_STYLE      0 a 1  (exageración del estilo; solo lo usan los modelos multilingual/v3). Por defecto 0.3
//  ELEVENLABS_SPEED      0.7 a 1.2  (velocidad). Por defecto 1.0
const num = (v: string | undefined, def: number, min: number, max: number) => {
  const n = parseFloat(limpiar(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const ESTABILIDAD = num(Deno.env.get("ELEVENLABS_STABILITY"), 0.4, 0, 1);
const SIMILITUD = num(Deno.env.get("ELEVENLABS_SIMILARITY"), 0.8, 0, 1);
const ESTILO = num(Deno.env.get("ELEVENLABS_STYLE"), 0.3, 0, 1);
const VELOCIDAD = num(Deno.env.get("ELEVENLABS_SPEED"), 1.0, 0.7, 1.2);
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

    // Texto de la frase anterior y de la siguiente: ElevenLabs lo usa para que la entonación fluya entre frases pedidas por separado
    const contiguo = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    const anterior = contiguo(body.anterior), siguiente = contiguo(body.siguiente);
    const voiceSettings: Record<string, unknown> = {
      stability: ESTABILIDAD, similarity_boost: SIMILITUD, use_speaker_boost: true, speed: VELOCIDAD,
    };
    if (/multilingual|v3/i.test(MODELO)) voiceSettings.style = ESTILO; // flash/turbo no soportan "style"
    const pedido = (completo: boolean) => fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: { "xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify(completo
          ? {
            text: texto, model_id: MODELO, language_code: "es", voice_settings: voiceSettings,
            ...(anterior ? { previous_text: anterior } : {}), ...(siguiente ? { next_text: siguiente } : {}),
          }
          : { text: texto, model_id: MODELO, language_code: "es" }),
      },
    );
    let upstream = await pedido(true);
    // Si ElevenLabs rechaza algún ajuste (400/422: parámetro no soportado por este modelo), se reintenta sin ajustes
    if (upstream.status === 400 || upstream.status === 422) {
      console.error("ElevenLabs rechazó los ajustes:", upstream.status, await upstream.text().catch(() => ""));
      upstream = await pedido(false);
    }

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
