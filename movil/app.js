/* ===========================================================
   Mis Finanzas — lógica de la aplicación
   Todo se guarda automáticamente en este navegador (localStorage).
   =========================================================== */

(function () {
  'use strict';

  // ---------- Configuración de categorías ----------
  // `icon` (emoji) se sigue usando en los <option> de los selectores, donde no
  // entra un SVG; `cn` es el color de categoría del rediseño (--c1 a --c7) y
  // `svg` el trazo del ícono que se dibuja en las fichas de categoría.
  const CATEGORIAS = [
    { id: 'vivienda',        nombre: 'Vivienda',              icon: '🏠', cn: 1, color: 'var(--c1)', svg: '<path d="M4 11l8-6 8 6v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/>' },
    { id: 'trabajo',         nombre: 'Trabajo',               icon: '💼', cn: 4, color: 'var(--c4)', svg: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>' },
    { id: 'alimentacion',    nombre: 'Alimentación',          icon: '🛒', cn: 2, color: 'var(--c2)', svg: '<path d="M4 5h2l2 10h9l2-7H7"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>' },
    { id: 'transporte',      nombre: 'Transporte',            icon: '🚗', cn: 10, color: 'var(--c10)', svg: '<path d="M5 17h14M6 17l1.4-5.2A2 2 0 019.3 10h5.4a2 2 0 011.9 1.8L18 17"/><circle cx="8" cy="17.5" r="1.4"/><circle cx="16" cy="17.5" r="1.4"/>' },
    { id: 'salud',           nombre: 'Salud',                 icon: '🏥', cn: 5, color: 'var(--c5)', svg: '<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/>' },
    { id: 'educacion',       nombre: 'Educación',             icon: '📚', cn: 8, color: 'var(--c8)', svg: '<path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 20.5V5.5M8 7h8"/>' },
    { id: 'mascota',         nombre: 'Mascota',               icon: '🐾', cn: 9, color: 'var(--c9)', svg: '<circle cx="6.5" cy="11" r="1.7"/><circle cx="10.5" cy="6.5" r="1.7"/><circle cx="15.5" cy="6.5" r="1.7"/><circle cx="19" cy="11" r="1.7"/><path d="M8 18c0-2.6 1.8-4.5 4-4.5s4 1.9 4 4.5c0 1.4-1.2 2.2-4 2.2s-4-.8-4-2.2z"/>' },
    { id: 'entretenimiento', nombre: 'Entretenimiento',       icon: '🎬', cn: 7, color: 'var(--c7)', svg: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>' },
    { id: 'ropa',            nombre: 'Ropa / Personal',       icon: '👕', cn: 12, color: 'var(--c12)', svg: '<path d="M8 4L3 7l2.5 4L8 10v10h8V10l2.5 1L21 7l-5-3a4 4 0 01-8 0z"/>' },
    { id: 'seguros',         nombre: 'Seguros / Imprevistos', icon: '🛡️', cn: 11, color: 'var(--c11)', svg: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>' },
    { id: 'ahorro',          nombre: 'Ahorro e Inversión',    icon: '💰', cn: 6, color: 'var(--c6)', svg: '<path d="M12 3v18M16 7.5C16 6 14.2 5 12 5S8 6 8 7.800c0 4 8 2.200 8 6.200C16 16 14.200 17 12 17s-4-1-4-2.500"/>' },
  ];
  const CAT_MAP = {};
  CATEGORIAS.forEach(function (c) { CAT_MAP[c.id] = c; });

  // ---------- Íconos (trazo, 24x24) ----------
  const ICONOS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    chevDown: '<path d="M6 9l6 6 6-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M3 3l18 18M10.6 6.1A9.800 9.800 0 0112 6c6.500 0 10 6 10 6a17 17 0 01-3.200 3.900M6.600 7.600C3.700 9.400 2 12 2 12s3.500 6 10 6c1.600 0 3-.3 4.300-.8"/><path d="M9.900 9.900a3 3 0 004.200 4.200"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A1.5 1.5 0 016.5 5H15"/>',
    volume: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>',
    volumeOff: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    hourglass: '<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/>'
  };
  function ico(nombre, tam, grosor) {
    tam = tam || 20;
    return '<svg width="' + tam + '" height="' + tam + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (grosor || 2) +
      '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONOS[nombre] || '') + '</svg>';
  }
  // Ficha cuadrada de categoría (ícono de trazo sobre el color de la categoría)
  function tileCat(catId, chica) {
    var c = CAT_MAP[catId];
    var cn = c ? c.cn : 4;
    var tam = chica ? 16 : 22;
    var trazo = c ? c.svg : '<circle cx="12" cy="12" r="2"/>';
    return '<span class="tile ct' + cn + (chica ? ' s' : '') + '"><svg width="' + tam + '" height="' + tam +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + trazo + '</svg></span>';
  }
  // Estado de un presupuesto según lo gastado: en rango (< 75 %), al límite (75–100 %) o excedida (> 100 %)
  function estadoPresupuesto(gastado, tope) {
    var ratio = tope > 0 ? gastado / tope : 0;
    if (ratio > 1) return { clave: 'bad', texto: 'Excedida', color: 'var(--bad)', badge: 'b-bad', ratio: ratio };
    if (ratio >= 0.75) return { clave: 'warn', texto: 'Al límite', color: 'var(--warn)', badge: 'b-warn', ratio: ratio };
    return { clave: 'ok', texto: 'En rango', color: 'var(--ok)', badge: 'b-ok', ratio: ratio };
  }

  // ---------- Tema claro / oscuro ----------
  const TEMA_KEY = 'misFinanzas_tema';
  function temaActual() { return document.documentElement.classList.contains('claro') ? 'claro' : 'oscuro'; }
  function temaPreferidoInicial() {
    var t = null;
    try { t = localStorage.getItem(TEMA_KEY); } catch (e) {}
    if (t === 'claro' || t === 'oscuro') return t;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'claro' : 'oscuro';
  }
  function aplicarTema(t, guardarEleccion) {
    var h = document.documentElement;
    h.classList.remove('oscuro', 'claro'); h.classList.add(t);
    var meta = document.getElementById('metaTheme');
    if (meta) meta.setAttribute('content', t === 'claro' ? '#F3FAF6' : '#04170F');
    if (guardarEleccion) { try { localStorage.setItem(TEMA_KEY, t); } catch (e) {} }
    var bc = document.getElementById('temaClaroBtn'), bo = document.getElementById('temaOscuroBtn');
    if (bc) bc.classList.toggle('sel', t === 'claro');
    if (bo) bo.classList.toggle('sel', t === 'oscuro');
    var tb = document.getElementById('temaBtn');
    if (tb) tb.setAttribute('aria-label', t === 'claro' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
    // Los gráficos (Chart.js) pintan con colores concretos: hay que redibujarlos
    if (estado) { try { render(false); } catch (e) {} }
  }
  // Colores de los gráficos leídos de las variables CSS del tema activo
  function colorCss(nombre, respaldo) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
    return v || respaldo;
  }

  // Nombre de la línea "acumuladora" donde se suman las compras de cada categoría.
  // (Para Alimentación se junta con tu línea "Supermercado / almacén".)
  const ACC_NOMBRE = { alimentacion: 'Supermercado / almacén' };
  function nombreAcumulador(cat) { return ACC_NOMBRE[cat] || 'Compras'; }

  // Nombre de categoría (respeta el que el usuario haya personalizado)
  function getCatNombre(id) {
    return (estado && estado.catNombres && estado.catNombres[id]) || (CAT_MAP[id] ? CAT_MAP[id].nombre : id);
  }

  const MESES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const STORAGE_KEY = 'misFinanzas_v1';

  // ---------- Estado ----------
  var estado = null;
  var mesActivo = null;
  var colapsadas = {}; // categorías colapsadas (solo visual)
  var evoModo = 'mensual'; // vista del gráfico: 'diario' | 'semanal' (real, del mes activo) | 'mensual' | 'anual'
  var vistaActual = 'resumen'; // 'resumen' | 'historial' — qué página se está mostrando
  var saldoOculto = localStorage.getItem('misFinanzas_saldoOculto') === '1'; // preferencia de este dispositivo, no se sincroniza

  // ---- Nube (Supabase) para sincronizar con el bot de Telegram ----
  const NUBE_KEY = 'misFinanzas_nube';
  const FILA_ID = 'main';           // id de la fila única con todo el estado
  var nubeCfg = null;               // { url, key }
  var nubeRev = -1;                 // última revisión conocida
  var nubePollTimer = null;
  var guardandoNube = false;
  var guardarNubeTimer = null;

  // ---- Cuenta con Google (login real, un proyecto por persona) ----
  // Solo se activa en la versión hosteada (http/https) — el archivo local
  // (file://) sigue funcionando como siempre, con la nube manual de arriba.
  const CUENTA_URL = 'https://iivjrpfkwkxgxzgyzrvq.supabase.co';
  const CUENTA_ANON_KEY = 'sb_publishable_T4yeLPNAAbleawDltkBKBg_Qu25uS4i';
  // Usuario del bot de Telegram (sin @), el que te dio @BotFather al crearlo.
  const TELEGRAM_BOT_USERNAME = 'misfinanzas_ivan_bot';
  // Clave pública VAPID para Web Push — la privada NUNCA va acá, vive solo
  // como secreto de la Edge Function enviar-notificacion.
  const VAPID_PUBLIC_KEY = 'BDjFnnssI1oPLD8hOWdhOUU1evVy0jtk6eYO4n2rGJgXySnUmPRuJM4xjXz8qZWhf8UdK0fyssJCJ8jQRYvsTtM';
  var sbClient = null;
  var modoCuenta = false;           // true si estamos logueados con Google
  var miUsuario = null;             // objeto user de Supabase Auth (nombre, mail, avatar)
  var miProyectoId = null;
  var miRol = null;                 // 'dueno' | 'editor' | 'lector'
  var cuentaRev = -1;
  var cuentaPollTimer = null;
  var guardandoCuenta = false;
  var guardarCuentaTimer = null;

  // ---------- Utilidades ----------
  function uid() { return 'id' + Math.floor((performance.now() * 1000) % 1e9) + '' + (uid._c = (uid._c || 0) + 1); }

  function fmt(n) {
    n = Math.round(Number(n) || 0);
    return '$ ' + n.toLocaleString('es-AR');
  }
  function fmtCorto(n) {
    n = Number(n) || 0;
    var abs = Math.abs(n);
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(abs >= 1e7 ? 0 : 1).replace('.', ',') + 'M';
    if (abs >= 1e3) return '$' + Math.round(n / 1e3) + 'k';
    return '$' + Math.round(n);
  }
  function mesKeyLabel(key) {
    var p = key.split('-');
    return MESES_NOMBRE[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }
  function mesCorto(key) {
    var p = key.split('-');
    return MESES_NOMBRE[parseInt(p[1], 10) - 1].slice(0, 3);
  }
  // Para etiquetas de gráficos que muestran varios meses seguidos: siempre
  // con año, para no confundir "Jul" de este año con uno de otro (ej. si se
  // crearon meses futuros sin querer con "›").
  function mesCortoConAnio(key) {
    return mesCorto(key) + ' ' + key.split('-')[0].slice(2);
  }
  function siguienteMes(key) {
    var p = key.split('-'); var y = parseInt(p[0], 10); var m = parseInt(p[1], 10);
    m++; if (m > 12) { m = 1; y++; }
    return y + '-' + (m < 10 ? '0' + m : m);
  }
  function mesAnteriorKey(key) {
    var p = key.split('-'); var y = parseInt(p[0], 10); var m = parseInt(p[1], 10);
    m--; if (m < 1) { m = 12; y--; }
    return y + '-' + (m < 10 ? '0' + m : m);
  }
  function mesesOrdenados() { return Object.keys(estado.meses).sort(); }
  // Clave del mes actual según la fecha de la compu (ej: '2026-07')
  function mesActualKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }
  // Copia los gastos de un mes; las líneas acumuladoras de compras arrancan en 0
  function clonarGastos(arr) {
    return (arr || []).map(function (g) {
      return { id: uid(), categoria: g.categoria, nombre: g.nombre, monto: g.bot ? 0 : g.monto, bot: g.bot || undefined };
    });
  }
  // Devuelve el mes actual, creándolo si no existe (copia los gastos fijos del mes anterior)
  function asegurarMesActual() {
    var k = mesActualKey();
    if (!estado.meses[k]) {
      var previos = mesesOrdenados().filter(function (x) { return x < k; });
      var base = previos.length ? estado.meses[previos[previos.length - 1]] : null;
      estado.meses[k] = base ? {
        ingresos: base.ingresos.map(function (i) { return { id: uid(), nombre: i.nombre, monto: i.monto }; }),
        gastos: clonarGastos(base.gastos)
      } : { ingresos: [], gastos: [] };
      guardar();
    }
    return k;
  }
  function isoHoyApp() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  // Junta los movimientos (compras) de TODOS los meses, con la clave de mes de cada uno,
  // ordenados del más reciente al más viejo (para la página de Historial).
  function todosLosMovimientos() {
    var out = [];
    var seq = 0;
    mesesOrdenados().forEach(function (k) {
      (estado.meses[k].movimientos || []).forEach(function (mv) {
        out.push({ mv: mv, mesKey: k, seq: seq++ }); // seq = orden real de carga (fecha sola no alcanza, no tiene hora)
      });
    });
    out.sort(function (a, b) {
      if (a.mv.fecha !== b.mv.fecha) return a.mv.fecha < b.mv.fecha ? 1 : -1;
      return b.seq - a.seq; // mismo día: el que se cargó después va primero
    });
    return out;
  }

  // Busca (o crea, vacía) la fila de gastos de una categoría. sel = { id } para una fila existente o
  // { nombre } para una por nombre (si no existe se crea, como fila variable que arranca en 0 cada mes).
  function resolverFila(m, categoria, sel) {
    if (!m.gastos) m.gastos = [];
    var filas = m.gastos.filter(function (g) { return g.categoria === categoria; });
    var fila = null;
    if (sel && sel.id) fila = filas.find(function (g) { return g.id === sel.id; }) || null;
    if (!fila && sel && sel.nombre) {
      var buscado = normalizarTexto(sel.nombre);
      fila = filas.find(function (g) { return normalizarTexto(g.nombre) === buscado; }) || null;
    }
    // Sin id ni nombre: la fila acumuladora de la categoría (la que ya existe, si hay)
    if (!fila && !(sel && (sel.id || sel.nombre))) {
      var accName = nombreAcumulador(categoria);
      fila = filas.find(function (g) { return g.bot || g.nombre === accName; }) || null;
    }
    if (!fila) {
      fila = { id: uid(), categoria: categoria, nombre: String((sel && sel.nombre) || '').trim() || nombreAcumulador(categoria), monto: 0, bot: true };
      m.gastos.push(fila);
    }
    return fila;
  }

  // Registra una compra: la suma a una fila de la categoría (la que se elija, o la línea acumuladora
  // por defecto) y la anota en el historial. fila (opcional) = { id } o { nombre }.
  function registrarCompra(categoria, monto, nota, items, fecha, fila) {
    var m = mesData();
    if (!m.gastos) m.gastos = [];
    if (!m.movimientos) m.movimientos = [];
    var acc;
    if (fila && (fila.id || fila.nombre)) {
      // Fila elegida a mano: se le suma el monto sin cambiarle el tipo (una fila fija como el alquiler sigue siendo fija)
      acc = resolverFila(m, categoria, fila);
      acc.monto = (Number(acc.monto) || 0) + monto;
    } else {
      var accName = nombreAcumulador(categoria);
      acc = m.gastos.filter(function (g) { return g.categoria === categoria; })
        .find(function (g) { return g.bot || g.nombre === accName; });
      if (acc) { acc.monto = (Number(acc.monto) || 0) + monto; acc.bot = true; }
      else { acc = { id: uid(), categoria: categoria, nombre: accName, monto: monto, bot: true }; m.gastos.push(acc); }
    }
    revisarGastoInusual(categoria, monto);
    m.movimientos.push({ id: uid(), fecha: fecha || isoHoyApp(), categoria: categoria, filaId: acc.id, fila: acc.nombre, monto: monto, nota: nota || null, items: items || null });
    revisarPresupuesto(categoria);
    ultimaAccionDescripcion = 'agregó un gasto de ' + fmt(monto) + ' en ' + getCatNombre(categoria);
    return acc;
  }

  // Si esta categoría tiene un presupuesto definido y el gasto recién cargado
  // lo cruzó, avisa por push — pero UNA sola vez por mes y categoría (si no,
  // cada gasto nuevo en una categoría ya pasada de presupuesto mandaría otro
  // aviso). El flag queda guardado en el estado (se sincroniza como cualquier
  // otro dato), así que "ya avisado" es por proyecto, no por dispositivo.
  function avisarPush(titulo, cuerpo) {
    if (!modoCuenta || !miProyectoId) return;
    sbClient.functions.invoke('enviar-notificacion', {
      body: { proyectoId: miProyectoId, excluirUserId: miUsuario ? miUsuario.id : null, titulo: titulo, cuerpo: cuerpo }
    }).catch(function () {});
  }

  // Marca "categoria" como avisada en estado[campo][mesActivo] y devuelve true
  // la PRIMERA vez que se llama para esa combinación mes+categoría — así el
  // resto de gastos del mes en esa categoría no repiten el mismo aviso.
  function marcarAvisadoUnaVez(campo, categoria) {
    if (!estado[campo]) estado[campo] = {};
    var avisados = estado[campo][mesActivo] || [];
    if (avisados.indexOf(categoria) !== -1) return false;
    estado[campo][mesActivo] = avisados.concat([categoria]);
    return true;
  }

  // Avisa si esta compra es mucho más grande que el promedio histórico de la
  // categoría (2.5x). Se llama ANTES de sumar la compra al historial, para
  // que el promedio no quede inflado por la propia compra que se está evaluando.
  function revisarGastoInusual(categoria, monto) {
    if (!modoCuenta || !miProyectoId) return;
    var historial = todosLosMovimientos()
      .map(function (x) { return x.mv; })
      .filter(function (mv) { return mv.categoria === categoria; });
    if (historial.length < 4) return; // hace falta historial para saber qué es "normal"
    var promedio = historial.reduce(function (s, mv) { return s + (Number(mv.monto) || 0); }, 0) / historial.length;
    if (promedio > 0 && monto >= promedio * 2.5) {
      avisarPush('Gasto inusual', fmt(monto) + ' en ' + getCatNombre(categoria) + ', bastante más que tu promedio habitual (' + fmt(promedio) + ').');
    }
  }

  // Cuando el chat fija un presupuesto nuevo para una categoría, guardamos cuánto
  // llevaba gastado ESE mes hasta ese momento — así "vas X de Y" cuenta desde que
  // se puso el tope ("es un presupuesto nuevo"), no arrastra gastos de antes de
  // pedirlo. Es aparte de estado.presupuestos (el tope en sí, que sigue siendo el
  // mismo que usa la página de Analíticas y el aviso push de revisarPresupuesto).
  function marcarBasePresupuestoChat(categoria) {
    if (!estado.presupuestosDesde) estado.presupuestosDesde = {};
    if (!estado.presupuestosDesde[mesActivo]) estado.presupuestosDesde[mesActivo] = {};
    estado.presupuestosDesde[mesActivo][categoria] = gastosPorCategoria(mesActivo)[categoria] || 0;
  }

  // Frase de progreso para el chat ("Vas $ 50.000 de $ 200.000 en Alimentación (25%).")
  // cuando esa categoría tiene un presupuesto definido. Es un cálculo aparte del
  // aviso push de revisarPresupuesto (que solo dispara una vez al cruzar 80%/100%):
  // esta frase se agrega en CADA mensaje de chat que registre un gasto en la categoría.
  function progresoPresupuestoTexto(categoria) {
    var tope = Number((estado.presupuestos || {})[categoria]) || 0;
    if (!tope) return null;
    var base = ((estado.presupuestosDesde || {})[mesActivo] || {})[categoria] || 0;
    var gastado = Math.max(0, (gastosPorCategoria(mesActivo)[categoria] || 0) - base);
    var pct = Math.round((gastado / tope) * 100);
    return 'Vas ' + fmt(gastado) + ' de ' + fmt(tope) + ' en ' + getCatNombre(categoria) + ' (' + pct + '%).';
  }

  function revisarPresupuesto(categoria) {
    var tope = Number((estado.presupuestos || {})[categoria]) || 0;
    if (!tope || !modoCuenta || !miProyectoId) return;
    var gastado = gastosPorCategoria(mesActivo)[categoria] || 0;
    var nombreCat = getCatNombre(categoria);
    if (gastado > tope) {
      if (marcarAvisadoUnaVez('presupuestosAvisados', categoria)) {
        avisarPush('Te pasaste de presupuesto', nombreCat + ': ' + fmt(gastado) + ' de ' + fmt(tope) + ' este mes.');
      }
      return;
    }
    // Todavía no lo cruzó, pero si ya está al 80% o más, un aviso preventivo
    // (una sola vez por mes/categoría) para que puedas frenar antes de pasarte.
    if (gastado / tope >= 0.8) {
      if (marcarAvisadoUnaVez('presupuestosAvisadosCerca', categoria)) {
        avisarPush('Te estás por pasar de presupuesto', nombreCat + ': ' + fmt(gastado) + ' de ' + fmt(tope) +
          ' (' + Math.round((gastado / tope) * 100) + '%) este mes.');
      }
    }
  }

  // ---------- Asistente de chat (IA) ----------
  // Cada conversación es una "sesión" independiente (estado.chats[]), como en
  // ChatGPT/Claude/Gemini: abrir el chat siempre arranca una nueva, y desde el
  // ícono de historial se puede retomar cualquiera de las anteriores.
  var CHAT_SESIONES_MAX = 30;      // cuántas conversaciones se guardan en la nube
  var CHAT_MSGS_POR_SESION_MAX = 150;
  var chatHistorial = [];       // mensajes de la sesión ACTIVA: { rol: 'user' | 'assistant', texto, textoIA? }
  var chatSesionId = null;      // id de estado.chats[] de la sesión activa (null = todavía no se guardó ninguna)
  var chatEnviando = false;
  var chatYaRegistrados = [];   // "categoria|monto|nota" ya registrado EN ESTA sesión (evita duplicar)
  var chatVozActivada = localStorage.getItem('misFinanzas_chatVoz') !== '0'; // preferencia de este dispositivo, no se sincroniza
  var chatReconocimiento = null; // instancia de SpeechRecognition (se crea la primera vez que se usa)
  var chatEscuchando = false;

  // Lee en voz alta la respuesta del asistente (gratis, nativo del navegador,
  // funciona en Android e iPhone). Si el usuario apagó el sonido, no hace nada.
  // alTerminar (opcional): se llama cuando termina de hablar (o de una) — lo
  // usa el Modo Voz para retomar la escucha apenas termina de responder.
  // asistente.js puede registrar su propio reproductor (voz elegida, cola de
  // frases); si no hay, se usa la voz del navegador como siempre.
  var chatVozExterna = null; // { hablar(texto, alTerminar), cancelar() }
  function chatHablar(texto, alTerminar) {
    if (!chatVozActivada || !texto) { if (alTerminar) alTerminar(); return; }
    if (chatVozExterna) { chatVozExterna.hablar(texto, alTerminar); return; }
    if (!window.speechSynthesis) { if (alTerminar) alTerminar(); return; }
    window.speechSynthesis.cancel(); // no superponer con una lectura anterior
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-AR';
    if (alTerminar) { u.onend = alTerminar; u.onerror = alTerminar; }
    window.speechSynthesis.speak(u);
  }

  // "Leer respuestas en voz alta": un solo estado, varios controles (chat, pantalla
  // de voz y Ajustes) que se mantienen sincronizados.
  function chatVozActualizarUI() {
    ['chatVozToggle', 'vozLeerBtn'].forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      b.classList.toggle('muted', !chatVozActivada);
      b.innerHTML = ico(chatVozActivada ? 'volume' : 'volumeOff', 22, 1.9);
      b.setAttribute('aria-pressed', chatVozActivada ? 'true' : 'false');
    });
    var sw = document.getElementById('ajLeerSw');
    if (sw) { sw.classList.toggle('on', chatVozActivada); sw.setAttribute('aria-checked', chatVozActivada ? 'true' : 'false'); }
  }
  function chatSetVoz(v) {
    chatVozActivada = !!v;
    try { localStorage.setItem('misFinanzas_chatVoz', chatVozActivada ? '1' : '0'); } catch (e) {}
    chatVozActualizarUI();
    if (!chatVozActivada) {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (chatVozExterna && chatVozExterna.cancelar) chatVozExterna.cancelar();
    }
  }

  // Voz elegida para el asistente ('1' mujer, '2' hombre): preferencia de este dispositivo
  var VOZ_KEY = 'misFinanzas_vozAsistente';
  var vozAsistente = (function () { try { return localStorage.getItem(VOZ_KEY) === '2' ? '2' : '1'; } catch (e) { return '1'; } })();
  function setVozAsistente(v) {
    vozAsistente = v === '2' ? '2' : '1';
    try { localStorage.setItem(VOZ_KEY, vozAsistente); } catch (e) {}
    renderAjustes();
    if (window.MFAsis) window.MFAsis.alCambiarVoz(vozAsistente);
  }
  function renderAjustes() {
    var r1 = document.getElementById('ajVoz1R'), r2 = document.getElementById('ajVoz2R');
    var o1 = document.getElementById('ajVoz1'), o2 = document.getElementById('ajVoz2');
    if (!r1 || !r2) return;
    [[o1, r1, '1'], [o2, r2, '2']].forEach(function (x) {
      var on = vozAsistente === x[2];
      x[0].classList.toggle('sel', on); x[1].classList.toggle('on', on);
      x[1].innerHTML = on ? ico('check', 14, 3.4) : '';
    });
    var tg = document.getElementById('telegramSub');
    if (tg) tg.textContent = modoCuenta ? 'Cargá gastos escribiéndole al bot' : 'Conectá la nube para cargar gastos desde Telegram';
    chatVozActualizarUI();
    if (window.MFAsis && window.MFAsis.pintarUso) window.MFAsis.pintarUso(); // caracteres de voz premium usados este mes
  }

  // Dictado por voz (gratis, nativo) — no existe en Safari/iOS, ahí se oculta el botón.
  function chatMicDisponible() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function chatToggleMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    var btn = document.getElementById('chatMicBtn');
    if (chatEscuchando) { if (chatReconocimiento) chatReconocimiento.stop(); return; }
    if (!chatReconocimiento) {
      chatReconocimiento = new SR();
      chatReconocimiento.lang = 'es-AR';
      chatReconocimiento.interimResults = true;
      chatReconocimiento.continuous = false;
      chatReconocimiento.onresult = function (e) {
        var texto = '';
        for (var i = 0; i < e.results.length; i++) texto += e.results[i][0].transcript;
        var inp = document.getElementById('chatInput');
        if (inp) inp.value = texto;
      };
      chatReconocimiento.onend = function () {
        chatEscuchando = false;
        if (btn) btn.classList.remove('listening');
      };
      chatReconocimiento.onerror = function () {
        chatEscuchando = false;
        if (btn) btn.classList.remove('listening');
      };
    }
    chatEscuchando = true;
    if (btn) btn.classList.add('listening');
    chatReconocimiento.start();
  }

  // Guarda el historial (recortado) en el proyecto compartido, para poder
  // revisarlo después desde cualquier dispositivo — igual que el resto de los datos.
  function chatTituloDesde(mensajes) {
    var primero = mensajes.filter(function (m) { return m.rol === 'user'; })[0];
    var t = primero ? primero.texto : 'Conversación';
    return t.length > 42 ? t.slice(0, 42) + '…' : t;
  }

  // Guarda/actualiza la sesión ACTIVA dentro de estado.chats[], recortando
  // mensajes viejos y limitando cuántas conversaciones se acumulan.
  function chatPersistirLog() {
    if (!chatSesionId) chatSesionId = uid();
    if (!estado.chats) estado.chats = [];
    var sesion = {
      id: chatSesionId,
      titulo: chatTituloDesde(chatHistorial),
      actualizado: Date.now(),
      mensajes: chatHistorial.slice(-CHAT_MSGS_POR_SESION_MAX).map(function (m) {
        return { rol: m.rol, texto: m.texto, textoIA: m.textoIA || null };
      }),
    };
    var idx = -1;
    for (var i = 0; i < estado.chats.length; i++) { if (estado.chats[i].id === chatSesionId) { idx = i; break; } }
    if (idx !== -1) estado.chats[idx] = sesion; else estado.chats.push(sesion);
    estado.chats.sort(function (a, b) { return (b.actualizado || 0) - (a.actualizado || 0); });
    if (estado.chats.length > CHAT_SESIONES_MAX) estado.chats.length = CHAT_SESIONES_MAX;
    guardar();
  }

  function chatFechaCorta(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }

  // Arranca una conversación nueva y vacía (lo que pasa siempre que abrís el
  // chat desde la burbuja, y también al tocar "+ Nueva conversación").
  function chatIniciarNueva() {
    chatHistorial = [];
    chatSesionId = null;
    chatYaRegistrados = [];
    var panel = document.getElementById('chatPanel');
    if (panel) panel.classList.remove('modo-historial');
    renderChatMensajes();
  }

  // Retoma una conversación guardada en estado.chats[] y la deja como activa.
  function chatCargarSesion(id) {
    var sesion = null;
    for (var i = 0; i < (estado.chats || []).length; i++) { if (estado.chats[i].id === id) { sesion = estado.chats[i]; break; } }
    if (!sesion) return;
    chatHistorial = (sesion.mensajes || []).map(function (m) {
      return { rol: m.rol, texto: m.texto, textoIA: m.textoIA || undefined };
    });
    chatSesionId = sesion.id;
    chatYaRegistrados = [];
    var panel = document.getElementById('chatPanel');
    if (panel) panel.classList.remove('modo-historial');
    renderChatMensajes();
  }

  function renderChatHistorialLista() {
    var cont = document.getElementById('chatHistorialLista');
    if (!cont) return;
    var chats = (estado.chats || []).slice().sort(function (a, b) { return (b.actualizado || 0) - (a.actualizado || 0); });
    var html = '<button class="chat-hist-nuevo" id="chatHistNuevoBtn">+ Nueva conversación</button>';
    if (!chats.length) {
      html += '<div class="chat-hist-vacio">Todavía no tenés conversaciones guardadas.</div>';
    } else {
      html += chats.map(function (s) {
        return '<button class="chat-hist-item" data-id="' + escapeAttr(s.id) + '">' +
          '<span class="chat-hist-titulo">' + escapeHtml(s.titulo || 'Conversación') + '</span>' +
          '<span class="chat-hist-fecha">' + chatFechaCorta(s.actualizado) + '</span></button>';
      }).join('');
    }
    cont.innerHTML = html;
    var nuevoBtn = document.getElementById('chatHistNuevoBtn');
    if (nuevoBtn) nuevoBtn.onclick = chatIniciarNueva;
    Array.prototype.slice.call(cont.querySelectorAll('.chat-hist-item')).forEach(function (btn) {
      btn.onclick = function () { chatCargarSesion(btn.getAttribute('data-id')); };
    });
  }

  function chatToggleHistorialVista() {
    var panel = document.getElementById('chatPanel');
    if (!panel) return;
    var enHistorial = panel.classList.toggle('modo-historial');
    if (enHistorial) renderChatHistorialLista();
  }
  function chatCerrarHistorialVista() {
    var panel = document.getElementById('chatPanel');
    if (panel) panel.classList.remove('modo-historial');
  }

  // Resumen compacto (no todo el historial) que se manda como contexto a la
  // IA en cada mensaje — solo lo necesario para responder preguntas y
  // comparar contra el mes anterior, sin mandar años de datos innecesarios.
  function contextoFinancieroParaChat() {
    var mAnt = mesAnteriorKey(mesActivo);
    var hayMesAnterior = !!estado.meses[mAnt];
    var m = mesData();
    var porCat = gastosPorCategoria(mesActivo);
    var partes = mesActivo.split('-');
    var diasMes = new Date(+partes[0], +partes[1], 0).getDate();
    var esActual = mesActivo === mesActualKey();
    var dia = esActual ? Math.max(1, new Date().getDate()) : diasMes;
    var gas = totalGastos(mesActivo);
    // Las filas de gastos de cada categoría (con su monto) y lo que queda de cada presupuesto: ya calculado,
    // así el asistente no tiene que hacer cuentas para responder ni para nombrar bien las filas al modificarlas
    var filasPorCategoria = {};
    (m.gastos || []).forEach(function (g) {
      (filasPorCategoria[g.categoria] = filasPorCategoria[g.categoria] || []).push({ nombre: g.nombre, monto: Number(g.monto) || 0 });
    });
    var presupuestoRestante = {};
    Object.keys(estado.presupuestos || {}).forEach(function (c) { presupuestoRestante[c] = (Number(estado.presupuestos[c]) || 0) - (porCat[c] || 0); });
    var recientes = todosLosMovimientos().slice(0, 25).map(function (r) {
      return { id: r.mv.id, mes: r.mesKey, fecha: r.mv.fecha, categoria: r.mv.categoria, fila: r.mv.fila || null, monto: Number(r.mv.monto) || 0, nota: r.mv.nota || null };
    });
    // Rankings ya armados (categorías de mayor a menor, filas y gasto individual más grandes): así
    // preguntas como "¿en qué gasté más?" se responden bien sin que la IA tenga que ordenar ni sumar
    var ranking = CATEGORIAS.map(function (c) { return { categoria: c.id, nombre: getCatNombre(c.id), gastado: porCat[c.id] || 0 }; })
      .filter(function (x) { return x.gastado > 0; })
      .sort(function (a, b) { return b.gastado - a.gastado; })
      .map(function (x) { x.porcentaje = gas > 0 ? Math.round((x.gastado / gas) * 100) : 0; return x; });
    var filasGrandes = (m.gastos || []).filter(function (g) { return Number(g.monto) > 0; })
      .sort(function (a, b) { return (Number(b.monto) || 0) - (Number(a.monto) || 0); }).slice(0, 5)
      .map(function (g) { return { categoria: g.categoria, fila: g.nombre, monto: Number(g.monto) || 0 }; });
    var movMes = (m.movimientos || []).slice().sort(function (a, b) { return (Number(b.monto) || 0) - (Number(a.monto) || 0); })[0];
    return {
      hoy: isoHoyApp(),
      mesActivo: mesKeyLabel(mesActivo),
      mesActivoClave: mesActivo,
      mesesDisponibles: mesesOrdenados(),
      diaDelMes: dia, diasDelMes: diasMes, diasQueFaltan: esActual ? diasMes - dia : 0,
      permiso: miRol || 'dueno',
      categorias: CATEGORIAS.map(function (c) { return { id: c.id, nombre: getCatNombre(c.id) }; }),
      ingresos: (m.ingresos || []).map(function (i) { return { nombre: i.nombre, monto: Number(i.monto) || 0 }; }),
      filasPorCategoria: filasPorCategoria,
      gastosPorCategoria: porCat,
      rankingCategorias: ranking,
      filasMasGrandes: filasGrandes,
      movimientoMasGrande: movMes ? { fecha: movMes.fecha, categoria: movMes.categoria, fila: movMes.fila || null, monto: Number(movMes.monto) || 0, nota: movMes.nota || null } : null,
      totalIngresos: totalIngresos(mesActivo),
      totalGastos: gas,
      cuotasPagadasEsteMes: cuotasPagadas(mesActivo),
      balanceDelMes: balanceMes(mesActivo),
      gastoPromedioPorDia: Math.round(gas / dia),
      presupuestosPorCategoria: estado.presupuestos || {},
      presupuestoRestantePorCategoria: presupuestoRestante,
      deudas: (estado.deudas || []).map(function (d) {
        return { nombre: d.nombre, saldo: Number(d.saldo) || 0, cuotaMensual: Number(d.cuotaMensual) || 0, cuotaActual: d.cuotaActual || null, cuotaTotal: d.cuotaTotal || null,
          activa: d.activa !== false, pagadaEsteMes: deudaPagadaEnMes(d.id, mesActivo) };
      }),
      totalDeuda: totalDeuda(),
      totalCuotasMensuales: totalCuotasDeuda(),
      movimientosRecientes: recientes,
      mesAnterior: hayMesAnterior
        ? { nombre: mesKeyLabel(mAnt), totalIngresos: totalIngresos(mAnt), totalGastos: totalGastos(mAnt), gastosPorCategoria: gastosPorCategoria(mAnt) }
        : null,
    };
  }

  // ---- Pagos de deudas pedidos por chat ("ya pagué la tarjeta naranja, marcala como pagada") ----
  function normalizarTexto(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  // Busca, en una lista, el elemento cuyo nombre más se parece a lo que dijo el usuario.
  // Devuelve { item } o { ambigua: [nombres] } o null (nada parecido)
  function buscarPorNombre(lista, texto) {
    var buscado = normalizarTexto(texto);
    if (!buscado) return null;
    var tokensBuscados = buscado.split(' ').filter(function (t) { return t.length > 1; });
    var puntajes = (lista || []).map(function (it) {
      var nombre = normalizarTexto(it.nombre);
      var p = 0;
      if (!nombre) p = 0;
      else if (nombre === buscado) p = 1000;
      else if (nombre.indexOf(buscado) !== -1 || buscado.indexOf(nombre) !== -1) p = 500;
      else {
        var tn = nombre.split(' ');
        tokensBuscados.forEach(function (t) { if (tn.indexOf(t) !== -1) p += 10; });
      }
      return { it: it, p: p };
    }).filter(function (x) { return x.p > 0; }).sort(function (a, b) { return b.p - a.p; });
    if (!puntajes.length) return null;
    if (puntajes.length > 1 && puntajes[1].p === puntajes[0].p) {
      return { ambigua: puntajes.filter(function (x) { return x.p === puntajes[0].p; }).map(function (x) { return x.it.nombre; }) };
    }
    return { item: puntajes[0].it };
  }
  // Igual que antes, pero para deudas: { deuda } o { ambigua } o null
  function buscarDeudaPorNombre(texto) {
    var r = buscarPorNombre(estado.deudas, texto);
    if (!r) return null;
    return r.ambigua ? r : { deuda: r.item };
  }
  // Aplica con las funciones de siempre (registrarPago / revertirPago) lo que pidió el asistente y
  // devuelve las líneas para mostrar en el chat. Nunca toca nada que no coincida con una deuda real.
  function aplicarPagosDeudasChat(pagos) {
    var lineas = [];
    (pagos || []).forEach(function (p) {
      var r = buscarDeudaPorNombre(p.deuda);
      if (!r) { lineas.push('⚠️ No encontré ninguna deuda parecida a “' + p.deuda + '”. No marqué nada.'); return; }
      if (r.ambigua) { lineas.push('⚠️ “' + p.deuda + '” puede ser ' + r.ambigua.join(' o ') + '. Decime cuál y la marco.'); return; }
      var d = r.deuda;
      var pagada = deudaPagadaEnMes(d.id, mesActivo);
      var finalizada = d.cuotaActual && d.cuotaTotal && d.cuotaActual >= d.cuotaTotal;
      if (p.accion === 'revertir') {
        if (!pagada) { lineas.push('ℹ️ ' + d.nombre + ' no estaba marcada como pagada en ' + mesKeyLabel(mesActivo) + '.'); return; }
        revertirPago(d.id);
        lineas.push('↩️ Desmarqué el pago de ' + d.nombre + ' (' + mesKeyLabel(mesActivo) + ').');
      } else {
        if (pagada) { lineas.push('ℹ️ ' + d.nombre + ' ya estaba marcada como pagada en ' + mesKeyLabel(mesActivo) + '.'); return; }
        if (finalizada) { lineas.push('ℹ️ ' + d.nombre + ' ya está saldada, no quedan cuotas.'); return; }
        registrarPago(d.id);
        lineas.push('💳 Marqué como pagada: ' + d.nombre + ' (' + mesKeyLabel(mesActivo) + ').');
      }
    });
    return lineas;
  }

  // ---- Modificar la app desde el chat ----
  // El asistente solo PROPONE "acciones" (cuando el usuario se lo pide). Acá se aplican con las funciones
  // de siempre de la app, cruzando cada nombre/id con los datos reales: lo que no coincide no se toca.
  function filaDeCategoria(categoria, nombre) {
    var filas = (mesData().gastos || []).filter(function (g) { return g.categoria === categoria; });
    return buscarPorNombre(filas, nombre);
  }
  function describirMov(mv) { return fmt(mv.monto) + ' en ' + getCatNombre(mv.categoria) + (mv.nota ? ' (' + mv.nota + ')' : ''); }
  function movimientoPorId(id) { return todosLosMovimientos().filter(function (x) { return x.mv.id === id; })[0] || null; }
  // Resultado de una búsqueda por nombre -> { item } o un texto de aviso si no hay (o hay dos iguales)
  function elegirUno(r, nombre, donde) {
    if (!r) return { aviso: '⚠️ No encontré “' + nombre + '”' + (donde ? ' en ' + donde : '') + '. No toqué nada.' };
    if (r.ambigua) return { aviso: '⚠️ “' + nombre + '” puede ser ' + r.ambigua.join(' o ') + '. Decime cuál.' };
    return { item: r.item };
  }

  function ejecutarAccionChat(a) {
    var m = mesData(), r, f, e;
    switch (a.tipo) {
      case 'mes_ir':
        if (!estado.meses[a.mes]) return '⚠️ No tengo cargado el mes ' + a.mes + '.';
        mesActivo = a.mes;
        return '📅 Ahora estás viendo ' + mesKeyLabel(a.mes) + '.';
      case 'mes_nuevo': {
        var cantidadAntes = mesesOrdenados().length;
        nuevoMes();
        return mesesOrdenados().length > cantidadAntes ? '📅 Creé ' + mesKeyLabel(mesActivo) + ' copiando el mes anterior.' : 'ℹ️ Confirmá en la pantalla para crear el mes nuevo.';
      }
      case 'movimiento_editar': {
        var rm = movimientoPorId(a.id);
        if (!rm) return '⚠️ No encontré ese gasto para corregirlo.';
        var mv = rm.mv, antesTxt = describirMov(mv);
        var cat = a.categoria || mv.categoria;
        var filaSel = a.fila ? { nombre: a.fila } : (cat === mv.categoria ? { id: mv.filaId } : null);
        aplicarEdicionMovimiento(rm.mesKey, mv, cat, filaSel, a.monto != null ? a.monto : mv.monto, a.nota !== undefined ? a.nota : mv.nota);
        return '✏️ Corregí el gasto: antes ' + antesTxt + ', ahora ' + describirMov(mv) + '.';
      }
      case 'movimiento_eliminar': {
        var rm2 = movimientoPorId(a.id);
        if (!rm2) return '⚠️ No encontré ese gasto para borrarlo.';
        var txt2 = describirMov(rm2.mv);
        eliminarMovimiento(rm2.mv.id, rm2.mesKey);
        return '🗑️ Borré el gasto de ' + txt2 + '.';
      }
      case 'fila_agregar': {
        var buscada = normalizarTexto(a.fila);
        f = (m.gastos || []).filter(function (g) { return g.categoria === a.categoria && normalizarTexto(g.nombre) === buscada; })[0];
        if (f) {
          if (a.monto == null) return 'ℹ️ Ya existe la fila “' + f.nombre + '” en ' + getCatNombre(a.categoria) + '.';
          f.monto = a.monto;
          return '✏️ Ya existía “' + f.nombre + '”: le puse ' + fmt(a.monto) + '.';
        }
        if (!m.gastos) m.gastos = [];
        m.gastos.push({ id: uid(), categoria: a.categoria, nombre: a.fila, monto: a.monto || 0 });
        colapsadas[a.categoria] = false;
        return '➕ Agregué la fila “' + a.fila + '” en ' + getCatNombre(a.categoria) + (a.monto ? ' con ' + fmt(a.monto) : '') + '.';
      }
      case 'fila_editar': {
        e = elegirUno(filaDeCategoria(a.categoria, a.fila), a.fila, getCatNombre(a.categoria));
        if (e.aviso) return e.aviso;
        f = e.item;
        var nombreAntes = f.nombre, cambios = [];
        if (a.monto != null) { f.monto = a.monto; cambios.push('ahora tiene ' + fmt(a.monto)); }
        if (a.nuevoNombre) { f.nombre = a.nuevoNombre; cambios.push('ahora se llama “' + a.nuevoNombre + '”'); }
        return '✏️ Fila “' + nombreAntes + '” (' + getCatNombre(a.categoria) + '): ' + cambios.join(' y ') + '.';
      }
      case 'fila_eliminar': {
        e = elegirUno(filaDeCategoria(a.categoria, a.fila), a.fila, getCatNombre(a.categoria));
        if (e.aviso) return e.aviso;
        f = e.item;
        m.gastos = m.gastos.filter(function (g) { return g.id !== f.id; });
        return '🗑️ Saqué la fila “' + f.nombre + '” de ' + getCatNombre(a.categoria) + (Number(f.monto) ? ' (tenía ' + fmt(f.monto) + ')' : '') + '.';
      }
      case 'ingreso_agregar':
        if (!m.ingresos) m.ingresos = [];
        m.ingresos.push({ id: uid(), nombre: a.nombre, monto: a.monto });
        return '➕ Agregué el ingreso “' + a.nombre + '” de ' + fmt(a.monto) + '.';
      case 'ingreso_editar': {
        e = elegirUno(buscarPorNombre(m.ingresos, a.nombre), a.nombre, 'los ingresos');
        if (e.aviso) return e.aviso;
        var ing = e.item, ingAntes = ing.nombre, camb = [];
        if (a.monto != null) { ing.monto = a.monto; camb.push('ahora es de ' + fmt(a.monto)); }
        if (a.nuevoNombre) { ing.nombre = a.nuevoNombre; camb.push('ahora se llama “' + a.nuevoNombre + '”'); }
        return '✏️ Ingreso “' + ingAntes + '”: ' + camb.join(' y ') + '.';
      }
      case 'ingreso_eliminar': {
        e = elegirUno(buscarPorNombre(m.ingresos, a.nombre), a.nombre, 'los ingresos');
        if (e.aviso) return e.aviso;
        var ingBorrar = e.item;
        m.ingresos = m.ingresos.filter(function (i) { return i.id !== ingBorrar.id; });
        return '🗑️ Saqué el ingreso “' + ingBorrar.nombre + '” (' + fmt(ingBorrar.monto) + ').';
      }
      case 'deuda_agregar': {
        var nombreNorm = normalizarTexto(a.nombre);
        if ((estado.deudas || []).some(function (d) { return normalizarTexto(d.nombre) === nombreNorm; })) return 'ℹ️ Ya tenés una deuda llamada “' + a.nombre + '”.';
        estado.deudas.push({ id: uid(), nombre: a.nombre, saldo: a.saldo || 0, cuotaActual: a.cuotaActual || null, cuotaTotal: a.cuotaTotal || null, cuotaMensual: a.cuotaMensual || 0, activa: true });
        return '➕ Agregué la deuda “' + a.nombre + '” (' + fmt(a.saldo || 0) + ', ' + fmt(a.cuotaMensual || 0) + ' por mes).';
      }
      case 'deuda_editar': {
        r = buscarDeudaPorNombre(a.deuda);
        e = elegirUno(r && (r.ambigua ? r : { item: r.deuda }), a.deuda, 'las deudas');
        if (e.aviso) return e.aviso;
        var d = e.item, dAntes = d.nombre;
        if (a.saldo != null) d.saldo = a.saldo;
        if (a.cuotaMensual != null) d.cuotaMensual = a.cuotaMensual;
        if (a.cuotaActual != null) d.cuotaActual = a.cuotaActual > 0 ? a.cuotaActual : null;
        if (a.cuotaTotal != null) d.cuotaTotal = a.cuotaTotal > 0 ? a.cuotaTotal : null;
        if (a.nuevoNombre) d.nombre = a.nuevoNombre;
        if (!(d.cuotaActual && d.cuotaTotal && d.cuotaActual >= d.cuotaTotal)) d.activa = true;
        return '✏️ Actualicé la deuda “' + dAntes + '”' + (a.nuevoNombre ? ' (ahora “' + a.nuevoNombre + '”)' : '') + '.';
      }
      case 'deuda_eliminar': {
        r = buscarDeudaPorNombre(a.deuda);
        e = elegirUno(r && (r.ambigua ? r : { item: r.deuda }), a.deuda, 'las deudas');
        if (e.aviso) return e.aviso;
        var dBorrar = e.item;
        estado.deudas = estado.deudas.filter(function (x) { return x.id !== dBorrar.id; });
        return '🗑️ Eliminé la deuda “' + dBorrar.nombre + '”.';
      }
      case 'presupuesto_quitar':
        if (!(estado.presupuestos || {})[a.categoria]) return 'ℹ️ ' + getCatNombre(a.categoria) + ' no tenía presupuesto.';
        delete estado.presupuestos[a.categoria];
        return '🎯 Saqué el presupuesto de ' + getCatNombre(a.categoria) + '.';
      case 'categoria_renombrar': {
        if (!estado.catNombres) estado.catNombres = {};
        var nombreAnterior = getCatNombre(a.categoria);
        if (!a.nombre || a.nombre === CAT_MAP[a.categoria].nombre) delete estado.catNombres[a.categoria];
        else estado.catNombres[a.categoria] = a.nombre;
        return '✏️ La categoría “' + nombreAnterior + '” ahora se llama “' + getCatNombre(a.categoria) + '”.';
      }
      default:
        return null;
    }
  }
  function aplicarAccionesChat(acciones) {
    var lineas = [];
    (acciones || []).slice(0, 12).forEach(function (a) {
      if (!a || !a.tipo) return;
      try {
        var l = ejecutarAccionChat(a);
        if (l) lineas.push(l);
      } catch (err) {
        console.error('acción del chat', a, err);
        lineas.push('⚠️ No pude completar una acción (' + a.tipo + ').');
      }
    });
    return lineas;
  }

  function chatScrollAbajo() {
    var box = document.getElementById('chatMensajes');
    if (box) box.scrollTop = box.scrollHeight;
  }

  // Convierte URLs sueltas del texto (ej. las "Fuentes:" que agrega el asistente
  // al buscar en la web) en links tocables, sin abrir hueco a XSS: recorta las
  // URLs ANTES de escapar el resto del texto, así lo que va dentro de href/texto
  // siempre pasa por escapeHtml/escapeAttr.
  function linkifyEscaped(texto) {
    var re = /(https?:\/\/[^\s<>"]+)/g;
    var out = '';
    var last = 0;
    var m;
    while ((m = re.exec(texto))) {
      out += escapeHtml(texto.slice(last, m.index));
      var url = m[0].replace(/[.,;:)]+$/, ''); // no arrastrar puntuación de cierre de frase
      var cola = m[0].slice(url.length);
      out += '<a href="' + escapeAttr(url) + '" target="_blank" rel="noopener">' + escapeHtml(url) + '</a>' + escapeHtml(cola);
      last = m.index + m[0].length;
    }
    out += escapeHtml(texto.slice(last));
    return out;
  }

  // Avance contra el tope de una categoría (mismo cálculo que progresoPresupuestoTexto, pero como datos)
  function progresoPresupuestoDatos(categoria) {
    var tope = Number((estado.presupuestos || {})[categoria]) || 0;
    if (!tope) return null;
    var base = ((estado.presupuestosDesde || {})[mesActivo] || {})[categoria] || 0;
    var gastado = Math.max(0, (gastosPorCategoria(mesActivo)[categoria] || 0) - base);
    return { tope: tope, gastado: gastado, pct: Math.round((gastado / tope) * 100) };
  }

  // Tarjeta de resultado cuando el asistente anota un gasto (se ve solo en esta
  // sesión; al retomar una conversación vieja queda el texto con el "✅ …").
  function chatTarjetaHTML(card, i, j) {
    var cat = CAT_MAP[card.categoria];
    var prog = progresoPresupuestoDatos(card.categoria);
    var barra = '';
    if (prog) {
      var est = estadoPresupuesto(prog.gastado, prog.tope);
      barra = '<div style="display:flex;flex-direction:column;gap:6px">' +
        '<div class="rs" style="display:flex;justify-content:space-between"><span>Presupuesto de ' + escapeHtml(getCatNombre(card.categoria)) + '</span><span>' + prog.pct + '% usado</span></div>' +
        '<div class="bar"><i style="width:' + Math.min(100, prog.pct) + '%;background:' + est.color + '"></i></div></div>';
    }
    return '<div class="card chat-card' + (card.deshecho ? ' deshecho' : '') + '"' + (card.deshecho ? ' style="opacity:.55"' : '') + '>' +
      '<div class="row">' + tileCat(card.categoria) +
      '<div class="grow"><div class="rs">' + escapeHtml(cat ? getCatNombre(card.categoria) : card.categoria) + '</div>' +
      '<div class="rt">' + escapeHtml(card.nota || 'Gasto') + (card.deshecho ? ' · deshecho' : '') + '</div></div>' +
      '<div style="font-size:17px;font-weight:800">' + fmt(card.monto) + '</div></div>' + barra + '</div>';
  }

  function chatBurbujaHTML(rol, texto, m, idx, idAnimado) {
    if (rol === 'user') {
      return '<div class="chat-msg chat-msg-user">' + linkifyEscaped(texto).replace(/\n/g, '<br>') + '</div>';
    }
    var tieneCards = m && m.cards && m.cards.length;
    // Con tarjeta, el "✅ $ X en Categoría" textual sobra (la tarjeta ya lo dice)
    var visible = tieneCards ? texto.replace(/\n\n✅ [^\n]*/, '') : texto;
    var cuerpo = idAnimado
      ? '<div class="chat-msg chat-msg-assistant" id="chatUltimaResp"></div>'
      : '<div class="chat-msg chat-msg-assistant">' + linkifyEscaped(visible).replace(/\n/g, '<br>') + '</div>';
    var tarjetas = tieneCards ? m.cards.map(function (c, j) { return chatTarjetaHTML(c, idx, j); }).join('') : '';
    var hayDeshacer = !!(m && m.snap);
    var acciones = '<div class="chat-actions">' +
      '<button type="button" data-act="escuchar" data-i="' + idx + '" aria-label="Escuchar respuesta">' + ico('volume', 20) + '</button>' +
      '<button type="button" data-act="copiar" data-i="' + idx + '" aria-label="Copiar respuesta">' + ico('copy', 20) + '</button>' +
      (hayDeshacer ? '<button type="button" data-act="deshacer" data-i="' + idx + '" aria-label="Deshacer los cambios">' + ico('undo', 20) + '</button>' : '') +
      '</div>';
    return '<div class="chat-line"><span class="mini"></span><div class="chat-col">' + cuerpo + tarjetas + acciones + '</div></div>';
  }

  function chatNombreUsuario() {
    if (!miUsuario) return '';
    var meta = miUsuario.user_metadata || {};
    var nombre = meta.full_name || meta.name || (miUsuario.email || '').split('@')[0] || '';
    return nombre.split(' ')[0];
  }

  // Revela el texto de a poco (como si se estuviera "escribiendo"), en vez de
  // pegarlo entero de golpe — mismo efecto visual que Gemini/ChatGPT, sin
  // necesitar streaming real de la API (la respuesta ya llegó completa).
  function animarTextoChat(el, textoCompleto) {
    var i = 0;
    var totalMs = Math.min(3200, Math.max(500, textoCompleto.length * 22));
    var totalFrames = Math.max(1, Math.round(totalMs / 16));
    var porFrame = Math.max(1, Math.ceil(textoCompleto.length / totalFrames));
    function tick() {
      i = Math.min(textoCompleto.length, i + porFrame);
      el.innerHTML = escapeHtml(textoCompleto.slice(0, i)).replace(/\n/g, '<br>');
      chatScrollAbajo();
      if (i < textoCompleto.length) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // animarUltimo: si es true y el último mensaje es del asistente, lo pinta
  // vacío y lo va revelando con animarTextoChat() en vez de mostrarlo entero.
  function renderChatMensajes(animarUltimo) {
    var box = document.getElementById('chatMensajes');
    if (!box) return;
    box.classList.toggle('chat-vacio', !chatHistorial.length);
    if (!chatHistorial.length) {
      var nombre = chatNombreUsuario();
      box.innerHTML = '<div class="chat-vacio-icon"><span class="mini" style="width:56px;height:56px"></span></div>' +
        '<div class="chat-vacio-saludo">¿Qué necesitás' + (nombre ? ', ' + escapeHtml(nombre) : '') + '?</div>';
      return;
    }
    var ultimoIdx = chatHistorial.length - 1;
    var animar = animarUltimo && chatHistorial[ultimoIdx].rol === 'assistant';
    box.innerHTML = chatHistorial.map(function (m, i) {
      return chatBurbujaHTML(m.rol, m.texto, m, i, animar && i === ultimoIdx);
    }).join('') +
      (chatEnviando ? '<div class="chat-line"><span class="mini"></span><div class="chat-msg chat-msg-assistant chat-typing">Escribiendo…</div></div>' : '');
    chatScrollAbajo();
    if (animar) {
      var el = document.getElementById('chatUltimaResp');
      var ult = chatHistorial[ultimoIdx];
      var textoAnim = (ult.cards && ult.cards.length) ? ult.texto.replace(/\n\n✅ [^\n]*/, '') : ult.texto;
      if (el) animarTextoChat(el, textoAnim);
    }
  }

  // Acciones de cada respuesta: escuchar, copiar y deshacer un gasto recién anotado
  function chatAccionMensaje(act, idx) {
    var m = chatHistorial[idx];
    if (!m) return;
    if (act === 'escuchar') {
      var limpio = (m.textoIA || m.texto || '');
      if (chatVozExterna) chatVozExterna.hablar(limpio, null, true);
      else if (window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(limpio); u.lang = 'es-AR'; window.speechSynthesis.speak(u); }
    } else if (act === 'copiar') {
      var txt = (m.texto || '').replace(/\n\n✅ [^\n]*/, '');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { toast('Copiado'); }, function () { toast('No pude copiar'); });
      else toast('Tu navegador no deja copiar acá');
    } else if (act === 'deshacer') {
      deshacerCambiosChat(m);
    }
  }

  // Vuelve todo a como estaba ANTES de lo que hizo el asistente en este mensaje (foto en memoria).
  // Se conservan las conversaciones guardadas (estado.chats): lo único que se revierte son los datos.
  function deshacerCambiosChat(m) {
    if (!m || !m.snap) { toast('Ya no se puede deshacer ese cambio.'); return; }
    var chats = estado.chats;
    try { estado = JSON.parse(m.snap); } catch (e) { toast('No pude deshacer.'); return; }
    estado.chats = chats;
    if (!estado.deudas) estado.deudas = [];
    if (!estado.catNombres) estado.catNombres = {};
    if (!estado.presupuestos) estado.presupuestos = {};
    if (!estado.meses[mesActivo]) mesActivo = asegurarMesActual();
    m.snap = null;
    m.deshecho = true;
    (m.cards || []).forEach(function (c) {
      c.deshecho = true;
      var ix = chatYaRegistrados.indexOf(c.clave);
      if (ix !== -1) chatYaRegistrados.splice(ix, 1); // si lo vuelve a pedir, se puede anotar de nuevo
    });
    guardar();
    render(false);
    renderChatMensajes();
    toast('Cambios deshechos');
  }

  // vista (opcional): 'voz' | 'chat'. asistente.js decide cuál mostrar si no se indica
  // (voz si el navegador tiene dictado; si no, chat de texto).
  function abrirChat(vista) {
    if (!modoCuenta || !miProyectoId) { toast('Iniciá sesión primero.'); return; }
    // Cada vez que se abre la burbuja arranca una conversación nueva — las
    // anteriores se retoman desde el ícono de historial, no automáticamente.
    chatHistorial = [];
    chatSesionId = null;
    chatYaRegistrados = [];
    var panel = document.getElementById('chatPanel');
    if (panel) panel.classList.remove('modo-historial');
    document.getElementById('chatBack').classList.add('open');
    renderChatMensajes();
    if (window.MFAsis) window.MFAsis.alAbrir(vista);
    else if (panel) { panel.classList.add('on'); document.getElementById('chatBack').classList.add('modo-chat'); }
  }
  function cerrarChat() {
    document.getElementById('chatBack').classList.remove('open');
    if (window.MFAsis) window.MFAsis.alCerrar();
  }

  // alTerminar (opcional): se llama al final de todo el ciclo (con el texto
  // que dijo la IA, o null si falló) — lo usa el Modo Voz para saber cuándo
  // arrancar a hablar / volver a escuchar.
  function enviarMensajeChat(texto, alTerminar, opciones) {
    texto = texto.trim();
    if (!texto || chatEnviando) { if (alTerminar) alTerminar(null); return; }
    chatHistorial.push({ rol: 'user', texto: texto });
    chatPersistirLog();
    chatEnviando = true;
    renderChatMensajes();
    // Al armar el historial para la IA, mandamos SOLO lo que ella misma dijo
    // (sin el "✅ ..." que agrega el cliente) — si no, la IA ve sus propias
    // confirmaciones viejas en el historial y tiende a repetirlas/recontarlas.
    // Los avisos de falla ("No entendí…", "No pude responder…") no se le mandan: solo la confundirían
    var historialParaIA = chatHistorial.slice(0, -1).filter(function (h) {
      return !(h.rol === 'assistant' && /^(No entendí bien|No pude responder ahora|Perdón, se me trabó)/.test(h.texto || ''));
    }).map(function (h) {
      return { rol: h.rol, texto: h.textoIA || h.texto };
    });
    // La respuesta llega de a pedazos (stream): el texto se ve en vivo y la voz empieza con la primera frase
    var textoVivo = '';
    var vozSesion = null;
    function alParcial(trozo) {
      textoVivo += trozo;
      var el = document.querySelector('#chatMensajes .chat-typing, #chatMensajes .chat-vivo');
      if (el) { el.textContent = textoVivo; el.classList.remove('chat-typing'); el.classList.add('chat-vivo'); chatScrollAbajo(); }
    }
    function alFrase(frase) {
      if (!chatVozActivada || !chatVozExterna || !chatVozExterna.iniciar) return;
      if (!vozSesion) vozSesion = chatVozExterna.iniciar();
      vozSesion.agregar(frase);
    }
    llamarChatIA({ mensaje: texto, historial: historialParaIA, contexto: contextoFinancieroParaChat(), modo: (opciones && opciones.modo === 'voz') ? 'voz' : 'texto' },
      alParcial, alFrase).then(function (res) {
      chatEnviando = false;
      if (res.error || !res.data || res.data.error) {
        if (vozSesion) vozSesion.terminar(null);
        chatHistorial.push({ rol: 'assistant', texto: 'No pude responder ahora, intentá de nuevo en un rato.' });
        chatPersistirLog();
        renderChatMensajes(true);
        if (alTerminar) alTerminar(null);
        return;
      }
      // Freno de seguridad: si la IA repite (por error) un gasto que ya se
      // registró en esta conversación, NO lo volvemos a cargar — evita
      // duplicar gastos reales por una confusión del modelo.
      var datos = res.data;
      var hayCambios = !!((datos.registrar && datos.registrar.length) || datos.presupuesto || (datos.pagosDeudas && datos.pagosDeudas.length) || (datos.acciones && datos.acciones.length));
      var lineaPermiso = null;
      if (hayCambios && miRol === 'lector') {
        // Cuenta de solo lectura: el asistente puede contestar, pero no modificar nada
        datos = { respuesta: datos.respuesta, registrar: [], presupuesto: null, pagosDeudas: [], acciones: [] };
        hayCambios = false;
        lineaPermiso = '🔒 Tu cuenta es de solo lectura, así que no puedo modificar datos.';
      }
      // Foto del estado ANTES de aplicar nada: alimenta el botón "Deshacer" (solo vive en memoria)
      var snap = hayCambios ? JSON.stringify(estado) : null;
      // Cambios generales que pidió el usuario (editar, sacar, agregar filas/ingresos/deudas, cambiar de mes…).
      // Van primero: si cambian de mes, los gastos nuevos de este mismo mensaje caen en ese mes.
      var accionesLineas = aplicarAccionesChat(datos.acciones);
      var registrados = (datos.registrar || []).filter(function (it) {
        var clave = it.categoria + '|' + it.monto + '|' + (it.nota || '');
        if (chatYaRegistrados.indexOf(clave) !== -1) return false;
        chatYaRegistrados.push(clave);
        return true;
      });
      // Presupuesto por chat: si el usuario acaba de fijar un tope (ej. "quiero
      // gastar 200000 en comida este mes"), lo guardamos como cualquier otro
      // presupuesto de la app (misma tabla que usa la página de Analíticas), y
      // marcamos desde cuánto gastado arranca a contar (ANTES de sumar los
      // gastos de este mismo mensaje) — así "es un presupuesto nuevo" y no
      // arrastra lo que ya se había gastado en la categoría antes de pedirlo.
      var pres = datos.presupuesto;
      var presupuestoTexto = null;
      if (pres && CAT_MAP[pres.categoria] && Number(pres.monto) > 0) {
        marcarBasePresupuestoChat(pres.categoria);
        estado.presupuestos[pres.categoria] = Math.round(Number(pres.monto));
        presupuestoTexto = '🎯 Presupuesto de ' + getCatNombre(pres.categoria) + ': ' + fmt(pres.monto) + ' este mes.';
      }
      var tarjetas = [];
      registrados.forEach(function (it) {
        // La fecha solo se respeta si cae en el mes que se está viendo (los gastos se anotan en ese mes)
        var fecha = (it.fecha && it.fecha.slice(0, 7) === mesActivo) ? it.fecha : undefined;
        registrarCompra(it.categoria, it.monto, it.nota || null, null, fecha, it.fila ? { nombre: it.fila } : null);
        tarjetas.push({ categoria: it.categoria, monto: it.monto, nota: it.nota || null, clave: it.categoria + '|' + it.monto + '|' + (it.nota || '') });
      });
      // Pagos de deudas que pidió el usuario (registrarPago/revertirPago guardan y redibujan solos)
      var pagosLineas = aplicarPagosDeudasChat(datos.pagosDeudas);
      if (hayCambios) { guardar(); render(false); }
      // Progreso contra presupuesto: una línea por cada categoría distinta que
      // se acaba de registrar (o que se acaba de fijar), solo si tiene tope.
      var categoriasParaProgreso = registrados.map(function (it) { return it.categoria; });
      if (pres && categoriasParaProgreso.indexOf(pres.categoria) === -1) categoriasParaProgreso.push(pres.categoria);
      var progresoLineas = [];
      categoriasParaProgreso.filter(function (c, i, arr) { return arr.indexOf(c) === i; }).forEach(function (c) {
        var linea = progresoPresupuestoTexto(c);
        if (linea) progresoLineas.push(linea);
      });
      var textoIA = datos.respuesta || '';
      var textoMostrado = textoIA;
      if (registrados.length) {
        textoMostrado += '\n\n✅ ' + registrados.map(function (it) { return fmt(it.monto) + ' en ' + getCatNombre(it.categoria) + (it.fila ? ' · fila ' + it.fila : ''); }).join(', ');
      }
      if (accionesLineas.length) textoMostrado += '\n\n' + accionesLineas.join('\n');
      if (pagosLineas.length) textoMostrado += '\n\n' + pagosLineas.join('\n');
      if (presupuestoTexto) textoMostrado += '\n\n' + presupuestoTexto;
      if (progresoLineas.length) textoMostrado += '\n\n' + progresoLineas.join('\n');
      if (lineaPermiso) textoMostrado += '\n\n' + lineaPermiso;
      // Solo se puede deshacer lo último que hizo el asistente (la foto vieja ya no sirve)
      chatHistorial.forEach(function (h) { if (h.snap) h.snap = null; });
      // `cards` y `snap` viven solo en memoria (chatPersistirLog no los guarda): no cambia el modelo de datos
      chatHistorial.push({ rol: 'assistant', texto: textoMostrado, textoIA: textoIA, cards: tarjetas.length ? tarjetas : undefined, snap: snap || undefined });
      chatPersistirLog();
      // Si el texto ya se fue viendo en vivo, no se vuelve a "tipear" desde cero
      renderChatMensajes(!textoVivo);
      if (vozSesion) {
        // Ya se está hablando por frases: se suma lo que falte (por ejemplo si cambió la respuesta tras buscar en la web) y se cierra
        var yaDicho = textoVivo.trim();
        if (yaDicho && textoIA.trim().indexOf(yaDicho) !== 0) vozSesion.agregar(textoIA);
        vozSesion.terminar(function () { if (alTerminar) alTerminar(textoIA); });
      } else {
        chatHablar(textoIA, function () { if (alTerminar) alTerminar(textoIA); });
      }
    }).catch(function () {
      chatEnviando = false;
      if (vozSesion) vozSesion.terminar(null);
      chatHistorial.push({ rol: 'assistant', texto: 'No pude responder ahora, intentá de nuevo en un rato.' });
      chatPersistirLog();
      renderChatMensajes(true);
      if (alTerminar) alTerminar(null);
    });
  }

  // Pide la respuesta al asistente. Primero por STREAM (llegan frases a medida que la IA las arma: se puede
  // mostrar y hablar sin esperar el final); si el stream no anda, cae al pedido normal.
  // Devuelve una promesa con { data, error }, igual que supabase.functions.invoke.
  function llamarChatIA(cuerpo, alParcial, alFrase) {
    var recibioAlgo = false;
    return sbClient.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) throw new Error('sin sesión');
      return fetch(CUENTA_URL + '/functions/v1/chat-ia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.access_token, 'apikey': CUENTA_ANON_KEY },
        body: JSON.stringify(Object.assign({}, cuerpo, { stream: true }))
      });
    }).then(function (res) {
      if (!res.ok || !res.body || !res.body.getReader) throw new Error('sin stream');
      var lector = res.body.getReader(), dec = new TextDecoder(), buf = '', resultado = null, errorMsg = null;
      function procesar(linea) {
        var ev; try { ev = JSON.parse(linea); } catch (e) { return; }
        if (ev.t === 'd') { recibioAlgo = true; if (alParcial) alParcial(ev.s || ''); }
        else if (ev.t === 'frase') { recibioAlgo = true; if (alFrase) alFrase(ev.texto || ''); }
        else if (ev.t === 'fin') resultado = ev.data;
        else if (ev.t === 'error') errorMsg = ev.error || 'error';
        else if (ev.respuesta !== undefined) resultado = ev; // el servidor contestó sin stream (versión vieja)
      }
      function leer() {
        return lector.read().then(function (x) {
          if (x.done) { if (buf.trim()) procesar(buf.trim()); return; }
          buf += dec.decode(x.value, { stream: true });
          var idx;
          while ((idx = buf.indexOf('\n')) !== -1) { var linea = buf.slice(0, idx).trim(); buf = buf.slice(idx + 1); if (linea) procesar(linea); }
          return leer();
        });
      }
      return leer().then(function () {
        if (resultado) return { data: resultado, error: null };
        throw new Error(errorMsg || 'el stream se cortó');
      });
    }).catch(function (e) {
      // Si ya se mostró o habló algo, NO se repite el pedido (saldría duplicado): se informa el error
      if (recibioAlgo) return { data: null, error: e };
      return sbClient.functions.invoke('chat-ia', { body: cuerpo });
    });
  }

  // ---------- Persistencia ----------
  function guardar() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); }
    catch (e) { console.error('No se pudo guardar', e); }
    if (modoCuenta) {
      if (miRol === 'lector') return; // solo lectura: nunca escribe al proyecto compartido
      clearTimeout(guardarCuentaTimer);
      guardarCuentaTimer = setTimeout(guardarEnProyecto, 800);
    } else if (nubeActiva()) {
      clearTimeout(guardarNubeTimer);
      guardarNubeTimer = setTimeout(nubeGuardar, 800); // subida con leve retraso
    }
  }

  function cargar() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (raw) {
      try { estado = JSON.parse(raw); } catch (e) { estado = null; }
    }
    if (!estado || !estado.meses) {
      estado = construirDesdeSemilla();
      guardar();
    }
    // normalizar campos que pueden faltar en copias viejas
    if (!estado.deudas) estado.deudas = [];
    if (!estado.catNombres) estado.catNombres = {};
    if (!estado.presupuestos) estado.presupuestos = {};
    if (!estado.chats) estado.chats = [];
  }

  // Convierte los datos precargados del Excel al formato interno (con ids)
  function construirDesdeSemilla() {
    var semilla = window.DATOS_INICIALES || { meses: {}, deudas: [] };
    var out = { version: 1, meses: {}, deudas: [], catNombres: {}, presupuestos: {}, chats: [] };
    Object.keys(semilla.meses || {}).forEach(function (k) {
      var m = semilla.meses[k];
      out.meses[k] = {
        ingresos: (m.ingresos || []).map(function (i) { return { id: uid(), nombre: i.nombre, monto: i.monto }; }),
        gastos: (m.gastos || []).map(function (g) { return { id: uid(), categoria: g.categoria, nombre: g.nombre, monto: g.monto }; })
      };
    });
    out.deudas = (semilla.deudas || []).map(function (d) {
      return {
        id: uid(), nombre: d.nombre, saldo: d.saldo || 0,
        cuotaActual: d.cuotaActual, cuotaTotal: d.cuotaTotal,
        cuotaMensual: d.cuotaMensual || 0, activa: true
      };
    });
    if (Object.keys(out.meses).length === 0) {
      var hoy = new Date();
      var k = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
      out.meses[k] = { ingresos: [], gastos: [] };
    }
    return out;
  }

  // ============================================================
  //  NUBE (Supabase) — sincronización con el bot de Telegram
  // ============================================================
  function cargarNubeCfg() {
    try { nubeCfg = JSON.parse(localStorage.getItem(NUBE_KEY) || 'null'); } catch (e) { nubeCfg = null; }
  }
  function nubeActiva() { return !!(nubeCfg && nubeCfg.url && nubeCfg.key); }
  function nubeHeaders(extra) {
    var h = { 'apikey': nubeCfg.key, 'Authorization': 'Bearer ' + nubeCfg.key, 'Content-Type': 'application/json' };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }
  function nubeUrl(path) { return nubeCfg.url.replace(/\/+$/, '') + '/rest/v1/' + path; }

  // Trae la fila completa {data, rev} o null si no existe
  function nubeTraer() {
    return fetch(nubeUrl('finanzas?id=eq.' + FILA_ID + '&select=data,rev'), { headers: nubeHeaders() })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (rows) { return rows[0] || null; });
  }

  // Sube el estado actual (upsert) incrementando la revisión
  function nubeGuardar() {
    if (!nubeActiva() || guardandoNube) return Promise.resolve();
    guardandoNube = true;
    nubeRev = (nubeRev < 0 ? 0 : nubeRev) + 1;
    var body = [{ id: FILA_ID, data: estado, rev: nubeRev, updated_by: 'app', updated_at: new Date().toISOString() }];
    return fetch(nubeUrl('finanzas'), {
      method: 'POST',
      headers: nubeHeaders({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error('HTTP ' + r.status + ' ' + t); }); })
      .catch(function (e) { console.warn('nube: no se pudo guardar', e); })
      .then(function () { guardandoNube = false; });
  }

  // Revisa periódicamente si el bot (u otro dispositivo) cambió algo
  function nubeIniciarPoll() {
    if (nubePollTimer) clearInterval(nubePollTimer);
    nubePollTimer = setInterval(function () {
      if (!nubeActiva() || guardandoNube || modoCuenta) return;
      fetch(nubeUrl('finanzas?id=eq.' + FILA_ID + '&select=rev'), { headers: nubeHeaders() })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (rows) {
          var row = rows[0];
          if (!row || row.rev <= nubeRev) return;
          // hay cambios remotos; evitamos interrumpir si estás escribiendo
          var ae = document.activeElement;
          if (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)) return;
          return nubeTraer().then(function (full) {
            if (!full) return;
            estado = full.data; nubeRev = full.rev;
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); } catch (e) {}
            if (!estado.meses[mesActivo]) mesActivo = mesesOrdenados().slice(-1)[0];
            render(true);
            toast('Actualizado desde la nube ☁️');
          });
        })
        .catch(function () {});
    }, 5000);
  }

  // Conecta al arrancar: baja lo remoto o sube lo local si es la primera vez
  function nubeConectar() {
    if (!nubeActiva()) return Promise.resolve();
    return nubeTraer().then(function (row) {
      if (row) {
        estado = row.data; nubeRev = row.rev;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); } catch (e) {}
        mesActivo = asegurarMesActual();
        render(true);
      } else {
        nubeRev = 0;
        return nubeGuardar(); // primera vez: subimos lo que ya tenías local
      }
    }).then(function () {
      nubeIniciarPoll();
      actualizarIndicadorNube(true);
    }).catch(function (e) {
      console.warn('nube: no se pudo conectar', e);
      actualizarIndicadorNube(false);
      toast('No se pudo conectar a la nube ☁️');
    });
  }

  function actualizarIndicadorNube(ok) {
    var b = document.getElementById('menuBtn');
    if (b) b.classList.toggle('conectado', nubeActiva() && ok !== false);
  }

  // ============================================================
  //  CUENTA CON GOOGLE — login real, un proyecto compartido por persona
  //  Solo corre en la versión hosteada (http/https). El archivo local
  //  (file://) ignora todo esto y sigue funcionando como siempre.
  // ============================================================
  function esHosteado() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }
  function mostrarLoginGate(mostrar) {
    var g = document.getElementById('loginGate');
    if (g) g.style.display = mostrar ? 'flex' : 'none';
  }
  function mostrarBotonVincular(mostrar) {
    var b = document.getElementById('conectarGoogleBtn');
    if (b) b.style.display = mostrar ? '' : 'none';
  }
  function entrarComoInvitado() {
    try { localStorage.setItem('misFinanzas_invitado', '1'); } catch (e) {}
    mostrarLoginGate(false);
    mostrarBotonVincular(true);
  }
  function iniciarLoginGoogle() {
    sbClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
  }

  // Link de invitación (?invite=token en la URL): lo guardamos apenas se
  // detecta, para que sobreviva el ida-y-vuelta del login con Google.
  function capturarInviteLinkDeUrl() {
    try {
      var params = new URLSearchParams(location.search);
      var tokenUrl = params.get('invite');
      if (tokenUrl) localStorage.setItem('misFinanzas_inviteToken', tokenUrl);
    } catch (e) {}
  }
  function hayInviteLinkPendiente() {
    try { return !!localStorage.getItem('misFinanzas_inviteToken'); } catch (e) { return false; }
  }
  function tomarInviteLinkPendiente() {
    var t = null;
    try { t = localStorage.getItem('misFinanzas_inviteToken'); } catch (e) {}
    try { localStorage.removeItem('misFinanzas_inviteToken'); } catch (e) {}
    return t;
  }

  // sbClient.functions.invoke() envuelve cualquier respuesta no-2xx en un error
  // genérico ("Edge Function returned a non-2xx status code") y esconde el
  // mensaje real que mandó la función (ej: "ya tenés tu proyecto con datos").
  // El texto real vive en error.context, que es la Response cruda — hay que
  // leerla a mano para mostrar algo útil en vez del genérico.
  function errorDeEdgeFunction(error) {
    return (async function () {
      try {
        if (error && error.context && typeof error.context.json === 'function') {
          var body = await error.context.json();
          if (body && body.error) return new Error(body.error);
        }
      } catch (e) {}
      return error;
    })();
  }

  // Compara el estado actual (ignorando ids autogenerados) contra una semilla
  // recién construida, para saber si un invitado realmente cargó datos propios
  // o si todavía está mirando los datos de ejemplo sin haberlos tocado —
  // así al vincular con Google no le mandamos datos de muestra a su cuenta real.
  function huellaEstado(st) {
    var claves = Object.keys(st.meses || {}).sort();
    return JSON.stringify({
      meses: claves.map(function (k) {
        var m = st.meses[k] || {};
        return {
          k: k,
          ingresos: (m.ingresos || []).map(function (i) { return [i.nombre, i.monto]; }),
          gastos: (m.gastos || []).map(function (g) { return [g.categoria, g.nombre, g.monto]; })
        };
      }),
      deudas: (st.deudas || []).map(function (d) {
        return [d.nombre, d.saldo, d.cuotaActual, d.cuotaTotal, d.cuotaMensual, d.activa];
      })
    });
  }
  function invitadoTieneDatosPropios() {
    return huellaEstado(estado) !== huellaEstado(construirDesdeSemilla());
  }

  // Decide a qué proyecto pertenece este usuario (el propio, uno al que lo
  // invitaron, o le crea uno nuevo si es la primera vez que entra) y carga
  // sus datos reales, reemplazando lo que hubiera local/de semilla.
  var bootstrapEnCurso = false;
  async function bootstrapProyecto(user) {
    if (bootstrapEnCurso) return; // ya se está resolviendo, evita crear proyectos duplicados
    bootstrapEnCurso = true;
    try {
      var r1 = await sbClient.from('miembros').select('proyecto_id,rol')
        .eq('user_id', user.id).eq('estado', 'aceptado').maybeSingle();
      if (r1.error) throw r1.error;
      var miProps = r1.data;

      // Si vino de un link de invitación (?invite=token, compartido por WhatsApp
      // o cualquier otro medio), lo canjeamos antes que nada — ahí el rol y el
      // proyecto ya están definidos por el dueño, sin importar con qué mail
      // se haya logueado. Esto corre SIEMPRE que haya un token pendiente, sin
      // importar si la cuenta ya tiene membresía propia: si no lo hiciéramos así,
      // alguien que ya entró antes (aunque sea de curioso, con un proyecto propio
      // vacío) se quedaría viendo su proyecto viejo en vez de unirse al compartido,
      // sin ningún error visible. La función del servidor ya sabe manejar ese caso
      // (borra el proyecto propio si nunca se usó, o avisa con un error claro si
      // tiene datos reales).
      if (hayInviteLinkPendiente()) {
        var tokenInvite = tomarInviteLinkPendiente();
        var rJoin = await sbClient.functions.invoke('unirse-por-link', { body: { token: tokenInvite } });
        if (rJoin.error) throw await errorDeEdgeFunction(rJoin.error);
        if (rJoin.data && rJoin.data.requiereConfirmacion) {
          // Ya tiene datos propios cargados: no los pisamos en silencio, le
          // preguntamos primero y solo si confirma le pedimos a la función que
          // borre su proyecto viejo y la sume al compartido (forzar:true).
          var quiereForzar = await confirmarUnionForzada(rJoin.data.duenoEmail);
          if (quiereForzar) {
            var rJoin2 = await sbClient.functions.invoke('unirse-por-link', { body: { token: tokenInvite, forzar: true } });
            if (rJoin2.error) throw await errorDeEdgeFunction(rJoin2.error);
            if (rJoin2.data && rJoin2.data.error) throw new Error(rJoin2.data.error);
            miProps = { proyecto_id: rJoin2.data.proyectoId, rol: rJoin2.data.rol };
            toast('¡Te sumaste al proyecto compartido! 🎉');
          }
          // Si cancela, seguimos con miProps tal cual (su propio proyecto de siempre).
        } else if (rJoin.data && rJoin.data.error) {
          throw new Error(rJoin.data.error);
        } else {
          miProps = { proyecto_id: rJoin.data.proyectoId, rol: rJoin.data.rol };
          toast('¡Te sumaste al proyecto compartido! 🎉');
        }
      } else if (!miProps) {
        var mail = (user.email || '').toLowerCase();
        var r2 = await sbClient.from('miembros').select('id,proyecto_id,rol')
          .eq('email', mail).eq('estado', 'pendiente').is('user_id', null).maybeSingle();
        if (r2.error) throw r2.error;

        if (r2.data) {
          var r3 = await sbClient.from('miembros')
            .update({ user_id: user.id, estado: 'aceptado' }).eq('id', r2.data.id);
          if (r3.error) throw r3.error;
          miProps = { proyecto_id: r2.data.proyecto_id, rol: r2.data.rol };
          toast('¡Te sumaste a un proyecto compartido! 🎉');
        } else {
          // Generamos el id acá mismo: pedirle a Supabase que nos devuelva el id
          // recién creado (.select()) no funciona todavía en este punto, porque
          // la política de lectura de "proyectos" exige una fila en "miembros"
          // que recién se crea en el siguiente paso — sin esto, el insert se
          // rechaza igual (RLS) aunque los datos sean correctos.
          var nuevoProyectoId = crypto.randomUUID();
          var datosInvitado = invitadoTieneDatosPropios() ? estado : null;
          var insertProyecto = { id: nuevoProyectoId, dueno_id: user.id };
          if (datosInvitado) insertProyecto.data = datosInvitado;
          var r4 = await sbClient.from('proyectos').insert(insertProyecto);
          if (r4.error) throw r4.error;
          var r5 = await sbClient.from('miembros').insert({
            proyecto_id: nuevoProyectoId, user_id: user.id, email: mail, rol: 'dueno', estado: 'aceptado'
          });
          if (r5.error) throw r5.error;
          miProps = { proyecto_id: nuevoProyectoId, rol: 'dueno' };
          if (datosInvitado) toast('Tus datos de invitado se vincularon a tu cuenta ✅');
        }
      }

      miProyectoId = miProps.proyecto_id;
      miRol = miProps.rol;

      var r6 = await sbClient.from('proyectos').select('data,rev').eq('id', miProyectoId).single();
      if (r6.error) throw r6.error;

      estado = r6.data.data;
      if (!estado.deudas) estado.deudas = [];
      if (!estado.catNombres) estado.catNombres = {};
      if (!estado.presupuestos) estado.presupuestos = {};
      cuentaRev = r6.data.rev;
      mesActivo = asegurarMesActual();
      render(true);
      actualizarChipUsuario(user);
      iniciarPollProyectoCuenta();
    } catch (e) {
      console.error('bootstrapProyecto', e);
      toast((e && e.message) || 'No se pudo cargar tu proyecto — recargá la página para reintentar.');
    } finally {
      bootstrapEnCurso = false;
    }
  }

  // Avisa a los demás miembros que hubo actividad — pero no en cada guardado
  // (guardar() dispara esto cada ~800ms mientras alguien tipea, sería spam).
  // Como mucho uno cada 2 minutos.
  var ultimoAvisoActividad = 0;
  // Se pisa cada vez que se agrega/edita un gasto o ingreso concreto (ver
  // registrarCompra y conectarItemEvents), para que el aviso diga QUÉ pasó
  // en vez de un genérico "actualizó tus finanzas". Si no hay nada puntual
  // (ej. se borró una fila, se tocó una deuda), cae al genérico.
  var ultimaAccionDescripcion = null;
  function avisarActividad() {
    if (!miUsuario) return;
    var ahora = Date.now();
    if (ahora - ultimoAvisoActividad < 2 * 60 * 1000) return;
    ultimoAvisoActividad = ahora;
    var meta = miUsuario.user_metadata || {};
    var nombre = meta.full_name || meta.name || (miUsuario.email || '').split('@')[0] || 'Alguien';
    var detalle = ultimaAccionDescripcion || 'actualizó tus finanzas compartidas';
    ultimaAccionDescripcion = null;
    sbClient.functions.invoke('enviar-notificacion', {
      body: { proyectoId: miProyectoId, excluirUserId: miUsuario.id, titulo: 'Mis Finanzas', cuerpo: nombre + ' ' + detalle + '.' }
    }).catch(function () {}); // best-effort: si falla, no interrumpe el guardado real
  }

  function guardarEnProyecto() {
    if (!modoCuenta || !miProyectoId || guardandoCuenta || miRol === 'lector') return;
    guardandoCuenta = true;
    cuentaRev = (cuentaRev < 0 ? 0 : cuentaRev) + 1;
    sbClient.from('proyectos').update({
      data: estado, rev: cuentaRev, updated_by: 'app', updated_at: new Date().toISOString()
    }).eq('id', miProyectoId).then(function (res) {
      if (res.error) console.warn('guardarEnProyecto: no se pudo guardar', res.error);
      else avisarActividad();
      guardandoCuenta = false;
    });
  }

  function iniciarPollProyectoCuenta() {
    if (cuentaPollTimer) clearInterval(cuentaPollTimer);
    cuentaPollTimer = setInterval(function () {
      if (!modoCuenta || !miProyectoId || guardandoCuenta) return;
      sbClient.from('proyectos').select('rev').eq('id', miProyectoId).single().then(function (res) {
        if (res.error || !res.data || res.data.rev <= cuentaRev) return;
        var ae = document.activeElement;
        if (ae && /INPUT|SELECT|TEXTAREA/.test(ae.tagName)) return;
        sbClient.from('proyectos').select('data,rev').eq('id', miProyectoId).single().then(function (res2) {
          if (res2.error || !res2.data) return;
          estado = res2.data.data; cuentaRev = res2.data.rev;
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); } catch (e) {}
          if (!estado.meses[mesActivo]) mesActivo = mesesOrdenados().slice(-1)[0];
          render(true);
          toast('Actualizado ☁️');
        });
      });
    }, 5000);
  }

  function actualizarChipUsuario(user) {
    miUsuario = user;
    var meta = user.user_metadata || {};
    var nombre = meta.full_name || meta.name || (user.email || '').split('@')[0] || 'Usuario';
    var avatarUrl = meta.avatar_url || meta.picture;
    // Mientras no sepamos el rol (bootstrapProyecto todavía no terminó, o falló),
    // mostramos un texto genérico — igual confirma que la sesión de Google está activa.
    var rolTxt = miRol === 'dueno' ? 'Dueño del proyecto'
      : miRol === 'editor' ? 'Colaborador (edición)'
      : miRol === 'lector' ? 'Colaborador (solo lectura)'
      : 'Cuenta Google';
    var elNombre = document.getElementById('userNombre'); if (elNombre) elNombre.textContent = nombre;
    var elSub = document.getElementById('userSub'); if (elSub) elSub.textContent = rolTxt;
    var avatarEl = document.getElementById('userAvatar');
    if (avatarEl) {
      if (avatarUrl) avatarEl.innerHTML = '<img src="' + escapeAttr(avatarUrl) + '" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">';
      else avatarEl.textContent = nombre.slice(0, 2).toUpperCase();
    }
    var salirBtn = document.getElementById('cerrarSesionBtn');
    if (salirBtn) salirBtn.style.display = '';
    var chipEl = document.getElementById('userChip');
    if (chipEl) { chipEl.classList.add('clickable'); chipEl.onclick = modalCuenta; }
  }

  // Modal de cuenta: quién sos, tu rol, invitar colaboradores (solo el dueño) y cerrar sesión.
  function modalCuenta() {
    if (!modoCuenta || !miUsuario) return;
    var meta = miUsuario.user_metadata || {};
    var nombre = meta.full_name || meta.name || (miUsuario.email || '').split('@')[0] || 'Usuario';
    var rolTxt = miRol === 'dueno' ? 'Dueño del proyecto'
      : miRol === 'editor' ? 'Colaborador (edición)'
      : miRol === 'lector' ? 'Colaborador (solo lectura)'
      : 'Cuenta Google';

    var htmlInvitar = miRol === 'dueno' ?
      '<div class="field-row">' +
        '<div class="field" style="flex:2"><label>Invitar por mail</label><input id="cuInviteMail" placeholder="mail@ejemplo.com"></div>' +
        '<div class="field" style="flex:1"><label>Permiso</label><select id="cuInviteRol">' +
          '<option value="editor">Puede editar</option>' +
          '<option value="lector">Solo lectura</option>' +
        '</select></div>' +
      '</div>' +
      '<div>' +
        '<div class="modal-actions" style="justify-content:flex-start;margin-top:-4px;flex-wrap:wrap">' +
          '<button class="btn btn-primary btn-sm" id="cuInviteBtn">✉️ Enviar invitación a ese mail</button>' +
        '</div>' +
        '<p class="sub" style="margin:10px 0 6px">O generá un link con el permiso de arriba y compartilo vos — quien lo abra elige la cuenta de Google que quiera.</p>' +
        '<div class="modal-actions" style="justify-content:flex-start;margin-top:0">' +
          '<button class="btn btn-sm" id="cuInviteLink">🔗 Generar link para WhatsApp</button>' +
        '</div>' +
        '<p class="sub" id="cuInviteMsg" style="min-height:16px;margin:6px 0 0"></p>' +
        '<div id="cuMiembros" style="margin-top:6px;font-size:13px;color:var(--text-mute)">Cargando compañeros…</div>' +
      '</div>' : '';

    abrirModal('<h3>Tu cuenta</h3>' +
      '<p class="sub"><b>' + escapeHtml(nombre) + '</b><br>' + escapeHtml(miUsuario.email || '') + '<br>' + rolTxt + '</p>' +
      '<div class="modal-actions" style="justify-content:flex-start;margin-top:0">' +
        '<button class="btn btn-sm" id="cuNotif">🔔 Activar notificaciones</button>' +
      '</div>' +
      htmlInvitar +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cerrar</button>' +
      '<button class="btn" id="cuSalir" style="color:var(--danger)">Cerrar sesión</button></div>');

    document.getElementById('mCancel').onclick = cerrarModal;
    document.getElementById('cuSalir').onclick = function () { cerrarModal(); cerrarSesionCuenta(); };
    document.getElementById('cuNotif').onclick = activarNotificaciones;

    if (miRol === 'dueno') {
      cargarMiembrosModal();
      var mailEl = document.getElementById('cuInviteMail');
      var rolEl = document.getElementById('cuInviteRol');
      var msg = document.getElementById('cuInviteMsg');

      function leerDatosInvitacion() {
        var mail = mailEl.value.trim().toLowerCase();
        if (!mail || mail.indexOf('@') < 0) { msg.style.color = 'var(--danger)'; msg.textContent = 'Ingresá un mail válido.'; return null; }
        return { mail: mail, rol: rolEl.value };
      }

      document.getElementById('cuInviteBtn').onclick = function () {
        var datos = leerDatosInvitacion(); if (!datos) return;
        msg.style.color = 'var(--text-mute)'; msg.textContent = 'Enviando invitación…';
        crearInvitacionMiembro(datos.mail, datos.rol, true).then(function () {
          msg.style.color = 'var(--cyan)'; msg.textContent = '¡Invitación enviada a ' + datos.mail + '!';
          mailEl.value = '';
          cargarMiembrosModal();
        }).catch(function (e) {
          msg.style.color = 'var(--danger)';
          msg.textContent = 'No se pudo invitar (' + (e && e.message ? e.message : 'error') + ')';
        });
      };

      document.getElementById('cuInviteLink').onclick = function () {
        var rol = rolEl.value;
        // Hay que abrir la pestaña YA, en el mismo click — si se abre recién
        // después de esperar la respuesta del servidor, el navegador la bloquea.
        var ventana = window.open('', '_blank');
        msg.style.color = 'var(--text-mute)'; msg.textContent = 'Generando link…';
        generarLinkInvitacion(rol).then(function (token) {
          msg.style.color = 'var(--cyan)'; msg.textContent = '¡Listo! Elegí el contacto en WhatsApp para mandarle el link.';
          var link = location.origin + location.pathname + '?invite=' + token;
          var texto = 'Te invité a ver Mis Finanzas conmigo 💜 Entrá acá y elegí con qué cuenta de Google conectarte: ' + link;
          if (ventana) ventana.location.href = 'https://wa.me/?text=' + encodeURIComponent(texto);
        }).catch(function (e) {
          if (ventana) ventana.close();
          msg.style.color = 'var(--danger)';
          msg.textContent = 'No se pudo generar el link (' + (e && e.message ? e.message : 'error') + ')';
        });
      };
    }
  }

  function crearInvitacionMiembro(mail, rol, enviarMail) {
    return sbClient.functions.invoke('invitar-colaborador', { body: { email: mail, rol: rol, enviarMail: enviarMail } }).then(function (res) {
      if (res.error) throw res.error;
      if (res.data && res.data.error) throw new Error(res.data.error);
      return res.data;
    });
  }

  // El link no requiere el mail del invitado: elige su propia cuenta de
  // Google al abrirlo, así que esto solo necesita crear el token con el
  // rol ya definido (inserción directa, sin pasar por una Edge Function).
  function generarLinkInvitacion(rol) {
    return sbClient.from('invitaciones_link').insert({
      proyecto_id: miProyectoId, rol: rol, creado_por: miUsuario.id
    }).select('token').single().then(function (res) {
      if (res.error) throw res.error;
      return res.data.token;
    });
  }

  // Link para conectar el bot de Telegram sin pegar ninguna clave a mano:
  // al abrirlo, Telegram le manda "/start CODIGO" al bot, que lo canjea y
  // vincula ese chat a este proyecto (ver nube/telegram-bot/index.ts).
  function generarLinkTelegram() {
    var codigo = crypto.randomUUID();
    return sbClient.from('bot_codigos_vinculo').insert({
      codigo: codigo, proyecto_id: miProyectoId, creado_por: miUsuario.id
    }).then(function (res) {
      if (res.error) throw res.error;
      return 'https://t.me/' + TELEGRAM_BOT_USERNAME + '?start=' + codigo;
    });
  }

  // pushManager.subscribe() pide la applicationServerKey como Uint8Array, no
  // como el string base64url que da VAPID — hay que convertirla a mano.
  function urlBase64ToUint8Array(base64) {
    var padding = '='.repeat((4 - (base64.length % 4)) % 4);
    var base64Segura = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    var binario = atob(base64Segura);
    var salida = new Uint8Array(binario.length);
    for (var i = 0; i < binario.length; i++) salida[i] = binario.charCodeAt(i);
    return salida;
  }

  // Pide permiso de notificaciones, suscribe este navegador/celular a Web Push
  // y guarda la suscripción para que enviar-notificacion la encuentre.
  function activarNotificaciones() {
    if (!modoCuenta || !miProyectoId) { toast('Iniciá sesión primero.'); return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast('Este navegador no soporta notificaciones push.');
      return;
    }
    Notification.requestPermission().then(function (permiso) {
      if (permiso !== 'granted') { toast('No diste permiso para notificaciones.'); return; }
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }).then(function (sub) {
        var json = sub.toJSON();
        return sbClient.from('push_subscripciones').upsert({
          proyecto_id: miProyectoId, user_id: miUsuario.id,
          endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth,
        }, { onConflict: 'endpoint' });
      }).then(function (res) {
        if (res && res.error) throw res.error;
        toast('¡Notificaciones activadas! 🔔');
      }).catch(function (e) {
        toast('No se pudo activar (' + (e && e.message ? e.message : 'error') + ')');
      });
    });
  }

  function cargarMiembrosModal() {
    if (!miProyectoId) return;
    sbClient.from('miembros').select('email,rol,estado').eq('proyecto_id', miProyectoId).order('rol').then(function (res) {
      var cont = document.getElementById('cuMiembros'); // el modal pudo haberse cerrado mientras tanto
      if (!cont || res.error) return;
      var filas = (res.data || []).filter(function (m) { return m.rol !== 'dueno'; });
      if (!filas.length) { cont.textContent = 'Todavía no invitaste a nadie.'; return; }
      cont.innerHTML = filas.map(function (m) {
        var rolTxt2 = m.rol === 'editor' ? 'Edición' : 'Solo lectura';
        var estTxt = m.estado === 'aceptado' ? '✅ activo' : '⏳ pendiente';
        return '<div style="display:flex;justify-content:space-between;gap:10px;padding:4px 0">' +
          '<span>' + escapeHtml(m.email) + '</span><span>' + rolTxt2 + ' · ' + estTxt + '</span></div>';
      }).join('');
    });
  }

  function cerrarSesionCuenta() {
    try { localStorage.removeItem('misFinanzas_invitado'); } catch (e) {}
    sbClient.auth.signOut().then(function () { location.reload(); });
  }

  // Punto de entrada: arranca el login solo si la app corre hosteada y el
  // cliente de Supabase (cargado por CDN) está disponible.
  function iniciarAuth() {
    if (!esHosteado() || !window.supabase) return;
    capturarInviteLinkDeUrl();
    var yaEligioInvitado = false;
    try { yaEligioInvitado = localStorage.getItem('misFinanzas_invitado') === '1'; } catch (e) {}
    var tieneInviteLink = hayInviteLinkPendiente();
    if (tieneInviteLink) {
      var msgEl = document.getElementById('loginGateMsg');
      if (msgEl) msgEl.textContent = 'Te invitaron a un proyecto compartido — elegí con qué cuenta de Google querés conectarte.';
    }
    // Si ya había elegido "invitado" antes, no tapamos el dashboard de nuevo —
    // salvo que ahora venga con un link de invitación, ahí preferimos mostrarle
    // el login para que pueda unirse al proyecto compartido.
    if (!yaEligioInvitado || tieneInviteLink) mostrarLoginGate(true);
    // persistSession/autoRefreshToken ya son el default, pero los dejamos
    // explícitos: así la sesión sobrevive a cerrar y reabrir el navegador
    // (se guarda en localStorage y se refresca sola en vez de pedir login).
    sbClient = window.supabase.createClient(CUENTA_URL, CUENTA_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storage: window.localStorage }
    });

    sbClient.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session && !modoCuenta) {
        modoCuenta = true;
        if (nubePollTimer) clearInterval(nubePollTimer); // la cuenta de Google manda, no la nube manual vieja
        try { localStorage.removeItem('misFinanzas_invitado'); } catch (e) {}
        mostrarLoginGate(false);
        mostrarBotonVincular(false);
        actualizarChipUsuario(session.user);
        bootstrapProyecto(session.user);
      } else if (event === 'SIGNED_OUT') {
        modoCuenta = false;
        mostrarLoginGate(true);
      }
    });

    sbClient.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      // El evento SIGNED_IN de arriba puede haber llegado primero y ya haber
      // arrancado todo esto — sin este chequeo, bootstrapProyecto se dispara
      // dos veces en simultáneo justo después del login y las dos peticiones
      // de creación de proyecto se pisan entre sí.
      if (session && !modoCuenta) {
        modoCuenta = true;
        if (nubePollTimer) clearInterval(nubePollTimer); // la cuenta de Google manda, no la nube manual vieja
        mostrarLoginGate(false);
        actualizarChipUsuario(session.user);
        bootstrapProyecto(session.user);
      } else if (session) {
        // ya se está resolviendo por el otro camino, no hacer nada
      } else if (yaEligioInvitado && !tieneInviteLink) {
        mostrarLoginGate(false);
        mostrarBotonVincular(true);
      } else {
        mostrarLoginGate(true);
      }
    });

    var loginBtn = document.getElementById('loginGoogleBtn');
    if (loginBtn) loginBtn.onclick = iniciarLoginGoogle;
    var invitadoBtn = document.getElementById('loginInvitadoBtn');
    if (invitadoBtn) invitadoBtn.onclick = entrarComoInvitado;
    var vincularBtn = document.getElementById('conectarGoogleBtn');
    if (vincularBtn) vincularBtn.onclick = iniciarLoginGoogle;
    var salirBtn = document.getElementById('cerrarSesionBtn');
    if (salirBtn) salirBtn.onclick = cerrarSesionCuenta;
  }

  // ---------- Cálculos ----------
  function mesData() { return estado.meses[mesActivo] || { ingresos: [], gastos: [] }; }
  function totalIngresos(k) {
    var m = estado.meses[k]; if (!m) return 0;
    return m.ingresos.reduce(function (s, i) { return s + (Number(i.monto) || 0); }, 0);
  }
  function totalGastos(k) {
    var m = estado.meses[k]; if (!m) return 0;
    return m.gastos.reduce(function (s, g) { return s + (Number(g.monto) || 0); }, 0);
  }
  function gastosPorCategoria(k) {
    var m = estado.meses[k]; var res = {};
    if (!m) return res;
    m.gastos.forEach(function (g) { res[g.categoria] = (res[g.categoria] || 0) + (Number(g.monto) || 0); });
    return res;
  }
  function totalCuotasDeuda() {
    return estado.deudas.reduce(function (s, d) {
      return s + (d.activa !== false ? (Number(d.cuotaMensual) || 0) : 0);
    }, 0);
  }
  function totalDeuda() {
    return estado.deudas.reduce(function (s, d) { return s + (Number(d.saldo) || 0); }, 0);
  }
  // Registro de pagos de deuda hechos en un mes: { deudaId: {cuotaActual, saldo, activa} (valores previos) }
  function pagosDelMes(k) {
    var m = estado.meses[k]; if (!m) return {};
    if (!m.deudasPagadas) m.deudasPagadas = {};
    return m.deudasPagadas;
  }
  function deudaPagadaEnMes(id, k) { return !!pagosDelMes(k)[id]; }
  // Suma de las cuotas que YA marcaste como pagadas este mes (lo que se descuenta del disponible)
  function cuotasPagadas(k) {
    var pagos = pagosDelMes(k), total = 0;
    estado.deudas.forEach(function (d) {
      if (pagos[d.id]) total += Number(d.cuotaMensual) || 0;
    });
    return total;
  }
  function balanceMes(k) {
    return totalIngresos(k) - totalGastos(k) - cuotasPagadas(k);
  }

  // ============================================================
  //  RENDER
  // ============================================================
  function render(animate) {
    if (animate === undefined) animate = true;
    document.getElementById('monthLabel').textContent = mesKeyLabel(mesActivo);
    var hoyBtn = document.getElementById('hoyBtn');
    if (hoyBtn) hoyBtn.style.display = (mesActivo === mesActualKey()) ? 'none' : '';
    renderKPIs(animate);
    renderDonut(animate);
    renderEvolucion(animate);
    renderGastos();
    renderIngresos();
    renderDeudas();
    if (vistaActual === 'historial') renderHistorial();
    else if (vistaActual === 'analiticas') renderAnaliticas();
  }

  // Marca qué pestaña de la barra de abajo está activa (en Ajustes no hay ninguna)
  function marcarNavActivo(pagina) {
    document.querySelectorAll('.nav a').forEach(function (a) {
      var on = a.getAttribute('data-page') === pagina;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  // Cambia entre las páginas completas de la app (no apiladas: solo una visible a la vez)
  var PAGINAS = ['resumen', 'gastos', 'deudas', 'historial', 'analiticas', 'ajustes'];
  var TITULOS_PAGINA = { resumen: 'Inicio', gastos: 'Gastos', deudas: 'Deudas', historial: 'Historial', analiticas: 'Análisis', ajustes: 'Ajustes' };
  var paginaAntesDeAjustes = 'resumen';
  function mostrarPagina(nombre) {
    if (nombre !== 'ajustes') paginaAntesDeAjustes = nombre;
    vistaActual = nombre;
    var tit = document.getElementById('pageTitle'); if (tit) tit.textContent = TITULOS_PAGINA[nombre] || '';
    // El selector de mes aplica a todo menos Historial (tiene su propio filtro) y Ajustes
    var mnav = document.getElementById('mnav'); if (mnav) mnav.style.display = (nombre === 'historial' || nombre === 'ajustes') ? 'none' : '';
    marcarNavActivo(nombre === 'ajustes' ? null : nombre);
    var ajBtn = document.getElementById('ajustesBtn'); if (ajBtn) ajBtn.setAttribute('aria-pressed', nombre === 'ajustes' ? 'true' : 'false');
    window.scrollTo(0, 0);
    PAGINAS.forEach(function (n) {
      var el = document.getElementById('vista' + n.charAt(0).toUpperCase() + n.slice(1));
      if (!el) return;
      var esNueva = n === nombre;
      el.classList.toggle('view-hidden', !esNueva);
      if (esNueva) {
        // reinicia la animación de entrada aunque ya tuviera la clase de una vez anterior
        el.classList.remove('page-entrando');
        void el.offsetWidth;
        el.classList.add('page-entrando');
      }
    });
    if (nombre === 'historial') renderHistorial();
    else if (nombre === 'analiticas') renderAnaliticas();
    else if (nombre === 'ajustes') renderAjustes();
  }

  // Solo recalcula números y gráficos (sin re-dibujar listas: no pierde el foco al tipear)
  function actualizarCalculos() {
    renderKPIs(false);
    renderDonut(false);
    renderEvolucion(false);
    document.getElementById('gastosTotal').textContent = fmt(totalGastos(mesActivo));
    document.getElementById('ingresosTotal').textContent = fmt(totalIngresos(mesActivo));
    // totales y barra por categoría
    var porCat = gastosPorCategoria(mesActivo);
    var totalMes = totalGastos(mesActivo);
    document.querySelectorAll('.cat-group').forEach(function (el) {
      var cid = el.getAttribute('data-cat');
      var t = el.querySelector('.cat-total');
      if (t) t.textContent = fmt(porCat[cid] || 0);
      actualizarBarraCategoria(el, cid, porCat[cid] || 0, totalMes);
    });
  }

  function renderKPIs(animate) {
    updateKPIs(animate);
  }

  // Resumen del mes (hero de Inicio), totales de Gastos y totales de Deudas.
  // Mismos números de siempre; solo cambia dónde y cómo se muestran.
  function updateKPIs(animate) {
    var ing = totalIngresos(mesActivo);
    var gas = totalGastos(mesActivo);
    var pagadas = cuotasPagadas(mesActivo);   // cuotas que YA marcaste pagadas este mes
    var cuotasTotales = totalCuotasDeuda();    // obligación mensual total (informativo)
    var bal = ing - gas - pagadas;
    var pct = ing > 0 ? Math.round(((gas + pagadas) / ing) * 100) : 0;

    // Gastos: totales del mes
    var gIng = document.getElementById('gIngTotal'); if (gIng) gIng.textContent = fmt(ing);
    var gGas = document.getElementById('gGasTotal'); if (gGas) gGas.textContent = fmt(gas);
    // Deudas: total adeudado y cuota mensual
    var dTot = document.getElementById('deudaTotalVal'); if (dTot) dTot.textContent = fmt(totalDeuda());
    var dMes = document.getElementById('deudaMesVal'); if (dMes) dMes.textContent = fmt(cuotasTotales);

    // Hero: balance del mes
    var pos = bal >= 0;
    document.getElementById('heroBalLabel').textContent = pos ? 'Te queda este mes' : 'Te pasaste este mes';
    var heroVal = document.getElementById('heroBalVal');
    heroVal.style.color = pos ? '' : 'var(--badt)';
    // en déficit mostramos el signo menos: -$ 37.907
    var fmtSigno = function (v) { return (pos ? '' : '-') + fmt(v); };
    if (saldoOculto) {
      heroVal.dataset.raw = Math.round(Math.abs(bal));
      heroVal.textContent = (pos ? '' : '-') + '$ ••••••';
    } else {
      countUp(heroVal, Math.abs(bal), animate, fmtSigno);
    }
    var heroEyeIcon = document.getElementById('heroEyeIcon');
    if (heroEyeIcon) heroEyeIcon.innerHTML = ico(saldoOculto ? 'eyeOff' : 'eye', 24);
    var eyeBtn = document.getElementById('heroEyeBtn');
    eyeBtn.title = saldoOculto ? 'Mostrar saldo' : 'Ocultar saldo';
    eyeBtn.setAttribute('aria-label', eyeBtn.title);
    // Barra de avance: cuánto de los ingresos ya se fue (gastos + cuotas pagadas)
    var fill = document.getElementById('heroBarFill');
    if (fill) {
      fill.style.width = Math.min(100, pct) + '%';
      fill.style.background = pct > 100 ? 'var(--bad)' : (pct >= 75 ? 'var(--warn)' : 'var(--accent)');
    }
    document.getElementById('heroBalDelta').innerHTML = ing > 0
      ? '<span>Gastaste ' + (saldoOculto ? '$ ••••••' : fmt(gas + pagadas)) + ' de ' + (saldoOculto ? '$ ••••••' : fmt(ing)) + '</span><span>' + pct + '%</span>'
      : '<span>Todavía no cargaste ingresos este mes</span><span></span>';
    var desg = document.getElementById('heroDesglose');
    if (desg) desg.textContent = saldoOculto ? '' : (fmt(gas) + ' en gastos · ' + fmt(pagadas) + ' en cuotas pagadas · deuda total ' + fmt(totalDeuda()));
  }

  // Anima un número de su valor anterior al nuevo (efecto "contador")
  function countUp(el, to, animate, fmtFn) {
    fmtFn = fmtFn || fmt;
    to = Math.round(Number(to) || 0);
    var from = parseFloat(el.dataset.raw || '0');
    el.dataset.raw = to;
    if (!animate || from === to) { el.textContent = fmtFn(to); return; }
    el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    var dur = 600, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmtFn(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = fmtFn(to);
    }
    requestAnimationFrame(step);
  }

  // ---- Donut de gastos por categoría ----
  function renderDonut(animate) {
    var porCat = gastosPorCategoria(mesActivo);
    var data = CATEGORIAS.map(function (c) { return { c: c, v: porCat[c.id] || 0 }; })
      .filter(function (d) { return d.v > 0; })
      .sort(function (a, b) { return b.v - a.v; });
    var total = data.reduce(function (s, d) { return s + d.v; }, 0);
    document.getElementById('donutTotal').textContent = fmt(total);

    var body = document.getElementById('donutBody');
    if (total === 0) {
      body.innerHTML = '<p class="empty-hint">Todavía no cargaste gastos este mes. Agregalos desde el botón “+”.</p>';
      return;
    }

    var R = 52, C = 2 * Math.PI * R, off = 0, GAP = 3;
    var segs = '';
    data.forEach(function (d) {
      var frac = d.v / total;
      var len = Math.max(0.1, frac * C - (data.length > 1 ? GAP : 0));
      segs += '<circle cx="60" cy="60" r="' + R + '" style="stroke:' + d.c.color + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) +
        '" stroke-dashoffset="' + (-off).toFixed(2) + '"></circle>';
      off += frac * C;
    });
    var svg = '<div class="donut-box"><svg viewBox="0 0 120 120" width="140" height="140" role="img" aria-label="Gastos por categoría: ' + escapeAttr(fmt(total)) + ' en total">' +
      '<circle cx="60" cy="60" r="52" fill="none" style="stroke:var(--track)" stroke-width="14"/>' +
      '<g transform="rotate(-90 60 60)" fill="none" stroke-width="14">' + segs + '</g></svg>' +
      '<div class="donut-center"><b>' + (saldoOculto ? '$ ••••' : fmtCorto(total)) + '</b><span class="rs">gastado</span></div></div>';

    var legend = '<div class="legend">';
    // Una fila por cada color de la dona (cada categoría tiene el suyo, sin repetir)
    data.forEach(function (d, i) {
      var pct = Math.round((d.v / total) * 100);
      legend += '<div class="legend-row" style="animation-delay:' + (0.15 + i * 0.05).toFixed(2) + 's">' +
        '<span class="legend-dot" style="background:' + d.c.color + '"></span>' +
        '<span class="legend-name">' + escapeHtml(getCatNombre(d.c.id)) + '</span>' +
        '<span class="legend-pct">' + (pct === 0 && d.v > 0 ? '<1' : pct) + '%</span></div>';
    });
    legend += '</div>';

    body.innerHTML = '<div class="donut-wrap' + (animate ? ' donut-in' : '') + '">' + svg + legend + '</div>';
  }

  // Arma la serie de datos del gráfico según el modo (semanal/mensual/anual)
  function serieEvolucion() {
    var all = mesesOrdenados();
    if (all.length === 0) return [];

    if (evoModo === 'anual') {
      var years = {};
      all.forEach(function (k) {
        var y = k.split('-')[0];
        if (!years[y]) years[y] = { ing: 0, gas: 0, last: k };
        years[y].ing += totalIngresos(k);
        years[y].gas += totalGastos(k);
        years[y].last = k;
      });
      return Object.keys(years).sort().map(function (y) {
        return { label: y, ing: years[y].ing, gas: years[y].gas, goto: years[y].last,
                 active: y === mesActivo.split('-')[0], titulo: 'Año ' + y };
      });
    }

    // mensual (por defecto): últimos 12 meses
    return all.slice(-12).map(function (k) {
      return { label: mesCortoConAnio(k), ing: totalIngresos(k), gas: totalGastos(k), goto: k,
               active: k === mesActivo, titulo: mesKeyLabel(k) + ' — Ingresos ' + fmt(totalIngresos(k)) + ' · Gastos ' + fmt(totalGastos(k)) };
    });
  }

  // Gastos reales día por día del mes activo — la comparten el modo "Día" de
  // Evolución y la tarjeta "Gastos por día" de Analíticas, para no calcular
  // lo mismo dos veces.
  function serieDiariaDelMes() {
    var movs = mesData().movimientos || [];
    var partes = mesActivo.split('-');
    var anio = parseInt(partes[0], 10), mes = parseInt(partes[1], 10);
    var diasEnMes = new Date(anio, mes, 0).getDate();
    var totalesPorDia = new Array(diasEnMes + 1).fill(0); // índice 1..diasEnMes
    movs.forEach(function (mv) {
      var dia = parseInt(mv.fecha.split('-')[2], 10);
      if (dia >= 1 && dia <= diasEnMes) totalesPorDia[dia] += (Number(mv.monto) || 0);
    });
    var diaPico = 1;
    for (var d = 2; d <= diasEnMes; d++) if (totalesPorDia[d] > totalesPorDia[diaPico]) diaPico = d;
    return { movs: movs, totalesPorDia: totalesPorDia, diasEnMes: diasEnMes, mes: mes, diaPico: diaPico };
  }

  // Desglose real por semana DENTRO del mes activo — a diferencia del viejo
  // modo "Sem" (que dividía el total del mes entre 4 de forma pareja), esto
  // agrupa los movimientos reales de gastos por día. Los ingresos no tienen
  // fecha por día en el modelo de datos, así que esta vista es solo gastos.
  function serieSemanalDelMes() {
    var movs = mesData().movimientos || [];
    var partes = mesActivo.split('-');
    var anio = parseInt(partes[0], 10), mes = parseInt(partes[1], 10);
    var diasEnMes = new Date(anio, mes, 0).getDate();
    var nSemanas = Math.ceil(diasEnMes / 7);
    var totales = new Array(nSemanas).fill(0);
    movs.forEach(function (mv) {
      var dia = parseInt(mv.fecha.split('-')[2], 10);
      var w = Math.min(nSemanas - 1, Math.floor((dia - 1) / 7));
      totales[w] += Number(mv.monto) || 0;
    });
    var hoyDia = (mesActivo === mesActualKey()) ? new Date().getDate() : -1;
    var semanaHoy = hoyDia > 0 ? Math.min(nSemanas - 1, Math.floor((hoyDia - 1) / 7)) : -1;
    return totales.map(function (t, i) {
      var diaIni = i * 7 + 1, diaFin = Math.min(diasEnMes, diaIni + 6);
      return { label: 'Sem ' + (i + 1), gas: t, active: i === semanaHoy, rango: diaIni + '–' + diaFin };
    });
  }

  // ---- Gráfico de evolución (Chart.js: ingresos verde, gastos rojo) ----
  // Colores y fuente de los gráficos, tomados del tema activo (oscuro/claro)
  function conAlfa(color, a) {
    color = (color || '').trim();
    if (color.charAt(0) !== '#') return color;
    if (color.length === 4) color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    var r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }
  function chartTema() {
    var acc = colorCss('--accent', '#4DE0A0'), gas = colorCss('--c5', '#A78BFA');
    var T = {
      ing: acc, gas: gas, gasSuave: conAlfa(gas, 0.14), accSuave: conAlfa(acc, 0.45),
      pico: colorCss('--warn', '#FBBF24'), muted: colorCss('--muted', '#8DB3A0'), text: colorCss('--text', '#EAF7F0'),
      fuente: "'Manrope', system-ui, sans-serif"
    };
    if (typeof Chart !== 'undefined') { Chart.defaults.font.family = T.fuente; Chart.defaults.color = T.muted; }
    return T;
  }

  var evoChartInstance = null;
  function renderEvolucion(animate) {
    var canvas = document.getElementById('evoChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (evoChartInstance) { evoChartInstance.destroy(); evoChartInstance = null; }
    var T = chartTema();

    if (evoModo === 'diario') {
      var sd = serieDiariaDelMes();
      if (!sd.movs.length) return;
      var labelsD = [], dataD = [], coloresD = [];
      for (var di = 1; di <= sd.diasEnMes; di++) {
        labelsD.push(String(di));
        dataD.push(sd.totalesPorDia[di]);
        coloresD.push(di === sd.diaPico && sd.totalesPorDia[di] > 0 ? T.pico : T.accSuave);
      }
      evoChartInstance = new Chart(canvas, {
        type: 'bar',
        data: { labels: labelsD, datasets: [{ label: 'Gastos', data: dataD, backgroundColor: coloresD, borderRadius: 3, maxBarThickness: 16 }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: animate ? { duration: 500 } : false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: function (items) { return 'Día ' + items[0].label + ' de ' + mesKeyLabel(mesActivo); },
              label: function (ctx) { return 'Gastos: ' + fmt(ctx.parsed.y); },
            } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: "'Manrope',sans-serif", size: 10, weight: 600 }, maxRotation: 0, autoSkipPadding: 6 } },
            y: { display: false },
          },
        },
      });
      return;
    }

    if (evoModo === 'semanal') {
      var semanas = serieSemanalDelMes();
      if (!semanas.length) return;
      evoChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: semanas.map(function (s) { return s.label; }),
          datasets: [{
            label: 'Gastos', data: semanas.map(function (s) { return s.gas; }),
            borderColor: T.gas, backgroundColor: T.gasSuave, borderWidth: 2.5,
            pointRadius: semanas.map(function (s) { return s.active ? 6 : 4; }), pointHoverRadius: 7,
            pointBackgroundColor: T.gas, tension: 0.25, fill: true,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          animation: animate ? { duration: 500 } : false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: {
              title: function (items) { return 'Días ' + semanas[items[0].dataIndex].rango + ' de ' + mesKeyLabel(mesActivo); },
              label: function (ctx) { return 'Gastos: ' + fmt(ctx.parsed.y); },
            } },
          },
          scales: {
            x: { grid: { display: false }, ticks: { font: { family: "'Manrope',sans-serif", size: 10, weight: 600 } } },
            y: { display: false },
          },
        },
      });
      return;
    }

    var serie = serieEvolucion();
    if (serie.length === 0) return;

    var radios = serie.map(function (p) { return p.active ? 6 : 3; });

    evoChartInstance = new Chart(canvas, {
      type: 'line',
      data: {
        labels: serie.map(function (p) { return p.label; }),
        datasets: [
          {
            label: 'Ingresos', data: serie.map(function (p) { return p.ing; }),
            borderColor: T.ing, backgroundColor: 'transparent', borderWidth: 2.5,
            pointRadius: radios, pointHoverRadius: 7, pointBackgroundColor: T.ing, tension: 0.25,
          },
          {
            label: 'Gastos', data: serie.map(function (p) { return p.gas; }),
            borderColor: T.gas, backgroundColor: T.gasSuave, borderWidth: 2.5,
            pointRadius: radios, pointHoverRadius: 7, pointBackgroundColor: T.gas, tension: 0.25, fill: true,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: animate ? { duration: 500 } : false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: "'Manrope',sans-serif", size: 12, weight: 600 } } },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y); } } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'Manrope',sans-serif", size: 10, weight: 600 } } },
          y: { display: false },
        },
        onClick: function (evt, elements) {
          if (!elements.length) return;
          mesActivo = serie[elements[0].index].goto;
          render(true);
        },
      },
    });
  }

  // ---- Lista de gastos por categoría ----
  // Barra de cada categoría: contra su presupuesto si tiene uno (con color de estado),
  // y si no, qué parte del total del mes representa.
  function datosBarraCategoria(cid, gastado, totalMes) {
    var tope = Number((estado.presupuestos || {})[cid]) || 0;
    if (tope > 0) {
      var est = estadoPresupuesto(gastado, tope);
      var p = Math.round((gastado / tope) * 100);
      return { ancho: Math.min(100, p), color: est.color, texto: p + '%', titulo: p + '% de tu presupuesto de ' + fmt(tope) };
    }
    var s = totalMes > 0 ? Math.round((gastado / totalMes) * 100) : 0;
    return { ancho: s, color: (CAT_MAP[cid] || {}).color || 'var(--accent)', texto: s + '%', titulo: s + '% de los gastos del mes' };
  }
  function actualizarBarraCategoria(el, cid, gastado, totalMes) {
    var d = datosBarraCategoria(cid, gastado, totalMes);
    var bar = el.querySelector('.cat-bar'); if (bar) { bar.style.width = d.ancho + '%'; bar.style.background = d.color; }
    var pct = el.querySelector('.cat-pct'); if (pct) { pct.textContent = d.texto; pct.title = d.titulo; }
  }

  function renderGastos() {
    var m = mesData();
    document.getElementById('gastosTotal').textContent = fmt(totalGastos(mesActivo));
    var porCat = gastosPorCategoria(mesActivo);
    var totalMes = totalGastos(mesActivo);
    var body = document.getElementById('gastosBody');
    var html = '<div class="tip">En el monto podés escribir una cuenta y se calcula sola. Ej: escribí <b>200+120</b> y queda <b>320</b>.</div>';
    CATEGORIAS.forEach(function (c) {
      var items = m.gastos.filter(function (g) { return g.categoria === c.id; });
      // Las categorías vacías arrancan cerradas para que la lista no sea eterna
      var estaCerrada = colapsadas[c.id] === undefined ? items.length === 0 : colapsadas[c.id];
      var colapsada = estaCerrada ? ' collapsed' : '';
      var gastado = porCat[c.id] || 0;
      var bd = datosBarraCategoria(c.id, gastado, totalMes);
      html += '<div class="card cat-group' + colapsada + '" data-cat="' + c.id + '">';
      html += '<div class="cat-head" data-toggle="' + c.id + '">' + tileCat(c.id) +
        '<div class="cat-mid"><span class="cat-name-wrap"><span class="cat-name">' + escapeHtml(getCatNombre(c.id)) + '</span>' +
        '<button class="cat-edit" data-editcat="' + c.id + '" title="Cambiar nombre" aria-label="Cambiar nombre de la categoría">' + ico('pencil', 15) + '</button></span>' +
        '<div class="bar" style="height:6px"><i class="cat-bar" style="width:' + bd.ancho + '%;background:' + bd.color + '"></i></div></div>' +
        '<div class="cat-right"><div class="amt cat-total">' + fmt(gastado) + '</div><div class="rs cat-pct" title="' + escapeAttr(bd.titulo) + '">' + bd.texto + '</div></div>' +
        '<span class="cat-caret">' + ico('chevDown', 18, 2.4) + '</span></div>';
      html += '<div class="cat-items">';
      items.forEach(function (g) {
        html += itemRowHTML(g.id, g.nombre, g.monto) + metaGastoHTML(g);
      });
      html += '<button class="add-line" data-addgasto="' + c.id + '">' + ico('plus', 16, 2.6) + ' Agregar en ' + escapeHtml(getCatNombre(c.id)) + '</button>';
      html += '</div></div>';
    });
    body.innerHTML = html;

    // abrir/cerrar categoría
    body.querySelectorAll('[data-toggle]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        if (ev.target.closest('input, button')) return;
        var cid = el.getAttribute('data-toggle');
        colapsadas[cid] = el.parentElement.classList.toggle('collapsed');
      });
    });
    // renombrar categoría
    body.querySelectorAll('[data-editcat]').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        editarNombreCategoria(btn.getAttribute('data-editcat'), btn.closest('.cat-name-wrap'));
      });
    });
    // agregar gasto
    body.querySelectorAll('[data-addgasto]').forEach(function (el) {
      el.addEventListener('click', function () {
        var cid = el.getAttribute('data-addgasto');
        mesData().gastos.push({ id: uid(), categoria: cid, nombre: '', monto: 0 });
        colapsadas[cid] = false;
        guardar(); renderGastos(); actualizarCalculos();
        // foco en el nuevo concepto + resaltado
        var rows = document.querySelectorAll('.cat-group[data-cat="' + cid + '"] .item-row');
        var last = rows[rows.length - 1];
        if (last) { last.classList.add('nueva'); var inp = last.querySelector('.i-name'); if (inp) inp.focus(); }
      });
    });
    conectarItemEvents(body, 'gasto');
  }

  // Editar el nombre de una categoría (in situ)
  function editarNombreCategoria(cid, wrap) {
    if (!wrap) return;
    var actual = getCatNombre(cid);
    wrap.innerHTML = '<input class="cat-name-input" type="text" value="' + escapeAttr(actual) + '">';
    var inp = wrap.querySelector('input');
    inp.focus(); inp.select();
    var guardado = false;
    function commit(cancelar) {
      if (guardado) return; guardado = true;
      if (!cancelar) {
        var val = inp.value.trim();
        if (!estado.catNombres) estado.catNombres = {};
        if (!val || val === CAT_MAP[cid].nombre) delete estado.catNombres[cid];
        else estado.catNombres[cid] = val;
        guardar();
      }
      renderGastos(); renderDonut(false);
    }
    inp.addEventListener('blur', function () { commit(false); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
      else if (e.key === 'Escape') { commit(true); }
    });
  }

  function renderIngresos() {
    var m = mesData();
    document.getElementById('ingresosTotal').textContent = fmt(totalIngresos(mesActivo));
    var body = document.getElementById('ingresosBody');
    var html = '<div class="ing-list">';
    m.ingresos.forEach(function (i) { html += itemRowHTML(i.id, i.nombre, i.monto); });
    html += '<button class="add-line" data-addingreso="1">' + ico('plus', 16, 2.6) + ' Agregar ingreso</button></div>';
    body.innerHTML = html;

    body.querySelector('[data-addingreso]').addEventListener('click', agregarIngresoRapido);
    conectarItemEvents(body, 'ingreso');
  }

  // Extraída aparte para poder llamarla directo desde el FAB de acciones
  // rápidas (Inicio), sin depender de que el usuario esté viendo la lista.
  function agregarIngresoRapido() {
    mesData().ingresos.push({ id: uid(), nombre: '', monto: 0 });
    guardar(); renderIngresos(); actualizarCalculos();
    var body = document.getElementById('ingresosBody');
    var rows = body.querySelectorAll('.item-row');
    var last = rows[rows.length - 1];
    if (last) { last.classList.add('nueva'); var inp = last.querySelector('.i-name'); if (inp) inp.focus(); }
  }

  function itemRowHTML(id, nombre, monto) {
    return '<div class="item-row" data-id="' + id + '">' +
      '<input class="i-name" type="text" placeholder="Concepto…" value="' + escapeAttr(nombre) + '">' +
      '<div class="i-amount-box"><span class="cur">$</span>' +
      '<input class="i-amount" type="text" inputmode="text" title="Podés escribir una cuenta, ej: 200+120" value="' + (monto ? formatInput(monto) : '') + '" placeholder="0"></div>' +
      '<button class="del" title="Eliminar" aria-label="Eliminar">' + ico('x', 18, 2.2) + '</button></div>';
  }

  // Fecha corta "Lun 22/06" a partir de un ISO YYYY-MM-DD
  function fechaCortaApp(iso) {
    if (!iso) return '';
    var p = iso.split('-'); if (p.length < 3) return '';
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return dias[d.getUTCDay()] + ' ' + p[2] + '/' + p[1];
  }
  // "Hoy · vie 9 oct", "Ayer · jue 8 oct" o "mié 7 oct" a partir de un ISO YYYY-MM-DD
  function etiquetaDia(iso) {
    if (!iso) return 'Sin fecha';
    var p = iso.split('-'); if (p.length < 3) return iso;
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var dias = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    var base = dias[d.getUTCDay()] + ' ' + (+p[2]) + ' ' + MESES_NOMBRE[+p[1] - 1].slice(0, 3).toLowerCase();
    var hoy = isoHoyApp();
    var ay = new Date(); ay.setDate(ay.getDate() - 1);
    var ayer = ay.getFullYear() + '-' + String(ay.getMonth() + 1).padStart(2, '0') + '-' + String(ay.getDate()).padStart(2, '0');
    if (iso === hoy) return 'Hoy · ' + base;
    if (iso === ayer) return 'Ayer · ' + base;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  // Subtítulo con el historial del gasto (fecha, nota, productos) — solo si viene del bot
  function metaGastoHTML(g) {
    var partes = [];
    if (g.fecha) partes.push('📅 ' + fechaCortaApp(g.fecha));
    if (g.items && g.items.length > 1) {
      partes.push('🛒 ' + g.items.map(function (it) { return escapeHtml(it.nombre); }).join(', '));
    }
    if (!partes.length) return '';
    return '<div class="item-meta">' + partes.join(' · ') + '</div>';
  }

  function conectarItemEvents(container, tipo) {
    container.querySelectorAll('.item-row').forEach(function (row) {
      var id = row.getAttribute('data-id');
      var nameEl = row.querySelector('.i-name');
      var amtEl = row.querySelector('.i-amount');
      var delEl = row.querySelector('.del');

      nameEl.addEventListener('input', function () {
        var obj = buscarItem(tipo, id); if (obj) { obj.nombre = nameEl.value; guardar(); }
      });
      amtEl.addEventListener('input', function () {
        var num = evalMonto(amtEl.value);
        var obj = buscarItem(tipo, id); if (obj) { obj.monto = num; guardar(); actualizarCalculos(); }
      });
      amtEl.addEventListener('blur', function () {
        var num = evalMonto(amtEl.value);
        var obj = buscarItem(tipo, id);
        if (obj) {
          obj.monto = num;
          if (num > 0) {
            ultimaAccionDescripcion = (tipo === 'ingreso' ? 'agregó un ingreso de ' : 'editó un gasto: ') +
              (tipo === 'ingreso' ? fmt(num) + (obj.nombre ? ' (' + obj.nombre + ')' : '') : (obj.nombre || 'sin nombre') + ' ' + fmt(num));
          }
          guardar(); actualizarCalculos();
        }
        amtEl.value = num ? formatInput(num) : '';
      });
      amtEl.addEventListener('focus', function () {
        var num = evalMonto(amtEl.value);
        amtEl.value = num ? String(num) : '';
        amtEl.select();
      });
      amtEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') amtEl.blur(); });
      delEl.addEventListener('click', function () {
        var m = mesData();
        if (tipo === 'gasto') m.gastos = m.gastos.filter(function (x) { return x.id !== id; });
        else m.ingresos = m.ingresos.filter(function (x) { return x.id !== id; });
        guardar();
        if (tipo === 'gasto') renderGastos(); else renderIngresos();
        actualizarCalculos();
      });
    });
  }

  function buscarItem(tipo, id) {
    var m = mesData();
    var arr = tipo === 'gasto' ? m.gastos : m.ingresos;
    for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i];
    return null;
  }

  // ---- Deudas ----
  // Cada deuda es su propia tarjeta apilada (saldo grande arriba, acción de
  // pago abajo) — una tabla de columnas no entra bien en una pantalla angosta.
  function renderDeudas() {
    var body = document.getElementById('deudasBody');
    renderDeudasPendientes();
    if (!estado.deudas.length) {
      body.innerHTML = '<p class="empty-hint">No tenés deudas cargadas. Si tenés cuotas o préstamos, agregalos con el botón “Agregar”.</p>';
      return;
    }
    var html = '';
    var tonos = [4, 5, 6, 3];
    estado.deudas.forEach(function (d, idx) {
      var cn = tonos[idx % tonos.length];
      var finalizada = d.cuotaActual && d.cuotaTotal && d.cuotaActual >= d.cuotaTotal;
      var pagada = deudaPagadaEnMes(d.id, mesActivo);
      var sub = (d.cuotaActual && d.cuotaTotal ? 'Cuota ' + d.cuotaActual + ' de ' + d.cuotaTotal + ' · ' : '') + fmt(d.cuotaMensual) + '/mes';
      var badge = finalizada ? '<span class="badge b-ok">Saldada</span>'
        : (pagada ? '<span class="badge b-ok">Pagada este mes</span>' : '<span class="badge b-warn">Pendiente</span>');
      var prog = '';
      if (d.cuotaActual && d.cuotaTotal) {
        var p = Math.min(100, Math.round((d.cuotaActual / d.cuotaTotal) * 100));
        var restan = Math.max(0, d.cuotaTotal - d.cuotaActual);
        prog = '<div style="display:flex;flex-direction:column;gap:6px"><div class="bar"><i style="width:' + p + '%;background:var(--c' + cn + ')"></i></div>' +
          '<div style="display:flex;justify-content:space-between" class="rs"><span>' + p + '% pagado</span><span>' + (restan === 0 ? 'Sin cuotas pendientes' : 'Restan ' + restan + (restan === 1 ? ' cuota' : ' cuotas')) + '</span></div></div>';
      }
      var accion = pagada
        ? '<button class="revert-btn" data-revertir="' + d.id + '" title="Revertir pago">' + ico('undo', 16) + ' Revertir</button>'
        : '<button class="pay-btn" data-pagar="' + d.id + '"' + (finalizada ? ' disabled' : '') + '>Registrar pago</button>';
      html += '<div class="card deuda-card' + (pagada ? ' pagada' : '') + '" data-id="' + d.id + '">' +
        '<div class="row"><span class="tile ct' + cn + '">' + ico('card', 22) + '</span>' +
          '<div class="grow"><div class="d-name">' + escapeHtml(d.nombre) + '</div><div class="rs">' + sub + '</div></div>' +
          '<div class="tr"><div class="amt">' + fmt(d.saldo) + '</div>' + badge + '</div></div>' +
        prog +
        '<div class="deuda-bottom">' +
          '<div class="d-actions">' +
            '<button class="d-edit" data-editdeuda="' + d.id + '" title="Editar" aria-label="Editar deuda">' + ico('pencil', 17) + '</button>' +
            '<button class="del" data-deldeuda="' + d.id + '" title="Eliminar" aria-label="Eliminar deuda">' + ico('trash', 17) + '</button>' +
          '</div>' +
          '<div class="deuda-accion">' + accion + '</div>' +
        '</div>' +
      '</div>';
    });
    body.innerHTML = html;

    body.querySelectorAll('[data-pagar]').forEach(function (b) {
      b.addEventListener('click', function () { registrarPago(b.getAttribute('data-pagar')); });
    });
    body.querySelectorAll('[data-revertir]').forEach(function (b) {
      b.addEventListener('click', function () { revertirPago(b.getAttribute('data-revertir')); });
    });
    body.querySelectorAll('[data-editdeuda]').forEach(function (b) {
      b.addEventListener('click', function () { modalDeuda(b.getAttribute('data-editdeuda')); });
    });
    body.querySelectorAll('[data-deldeuda]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-deldeuda');
        var d = estado.deudas.find(function (x) { return x.id === id; });
        confirmar('¿Eliminar “' + (d ? d.nombre : 'esta deuda') + '”?', function () {
          estado.deudas = estado.deudas.filter(function (x) { return x.id !== id; });
          guardar(); render(); toast('Deuda eliminada');
        });
      });
    });
  }

  // Lista simple de las cuotas del mes con la marca de pagada / pendiente
  function renderDeudasPendientes() {
    var body = document.getElementById('deudasPendBody');
    if (!body) return;
    var activas = estado.deudas.filter(function (d) { return d.activa !== false; });
    if (!activas.length) { body.innerHTML = '<p class="empty-hint" style="padding:12px 0">No hay cuotas activas este mes.</p>'; return; }
    body.innerHTML = activas.map(function (d, i) {
      var pagada = deudaPagadaEnMes(d.id, mesActivo);
      var cuotaTxt = d.cuotaActual && d.cuotaTotal ? 'Cuota ' + d.cuotaActual + ' de ' + d.cuotaTotal : 'Cuota mensual';
      return (i ? '<hr class="sep">' : '') + '<div class="row pend-row"><div class="grow"><div class="rt">' + escapeHtml(d.nombre) + '</div><div class="rs">' + cuotaTxt + '</div></div>' +
        '<div class="amt">' + fmt(d.cuotaMensual) + '</div>' +
        '<span class="radio' + (pagada ? ' on' : '') + '" role="img" aria-label="' + (pagada ? 'Pagada' : 'Pendiente') + '">' + (pagada ? ico('check', 14, 3.4) : '') + '</span></div>';
    }).join('');
  }

  function registrarPago(id) {
    var d = estado.deudas.find(function (x) { return x.id === id; });
    if (!d) return;
    var pagos = pagosDelMes(mesActivo);
    if (pagos[id]) return; // ya está marcada como pagada este mes
    // guardamos los valores previos para poder revertir exactamente
    pagos[id] = { cuotaActual: d.cuotaActual, saldo: d.saldo, activa: d.activa };
    var saldada = false;
    d.saldo = Math.max(0, (Number(d.saldo) || 0) - (Number(d.cuotaMensual) || 0));
    if (d.cuotaActual && d.cuotaTotal) {
      d.cuotaActual = Math.min(d.cuotaTotal, d.cuotaActual + 1);
      if (d.cuotaActual >= d.cuotaTotal) { d.saldo = 0; d.activa = false; saldada = true; toast('¡' + d.nombre + ' saldada! 🎉'); }
      else toast('Pago registrado · se descontó del disponible');
    } else {
      toast('Pago registrado · se descontó del disponible');
    }
    guardar(); render(false);
    var row = document.querySelector('.deuda-card[data-id="' + id + '"]');
    if (row) row.classList.add('flash');
    if (saldada) confetti();
  }

  function revertirPago(id) {
    var d = estado.deudas.find(function (x) { return x.id === id; });
    var pagos = pagosDelMes(mesActivo);
    if (!d || !pagos[id]) return;
    var prev = pagos[id];
    d.cuotaActual = prev.cuotaActual;
    d.saldo = prev.saldo;
    d.activa = prev.activa;
    delete pagos[id];
    guardar(); render(false);
    var row = document.querySelector('.deuda-card[data-id="' + id + '"]');
    if (row) row.classList.add('flash');
    toast('Pago revertido · te devolví ' + fmt(d.cuotaMensual));
  }

  // ---- Página de Historial (movimientos de todos los meses, con filtros) ----
  function poblarFiltrosHistorial() {
    var selMes = document.getElementById('histFiltroMes');
    var selCat = document.getElementById('histFiltroCat');
    if (selCat && !selCat.dataset.built) {
      selCat.innerHTML = '<option value="">Todas las categorías</option>' + CATEGORIAS.map(function (c) {
        return '<option value="' + c.id + '">' + c.icon + ' ' + escapeHtml(getCatNombre(c.id)) + '</option>';
      }).join('');
      selCat.dataset.built = '1';
    }
    if (selMes) {
      var actual = selMes.value;
      var metas = mesesOrdenados().slice().reverse().map(function (k) {
        return '<option value="' + k + '">' + mesKeyLabel(k) + '</option>';
      }).join('');
      selMes.innerHTML = '<option value="">Todos los meses</option>' + metas;
      if (actual && mesesOrdenados().indexOf(actual) !== -1) selMes.value = actual;
    }
  }

  function renderHistorial() {
    poblarFiltrosHistorial();
    var body = document.getElementById('historialBody');
    if (!body) return;
    var filtroMes = (document.getElementById('histFiltroMes') || {}).value || '';
    var filtroCat = (document.getElementById('histFiltroCat') || {}).value || '';
    var texto = ((document.getElementById('histBuscar') || {}).value || '').trim().toLowerCase();

    var lista = todosLosMovimientos().filter(function (r) {
      var mv = r.mv;
      if (filtroMes && r.mesKey !== filtroMes) return false;
      if (filtroCat && mv.categoria !== filtroCat) return false;
      if (texto) {
        var hay = [mv.fila, mv.nota, mv.categoria].concat(mv.items ? mv.items.map(function (i) { return i.nombre; }) : [])
          .join(' ').toLowerCase();
        if (hay.indexOf(texto) === -1) return false;
      }
      return true;
    });

    // todosLosMovimientos() ya viene en orden "más reciente primero" — desde
    // ahí solo hace falta invertir o reordenar por monto según lo elegido.
    var orden = (document.getElementById('histOrden') || {}).value || 'reciente';
    if (orden === 'lejana') lista.reverse();
    else if (orden === 'mayor') lista.sort(function (a, b) { return (Number(b.mv.monto) || 0) - (Number(a.mv.monto) || 0); });
    else if (orden === 'menor') lista.sort(function (a, b) { return (Number(a.mv.monto) || 0) - (Number(b.mv.monto) || 0); });

    var totalFiltrado = lista.reduce(function (s, r) { return s + (Number(r.mv.monto) || 0); }, 0);
    document.getElementById('historialTotal').textContent = lista.length
      ? (lista.length + (lista.length === 1 ? ' registro · ' : ' registros · ') + fmt(totalFiltrado))
      : '';

    if (!lista.length) {
      body.innerHTML = '<p class="empty-hint">No hay movimientos que coincidan. Cargá una compra desde <b>＋ Agregar gasto</b> o desde el bot de Telegram y aparecen acá 📲</p>';
      return;
    }
    function filaMovimientoHTML(r, conFecha) {
      var mv = r.mv;
      var desc = mv.fila || mv.nota || (mv.items && mv.items.length ? mv.items.map(function (i) { return i.nombre; }).join(', ') : 'Compra');
      var sub = [];
      if (mv.nota && mv.nota !== desc) sub.push(escapeHtml(mv.nota));
      if (mv.items && mv.items.length > 1) sub.push(escapeHtml(mv.items.map(function (i) { return i.nombre; }).join(' · ')));
      var detItems = sub.length ? '<span class="h-items">' + sub.join(' — ') + '</span>' : '';
      var fechaTxt = conFecha ? (fechaCortaApp(mv.fecha) + ' · ') : '';
      return '<div class="hist-row" data-mv="' + mv.id + '" data-mes="' + r.mesKey + '" title="Tocá para editar" role="button" tabindex="0">' +
        tileCat(mv.categoria) +
        '<div class="h-desc"><div class="rt">' + escapeHtml(desc) + '</div><div class="rs">' + fechaTxt + escapeHtml(getCatNombre(mv.categoria)) + '</div>' + detItems + '</div>' +
        '<div class="amt">- ' + fmt(mv.monto) + '</div>' +
        '<button class="del" data-delmov="' + mv.id + '" data-delmes="' + r.mesKey + '" title="Eliminar del historial" aria-label="Eliminar movimiento">' + ico('trash', 17) + '</button></div>';
    }
    var html = '';
    if (orden === 'reciente' || orden === 'lejana') {
      // Agrupado por día, con el total de cada día
      var grupos = [], porFecha = {};
      lista.forEach(function (r) {
        var f = r.mv.fecha || '';
        if (!porFecha[f]) { porFecha[f] = { fecha: f, filas: [], total: 0 }; grupos.push(porFecha[f]); }
        porFecha[f].filas.push(r);
        porFecha[f].total += Number(r.mv.monto) || 0;
      });
      grupos.forEach(function (g) {
        html += '<div class="dia-grp"><div class="dia-head sub"><span>' + etiquetaDia(g.fecha) + '</span><span>' + fmt(g.total) + '</span></div>' +
          '<div class="card hist-list">' + g.filas.map(function (r) { return filaMovimientoHTML(r, false); }).join('') + '</div></div>';
      });
    } else {
      html = '<div class="card hist-list">' + lista.map(function (r) { return filaMovimientoHTML(r, true); }).join('') + '</div>';
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-delmov]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        eliminarMovimiento(b.getAttribute('data-delmov'), b.getAttribute('data-delmes'));
      });
    });
    body.querySelectorAll('.hist-row').forEach(function (tr) {
      tr.addEventListener('click', function () {
        modalEditarMovimiento(tr.getAttribute('data-mv'), tr.getAttribute('data-mes'));
      });
    });
  }

  // Deja cambiar categoría, fila, monto o nota de un movimiento ya cargado —
  // saca el monto viejo de la fila donde estaba y lo suma a la fila nueva
  // (existente o creada en el momento), sin tener que borrar y recargar.
  function modalEditarMovimiento(id, mesKey) {
    var m = estado.meses[mesKey];
    if (!m) return;
    var mv = (m.movimientos || []).find(function (x) { return x.id === id; });
    if (!mv) return;
    var opciones = CATEGORIAS.map(function (c) {
      var sel = (c.id === mv.categoria) ? ' selected' : '';
      return '<option value="' + c.id + '"' + sel + '>' + c.icon + '  ' + escapeHtml(getCatNombre(c.id)) + '</option>';
    }).join('');
    abrirModal('<h3>Editar movimiento</h3><p class="sub">Cambiá la categoría, la fila, el monto o la nota.</p>' +
      '<div class="field"><label>Concepto / nota</label><input id="emNota" value="' + escapeAttr(mv.nota || '') + '"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Monto</label><input id="emMonto" inputmode="text" value="' + formatInput(mv.monto) + '"></div>' +
        '<div class="field"><label>Categoría</label><select id="emCat">' + opciones + '</select></div>' +
      '</div>' +
      selectorFilaHTML('em') +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">Guardar cambios</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;

    // Fila: desplegable con las filas de la categoría (deja elegida la actual) + "Nueva fila…"
    poblarSelectorFila('em', m, mv.categoria, mv.filaId);
    document.getElementById('emCat').addEventListener('change', function () { poblarSelectorFila('em', m, document.getElementById('emCat').value); });
    document.getElementById('emFila').addEventListener('change', function () { actualizarFilaNueva('em'); });

    document.getElementById('mOk').onclick = function () {
      var nuevaCat = document.getElementById('emCat').value;
      var nuevoMonto = evalMonto(document.getElementById('emMonto').value);
      var nuevaNota = document.getElementById('emNota').value.trim();
      if (!nuevoMonto) { document.getElementById('emMonto').focus(); return; }
      aplicarEdicionMovimiento(mesKey, mv, nuevaCat, leerSelectorFila('em', nuevaCat), nuevoMonto, nuevaNota);
      guardar();
      if (mesKey === mesActivo) actualizarCalculos();
      cerrarModal();
      renderHistorial();
      toast('Movimiento actualizado');
    };
  }

  // Cambia categoría/fila/monto/nota de un movimiento: saca el monto viejo de su fila y lo suma a la nueva
  // (la usan el modal de edición y el asistente). No guarda ni redibuja: eso lo hace quien la llama.
  function aplicarEdicionMovimiento(mesKey, mv, nuevaCat, filaSel, nuevoMonto, nuevaNota) {
    var m = estado.meses[mesKey];
    var filaVieja = (m.gastos || []).find(function (g) { return g.id === mv.filaId; })
      || (m.gastos || []).filter(function (g) { return g.categoria === mv.categoria; })
        .find(function (g) { return g.bot || g.nombre === nombreAcumulador(mv.categoria); });
    if (filaVieja) filaVieja.monto = Math.max(0, (Number(filaVieja.monto) || 0) - (Number(mv.monto) || 0));
    var filaNueva = resolverFila(m, nuevaCat, filaSel);
    filaNueva.monto = (Number(filaNueva.monto) || 0) + nuevoMonto;
    mv.categoria = nuevaCat;
    mv.filaId = filaNueva.id;
    mv.fila = filaNueva.nombre;
    mv.monto = nuevoMonto;
    mv.nota = nuevaNota || null;
  }

  function eliminarMovimiento(id, mesKey) {
    var m = estado.meses[mesKey];
    if (!m) return;
    var mv = (m.movimientos || []).find(function (x) { return x.id === id; });
    if (!mv) return;
    // restamos el monto de la fila donde se había sumado (si sigue existiendo)
    var fila = (m.gastos || []).find(function (g) { return g.id === mv.filaId; })
      || (m.gastos || []).filter(function (g) { return g.categoria === mv.categoria; })
        .find(function (g) { return g.bot || g.nombre === nombreAcumulador(mv.categoria); });
    if (fila) fila.monto = Math.max(0, (Number(fila.monto) || 0) - (Number(mv.monto) || 0));
    m.movimientos = m.movimientos.filter(function (x) { return x.id !== id; });
    guardar();
    if (mesKey === mesActivo) actualizarCalculos();
    renderHistorial();
    toast('Movimiento eliminado del historial');
  }

  // ============================================================
  //  Página de Analíticas (flujo de caja, presupuestos, simulador)
  // ============================================================
  function renderAnaliticas() {
    renderAnaKpis();
    renderFlujoCaja();
    renderGastoDias();
    renderPresupuestos();
    renderSimulador();
    renderUltimosMovimientos();
    renderRecurrentes();
    renderEficiencia();
    renderPendientes();
  }

  // Los dos números clave de arriba de Análisis: lo que te queda y el gasto promedio por día
  function renderAnaKpis() {
    var ing = totalIngresos(mesActivo), bal = balanceMes(mesActivo), gas = totalGastos(mesActivo);
    var partes = mesActivo.split('-');
    var diasMes = new Date(+partes[0], +partes[1], 0).getDate();
    var esActual = mesActivo === mesActualKey();
    var dias = esActual ? Math.max(1, new Date().getDate()) : diasMes;
    var elBal = document.getElementById('anaBal'); if (!elBal) return;
    elBal.textContent = (bal < 0 ? '-' : '') + fmt(Math.abs(bal));
    elBal.style.color = bal >= 0 ? 'var(--okt)' : 'var(--badt)';
    document.getElementById('anaBalSub').textContent = ing > 0 ? Math.round((bal / ing) * 100) + '% del ingreso' : 'Sin ingresos cargados';
    document.getElementById('anaProm').textContent = fmt(gas / dias);
    document.getElementById('anaPromSub').textContent = 'en ' + dias + (dias === 1 ? ' día' : ' días');
  }

  // Gastos que se repiten mes a mes (mismo nombre + monto parecido, sin IA).
  // Compara el mes activo contra el anterior — cubre el caso típico de alquiler,
  // servicios fijos, suscripciones, etc. que se copian de un mes al siguiente.
  function detectarRecurrentes() {
    var keys = mesesOrdenados();
    var idx = keys.indexOf(mesActivo);
    if (idx < 1) return [];
    var actual = (estado.meses[mesActivo].gastos || []);
    var anterior = (estado.meses[keys[idx - 1]].gastos || []);
    var out = [];
    actual.forEach(function (g) {
      if (!g.nombre || !g.monto) return;
      var match = anterior.find(function (p) {
        return p.nombre === g.nombre && Math.abs(p.monto - g.monto) <= Math.max(g.monto * 0.15, 1);
      });
      if (match) out.push(g);
    });
    return out.sort(function (a, b) { return b.monto - a.monto; }).slice(0, 6);
  }

  function renderRecurrentes() {
    var body = document.getElementById('recurrentesBody');
    var lista = detectarRecurrentes();
    if (!lista.length) {
      body.innerHTML = '<p class="empty-hint">Todavía no hay suficiente historial para detectar recurrentes (hace falta al menos 2 meses seguidos).</p>';
      return;
    }
    var totalRec = lista.reduce(function (s, g) { return s + (Number(g.monto) || 0); }, 0);
    body.innerHTML = '<div class="sub" style="padding-bottom:6px">' + fmt(totalRec) + ' por mes</div>' + lista.map(function (g, i) {
      return (i ? '<hr class="sep">' : '') + '<div class="row" style="padding:10px 0">' + tileCat(g.categoria) +
        '<div class="grow"><div class="rt">' + escapeHtml(g.nombre) + '</div><div class="rs">Se repite cada mes</div></div>' +
        '<div class="amt">' + fmt(g.monto) + '</div></div>';
    }).join('');
  }

  // Puntaje 0-10: mezcla tasa de ahorro del mes, presupuestos respetados y cuotas al día.
  // Si el usuario no usa presupuestos o no tiene deudas, esos componentes no penalizan
  // (quedan en su valor neutro) para no castigar por no usar una función opcional.
  function calcularPuntajeEficiencia() {
    var ing = totalIngresos(mesActivo);
    var ahorroRate = ing > 0 ? balanceMes(mesActivo) / ing : 0;
    var pAhorro = Math.max(0, Math.min(1, ahorroRate / 0.3)) * 5;

    var porCat = gastosPorCategoria(mesActivo);
    var presupuestos = estado.presupuestos || {};
    var definidas = 0, enRango = 0;
    CATEGORIAS.forEach(function (c) {
      var b = Number(presupuestos[c.id]) || 0;
      if (b > 0) { definidas++; if ((porCat[c.id] || 0) <= b) enRango++; }
    });
    var pPresupuesto = definidas ? (enRango / definidas) * 3 : 1.5;

    var activas = estado.deudas.filter(function (d) { return d.activa !== false; });
    var pagos = pagosDelMes(mesActivo);
    var pDeudas = activas.length ? (activas.filter(function (d) { return pagos[d.id]; }).length / activas.length) * 2 : 2;

    return Math.round((pAhorro + pPresupuesto + pDeudas) * 10) / 10;
  }

  function renderEficiencia() {
    var score = calcularPuntajeEficiencia();
    var color = score >= 7 ? 'var(--okt)' : (score >= 4.5 ? 'var(--warnt)' : 'var(--badt)');
    var cn = score >= 7 ? 1 : (score >= 4.5 ? 6 : 7);
    document.getElementById('eficienciaBody').innerHTML =
      '<span class="tile ct' + cn + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg></span>' +
      '<div class="eficiencia-txt"><p>Puntaje de eficiencia</p>' +
      '<div class="eficiencia-val" style="color:' + color + '">' + score.toFixed(1) + '<span>/10</span></div></div>';
  }

  // Cuotas de deuda que todavía no se registraron como pagadas este mes (dato real,
  // no una fecha de vencimiento inventada — no la tenemos cargada en el modelo).
  function cuotasPendientesEsteMes() {
    var pagos = pagosDelMes(mesActivo);
    return estado.deudas.filter(function (d) { return d.activa !== false && !pagos[d.id]; });
  }

  function renderPendientes() {
    var pendientes = cuotasPendientesEsteMes();
    var body = document.getElementById('pendientesBody');
    if (!pendientes.length) {
      body.innerHTML = '<div class="pend-resumen"><span class="pend-num ok">✓</span>' +
        '<span class="pend-lbl">Todas las cuotas de este mes están al día</span></div>';
      return;
    }
    var total = pendientes.reduce(function (s, d) { return s + (Number(d.cuotaMensual) || 0); }, 0);
    var html = '<div class="pend-resumen"><span class="pend-num pend">' + pendientes.length + '</span>' +
      '<span class="pend-lbl">' + (pendientes.length === 1 ? 'cuota sin registrar' : 'cuotas sin registrar') +
      ' · ' + fmt(total) + '</span></div>' +
      '<span class="pend-link" id="irADeudasLink">Ir a Deudas →</span>';
    body.innerHTML = html;
    var link = document.getElementById('irADeudasLink');
    if (link) link.addEventListener('click', function () {
      mostrarPagina('deudas');
      marcarNavActivo('deudas');
    });
  }

  // Ingresos vs. gastos por mes, una al lado de la otra — reemplaza los dos
  // gráficos que había antes (neto por un lado, solo gastos por el otro):
  // con las dos barras juntas se ve la comparación directa de un vistazo.
  var flujoChartInstance = null;
  function renderFlujoCaja() {
    var canvas = document.getElementById('flujoChart');
    if (!canvas || typeof Chart === 'undefined') return;
    var keys = mesesOrdenados().slice(-8);
    if (flujoChartInstance) { flujoChartInstance.destroy(); flujoChartInstance = null; }
    var T = chartTema();
    if (!keys.length) { document.getElementById('flujoBadge').textContent = ''; return; }

    var ingresos = keys.map(function (k) { return totalIngresos(k); });
    var gastos = keys.map(function (k) { return totalGastos(k); });
    var totalNeto = keys.reduce(function (s, k) { return s + balanceMes(k); }, 0);
    document.getElementById('flujoBadge').textContent = (totalNeto >= 0 ? '+' : '') + fmt(totalNeto) + ' neto';

    flujoChartInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: keys.map(function (k) { return mesCortoConAnio(k); }),
        datasets: [
          { label: 'Ingresos', data: ingresos, backgroundColor: T.ing, borderRadius: 6, maxBarThickness: 22 },
          { label: 'Gastos', data: gastos, backgroundColor: T.gas, borderRadius: 6, maxBarThickness: 22 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: "'Manrope',sans-serif", size: 12, weight: 600 } } },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y); } } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'Manrope',sans-serif", size: 10, weight: 600 } } },
          y: { display: false },
        },
        onClick: function (evt, elements) {
          if (!elements.length) return;
          mesActivo = keys[elements[0].index]; render(true);
        },
      },
    });
  }

  // ---- Gastos por día del mes activo: para encontrar el día "pico" y qué
  // gasto puntual lo causó (no promedios ni estimaciones, movimientos reales) ----
  var gastoDiasChartInstance = null;
  function renderGastoDias() {
    var canvas = document.getElementById('gastoDiasChart');
    if (!canvas || typeof Chart === 'undefined') return;
    document.getElementById('gastoDiasMes').textContent = mesKeyLabel(mesActivo);
    if (gastoDiasChartInstance) { gastoDiasChartInstance.destroy(); gastoDiasChartInstance = null; }
    var T = chartTema();

    var resumenEl = document.getElementById('gastoDiasResumen');
    var s = serieDiariaDelMes();
    if (!s.movs.length) {
      resumenEl.textContent = 'Todavía no cargaste gastos este mes.';
      return;
    }

    var labels = [], data = [], colores = [];
    for (var i = 1; i <= s.diasEnMes; i++) {
      labels.push(String(i));
      data.push(s.totalesPorDia[i]);
      colores.push(i === s.diaPico && s.totalesPorDia[i] > 0 ? T.pico : T.accSuave);
    }

    gastoDiasChartInstance = new Chart(canvas, {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'Gastado', data: data, backgroundColor: colores, borderRadius: 3, maxBarThickness: 16 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return fmt(ctx.parsed.y); } } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'Manrope',sans-serif", size: 10, weight: 600 }, maxRotation: 0, autoSkipPadding: 6 } },
          y: { display: false },
        },
      },
    });

    if (s.totalesPorDia[s.diaPico] > 0) {
      var movsDelPico = s.movs.filter(function (mv) { return parseInt(mv.fecha.split('-')[2], 10) === s.diaPico; });
      var mayor = movsDelPico.reduce(function (a, b) { return (Number(b.monto) || 0) > (Number(a.monto) || 0) ? b : a; });
      var cat = CAT_MAP[mayor.categoria] || { icon: '•' };
      resumenEl.innerHTML = '📍 Tu día de mayor gasto: <b>' + s.diaPico + ' de ' + MESES_NOMBRE[s.mes - 1].toLowerCase() + '</b> — ' +
        fmt(s.totalesPorDia[s.diaPico]) + ' en total. El más grande fue ' + cat.icon + ' <b>' + escapeHtml(mayor.fila || mayor.nota || 'un gasto') + '</b> por ' + fmt(mayor.monto) + '.';
    } else {
      resumenEl.textContent = 'Todavía no cargaste gastos este mes.';
    }
  }

  function renderPresupuestos() {
    var body = document.getElementById('presupuestosBody');
    var porCat = gastosPorCategoria(mesActivo);
    var presupuestos = estado.presupuestos || {};
    var filas = [], sinPres = 0, totalTope = 0, totalGastado = 0;
    CATEGORIAS.forEach(function (c) {
      var gastado = porCat[c.id] || 0;
      var tope = Number(presupuestos[c.id]) || 0;
      if (tope > 0) {
        totalTope += tope; totalGastado += gastado;
        filas.push({ c: c, gastado: gastado, tope: tope, est: estadoPresupuesto(gastado, tope) });
      } else sinPres++;
    });
    // Las filas más cerca (o más allá) del tope van primero
    filas.sort(function (a, b) { return b.est.ratio - a.est.ratio; });

    var html = '';
    if (filas.length) {
      var estTotal = estadoPresupuesto(totalGastado, totalTope);
      var pctTotal = Math.round((totalGastado / totalTope) * 100);
      var CIRC = 2 * Math.PI * 48;
      var dash = Math.min(1, totalGastado / totalTope) * CIRC;
      var excedidas = filas.filter(function (f) { return f.est.clave === 'bad'; }).length;
      var limite = filas.filter(function (f) { return f.est.clave === 'warn'; }).length;
      var partes = mesActivo.split('-');
      var diasMes = new Date(+partes[0], +partes[1], 0).getDate();
      var queda = totalTope - totalGastado;
      var restoTxt = queda >= 0 ? 'Quedan ' + fmt(queda) : 'Te pasaste ' + fmt(-queda);
      if (mesActivo === mesActualKey()) {
        var diasRest = diasMes - new Date().getDate();
        restoTxt += ' y ' + diasRest + (diasRest === 1 ? ' día' : ' días') + ' de mes';
      }
      html += '<div class="ring-row"><div class="ring-box"><svg viewBox="0 0 120 120" width="96" height="96" role="img" aria-label="' + pctTotal + '% del presupuesto usado">' +
        '<circle cx="60" cy="60" r="48" fill="none" style="stroke:var(--track)" stroke-width="14"/>' +
        '<circle cx="60" cy="60" r="48" fill="none" style="stroke:' + estTotal.color + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + CIRC.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg>' +
        '<div class="ring-center">' + pctTotal + '%</div></div>' +
        '<div class="ring-info"><div><span style="font-size:20px;font-weight:800">' + fmt(totalGastado) + '</span><span class="sub"> de ' + fmt(totalTope) + '</span></div>' +
        '<div class="rs">' + restoTxt + '</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          (excedidas ? '<span class="badge b-bad">' + excedidas + (excedidas === 1 ? ' excedida' : ' excedidas') + '</span>' : '') +
          (limite ? '<span class="badge b-warn">' + limite + ' al límite</span>' : '') +
          (!excedidas && !limite ? '<span class="badge b-ok">Todo en rango</span>' : '') +
        '</div></div></div><hr class="sep">';
      filas.forEach(function (f) {
        var quedan = f.tope - f.gastado;
        var etiqueta = f.est.clave === 'bad' ? 'Excedida +' + fmt(-quedan) : (f.est.clave === 'warn' && quedan <= 0 ? 'Al límite' : 'Quedan ' + fmt(quedan));
        html += '<div class="budget-row" data-editpres="' + f.c.id + '" role="button" tabindex="0" title="Tocá para editar el presupuesto">' +
          '<div class="budget-top">' + tileCat(f.c.id) +
          '<div class="grow"><div class="rt">' + escapeHtml(getCatNombre(f.c.id)) + '</div><div class="rs">' + fmt(f.gastado) + ' de ' + fmt(f.tope) + '</div></div>' +
          '<span class="badge ' + f.est.badge + '">' + etiqueta + '</span></div>' +
          '<div class="bar"><i style="width:' + Math.min(100, Math.round(f.est.ratio * 100)) + '%;background:' + f.est.color + '"></i></div></div>';
      });
    } else {
      html += '<p class="empty-hint">Todavía no definiste presupuestos. Elegí un tope mensual para cada categoría y acá ves cómo vas.</p>';
    }
    if (sinPres) {
      html += '<button class="budget-more" id="presMasBtn" type="button"><span class="tile s ct4"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>' +
        '<span class="grow rt" style="font-size:14px">Definir presupuesto en ' + (filas.length ? 'otra categoría' : 'una categoría') + '</span><span class="rs">' + sinPres + ' sin tope</span></button>';
    }
    html += '<button class="asis-hint" id="presAsisBtn" type="button"><span class="mini"></span>' +
      '<span class="t">Pedíselo al asistente: <b>“poné 200000 en comida”</b></span></button>';
    body.innerHTML = html;
    body.querySelectorAll('[data-editpres]').forEach(function (el) {
      el.addEventListener('click', function () { modalPresupuesto(el.getAttribute('data-editpres')); });
    });
    var mas = document.getElementById('presMasBtn'); if (mas) mas.onclick = modalElegirPresupuesto;
    var asis = document.getElementById('presAsisBtn'); if (asis) asis.onclick = function () { abrirChat('chat'); };
  }

  // Lista de todas las categorías con su tope, para elegir cuál editar
  function modalElegirPresupuesto() {
    var presupuestos = estado.presupuestos || {};
    var filas = CATEGORIAS.map(function (c) {
      var tope = Number(presupuestos[c.id]) || 0;
      return '<button class="arow" type="button" data-pres="' + c.id + '" style="padding:10px 4px;min-height:60px">' + tileCat(c.id) +
        '<span class="grow"><div class="rt">' + escapeHtml(getCatNombre(c.id)) + '</div><div class="rs">' + (tope ? 'Tope ' + fmt(tope) + ' por mes' : 'Sin tope definido') + '</div></span>' +
        ico('pencil', 17) + '</button>';
    }).join('<hr class="sep">');
    abrirModal('<h3>Presupuestos</h3><p class="sub">Elegí una categoría para definir o cambiar su tope mensual.</p>' + filas +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cerrar</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    document.querySelectorAll('#modal [data-pres]').forEach(function (b) {
      b.onclick = function () { modalPresupuesto(b.getAttribute('data-pres')); };
    });
  }

  function modalPresupuesto(catId) {
    var cat = CAT_MAP[catId];
    var actual = Number(estado.presupuestos[catId]) || 0;
    abrirModal('<h3>Presupuesto — ' + cat.icon + ' ' + escapeHtml(getCatNombre(catId)) + '</h3>' +
      '<p class="sub">Definí cuánto querés gastar como máximo por mes en esta categoría.</p>' +
      '<div class="field"><label>Monto mensual</label><input id="presMonto" inputmode="text" placeholder="0" value="' + (actual ? formatInput(actual) : '') + '"></div>' +
      '<div class="modal-actions">' +
      (actual ? '<button class="btn" id="presQuitar" style="color:var(--danger);margin-right:auto">Quitar</button>' : '') +
      '<button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">Guardar</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    var quitar = document.getElementById('presQuitar');
    if (quitar) quitar.onclick = function () {
      delete estado.presupuestos[catId];
      guardar(); cerrarModal(); renderPresupuestos(); toast('Presupuesto quitado');
    };
    var montoEl = document.getElementById('presMonto');
    montoEl.focus();
    montoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('mOk').click(); });
    document.getElementById('mOk').onclick = function () {
      var val = evalMonto(montoEl.value);
      if (val > 0) estado.presupuestos[catId] = val; else delete estado.presupuestos[catId];
      guardar(); cerrarModal(); renderPresupuestos();
      toast(val > 0 ? 'Presupuesto guardado' : 'Presupuesto quitado');
    };
  }

  // Simulador de inversión: calculadora en vivo, no persiste datos (solo el monto
  // mensual arranca sugerido con lo que ya venís destinando a "Ahorro e Inversión").
  function renderSimulador() {
    var body = document.getElementById('simuladorBody');
    if (!body.dataset.built) {
      var ahorroActual = gastosPorCategoria(mesActivo)['ahorro'] || 0;
      body.innerHTML =
        '<div class="sim-field"><label>Monto inicial ya ahorrado</label><input id="simInicial" inputmode="text" placeholder="0" value="0"></div>' +
        '<div class="sim-row">' +
        '<div class="sim-field"><label>Aporte mensual</label><input id="simMensual" inputmode="text" placeholder="0" value="' + Math.round(ahorroActual) + '"></div>' +
        '<div class="sim-field"><label>Meses</label><input id="simMeses" inputmode="numeric" value="12"></div>' +
        '</div>' +
        '<div class="sim-field"><label>Rendimiento anual estimado (%)</label><input id="simRoi" inputmode="text" value="8"></div>' +
        '<div class="sim-result" id="simResultado"></div>';
      body.dataset.built = '1';
      ['simInicial', 'simMensual', 'simMeses', 'simRoi'].forEach(function (id) {
        document.getElementById(id).addEventListener('input', actualizarSimulador);
      });
    }
    actualizarSimulador();
  }

  function actualizarSimulador() {
    var inicial = evalMonto(document.getElementById('simInicial').value);
    var mensual = evalMonto(document.getElementById('simMensual').value);
    var meses = Math.max(1, parseInt(document.getElementById('simMeses').value, 10) || 12);
    var roiAnual = parseFloat((document.getElementById('simRoi').value || '0').replace(',', '.')) || 0;

    var rMensual = Math.pow(1 + roiAnual / 100, 1 / 12) - 1;
    var valorAportes = rMensual !== 0
      ? mensual * ((Math.pow(1 + rMensual, meses) - 1) / rMensual)
      : mensual * meses;
    var valorInicial = inicial * Math.pow(1 + rMensual, meses);
    var total = valorAportes + valorInicial;
    var aportado = inicial + mensual * meses;
    var ganancia = total - aportado;

    var anios = meses / 12;
    var plazoTxt = meses % 12 === 0 ? (anios + (anios === 1 ? ' año' : ' años')) : (meses + ' meses');

    document.getElementById('simResultado').innerHTML =
      '<div class="sr-label">Proyección en ' + plazoTxt + '</div>' +
      '<div class="sr-val">' + fmt(total) + '</div>' +
      '<div class="sr-sub"><span>Aportaste</span><b>' + fmt(aportado) + '</b></div>' +
      '<div class="sr-sub"><span>Ganancia estimada</span><b style="color:var(--pos)">' + (ganancia >= 0 ? '+' : '') + fmt(ganancia) + '</b></div>';
  }

  function renderUltimosMovimientos() {
    var body = document.getElementById('ultimosMovsBody');
    var lista = todosLosMovimientos().slice(0, 8);
    if (!lista.length) {
      body.innerHTML = '<p class="empty-hint">Todavía no hay movimientos cargados.</p>';
      return;
    }
    var html = '';
    lista.forEach(function (r, i) {
      var mv = r.mv;
      var desc = mv.fila || mv.nota || 'Compra';
      html += (i ? '<hr class="sep">' : '') + '<div class="row" style="padding:10px 0">' + tileCat(mv.categoria) +
        '<div class="grow"><div class="rt">' + escapeHtml(desc) + '</div><div class="rs">' + etiquetaDia(mv.fecha) +
        (mv.nota && mv.nota !== desc ? ' · ' + escapeHtml(mv.nota) : '') + '</div></div>' +
        '<div class="amt">- ' + fmt(mv.monto) + '</div></div>';
    });
    body.innerHTML = html;
  }

  // Lluvia de confeti (sin librerías)
  function confetti() {
    var colores = ['#0ea5a4', '#22c55e', '#f59e0b', '#6366f1', '#ec4899', '#3b82f6'];
    for (var i = 0; i < 90; i++) {
      (function (i) {
        var s = document.createElement('span');
        s.className = 'confetti';
        s.style.left = (2 + (i * 1.09) % 96) + 'vw';
        s.style.background = colores[i % colores.length];
        var dur = 1.6 + ((i * 7) % 12) / 10;
        var delay = (i % 12) * 0.045;
        s.style.animationDuration = dur + 's';
        s.style.animationDelay = delay + 's';
        s.style.transform = 'rotate(' + ((i * 43) % 360) + 'deg)';
        if (i % 3 === 0) s.style.borderRadius = '50%';
        document.body.appendChild(s);
        setTimeout(function () { s.remove(); }, (dur + delay) * 1000 + 300);
      })(i);
    }
  }

  // ============================================================
  //  ACCIONES DE LA BARRA SUPERIOR
  // ============================================================
  function irMes(dir) {
    var keys = mesesOrdenados();
    var i = keys.indexOf(mesActivo);
    if (dir < 0 && i > 0) mesActivo = keys[i - 1];
    else if (dir > 0 && i < keys.length - 1) mesActivo = keys[i + 1];
    else if (dir > 0 && i === keys.length - 1) { nuevoMes(); return; }
    render();
  }

  // "2026-07" -> 24319 (año*12+mes), para poder restar y saber cuántos meses
  // de diferencia hay entre dos claves sin parsear fechas de verdad.
  function mesesEntero(k) {
    var p = k.split('-');
    return parseInt(p[0], 10) * 12 + parseInt(p[1], 10);
  }

  function nuevoMes() {
    var keys = mesesOrdenados();
    var ultimo = keys[keys.length - 1];
    var nuevo = siguienteMes(ultimo);
    // Crear un mes muy adelantado suele ser sin querer (tocaste "›" de más
    // estando ya en el último mes) — confirmamos antes de encadenar meses
    // vacíos hacia el futuro.
    if (mesesEntero(nuevo) - mesesEntero(mesActualKey()) > 1) {
      confirmar('Vas a crear <b>' + mesKeyLabel(nuevo) + '</b>, bastante adelantado respecto a hoy. ¿Seguro que no tocaste "›" de más?', crearMesNuevo, 'Sí, crear igual');
      return;
    }
    crearMesNuevo();

    function crearMesNuevo() {
      // copiar ingresos y gastos del último mes como plantilla
      var base = estado.meses[ultimo];
      estado.meses[nuevo] = {
        ingresos: base.ingresos.map(function (i) { return { id: uid(), nombre: i.nombre, monto: i.monto }; }),
        gastos: clonarGastos(base.gastos)
      };
      mesActivo = nuevo;
      guardar(); render();
      toast('Mes nuevo creado copiando ' + mesKeyLabel(ultimo));
    }
  }

  // ---------- Modales ----------
  function abrirModal(html) {
    document.getElementById('modal').innerHTML = html;
    document.getElementById('modalBack').classList.add('open');
  }
  function cerrarModal() { document.getElementById('modalBack').classList.remove('open'); }

  // iOS Safari no achica el viewport "fixed" cuando aparece el teclado — el
  // modal (pegado abajo con align-items:flex-end) queda tapado por el teclado
  // en vez de moverse. window.visualViewport sí sabe el área realmente
  // visible, así que ajustamos el alto/posición del overlay a mano.
  if (window.visualViewport) {
    function ajustarModalATeclado() {
      var vv = window.visualViewport;
      ['modalBack', 'chatBack'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.style.height = vv.height + 'px';
        el.style.top = vv.offsetTop + 'px';
      });
    }
    window.visualViewport.addEventListener('resize', ajustarModalATeclado);
    window.visualViewport.addEventListener('scroll', ajustarModalATeclado);
  }

  function confirmar(texto, onOk, textoBoton) {
    abrirModal('<h3>Confirmar</h3><p class="sub">' + texto + '</p>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">' + (textoBoton || 'Sí, eliminar') + '</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    document.getElementById('mOk').onclick = function () { cerrarModal(); onOk(); };
  }

  // Igual que confirmar(), pero como Promise<boolean> — hace falta poder
  // "esperar" la decisión del usuario en medio de bootstrapProyecto (async)
  // antes de decidir si se borran sus datos propios o no.
  function confirmarUnionForzada(duenoEmail) {
    return new Promise(function (resolve) {
      var quien = duenoEmail ? '<b>' + escapeHtml(duenoEmail) + '</b>' : 'esa persona';
      abrirModal('<h3>¿Unirte a este proyecto?</h3>' +
        '<p class="sub">Ya tenés datos propios cargados en esta cuenta. Si entrás al proyecto compartido de ' + quien +
        ', <b>vas a perder tus datos actuales</b> — no se pueden combinar los dos. Esta acción no se puede deshacer.</p>' +
        '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancelar, seguir con lo mío</button>' +
        '<button class="btn btn-primary" id="mOk" style="background:var(--error)">Sí, borrar mis datos y unirme</button></div>');
      document.getElementById('mCancel').onclick = function () { cerrarModal(); resolve(false); };
      document.getElementById('mOk').onclick = function () { cerrarModal(); resolve(true); };
    });
  }

  // El comprobante AFIP en el pie del ticket trae un QR con fecha e importe
  // EXACTOS (no es una lectura/estimación de una IA, es el dato fiscal real).
  // Decodifica la URL del QR (formato "https://www.afip.gob.ar/fe/qr/?p=<base64>")
  // y devuelve { fecha: 'YYYY-MM-DD', monto } o null si no es ese formato.
  function leerQRTicket(texto) {
    try {
      var p = new URL(texto).searchParams.get('p');
      if (!p) return null;
      var b64 = p.replace(/-/g, '+').replace(/_/g, '/');
      var datos = JSON.parse(atob(b64));
      var fecha = (typeof datos.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) ? datos.fecha : null;
      var monto = Number(datos.importe) > 0 ? Math.round(Number(datos.importe)) : null;
      return (fecha || monto) ? { fecha: fecha, monto: monto } : null;
    } catch (e) { return null; }
  }

  // ---------- Escáner de QR en vivo (ticket, desde el ícono de la barra) ----------
  // A diferencia de "Escanear ticket" (que manda UNA foto a la IA de visión), esto
  // lee el QR directo de la imagen de la cámara en tiempo real, sin sacar foto —
  // apenas encuentra un código lo procesa. Solo sirve para el QR fiscal (fecha +
  // importe exactos); para ver los artículos comprados sigue haciendo falta la
  // foto completa del ticket, porque ese dato no está codificado en el QR.
  var qrScanStream = null;
  var qrScanRAF = null;

  function abrirEscanerQR() {
    if (!(modoCuenta && miProyectoId)) { toast('Iniciá sesión primero.'); return; }
    if (!window.jsQR) { toast('No se pudo cargar el lector de QR.'); return; }
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      toast('Tu navegador no permite usar la cámara acá.'); return;
    }
    var back = document.getElementById('qrScanBack');
    var video = document.getElementById('qrScanVideo');
    back.classList.add('open');
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(function (stream) {
      qrScanStream = stream;
      video.srcObject = stream;
      video.play();
      var canvas = document.createElement('canvas');
      var ctx = canvas.getContext('2d');
      function tick() {
        if (!qrScanStream) return; // el usuario ya cerró el escáner
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          var w = video.videoWidth, h = video.videoHeight;
          if (w && h) {
            var escala = Math.min(1, 720 / Math.max(w, h));
            canvas.width = Math.round(w * escala);
            canvas.height = Math.round(h * escala);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            try {
              var datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
              var code = window.jsQR(datos.data, canvas.width, canvas.height);
              if (code && code.data) { manejarQRDetectado(code.data); return; }
            } catch (err) { /* frame no legible, seguimos intentando con el siguiente */ }
          }
        }
        qrScanRAF = requestAnimationFrame(tick);
      }
      tick();
    }).catch(function () {
      toast('No pude acceder a la cámara.');
      cerrarEscanerQR();
    });
  }

  function cerrarEscanerQR() {
    document.getElementById('qrScanBack').classList.remove('open');
    if (qrScanRAF) { cancelAnimationFrame(qrScanRAF); qrScanRAF = null; }
    if (qrScanStream) { qrScanStream.getTracks().forEach(function (t) { t.stop(); }); qrScanStream = null; }
    var video = document.getElementById('qrScanVideo');
    if (video) video.srcObject = null;
  }

  function manejarQRDetectado(texto) {
    cerrarEscanerQR();
    var qr = leerQRTicket(texto);
    if (qr && (qr.fecha || qr.monto)) {
      modalGasto();
      if (qr.fecha) document.getElementById('gFecha').value = qr.fecha;
      if (qr.monto) document.getElementById('gMonto').value = formatInput(qr.monto);
      toast('QR leído — completá el resto. Para ver los artículos, usá "Escanear ticket" con una foto.');
      return;
    }
    // No es el QR fiscal de AFIP — algunos comercios (Coto confirmado, quizás
    // otros) tienen su PROPIO QR que lleva a una página con el detalle completo
    // de la compra (con artículos incluidos). Si parece una URL, se la mandamos
    // al servidor para que la abra e interprete.
    var esUrl = /^https?:\/\//i.test(texto);
    if (!esUrl) {
      console.log('QR leído (formato no reconocido):', texto);
      toast('No reconozco el formato de ese QR.');
      return;
    }
    toast('Buscando el detalle del ticket…');
    sbClient.functions.invoke('leer-ticket', { body: { ticketUrl: texto } }).then(function (res) {
      if (res.error || !res.data || res.data.error) {
        toast((res.data && res.data.error) || 'No pude leer el detalle de ese ticket, completá a mano.');
        console.log('QR leído (no se pudo interpretar la página):', texto);
        return;
      }
      var d = res.data;
      modalGasto();
      if (d.nota) document.getElementById('gNombre').value = d.nota;
      if (d.monto) document.getElementById('gMonto').value = formatInput(d.monto);
      if (d.categoria) document.getElementById('gCat').value = d.categoria; document.getElementById('gCat').dispatchEvent(new Event('change'));
      if (d.fecha) document.getElementById('gFecha').value = d.fecha;
      toast('Ticket leído — revisá los datos antes de confirmar.');
    }).catch(function () {
      toast('No pude leer el detalle de ese ticket, completá a mano.');
    });
  }

  // Prepara una foto de ticket para el escaneo: busca el QR de AFIP a una
  // resolución más alta (para que se llegue a decodificar bien) y por separado
  // arma una versión más chica/comprimida para mandarle a la IA de visión (no
  // necesita tanta resolución para leer el comercio y los artículos, y así el
  // envío pesa mucho menos). callback({ dataUrl, qr }) — dataUrl o qr pueden
  // venir null si no se pudieron obtener.
  function procesarFotoTicket(file, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var escalar = function (max) {
          var w = img.width, h = img.height;
          if (w > max || h > max) {
            if (w > h) { h = Math.round(h * max / w); w = max; }
            else { w = Math.round(w * max / h); h = max; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          return canvas;
        };

        var qr = null;
        if (window.jsQR) {
          try {
            var qrCanvas = escalar(1600);
            var datos = qrCanvas.getContext('2d').getImageData(0, 0, qrCanvas.width, qrCanvas.height);
            var code = window.jsQR(datos.data, qrCanvas.width, qrCanvas.height);
            if (code && code.data) qr = leerQRTicket(code.data);
          } catch (err) { /* sin QR legible, seguimos solo con la IA */ }
        }

        var dataUrl = null;
        try { dataUrl = escalar(1280).toDataURL('image/jpeg', 0.7); } catch (err) { /* dataUrl queda null */ }

        callback({ dataUrl: dataUrl, qr: qr });
      };
      img.onerror = function () { callback({ dataUrl: null, qr: null }); };
      img.src = e.target.result;
    };
    reader.onerror = function () { callback({ dataUrl: null, qr: null }); };
    reader.readAsDataURL(file);
  }

  // ---- Selector de "Fila": desplegable con las filas existentes de la categoría + "Nueva fila…" ----
  var FILA_NUEVA = '__nueva__';
  function selectorFilaHTML(p) {
    return '<div class="field"><label>Fila</label><select id="' + p + 'Fila"></select></div>' +
      '<div class="field" id="' + p + 'FilaNuevaWrap" style="display:none"><label>Nombre de la fila nueva</label>' +
      '<input id="' + p + 'FilaNueva" placeholder="Ej: Verdulería"></div>';
  }
  function actualizarFilaNueva(p) {
    var sel = document.getElementById(p + 'Fila'), wrap = document.getElementById(p + 'FilaNuevaWrap');
    if (!sel || !wrap) return;
    var nueva = sel.value === FILA_NUEVA;
    wrap.style.display = nueva ? '' : 'none';
    if (nueva) { var inp = document.getElementById(p + 'FilaNueva'); if (inp) inp.focus(); }
  }
  // preferidaId (opcional): fila a dejar elegida; si no, la acumuladora de la categoría; si no hay, "Nueva fila…"
  function poblarSelectorFila(p, mes, categoria, preferidaId) {
    var sel = document.getElementById(p + 'Fila');
    if (!sel) return;
    var filas = (mes.gastos || []).filter(function (g) { return g.categoria === categoria; });
    var accName = nombreAcumulador(categoria);
    var pref = null;
    if (preferidaId && filas.some(function (f) { return f.id === preferidaId; })) pref = preferidaId;
    else { var acc = filas.find(function (f) { return f.bot || f.nombre === accName; }); if (acc) pref = acc.id; }
    sel.innerHTML = filas.map(function (f) {
      return '<option value="' + escapeAttr(f.id) + '">' + escapeHtml(f.nombre || '(sin nombre)') + '</option>';
    }).join('') + '<option value="' + FILA_NUEVA + '">＋ Nueva fila…</option>';
    sel.value = pref || FILA_NUEVA;
    var inp = document.getElementById(p + 'FilaNueva');
    if (inp) inp.placeholder = 'Ej: Verdulería (vacío = “' + accName + '”)';
    var wrap = document.getElementById(p + 'FilaNuevaWrap');
    if (wrap) wrap.style.display = sel.value === FILA_NUEVA ? '' : 'none';
  }
  // Devuelve { id } (fila existente) o { nombre } (fila nueva; vacío = la acumuladora de la categoría)
  function leerSelectorFila(p, categoria) {
    var sel = document.getElementById(p + 'Fila');
    if (!sel) return null;
    if (sel.value === FILA_NUEVA) {
      var inp = document.getElementById(p + 'FilaNueva');
      return { nombre: ((inp && inp.value) || '').trim() || nombreAcumulador(categoria) };
    }
    return { id: sel.value };
  }

  // Modal para agregar un gasto y mandarlo a la categoría elegida
  function modalGasto(catInicial) {
    var opciones = CATEGORIAS.map(function (c) {
      var sel = (c.id === catInicial) ? ' selected' : '';
      return '<option value="' + c.id + '"' + sel + '>' + c.icon + '  ' + escapeHtml(getCatNombre(c.id)) + '</option>';
    }).join('');
    // Escanear ticket necesita una sesión real (llama a un Edge Function con
    // IA de visión) — en modo invitado/local no hay nada a lo que autenticarse,
    // así que el botón solo aparece si hay cuenta vinculada.
    var puedeEscanear = modoCuenta && miProyectoId;
    abrirModal('<h3>Agregar gasto</h3><p class="sub">Se suma solo al total de la categoría que elijas.</p>' +
      (puedeEscanear
        ? '<button type="button" class="btn btn-ghost" id="gEscanearBtn" style="width:100%">' +
          ico('camera', 18) + ' Escanear ticket</button>' +
          '<p class="sub" style="margin:4px 0 12px">Que se vea el ticket completo, incluido el QR del pie.</p>' +
          '<input type="file" accept="image/*" capture="environment" id="gTicketInput" style="display:none">'
        : '') +
      '<div class="field"><label>Concepto</label><input id="gNombre" placeholder="Ej: Compra en el super"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Monto</label><input id="gMonto" inputmode="text" placeholder="0 (podés escribir 200+120)"></div>' +
        '<div class="field"><label>Categoría</label><select id="gCat">' + opciones + '</select></div>' +
      '</div>' +
      selectorFilaHTML('g') +
      '<div class="field"><label>Fecha</label><input type="date" id="gFecha" value="' + isoHoyApp() + '" max="' + isoHoyApp() + '"></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">Agregar gasto</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    var nombreEl = document.getElementById('gNombre');
    var montoEl = document.getElementById('gMonto');
    nombreEl.focus();
    montoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('mOk').click(); });
    // Fila: desplegable con las filas que ya existen en la categoría elegida + opción de crear una nueva
    var mesDelModal = mesData();
    function refrescarFilasGasto() { poblarSelectorFila('g', mesDelModal, document.getElementById('gCat').value); }
    document.getElementById('gCat').addEventListener('change', refrescarFilasGasto);
    document.getElementById('gFila').addEventListener('change', function () { actualizarFilaNueva('g'); });
    refrescarFilasGasto();
    if (puedeEscanear) {
      var escanearBtn = document.getElementById('gEscanearBtn');
      var ticketInput = document.getElementById('gTicketInput');
      escanearBtn.onclick = function () { ticketInput.click(); };
      ticketInput.onchange = function () {
        var file = ticketInput.files && ticketInput.files[0];
        ticketInput.value = '';
        if (!file) return;
        escanearBtn.disabled = true;
        escanearBtn.innerHTML = ico('hourglass', 18) + ' Leyendo ticket…';
        var restaurarBtn = function () {
          escanearBtn.disabled = false;
          escanearBtn.innerHTML = ico('camera', 18) + ' Escanear ticket';
        };
        procesarFotoTicket(file, function (foto) {
          if (!foto.dataUrl) { toast('No pude leer esa imagen.'); restaurarBtn(); return; }
          sbClient.functions.invoke('leer-ticket', { body: { imagenBase64: foto.dataUrl } }).then(function (res) {
            restaurarBtn();
            if (res.error || !res.data || res.data.error) {
              toast((res.data && res.data.error) || 'No pude leer el ticket, completá a mano.');
              return;
            }
            var d = res.data;
            if (d.nota) nombreEl.value = d.nota;
            if (d.monto) montoEl.value = formatInput(d.monto);
            if (d.categoria) document.getElementById('gCat').value = d.categoria; document.getElementById('gCat').dispatchEvent(new Event('change'));
            if (d.fecha) document.getElementById('gFecha').value = d.fecha;
            // El QR de AFIP trae fecha e importe EXACTOS (dato fiscal real, no una
            // lectura de la IA) — si lo pudimos decodificar, pisan lo que haya
            // puesto la IA para esos dos campos.
            if (foto.qr) {
              if (foto.qr.fecha) document.getElementById('gFecha').value = foto.qr.fecha;
              if (foto.qr.monto) montoEl.value = formatInput(foto.qr.monto);
            }
            toast(foto.qr ? 'Ticket leído (con QR) — revisá los datos.' : 'Ticket leído — revisá los datos antes de confirmar.');
          }).catch(function () {
            restaurarBtn();
            toast('No pude leer el ticket, completá a mano.');
          });
        });
      };
    }
    document.getElementById('mOk').onclick = function () {
      var nombre = nombreEl.value.trim();
      var monto = evalMonto(montoEl.value);
      var cat = document.getElementById('gCat').value;
      var fecha = document.getElementById('gFecha').value || isoHoyApp();
      if (!monto) { montoEl.focus(); return; }
      var acc = registrarCompra(cat, monto, nombre || null, nombre ? [{ nombre: nombre, monto: monto }] : null, fecha, leerSelectorFila('g', cat));
      colapsadas[cat] = false;
      guardar(); cerrarModal(); render(false);
      toast('Sumado ' + fmt(monto) + ' en ' + getCatNombre(cat));
      var row = document.querySelector('.cat-group[data-cat="' + cat + '"] .item-row[data-id="' + acc.id + '"]');
      if (row) { row.classList.add('nueva'); row.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    };
  }

  function modalDeuda(id) {
    var edit = !!id;
    var d = edit ? estado.deudas.find(function (x) { return x.id === id; }) : null;
    if (edit && !d) return;
    var v = function (n) { return d && d[n] != null ? d[n] : ''; };
    var vNum = function (n) { return d && d[n] ? formatInput(d[n]) : ''; };
    abrirModal('<h3>' + (edit ? 'Editar deuda' : 'Agregar deuda') + '</h3><p class="sub">Tarjeta, préstamo o cuotas.</p>' +
      '<div class="field"><label>Nombre</label><input id="dNombre" placeholder="Ej: Tarjeta Visa Galicia" value="' + escapeAttr(v('nombre')) + '"></div>' +
      '<div class="field"><label>Saldo total que debés</label><input id="dSaldo" inputmode="numeric" placeholder="0" value="' + vNum('saldo') + '"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Cuota actual</label><input id="dCuotaAct" inputmode="numeric" placeholder="opcional" value="' + (d && d.cuotaActual ? d.cuotaActual : '') + '"></div>' +
        '<div class="field"><label>De cuántas</label><input id="dCuotaTot" inputmode="numeric" placeholder="opcional" value="' + (d && d.cuotaTotal ? d.cuotaTotal : '') + '"></div>' +
      '</div>' +
      '<div class="field"><label>Cuánto pagás por mes</label><input id="dCuotaMes" inputmode="numeric" placeholder="0" value="' + vNum('cuotaMensual') + '"></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">' + (edit ? 'Guardar cambios' : 'Agregar') + '</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    document.getElementById('dNombre').focus();
    document.getElementById('mOk').onclick = function () {
      var nombre = document.getElementById('dNombre').value.trim();
      if (!nombre) { document.getElementById('dNombre').focus(); return; }
      var ca = parseNum(document.getElementById('dCuotaAct').value);
      var ct = parseNum(document.getElementById('dCuotaTot').value);
      var datos = {
        nombre: nombre,
        saldo: parseNum(document.getElementById('dSaldo').value),
        cuotaActual: ca > 0 ? ca : null,
        cuotaTotal: ct > 0 ? ct : null,
        cuotaMensual: parseNum(document.getElementById('dCuotaMes').value)
      };
      if (edit) {
        d.nombre = datos.nombre; d.saldo = datos.saldo;
        d.cuotaActual = datos.cuotaActual; d.cuotaTotal = datos.cuotaTotal;
        d.cuotaMensual = datos.cuotaMensual;
        if (!(d.cuotaActual && d.cuotaTotal && d.cuotaActual >= d.cuotaTotal)) d.activa = true;
      } else {
        datos.id = uid(); datos.activa = true;
        estado.deudas.push(datos);
      }
      guardar(); cerrarModal(); render(false); toast(edit ? 'Deuda actualizada' : 'Deuda agregada');
      if (edit) {
        var row = document.querySelector('.deuda-card[data-id="' + id + '"]');
        if (row) row.classList.add('flash');
      }
    };
  }

  // Abre Telegram con el link de vinculación (lo usan Ajustes y el menú de datos)
  function vincularTelegram() {
    // Hay que abrir la pestaña YA, en el mismo click — si se abre recién
    // después de esperar la respuesta del servidor, el navegador la bloquea.
    var ventana = window.open('', '_blank');
    toast('Generando link de Telegram…');
    generarLinkTelegram().then(function (link) {
      if (ventana) ventana.location.href = link; else location.href = link;
      cerrarModal();
    }).catch(function (e) {
      if (ventana) ventana.close();
      toast('No se pudo generar el link (' + (e && e.message ? e.message : 'error') + ')');
    });
  }

  function modalMenu() {
    var estadoNube = modoCuenta
      ? '<span style="color:var(--text-mute)">Vinculá el chat para cargar gastos por Telegram</span>'
      : (nubeActiva()
        ? '<span style="color:var(--cyan)">● Conectado a la nube</span>'
        : '<span style="color:var(--text-mute)">○ Sin conectar</span>');
    abrirModal('<h3>Datos y sincronización</h3><p class="sub">Tus datos se guardan en este navegador. Descargá una copia o conectá el bot de Telegram.</p>' +
      '<div class="field"><label>Bot de Telegram</label>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
        '<span style="font-size:13px">' + estadoNube + '</span>' +
        '<button class="btn btn-primary btn-sm" id="mNube">🔗 Conectar Telegram</button></div></div>' +
      '<div class="field"><label>Copia de seguridad</label>' +
        '<div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap;margin-top:0">' +
        '<button class="btn" id="mExport">⬇️ Descargar copia</button>' +
        '<button class="btn" id="mImport">⬆️ Restaurar copia</button>' +
        '<button class="btn" id="mReset" style="color:var(--danger)">↺ Empezar de cero</button>' +
        '</div></div>' +
      '<div class="field"><label>Meses</label>' +
        '<div class="modal-actions" style="justify-content:flex-start;flex-wrap:wrap;margin-top:0">' +
        '<button class="btn" id="mLimpiarMeses">🧹 Borrar meses futuros</button>' +
        '</div></div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cerrar</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    document.getElementById('mNube').onclick = modoCuenta ? vincularTelegram : modalNube;
    document.getElementById('mExport').onclick = exportar;
    document.getElementById('mImport').onclick = function () { document.getElementById('importFile').click(); };
    document.getElementById('mReset').onclick = function () {
      confirmar('Esto borra todo y vuelve a los datos originales del Excel. ¿Seguro?', function () {
        estado = construirDesdeSemilla(); mesActivo = asegurarMesActual();
        guardar(); render(); toast('Datos reiniciados');
      });
    };
    document.getElementById('mLimpiarMeses').onclick = function () { cerrarModal(); modalLimpiarMesesFuturos(); };
  }

  // Herramienta de limpieza: si se tocó "›" de más (o antes de que existiera
  // la confirmación al crear un mes muy adelantado) pueden quedar meses
  // futuros vacíos encadenados. Deja elegir hasta qué mes conservar y borra
  // el resto de un toque, sin tener que ir mes por mes.
  function modalLimpiarMesesFuturos() {
    var hoy = mesActualKey();
    var futuros = mesesOrdenados().filter(function (k) { return k > hoy; });
    if (!futuros.length) { toast('No hay meses futuros para borrar.'); return; }
    var sugerido = siguienteMes(siguienteMes(siguienteMes(siguienteMes(siguienteMes(hoy))))); // hoy + 5 meses
    abrirModal('<h3>Borrar meses futuros</h3>' +
      '<p class="sub">Tenés meses cargados hasta <b>' + mesKeyLabel(futuros[futuros.length - 1]) + '</b>. ' +
      'Elegí hasta qué mes conservar — el resto se borra (si tenés datos reales cargados en alguno, no lo toca).</p>' +
      '<div class="field"><label>Conservar hasta</label><input id="lmHasta" placeholder="2026-12" value="' + sugerido + '"></div>' +
      '<p class="sub" id="lmMsg" style="min-height:16px;margin:0 0 4px"></p>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">Ver qué se borra</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    document.getElementById('mOk').onclick = function () {
      var hasta = document.getElementById('lmHasta').value.trim();
      var msg = document.getElementById('lmMsg');
      if (!/^\d{4}-\d{2}$/.test(hasta)) { msg.style.color = 'var(--danger)'; msg.textContent = 'Formato: AAAA-MM, ej. 2026-12.'; return; }
      var aBorrar = futuros.filter(function (k) { return k > hasta; });
      if (!aBorrar.length) { msg.style.color = 'var(--text-mute)'; msg.textContent = 'No hay nada después de ese mes para borrar.'; return; }
      // Los ingresos se copian siempre como plantilla al crear un mes nuevo
      // (aunque nunca se haya usado), así que no sirven para saber si el mes
      // "se usó" de verdad — solo los gastos con monto (los acumuladores del
      // bot arrancan en 0 en un mes nuevo) y los movimientos son señal real.
      var conDatos = aBorrar.filter(function (k) {
        var m = estado.meses[k];
        return (m.gastos || []).some(function (g) { return Number(g.monto) > 0; }) ||
          (m.movimientos || []).length > 0;
      });
      var vacios = aBorrar.filter(function (k) { return conDatos.indexOf(k) === -1; });
      cerrarModal();
      var texto = 'Se van a borrar <b>' + vacios.length + '</b> mes(es) vacío(s): ' + vacios.map(mesKeyLabel).join(', ') + '.' +
        (conDatos.length ? '<br><br>⚠️ Estos tienen datos cargados y <b>no se van a tocar</b>: ' + conDatos.map(mesKeyLabel).join(', ') + '.' : '');
      confirmar(texto, function () {
        vacios.forEach(function (k) { delete estado.meses[k]; });
        if (vacios.indexOf(mesActivo) !== -1) mesActivo = hoy;
        guardar(); render();
        toast(vacios.length + ' mes(es) borrado(s)');
      }, 'Sí, borrar');
    };
  }

  function modalNube() {
    var cfg = nubeCfg || {};
    abrirModal('<h3>Conectar a la nube ☁️</h3><p class="sub">Pegá los datos de tu proyecto de Supabase para sincronizar con el bot de Telegram. (Están en el instructivo <b>CONECTAR-BOT-TELEGRAM</b>.)</p>' +
      '<div class="field"><label>URL del proyecto</label><input id="nbUrl" placeholder="https://xxxxx.supabase.co" value="' + escapeAttr(cfg.url || '') + '"></div>' +
      '<div class="field"><label>Clave pública (anon key)</label><input id="nbKey" placeholder="eyJhbGciOi..." value="' + escapeAttr(cfg.key || '') + '"></div>' +
      '<p class="sub" id="nbMsg" style="min-height:16px;margin:0 0 4px"></p>' +
      '<div class="modal-actions">' +
      (nubeActiva() ? '<button class="btn" id="nbOff" style="color:var(--danger);margin-right:auto">Desconectar</button>' : '') +
      '<button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">Guardar y probar</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    var off = document.getElementById('nbOff');
    if (off) off.onclick = function () {
      localStorage.removeItem(NUBE_KEY); nubeCfg = null; nubeRev = -1;
      if (nubePollTimer) clearInterval(nubePollTimer);
      actualizarIndicadorNube(false); cerrarModal(); toast('Nube desconectada');
    };
    document.getElementById('mOk').onclick = function () {
      var url = document.getElementById('nbUrl').value.trim();
      var key = document.getElementById('nbKey').value.trim();
      var msg = document.getElementById('nbMsg');
      if (!url || !key) { msg.textContent = 'Completá los dos campos.'; return; }
      msg.style.color = 'var(--text-mute)'; msg.textContent = 'Probando conexión…';
      nubeCfg = { url: url, key: key };
      nubeTraer().then(function () {
        localStorage.setItem(NUBE_KEY, JSON.stringify(nubeCfg));
        msg.style.color = 'var(--cyan)'; msg.textContent = '¡Conectado! Sincronizando…';
        return nubeConectar();
      }).then(function () {
        setTimeout(function () { cerrarModal(); toast('Nube conectada ☁️'); }, 500);
      }).catch(function (e) {
        nubeCfg = null;
        msg.style.color = 'var(--danger)';
        msg.textContent = 'No se pudo conectar. Revisá la URL y la clave. (' + (e && e.message ? e.message : 'error') + ')';
      });
    };
  }

  function exportar() {
    var blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var hoy = new Date();
    a.href = url;
    a.download = 'mis-finanzas-' + hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    cerrarModal(); toast('Copia descargada');
  }

  function importarArchivo(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data.meses) throw new Error('formato');
        estado = data; mesActivo = asegurarMesActual();
        guardar(); cerrarModal(); render(); toast('Copia restaurada');
      } catch (e) { toast('El archivo no es válido'); }
    };
    reader.readAsText(file);
  }

  // ---------- Helpers ----------
  function parseNum(s) {
    if (typeof s === 'number') return s;
    if (!s) return 0;
    s = String(s).replace(/\./g, '').replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  // Evalúa el monto. Si el usuario escribe una cuenta (ej: "200+120", "1500-300")
  // la resuelve automáticamente. Si es un número normal, usa parseNum.
  function evalMonto(s) {
    if (typeof s === 'number') return s;
    if (!s) return 0;
    var txt = String(s).trim();
    // ¿Hay una operación? (un dígito o ")" seguido de + - * /)
    if (/[0-9)]\s*[+\-*/]/.test(txt)) {
      // formato argentino: quitamos puntos de miles y pasamos coma a punto decimal
      var expr = txt.replace(/\./g, '').replace(/,/g, '.');
      if (/^[0-9+\-*/().\s]+$/.test(expr)) {
        try {
          var val = Function('"use strict";return (' + expr + ')')();
          if (typeof val === 'number' && isFinite(val)) return Math.max(0, val);
        } catch (e) { /* si falla, cae al parseNum de abajo */ }
      }
    }
    return parseNum(txt);
  }
  function formatInput(n) { return (Math.round(Number(n) || 0)).toLocaleString('es-AR'); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  // ============================================================
  //  INICIO
  // ============================================================
  function init() {
    cargar();
    cargarNubeCfg();
    // La nube manual (para el bot de Telegram) es cosa de la app de escritorio
    // (file://) — en la versión hosteada todo pasa por la cuenta de Google, así
    // que ignoramos cualquier config de nube vieja para no mezclar datos de un
    // registro compartido con los de cada cuenta.
    if (nubeActiva() && !esHosteado()) {
      // con nube: mostramos el mes actual provisorio y dejamos que nubeConectar
      // baje los datos reales antes de crear/guardar nada (para no pisar la nube)
      mesActivo = mesActualKey();
      render();
      actualizarIndicadorNube(true);
      nubeConectar();
    } else {
      mesActivo = asegurarMesActual(); // siempre arranca en el mes actual
      render();
    }

    document.getElementById('prevMonth').onclick = function () { irMes(-1); };
    document.getElementById('nextMonth').onclick = function () { irMes(1); };
    document.getElementById('hoyBtn').onclick = function () {
      var hoy = mesActualKey();
      if (!estado.meses[hoy]) asegurarMesActual();
      mesActivo = hoy; render();
    };
    // FAB de acciones rápidas (ahora vive en el medio de la barra de abajo,
    // no flotando aparte): un toque despliega 4 opciones (escanear QR, nuevo
    // mes, nuevo ingreso, nuevo gasto) con una animación.
    var fabWrap = document.getElementById('fabWrap');
    var fabBackdrop = document.getElementById('fabBackdrop');
    function fabAbierto(v) {
      fabWrap.classList.toggle('open', v);
      if (fabBackdrop) fabBackdrop.classList.toggle('show', v);
      document.getElementById('fabToggle').setAttribute('aria-expanded', v ? 'true' : 'false');
    }
    document.getElementById('fabToggle').onclick = function () { fabAbierto(!fabWrap.classList.contains('open')); };
    if (fabBackdrop) fabBackdrop.onclick = function () { fabAbierto(false); };
    document.getElementById('fabGasto').onclick = function () { fabAbierto(false); modalGasto(); };
    document.getElementById('fabQR').onclick = function () { fabAbierto(false); abrirEscanerQR(); };
    document.getElementById('fabIngreso').onclick = function () {
      fabAbierto(false);
      mostrarPagina('gastos');
      marcarNavActivo('gastos');
      agregarIngresoRapido();
      var sec = document.getElementById('ingresos');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.getElementById('fabMes').onclick = function () { fabAbierto(false); nuevoMes(); };
    document.getElementById('menuBtn').onclick = modalMenu;
    document.getElementById('heroBackup').onclick = modalMenu;
    document.getElementById('heroAddGasto').onclick = function () { modalGasto(); };
    document.getElementById('heroEyeBtn').onclick = function () {
      saldoOculto = !saldoOculto;
      localStorage.setItem('misFinanzas_saldoOculto', saldoOculto ? '1' : '0');
      updateKPIs(false);
    };
    document.getElementById('addDeudaBtn').onclick = function () { modalDeuda(); };
    document.getElementById('exportarAnaliticasBtn').onclick = exportar;
    document.getElementById('verHistorialBtn').onclick = function () {
      mostrarPagina('historial');
      marcarNavActivo('historial');
    };
    document.getElementById('analiticasNavBtn').onclick = function () {
      mostrarPagina('analiticas');
      marcarNavActivo('analiticas');
    };
    document.getElementById('gastosAddBtn').onclick = function () { modalGasto(); };

    // ---- Tema (botón del encabezado + selector de Ajustes) ----
    aplicarTema(temaPreferidoInicial(), false);
    document.getElementById('temaBtn').onclick = function () { aplicarTema(temaActual() === 'claro' ? 'oscuro' : 'claro', true); };
    document.getElementById('temaClaroBtn').onclick = function () { aplicarTema('claro', true); };
    document.getElementById('temaOscuroBtn').onclick = function () { aplicarTema('oscuro', true); };

    // ---- Ajustes (la rueda del encabezado alterna entre Ajustes y la página anterior) ----
    document.getElementById('ajustesBtn').onclick = function () {
      mostrarPagina(vistaActual === 'ajustes' ? paginaAntesDeAjustes : 'ajustes');
    };
    document.getElementById('ajVoz1').onclick = function () { setVozAsistente('1'); };
    document.getElementById('ajVoz2').onclick = function () { setVozAsistente('2'); };
    document.getElementById('ajLeerSw').onclick = function () { chatSetVoz(!chatVozActivada); };
    // Cuenta y compartir: lo que antes estaba en el encabezado y en los modales, ahora en Ajustes
    document.getElementById('cuentaInvitarBtn').onclick = function () {
      if (!modoCuenta || !miUsuario) { toast('Iniciá sesión con Google para compartir tu proyecto.'); return; }
      modalCuenta();
    };
    document.getElementById('notifBtn').onclick = activarNotificaciones;
    document.getElementById('telegramBtn').onclick = function () { if (modoCuenta) vincularTelegram(); else modalNube(); };

    // ---- Análisis: chips que llevan a cada bloque + editar presupuestos ----
    document.querySelectorAll('#anaChips [data-ir]').forEach(function (b) {
      b.onclick = function () {
        document.querySelectorAll('#anaChips [data-ir]').forEach(function (x) { x.classList.toggle('on', x === b); });
        var dest = document.getElementById(b.getAttribute('data-ir'));
        if (dest) dest.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
    });
    document.getElementById('presEditarBtn').onclick = modalElegirPresupuesto;

    // toggle del gráfico: semanal / mensual / anual
    document.querySelectorAll('#evoToggle button').forEach(function (b) {
      b.onclick = function () {
        evoModo = b.getAttribute('data-modo');
        document.querySelectorAll('#evoToggle button').forEach(function (x) { x.classList.toggle('active', x === b); });
        renderEvolucion(true);
      };
    });
    document.getElementById('modalBack').addEventListener('click', function (e) {
      if (e.target === this) cerrarModal();
    });
    document.getElementById('qrScanClose').onclick = cerrarEscanerQR;
    document.getElementById('chatFab').onclick = function () { abrirChat(); };
    document.getElementById('chatClose').onclick = cerrarChat;
    (function () {
      var inp = document.getElementById('chatInput');
      function enviarYLimpiar() { enviarMensajeChat(inp.value); inp.value = ''; }
      document.getElementById('chatSendBtn').onclick = enviarYLimpiar;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') enviarYLimpiar(); });
      // Atajos de preguntas (mandan el mensaje) y de inicio de frase (lo dejan escrito)
      document.querySelectorAll('#chatChips [data-q], #chatChips [data-pre]').forEach(function (b) {
        b.onclick = function () {
          var q = b.getAttribute('data-q');
          if (q) enviarMensajeChat(q);
          else { inp.value = b.getAttribute('data-pre'); inp.focus(); }
        };
      });
      // Acciones de cada respuesta del asistente (escuchar, copiar, deshacer)
      document.getElementById('chatMensajes').addEventListener('click', function (e) {
        var b = e.target.closest('[data-act]');
        if (b) chatAccionMensaje(b.getAttribute('data-act'), parseInt(b.getAttribute('data-i'), 10));
      });
    })();
    var chatHistorialBtn = document.getElementById('chatHistorialBtn');
    if (chatHistorialBtn) chatHistorialBtn.onclick = chatToggleHistorialVista;
    var chatHistBackdrop = document.getElementById('chatHistBackdrop');
    if (chatHistBackdrop) chatHistBackdrop.onclick = chatCerrarHistorialVista;
    var chatVozBtn = document.getElementById('chatVozToggle');
    if (chatVozBtn) chatVozBtn.onclick = function () { chatSetVoz(!chatVozActivada); };
    chatVozActualizarUI();
    renderAjustes();
    var chatMicBtn = document.getElementById('chatMicBtn');
    if (chatMicBtn) {
      if (!chatMicDisponible()) chatMicBtn.style.display = 'none';
      else chatMicBtn.onclick = chatToggleMic;
    }
    document.getElementById('importFile').addEventListener('change', function (e) {
      if (e.target.files[0]) importarArchivo(e.target.files[0]);
      e.target.value = '';
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarModal(); });

    // Barra de navegación inferior: cada sección es su propia página completa
    // (ya no hay cajón lateral ni scroll-anchors — todo pasa por mostrarPagina).
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.nav a'));
    navLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var pagina = a.getAttribute('data-page');
        marcarNavActivo(pagina);
        mostrarPagina(pagina);
      });
    });

    // filtros de la página de Historial
    ['histFiltroMes', 'histFiltroCat', 'histOrden'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () { renderHistorial(); });
    });
    var histBuscar = document.getElementById('histBuscar');
    if (histBuscar) histBuscar.addEventListener('input', function () { renderHistorial(); });

    manejarAccesoDirecto();
    iniciarAuth(); // no hace nada si es el archivo local (file://)
  }

  // Atajos del manifest (mantener apretado el ícono de la app): ?accion=gasto
  // abre el modal de agregar gasto, ?accion=ingreso agrega una fila de ingreso
  // rápido, ?accion=chat abre el asistente.
  function manejarAccesoDirecto() {
    var params = new URLSearchParams(location.search);
    var accion = params.get('accion');
    if (!accion) return;
    history.replaceState(null, '', location.pathname); // que un refresh no repita la acción
    if (accion === 'gasto') {
      modalGasto();
    } else if (accion === 'ingreso') {
      mostrarPagina('gastos');
      marcarNavActivo('gastos');
      agregarIngresoRapido();
      var sec = document.getElementById('ingresos');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (accion === 'chat') {
      // pequeño respiro para que termine de resolverse el login antes de abrir el chat
      setTimeout(abrirChat, 700);
    }
  }

  // Puente mínimo hacia asistente.js (pantalla de voz y reproductor): le da acceso
  // al chat existente sin duplicar su lógica ni exponer el estado de la app.
  window.MisFinanzas = {
    enviarMensaje: enviarMensajeChat,
    puedeUsarChat: function () { return !!(modoCuenta && miProyectoId); },
    estaEnviando: function () { return chatEnviando; },
    registrarVoz: function (v) { chatVozExterna = v; },
    vozActivada: function () { return chatVozActivada; },
    setVozActivada: chatSetVoz,
    getVoz: function () { return vozAsistente; },
    setVoz: setVozAsistente,
    micDisponible: chatMicDisponible,
    // Pide el audio de una frase a la Edge Function `tts` (ElevenLabs). Usa la sesión
    // de Google del usuario; devuelve la Response (el llamador lee el blob).
    ttsFetch: function (cuerpo, senal) {
      if (!sbClient) return Promise.reject(new Error('sin sesión'));
      return sbClient.auth.getSession().then(function (r) {
        var s = r.data && r.data.session;
        if (!s) throw new Error('sin sesión');
        return fetch(CUENTA_URL + '/functions/v1/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + s.access_token, 'apikey': CUENTA_ANON_KEY },
          body: JSON.stringify(cuerpo),
          signal: senal
        });
      });
    },
    abrir: abrirChat,
    cerrar: cerrarChat,
    toast: toast,
    ico: ico
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
