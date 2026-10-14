// ============================================================
//  Mis Finanzas — Precio de un producto por código de barras (EAN) o por nombre
//  La llama la app (escáner del chat) con {ean, super} o {texto, super}.
//  Consulta el catálogo público de la tienda online del supermercado (todas estas usan VTEX).
//  Coto NO está soportado: su web no tiene un catálogo consultable de esta forma.
//  Deploy con verify_jwt ACTIVADO (valor por defecto del CLI). No usa secretos propios.
//  IMPORTANTE: es el precio de la tienda ONLINE; el de la góndola de tu sucursal puede diferir.
// ============================================================
const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TIENDAS: Record<string, { nombre: string; host: string }> = {
  carrefour: { nombre: "Carrefour", host: "https://www.carrefour.com.ar" },
  dia: { nombre: "Día", host: "https://diaonline.supermercadosdia.com.ar" },
  jumbo: { nombre: "Jumbo", host: "https://www.jumbo.com.ar" },
  vea: { nombre: "Vea", host: "https://www.vea.com.ar" },
  disco: { nombre: "Disco", host: "https://www.disco.com.ar" },
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

// deno-lint-ignore no-explicit-any
function resumir(p: any, tienda: string) {
  const item = (p.items || [])[0] || {};
  const oferta = ((item.sellers || [])[0] || {}).commertialOffer || {};
  const precio = Number(oferta.Price) || 0;
  return {
    nombre: String(p.productName || "").slice(0, 120),
    marca: String(p.brand || "").slice(0, 60),
    ean: String(item.ean || ""),
    precio: Math.round(precio),
    precioLista: Math.round(Number(oferta.ListPrice) || 0),
    disponible: (Number(oferta.AvailableQuantity) || 0) > 0 && precio > 0,
    tienda,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "falta autenticación" }, 401);
    const userRes = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } });
    if (!userRes.ok) return json({ error: "sesión inválida" }, 401);

    const body = await req.json().catch(() => ({}));
    const clave = String(body.super || "carrefour").toLowerCase();
    const tienda = TIENDAS[clave];
    if (!tienda) return json({ error: "Ese supermercado no tiene consulta de precios automática.", code: "no_soportado" }, 200);

    const ean = String(body.ean || "").replace(/\D/g, "");
    const texto = String(body.texto || "").replace(/\s+/g, " ").trim().slice(0, 80);
    let url: string;
    if (ean) {
      if (ean.length < 8 || ean.length > 14) return json({ error: "código de barras inválido" }, 400);
      url = `${tienda.host}/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`;
    } else if (texto) {
      url = `${tienda.host}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(texto)}&_from=0&_to=4`;
    } else {
      return json({ error: "falta ean o texto" }, 400);
    }

    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, signal: AbortSignal.timeout(9000) });
    if (!r.ok && r.status !== 206) return json({ error: "la tienda no respondió", code: "upstream" }, 200);
    const lista = await r.json().catch(() => []);
    // deno-lint-ignore no-explicit-any
    const productos = (Array.isArray(lista) ? lista : []).map((p: any) => resumir(p, tienda.nombre));
    if (!productos.length) return json({ encontrado: false, tienda: tienda.nombre, ean }, 200);
    return json({ encontrado: true, ...productos[0], otros: productos.slice(1, 4) }, 200);
  } catch (e) {
    console.error(e);
    return json({ error: "no pude consultar el precio", code: "upstream" }, 200);
  }
});
