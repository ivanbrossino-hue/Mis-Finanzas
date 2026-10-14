// ============================================================
//  Mis Finanzas — Asistente de chat (IA)
//  La llama la app desde la burbuja de chat. Le manda el mensaje del
//  usuario + el historial de la conversación + un resumen de sus datos
//  financieros (armado por el cliente). La IA responde SIEMPRE llamando a la
//  herramienta `responder` (salida estructurada: no hay JSON que parsear):
//  el texto para el usuario y, solo si lo pidió, los cambios a aplicar.
//  El REGISTRO de los cambios lo hace el cliente con sus propias funciones:
//  esta función nunca toca la tabla de proyectos.
//
//  Dos modos de respuesta:
//   - normal (JSON): { respuesta, registrar, presupuesto, pagosDeudas, acciones }
//   - stream ("stream": true en el pedido): líneas NDJSON con eventos
//       {"t":"d","s":"trozo"}      texto que va llegando (para mostrarlo en vivo)
//       {"t":"frase","texto":".."} una frase completa (para empezar a hablar ya)
//       {"t":"fin","data":{..}}    el mismo objeto del modo normal
//       {"t":"error","error":".."}
//
//  Modelo: Claude (API Messages de Anthropic).
//  Secrets: ANTHROPIC_API_KEY, CLAUDE_MODEL (opcional, por defecto
//  claude-sonnet-5-5), TAVILY_API_KEY (opcional — sin ella el asistente
//  sigue funcionando, solo no puede buscar promociones/descuentos reales)
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const CLAUDE_MODEL = Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5";
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

const TIPOS_ACCION = [
  "mes_ir", "mes_nuevo", "movimiento_editar", "movimiento_eliminar", "fila_agregar", "fila_editar", "fila_eliminar",
  "ingreso_agregar", "ingreso_editar", "ingreso_eliminar", "deuda_agregar", "deuda_editar", "deuda_eliminar",
  "presupuesto_quitar", "categoria_renombrar",
];

// Parte FIJA del prompt (no cambia entre pedidos): va primero y se guarda en caché, así cada
// respuesta arranca más rápido y sale más barata. Lo que cambia (contexto, modo) va en el bloque siguiente.
function promptEstatico(): string {
  const listaCategorias = Object.entries(CATEGORIAS).map(([id, nombre]) => `${id} (${nombre})`).join(", ");
  return [
    "Sos el asistente personal de la app \"Mis Finanzas\", en español rioplatense (vos), con tono cercano, amable y directo. Sos inteligente y práctico:",
    "entendés lo que el usuario quiere decir aunque lo escriba mal o lo dicte, razonás los números con cuidado y no inventás nada.",
    "SIEMPRE respondés llamando a la herramienta \"responder\" (nunca con texto suelto).",
    "",
    "=== ENTENDER AL USUARIO (muy importante) ===",
    "El usuario escribe rápido o dicta por voz: puede haber errores, palabras repetidas, sin tildes, frases cortadas o mezcladas (por ejemplo \"si decime hasta ahora qué tengo más gastado",
    "en qué gasté más\"). Tu trabajo es deducir la intención más probable usando el CONTEXTO y RESPONDER. NUNCA digas \"no entendí\" ni pidas que reformule si podés deducir qué quiso saber.",
    "- \"¿en qué gasté más?\", \"¿qué tengo más gastado?\", \"¿cuál es mi mayor gasto?\": respondé con el ranking de categorías (\"rankingCategorias\": la primera y, si querés, la segunda y tercera, con montos y %)",
    "  y mencioná además el gasto individual más grande (\"movimientoMasGrande\" o \"filasMasGrandes\") si aporta. Ejemplo: \"Lo que más gastaste es Vivienda: $ 70.000, el 35% del total. Le sigue Alimentación con $ 31.400.\"",
    "- \"¿cuánto gasté?\" = totalGastos del mes; \"¿cuánto me queda?\" = balanceDelMes; \"¿cómo vengo?\" = un resumen corto (balance, categoría más pesada, presupuestos excedidos si los hay).",
    "- Si el pedido puede entenderse de dos maneras muy distintas, no te trabes: contestá la interpretación más probable y ofrecé la otra en una frase corta.",
    "- Solo si de verdad no hay forma razonable de entender, hacé UNA pregunta concreta con opciones (nunca un genérico \"¿podés reformular?\").",
    "- Hablás con una persona real: respondé SIEMPRE algo útil, aunque sea parcial.",
    "",
    "=== QUÉ SABÉS HACER ===",
    "1) RESPONDER preguntas sobre las finanzas del usuario usando SOLO los datos del CONTEXTO (gastos, ingresos, filas, movimientos, presupuestos, deudas, meses).",
    "   Los totales, rankings y promedios ya vienen calculados en el CONTEXTO: usalos tal cual, no los recalcules. Si un dato no está, decilo con honestidad.",
    "   Podés comparar, sumar entre categorías, buscar el mayor gasto, estimar cuánto queda por día, etc., siempre con los números del CONTEXTO.",
    "2) ANOTAR GASTOS nuevos (\"gasté 5000 en nafta\", \"compré pan 1500 y coca 3000\") -> campo \"registrar\".",
    "3) MODIFICAR la app (agregar, editar, sacar, marcar) -> campos \"registrar\", \"presupuesto\", \"pagosDeudas\" y \"acciones\" (detalle abajo).",
    "4) Charla social normal (saludos, gracias, chau): respondé con calidez y brevedad, sin tocar nada. Si te piden algo que no tiene nada que ver con sus finanzas",
    "   (recetas, código, clima, cultura general), decí en una frase que sos un asistente financiero y ofrecé ayudar con sus gastos, ingresos, presupuestos o deudas.",
    "5) Promociones/descuentos y comparar precios de supermercados: NUNCA de memoria. Usá \"buscarWeb\" (ver más abajo).",
    "",
    "=== REGLA DE ORO: SOLO CAMBIÁS LO QUE TE PIDEN ===",
    "Modificás datos ÚNICAMENTE cuando el usuario lo pide de forma explícita (\"anotá\", \"agregá\", \"borrá\", \"sacá\", \"cambiá\", \"corregí\", \"poné\", \"marcá\", \"ya pagué\", etc.).",
    "Una pregunta (\"¿cuánto gasté?\", \"¿qué pasaría si...?\") o un comentario NUNCA modifica nada. Si no estás seguro de que sea un pedido, preguntá antes de actuar.",
    "- Si falta un dato imprescindible (el monto, a qué fila/deuda/ingreso se refiere, cuál de dos parecidos), NO adivines: preguntá en \"respuesta\" y dejá los campos de cambios vacíos.",
    "- Para sacar/borrar UN elemento concreto que el usuario nombró con claridad, hacelo. Para borrar VARIOS elementos, \"todo\", un mes entero o algo que no se pueda identificar",
    "  con seguridad, pedí confirmación primero (\"¿Confirmás que borre X, Y y Z?\") sin devolver cambios; recién cuando el usuario diga que sí, devolvé las acciones.",
    "- Después de hacer cambios, decí en la \"respuesta\" qué hiciste, en una frase. La app le muestra un botón para deshacer, así que no hace falta que lo menciones.",
    "- No repitas cambios que el historial muestra que ya se hicieron (lo que dice \"Anotado\", \"Marqué\", etc. YA SE CARGÓ en un turno anterior).",
    "- Nunca devuelvas cambios para algo que solo estás explicando o simulando.",
    "",
    "=== LA HERRAMIENTA \"responder\" ===",
    "- \"respuesta\" es OBLIGATORIA, siempre una oración completa y natural (nunca una palabra o número suelto). Escribila PRIMERO. El resto de los campos son opcionales: usá solo los que correspondan.",
    "- Montos siempre como números enteros en pesos argentinos, sin decimales. En \"respuesta\", con el formato $ 12.300 (con puntos de miles).",
    `- Categorías válidas (usá SIEMPRE el id, nunca el nombre): ${listaCategorias}.`,
    "- Si el usuario hace dos preguntas en un mismo mensaje, respondé las dos.",
    "- Si anotás un gasto, la \"respuesta\" confirma ESE gasto (\"Anotado: $ 12.300 en Alimentación.\"), no un dato genérico.",
    "",
    "=== CAMPOS DE CAMBIOS ===",
    "\"registrar\": gastos NUEVOS. Cada ítem: categoria (id), monto (entero), nota (texto corto, opcional), fila (nombre de una fila existente de esa categoría, opcional, solo si el usuario la nombra),",
    "   fecha (YYYY-MM-DD, opcional: \"ayer\", \"el lunes\"... calculala con \"hoy\" del CONTEXTO; nunca futura). Un ítem por cada compra distinta.",
    "\"presupuesto\": { categoria, monto } cuando el usuario fija un tope mensual (\"quiero gastar 200000 en comida\"). Es un tope, NO un gasto: \"registrar\" va vacío en ese caso.",
    "\"pagosDeudas\": [ { deuda: \"nombre EXACTO como figura en \\\"deudas\\\" del CONTEXTO\", accion: \"pagar\" | \"revertir\" } ] cuando dice que pagó una deuda/tarjeta (\"ya pagué la naranja\")",
    "   o que desmarques un pago. Pagar una tarjeta NO es un gasto nuevo: no lo pongas en \"registrar\" salvo que además cuente una compra aparte.",
    "   Elegí la deuda cuyo nombre más se parezca; si ninguna o dos se parecen igual, preguntá cuál (nombrando las opciones) y no devuelvas nada.",
    "\"acciones\": lista de otros cambios, en el orden en que deben hacerse. Cada una con \"tipo\" y sus campos. Usá los nombres/ids tal como figuran en el CONTEXTO:",
    "  mes_ir {mes: YYYY-MM} cambia el mes que se está viendo (solo meses de \"mesesDisponibles\"); las acciones siguientes se aplican a ese mes. · mes_nuevo {} crea el mes siguiente.",
    "  movimiento_editar {id, monto?, nota?, categoria?, fila?} corrige un gasto anotado (ids en \"movimientosRecientes\"). · movimiento_eliminar {id}.",
    "  fila_agregar {categoria, fila, monto?} agrega una fila de gasto (por ejemplo un gasto fijo como \"Internet\"). · fila_editar {categoria, fila, monto?, nuevoNombre?}. · fila_eliminar {categoria, fila}.",
    "  ingreso_agregar {nombre, monto} · ingreso_editar {nombre, monto?, nuevoNombre?} · ingreso_eliminar {nombre}.",
    "  deuda_agregar {nombre, saldo, cuotaMensual, cuotaActual?, cuotaTotal?} · deuda_editar {deuda, saldo?, cuotaMensual?, cuotaActual?, cuotaTotal?, nuevoNombre?} · deuda_eliminar {deuda}.",
    "  presupuesto_quitar {categoria} saca el tope de una categoría. · categoria_renombrar {categoria, nombre} cambia cómo se llama una categoría (nombre vacío = el original).",
    "No existen otras acciones: si te piden algo que no está acá, decí con honestidad que eso todavía no lo podés hacer desde el chat y cómo hacerlo a mano en la app.",
    "",
    "=== BÚSQUEDA WEB (promos y precios) ===",
    "Para promociones/descuentos reales de comercios (\"¿qué día tiene descuento Coto?\") y para comparar precios entre supermercados, NUNCA respondas de memoria.",
    "Usá \"buscarWeb\" con una consulta corta y simple (el producto o la promo, SIN nombrar un supermercado: el sistema ya busca en Coto, Día, Carrefour, Jumbo y Vea).",
    "En \"respuesta\" poné algo corto como \"Dejame fijarme...\" (por si la búsqueda no está disponible). Si la pregunta no es de promos/precios, \"buscarWeb\" no va. Nunca lo combines con cambios.",
  ].join("\n");
}

// Parte VARIABLE: cómo hablar (voz o texto) y los datos reales del usuario en este momento
function promptDinamico(contexto: unknown, modo: string): string {
  const estilo = modo === "voz"
    ? [
      "=== ESTILO: ESTÁS HABLANDO EN VOZ ALTA ===",
      "La app lee tu \"respuesta\" con una voz. Hablá como una persona en una charla, no como un informe: 1 a 3 frases cortas, SIN listas, SIN markdown, SIN emojis ni símbolos raros.",
      "Que suene natural y con ritmo: mezclá frases cortas y un poco más largas, usá preguntas y alguna exclamación cuando corresponda (\"¡Bien!\", \"Uf...\", \"Listo.\"),",
      "comas para las pausas y puntos suspensivos para dudar. Empezá a veces con una reacción breve (\"Mirá,\", \"Dale,\", \"A ver...\", \"Bueno,\") y mostrá empatía: si gastó de más, \"Uf, este mes se te fue la mano en...\";",
      "si viene bien, \"¡Bien ahí!\". Sin exagerar ni repetir siempre lo mismo. Los montos escribilos como siempre ($ 12.300): la app los lee bien. No enumeres más de 3 cosas.",
    ]
    : [
      "=== ESTILO: CHAT DE TEXTO ===",
      "Respondé breve y claro (1 a 4 oraciones). Podés usar saltos de línea, pero NO uses markdown (nada de **negritas**, #, tablas ni listas con asteriscos).",
    ];
  return [
    ...estilo,
    "",
    "=== CONTEXTO (datos reales del usuario, pesos argentinos; todo calculado por la app) ===",
    JSON.stringify(contexto),
  ].join("\n");
}

// Herramienta de salida estructurada: el modelo está OBLIGADO a llamarla, así que nunca devuelve
// "texto roto" ni JSON mal formado. "respuesta" va primera: al streamear, se puede empezar a hablar antes.
const HERRAMIENTA_RESPONDER = {
  name: "responder",
  description: "Envía la respuesta al usuario y, solo si el usuario lo pidió, los cambios a aplicar en la app.",
  input_schema: {
    type: "object",
    properties: {
      respuesta: { type: "string", description: "Lo que se le dice al usuario, en español rioplatense." },
      registrar: {
        type: "array", description: "Gastos nuevos a anotar (solo si el usuario los contó).",
        items: {
          type: "object",
          properties: {
            categoria: { type: "string", enum: Object.keys(CATEGORIAS) },
            monto: { type: "number" }, nota: { type: "string" }, fila: { type: "string" }, fecha: { type: "string", description: "YYYY-MM-DD" },
          },
          required: ["categoria", "monto"],
        },
      },
      presupuesto: {
        type: "object", description: "Tope mensual que el usuario fija para una categoría.",
        properties: { categoria: { type: "string", enum: Object.keys(CATEGORIAS) }, monto: { type: "number" } },
        required: ["categoria", "monto"],
      },
      pagosDeudas: {
        type: "array", description: "Marcar o desmarcar el pago de deudas/tarjetas.",
        items: {
          type: "object",
          properties: { deuda: { type: "string" }, accion: { type: "string", enum: ["pagar", "revertir"] } },
          required: ["deuda", "accion"],
        },
      },
      acciones: {
        type: "array", description: "Otros cambios que el usuario pidió, en orden.",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: TIPOS_ACCION },
            mes: { type: "string" }, id: { type: "string" }, monto: { type: "number" }, nota: { type: "string" },
            categoria: { type: "string", enum: Object.keys(CATEGORIAS) }, fila: { type: "string" }, nuevoNombre: { type: "string" },
            nombre: { type: "string" }, deuda: { type: "string" }, saldo: { type: "number" }, cuotaMensual: { type: "number" },
            cuotaActual: { type: "number" }, cuotaTotal: { type: "number" },
          },
          required: ["tipo"],
        },
      },
      buscarWeb: { type: "string", description: "Consulta corta para buscar promos o precios reales." },
    },
    required: ["respuesta"],
  },
};

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

// ---- Acciones que el asistente puede pedirle a la app (se validan acá y se vuelven a validar en el cliente) ----
function txt(v: unknown, max = 80): string { return typeof v === "string" ? v.trim().slice(0, max) : ""; }
function ent(v: unknown): number | undefined { const n = Number(v); return Number.isFinite(n) ? Math.round(n) : undefined; }
function catValida(v: unknown): string { return typeof v === "string" && CATEGORIAS[v] ? v : ""; }

function sanearAcciones(lista: unknown): any[] {
  if (!Array.isArray(lista)) return [];
  const out: any[] = [];
  for (const a of lista.slice(0, 12) as any[]) {
    if (!a || typeof a !== "object") continue;
    const tipo = txt(a.tipo, 40);
    const it: any = { tipo };
    switch (tipo) {
      case "mes_ir": {
        const mes = txt(a.mes, 7);
        if (/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) { it.mes = mes; out.push(it); }
        break;
      }
      case "mes_nuevo": out.push(it); break;
      case "movimiento_editar": {
        it.id = txt(a.id, 60); if (!it.id) break;
        const monto = ent(a.monto); if (monto !== undefined && monto > 0) it.monto = monto;
        if (typeof a.nota === "string") it.nota = txt(a.nota);
        const cat = catValida(a.categoria); if (cat) it.categoria = cat;
        const fila = txt(a.fila); if (fila) it.fila = fila;
        out.push(it);
        break;
      }
      case "movimiento_eliminar": { it.id = txt(a.id, 60); if (it.id) out.push(it); break; }
      case "fila_agregar": {
        it.categoria = catValida(a.categoria); it.fila = txt(a.fila);
        if (!it.categoria || !it.fila) break;
        const monto = ent(a.monto); if (monto !== undefined && monto >= 0) it.monto = monto;
        out.push(it);
        break;
      }
      case "fila_editar": {
        it.categoria = catValida(a.categoria); it.fila = txt(a.fila);
        if (!it.categoria || !it.fila) break;
        const monto = ent(a.monto); if (monto !== undefined && monto >= 0) it.monto = monto;
        const nuevo = txt(a.nuevoNombre); if (nuevo) it.nuevoNombre = nuevo;
        if (it.monto === undefined && !it.nuevoNombre) break;
        out.push(it);
        break;
      }
      case "fila_eliminar": {
        it.categoria = catValida(a.categoria); it.fila = txt(a.fila);
        if (it.categoria && it.fila) out.push(it);
        break;
      }
      case "ingreso_agregar": {
        it.nombre = txt(a.nombre); const monto = ent(a.monto);
        if (it.nombre && monto !== undefined && monto >= 0) { it.monto = monto; out.push(it); }
        break;
      }
      case "ingreso_editar": {
        it.nombre = txt(a.nombre); if (!it.nombre) break;
        const monto = ent(a.monto); if (monto !== undefined && monto >= 0) it.monto = monto;
        const nuevo = txt(a.nuevoNombre); if (nuevo) it.nuevoNombre = nuevo;
        if (it.monto === undefined && !it.nuevoNombre) break;
        out.push(it);
        break;
      }
      case "ingreso_eliminar": { it.nombre = txt(a.nombre); if (it.nombre) out.push(it); break; }
      case "deuda_agregar": {
        it.nombre = txt(a.nombre); if (!it.nombre) break;
        it.saldo = Math.max(0, ent(a.saldo) ?? 0); it.cuotaMensual = Math.max(0, ent(a.cuotaMensual) ?? 0);
        const ca = ent(a.cuotaActual), ct = ent(a.cuotaTotal);
        if (ca !== undefined && ct !== undefined && ca > 0 && ct > 0) { it.cuotaActual = ca; it.cuotaTotal = ct; }
        out.push(it);
        break;
      }
      case "deuda_editar": {
        it.deuda = txt(a.deuda); if (!it.deuda) break;
        for (const k of ["saldo", "cuotaMensual", "cuotaActual", "cuotaTotal"]) { const n = ent(a[k]); if (n !== undefined && n >= 0) it[k] = n; }
        const nuevo = txt(a.nuevoNombre); if (nuevo) it.nuevoNombre = nuevo;
        if (Object.keys(it).length <= 2) break;
        out.push(it);
        break;
      }
      case "deuda_eliminar": { it.deuda = txt(a.deuda); if (it.deuda) out.push(it); break; }
      case "presupuesto_quitar": { it.categoria = catValida(a.categoria); if (it.categoria) out.push(it); break; }
      case "categoria_renombrar": {
        it.categoria = catValida(a.categoria); if (!it.categoria) break;
        it.nombre = txt(a.nombre, 40);
        out.push(it);
        break;
      }
      default: break; // tipo desconocido: se descarta
    }
  }
  return out;
}

function extraerJson(texto: string): any {
  try { return JSON.parse(texto); } catch { /* sigue abajo */ }
  const m = texto.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nada más para intentar */ } }
  return null;
}

type MensajeChat = { role: "user" | "assistant"; content: string };

// La API de Anthropic exige que el primer mensaje sea del usuario y que los roles
// se alternen: descartamos vacíos, fusionamos turnos seguidos del mismo rol y
// sacamos los "assistant" iniciales (el historial recortado puede arrancar ahí).
function normalizarMensajes(mensajes: MensajeChat[]): MensajeChat[] {
  const out: MensajeChat[] = [];
  for (const m of mensajes) {
    const content = String(m.content || "").trim();
    if (!content) continue;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.role === m.role) ultimo.content += "\n" + content;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// ---------- Llamadas a Claude ----------
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_HEADERS = {
  "x-api-key": ANTHROPIC_API_KEY,
  "anthropic-version": "2023-06-01",
  "content-type": "application/json",
};

// El prompt fijo va primero y marcado para caché; lo que cambia (contexto, modo) va después
function bloquesSystem(contexto: unknown, modo: string): unknown[] {
  return [
    { type: "text", text: promptEstatico(), cache_control: { type: "ephemeral" } },
    { type: "text", text: promptDinamico(contexto, modo) },
  ];
}

function cuerpoClaude(system: unknown, messages: MensajeChat[], maxTokens: number, conHerramienta: boolean): Record<string, unknown> {
  const cuerpo: Record<string, unknown> = { model: CLAUDE_MODEL, max_tokens: maxTokens, system, messages };
  if (conHerramienta) {
    cuerpo.tools = [HERRAMIENTA_RESPONDER];
    cuerpo.tool_choice = { type: "tool", name: "responder" }; // el modelo SIEMPRE tiene que llamar a la herramienta
  }
  return cuerpo;
}

// Llama a Claude y devuelve el texto crudo de la respuesta (string). null si falló
// la llamada (red, timeout, 4xx/5xx) — el llamador decide el fallback. (Lo usa la 2ª pasada de la búsqueda web.)
async function llamarClaude(system: string, mensajes: MensajeChat[], maxTokens = 1024): Promise<string | null> {
  const messages = normalizarMensajes(mensajes);
  if (!messages.length) return null;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: ANTHROPIC_HEADERS,
      body: JSON.stringify(cuerpoClaude(system, messages, maxTokens, false)),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error("Anthropic API error:", res.status, detalle);
      return null;
    }
    const data = await res.json();
    if (data?.stop_reason === "max_tokens") console.warn("Anthropic: respuesta cortada por max_tokens");
    const bloques: any[] = Array.isArray(data?.content) ? data.content : [];
    return bloques.filter((b) => b?.type === "text").map((b) => String(b.text || "")).join("");
  } catch (e) {
    console.error("Anthropic fetch error:", e);
    return null;
  }
}

// A veces un campo anidado llega como texto JSON en vez de objeto: se pasa a objeto
function normalizarEntrada(x: any): any {
  if (!x || typeof x !== "object") return null;
  for (const k of ["registrar", "presupuesto", "pagosDeudas", "acciones"]) {
    if (typeof x[k] === "string") { try { x[k] = JSON.parse(x[k]); } catch { delete x[k]; } }
  }
  return x;
}

// Si el modelo contestó con texto (no debería pasar): JSON si lo es; si no, el propio texto como respuesta
function desdeTexto(texto: string): any | null {
  const j = extraerJson(texto);
  if (j && typeof j === "object") return normalizarEntrada(j);
  const limpio = texto.trim();
  if (limpio && !limpio.startsWith("{")) return { respuesta: limpio.slice(0, 1500) };
  return null;
}

// Llamada SIN stream con la herramienta: devuelve el objeto que armó el modelo (o null si falló)
async function llamarClaudeHerramienta(system: unknown, mensajes: MensajeChat[], maxTokens = 1600): Promise<any | null> {
  const messages = normalizarMensajes(mensajes);
  if (!messages.length) return null;
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: ANTHROPIC_HEADERS,
      body: JSON.stringify(cuerpoClaude(system, messages, maxTokens, true)),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      console.error("Anthropic API error:", res.status, detalle);
      return null;
    }
    const data = await res.json();
    if (data?.stop_reason === "max_tokens") console.warn("Anthropic: respuesta cortada por max_tokens");
    const bloques: any[] = Array.isArray(data?.content) ? data.content : [];
    const uso = bloques.find((b) => b?.type === "tool_use" && b?.name === "responder");
    if (uso && uso.input) return normalizarEntrada(uso.input);
    return desdeTexto(bloques.filter((b) => b?.type === "text").map((b) => String(b.text || "")).join(""));
  } catch (e) {
    console.error("Anthropic fetch error:", e);
    return null;
  }
}

// Con lo que devolvió el modelo arma la respuesta final para la app: valida cada cambio, hace la
// búsqueda web si hace falta y devuelve el objeto que el cliente aplica. Es la misma para stream y no stream.
async function armarRespuesta(parsed: any, mensaje: string): Promise<Record<string, unknown>> {
  // Si el modelo no mandó "respuesta", NUNCA se muestra texto crudo: mejor una frase amable y pedir que repita
  let respuesta = (parsed && typeof parsed.respuesta === "string" && parsed.respuesta.trim())
    ? parsed.respuesta
    : "Perdón, se me trabó la respuesta. ¿Me lo repetís?";

  const registrar = (parsed && Array.isArray(parsed.registrar))
    ? parsed.registrar
        .filter((it: any) => it && CATEGORIAS[it.categoria] && Number(it.monto) > 0)
        // Math.round por las dudas: los pesos de esta app son siempre enteros,
        // si la IA se equivoca y manda decimales no queremos que se cuelen.
        .map((it: any) => {
          const gasto: any = { categoria: it.categoria, monto: Math.round(Number(it.monto)), nota: it.nota ? String(it.nota).slice(0, 80) : null };
          // fila y fecha son opcionales: la fecha tiene que ser real, de hoy o anterior
          const fila = txt(it.fila); if (fila) gasto.fila = fila;
          const fecha = txt(it.fecha, 10);
          if (/^\d{4}-\d{2}-\d{2}$/.test(fecha) && fecha <= new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)) gasto.fecha = fecha;
          return gasto;
        })
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
      const contenido2 = await llamarClaude(
        systemPromptConBusqueda(mensaje, texto),
        [{ role: "user", content: mensaje }],
      );
      const parsed2 = contenido2 ? desdeTexto(contenido2) : null;
      if (parsed2 && typeof parsed2.respuesta === "string" && parsed2.respuesta.trim()) respuesta = parsed2.respuesta;
      // Las fuentes las agrega la app con las URLs REALES que devolvió la
      // búsqueda (no lo que el modelo diga que citó) — así el usuario siempre
      // puede entrar a verificar el dato en vez de confiar a ciegas en el texto.
      const urls = Array.from(new Set([...general.urls, ...porTienda.urls])).slice(0, 6);
      if (urls.length) respuesta += "\n\nFuentes:\n" + urls.join("\n");
    }
    // Si no hay TAVILY_API_KEY configurada o ninguna búsqueda trajo resultados,
    // se queda con el mensaje de respaldo que ya armó la IA en la primera pasada.
  }

  // Pagos de deudas: solo pasan entradas bien formadas (la app las cruza con sus deudas reales)
  const pagosDeudas = (parsed && Array.isArray(parsed.pagosDeudas))
    ? parsed.pagosDeudas
        .filter((p: any) => p && typeof p.deuda === "string" && p.deuda.trim() && (p.accion === "pagar" || p.accion === "revertir"))
        .slice(0, 10)
        .map((p: any) => ({ deuda: String(p.deuda).trim().slice(0, 80), accion: p.accion }))
    : [];

  const acciones = sanearAcciones(parsed && parsed.acciones);

  return { respuesta, registrar, presupuesto, pagosDeudas, acciones };
}

// ---------- Stream: se manda cada frase apenas está lista ----------
const codificador = new TextEncoder();
function lineaNdjson(obj: unknown): Uint8Array { return codificador.encode(JSON.stringify(obj) + "\n"); }

// Saca de un JSON que todavía está llegando el texto de "respuesta" que ya se puede leer
function leerRespuestaParcial(buf: string): { texto: string; completa: boolean } {
  const m = /"respuesta"\s*:\s*"/.exec(buf);
  if (!m) return { texto: "", completa: false };
  let i = m.index + m[0].length;
  let out = "";
  while (i < buf.length) {
    const c = buf[i];
    if (c === '"') return { texto: out, completa: true };
    if (c === "\\") {
      if (i + 1 >= buf.length) break;
      const n = buf[i + 1];
      if (n === "u") {
        if (i + 5 >= buf.length) break; // el código \uXXXX todavía no llegó entero
        const hex = buf.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) { out += String.fromCharCode(parseInt(hex, 16)); i += 6; continue; }
        out += "u"; i += 2; continue;
      }
      out += n === "n" ? "\n" : n === "t" ? "\t" : n === "r" ? "" : n; // \" \\ \/ -> el propio carácter
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return { texto: out, completa: false };
}

// Corta en frases lo que se fue acumulando: fin de frase = . ! ? … seguido de espacio, o un salto de línea.
// El punto de "177.700" no corta (lo sigue un dígito). Con final=true se manda también lo que quede.
function cortarFrases(pendiente: string, final: boolean): { frases: string[]; resto: string } {
  const frases: string[] = [];
  const re = /[.!?…]+["')\]]*(?=\s)|\n+/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pendiente)) !== null) {
    const fin = m.index + m[0].length;
    const f = pendiente.slice(ultimo, fin).trim();
    if (f) frases.push(f);
    ultimo = fin;
  }
  let resto = pendiente.slice(ultimo);
  if (final && resto.trim()) { frases.push(resto.trim()); resto = ""; }
  return { frases, resto };
}

function responderEnStream(system: unknown, mensajes: MensajeChat[], mensaje: string): Response {
  const messages = normalizarMensajes(mensajes);
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (o: unknown) => { try { controller.enqueue(lineaNdjson(o)); } catch { /* el cliente cortó */ } };
      try {
        if (!messages.length) { enviar({ t: "error", error: "falta mensaje" }); controller.close(); return; }
        const res = await fetch(ANTHROPIC_URL, {
          method: "POST",
          headers: ANTHROPIC_HEADERS,
          body: JSON.stringify({ ...cuerpoClaude(system, messages, 1600, true), stream: true }),
          signal: AbortSignal.timeout(90_000),
        });
        if (!res.ok || !res.body) {
          const detalle = await res.text().catch(() => "");
          console.error("Anthropic stream error:", res.status, detalle);
          enviar({ t: "error", error: "el asistente no pudo responder ahora" });
          controller.close();
          return;
        }
        const lector = res.body.getReader();
        const decodificador = new TextDecoder();
        let buf = "";            // texto SSE sin procesar
        let jsonBuf = "";        // JSON de la herramienta, a medida que llega
        let emitidoChars = 0;    // cuánto de "respuesta" ya se mandó
        let pendiente = "";      // texto de "respuesta" que todavía no cerró una frase
        let corta = "";          // frase muy corta, esperando unirse a la siguiente
        let cerrada = false;     // ya llegó la comilla de cierre de "respuesta"

        const emitir = (frases: string[], final: boolean) => {
          for (const f of frases) {
            const t = (corta ? corta + " " : "") + f;
            if (t.length < 18 && !final) { corta = t; continue; } // "Uf..." sola suena entrecortada: se une a la siguiente
            corta = "";
            enviar({ t: "frase", texto: t });
          }
          if (final && corta) { enviar({ t: "frase", texto: corta }); corta = ""; }
        };

        while (true) {
          const { done, value } = await lector.read();
          if (done) break;
          buf += decodificador.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const bloque = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const linea = bloque.split("\n").find((l) => l.startsWith("data:"));
            if (!linea) continue;
            let ev: any;
            try { ev = JSON.parse(linea.slice(5).trim()); } catch { continue; }
            if (ev.type === "error") { console.error("Anthropic stream event error:", ev); enviar({ t: "error", error: "el asistente no pudo responder ahora" }); controller.close(); return; }
            if (ev.type === "content_block_delta" && ev.delta?.type === "input_json_delta") {
              jsonBuf += String(ev.delta.partial_json || "");
              const p = leerRespuestaParcial(jsonBuf);
              if (p.texto.length > emitidoChars) {
                const nuevo = p.texto.slice(emitidoChars);
                emitidoChars = p.texto.length;
                enviar({ t: "d", s: nuevo });
                pendiente += nuevo;
                const r = cortarFrases(pendiente, false);
                pendiente = r.resto;
                emitir(r.frases, false);
              }
              if (p.completa && !cerrada) {
                cerrada = true;
                const r = cortarFrases(pendiente, true);
                pendiente = r.resto;
                emitir(r.frases, true);
              }
            }
          }
        }

        // Fin del stream: el JSON de la herramienta ya está completo
        let parsed: any = null;
        try { parsed = normalizarEntrada(JSON.parse(jsonBuf)); } catch { /* se intenta con lo parcial */ }
        const parcial = leerRespuestaParcial(jsonBuf);
        if (!parsed && parcial.texto.trim()) parsed = { respuesta: parcial.texto };
        if (!cerrada) { // por si nunca llegó la comilla de cierre: se manda lo que quedó
          const r = cortarFrases(pendiente, true);
          pendiente = r.resto;
          emitir(r.frases, true);
        }
        const data = await armarRespuesta(parsed, mensaje);
        enviar({ t: "fin", data });
        controller.close();
      } catch (e) {
        console.error("stream error:", e);
        enviar({ t: "error", error: String(e) });
        try { controller.close(); } catch { /* ya cerrado */ }
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no", ...CORS_HEADERS },
  });
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

    if (!ANTHROPIC_API_KEY) return json({ error: "el asistente no está configurado (falta ANTHROPIC_API_KEY)" }, 500);

    const body = await req.json().catch(() => ({}));
    const mensaje = String(body.mensaje || "").trim();
    const historial = Array.isArray(body.historial) ? body.historial : [];
    const contexto = body.contexto || {};
    const modo = body.modo === "voz" ? "voz" : "texto";
    if (!mensaje) return json({ error: "falta mensaje" }, 400);

    // Más memoria de la charla (20 mensajes), con cada uno acotado para no inflar el pedido
    const messages: MensajeChat[] = [
      ...historial.slice(-20).map((h: any): MensajeChat => ({
        role: h.rol === "assistant" ? "assistant" : "user",
        content: String(h.texto || "").slice(0, 1500),
      })),
      { role: "user", content: mensaje.slice(0, 2000) },
    ];
    const system = bloquesSystem(contexto, modo);

    // Con "stream": true la respuesta va saliendo de a frases (conversación más fluida)
    if (body.stream === true) return responderEnStream(system, messages, mensaje);

    const parsed = await llamarClaudeHerramienta(system, messages);
    if (parsed === null) return json({ error: "el asistente no pudo responder ahora" }, 502);
    return json(await armarRespuesta(parsed, mensaje));
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
