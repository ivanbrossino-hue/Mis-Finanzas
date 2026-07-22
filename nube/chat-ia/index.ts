// ============================================================
//  Mis Finanzas — Asistente de chat (IA)
//  La llama la app desde la burbuja de chat. Le manda el mensaje del
//  usuario + el historial de la conversación + un resumen de sus datos
//  financieros (armado por el cliente), y la IA responde en un JSON con
//  dos partes: el texto para mostrar en el chat, y (si corresponde) los
//  gastos que hay que registrar — el REGISTRO en sí lo hace el cliente
//  con registrarCompra(), esta función nunca toca la tabla de proyectos.
//  Modelo: NVIDIA NIM (API gratuita, compatible con OpenAI), build.nvidia.com
//  Secrets: NVIDIA_API_KEY, TAVILY_API_KEY (opcional — sin ella el asistente
//  sigue funcionando, solo no puede buscar promociones/descuentos reales)
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") ?? "";
const NVIDIA_MODEL = "meta/llama-3.1-8b-instruct";
// Búsqueda web real para preguntas de promociones/descuentos (Tavily, tiene nivel
// gratuito). Si no está configurada, el asistente sigue funcionando normal, solo
// que no puede buscar nada en internet — avisa con honestidad en vez de inventar.
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") ?? "";

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
    "Sos el asistente financiero personal de la app \"Mis Finanzas\", en español rioplatense, tono cercano y conversador.",
    "Tenés dos trabajos: (1) responder preguntas sobre las finanzas del usuario usando SOLO los datos del CONTEXTO de abajo, sin inventar números; ",
    "(2) cuando el usuario te cuenta que hizo una compra o gasto (ej. \"gasté 5000 en nafta\", \"compré pan 1500 y coca 3000\"), identificarlo para anotarlo.",
    "Además sos conversador para el trato social normal: si te saluda (\"hola\", \"buenas\", \"cómo estás\", \"todo bien?\") respondé el saludo",
    "con calidez y preguntá en qué lo ayudás, y si se despide (\"nos vemos\", \"chau\", \"gracias\", \"listo, eso es todo\") despedite de forma",
    "breve y amable. Estas dos cosas NO son \"fuera de tema\" — son charla normal, no las rechaces nunca. \"registrar\" siempre [] en estos casos.",
    "Lo que SÍ rechazás con amabilidad es cuando te piden ayuda de verdad con algo que no tiene nada que ver con las finanzas de este usuario",
    "ni es una simple cortesía social (ej: pedirte una receta de cocina, un dato de cultura general, ayuda con código, el clima). Ahí en una",
    "frase decí que sos un asistente financiero y no podés ayudar con eso, y ofrecé hablar de sus gastos/ingresos/presupuestos. \"registrar\": [] también en ese caso.",
    "IMPORTANTE sobre el campo \"respuesta\": nunca contestes con una sola palabra o número suelto. Escribí SIEMPRE una oración completa y natural",
    "(1 o 2 oraciones como máximo, nunca un párrafo largo). Ejemplo de un buen \"respuesta\" a \"¿cuánto gasté en alquiler?\": \"Este mes gastaste $ 412.542 en alquiler.\"",
    "Ejemplo de uno MALO (no hagas esto): \"412542\". Los montos en la respuesta siempre con el signo $ y puntos de miles, ej: $ 412.542.",
    "Los usuarios muchas veces preguntan DOS cosas en un mismo mensaje (ej: \"¿cuánto gasté y en qué?\"). Fijate bien cuántas preguntas hay",
    "y respondé TODAS, una por una, en la misma \"respuesta\" — nunca contestes solo la primera parte e ignores el resto.",
    "\"gastosPorCategoria\" del contexto tiene el desglose por categoría del mes activo: usalo para responder \"¿en qué gasté más/menos?\" o \"¿en qué categorías gasté?\".",
    "\"balanceDelMes\" es lo que le queda disponible al usuario este mes (ingresos menos gastos menos cuotas pagadas) — es la cifra a usar",
    "cuando pregunte \"¿cuánto puedo ahorrar?\", \"¿cuánto me sobra?\" o similar; NO digas que te falta información si ese dato ya está en el contexto.",
    "NUNCA recalcules ni sumes vos los montos del contexto de una manera distinta a como ya vienen (ej: \"totalGastos\" es EL monto gastado en el mes,",
    "no lo multipliques ni le agregues ceros) — copiá los números tal cual están, solo dales formato con $ y puntos de miles.",
    "Los montos en pesos argentinos de esta app SIEMPRE son números enteros, nunca con decimales — si en algún momento un cálculo te da",
    "decimales, es que te equivocaste; redondeá y revisá que estés usando el número correcto del contexto.",
    "Cuando el usuario te pide anotar un gasto (\"registrar\" no vacío), la \"respuesta\" tiene que confirmar ESE gasto puntual",
    "(ej: \"Anotado: $ 12.300 en Alimentación.\"), nunca un dato genérico como el total gastado en el mes — eso no es lo que preguntó.",
    "Los mensajes anteriores del historial que empiezan con \"Anotado\" o dicen que algo ya se registró son gastos que YA SE CARGARON",
    "en un turno anterior. Si el usuario solo pregunta \"¿ya lo anotaste?\" o algo similar, respondé que sí (si corresponde) con \"registrar\": [],",
    "NUNCA vuelvas a incluir en \"registrar\" un gasto que el historial muestra que ya se anotó — eso lo duplicaría.",
    `Categorías válidas (usá SIEMPRE el id, nunca el nombre): ${listaCategorias}.`,
    "",
    "TERCER trabajo: presupuestos por chat. Si el usuario te dice cuánto quiere gastar como máximo en una categoría",
    "(ej. \"voy a hacer la compra mensual y quiero gastar 200000 solo en comida\", \"que la nafta no pase de 40000 este mes\",",
    "\"ponele un tope de 30000 a entretenimiento\"), eso NO es un gasto para registrar — es fijar un presupuesto. Devolvé",
    '"presupuesto": { "categoria": "id válido", "monto": 200000 } (un solo objeto, no un array) y "registrar": [] para ese mensaje,',
    "y en \"respuesta\" confirmá el tope de forma natural (ej. \"Listo, te aviso cuando te vayas acercando a los $ 200.000 en Alimentación.\").",
    "Si el usuario no está fijando un tope nuevo, \"presupuesto\" tiene que ser null. El progreso contra el presupuesto (cuánto lleva",
    "gastado de cuánto tiene disponible) NO lo calculás vos — te lo agrega la app automáticamente después de tu respuesta, así que",
    "no repitas ni inventes ese número en \"respuesta\".",
    "",
    "CUARTO trabajo: promociones/descuentos reales de comercios (ej. \"¿qué día tiene descuento Coto?\", \"hay alguna promo en",
    "Carrefour esta semana\") Y comparar precios de un producto entre supermercados (ej. \"qué súper tiene mejor precio en",
    "fideos\", \"dónde me conviene comprar arroz\", \"comparame el precio de la yerba entre Coto y Dia\"). Para esto NO tenés",
    "información propia — cualquier dato que \"recuerdes\" sobre precios o promociones puede estar desactualizado o directamente",
    "inventado, así que NUNCA respondas esto de memoria, ni un precio ni una promo ni cuál es más barato.",
    'En su lugar devolvé "buscarWeb" con una consulta de búsqueda corta y simple (el producto o la promo, SIN nombrar un',
    'supermercado en particular — el sistema ya busca sola en los sitios de Coto, Día, Carrefour, Jumbo y Vea) — ej.',
    '"precio fideos 500g" o "descuentos supermercados esta semana". En "respuesta" poné un mensaje corto tipo "Dejame',
    'fijarme..." (por si la búsqueda no está disponible, ese será el mensaje que vea el usuario). Si la pregunta NO es sobre',
    "promos/descuentos/precios/comercios, \"buscarWeb\" tiene que ser null. Nunca pongas algo en \"buscarWeb\" y en \"registrar\"",
    "o \"presupuesto\" a la vez en el mismo mensaje.",
    "CONTEXTO (datos financieros reales del usuario, en pesos argentinos):",
    JSON.stringify(contexto),
    "",
    "Respondé ÚNICAMENTE con un objeto JSON válido (sin texto antes ni después, sin markdown, sin explicaciones fuera del JSON).",
    'La clave "respuesta" es OBLIGATORIA en TODAS tus respuestas, sin excepción — nunca la omitas, nunca mandes el JSON sin ella.',
    'Las otras tres claves ("registrar", "presupuesto", "buscarWeb") son OPCIONALES: agregalas solo cuando corresponda a lo que',
    "el usuario pidió en ESTE mensaje; si no aplican, directamente no las incluyas (no hace falta poner [] o null a la fuerza).",
    'Ejemplo mínimo (una simple pregunta o charla): { "respuesta": "Este mes gastaste $ 412.542 en alquiler." }',
    'Ejemplo con un gasto: { "respuesta": "Anotado: $ 12.300 en Alimentación.", "registrar": [ { "categoria": "alimentacion", "monto": 12300, "nota": "super" } ] }',
    "Si te cuenta varias compras en el mismo mensaje, agregá un ítem de \"registrar\" por cada una. \"monto\" siempre un número entero, sin signos ni puntos de miles.",
    "Si preguntó algo que de verdad no está en el contexto, decilo con honestidad en vez de inventar.",
  ].join("\n");
}

// Prompt para la segunda pasada, cuando hubo que buscar en la web. Le pasamos
// los resultados ya obtenidos y le pedimos que arme la respuesta final con eso
// (no le pedimos registrar/presupuesto de nuevo: una pregunta de promos no es
// a la vez un gasto o un tope nuevo).
function systemPromptConBusqueda(mensajeOriginal: string, resultados: string): string {
  return [
    "Sos el asistente financiero de la app \"Mis Finanzas\", en español rioplatense, tono cercano.",
    `El usuario preguntó: "${mensajeOriginal}"`,
    "Se hizo una búsqueda web real para responder eso, incluyendo búsquedas puntuales en los sitios de varios",
    "supermercados argentinos. Resultados encontrados (agrupados por sitio cuando corresponde):",
    resultados,
    "REGLA MÁS IMPORTANTE: un precio o dato solo vale si está LITERALMENTE escrito en el texto de arriba, para ESE",
    "producto puntual. Nunca calcules, redondees, promedies ni \"estimes\" un precio a partir de otro número que veas",
    "(precios por kilo, por unidad, de un producto distinto, etc.) — si no hay un precio claro y explícito para el",
    "producto que pidió el usuario en la sección de una tienda, para esa tienda decís \"no encontré el precio\" en vez",
    "de inventar cualquier número. Es preferible decir menos y que sea correcto, a decir más y que sea inventado.",
    "Si la pregunta es para COMPARAR precios entre supermercados/tiendas, armá una lista corta con el precio de cada",
    "tienda donde SÍ encontraste un precio real (ej. \"En Coto está a $ 2.000, en Dia a $ 4.000...\") y señalá cuál es",
    "la más barata ENTRE ESAS — nunca inventes ni completes con una tienda que no tenía dato. Si no es una",
    "comparación, respondé en 1 a 3 oraciones mencionando de qué sitio sale el dato (ej. \"Según coto.com.ar...\").",
    "Si NINGÚN resultado tiene lo que se necesita para responder con confianza, decilo con honestidad.",
    "No hace falta que cites URLs en la respuesta — la app ya le agrega las fuentes reales al final del mensaje.",
    "Respondé ÚNICAMENTE con un objeto JSON válido: { \"respuesta\": \"texto para el chat\" }",
  ].join("\n");
}

// Sitios oficiales de las cadenas de supermercado más grandes de Argentina —
// se usan para buscar puntualmente en cada uno cuando el usuario quiere
// comparar precios entre tiendas (una búsqueda general sola casi nunca trae
// resultados de más de un supermercado a la vez).
const SUPERMERCADOS: Record<string, string> = {
  Coto: "cotodigital.com.ar",
  Día: "diaonline.supermercadosdia.com.ar",
  Carrefour: "carrefour.com.ar",
  Jumbo: "jumbo.com.ar",
  Vea: "vea.com.ar",
};

// Llama a la API de búsqueda de Tavily con los parámetros dados. Devuelve los
// resultados crudos (title/url/content) o results:[] si falló — nunca tira excepción.
async function tavilySearch(body: Record<string, unknown>): Promise<{ answer?: string; results: any[] }> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, search_depth: "basic", ...body }),
    });
    if (!res.ok) return { results: [] };
    const data = await res.json();
    return { answer: data.answer, results: data.results || [] };
  } catch (e) {
    console.error("Tavily error:", e);
    return { results: [] };
  }
}

// content más largo que antes (500 en vez de 300) y la URL completa (no solo
// el hostname) — un fragmento más largo le da al modelo mejores chances de
// encontrar el precio real en vez de agarrar un número suelto de otra parte
// de la página, y la URL completa sirve para que el usuario pueda ir a mirar.
function formatearResultados(results: any[]): string {
  return (results || []).slice(0, 5).map((r: any, i: number) => {
    return `${i + 1}. ${r.title} (${r.url}): ${String(r.content || "").slice(0, 500)}`;
  }).join("\n");
}

function urlsDe(results: any[]): string[] {
  return (results || []).map((r: any) => r.url).filter(Boolean);
}

// Busca en la web con Tavily (búsqueda general + resumen). "advanced" trae
// mejor contenido por resultado que "basic" (más preciso para extraer un
// precio puntual), a costa de más créditos de la cuenta de Tavily. Devuelve
// ok:false si no hay API key configurada o si falla.
async function buscarWeb(query: string): Promise<{ ok: boolean; texto: string; urls: string[] }> {
  if (!TAVILY_API_KEY) return { ok: false, texto: "", urls: [] };
  const data = await tavilySearch({ query, search_depth: "advanced", include_answer: true, max_results: 5 });
  const partes: string[] = [];
  if (data.answer) partes.push(`Resumen general: ${data.answer}`);
  const listado = formatearResultados(data.results);
  if (listado) partes.push(listado);
  return { ok: partes.length > 0, texto: partes.join("\n"), urls: urlsDe(data.results) };
}

// Busca la MISMA consulta puntualmente en el sitio de cada supermercado grande
// (en paralelo), para poder comparar precios entre cadenas — una búsqueda
// general sola casi nunca trae resultados de más de una tienda a la vez.
async function buscarEnSupermercados(query: string): Promise<{ ok: boolean; texto: string; urls: string[] }> {
  if (!TAVILY_API_KEY) return { ok: false, texto: "", urls: [] };
  const entradas = Object.entries(SUPERMERCADOS);
  const porTienda = await Promise.all(entradas.map(async ([nombre, dominio]) => {
    const data = await tavilySearch({ query, search_depth: "advanced", include_domains: [dominio], max_results: 3 });
    const listado = formatearResultados(data.results);
    return { listado: listado ? `## ${nombre} (${dominio})\n${listado}` : null, urls: urlsDe(data.results) };
  }));
  const secciones = porTienda.map((t) => t.listado).filter((s): s is string => !!s);
  const urls = porTienda.flatMap((t) => t.urls);
  return { ok: secciones.length > 0, texto: secciones.join("\n\n"), urls };
}

function extraerJson(texto: string): any {
  try { return JSON.parse(texto); } catch { /* sigue abajo */ }
  const m = texto.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nada más para intentar */ } }
  return null;
}

// Llama al modelo con una lista de mensajes ya armada y devuelve el contenido
// crudo (string). null si falló la llamada — el llamador decide el fallback.
async function llamarNvidia(messages: unknown, maxTokens = 300): Promise<string | null> {
  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${NVIDIA_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: NVIDIA_MODEL, messages, temperature: 0.2, top_p: 0.7, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const detalle = await res.text().catch(() => "");
    console.error("NVIDIA API error:", res.status, detalle);
    return null;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
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

    const contenido = await llamarNvidia(messages);
    if (contenido === null) return json({ error: "el asistente no pudo responder ahora" }, 502);
    const parsed = extraerJson(contenido);

    // Si el modelo no mandó un JSON válido, o lo mandó pero sin "respuesta", NUNCA
    // le mostramos al usuario ese texto crudo (puede ser JSON a medio escribir) —
    // mejor un mensaje genérico. Igual procesamos registrar/presupuesto por si esas
    // claves sí vinieron bien aunque "respuesta" se haya perdido.
    let respuesta = (parsed && typeof parsed.respuesta === "string" && parsed.respuesta.trim())
      ? parsed.respuesta
      : "No entendí bien, ¿podés reformular?";

    const registrar = (parsed && Array.isArray(parsed.registrar))
      ? parsed.registrar
          .filter((it: any) => it && CATEGORIAS[it.categoria] && Number(it.monto) > 0)
          // Math.round por las dudas: los pesos de esta app son siempre enteros,
          // si la IA se equivoca y manda decimales no queremos que se cuelen.
          .map((it: any) => ({ categoria: it.categoria, monto: Math.round(Number(it.monto)), nota: it.nota ? String(it.nota).slice(0, 80) : null }))
      : [];

    const presupuesto = (parsed && parsed.presupuesto && CATEGORIAS[parsed.presupuesto.categoria] && Number(parsed.presupuesto.monto) > 0)
      ? { categoria: parsed.presupuesto.categoria, monto: Math.round(Number(parsed.presupuesto.monto)) }
      : null;

    if (parsed && typeof parsed.buscarWeb === "string" && parsed.buscarWeb.trim()) {
      const query = parsed.buscarWeb.trim();
      // Búsqueda general + una puntual en cada supermercado grande (en paralelo),
      // así si la pregunta es "qué super tiene mejor precio en X" hay chances
      // reales de tener el dato de más de una cadena para comparar.
      const [general, porTienda] = await Promise.all([buscarWeb(query), buscarEnSupermercados(query)]);
      const texto = [general.texto, porTienda.texto].filter(Boolean).join("\n\n");
      if (texto) {
        const contenido2 = await llamarNvidia(
          [{ role: "system", content: systemPromptConBusqueda(mensaje, texto) }],
          300
        );
        const parsed2 = contenido2 && extraerJson(contenido2);
        if (parsed2 && typeof parsed2.respuesta === "string") respuesta = parsed2.respuesta;
        // Las fuentes las agrega la app con las URLs REALES que devolvió la
        // búsqueda (no lo que el modelo diga que citó) — así el usuario siempre
        // puede entrar a verificar el dato en vez de confiar a ciegas en el texto.
        const urls = Array.from(new Set([...general.urls, ...porTienda.urls])).slice(0, 6);
        if (urls.length) respuesta += "\n\nFuentes:\n" + urls.join("\n");
      }
      // Si no hay TAVILY_API_KEY configurada o ninguna búsqueda trajo resultados,
      // se queda con el mensaje de respaldo que ya armó la IA en la primera pasada.
    }

    return json({ respuesta, registrar, presupuesto });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
