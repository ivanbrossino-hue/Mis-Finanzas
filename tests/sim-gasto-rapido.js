// Simulador en memoria de Supabase (PostgREST) y Claude para probar la Edge Function gasto-rapido sin servicios reales.
// Lo usan tests/gasto-rapido.test.js (pruebas) y tests/servidor-simulado.js (servidor HTTP local para probar los scripts con curl).
// Se carga nube/gasto-rapido/index.ts (se le sacan los tipos con node:module), y se simulan en memoria
// Deno.serve, PostgREST (proyectos, tokens_atajo, miembros, movimientos_pendientes, rpc) y la API de Anthropic.
// OJO: simula el comportamiento esperado de la base; no reemplaza probar contra Supabase de verdad (ver docs/REGISTRO-RAPIDO.md).
'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mod = require('node:module');

const SB = 'https://fake.supabase.co';
const HASH = (t) => crypto.createHash('sha256').update(t).digest('hex');
const nuevoToken = () => 'mfa_' + crypto.randomBytes(32).toString('base64url');
const PROY = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';

// ---------------- base de datos simulada ----------------
const db = { proyectos: {}, tokens: [], miembros: [], pendientes: [], hooks: { antesDePatch: null }, anthropic: null, anthropicPedidos: 0 };
function limpiarBD(hoyMes) {
  db.proyectos = { [PROY]: { rev: 3, data: {
    version: 1, catNombres: {}, presupuestos: {}, deudas: [], chats: [],
    meses: { [hoyMes.previo]: {
      ingresos: [{ id: 'i1', nombre: 'Sueldo', monto: 300000 }],
      gastos: [
        { id: 'g1', categoria: 'vivienda', nombre: 'Alquiler', monto: 70000 },
        { id: 'g2', categoria: 'alimentacion', nombre: 'Supermercado / almacén', monto: 9000, bot: true },
        { id: 'g3', categoria: 'transporte', nombre: 'Nafta', monto: 5000 },
      ], movimientos: [{ id: 'm0', fecha: hoyMes.previo + '-02', categoria: 'transporte', filaId: 'g3', fila: 'Nafta', monto: 5000, nota: null, items: null }],
    } },
  } } };
  db.tokens = []; db.miembros = [{ id: 'mm1', user_id: USER, proyecto_id: PROY, estado: 'aceptado', rol: 'dueno' }];
  db.pendientes = []; db.hooks.antesDePatch = null; db.anthropic = null; db.anthropicPedidos = 0;
}
function crearToken(alcance = 'gasto', extra = {}) {
  const token = nuevoToken();
  const fila = Object.assign({ id: crypto.randomUUID(), user_id: USER, proyecto_id: PROY, token_hash: HASH(token), dispositivo: 'iPhone de Iván', alcance, revocado: false, pedidos_ventana: 0 }, extra);
  db.tokens.push(fila);
  return { token, fila };
}
function filtrar(filas, params) {
  const ignorar = new Set(['select', 'order', 'limit']);
  return filas.filter((f) => [...params.entries()].every(([k, v]) => {
    if (ignorar.has(k)) return true;
    const val = f[k];
    if (v.startsWith('eq.')) return String(val) === decodeURIComponent(v.slice(3));
    if (v === 'is.null') return val == null;
    if (v === 'not.is.null') return val != null;
    if (v.startsWith('gte.')) return String(val) >= decodeURIComponent(v.slice(4));
    if (v.startsWith('in.(')) return v.slice(4, -1).split(',').includes(String(val));
    throw new Error('filtro no soportado en la simulación: ' + k + '=' + v);
  }));
}
const resp = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });
async function fetchSimulado(url, init = {}) {
  const u = new URL(String(url));
  const metodo = (init.method || 'GET').toUpperCase();
  if (u.origin === 'https://api.anthropic.com') {
    db.anthropicPedidos++;
    const cuerpo = JSON.parse(init.body);
    const salida = db.anthropic ? db.anthropic(cuerpo) : { es_pago: false };
    return resp({ content: [{ type: 'tool_use', name: 'extraer_pago', input: salida }] });
  }
  assert.equal(u.origin, SB, 'la función solo debería hablar con Supabase y Anthropic');
  const ruta = u.pathname.replace('/rest/v1/', '');
  const body = init.body ? JSON.parse(init.body) : null;
  if (ruta === 'rpc/consumir_cupo_atajo') {
    const t = db.tokens.find((x) => x.id === body.p_token_id);
    if (!t || t.revocado) return resp(false);
    t.pedidos_ventana++;
    return resp(t.pedidos_ventana <= body.p_limite);
  }
  if (ruta === 'tokens_atajo') return resp(filtrar(db.tokens, u.searchParams));
  if (ruta === 'miembros') {
    const rolOk = u.searchParams.get('rol');                    // rol=in.(dueno,editor)
    const p = new URLSearchParams(u.searchParams); p.delete('rol');
    let r = filtrar(db.miembros, p);
    if (rolOk) r = r.filter((m) => rolOk.slice(4, -1).split(',').includes(m.rol));
    return resp(r);
  }
  if (ruta === 'proyectos') {
    const id = u.searchParams.get('id').slice(3);
    const pr = db.proyectos[id];
    if (metodo === 'GET') return resp(pr ? [JSON.parse(JSON.stringify(pr))] : []);
    if (metodo === 'PATCH') {
      if (db.hooks.antesDePatch) await db.hooks.antesDePatch();
      const revEsperado = Number(u.searchParams.get('rev').slice(3));
      if (!pr || pr.rev !== revEsperado) return resp([]);        // 0 filas: conflicto
      pr.data = JSON.parse(JSON.stringify(body.data)); pr.rev = body.rev; pr.updated_by = body.updated_by;
      return resp([{ rev: pr.rev }]);
    }
  }
  if (ruta === 'movimientos_pendientes') {
    if (metodo === 'GET') {
      let r = filtrar(db.pendientes, u.searchParams);
      const orden = u.searchParams.get('order');
      if (orden && orden.startsWith('creado_en.desc')) r = r.slice().sort((a, b) => (a.creado_en < b.creado_en ? 1 : -1));
      if (orden && orden.startsWith('resuelto_en.desc')) r = r.slice().sort((a, b) => String(b.resuelto_en) < String(a.resuelto_en) ? -1 : 1);
      const lim = Number(u.searchParams.get('limit') || 1e9);
      return resp(r.slice(0, lim));
    }
    if (metodo === 'POST') {
      if (db.pendientes.some((x) => x.proyecto_id === body.proyecto_id && x.huella === body.huella)) return resp({ code: '23505' }, 409);
      const fila = Object.assign({ id: crypto.randomUUID(), estado: 'pendiente', creado_en: new Date().toISOString(), categoria_final: null, fila_final: null, movimiento_id: null, resuelto_en: null, resuelto_por: null }, body);
      db.pendientes.push(fila);
      return resp([fila], 201);
    }
    if (metodo === 'PATCH') {
      const r = filtrar(db.pendientes, u.searchParams); r.forEach((f) => Object.assign(f, body));
      return resp(r.map((x) => ({ id: x.id })));
    }
  }
  throw new Error('petición no simulada: ' + metodo + ' ' + u.pathname + u.search);
}

// ---------------- carga de la función ----------------
let manejador = null;
const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'service-role-falsa', ANTHROPIC_API_KEY: 'clave-falsa' };
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (fn) => { manejador = fn; } };
globalThis.fetch = fetchSimulado;
const ts = fs.readFileSync(path.join(__dirname, '..', 'nube', 'gasto-rapido', 'index.ts'), 'utf8');
const js = mod.stripTypeScriptTypes(ts, { mode: 'transform' });
vm.runInThisContext(js + '\nglobalThis.__f = { evaluarMonto, hoyAR, aplicarDeshacer };', { filename: 'gasto-rapido.js' });
const F = globalThis.__f;

module.exports = { db, limpiarBD, crearToken, nuevoToken, HASH, SB, PROY, USER, F: globalThis.__f, manejador: () => manejador };
