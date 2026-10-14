// Pruebas de la sincronización segura (movil/sync-merge.js). Se corren con:  node tests/sync-merge.test.js
// No necesitan red ni Supabase: la base de datos se simula en memoria con la misma semántica de
// "UPDATE ... WHERE rev = el_que_lei" (si el rev no coincide, no actualiza nada).
'use strict';
const assert = require('node:assert/strict');
const { merge, sincronizar, clone } = require('../movil/sync-merge.js');

let ok = 0, fallos = 0;
async function prueba(nombre, fn) {
  try { await fn(); ok++; console.log('  ✔ ' + nombre); }
  catch (e) { fallos++; console.log('  ✘ ' + nombre + '\n      ' + String(e.message).split('\n').join('\n      ')); }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Base de datos simulada ----
function crearDB(data, rev) {
  const db = { data: clone(data), rev, escrituras: 0, onLeer: null, onEscribir: null };
  db.leer = async () => { if (db.onLeer) await db.onLeer(); return { data: clone(db.data), rev: db.rev }; };
  db.escribirCond = async (data, revEsperado) => {
    if (db.onEscribir) await db.onEscribir();
    if (db.rev !== revEsperado) return { conflicto: true };       // 0 filas actualizadas
    db.data = clone(data); db.rev = revEsperado + 1; db.escrituras++;
    return { ok: true, rev: db.rev };
  };
  return db;
}
// ---- Un "cliente" (una app, el atajo...) con su estado, su base y su rev ----
function cliente(db, estadoInicial, revInicial) {
  const c = { estado: clone(estadoInicial), base: clone(estadoInicial), rev: revInicial };
  c.guardar = (extra) => sincronizar(Object.assign({
    getLocal: () => c.estado, setLocal: (e) => { c.estado = e; },
    getBase: () => c.base, setBase: (b) => { c.base = b; },
    getRev: () => c.rev, setRev: (n) => { c.rev = n; },
    escribir: (d, r) => db.escribirCond(d, r), leerRemoto: () => db.leer(),
  }, extra || {}));
  return c;
}
const mes = (m) => m;
function estadoBase() {
  return {
    version: 1, catNombres: {}, presupuestos: { alimentacion: 100000 }, deudas: [{ id: 'd1', nombre: 'Naranja', saldo: 5000 }],
    chats: [],
    meses: {
      '2026-10': {
        ingresos: [{ id: 'i1', nombre: 'Sueldo', monto: 300000 }],
        gastos: [
          { id: 'g1', categoria: 'vivienda', nombre: 'Alquiler', monto: 70000 },
          { id: 'g2', categoria: 'alimentacion', nombre: 'Supermercado', monto: 10000, bot: true },
          { id: 'g3', categoria: 'transporte', nombre: 'Nafta', monto: 5000 },
        ],
        movimientos: [{ id: 'm0', fecha: '2026-10-01', categoria: 'alimentacion', filaId: 'g2', fila: 'Supermercado', monto: 10000, nota: null, items: null }],
      },
    },
  };
}
const filas = (e, k = '2026-10') => e.meses[k].gastos;
const fila = (e, id, k = '2026-10') => e.meses[k].gastos.find((g) => g.id === id);
function sumarGasto(e, filaId, monto, movId, extra = {}) {   // lo que hace registrarCompra / el atajo
  const m = e.meses['2026-10'];
  const f = m.gastos.find((g) => g.id === filaId);
  f.monto += monto;
  m.movimientos.push(Object.assign({ id: movId, fecha: '2026-10-13', categoria: f.categoria, filaId, fila: f.nombre, monto, nota: null, items: null }, extra));
}

(async () => {
  console.log('Sincronización segura — pruebas');

  await prueba('1. Dos escrituras simultáneas: no se pierde ninguna', async () => {
    const e0 = estadoBase();
    const db = crearDB(e0, 5);
    const a = cliente(db, e0, 5), b = cliente(db, e0, 5);
    sumarGasto(a.estado, 'g2', 1500, 'mA');          // la persona A anota 1500 en el super
    sumarGasto(b.estado, 'g3', 4000, 'mB');          // el atajo de B anota 4000 de nafta
    db.onEscribir = async () => { await espera(5); };  // las dos escrituras salen "a la vez"
    const [ra, rb] = await Promise.all([a.guardar(), b.guardar()]);
    assert.ok(ra.ok && rb.ok, 'las dos tienen que terminar bien');
    assert.equal(db.escrituras, 2);
    assert.equal(fila(db.data, 'g2').monto, 11500);
    assert.equal(fila(db.data, 'g3').monto, 9000);
    const ids = db.data.meses['2026-10'].movimientos.map((m) => m.id).sort();
    assert.deepEqual(ids, ['m0', 'mA', 'mB']);
    assert.equal(db.rev, 7);
    assert.ok(ra.mergeado || rb.mergeado, 'una de las dos debió fusionar');
  });

  await prueba('2. Borrado local contra alta remota: se aplica el borrado y se conserva el alta', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const local = cliente(db, e0, 1), remoto = cliente(db, e0, 1);
    local.estado.meses['2026-10'].gastos = local.estado.meses['2026-10'].gastos.filter((g) => g.id !== 'g3');   // borra Nafta
    remoto.estado.meses['2026-10'].gastos.push({ id: 'g9', categoria: 'salud', nombre: 'Farmacia', monto: 0 });     // alta remota
    assert.ok((await remoto.guardar()).ok);
    const r = await local.guardar();
    assert.ok(r.ok && r.mergeado);
    const nombres = filas(db.data).map((g) => g.id).sort();
    assert.deepEqual(nombres, ['g1', 'g2', 'g9']);
  });

  await prueba('2b. Una baja local de algo que nadie tocó no "resucita"', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const local = cliente(db, e0, 1), remoto = cliente(db, e0, 1);
    local.estado.deudas = [];                                                  // borra la deuda
    remoto.estado.presupuestos.alimentacion = 120000;                          // otro cambio distinto
    assert.ok((await remoto.guardar()).ok);
    assert.ok((await local.guardar()).ok);
    assert.deepEqual(db.data.deudas, []);
    assert.equal(db.data.presupuestos.alimentacion, 120000);
  });

  await prueba('3. Borrado remoto contra edición local: se conserva la edición (no se pierde el dato)', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const local = cliente(db, e0, 1), remoto = cliente(db, e0, 1);
    remoto.estado.meses['2026-10'].gastos = remoto.estado.meses['2026-10'].gastos.filter((g) => g.id !== 'g3');   // remoto borra Nafta
    local.estado.meses['2026-10'].gastos.find((g) => g.id === 'g3').nombre = 'Nafta Shell';                         // local la edita
    assert.ok((await remoto.guardar()).ok);
    assert.ok((await local.guardar()).ok);
    assert.equal(fila(db.data, 'g3').nombre, 'Nafta Shell');
  });

  await prueba('3b. Borrado remoto de algo que el local no tocó: queda borrado', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const local = cliente(db, e0, 1), remoto = cliente(db, e0, 1);
    remoto.estado.meses['2026-10'].gastos = remoto.estado.meses['2026-10'].gastos.filter((g) => g.id !== 'g3');
    local.estado.presupuestos.transporte = 40000;
    assert.ok((await remoto.guardar()).ok);
    assert.ok((await local.guardar()).ok);
    assert.equal(fila(db.data, 'g3'), undefined);
    assert.equal(db.data.presupuestos.transporte, 40000);
  });

  await prueba('4. Suma de monto en ambos lados: se aplica el delta, no gana lo local', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const local = cliente(db, e0, 1), atajo = cliente(db, e0, 1);
    sumarGasto(atajo.estado, 'g2', 2500, 'mAtajo', { origen: 'atajo-ios', dispositivo: 'iPhone de Iván', creadoEn: '2026-10-13T15:00:00Z' });
    sumarGasto(local.estado, 'g2', 800, 'mLocal');
    assert.ok((await atajo.guardar()).ok);
    const r = await local.guardar();
    assert.ok(r.ok && r.mergeado);
    assert.equal(fila(db.data, 'g2').monto, 10000 + 2500 + 800);
    assert.equal(db.data.meses['2026-10'].movimientos.length, 3);
    // y lo que el cliente local tiene en memoria es lo mismo que quedó en la base
    assert.deepEqual(local.estado, db.data);
  });

  await prueba('4b. Un campo de texto cambiado en ambos lados: gana lo local', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const local = cliente(db, e0, 1), remoto = cliente(db, e0, 1);
    remoto.estado.meses['2026-10'].gastos[0].nombre = 'Alquiler (remoto)';
    local.estado.meses['2026-10'].gastos[0].nombre = 'Alquiler (local)';
    assert.ok((await remoto.guardar()).ok);
    assert.ok((await local.guardar()).ok);
    assert.equal(fila(db.data, 'g1').nombre, 'Alquiler (local)');
  });

  await prueba('5. El rev retrocede (base restaurada): se adopta el del servidor y no se pierde nada', async () => {
    const e0 = estadoBase();
    const db = crearDB(e0, 7);                         // el servidor está en 7...
    const local = cliente(db, e0, 10);                 // ...pero este cliente cree que va por 10
    sumarGasto(local.estado, 'g3', 3000, 'mL');
    const r = await local.guardar();
    assert.ok(r.ok && r.mergeado);
    assert.equal(db.rev, 8);                           // 7 + 1, no 11
    assert.equal(local.rev, 8);
    assert.equal(fila(db.data, 'g3').monto, 8000);
  });

  await prueba('6. Tres reintentos fallidos: avisa, no pierde lo local y no escribe a ciegas', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const local = cliente(db, e0, 1);
    sumarGasto(local.estado, 'g2', 700, 'mL');
    // Cada vez que se lee el remoto, otra persona ya escribió de nuevo (la carrera nunca se gana)
    let n = 0;
    db.onLeer = async () => { n++; db.data.meses['2026-10'].gastos[0].monto += 1; db.rev += 1; };
    db.onEscribir = async () => { db.data.meses['2026-10'].gastos[2].monto += 1; db.rev += 1; };   // y también justo antes de cada escritura
    const r = await local.guardar();
    assert.equal(r.ok, false);
    assert.equal(r.conflicto, true);
    assert.equal(r.intentos, 4);                       // 1 intento + 3 reintentos
    assert.equal(db.escrituras, 0, 'no se escribió nada');
    assert.equal(fila(local.estado, 'g2').monto, 10700, 'lo local sigue en memoria');
    assert.ok(local.estado.meses['2026-10'].movimientos.some((m) => m.id === 'mL'));
    // Cuando la carrera termina, el siguiente guardado funciona
    db.onLeer = null; db.onEscribir = null;
    const r2 = await local.guardar();
    assert.ok(r2.ok);
    assert.equal(fila(db.data, 'g2').monto, 10700);
    assert.ok(db.data.meses['2026-10'].movimientos.some((m) => m.id === 'mL'));
  });

  await prueba('7. Campos desconocidos de un movimiento (origen, dispositivo, creadoEn) sobreviven a la fusión y a un ciclo bajar/guardar', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const atajo = cliente(db, e0, 1), app = cliente(db, e0, 1);
    sumarGasto(atajo.estado, 'g3', 1200, 'mX', { origen: 'atajo-ios', dispositivo: 'iPhone', creadoEn: '2026-10-13T12:00:00.000Z' });
    assert.ok((await atajo.guardar()).ok);
    // la app "baja" el estado remoto, no cambia nada y después guarda otro cambio cualquiera
    const bajado = await db.leer();
    app.estado = bajado.data; app.base = clone(bajado.data); app.rev = bajado.rev;
    app.estado.presupuestos.transporte = 1;
    assert.ok((await app.guardar()).ok);
    const mv = db.data.meses['2026-10'].movimientos.find((m) => m.id === 'mX');
    assert.equal(mv.origen, 'atajo-ios'); assert.equal(mv.dispositivo, 'iPhone'); assert.equal(mv.creadoEn, '2026-10-13T12:00:00.000Z');
    // y por la vía de la fusión (la app tenía una copia vieja):
    const viejo = cliente(db, e0, 1);
    viejo.estado.presupuestos.salud = 5;
    assert.ok((await viejo.guardar()).ok);
    const mv2 = db.data.meses['2026-10'].movimientos.find((m2) => m2.id === 'mX');
    assert.equal(mv2.origen, 'atajo-ios');
    assert.equal(db.data.presupuestos.salud, 5);
  });

  await prueba('8. Mes creado a la vez por la app y por el atajo: no se duplican las filas y se suman los gastos', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const app = cliente(db, e0, 1), atajo = cliente(db, e0, 1);
    const clonarMes = (e, pref) => ({
      ingresos: e.meses['2026-10'].ingresos.map((i, n) => ({ id: pref + 'i' + n, nombre: i.nombre, monto: i.monto })),
      gastos: e.meses['2026-10'].gastos.map((g, n) => ({ id: pref + 'g' + n, categoria: g.categoria, nombre: g.nombre, monto: g.bot ? 0 : g.monto, bot: g.bot })),
      movimientos: [],
    });
    atajo.estado.meses['2026-11'] = Object.assign(clonarMes(atajo.estado, 'S'), { creadoPor: 'atajo' });
    app.estado.meses['2026-11'] = clonarMes(app.estado, 'A');
    const fS = atajo.estado.meses['2026-11'].gastos[1]; fS.monto += 2000;
    atajo.estado.meses['2026-11'].movimientos.push({ id: 'mS', fecha: '2026-11-01', categoria: 'alimentacion', filaId: fS.id, fila: fS.nombre, monto: 2000, origen: 'atajo-ios' });
    const fA = app.estado.meses['2026-11'].gastos[1]; fA.monto += 500;
    app.estado.meses['2026-11'].movimientos.push({ id: 'mA', fecha: '2026-11-01', categoria: 'alimentacion', filaId: fA.id, fila: fA.nombre, monto: 500 });
    assert.ok((await atajo.guardar()).ok);
    const r = await app.guardar();
    assert.ok(r.ok && r.mergeado);
    const nov = db.data.meses['2026-11'];
    assert.equal(nov.gastos.length, 3, 'sin filas duplicadas');
    assert.equal(nov.ingresos.length, 1);
    assert.equal(nov.gastos.find((g) => g.categoria === 'alimentacion').monto, 2500);
    assert.equal(nov.movimientos.length, 2);
    const fid = nov.gastos.find((g) => g.categoria === 'alimentacion').id;
    assert.ok(nov.movimientos.every((m) => m.filaId === fid), 'los movimientos apuntan a la fila unificada');
    assert.equal(nov.creadoPor, 'atajo');
  });

  await prueba('9. Un error de red no se toma por conflicto ni descarta nada', async () => {
    const e0 = estadoBase(); const db = crearDB(e0, 1);
    const c = cliente(db, e0, 1);
    sumarGasto(c.estado, 'g2', 1, 'mR');
    const r = await c.guardar({ escribir: async () => { throw new Error('sin red'); } });
    assert.equal(r.ok, false); assert.equal(r.conflicto, undefined); assert.match(r.error, /sin red/);
    assert.ok(c.estado.meses['2026-10'].movimientos.some((m) => m.id === 'mR'));
  });

  await prueba('10. Sin base (primer arranque del dispositivo): se unen los datos y gana lo local en conflictos', async () => {
    const e0 = estadoBase();
    const remoto = clone(e0); remoto.meses['2026-10'].gastos.push({ id: 'gR', categoria: 'salud', nombre: 'Farmacia', monto: 0 });
    const local = clone(e0); local.meses['2026-10'].gastos[0].nombre = 'Alquiler local';
    const r = merge(null, local, remoto);
    assert.equal(r.meses['2026-10'].gastos.length, 4);
    assert.equal(r.meses['2026-10'].gastos[0].nombre, 'Alquiler local');
  });

  console.log(`\n${ok} bien, ${fallos} con falla`);
  process.exit(fallos ? 1 : 0);
})();
