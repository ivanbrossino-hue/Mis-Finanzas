// Sincronización segura de `estado` con el proyecto compartido (Supabase `proyectos`).
//
// Problema que resuelve: varios escritores (la app de cada persona, el atajo del iPhone, el detector de Android)
// cambian la MISMA fila `proyectos.data`. Si cada uno sube su copia entera "a ciegas", el último pisa a los demás.
//
// Cómo: (1) se guarda con condición (`UPDATE ... WHERE rev = el_que_lei`), y (2) si alguien se adelantó, se hace una
// FUSIÓN DE TRES VÍAS: base (último estado sincronizado) + local (lo que tengo ahora) + remoto (lo recién bajado).
// Se calculan los cambios locales respecto de la base (altas, ediciones y bajas) y se aplican sobre lo remoto.
//
// Reglas de la fusión:
//  - Listas con `id` (ingresos, gastos, movimientos, deudas, items de la lista de compras...): se fusionan por id.
//      · alta local o alta remota  -> se conserva
//      · baja local de algo que el remoto no tocó -> queda borrado (no "resucita")
//      · baja de un lado + edición del otro -> gana la edición (no se pierde un dato por un borrado ajeno)
//  - `monto` de una fila de `gastos` (acumuladora: las compras se SUMAN): si cambió en ambos lados se aplica el delta
//    (local - base) sobre el valor remoto, así no se pierde lo que sumó el otro.
//  - Cualquier otro campo cambiado en ambos lados con valores distintos: gana lo local.
//  - Campos desconocidos (ej. origen, dispositivo, creadoEn de un movimiento) se conservan tal cual: la fusión es genérica.
//  - Un mes creado a la vez en los dos lados (cada uno copia el mes anterior con ids nuevos) se unifica por categoría+nombre.
//  - Sin base (nunca sincronizó en este dispositivo) no se pueden detectar bajas: se une todo y gana lo local en conflictos.
(function (root) {
  'use strict';

  function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function esObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function eq(a, b) {
    if (a === b) return true;
    if (a === undefined || b === undefined || a === null || b === null) return false;
    if (typeof a !== typeof b) return false;
    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false;
      for (var i = 0; i < a.length; i++) if (!eq(a[i], b[i])) return false;
      return true;
    }
    if (esObj(a)) {
      if (!esObj(b)) return false;
      var ka = Object.keys(a), kb = Object.keys(b);
      if (ka.length !== kb.length) return false;
      for (var j = 0; j < ka.length; j++) { if (!Object.prototype.hasOwnProperty.call(b, ka[j]) || !eq(a[ka[j]], b[ka[j]])) return false; }
      return true;
    }
    return false;
  }

  function sonListasConId() {
    for (var a = 0; a < arguments.length; a++) {
      var arr = arguments[a];
      if (arr === undefined) continue;
      if (!Array.isArray(arr)) return false;
      for (var i = 0; i < arr.length; i++) {
        if (!esObj(arr[i]) || (typeof arr[i].id !== 'string' && typeof arr[i].id !== 'number')) return false;
      }
    }
    return true;
  }
  function indice(arr) {
    var m = {};
    (arr || []).forEach(function (x, i) { m[String(x.id)] = i; });
    return m;
  }
  function esFilaGasto(ruta) { return /^\/meses\/[^/]+\/gastos\[\]$/.test(ruta); }

  function mergeValor(b, l, r, ruta) {
    if (eq(l, r)) return clone(l);   // iguales: nada que resolver
    if (eq(l, b)) return clone(r);   // local no tocó: vale lo remoto
    if (eq(r, b)) return clone(l);   // remoto no tocó: vale lo local
    // Los dos cambiaron y distinto
    if (l === undefined) return clone(r);   // local borró, remoto editó -> gana la edición
    if (r === undefined) return clone(l);   // remoto borró, local editó -> gana la edición
    if (esObj(l) && esObj(r)) return mergeObjeto(esObj(b) ? b : {}, l, r, ruta);
    if (Array.isArray(l) && Array.isArray(r)) return mergeLista(Array.isArray(b) ? b : [], l, r, ruta);
    return clone(l);                         // escalar o texto cambiado en ambos: gana lo local
  }

  function mergeObjeto(b, l, r, ruta) {
    var out = {};
    var claves = {};
    [b, l, r].forEach(function (o) { Object.keys(o).forEach(function (k) { claves[k] = true; }); });
    // Mes creado a la vez en los dos lados: se unifica antes de fusionar
    if (ruta === '/meses') { var u = unificarMesesDobles(b, l, r); b = u.b; l = u.l; }
    Object.keys(claves).forEach(function (k) {
      var v;
      if (k === 'monto' && esFilaGasto(ruta) && typeof l[k] === 'number' && typeof r[k] === 'number' && typeof b[k] === 'number' &&
          l[k] !== b[k] && r[k] !== b[k] && l[k] !== r[k]) {
        v = r[k] + (l[k] - b[k]);            // las compras se suman: delta local sobre el valor remoto
      } else {
        v = mergeValor(b[k], l[k], r[k], ruta + '/' + k);
      }
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  function mergeLista(b, l, r, ruta) {
    if (!sonListasConId(b, l, r)) return clone(l);   // listas sin id (texto, números...): gana lo local
    var ib = indice(b), il = indice(l), ir = indice(r);
    var out = [];
    var rutaItem = ruta + '[]';
    // Primero en el orden remoto
    r.forEach(function (ri) {
      var id = String(ri.id), pb = ib[id], pl = il[id];
      if (pb === undefined && pl === undefined) { out.push(clone(ri)); return; }          // alta remota
      if (pb !== undefined && pl === undefined) {                                          // local lo borró
        if (eq(ri, b[pb])) return;                                                           // remoto no lo tocó: queda borrado
        out.push(clone(ri));                                                                 // remoto lo editó: se conserva
        return;
      }
      out.push(mergeValor(pb === undefined ? undefined : b[pb], l[pl], ri, rutaItem));
    });
    // Después lo que solo existe en local
    l.forEach(function (li) {
      var id = String(li.id);
      if (ir[id] !== undefined) return;
      var pb = ib[id];
      if (pb === undefined) { out.push(clone(li)); return; }          // alta local
      if (eq(li, b[pb])) return;                                       // remoto lo borró y local no lo tocó: queda borrado
      out.push(clone(li));                                             // remoto lo borró pero local lo editó: se conserva
    });
    return out;
  }

  // ---- Mes creado en los dos lados a la vez ----
  // Cada lado copió el mes anterior con ids nuevos: se emparejan las filas por categoría+nombre (y los ingresos por nombre),
  // se pasan los ids locales a los remotos y se arma una base "como quedó la copia" restando los movimientos de cada lado.
  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  function unificarMesesDobles(b, l, r) {
    var b2 = Object.assign({}, b), l2 = Object.assign({}, l);
    Object.keys(l).forEach(function (k) {
      if (b[k] !== undefined || !esObj(l[k]) || !esObj(r[k])) return;
      if (Object.keys(b).length === 0) return;   // sin base no hay forma de saber cómo quedó la copia: se fusiona por id como siempre
      var idsR = {};
      (r[k].gastos || []).forEach(function (x) { idsR[x.id] = true; });
      if ((l[k].gastos || []).some(function (g) { return idsR[g.id]; })) return;   // comparten ids: no es una copia doble
      var lm = clone(l[k]), rm = r[k];
      var mapa = {};
      (lm.gastos || []).forEach(function (g) {
        var par = (rm.gastos || []).filter(function (x) { return x.categoria === g.categoria && normalizar(x.nombre) === normalizar(g.nombre); })[0];
        if (par && par.id !== g.id) { mapa[g.id] = par.id; }
      });
      var sumas = {};
      (lm.movimientos || []).forEach(function (mv) { if (mv.filaId) sumas[mapa[mv.filaId] || mv.filaId] = (sumas[mapa[mv.filaId] || mv.filaId] || 0) + (Number(mv.monto) || 0); });
      var baseMes = { ingresos: [], gastos: [] };
      (lm.gastos || []).forEach(function (g) {
        var nuevoId = mapa[g.id] || g.id;
        var copia = Object.assign({}, g, { id: nuevoId });
        g.id = nuevoId;
        if (typeof g.monto === 'number') copia.monto = g.monto - (sumas[nuevoId] || 0);   // cómo quedó la copia antes de sumar compras
        baseMes.gastos.push(copia);
      });
      (lm.ingresos || []).forEach(function (i) {
        var par = (rm.ingresos || []).filter(function (x) { return normalizar(x.nombre) === normalizar(i.nombre); })[0];
        if (par) i.id = par.id;
        baseMes.ingresos.push(Object.assign({}, i));
      });
      (lm.movimientos || []).forEach(function (mv) { if (mv.filaId && mapa[mv.filaId]) mv.filaId = mapa[mv.filaId]; });
      l2[k] = lm; b2[k] = baseMes;
    });
    return { b: b2, l: l2 };
  }

  // merge(base, local, remoto) -> estado fusionado (no modifica los argumentos). base puede ser null/undefined.
  function merge(base, local, remoto) {
    if (!esObj(remoto)) return clone(local);
    if (!esObj(local)) return clone(remoto);
    return mergeObjeto(esObj(base) ? base : {}, local, remoto, '');
  }

  // Guarda con condición de `rev` y, si hubo conflicto, fusiona y reintenta (hasta `maxReintentos` veces).
  // ctx:
  //   getLocal() / setLocal(estado)  — el estado vivo de la app
  //   getBase() / setBase(estado)    — copia del último estado sincronizado
  //   getRev() / setRev(n)           — el `rev` que se cree vigente en el servidor
  //   escribir(data, revEsperado)    -> Promise<{ok:true, rev} | {conflicto:true} | {error}>   (UPDATE ... WHERE rev = revEsperado)
  //   leerRemoto()                   -> Promise<{data, rev}>
  //   maxReintentos (opcional, 3)
  // Resuelve { ok, intentos, mergeado, conflicto?, error? }. Si falla, el estado local NO se pierde (queda fusionado con lo último
  // que se bajó) y el próximo guardado vuelve a intentarlo.
  function sincronizar(ctx) {
    var max = ctx.maxReintentos == null ? 3 : ctx.maxReintentos;
    var reintentos = 0, mergeado = false;
    function paso() {
      var enviado = clone(ctx.getLocal());
      return ctx.escribir(enviado, ctx.getRev()).then(function (res) {
        if (res && res.ok) {
          ctx.setRev(res.rev); ctx.setBase(enviado);
          return { ok: true, intentos: reintentos + 1, mergeado: mergeado };
        }
        if (!res || !res.conflicto) return { ok: false, error: (res && res.error) || 'error', intentos: reintentos + 1, mergeado: mergeado };
        if (reintentos >= max) return { ok: false, conflicto: true, intentos: reintentos + 1, mergeado: mergeado };
        reintentos++;
        return ctx.leerRemoto().then(function (rem) {
          if (!rem || !rem.data) return { ok: false, error: 'no se pudo leer el remoto', intentos: reintentos, mergeado: mergeado };
          var fusionado = merge(ctx.getBase(), ctx.getLocal(), rem.data);
          ctx.setLocal(fusionado); ctx.setBase(clone(rem.data)); ctx.setRev(rem.rev);
          mergeado = true;
          return paso();
        });
      }, function (err) { return { ok: false, error: String(err && err.message || err), intentos: reintentos + 1, mergeado: mergeado }; });
    }
    return paso();
  }

  var api = { merge: merge, sincronizar: sincronizar, eq: eq, clone: clone };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.MFSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
