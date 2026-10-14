// Pruebas del bot de Telegram (nube/telegram-bot/index.ts) SIN Telegram ni Supabase reales:  node tests/telegram-bot.test.js
// Se carga el .ts (sin tipos) y se simulan en memoria Deno.serve, la API de Telegram, las tablas del bot y `proyectos`
// con UPDATE condicional por rev. Verifica la escritura segura: no pisa lo de otro y, si no puede guardar, NO dice "cargado".
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mod = require('node:module');

const SB = 'https://fake.supabase.co';
const CHAT = 111, PROY = 'proy-1';
const env = { SUPABASE_URL: SB, SUPABASE_SERVICE_ROLE_KEY: 'sr', TELEGRAM_TOKEN: 'tgtoken', WEBHOOK_SECRET: '' };
let handler = null;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (fn) => { handler = fn; } };
const db = { proyecto: null, sesion: null, patches: 0, antesDePatch: null, patchHttp500: false, enviados: [] };

const resp = (c, s = 200) => new Response(JSON.stringify(c), { status: s, headers: { 'Content-Type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const m = (init.method || 'GET').toUpperCase();
  const body = init.body ? JSON.parse(init.body) : null;
  if (u.origin === 'https://api.telegram.org') {
    db.enviados.push({ metodo: u.pathname.split('/').pop(), ...body });
    return resp({ ok: true, result: { message_id: 99 } });
  }
  assert.equal(u.origin, SB);
  const ruta = u.pathname.replace('/rest/v1/', '');
  if (ruta === 'bot_vinculos') return resp([{ proyecto_id: PROY }]);
  if (ruta === 'pending_bot') {
    if (m === 'GET') return resp(db.sesion ? [{ sesion: JSON.parse(JSON.stringify(db.sesion)) }] : []);
    if (m === 'POST') { db.sesion = body[0].sesion; return resp(null, 201); }
    if (m === 'DELETE') { db.sesion = null; return resp(null, 204); }
  }
  if (ruta === 'proyectos') {
    if (m === 'GET') return resp([JSON.parse(JSON.stringify(db.proyecto))]);
    if (m === 'PATCH') {
      db.patches++;
      if (db.antesDePatch) db.antesDePatch();
      if (db.patchHttp500) return resp({ error: 'boom' }, 500);
      const rev = Number(u.searchParams.get('rev')?.slice(3));
      assert.ok(u.searchParams.has('rev'), 'el guardado del bot tiene que ser condicional por rev (WHERE rev = el leído)');
      if (db.proyecto.rev !== rev) return resp([]);          // 0 filas: conflicto
      db.proyecto = { data: JSON.parse(JSON.stringify(body.data)), rev: body.rev };
      return resp([{ rev: body.rev }]);
    }
  }
  throw new Error('no simulado: ' + m + ' ' + u.pathname + u.search);
};

const ts = fs.readFileSync(process.env.BOT_FILE || path.join(__dirname, '..', 'nube', 'telegram-bot', 'index.ts'), 'utf8');   // BOT_FILE: probar otra versión del bot
vm.runInThisContext(mod.stripTypeScriptTypes(ts, { mode: 'transform' }), { filename: 'telegram-bot.js' });

// ---- helpers ----
const hoy = new Date(Date.now() - 3 * 3600 * 1000);
const MES = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
function reiniciar() {
  db.proyecto = { rev: 7, data: { version: 1, deudas: [], catNombres: {}, meses: { [MES]: {
    ingresos: [], gastos: [{ id: 'g2', categoria: 'alimentacion', nombre: 'Almacén', monto: 10000 }], movimientos: [],
  } } } };
  db.sesion = { items: [{ nombre: 'arroz', monto: 2000 }, { nombre: 'fideos', monto: 500 }], nota: null, await: null, msgId: 5, catElegida: 'alimentacion', filaIds: ['g2'], ultimoGasto: null };
  db.patches = 0; db.antesDePatch = null; db.patchHttp500 = false; db.enviados = [];
}
const post = (update) => handler(new Request('https://f/telegram-bot', { method: 'POST', body: JSON.stringify(update), headers: { 'Content-Type': 'application/json' } }));
const tocarFila = (data = 'row:0') => post({ callback_query: { id: 'cq1', data, message: { chat: { id: CHAT }, message_id: 5 } } });
const escribir = (text) => post({ message: { chat: { id: CHAT }, text } });
const textos = () => db.enviados.map((e) => e.text || '').join('\n');
// Otra persona (la app, el atajo) escribe justo antes del guardado del bot
function otraPersonaSuma(monto, id) {
  return () => {
    const m = db.proyecto.data.meses[MES];
    m.gastos[0].monto += monto;
    m.movimientos.push({ id, fecha: '2026-01-01', categoria: 'alimentacion', filaId: 'g2', fila: 'Almacén', monto, nota: null, items: null });
    db.proyecto.rev += 1;
  };
}

let ok = 0, fallos = 0;
async function prueba(nombre, fn) {
  reiniciar();
  try { await fn(); ok++; console.log('  ✔ ' + nombre); } catch (e) { fallos++; console.log('  ✘ ' + nombre + '\n      ' + String(e.message).split('\n').join('\n      ')); }
}

(async () => {
  console.log('telegram-bot — pruebas (simuladas)');

  await prueba('Sumar a una fila existente: guarda con UPDATE condicional y confirma', async () => {
    await tocarFila();
    assert.equal(db.proyecto.data.meses[MES].gastos[0].monto, 12500);
    assert.equal(db.proyecto.data.meses[MES].movimientos.length, 1);
    assert.equal(db.proyecto.rev, 8);
    assert.equal(db.patches, 1);
    assert.match(textos(), /Sumado/);
    assert.equal(db.sesion.items.length, 0, 'la compra en curso se cierra');
  });

  await prueba('Conflicto de rev: otra persona escribe justo antes -> el bot relee, reaplica y NO pisa lo del otro', async () => {
    let primera = true;
    db.antesDePatch = () => { if (primera) { primera = false; otraPersonaSuma(700, 'mov-de-otro')(); } };
    await tocarFila();
    const m = db.proyecto.data.meses[MES];
    assert.equal(m.gastos[0].monto, 10000 + 700 + 2500, 'suma lo de los dos');
    assert.deepEqual(m.movimientos.map((x) => x.id).sort().filter((x) => x === 'mov-de-otro').length, 1, 'el movimiento del otro sigue ahí');
    assert.equal(m.movimientos.length, 2);
    assert.equal(db.patches, 2, 'un intento perdido y uno ganado');
    assert.equal(db.proyecto.rev, 9);
    const editado = db.enviados.find((e) => e.metodo === 'editMessageText');
    assert.match(editado.text, /Sumado/);
    assert.match(editado.text, /\$ 13\.200/, 'la fila total que muestra incluye lo del otro');
  });

  await prueba('Sin poder guardar tras los 3 reintentos: NO dice "cargado", avisa, no escribe y conserva la compra para reintentar', async () => {
    db.antesDePatch = () => { db.proyecto.rev += 1; };           // siempre pierde la carrera
    await tocarFila();
    assert.equal(db.patches, 4, '1 intento + 3 reintentos');
    assert.doesNotMatch(textos(), /Sumado|cargad|Creé/i);
    const alerta = db.enviados.find((e) => e.metodo === 'answerCallbackQuery');
    assert.equal(alerta.show_alert, true); assert.match(alerta.text, /No se guardó/);
    assert.match(textos(), /No se guardó.*probá de nuevo/s);
    assert.equal(db.proyecto.data.meses[MES].gastos[0].monto, 10000, 'el bot no escribió nada');
    assert.equal(db.proyecto.data.meses[MES].movimientos.length, 0);
    assert.equal(db.sesion.items.length, 2, 'la compra en curso quedó para volver a tocar la fila');
    assert.ok(!db.enviados.some((e) => e.metodo === 'editMessageText'), 'no se editó el mensaje a "listo"');
    // y cuando la carrera se termina, al tocar de nuevo se guarda bien
    db.antesDePatch = null; db.enviados = [];
    await tocarFila();
    assert.equal(db.proyecto.data.meses[MES].gastos[0].monto, 12500);
    assert.match(textos(), /Sumado/);
  });

  await prueba('Error HTTP del guardado (500) repetido: tampoco dice "cargado"', async () => {
    db.patchHttp500 = true;
    await tocarFila();
    assert.equal(db.patches, 4);
    assert.doesNotMatch(textos(), /Sumado|cargad/i); assert.match(textos(), /No se guardó/);
    assert.equal(db.sesion.items.length, 2);
  });

  await prueba('La fila ya no existe: avisa y no escribe', async () => {
    db.sesion.filaIds = ['g-borrada'];
    await tocarFila();
    assert.equal(db.patches, 0);
    assert.match(db.enviados.find((e) => e.metodo === 'answerCallbackQuery').text, /ya no existe/);
    assert.doesNotMatch(textos(), /Sumado/);
  });

  await prueba('Fila nueva con un conflicto de rev: se crea y no se pierde lo del otro', async () => {
    db.sesion.await = 'nombreFila';
    let primera = true;
    db.antesDePatch = () => { if (primera) { primera = false; otraPersonaSuma(300, 'mov-de-otro')(); } };
    await escribir('Verdulería');
    const m = db.proyecto.data.meses[MES];
    assert.equal(m.gastos.length, 2); assert.equal(m.gastos[1].nombre, 'Verdulería'); assert.equal(m.gastos[1].monto, 2500);
    assert.equal(m.gastos[0].monto, 10300);
    assert.equal(m.movimientos.length, 2);
    assert.match(textos(), /Creé la fila/);
  });

  await prueba('Fila nueva sin poder guardar: no dice "creé", y sigue esperando el nombre para reintentar', async () => {
    db.sesion.await = 'nombreFila';
    db.antesDePatch = () => { db.proyecto.rev += 1; };
    await escribir('Verdulería');
    assert.doesNotMatch(textos(), /Creé|cargad/i); assert.match(textos(), /No se guardó/);
    assert.equal(db.proyecto.data.meses[MES].gastos.length, 1);
    assert.equal(db.sesion.await, 'nombreFila');
    db.antesDePatch = null; db.enviados = [];
    await escribir('Verdulería');
    assert.match(textos(), /Creé la fila/);
    assert.equal(db.proyecto.data.meses[MES].gastos.length, 2);
  });

  await prueba('Fila nueva en un mes que todavía no existe: lo crea (comportamiento de siempre)', async () => {
    db.sesion.await = 'nombreFila';
    db.proyecto.data.meses = {};
    await escribir('Kiosco');
    assert.equal(db.proyecto.data.meses[MES].gastos[0].nombre, 'Kiosco');
    assert.match(textos(), /Creé la fila/);
  });

  await prueba('/nota del último gasto: conflicto de rev -> se guarda; sin poder guardar -> avisa y sigue esperando la nota', async () => {
    db.proyecto.data.meses[MES].movimientos.push({ id: 'tgm1', fecha: '2026-01-01', categoria: 'alimentacion', filaId: 'g2', fila: 'Almacén', monto: 1, nota: null, items: null });
    db.sesion = { items: [], nota: null, await: 'notaGasto', msgId: null, catElegida: null, filaIds: [], ultimoGasto: { mes: MES, movId: 'tgm1' } };
    let primera = true;
    db.antesDePatch = () => { if (primera) { primera = false; otraPersonaSuma(50, 'mov-de-otro')(); } };
    await escribir('Chino de casa');
    const m = db.proyecto.data.meses[MES];
    assert.equal(m.movimientos.find((x) => x.id === 'tgm1').nota, 'Chino de casa');
    assert.ok(m.movimientos.some((x) => x.id === 'mov-de-otro'));
    assert.match(textos(), /Nota agregada/);
    // sin poder guardar
    reiniciar();
    db.proyecto.data.meses[MES].movimientos.push({ id: 'tgm1', fecha: '2026-01-01', categoria: 'alimentacion', filaId: 'g2', fila: 'Almacén', monto: 1, nota: null, items: null });
    db.sesion = { items: [], nota: null, await: 'notaGasto', msgId: null, catElegida: null, filaIds: [], ultimoGasto: { mes: MES, movId: 'tgm1' } };
    db.antesDePatch = () => { db.proyecto.rev += 1; };
    await escribir('otra nota');
    assert.doesNotMatch(textos(), /Nota agregada/); assert.match(textos(), /No se guardó la nota/);
    assert.equal(db.sesion.await, 'notaGasto');
    assert.equal(db.proyecto.data.meses[MES].movimientos[0].nota, null);
  });

  await prueba('Lecturas (/historial, /resumen) siguen funcionando y no escriben', async () => {
    await escribir('/resumen');
    await escribir('/historial');
    assert.equal(db.patches, 0);
    assert.match(textos(), /Gastos del mes/);
  });

  console.log(`\n${ok} bien, ${fallos} con falla`);
  process.exit(fallos ? 1 : 0);
})();
