// ============================================================
//  Mis Finanzas — Asistente de chat (IA)
//  La llama la app desde la burbuja de chat. Le manda el mensaje del
//  usuario + el historial de la conversación + un resumen de sus datos
//  financieros (armado por el cliente), y la IA responde en un JSON con
//  dos partes: el texto para mostrar en el chat, y (si corresponde) los
//  gastos que hay que registrar — el REGISTRO en sí lo hace el cliente
//  con registrarCompra(), esta función nunca toca la tabla de proyectos.
//  Modelo: NVIDIA NIM (API gratuita, compatible con OpenAI), build.nvidia.com
//  Secrets: NVIDIA_API_KEY
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") ?? "";
const NVIDIA_MODEL = "meta/llama-3.1-70b-instruct";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

const CATEGORIAS: Record<string, string> = {
  vivienda: "Vivienda", trabajo: "Trabajo", alimentacion: "Alimentación", transporte: "Transporte",
  salud: "Salud", educacion: "Educación", mascota: "Mascota", entretenimiento: "Entretenimiento",
  ropa: "Ropa / Personal", seguros: "Seguros / Imprevistos", ahorro: "Ahorro e Inversión",
};

function systemPrompt(contexto: unknown): string {
  const listaCategorias = Object.entries(CATEGORIAS).map(([id, nombre]) => `${id} (${nombre})`).join(", ");
  return [
    "Sos el asistente financiero personal de la app \"Mis Finanzas\", en español rioplatense, tono cercano y breve.",
    "Tenés dos trabajos: (1) responder preguntas sobre las finanzas del usuario usando SOLO los datos del CONTEXTO de abajo, sin inventar números; ",
    "(2) cuando el usuario te cuenta que hizo una compra o gasto (ej. \"gasté 5000 en nafta\", \"compré pan 1500 y coca 3000\"), identificarlo para anotarlo.",
    `Categorías válidas (usá SIEMPRE el id, nunca el nombre): ${listaCategorias}.`,
    "CONTEXTO (datos financieros reales del usuario, en pesos argentinos):",
    JSON.stringify(contexto),
    "",
    "Respondé ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después, sin markdown), con esta forma exacta:",
    '{ "respuesta": "texto para mostrarle al usuario en el chat", "registrar": [ { "categoria": "id válido", "monto": 1234, "nota": "concepto corto" } ] }',
    '"registrar" tiene que ser [] si el usuario solo preguntó algo y no te contó un gasto nuevo para anotar.',
    "Si te cuenta varias compras en el mismo mensaje, agregá un ítem por cada una. \"monto\" siempre un número, sin signos ni puntos de miles.",
    "Si preguntó algo que no podés responder con el contexto que tenés, decilo con honestidad en vez de inventar.",
  ].join("\n");
}

function extraerJson(texto: string): any {
  try { return JSON.parse(texto); } catch { /* sigue abajo */ }
  const m = texto.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nada más para intentar */ } }
  return null;
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

    if (!NVIDIA_API_KEY) return json({ error: "el asistente no está configurado (falta NVIDIA_API_KEY)" }, 500);

    const body = await req.json().catch(() => ({}));
    const mensaje = String(body.mensaje || "").trim();
    const historial = Array.isArray(body.historial) ? body.historial : [];
    const contexto = body.contexto || {};
    if (!mensaje) return json({ error: "falta mensaje" }, 400);

    const messages = [
      { role: "system", content: systemPrompt(contexto) },
      ...historial.slice(-10).map((h: any) => ({
        role: h.rol === "assistant" ? "assistant" : "user",
        content: String(h.texto || ""),
      })),
      { role: "user", content: mensaje },
    ];

    const iaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: NVIDIA_MODEL, messages, temperature: 0.2, top_p: 0.7, max_tokens: 600 }),
    });
    if (!iaRes.ok) {
      const detalle = await iaRes.text().catch(() => "");
      console.error("NVIDIA API error:", iaRes.status, detalle);
      return json({ error: "el asistente no pudo responder ahora" }, 502);
    }
    const iaData = await iaRes.json();
    const contenido = iaData?.choices?.[0]?.message?.content || "";
    const parsed = extraerJson(contenido);

    if (!parsed || typeof parsed.respuesta !== "string") {
      // La IA no devolvió el JSON esperado — al menos mostramos el texto crudo.
      return json({ respuesta: contenido || "No entendí bien, ¿podés reformular?", registrar: [] });
    }

    const registrar = Array.isArray(parsed.registrar)
      ? parsed.registrar
          .filter((it: any) => it && CATEGORIAS[it.categoria] && Number(it.monto) > 0)
          .map((it: any) => ({ categoria: it.categoria, monto: Number(it.monto), nota: it.nota ? String(it.nota).slice(0, 80) : null }))
      : [];

    return json({ respuesta: parsed.respuesta, registrar });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
