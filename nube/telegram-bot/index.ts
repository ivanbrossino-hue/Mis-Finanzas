// ============================================================
//  Mis Finanzas — Bot de Telegram (Supabase Edge Function)
//  "Carrito": vas mandando productos, te lleva la cuenta,
//  confirmás el total, elegís categoría y en qué FILA sumarlo
//  (una existente o una nueva), y le podés poner una nota.
//
//  Cada chat de Telegram está vinculado a UN proyecto de la app
//  (tabla bot_vinculos). La vinculación se hace con un link
//  t.me/tu_bot?start=CODIGO que la app genera — al abrirlo, Telegram
//  manda "/start CODIGO" acá y quedamos conectados sin pegar ninguna
//  clave a mano.
//
//  Secrets: TELEGRAM_TOKEN, WEBHOOK_SECRET
// ============================================================

const TG = (m: string) => `https://api.telegram.org/bot${Deno.env.get("TELEGRAM_TOKEN")}/${m}`;
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";

const CATEGORIAS = [
  { id: "vivienda", icon: "🏠", label: "Vivienda", kw: ["alquiler", "expensas", "luz", "gas", "agua", "internet", "celular", "wifi", "edenor", "edesur", "aysa"] },
  { id: "trabajo", icon: "💼", label: "Trabajo", kw: ["monotributo", "afip", "impuesto", "inversion", "trabajo"] },
  { id: "alimentacion", icon: "🛒", label: "Alimentación", kw: ["super", "supermercado", "almacen", "comida", "verduleria", "carniceria", "verdura", "carne", "pan", "kiosco", "chino", "arroz", "azucar", "aceite", "fideos", "leche", "huevos", "delivery", "pedidosya", "rappi"] },
  { id: "transporte", icon: "🚗", label: "Transporte", kw: ["nafta", "combustible", "sube", "colectivo", "tren", "subte", "uber", "didi", "cabify", "taxi", "peaje", "estacionamiento", "auto", "mecanico"] },
  { id: "salud", icon: "🏥", label: "Salud", kw: ["farmacia", "medicamento", "remedio", "medico", "consulta", "obra social", "prepaga", "gimnasio", "gym", "dentista"] },
  { id: "educacion", icon: "📚", label: "Educación", kw: ["curso", "libro", "universidad", "cuota", "capacitacion", "colegio", "escuela"] },
  { id: "mascota", icon: "🐾", label: "Mascota", kw: ["perro", "gato", "veterinaria", "veterinario", "balanceado", "mascota", "piedras"] },
  { id: "entretenimiento", icon: "🎬", label: "Entretenimiento", kw: ["netflix", "spotify", "cine", "salida", "bar", "boliche", "juego", "streaming", "disney", "hbo", "youtube", "vacaciones"] },
  { id: "ropa", icon: "👕", label: "Ropa / Personal", kw: ["ropa", "zapatillas", "calzado", "peluqueria", "shampoo", "higiene", "cosmetico", "perfume"] },
  { id: "seguros", icon: "🛡️", label: "Seguros / Imprevistos", kw: ["seguro", "poliza", "imprevisto", "emergencia"] },
  { id: "ahorro", icon: "💰", label: "Ahorro e Inversión", kw: ["ahorro", "dolar", "dolares", "plazo fijo", "cripto", "acciones", "fci"] },
];
const CAT_MAP: Record<string, typeof CATEGORIAS[number]> = {};
CATEGORIAS.forEach((c) => (CAT_MAP[c.id] = c));

const FILLER = ["compre", "compré", "gaste", "gasté", "pague", "pagué", "de", "en", "del", "la", "el", "los", "las", "por", "un", "una", "$", "pesos"];

type Sesion = {
  items: { nombre: string; monto: number }[];
  nota: string | null;
  await: null | "nota" | "nombreFila" | "notaGasto";
  msgId: number | null;
  catElegida: string | null;
  filaIds: string[]; // ids de las filas mostradas (índice = botón)
  ultimoGasto: { mes: string; movId: string } | null;
};
function sesionVacia(): Sesion {
  return { items: [], nota: null, await: null, msgId: null, catElegida: null, filaIds: [], ultimoGasto: null };
}

// ---------- Supabase REST ----------
function sbHeaders(extra: Record<string, string> = {}) {
  return { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", ...extra };
}

// A qué proyecto está vinculado este chat (null = todavía no vinculó nada).
async function resolverProyecto(chatId: number): Promise<string | null> {
  const r = await fetch(`${SB_URL}/rest/v1/bot_vinculos?chat_id=eq.${chatId}&select=proyecto_id`, { headers: sbHeaders() });
  if (!r.ok) return null;
  const rows = await r.json();
  return rows[0] ? rows[0].proyecto_id : null;
}

// Canjea un código generado por la app (bot_codigos_vinculo) y vincula
// este chat al proyecto de quien lo generó.
async function vincularConCodigo(chat: number, codigo: string): Promise<string> {
  const codRes = await fetch(
    `${SB_URL}/rest/v1/bot_codigos_vinculo?codigo=eq.${encodeURIComponent(codigo)}&usado=eq.false&select=proyecto_id,creado_por,expira_en`,
    { headers: sbHeaders() },
  );
  const cods = codRes.ok ? await codRes.json() : [];
  const cod = cods[0];
  if (!cod) return "⚠️ Ese link ya se usó o no es válido. Generá uno nuevo desde la app (menú ⤓ → Conectar Telegram).";
  if (new Date(cod.expira_en).getTime() < Date.now()) {
    return "⚠️ Ese link venció (duran 15 minutos). Generá uno nuevo desde la app.";
  }
  await fetch(`${SB_URL}/rest/v1/bot_vinculos`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ chat_id: chat, proyecto_id: cod.proyecto_id, vinculado_por: cod.creado_por }]),
  });
  await fetch(`${SB_URL}/rest/v1/bot_codigos_vinculo?codigo=eq.${encodeURIComponent(codigo)}`, {
    method: "PATCH",
    headers: sbHeaders(),
    body: JSON.stringify({ usado: true }),
  });
  return "✅ ¡Listo! Este chat quedó conectado a tu proyecto de <b>Mis Finanzas</b>.\n\nMandame lo que vas comprando:\n<code>2000 arroz</code>\n<code>2300 azúcar, 5000 aceite</code>";
}

async function readState(proyectoId: string): Promise<{ data: any; rev: number }> {
  const r = await fetch(`${SB_URL}/rest/v1/proyectos?id=eq.${proyectoId}&select=data,rev`, { headers: sbHeaders() });
  const rows = await r.json();
  if (rows[0]) return { data: rows[0].data ?? {}, rev: rows[0].rev ?? 0 };
  return { data: { version: 1, meses: {}, deudas: [], catNombres: {} }, rev: 0 };
}
async function writeState(proyectoId: string, data: any, rev: number) {
  const r = await fetch(`${SB_URL}/rest/v1/proyectos?id=eq.${proyectoId}`, {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify({ data, rev: rev + 1, updated_by: "bot", updated_at: new Date().toISOString() }),
  });
  if (!r.ok) console.error("writeState fallo:", r.status, await r.text());
}
async function getSesion(chat: number): Promise<Sesion> {
  const r = await fetch(`${SB_URL}/rest/v1/pending_bot?chat_id=eq.${chat}&select=sesion`, { headers: sbHeaders() });
  const rows = await r.json();
  return (rows[0] && rows[0].sesion && Object.keys(rows[0].sesion).length) ? { ...sesionVacia(), ...rows[0].sesion } : sesionVacia();
}
async function setSesion(chat: number, sesion: Sesion) {
  const r = await fetch(`${SB_URL}/rest/v1/pending_bot`, {
    method: "POST",
    headers: sbHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify([{ chat_id: chat, sesion }]),
  });
  if (!r.ok) console.error("setSesion fallo:", r.status, await r.text());
}
async function clearSesion(chat: number) {
  await fetch(`${SB_URL}/rest/v1/pending_bot?chat_id=eq.${chat}`, { method: "DELETE", headers: sbHeaders() });
}

// ---------- Telegram ----------
async function tg(method: string, body: unknown): Promise<any> {
  const r = await fetch(TG(method), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  try { return await r.json(); } catch { return {}; }
}
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const SIN_VINCULAR = "👋 Todavía no conectaste este chat con tu cuenta.\n\nAbrí la app Mis Finanzas → menú (⤓) → <b>Conectar Telegram</b> y tocá el botón: te trae para acá y queda conectado solo, sin escribir nada.";

// ---------- Fechas (hora Argentina) ----------
const p2 = (n: number) => String(n).padStart(2, "0");
function hoyAR() { return new Date(Date.now() - 3 * 3600 * 1000); }
function isoHoy() { const d = hoyAR(); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`; }
function mesActualKey() { return isoHoy().slice(0, 7); }
function fechaCorta(iso?: string) {
  if (!iso) return "—";
  const [y, mo, da] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1, da));
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${dias[d.getUTCDay()]} ${p2(da)}/${p2(mo)}`;
}
function uidBot(prefijo: string) {
  return prefijo + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---------- Parseo ----------
function num(s: string): number {
  s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function limpiarNombre(s: string): string {
  return s.split(/\s+/).filter((w) => w && !FILLER.includes(w.toLowerCase()))
    .join(" ").replace(/\s+/g, " ").trim();
}
// Un "-" pegado al número (ej: "-2000 devolución") lo resta en vez de sumarlo —
// sirve para descuentos, devoluciones o para corregir un monto cargado de más,
// sin tener que borrar y volver a mandar todo el carrito.
function parseUnItem(seg: string): { nombre: string; monto: number } | null {
  let monto = 0, t = seg.trim();
  const k = t.match(/(-?\d[\d.,]*)\s*k\b/i);
  const nn = t.match(/(-?\d[\d.,]*)/);
  if (k) { monto = num(k[1]) * 1000; t = t.replace(k[0], ""); }
  else if (nn) { monto = num(nn[1]); t = t.replace(nn[0], ""); }
  if (!monto) return null;
  return { nombre: limpiarNombre(t) || (monto < 0 ? "Descuento" : "item"), monto };
}
// separa "2000 arroz, 2300 azucar" en varios items
function parseItems(text: string): { nombre: string; monto: number }[] {
  const segs = text.split(/[,\n;]+| y /i);
  const out: { nombre: string; monto: number }[] = [];
  for (const s of segs) { const it = parseUnItem(s); if (it) out.push(it); }
  if (out.length === 0) { const it = parseUnItem(text); if (it) out.push(it); }
  return out;
}
function adivinarCategoria(texto: string): string {
  const n = texto.toLowerCase();
  for (const c of CATEGORIAS) if (c.kw.some((k) => n.includes(k))) return c.id;
  return "alimentacion";
}

// ---------- Teclados / textos ----------
function kbCarrito() {
  return { inline_keyboard: [
    [{ text: "✅ Sumar al total", callback_data: "sumar" }],
    [{ text: "✏️ Nota", callback_data: "nota" }, { text: "🗑️ Cancelar", callback_data: "cancelar" }],
  ] };
}
function kbCategorias(guess: string) {
  const rows: any[] = [];
  for (let i = 0; i < CATEGORIAS.length; i += 2) {
    rows.push(CATEGORIAS.slice(i, i + 2).map((c) => ({
      text: (c.id === guess ? "⭐ " : "") + c.icon + " " + c.label,
      callback_data: "s:" + c.id,
    })));
  }
  return { inline_keyboard: rows };
}
function kbFilas(filas: { id: string; nombre: string; monto: number }[]) {
  const rows: any[] = filas.slice(0, 10).map((f, i) => [{ text: `${f.nombre}  ·  ${money(f.monto)}`, callback_data: "row:" + i }]);
  rows.push([{ text: "➕ Agregar como fila nueva", callback_data: "rownew" }]);
  rows.push([{ text: "⬅️ Cambiar categoría", callback_data: "catback" }]);
  return { inline_keyboard: rows };
}
function totalCarrito(s: Sesion) { return (s.items || []).reduce((a, it) => a + (it.monto || 0), 0); }
function textoCarrito(s: Sesion) {
  const lines = (s.items || []).map((it) => `• ${it.nombre}  <b>${money(it.monto)}</b>`);
  let t = `🛒 <b>Compra en curso</b>\n${lines.join("\n")}\n──────────\nTotal: <b>${money(totalCarrito(s))}</b>`;
  if (s.nota) t += `\n📝 ${s.nota}`;
  return t;
}

// muestra/actualiza el mensaje del carrito (paso 1: seguir sumando productos)
async function mostrarCarrito(chat: number, s: Sesion) {
  const texto = textoCarrito(s) + `\n\nSeguí mandando productos, o tocá <b>Sumar al total</b>.`;
  if (s.msgId) {
    const r = await tg("editMessageText", { chat_id: chat, message_id: s.msgId, parse_mode: "HTML", text: texto, reply_markup: kbCarrito() });
    if (r && r.ok) return;
  }
  const r = await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: texto, reply_markup: kbCarrito() });
  s.msgId = r?.result?.message_id ?? null;
  await setSesion(chat, s);
}

// paso 2: elegir categoría
async function mostrarCategorias(chat: number, mid: number, s: Sesion) {
  const guess = adivinarCategoria(s.items.map((i) => i.nombre).join(" ") + " " + (s.nota || ""));
  s.catElegida = null; s.msgId = mid; await setSesion(chat, s);
  await tg("editMessageText", {
    chat_id: chat, message_id: mid, parse_mode: "HTML",
    text: `${textoCarrito(s)}\n\n<b>¿En qué categoría lo cargo?</b>`,
    reply_markup: kbCategorias(guess),
  });
}

// paso 3: elegir fila dentro de la categoría
async function mostrarFilas(chat: number, mid: number, s: Sesion, catId: string, proyectoId: string) {
  const st = await readState(proyectoId);
  const key = mesActualKey();
  const filas = (st.data.meses?.[key]?.gastos || []).filter((g: any) => g.categoria === catId);
  s.catElegida = catId;
  s.filaIds = filas.slice(0, 10).map((f: any) => f.id);
  s.msgId = mid;
  await setSesion(chat, s);
  const cat = CAT_MAP[catId];
  const texto = `${textoCarrito(s)}\nCategoría: ${cat.icon} <b>${cat.label}</b>\n\n<b>¿En qué fila lo sumo?</b>`;
  await tg("editMessageText", { chat_id: chat, message_id: mid, parse_mode: "HTML", text: texto, reply_markup: kbFilas(filas) });
}

function resumenMes(data: any, key: string): string {
  const m = data.meses?.[key] ?? { ingresos: [], gastos: [] };
  const ing = (m.ingresos || []).reduce((s: number, i: any) => s + (+i.monto || 0), 0);
  const gas = (m.gastos || []).reduce((s: number, g: any) => s + (+g.monto || 0), 0);
  return `💵 Ingresos: ${money(ing)}\n🛒 Gastos del mes: ${money(gas)}`;
}

// ---------- Servidor ----------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  if (WEBHOOK_SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response("ok"); }

  try {
    // ============ CALLBACKS (botones) ============
    if (update.callback_query) {
      const q = update.callback_query;
      const chat = q.message.chat.id;
      const mid = q.message.message_id;
      const data = q.data as string;

      const proyectoId = await resolverProyecto(chat);
      if (!proyectoId) {
        await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Conectá el chat desde la app primero", show_alert: true });
        return new Response("ok");
      }

      const s = await getSesion(chat);

      if (data === "cancelar") {
        await clearSesion(chat);
        await tg("editMessageText", { chat_id: chat, message_id: mid, text: "🗑️ Compra cancelada." });
        await tg("answerCallbackQuery", { callback_query_id: q.id });
        return new Response("ok");
      }

      if (data === "nota") {
        s.await = "nota"; s.msgId = mid; await setSesion(chat, s);
        await tg("answerCallbackQuery", { callback_query_id: q.id });
        await tg("sendMessage", { chat_id: chat, text: "✏️ Escribí la nota de la compra (ej: Chino de casa, Kiosco de la vuelta):" });
        return new Response("ok");
      }

      if (data === "sumar") {
        if (!s.items || !s.items.length) {
          await tg("answerCallbackQuery", { callback_query_id: q.id, text: "El carrito está vacío" });
          return new Response("ok");
        }
        await mostrarCategorias(chat, mid, s);
        await tg("answerCallbackQuery", { callback_query_id: q.id });
        return new Response("ok");
      }

      if (data.startsWith("s:")) {
        if (!s.items || !s.items.length) {
          await tg("answerCallbackQuery", { callback_query_id: q.id, text: "El carrito está vacío" });
          return new Response("ok");
        }
        await mostrarFilas(chat, mid, s, data.slice(2), proyectoId);
        await tg("answerCallbackQuery", { callback_query_id: q.id });
        return new Response("ok");
      }

      if (data === "catback") {
        await mostrarCategorias(chat, mid, s);
        await tg("answerCallbackQuery", { callback_query_id: q.id });
        return new Response("ok");
      }

      if (data === "rownew") {
        if (!s.catElegida) { await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Se venció, mandalo de nuevo 🙂" }); return new Response("ok"); }
        s.await = "nombreFila"; s.msgId = mid; await setSesion(chat, s);
        await tg("answerCallbackQuery", { callback_query_id: q.id });
        await tg("sendMessage", { chat_id: chat, text: "✏️ ¿Cómo la llamamos a esta fila? (ej: Verdulería, Kiosco de la esquina)" });
        return new Response("ok");
      }

      if (data.startsWith("row:")) {
        if (!s.catElegida || !s.items.length) {
          await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Se venció, mandalo de nuevo 🙂" });
          return new Response("ok");
        }
        const idx = parseInt(data.slice(4), 10);
        const filaId = s.filaIds[idx];
        const total = totalCarrito(s);
        const st = await readState(proyectoId);
        const key = mesActualKey();
        const m = st.data.meses?.[key];
        const fila = m && (m.gastos || []).find((g: any) => g.id === filaId);
        if (!fila) {
          await tg("answerCallbackQuery", { callback_query_id: q.id, text: "Esa fila ya no existe, probá de nuevo" });
          return new Response("ok");
        }
        fila.monto = (Number(fila.monto) || 0) + total;
        if (!m.movimientos) m.movimientos = [];
        const movId = uidBot("tgm");
        m.movimientos.push({
          id: movId, fecha: isoHoy(), categoria: s.catElegida, filaId: fila.id, fila: fila.nombre,
          monto: total, nota: s.nota || null, items: s.items.length > 1 ? s.items : null,
        });
        await writeState(proyectoId, st.data, st.rev);
        const cat = CAT_MAP[s.catElegida];
        await tg("editMessageText", {
          chat_id: chat, message_id: mid, parse_mode: "HTML",
          text: `✅ Sumado <b>${money(total)}</b> a <b>${fila.nombre}</b> (${cat.icon} ${cat.label})\nFila total ahora: <b>${money(fila.monto)}</b>\n\n📝 ¿Nota? mandá /nota · 📜 /historial`,
        });
        await tg("answerCallbackQuery", { callback_query_id: q.id, text: "¡Cargado!" });
        await setSesion(chat, { ...sesionVacia(), ultimoGasto: { mes: key, movId } });
        return new Response("ok");
      }

      return new Response("ok");
    }

    // ============ MENSAJES DE TEXTO ============
    const msg = update.message;
    if (!msg || !msg.text) return new Response("ok");
    const chat = msg.chat.id;
    const text = (msg.text as string).trim();

    // --- /start (con o sin código de vinculación) — funciona SIEMPRE,
    // incluso si el chat todavía no está conectado a ningún proyecto,
    // porque es justamente el mecanismo para conectarlo. ---
    const mStart = text.match(/^\/start(?:\s+(\S+))?/i);
    if (mStart) {
      if (mStart[1]) {
        await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: await vincularConCodigo(chat, mStart[1]) });
        return new Response("ok");
      }
      const proyectoIdYaVinculado = await resolverProyecto(chat);
      if (!proyectoIdYaVinculado) {
        await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: SIN_VINCULAR });
        return new Response("ok");
      }
      await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text:
        "👋 <b>Mis Finanzas</b>\n\nMandame lo que vas comprando y te llevo la cuenta:\n<code>2000 arroz</code>\n<code>2300 azúcar, 5000 aceite</code>\n\nPodés seguir agregando en varios mensajes. Cuando termines tocás <b>Sumar al total</b>, elegís la <b>categoría</b> y después en qué <b>fila</b> lo sumo (una que ya tengas, ej. \"Almacén\", o una nueva). Opcional: ponele una <b>nota</b> (ej: Chino de casa).\n\nComandos:\n/historial — tus últimos gastos del mes\n/nota — agregarle una nota al último gasto\n/cancelar — descartar la compra en curso" });
      return new Response("ok");
    }

    if (/^\/help/i.test(text) || /^\/ayuda/i.test(text)) {
      await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text:
        "Mandame lo que vas comprando:\n<code>2000 arroz</code>\n<code>2300 azúcar, 5000 aceite</code>\n\n/historial — tus últimos gastos del mes\n/nota — agregarle una nota al último gasto\n/cancelar — descartar la compra en curso" });
      return new Response("ok");
    }

    // A partir de acá, todo requiere un chat ya conectado a un proyecto.
    const proyectoId = await resolverProyecto(chat);
    if (!proyectoId) {
      await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: SIN_VINCULAR });
      return new Response("ok");
    }
    const s = await getSesion(chat);

    if (/^\/cancelar/i.test(text)) {
      await clearSesion(chat);
      await tg("sendMessage", { chat_id: chat, text: "🗑️ Compra en curso descartada." });
      return new Response("ok");
    }
    if (/^\/resumen/i.test(text) || /^\/saldo/i.test(text)) {
      const st = await readState(proyectoId);
      await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: `📅 <b>${mesActualKey()}</b>\n` + resumenMes(st.data, mesActualKey()) });
      return new Response("ok");
    }
    if (/^\/historial/i.test(text)) {
      const st = await readState(proyectoId);
      const key = mesActualKey();
      const movs = (st.data.meses?.[key]?.movimientos || []).slice(-15).reverse();
      if (!movs.length) { await tg("sendMessage", { chat_id: chat, text: "Todavía no hay movimientos este mes." }); return new Response("ok"); }
      const lines = movs.map((mv: any) => {
        const cat = CAT_MAP[mv.categoria];
        return `• ${fechaCorta(mv.fecha)} · ${mv.fila} — <b>${money(mv.monto)}</b>${cat ? " " + cat.icon : ""}${mv.nota ? ` <i>(${mv.nota})</i>` : ""}`;
      });
      await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: `📜 <b>Historial ${key}</b>\n` + lines.join("\n") });
      return new Response("ok");
    }
    if (/^\/nota/i.test(text)) {
      if (!s.ultimoGasto) { await tg("sendMessage", { chat_id: chat, text: "No hay un gasto reciente para anotar. Cargá una compra primero." }); return new Response("ok"); }
      s.await = "notaGasto"; await setSesion(chat, s);
      await tg("sendMessage", { chat_id: chat, text: "✏️ Escribí la nota para el último gasto:" });
      return new Response("ok");
    }

    // --- esperando una nota (antes de sumar) ---
    if (s.await === "nota") {
      s.nota = text; s.await = null; await setSesion(chat, s);
      await mostrarCarrito(chat, s);
      return new Response("ok");
    }

    // --- esperando el nombre de una fila nueva ---
    if (s.await === "nombreFila") {
      const nombre = text.trim();
      if (!nombre) { await tg("sendMessage", { chat_id: chat, text: "Escribime un nombre para la fila, por favor." }); return new Response("ok"); }
      if (!s.catElegida || !s.items.length) {
        await tg("sendMessage", { chat_id: chat, text: "Se venció la compra en curso, mandala de nuevo 🙂" });
        await clearSesion(chat);
        return new Response("ok");
      }
      const total = totalCarrito(s);
      const st = await readState(proyectoId);
      const key = mesActualKey();
      if (!st.data.meses) st.data.meses = {};
      if (!st.data.meses[key]) st.data.meses[key] = { ingresos: [], gastos: [] };
      const m = st.data.meses[key];
      const gid = uidBot("tg");
      const filaObj = { id: gid, categoria: s.catElegida, nombre, monto: total };
      m.gastos.push(filaObj);
      if (!m.movimientos) m.movimientos = [];
      const movId = uidBot("tgm");
      m.movimientos.push({
        id: movId, fecha: isoHoy(), categoria: s.catElegida, filaId: gid, fila: nombre,
        monto: total, nota: s.nota || null, items: s.items.length > 1 ? s.items : null,
      });
      await writeState(proyectoId, st.data, st.rev);
      const cat = CAT_MAP[s.catElegida];
      await tg("sendMessage", {
        chat_id: chat, parse_mode: "HTML",
        text: `✅ Creé la fila <b>${nombre}</b> en ${cat.icon} <b>${cat.label}</b> con <b>${money(total)}</b>\n\n📝 ¿Nota? mandá /nota · 📜 /historial`,
      });
      await setSesion(chat, { ...sesionVacia(), ultimoGasto: { mes: key, movId } });
      return new Response("ok");
    }

    // --- esperando la nota de un gasto ya cargado (/nota) ---
    if (s.await === "notaGasto") {
      const st = await readState(proyectoId);
      const ug = s.ultimoGasto!;
      const mv = (st.data.meses?.[ug.mes]?.movimientos || []).find((x: any) => x.id === ug.movId);
      if (mv) { mv.nota = text; await writeState(proyectoId, st.data, st.rev); }
      s.await = null; await setSesion(chat, s);
      await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: `📝 Nota agregada: <b>${text}</b>` });
      return new Response("ok");
    }

    // --- "borrá lo último" / "sacá el arroz": saca un ítem del carrito en
    // curso (todavía no confirmado con "Sumar al total") y resta su monto. ---
    const mBorrar = text.match(/^(borra|borrar|saca|sacar|elimina|eliminar|quita|quitar)\b\s*(.*)$/i);
    if (mBorrar) {
      if (!s.items || !s.items.length) {
        await tg("sendMessage", { chat_id: chat, text: "No hay nada en el carrito para borrar todavía." });
        return new Response("ok");
      }
      const resto = mBorrar[2].trim().toLowerCase().replace(/^(lo\s+|el\s+|la\s+|los\s+|las\s+)+/, "");
      const esUltimo = resto === "" || /^(último|ultimo|ultima|última)/.test(resto);
      let idx = esUltimo ? s.items.length - 1 : s.items.findIndex((it) => it.nombre.toLowerCase().includes(resto));
      if (idx === -1) {
        await tg("sendMessage", { chat_id: chat, text: `No encontré "${mBorrar[2].trim()}" en el carrito actual.` });
        return new Response("ok");
      }
      const sacado = s.items[idx];
      s.items.splice(idx, 1);
      await setSesion(chat, s);
      await tg("sendMessage", { chat_id: chat, parse_mode: "HTML", text: `🗑️ Saqué <b>${sacado.nombre}</b> (${money(sacado.monto)}) del carrito.` });
      if (s.items.length) await mostrarCarrito(chat, s);
      else await tg("sendMessage", { chat_id: chat, text: "El carrito quedó vacío." });
      return new Response("ok");
    }

    // --- productos: los sumamos al carrito ---
    const items = parseItems(text);
    if (!items.length) {
      await tg("sendMessage", { chat_id: chat, text: "Mandame el monto y el producto, por ejemplo:\n2000 arroz\no varios: 2000 arroz, 2300 azúcar" });
      return new Response("ok");
    }
    s.items = (s.items || []).concat(items);
    s.await = null;
    await setSesion(chat, s);
    await mostrarCarrito(chat, s);
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("ok");
  }
});
