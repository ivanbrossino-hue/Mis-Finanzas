// ============================================================
//  Mis Finanzas — Lectura de tickets de compra (OCR con IA)
//  La llama la app cuando el usuario saca/sube una foto de un ticket en el
//  modal de "Agregar gasto". Le manda la foto (base64) a un modelo de visión
//  de NVIDIA NIM (la misma cuenta/API key que ya usa el asistente de chat) y
//  devuelve los datos ya interpretados: comercio, monto, fecha y una
//  categoría sugerida — el cliente los usa para RELLENAR el formulario, el
//  usuario siempre revisa/confirma antes de guardar nada.
//  Secrets: NVIDIA_API_KEY (la misma que usa nube/chat-ia)
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") ?? "";
// Modelo de visión de NVIDIA NIM. Si build.nvidia.com renombra/retira este
// modelo en algún momento, cambiar solo esta constante.
const NVIDIA_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";

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

function systemPrompt(): string {
  const listaCategorias = Object.entries(CATEGORIAS).map(([id, nombre]) => `${id} (${nombre})`).join(", ");
  return [
    "Sos un lector de tickets de compra argentinos. Te mandan la foto de un ticket/factura y tenés que sacar",
    "los datos, SOLO a partir de lo que realmente se lee en la imagen — nunca inventes ni completes un dato que",
    "no se distingue con claridad.",
    "\"comercio\": el nombre del negocio/supermercado tal como figura en el ticket (ej. \"Coto\", \"Carrefour Express\").",
    "\"monto\": el TOTAL final pagado (el número más grande que diga \"TOTAL\", no un subtotal ni un solo ítem).",
    "Es un número entero en pesos argentinos, SIN decimales ni puntos de miles (si el ticket dice $ 2.538,00 el",
    "monto es 2538, redondeando los centavos).",
    "\"fecha\": la fecha del ticket en formato YYYY-MM-DD si se lee con claridad, o null si no se distingue.",
    `\"categoria\": tu mejor estimación de a cuál de estas categorías pertenece la compra, usando el id: ${listaCategorias}.`,
    "Si el comercio es un supermercado o almacén, normalmente es \"alimentacion\"; si es una farmacia, \"salud\"; una",
    "estación de servicio, \"transporte\"; etc. Si no podés estimarla con algo de confianza, null.",
    "\"nota\": un concepto corto (2-4 palabras) para identificar la compra, ej. \"Super Coto\" o \"Farmacia\".",
    "Si la imagen NO es un ticket de compra legible (está borrosa, cortada, o es otra cosa), poné \"comercio\": null",
    "y \"monto\": null — es preferible admitir que no se pudo leer a inventar cualquier dato.",
    'Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:',
    '{ "comercio": "texto o null", "monto": 1234, "fecha": "YYYY-MM-DD" o null, "categoria": "id o null", "nota": "texto corto" }',
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

    if (!NVIDIA_API_KEY) return json({ error: "el escaneo no está configurado (falta NVIDIA_API_KEY)" }, 500);

    const body = await req.json().catch(() => ({}));
    const imagenBase64 = String(body.imagenBase64 || "");
    if (!imagenBase64.startsWith("data:image/")) return json({ error: "falta la imagen" }, 400);

    const iaRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: NVIDIA_VISION_MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: systemPrompt() },
              { type: "image_url", image_url: { url: imagenBase64 } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
    });
    if (!iaRes.ok) {
      const detalle = await iaRes.text().catch(() => "");
      console.error("NVIDIA vision API error:", iaRes.status, detalle);
      return json({ error: "no pude leer el ticket ahora" }, 502);
    }
    const iaData = await iaRes.json();
    const contenido = iaData?.choices?.[0]?.message?.content || "";
    const parsed = extraerJson(contenido);
    if (!parsed) return json({ error: "no pude interpretar el ticket, completá los datos a mano" }, 200);

    const comercio = (typeof parsed.comercio === "string" && parsed.comercio.trim()) ? parsed.comercio.trim().slice(0, 60) : null;
    const monto = (Number(parsed.monto) > 0) ? Math.round(Number(parsed.monto)) : null;
    const fecha = (typeof parsed.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) ? parsed.fecha : null;
    const categoria = (typeof parsed.categoria === "string" && CATEGORIAS[parsed.categoria]) ? parsed.categoria : null;
    const nota = (typeof parsed.nota === "string" && parsed.nota.trim()) ? parsed.nota.trim().slice(0, 60) : comercio;

    if (!monto) return json({ error: "no pude distinguir el total del ticket, completá los datos a mano" }, 200);

    return json({ comercio, monto, fecha, categoria, nota });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
