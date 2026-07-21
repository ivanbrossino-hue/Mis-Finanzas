/* ===========================================================
   Mis Finanzas — lógica de la aplicación
   Todo se guarda automáticamente en este navegador (localStorage).
   =========================================================== */

(function () {
  'use strict';

  // ---------- Configuración de categorías ----------
  const CATEGORIAS = [
    { id: 'vivienda',        nombre: 'Vivienda',              icon: '🏠', color: '#7000ff' },
    { id: 'trabajo',         nombre: 'Trabajo',               icon: '💼', color: '#9b5cff' },
    { id: 'alimentacion',    nombre: 'Alimentación',          icon: '🛒', color: '#00dbe9' },
    { id: 'transporte',      nombre: 'Transporte',            icon: '🚗', color: '#4d7cff' },
    { id: 'salud',           nombre: 'Salud',                 icon: '🏥', color: '#ff4fd8' },
    { id: 'educacion',       nombre: 'Educación',             icon: '📚', color: '#b06cff' },
    { id: 'mascota',         nombre: 'Mascota',               icon: '🐾', color: '#ff6b9d' },
    { id: 'entretenimiento', nombre: 'Entretenimiento',       icon: '🎬', color: '#00b3ff' },
    { id: 'ropa',            nombre: 'Ropa / Personal',       icon: '👕', color: '#ffb454' },
    { id: 'seguros',         nombre: 'Seguros / Imprevistos', icon: '🛡️', color: '#8892b0' },
    { id: 'ahorro',          nombre: 'Ahorro e Inversión',    icon: '💰', color: '#22e6a8' },
  ];
  const CAT_MAP = {};
  CATEGORIAS.forEach(function (c) { CAT_MAP[c.id] = c; });

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
    mesesOrdenados().forEach(function (k) {
      (estado.meses[k].movimientos || []).forEach(function (mv) {
        out.push({ mv: mv, mesKey: k });
      });
    });
    out.sort(function (a, b) {
      if (a.mv.fecha !== b.mv.fecha) return a.mv.fecha < b.mv.fecha ? 1 : -1;
      return 0;
    });
    return out;
  }

  // Registra una compra: la suma a la línea acumuladora de la categoría y la anota en el historial
  function registrarCompra(categoria, monto, nota, items) {
    var m = mesData();
    if (!m.gastos) m.gastos = [];
    if (!m.movimientos) m.movimientos = [];
    var accName = nombreAcumulador(categoria);
    var acc = m.gastos.filter(function (g) { return g.categoria === categoria; })
      .find(function (g) { return g.bot || g.nombre === accName; });
    if (acc) { acc.monto = (Number(acc.monto) || 0) + monto; acc.bot = true; }
    else { acc = { id: uid(), categoria: categoria, nombre: accName, monto: monto, bot: true }; m.gastos.push(acc); }
    revisarGastoInusual(categoria, monto);
    m.movimientos.push({ id: uid(), fecha: isoHoyApp(), categoria: categoria, filaId: acc.id, fila: acc.nombre, monto: monto, nota: nota || null, items: items || null });
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
  function chatHablar(texto) {
    if (!chatVozActivada || !texto || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // no superponer con una lectura anterior
    var u = new SpeechSynthesisUtterance(texto);
    u.lang = 'es-AR';
    window.speechSynthesis.speak(u);
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

  // Resumen compacto (no todo el historial) que se manda como contexto a la
  // IA en cada mensaje — solo lo necesario para responder preguntas y
  // comparar contra el mes anterior, sin mandar años de datos innecesarios.
  function contextoFinancieroParaChat() {
    var mAnt = mesAnteriorKey(mesActivo);
    var hayMesAnterior = !!estado.meses[mAnt];
    return {
      mesActivo: mesKeyLabel(mesActivo),
      ingresos: (mesData().ingresos || []).map(function (i) { return { nombre: i.nombre, monto: Number(i.monto) || 0 }; }),
      gastosPorCategoria: gastosPorCategoria(mesActivo),
      totalIngresos: totalIngresos(mesActivo),
      totalGastos: totalGastos(mesActivo),
      balanceDelMes: balanceMes(mesActivo),
      presupuestosPorCategoria: estado.presupuestos || {},
      deudas: (estado.deudas || []).map(function (d) {
        return { nombre: d.nombre, saldo: Number(d.saldo) || 0, cuotaMensual: Number(d.cuotaMensual) || 0, activa: d.activa !== false };
      }),
      mesAnterior: hayMesAnterior ? { nombre: mesKeyLabel(mAnt), totalGastos: totalGastos(mAnt) } : null,
    };
  }

  function chatScrollAbajo() {
    var box = document.getElementById('chatMensajes');
    if (box) box.scrollTop = box.scrollHeight;
  }

  function chatBurbujaHTML(rol, texto) {
    return '<div class="chat-msg chat-msg-' + rol + '">' + escapeHtml(texto).replace(/\n/g, '<br>') + '</div>';
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
      box.innerHTML = '<div class="chat-vacio-icon">✨</div>' +
        '<div class="chat-vacio-saludo">¿Qué necesitás' + (nombre ? ', ' + escapeHtml(nombre) : '') + '?</div>';
      return;
    }
    var ultimoIdx = chatHistorial.length - 1;
    var animar = animarUltimo && chatHistorial[ultimoIdx].rol === 'assistant';
    box.innerHTML = chatHistorial.map(function (m, i) {
      if (animar && i === ultimoIdx) return '<div class="chat-msg chat-msg-assistant" id="chatUltimaResp"></div>';
      return chatBurbujaHTML(m.rol, m.texto);
    }).join('') +
      (chatEnviando ? '<div class="chat-msg chat-msg-assistant chat-typing">Escribiendo…</div>' : '');
    chatScrollAbajo();
    if (animar) {
      var el = document.getElementById('chatUltimaResp');
      if (el) animarTextoChat(el, chatHistorial[ultimoIdx].texto);
    }
  }

  function abrirChat() {
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
    setTimeout(function () { var inp = document.getElementById('chatInput'); if (inp) inp.focus(); }, 150);
  }
  function cerrarChat() { document.getElementById('chatBack').classList.remove('open'); }

  function enviarMensajeChat(texto) {
    texto = texto.trim();
    if (!texto || chatEnviando) return;
    chatHistorial.push({ rol: 'user', texto: texto });
    chatPersistirLog();
    chatEnviando = true;
    renderChatMensajes();
    // Al armar el historial para la IA, mandamos SOLO lo que ella misma dijo
    // (sin el "✅ ..." que agrega el cliente) — si no, la IA ve sus propias
    // confirmaciones viejas en el historial y tiende a repetirlas/recontarlas.
    var historialParaIA = chatHistorial.slice(0, -1).map(function (h) {
      return { rol: h.rol, texto: h.textoIA || h.texto };
    });
    sbClient.functions.invoke('chat-ia', {
      body: { mensaje: texto, historial: historialParaIA, contexto: contextoFinancieroParaChat() }
    }).then(function (res) {
      chatEnviando = false;
      if (res.error || !res.data || res.data.error) {
        chatHistorial.push({ rol: 'assistant', texto: 'No pude responder ahora, intentá de nuevo en un rato.' });
        chatPersistirLog();
        renderChatMensajes(true);
        return;
      }
      // Freno de seguridad: si la IA repite (por error) un gasto que ya se
      // registró en esta conversación, NO lo volvemos a cargar — evita
      // duplicar gastos reales por una confusión del modelo.
      var registrados = (res.data.registrar || []).filter(function (it) {
        var clave = it.categoria + '|' + it.monto + '|' + (it.nota || '');
        if (chatYaRegistrados.indexOf(clave) !== -1) return false;
        chatYaRegistrados.push(clave);
        return true;
      });
      registrados.forEach(function (it) {
        registrarCompra(it.categoria, it.monto, it.nota || null, null);
      });
      if (registrados.length) { guardar(); actualizarCalculos(); }
      var textoIA = res.data.respuesta || '';
      var textoMostrado = textoIA;
      if (registrados.length) {
        textoMostrado += '\n\n✅ ' + registrados.map(function (it) { return fmt(it.monto) + ' en ' + getCatNombre(it.categoria); }).join(', ');
      }
      chatHistorial.push({ rol: 'assistant', texto: textoMostrado, textoIA: textoIA });
      chatPersistirLog();
      renderChatMensajes(true);
      chatHablar(textoIA);
    }).catch(function () {
      chatEnviando = false;
      chatHistorial.push({ rol: 'assistant', texto: 'No pude responder ahora, intentá de nuevo en un rato.' });
      chatPersistirLog();
      renderChatMensajes(true);
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

  // Cambia entre las páginas completas de la app (no apiladas: solo una visible a la vez)
  var PAGINAS = ['resumen', 'gastos', 'deudas', 'historial', 'analiticas'];
  function mostrarPagina(nombre) {
    vistaActual = nombre;
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
  }

  // Solo recalcula números y gráficos (sin re-dibujar listas: no pierde el foco al tipear)
  function actualizarCalculos() {
    renderKPIs(false);
    renderDonut(false);
    renderEvolucion(false);
    document.getElementById('gastosTotal').textContent = fmt(totalGastos(mesActivo));
    document.getElementById('ingresosTotal').textContent = fmt(totalIngresos(mesActivo));
    // totales por categoría
    var porCat = gastosPorCategoria(mesActivo);
    document.querySelectorAll('.cat-group').forEach(function (el) {
      var cid = el.getAttribute('data-cat');
      var t = el.querySelector('.cat-total');
      if (t) t.textContent = fmt(porCat[cid] || 0);
    });
  }

  function renderKPIs(animate) {
    var host = document.getElementById('kpis');
    if (host.dataset.built !== '1') {
      host.innerHTML =
        kpiSkeleton('cyan', '💵', 'Ingresos', 'kpiIng', 'Total que entra este mes') +
        kpiSkeleton('magenta', '🛒', 'Gastos + cuotas', 'kpiGas', '') +
        kpiSkeleton('primary', '💳', 'Deuda total', 'kpiDeuda', '');
      host.dataset.built = '1';
    }
    updateKPIs(animate);
  }

  function kpiSkeleton(accent, ic, top, id, sub) {
    return '<div class="kpi accent-' + accent + '">' +
      '<div class="k-top"><span class="k-ic">' + ic + '</span>' + top + '</div>' +
      '<div class="k-val" id="' + id + 'Val" data-raw="0">$ 0</div>' +
      '<div class="k-sub" id="' + id + 'Sub">' + sub + '</div></div>';
  }

  function updateKPIs(animate) {
    var ing = totalIngresos(mesActivo);
    var gas = totalGastos(mesActivo);
    var pagadas = cuotasPagadas(mesActivo);   // cuotas que YA marcaste pagadas este mes
    var cuotasTotales = totalCuotasDeuda();    // obligación mensual total (informativo)
    var bal = ing - gas - pagadas;
    var pct = ing > 0 ? Math.round(((gas + pagadas) / ing) * 100) : 0;

    countUp(document.getElementById('kpiIngVal'), ing, animate);
    countUp(document.getElementById('kpiGasVal'), gas + pagadas, animate);
    document.getElementById('kpiGasSub').textContent = fmt(gas) + ' gastos · ' + fmt(pagadas) + ' en cuotas pagadas';
    countUp(document.getElementById('kpiDeudaVal'), totalDeuda(), animate);
    document.getElementById('kpiDeudaSub').textContent = fmt(cuotasTotales) + ' por mes si pagás todas';

    // Hero: balance del mes
    var pos = bal >= 0;
    document.getElementById('heroBalLabel').textContent = pos ? 'Te queda este mes' : 'Te pasaste este mes';
    var heroVal = document.getElementById('heroBalVal');
    heroVal.style.color = pos ? 'var(--pos)' : 'var(--neg)';
    // en déficit mostramos el signo menos: -$ 37.907
    var fmtSigno = function (v) { return (pos ? '' : '-') + fmt(v); };
    countUp(heroVal, Math.abs(bal), animate, fmtSigno);
    document.getElementById('heroBalDelta').innerHTML =
      '<span class="chip ' + (pos ? 'up' : 'down') + '">' + (pos ? '▲' : '▼') + ' ' + pct + '%</span>' +
      '<span class="muted">' + (pos ? 'usado de tus ingresos' : 'gastaste más de lo que entró') + '</span>';
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
      body.innerHTML = '<p class="empty-hint">Todavía no cargaste gastos este mes. Agregalos abajo 👇</p>';
      return;
    }

    var R = 74, C = 2 * Math.PI * R, off = 0, GAP = 1.5;
    var segs = '';
    data.forEach(function (d) {
      var frac = d.v / total;
      var len = Math.max(0.1, frac * C - GAP);
      segs += '<circle cx="95" cy="95" r="' + R + '" fill="none" stroke="' + d.c.color +
        '" stroke-width="18" stroke-linecap="round" stroke-dasharray="' + len + ' ' + (C - len) +
        '" stroke-dashoffset="' + (-off) + '" transform="rotate(-90 95 95)"></circle>';
      off += frac * C;
    });
    var svg = '<svg width="180" height="180" viewBox="0 0 190 190">' + segs +
      '<text x="95" y="88" text-anchor="middle" font-size="11" style="fill:var(--text-mute);font-family:var(--mono);letter-spacing:1px">TOTAL</text>' +
      '<text x="95" y="110" text-anchor="middle" font-size="18" font-weight="700" style="fill:var(--text);font-family:var(--mono)">' + fmtCorto(total) + '</text>' +
      '</svg>';

    var legend = '<div class="legend">';
    data.forEach(function (d, i) {
      var pct = Math.round((d.v / total) * 100);
      legend += '<div class="legend-row" style="animation-delay:' + (0.15 + i * 0.05).toFixed(2) + 's">' +
        '<span class="legend-dot" style="background:' + d.c.color + '"></span>' +
        '<span class="legend-name">' + d.c.icon + ' ' + escapeHtml(getCatNombre(d.c.id)) + '</span>' +
        '<span class="legend-val">' + fmt(d.v) + '</span>' +
        '<span class="legend-pct">' + pct + '%</span></div>';
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
  var evoChartInstance = null;
  function renderEvolucion(animate) {
    var canvas = document.getElementById('evoChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (evoChartInstance) { evoChartInstance.destroy(); evoChartInstance = null; }

    if (evoModo === 'diario') {
      var sd = serieDiariaDelMes();
      if (!sd.movs.length) return;
      var labelsD = [], dataD = [], coloresD = [];
      for (var di = 1; di <= sd.diasEnMes; di++) {
        labelsD.push(String(di));
        dataD.push(sd.totalesPorDia[di]);
        coloresD.push(di === sd.diaPico && sd.totalesPorDia[di] > 0 ? '#ba1a1a' : '#f0b4b4');
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
            x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono',monospace", size: 9 }, maxRotation: 0, autoSkipPadding: 6 } },
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
            borderColor: '#ba1a1a', backgroundColor: 'rgba(186,26,26,.15)', borderWidth: 2.5,
            pointRadius: semanas.map(function (s) { return s.active ? 6 : 4; }), pointHoverRadius: 7,
            pointBackgroundColor: '#ba1a1a', tension: 0.25, fill: true,
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
            x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono',monospace", size: 10 } } },
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
            borderColor: '#16a34a', backgroundColor: 'transparent', borderWidth: 2.5,
            pointRadius: radios, pointHoverRadius: 7, pointBackgroundColor: '#16a34a', tension: 0.25,
          },
          {
            label: 'Gastos', data: serie.map(function (p) { return p.gas; }),
            borderColor: '#ba1a1a', backgroundColor: 'rgba(186,26,26,.12)', borderWidth: 2.5,
            pointRadius: radios, pointHoverRadius: 7, pointBackgroundColor: '#ba1a1a', tension: 0.25, fill: true,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: animate ? { duration: 500 } : false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: "'Inter',sans-serif", size: 12 } } },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y); } } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono',monospace", size: 10 } } },
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
  function renderGastos() {
    var m = mesData();
    document.getElementById('gastosTotal').textContent = fmt(totalGastos(mesActivo));
    var porCat = gastosPorCategoria(mesActivo);
    var body = document.getElementById('gastosBody');
    var html = '<div class="tip">💡 En el monto podés escribir una cuenta y se calcula sola. Ej: escribí <b>200+120</b> y queda <b>320</b>.</div>';
    CATEGORIAS.forEach(function (c) {
      var items = m.gastos.filter(function (g) { return g.categoria === c.id; });
      var colapsada = colapsadas[c.id] ? ' collapsed' : '';
      html += '<div class="cat-group' + colapsada + '" data-cat="' + c.id + '">';
      html += '<div class="cat-head" data-toggle="' + c.id + '">' +
        '<span class="cat-ic">' + c.icon + '</span>' +
        '<span class="cat-name-wrap"><span class="cat-name">' + escapeHtml(getCatNombre(c.id)) + '</span>' +
        '<button class="cat-edit" data-editcat="' + c.id + '" title="Cambiar nombre">✎</button></span>' +
        '<span class="cat-total">' + fmt(porCat[c.id] || 0) + '</span>' +
        '<span class="cat-caret">▾</span></div>';
      html += '<div class="cat-items">';
      items.forEach(function (g) {
        html += itemRowHTML(g.id, g.nombre, g.monto) + metaGastoHTML(g);
      });
      html += '<button class="add-line" data-addgasto="' + c.id + '">＋ Agregar en ' + escapeHtml(getCatNombre(c.id)) + '</button>';
      html += '</div></div>';
    });
    body.innerHTML = html;

    // abrir/cerrar categoría
    body.querySelectorAll('[data-toggle]').forEach(function (el) {
      el.addEventListener('click', function (ev) {
        if (ev.target.closest('input, button')) return;
        var cid = el.getAttribute('data-toggle');
        colapsadas[cid] = !colapsadas[cid];
        el.parentElement.classList.toggle('collapsed');
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
    var html = '<div class="cat-items" style="padding-left:10px">';
    m.ingresos.forEach(function (i) { html += itemRowHTML(i.id, i.nombre, i.monto); });
    html += '<button class="add-line" data-addingreso="1">＋ Agregar ingreso</button></div>';
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
      '<button class="del" title="Eliminar">✕</button></div>';
  }

  // Fecha corta "Lun 22/06" a partir de un ISO YYYY-MM-DD
  function fechaCortaApp(iso) {
    if (!iso) return '';
    var p = iso.split('-'); if (p.length < 3) return '';
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return dias[d.getUTCDay()] + ' ' + p[2] + '/' + p[1];
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
    if (!estado.deudas.length) {
      body.innerHTML = '<p class="empty-hint">No tenés deudas cargadas. 🎉 Si tenés cuotas o préstamos, agregalos con el botón de arriba.</p>';
      return;
    }
    var html = '';
    var totSaldo = 0, totCuota = 0;
    estado.deudas.forEach(function (d) {
      totSaldo += Number(d.saldo) || 0;
      if (d.activa !== false) totCuota += Number(d.cuotaMensual) || 0;
      var pill = '', prog = '';
      if (d.cuotaActual && d.cuotaTotal) {
        var terminada = d.cuotaActual >= d.cuotaTotal;
        pill = '<span class="cuota-pill' + (terminada ? ' done' : '') + '">' + d.cuotaActual + '/' + d.cuotaTotal + '</span>';
        var p = Math.min(100, Math.round((d.cuotaActual / d.cuotaTotal) * 100));
        prog = '<div class="mini-progress"><span style="width:' + p + '%"></span></div>';
      }
      var finalizada = d.cuotaActual && d.cuotaTotal && d.cuotaActual >= d.cuotaTotal;
      var pagada = deudaPagadaEnMes(d.id, mesActivo);
      var accion = pagada
        ? '<span class="pagado-chip">✓ Pagado</span><button class="revert-btn" data-revertir="' + d.id + '" title="Revertir pago">↩ Revertir</button>'
        : '<button class="pay-btn" data-pagar="' + d.id + '"' + (finalizada ? ' disabled' : '') + '>Registrar pago</button>';
      html += '<div class="deuda-card' + (pagada ? ' pagada' : '') + '" data-id="' + d.id + '">' +
        '<div class="deuda-card-top">' +
          '<div class="deuda-card-title"><span class="d-name">' + escapeHtml(d.nombre) + '</span>' + pill + '</div>' +
          '<div class="deuda-card-icons">' +
            '<button class="d-edit" data-editdeuda="' + d.id + '" title="Editar">✎</button>' +
            '<button class="del" data-deldeuda="' + d.id + '" title="Eliminar">✕</button>' +
          '</div>' +
        '</div>' +
        prog +
        '<div class="deuda-card-bottom">' +
          '<div class="deuda-card-nums">' +
            '<span class="deuda-saldo">' + fmt(d.saldo) + '</span>' +
            '<span class="deuda-permes">' + fmt(d.cuotaMensual) + '<small>/mes</small></span>' +
          '</div>' +
          '<div class="deuda-card-accion">' + accion + '</div>' +
        '</div>' +
      '</div>';
    });
    html += '<div class="deuda-total-row"><span>Total</span>' +
      '<span class="deuda-saldo">' + fmt(totSaldo) + '</span>' +
      '<span class="deuda-permes">' + fmt(totCuota) + '<small>/mes</small></span></div>';
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

    var totalFiltrado = lista.reduce(function (s, r) { return s + (Number(r.mv.monto) || 0); }, 0);
    document.getElementById('historialTotal').textContent = lista.length
      ? (lista.length + (lista.length === 1 ? ' registro · ' : ' registros · ') + fmt(totalFiltrado))
      : '';

    if (!lista.length) {
      body.innerHTML = '<p class="empty-hint">No hay movimientos que coincidan. Cargá una compra desde <b>＋ Agregar gasto</b> o desde el bot de Telegram y aparecen acá 📲</p>';
      return;
    }
    var html = '<table class="hist-table"><tbody>';
    lista.forEach(function (r) {
      var mv = r.mv;
      var c = CAT_MAP[mv.categoria] || { icon: '•', nombre: mv.categoria };
      var desc = mv.fila || mv.nota || (mv.items && mv.items.length ? mv.items.map(function (i) { return i.nombre; }).join(', ') : 'Compra');
      var sub = [];
      if (mv.nota && mv.nota !== desc) sub.push(escapeHtml(mv.nota));
      if (mv.items && mv.items.length > 1) sub.push(escapeHtml(mv.items.map(function (i) { return i.nombre; }).join(' · ')));
      var detItems = sub.length ? '<span class="h-items">' + sub.join(' — ') + '</span>' : '';
      html += '<tr data-mv="' + mv.id + '" data-mes="' + r.mesKey + '">' +
        '<td class="h-fecha">' + fechaCortaApp(mv.fecha) + '</td>' +
        '<td class="h-cat" title="' + escapeAttr(getCatNombre(mv.categoria)) + '"><span class="h-ic">' + c.icon + '</span></td>' +
        '<td class="h-desc"><b>' + escapeHtml(desc) + '</b>' + detItems + '</td>' +
        '<td class="h-monto num">' + fmt(mv.monto) + '</td>' +
        '<td class="h-del"><button class="del" data-delmov="' + mv.id + '" data-delmes="' + r.mesKey + '" title="Eliminar del historial">✕</button></td>' +
        '</tr>';
    });
    html += '</tbody></table>';
    body.innerHTML = html;
    body.querySelectorAll('[data-delmov]').forEach(function (b) {
      b.addEventListener('click', function () { eliminarMovimiento(b.getAttribute('data-delmov'), b.getAttribute('data-delmes')); });
    });
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
    renderFlujoCaja();
    renderGastoDias();
    renderPresupuestos();
    renderSimulador();
    renderUltimosMovimientos();
    renderRecurrentes();
    renderEficiencia();
    renderPendientes();
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
    body.innerHTML = lista.map(function (g) {
      return '<div class="rec-row"><span class="rec-nombre">' + escapeHtml(g.nombre) + '</span>' +
        '<span class="rec-monto">' + fmt(g.monto) + '</span></div>';
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
    var color = score >= 7 ? 'var(--pos)' : (score >= 4.5 ? 'var(--amber)' : 'var(--neg)');
    document.getElementById('eficienciaBody').innerHTML =
      '<div class="eficiencia-ic">📈</div>' +
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
      document.querySelectorAll('.bottom-nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-page') === 'deudas'); });
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
          { label: 'Ingresos', data: ingresos, backgroundColor: '#16a34a', borderRadius: 4, maxBarThickness: 22 },
          { label: 'Gastos', data: gastos, backgroundColor: '#ba1a1a', borderRadius: 4, maxBarThickness: 22 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', align: 'start', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { family: "'Inter',sans-serif", size: 12 } } },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.dataset.label + ': ' + fmt(ctx.parsed.y); } } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono',monospace", size: 10 } } },
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
      colores.push(i === s.diaPico && s.totalesPorDia[i] > 0 ? '#ba1a1a' : '#f0b4b4');
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
          x: { grid: { display: false }, ticks: { font: { family: "'JetBrains Mono',monospace", size: 9 }, maxRotation: 0, autoSkipPadding: 6 } },
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
    var definidos = 0;
    var html = '';
    CATEGORIAS.forEach(function (c) {
      var gastado = porCat[c.id] || 0;
      var budget = Number(presupuestos[c.id]) || 0;
      var claseExtra = '', contenido;
      if (budget > 0) {
        definidos++;
        var pct = Math.min(100, Math.round((gastado / budget) * 100));
        claseExtra = gastado > budget ? ' over' : (pct >= 80 ? ' near' : '');
        contenido = '<div class="budget-top"><span class="budget-ic">' + c.icon + '</span>' +
          '<span class="budget-name">' + escapeHtml(getCatNombre(c.id)) + '</span>' +
          '<span class="budget-amounts"><b>' + fmt(gastado) + '</b> / ' + fmt(budget) + '</span></div>' +
          '<div class="budget-bar"><span style="width:' + pct + '%"></span></div>';
      } else {
        contenido = '<div class="budget-top"><span class="budget-ic">' + c.icon + '</span>' +
          '<span class="budget-name">' + escapeHtml(getCatNombre(c.id)) + '</span>' +
          '<span class="budget-empty">+ Definir presupuesto</span></div>';
      }
      html += '<div class="budget-row' + claseExtra + '" data-editpres="' + c.id + '">' + contenido + '</div>';
    });
    document.getElementById('presupuestosBadge').textContent = definidos
      ? (definidos + (definidos === 1 ? ' categoría' : ' categorías') + ' con presupuesto')
      : '';
    body.innerHTML = html;
    body.querySelectorAll('[data-editpres]').forEach(function (el) {
      el.addEventListener('click', function () { modalPresupuesto(el.getAttribute('data-editpres')); });
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
    lista.forEach(function (r) {
      var mv = r.mv;
      var c = CAT_MAP[mv.categoria] || { icon: '•' };
      var desc = mv.fila || mv.nota || 'Compra';
      html += '<div class="mini-mov">' +
        '<span class="mm-ic">' + c.icon + '</span>' +
        '<div class="mm-txt"><b>' + escapeHtml(desc) + '</b><span>' + fechaCortaApp(mv.fecha) +
        (mv.nota && mv.nota !== desc ? ' · ' + escapeHtml(mv.nota) : '') + '</span></div>' +
        '<span class="mm-monto">' + fmt(mv.monto) + '</span>' +
        '</div>';
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

  // Modal para agregar un gasto y mandarlo a la categoría elegida
  function modalGasto(catInicial) {
    var opciones = CATEGORIAS.map(function (c) {
      var sel = (c.id === catInicial) ? ' selected' : '';
      return '<option value="' + c.id + '"' + sel + '>' + c.icon + '  ' + escapeHtml(getCatNombre(c.id)) + '</option>';
    }).join('');
    abrirModal('<h3>Agregar gasto</h3><p class="sub">Se suma solo al total de la categoría que elijas.</p>' +
      '<div class="field"><label>Concepto</label><input id="gNombre" placeholder="Ej: Compra en el super"></div>' +
      '<div class="field-row">' +
        '<div class="field"><label>Monto</label><input id="gMonto" inputmode="text" placeholder="0 (podés escribir 200+120)"></div>' +
        '<div class="field"><label>Categoría</label><select id="gCat">' + opciones + '</select></div>' +
      '</div>' +
      '<div class="modal-actions"><button class="btn btn-ghost" id="mCancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="mOk">Agregar gasto</button></div>');
    document.getElementById('mCancel').onclick = cerrarModal;
    var nombreEl = document.getElementById('gNombre');
    var montoEl = document.getElementById('gMonto');
    nombreEl.focus();
    montoEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('mOk').click(); });
    document.getElementById('mOk').onclick = function () {
      var nombre = nombreEl.value.trim();
      var monto = evalMonto(montoEl.value);
      var cat = document.getElementById('gCat').value;
      if (!monto) { montoEl.focus(); return; }
      var acc = registrarCompra(cat, monto, nombre || null, nombre ? [{ nombre: nombre, monto: monto }] : null);
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
    document.getElementById('mNube').onclick = modoCuenta ? function () {
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
    } : modalNube;
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
    // FAB de acciones rápidas: un toque despliega 3 opciones (gasto, ingreso,
    // nuevo mes) con una animación, en vez de ir directo a "nuevo mes".
    var fabWrap = document.getElementById('fabWrap');
    var fabBackdrop = document.getElementById('fabBackdrop');
    function fabAbierto(v) {
      fabWrap.classList.toggle('open', v);
      if (fabBackdrop) fabBackdrop.classList.toggle('show', v);
    }
    document.getElementById('fabToggle').onclick = function () { fabAbierto(!fabWrap.classList.contains('open')); };
    if (fabBackdrop) fabBackdrop.onclick = function () { fabAbierto(false); };
    document.getElementById('fabGasto').onclick = function () { fabAbierto(false); modalGasto(); };
    document.getElementById('fabIngreso').onclick = function () {
      fabAbierto(false);
      mostrarPagina('gastos');
      document.querySelectorAll('.bottom-nav a').forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-page') === 'gastos'); });
      agregarIngresoRapido();
      var sec = document.getElementById('ingresos');
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    document.getElementById('fabMes').onclick = function () { fabAbierto(false); nuevoMes(); };
    document.getElementById('menuBtn').onclick = modalMenu;
    document.getElementById('heroBackup').onclick = modalMenu;
    document.getElementById('heroAddGasto').onclick = function () { modalGasto(); };
    document.getElementById('addDeudaBtn').onclick = function () { modalDeuda(); };
    document.getElementById('exportarAnaliticasBtn').onclick = exportar;
    document.getElementById('verHistorialBtn').onclick = function () {
      var link = document.querySelector('[data-page="historial"]');
      document.querySelectorAll('.bottom-nav a').forEach(function (x) { x.classList.toggle('active', x === link); });
      mostrarPagina('historial');
    };

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
    document.getElementById('chatFab').onclick = abrirChat;
    document.getElementById('chatClose').onclick = cerrarChat;
    document.getElementById('chatBack').addEventListener('click', function (e) {
      if (e.target === this) cerrarChat();
    });
    (function () {
      var inp = document.getElementById('chatInput');
      function enviarYLimpiar() { enviarMensajeChat(inp.value); inp.value = ''; }
      document.getElementById('chatSendBtn').onclick = enviarYLimpiar;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') enviarYLimpiar(); });
    })();
    var chatHistorialBtn = document.getElementById('chatHistorialBtn');
    if (chatHistorialBtn) chatHistorialBtn.onclick = chatToggleHistorialVista;
    var chatVozBtn = document.getElementById('chatVozToggle');
    if (chatVozBtn) {
      var chatVozIcon = chatVozBtn.querySelector('.material-symbols-outlined');
      function chatVozActualizarIcono() {
        chatVozBtn.classList.toggle('muted', !chatVozActivada);
        if (chatVozIcon) chatVozIcon.textContent = chatVozActivada ? 'volume_up' : 'volume_off';
      }
      chatVozActualizarIcono();
      chatVozBtn.onclick = function () {
        chatVozActivada = !chatVozActivada;
        localStorage.setItem('misFinanzas_chatVoz', chatVozActivada ? '1' : '0');
        chatVozActualizarIcono();
        if (!chatVozActivada && window.speechSynthesis) window.speechSynthesis.cancel();
      };
    }
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
    var navLinks = Array.prototype.slice.call(document.querySelectorAll('.bottom-nav a'));
    navLinks.forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        navLinks.forEach(function (x) { x.classList.toggle('active', x === a); });
        mostrarPagina(a.getAttribute('data-page'));
      });
    });

    // filtros de la página de Historial
    ['histFiltroMes', 'histFiltroCat'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', function () { renderHistorial(); });
    });
    var histBuscar = document.getElementById('histBuscar');
    if (histBuscar) histBuscar.addEventListener('input', function () { renderHistorial(); });

    iniciarAuth(); // no hace nada si es el archivo local (file://)
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
