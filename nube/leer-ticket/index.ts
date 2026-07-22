// ============================================================
//  Mis Finanzas — Lectura de tickets de compra
//  La llama la app desde el modal de "Agregar gasto" (foto del ticket) y
//  desde el escáner de QR de la barra de abajo. Dos maneras de leer un
//  ticket:
//   (a) imagenBase64: una foto -> un modelo de VISIÓN de NVIDIA NIM interpreta
//       comercio/monto/fecha/categoría/artículos.
//   (b) ticketUrl: la URL que trae el QR de un "ticket digital" (algunos
//       comercios, ademas del QR fiscal de AFIP, imprimen su PROPIO QR que
//       lleva a una pagina con el detalle completo de la compra). Si es de
//       Coto la interpretamos con un parser exacto (deterministico, sin IA,
//       ya probado contra una pagina real). Para cualquier otro comercio no
//       tenemos el formato confirmado todavia, asi que se lo pasamos de
//       respaldo a un modelo de TEXTO para que intente sacar los datos.
//  En los dos casos, el cliente SOLO usa la respuesta para rellenar el
//  formulario — el usuario siempre revisa/confirma antes de guardar nada.
//  Secrets: NVIDIA_API_KEY (la misma que usa nube/chat-ia)
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") ?? "";
// Modelos de NVIDIA NIM. Si build.nvidia.com renombra/retira alguno, cambiar
// solo estas constantes.
const NVIDIA_VISION_MODEL = "meta/llama-3.2-11b-vision-instruct";
const NVIDIA_TEXT_MODEL = "meta/llama-3.1-8b-instruct";

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
const listaCategorias = Object.entries(CATEGORIAS).map(([id, nombre]) => `${id} (${nombre})`).join(", ");

function systemPromptFoto(): string {
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
    "\"nota\": los artículos comprados, separados por coma, para poder identificar la compra de un vistazo",
    "(ej. \"Fideos, Aceite, Yerba, Pan\"). Si el ticket tiene muchos ítems, listá los 4 o 5 más caros/importantes",
    "y agregá \"y otros\" al final. Si no se distinguen los artículos con claridad, poné el nombre del comercio",
    "en su lugar (ej. \"Super Coto\").",
    "Si la imagen NO es un ticket de compra legible (está borrosa, cortada, o es otra cosa), poné \"comercio\": null",
    "y \"monto\": null — es preferible admitir que no se pudo leer a inventar cualquier dato.",
    'Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:',
    '{ "comercio": "texto o null", "monto": 1234, "fecha": "YYYY-MM-DD" o null, "categoria": "id o null", "nota": "texto corto" }',
  ].join("\n");
}

// Respaldo para cuando el QR de un ticket lleva a la página de un comercio
// cuyo formato todavía no tenemos confirmado (a diferencia de Coto, que ya
// tiene su propio parser exacto más abajo).
function systemPromptPagina(texto: string): string {
  return [
    "Sos un lector de tickets de compra argentinos. Te paso el TEXTO de una página web de un comercio, a la que se",
    "llega escaneando el QR de un ticket físico — debería mostrar el detalle de esa compra (comercio, fecha, total,",
    "artículos). Sacá los datos SOLO de lo que realmente está en ese texto, nunca inventes ni completes un dato",
    "que no se distingue con claridad.",
    "\"comercio\": el nombre del negocio tal como figura en la página.",
    "\"monto\": el TOTAL final pagado, número entero en pesos argentinos sin decimales ni puntos de miles.",
    "\"fecha\": en formato YYYY-MM-DD si se distingue, o null.",
    `\"categoria\": tu mejor estimación usando el id: ${listaCategorias}. Null si no podés estimarla.`,
    "\"nota\": los artículos comprados separados por coma (los 4-5 más importantes si hay muchos, agregando",
    "\"y otros\"). Si no se distinguen, el nombre del comercio.",
    "Si el texto NO parece ser el detalle de un ticket de compra (la página no tiene esa información), poné",
    "\"comercio\": null y \"monto\": null — preferible admitir que no se pudo leer a inventar cualquier dato.",
    'Respondé ÚNICAMENTE con un objeto JSON válido, sin texto antes ni después, con esta forma exacta:',
    '{ "comercio": "texto o null", "monto": 1234, "fecha": "YYYY-MM-DD" o null, "categoria": "id o null", "nota": "texto corto" }',
    "TEXTO DE LA PÁGINA:",
    texto,
  ].join("\n");
}

function extraerJson(texto: string): any {
  try { return JSON.parse(texto); } catch { /* sigue abajo */ }
  const m = texto.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nada más para intentar */ } }
  return null;
}

async function llamarNvidia(model: string, messages: unknown, maxTokens = 300): Promise<string | null> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0.1, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    console.error("NVIDIA API error:", res.status, detalle);
    return null;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// ---- Ayudantes para el parser de páginas de "ticket digital" ----

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)));
}

// "$29.680,01" (formato argentino) -> 29680
function pesosDesdeTexto(s: string): number | null {
  const limpio = s.replace(/[^\d.,]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpio);
  return n > 0 ? Math.round(n) : null;
}

function htmlATexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
}

// Parser exacto para la página "TicketMobile" de Coto (probado contra una
// página real). Sin IA — más rápido, gratis y sin riesgo de inventar datos.
function parsearTicketCoto(html: string): { comercio: string; monto: number | null; fecha: string | null; categoria: string; nota: string } | null {
  const mTotal = html.match(/text-left">TOTAL<\/span>\s*<span[^>]*>\$([\d.,]+)</);
  const monto = mTotal ? pesosDesdeTexto(mTotal[1]) : null;

  const mFecha = html.match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{2})/);
  const fecha = mFecha ? `20${mFecha[3]}-${mFecha[2]}-${mFecha[1]}` : null;

  const items: string[] = [];
  const reItem = /info-producto-h2">([^<]+)<\/h2>/g;
  let m: RegExpExecArray | null;
  while ((m = reItem.exec(html))) items.push(decodeEntities(m[1]).trim().replace(/\s+/g, " "));

  if (!monto && items.length === 0) return null; // no tiene pinta de ser esta página

  let nota = items.length ? items.slice(0, 5).join(", ") : "Super Coto";
  if (items.length > 5) nota += " y otros";

  return { comercio: "Coto", monto, fecha, categoria: "alimentacion", nota: nota.slice(0, 60) };
}

// Bloquea URLs que no sean http/https o que apunten a direcciones internas —
// esta función recibe URLs sacadas de un QR escaneado por el usuario (dato
// no confiable), así que más vale prevenir un intento de SSRF.
function urlEsSegura(u: URL): boolean {
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local")) return false;
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 127 || a === 10 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      return false;
    }
  }
  return true;
}

// Valida/normaliza lo que haya devuelto la IA (o el parser de Coto) a la
// forma final que espera el cliente.
function armarRespuesta(parsed: any) {
  const comercio = (typeof parsed?.comercio === "string" && parsed.comercio.trim()) ? parsed.comercio.trim().slice(0, 60) : null;
  const monto = (Number(parsed?.monto) > 0) ? Math.round(Number(parsed.monto)) : null;
  const fecha = (typeof parsed?.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.fecha)) ? parsed.fecha : null;
  const categoria = (typeof parsed?.categoria === "string" && CATEGORIAS[parsed.categoria]) ? parsed.categoria : null;
  const nota = (typeof parsed?.nota === "string" && parsed.nota.trim()) ? parsed.nota.trim().slice(0, 60) : comercio;
  return { comercio, monto, fecha, categoria, nota };
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

    const body = await req.json().catch(() => ({}));
    const imagenBase64 = String(body.imagenBase64 || "");
    const ticketUrlRaw = String(body.ticketUrl || "");
    let parsed: any = null;

    if (ticketUrlRaw) {
      // ---- QR que lleva a la página de "ticket digital" de un comercio ----
      let url: URL;
      try { url = new URL(ticketUrlRaw); } catch { return json({ error: "ese código no tiene una dirección web válida" }, 200); }
      if (!urlEsSegura(url)) return json({ error: "esa dirección no se puede consultar" }, 400);

      let html = "";
      try {
        const pageRes = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
        if (!pageRes.ok) return json({ error: "no pude abrir la página del ticket" }, 200);
        html = await pageRes.text();
      } catch (e) {
        console.error("fetch ticketUrl error:", e);
        return json({ error: "no pude abrir la página del ticket" }, 200);
      }

      if (/(^|\.)coto\.com\.ar$/i.test(url.hostname) && /TicketMobile\/Ticket\//i.test(url.pathname)) {
        parsed = parsearTicketCoto(html);
        if (!parsed) return json({ error: "no pude interpretar el ticket de Coto, completá a mano" }, 200);
      } else {
        // Comercio sin parser propio todavía: intento de respaldo con IA de texto.
        if (!NVIDIA_API_KEY) return json({ error: "no reconozco el formato de este ticket" }, 200);
        const contenido = await llamarNvidia(NVIDIA_TEXT_MODEL, [
          { role: "system", content: systemPromptPagina(htmlATexto(html)) },
        ]);
        parsed = contenido && extraerJson(contenido);
        if (!parsed) return json({ error: "no pude interpretar esta página de ticket, completá a mano" }, 200);
      }
    } else if (imagenBase64.startsWith("data:image/")) {
      // ---- Foto del ticket -> IA de visión ----
      if (!NVIDIA_API_KEY) return json({ error: "el escaneo no está configurado (falta NVIDIA_API_KEY)" }, 500);
      const contenido = await llamarNvidia(NVIDIA_VISION_MODEL, [
        {
          role: "user",
          content: [
            { type: "text", text: systemPromptFoto() },
            { type: "image_url", image_url: { url: imagenBase64 } },
          ],
        },
      ]);
      if (contenido === null) return json({ error: "no pude leer el ticket ahora" }, 502);
      parsed = extraerJson(contenido);
      if (!parsed) return json({ error: "no pude interpretar el ticket, completá los datos a mano" }, 200);
    } else {
      return json({ error: "falta la imagen o la URL del ticket" }, 400);
    }

    const respuesta = armarRespuesta(parsed);
    if (!respuesta.monto) return json({ error: "no pude distinguir el total del ticket, completá los datos a mano" }, 200);
    return json(respuesta);
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
