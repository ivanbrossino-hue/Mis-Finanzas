/* ===========================================================
   Mis Finanzas — Asistente (pantalla de voz, elegir voz y reproductor)
   Capa visual y de audio sobre el chat que ya vive en app.js: no guarda
   datos ni toca la sincronización. Habla con app.js a través de
   window.MisFinanzas (puente mínimo) y le ofrece window.MFAsis.
   =========================================================== */
(function () {
  'use strict';
  var MF = window.MisFinanzas;
  if (!MF) return;

  function $(id) { return document.getElementById(id); }
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  var VOCES = {
    '1': { titulo: 'Voz 1 · Mujer', desc: 'Cálida y clara, con acento porteño', nombre: 'Voz 1' },
    '2': { titulo: 'Voz 2 · Hombre', desc: 'Tranquila y amigable, con acento porteño', nombre: 'Voz 2' }
  };
  var FRASE_MUESTRA = 'Hola, soy tu asistente. Contame qué gastaste y lo anoto.';

  // ---------- Estado real (no hay temporizadores falsos) ----------
  var vistaActual = null;       // 'voz' | 'elegir' | 'chat' | null (cerrado)
  var vistaAntesDeElegir = 'voz';
  var micActivo = false;        // reconocimiento de voz escuchando de verdad
  var esperandoIA = false;      // se mandó el mensaje y todavía no llegó la respuesta
  var hablando = false;         // está sonando audio (respuesta)
  var hablandoMuestra = false;  // está sonando la muestra en "Elige una voz"
  var vozElegidaPreview = MF.getVoz();
  var reconocimiento = null;
  var textoFinal = '';
  var textoParcial = '';

  function estadoOrbe() {
    if (hablando) return 'hablando';
    if (micActivo || esperandoIA) return 'escuchando';
    return 'idle';
  }

  function aplicarClasesOrbe(btn, estado, voz) {
    if (!btn) return;
    btn.classList.remove('idle', 'escuchando', 'hablando', 'v1', 'v2');
    btn.classList.add(estado, 'v' + voz);
  }

  function refrescarOrbe() {
    var est = estadoOrbe();
    aplicarClasesOrbe($('orbBtn'), est, MF.getVoz());
    aplicarClasesOrbe($('orbPickBtn'), hablandoMuestra ? 'hablando' : 'idle', vozElegidaPreview);
    var mic = $('vMicBtn'); if (mic) { mic.classList.toggle('on', micActivo); mic.setAttribute('aria-pressed', micActivo ? 'true' : 'false'); }
    var st = $('orbStatus');
    if (st) {
      if (hablando) st.textContent = 'Hablando… tocá el círculo para que se calle';
      else if (micActivo) st.textContent = 'Te escucho…';
      else if (esperandoIA) st.textContent = 'Pensando…';
      else if (!st.getAttribute('data-fijo')) st.textContent = SR ? 'Tocá el círculo o el micrófono para hablar' : 'Este navegador no permite dictado: escribile al asistente';
    }
  }
  function fijarEstado(texto) { // mensaje puntual (error, aviso) hasta el próximo cambio real
    var st = $('orbStatus');
    if (!st) return;
    if (texto) { st.setAttribute('data-fijo', '1'); st.textContent = texto; }
    else st.removeAttribute('data-fijo');
  }
  function mostrarTextoVoz(t) { var el = $('orbText'); if (el) el.textContent = t || ''; }

  // ---------- Vistas ----------
  function mostrarVista(v) {
    vistaActual = v;
    var back = $('chatBack');
    $('vConv').classList.toggle('on', v === 'voz');
    $('vElegir').classList.toggle('on', v === 'elegir');
    $('chatPanel').classList.toggle('on', v === 'chat');
    back.classList.toggle('modo-chat', v === 'chat');
    if (v !== 'voz' && micActivo) detenerMic(true);
    if (v === 'voz') { fijarEstado(null); refrescarOrbe(); setTimeout(function () { var o = $('orbBtn'); if (o) o.focus(); }, 60); }
    if (v === 'elegir') { vozElegidaPreview = MF.getVoz(); pintarSelector(); }
    if (v === 'chat') setTimeout(function () { var i = $('chatInput'); if (i) i.focus(); }, 150);
  }

  // ---------- Reconocimiento de voz ----------
  function iniciarMic() {
    if (!SR) { MF.toast('Tu navegador no permite dictado por voz.'); mostrarVista('chat'); return; }
    if (micActivo || esperandoIA || MF.estaEnviando()) return;
    cancelarAudio();
    desbloquearAudio();
    textoFinal = ''; textoParcial = '';
    mostrarTextoVoz('');
    fijarEstado(null);
    var rec = new SR();
    rec.lang = 'es-AR';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = function () { micActivo = true; refrescarOrbe(); };
    rec.onresult = function (e) {
      var fin = '', parc = '';
      for (var i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) fin += e.results[i][0].transcript;
        else parc += e.results[i][0].transcript;
      }
      textoFinal = fin; textoParcial = parc;
      mostrarTextoVoz((fin + ' ' + parc).trim());
    };
    rec.onerror = function (e) {
      var err = e && e.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') fijarEstado('Permitime usar el micrófono para poder escucharte.');
      else if (err === 'no-speech') fijarEstado('No te escuché. Probá de nuevo.');
      else if (err === 'audio-capture') fijarEstado('No encuentro un micrófono.');
      else if (err && err !== 'aborted') fijarEstado('No pude escucharte (' + err + ').');
    };
    rec.onend = function () {
      micActivo = false;
      reconocimiento = null;
      var dicho = (textoFinal || textoParcial).trim();
      textoFinal = ''; textoParcial = '';
      if (dicho && vistaActual === 'voz') enviarDictado(dicho);
      else refrescarOrbe();
    };
    reconocimiento = rec;
    try { rec.start(); } catch (e) { reconocimiento = null; micActivo = false; refrescarOrbe(); }
  }

  // descartar = true cuando se cierra la vista: no se manda lo que se alcanzó a decir
  function detenerMic(descartar) {
    if (!reconocimiento) return;
    if (descartar) { textoFinal = ''; textoParcial = ''; try { reconocimiento.abort(); } catch (e) {} }
    else { try { reconocimiento.stop(); } catch (e) {} }
  }

  function enviarDictado(texto) {
    esperandoIA = true;
    refrescarOrbe();
    MF.enviarMensaje(texto, function (textoIA) {
      esperandoIA = false;
      if (textoIA === null) { fijarEstado('No pude responder ahora, intentá de nuevo en un rato.'); mostrarTextoVoz(''); }
      else mostrarTextoVoz(textoIA); // queda a la vista aunque la lectura en voz alta esté apagada
      refrescarOrbe();
    }, { modo: 'voz' });
  }

  // ---------- Reproductor: frases en cola, ElevenLabs con respaldo del navegador ----------
  var ticket = 0;           // sube cada vez que se corta el audio: lo que quedó en cola se descarta
  var audioDesbloqueado = false;
  var audioEl = null;       // un solo <audio> reutilizado: iOS y Chrome lo desbloquean una vez
  var SILENCIO_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';

  // iOS y Chrome solo dejan sonar audio después de un toque del usuario: se desbloquea al primero
  function desbloquearAudio() {
    if (audioDesbloqueado) return;
    audioDesbloqueado = true;
    try {
      if (window.speechSynthesis) {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch (e) {}
    try {
      audioEl = audioEl || new Audio();
      audioEl.src = SILENCIO_WAV;
      var p = audioEl.play();
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        var ctx = new AC();
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        window.MFAudioCtx = ctx;
      }
    } catch (e) {}
  }
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, function once() { desbloquearAudio(); document.removeEventListener(ev, once, true); }, true);
  });

  // ---------- Números en español (la voz los pronuncia bien solo si van en palabras) ----------
  var NUM_U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
    'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
  var NUM_D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  var NUM_C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
  function menorMil(n) { // 1..999
    if (n === 100) return 'cien';
    var c = Math.floor(n / 100), r = n % 100, s = [];
    if (c) s.push(NUM_C[c]);
    if (r) {
      if (r < 30) s.push(NUM_U[r]);
      else { var d = Math.floor(r / 10), u = r % 10; s.push(NUM_D[d] + (u ? ' y ' + NUM_U[u] : '')); }
    }
    return s.join(' ');
  }
  function apocopar(t) { return t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un'); } // "veintiún mil", "treinta y un millones"
  function enteroALetras(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'cero';
    if (n >= 1e12) return String(n).split('').join(' ');   // fuera de rango: dígito por dígito
    var millones = Math.floor(n / 1e6), resto = n % 1e6, miles = Math.floor(resto / 1000), unidades = resto % 1000, partes = [];
    if (millones) partes.push(millones === 1 ? 'un millón' : apocopar(enteroALetras(millones)) + ' millones');
    if (miles) partes.push(miles === 1 ? 'mil' : apocopar(menorMil(miles)) + ' mil');
    if (unidades) partes.push(menorMil(unidades));
    return partes.join(' ');
  }
  // "177.700" -> 177700 · "1.234,50" -> 1234.5 (formato argentino: punto de miles, coma decimal)
  function leerNumeroAR(s) { return parseFloat(String(s).replace(/\./g, '').replace(',', '.')); }
  function numeroALetras(s) {
    s = String(s);
    var coma = s.indexOf(',');
    var ent = leerNumeroAR(coma >= 0 ? s.slice(0, coma) : s);
    if (!isFinite(ent)) return s;
    var txt = enteroALetras(ent);
    if (coma >= 0) {
      var dig = s.slice(coma + 1).replace(/\D/g, '');
      if (dig) {
        var v = parseInt(dig, 10);
        txt += ' coma ' + (dig.charAt(0) === '0' ? 'cero' + (v ? ' ' + enteroALetras(v) : '') : enteroALetras(v));
      }
    }
    return txt;
  }  function montoALetras(s) {
    var v = leerNumeroAR(s);
    if (!isFinite(v)) return s;
    var entero = Math.floor(v), cent = Math.round((v - entero) * 100);
    var txt = (entero === 1 ? 'un peso' : enteroALetras(entero) + (entero >= 1e6 && entero % 1e6 === 0 ? ' de pesos' : ' pesos'));
    if (cent > 0) txt += ' con ' + enteroALetras(cent) + ' centavos';
    return txt;
  }

  // Texto pensado para leerse: sin links, markdown ni "Fuentes", y con TODOS los números en palabras
  // (se hace antes de partir en frases, así nunca se corta un número por el punto de los miles)
  function textoParaVoz(t) {
    t = String(t || '').split(/\n\s*Fuentes:/i)[0];
    t = t.replace(/https?:\/\/\S+/g, '');
    t = t.replace(/[*_`#>~|]+/g, ' ').replace(/^\s*[-•·]\s+/gm, '').replace(/[✅🎯📍💳↩️ℹ️⚠️]/g, '');
    t = t.replace(/\$\s*(-?\d+(?:\.\d{3})*(?:,\d+)?)/g, function (m, n) { return ' ' + montoALetras(n) + ' '; });
    t = t.replace(/(\d+(?:\.\d{3})*(?:,\d+)?)\s*%/g, function (m, n) { return ' ' + numeroALetras(n) + ' por ciento '; });
    t = t.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, function (m) { return m.replace(/\//g, ' '); }); // fechas 9/10 -> "9 10"
    // "uno" cambia según la palabra que sigue: "veintiún días", "veintiuna cuotas", "uno" si va solo
    t = t.replace(/\b\d{1,3}(?:\.\d{3})+(?:,\d+)?\b|\b\d+,\d+\b|\b\d+\b/g, function (n, off, todo) {
      var w = numeroALetras(n);
      if (/uno$/.test(w) && n.indexOf(',') === -1) {
        var sig = todo.slice(off + n.length).match(/^\s+([a-záéíóúñ]+)/i);
        if (sig) w = /^(cuotas?|semanas?|veces|vez|deudas?|tarjetas?|categor[ií]as?|filas?|compras?|personas?|horas?|unidades|unidad)$/i.test(sig[1]) ? w.replace(/uno$/, 'una') : apocopar(w);
      }
      return w;
    });
    t = t.replace(/\/(mes|día|dia|semana|año|ano)\b/gi, ' por $1');
    t = t.replace(/\$/g, ' pesos ').replace(/&/g, ' y ');
    t = t.replace(/\s+/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/\(\s+/g, '(');
    return t.trim();
  }

  // Frases cortas: suenan más naturales, se piden de a una y evitan el corte de las lecturas largas
  function partirFrases(t) {
    var crudas = t.match(/[^.!?…\n]+[.!?…]*\s*/g) || [t];
    var frases = [], acum = '';
    crudas.forEach(function (f) {
      acum += f;
      if (acum.trim().length >= 25) { frases.push(acum.trim()); acum = ''; }
    });
    if (acum.trim()) { if (frases.length) frases[frases.length - 1] += ' ' + acum.trim(); else frases.push(acum.trim()); }
    var out = [];
    frases.forEach(function (f) {
      while (f.length > 220) {
        var corte = f.lastIndexOf(',', 220); if (corte < 60) corte = f.lastIndexOf(' ', 220); if (corte < 60) corte = 220;
        out.push(f.slice(0, corte + 1).trim()); f = f.slice(corte + 1).trim();
      }
      if (f) out.push(f);
    });
    return out;
  }

  // --- Motor de respaldo: voz del navegador (speechSynthesis es-AR) ---
  var vocesNavegador = [];
  function cargarVoces() { if (window.speechSynthesis) vocesNavegador = window.speechSynthesis.getVoices() || []; }
  if (window.speechSynthesis) { cargarVoces(); window.speechSynthesis.addEventListener('voiceschanged', cargarVoces); }
  var MUJER = /helena|sabina|laura|m[oó]nica|paulina|elena|luc[ií]a|sof[ií]a|marisol|zira|female|mujer|google espa/i;
  var HOMBRE = /jorge|diego|pablo|ra[uú]l|juan|carlos|miguel|male|hombre|[aá]lvaro|enrique|david|andr[eé]s/i;
  function elegirVozNavegador(n) {
    var es = vocesNavegador.filter(function (v) { return /^es/i.test(v.lang); });
    if (!es.length) return { voz: null, pitch: n === '2' ? 0.8 : 1.05 };
    var pref = es.slice().sort(function (a, b) {
      function peso(v) { return /es[-_]AR/i.test(v.lang) ? 0 : (/es[-_](419|US|MX)/i.test(v.lang) ? 1 : 2); }
      return peso(a) - peso(b);
    });
    if (n === '2') {
      var h = pref.filter(function (v) { return HOMBRE.test(v.name); })[0];
      if (h) return { voz: h, pitch: 1 };
      return { voz: pref.filter(function (v) { return !MUJER.test(v.name); })[0] || pref[0], pitch: 0.8 };
    }
    var m = pref.filter(function (v) { return MUJER.test(v.name); })[0];
    return { voz: m || pref[0], pitch: m ? 1 : 1.05 };
  }
  function decirConNavegador(frase, vozId, alEmpezar) {
    return new Promise(function (resolve) {
      if (!window.speechSynthesis) { resolve(); return; }
      var sel = elegirVozNavegador(vozId);
      var u = new SpeechSynthesisUtterance(frase);
      u.lang = 'es-AR';
      if (sel.voz) { u.voice = sel.voz; u.lang = sel.voz.lang; }
      u.pitch = sel.pitch; u.rate = vozId === '2' ? 0.97 : 1;
      u.onstart = alEmpezar;
      u.onend = resolve; u.onerror = resolve;
      window.speechSynthesis.speak(u);
    });
  }

  // --- Motor principal: ElevenLabs a través de la Edge Function `tts` ---
  var LIMITE_CREDITOS = 10000;                 // plan gratis de ElevenLabs
  var AVISO_CREDITOS = 8000;                   // 80 %: se avisa que te estás acercando
  var USO_KEY = 'misFinanzas_ttsUso';
  var cacheAudio = {};                         // "voz|frase" -> Blob, solo mientras la pestaña está abierta
  var elevenCaido = false;                     // falló o no está desplegada: respaldo hasta recargar
  var avisosDados = {};
  var abortActual = null;

  function mesClave() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function leerUso() {
    try { var u = JSON.parse(localStorage.getItem(USO_KEY) || 'null'); if (u && u.mes === mesClave()) return u; } catch (e) {}
    return { mes: mesClave(), n: 0 };
  }
  function sumarUso(n) {
    var u = leerUso(); u.n += n;
    try { localStorage.setItem(USO_KEY, JSON.stringify(u)); } catch (e) {}
    pintarUso();
    if (u.n >= LIMITE_CREDITOS) avisarUnaVez('limite', 'Se acabaron los ' + LIMITE_CREDITOS.toLocaleString('es-AR') + ' caracteres de voz premium de este mes. Uso la voz del navegador.');
    else if (u.n >= AVISO_CREDITOS) avisarUnaVez('cerca', 'Ya usaste ' + u.n.toLocaleString('es-AR') + ' de ' + LIMITE_CREDITOS.toLocaleString('es-AR') + ' caracteres de voz premium este mes.');
    return u;
  }
  function pintarUso() {
    var el = $('ajVozUso');
    if (!el) return;
    var u = leerUso();
    el.textContent = 'Voz premium: ' + u.n.toLocaleString('es-AR') + ' de ' + LIMITE_CREDITOS.toLocaleString('es-AR') + ' caracteres usados este mes (en este dispositivo).';
  }
  function avisarUnaVez(clave, texto) {
    var k = clave + mesClave();
    if (avisosDados[k]) return;
    avisosDados[k] = true;
    MF.toast(texto);
  }
  function elevenDisponible() {
    return MF.puedeUsarChat() && !elevenCaido && leerUso().n < LIMITE_CREDITOS;
  }

  // Pide (o recupera de la caché) el audio de UNA frase; rechaza con {codigo} si falla
  function pedirAudio(frase, vozId, senal) {
    var clave = vozId + '|' + frase;
    if (cacheAudio[clave]) return Promise.resolve(cacheAudio[clave]);
    if (leerUso().n + frase.length > LIMITE_CREDITOS) return Promise.reject({ codigo: 'cuota' });
    return MF.ttsFetch({ texto: frase, voz: vozId }, senal).then(function (res) {
      if (!res.ok) {
        return res.json().catch(function () { return {}; }).then(function (j) {
          throw { codigo: (res.status === 429 || (j && j.code === 'quota')) ? 'cuota' : (res.status === 404 ? 'nodisponible' : 'error'), estado: res.status };
        });
      }
      return res.blob().then(function (blob) {
        if (!blob || !blob.size) throw { codigo: 'error' };
        cacheAudio[clave] = blob;   // la misma frase (por ejemplo la muestra) no gasta créditos de nuevo
        sumarUso(frase.length);
        return blob;
      });
    });
  }

  function tocarBlob(blob, alEmpezar) {
    return new Promise(function (resolve, reject) {
      audioEl = audioEl || new Audio();
      var url = URL.createObjectURL(blob);
      function limpiar() { audioEl.onplaying = audioEl.onended = audioEl.onerror = null; URL.revokeObjectURL(url); }
      audioEl.onplaying = function () { audioEl.onplaying = null; alEmpezar(); };
      audioEl.onended = function () { limpiar(); resolve(); };
      audioEl.onerror = function () { limpiar(); reject({ codigo: 'audio' }); };
      audioEl.src = url;
      var p = audioEl.play();
      if (p && p.catch) p.catch(function (e) { limpiar(); reject({ codigo: 'reproduccion', detalle: e }); });
    });
  }

  function reproducirFrasesNavegador(frases, vozId, alEmpezarCada, alTerminar, mio) {
    var i = 0;
    function siguiente() {
      if (mio !== ticket) return;
      if (i >= frases.length) { if (alTerminar) alTerminar(); return; }
      decirConNavegador(frases[i++], vozId, function () { if (mio === ticket) alEmpezarCada(); }).then(siguiente);
    }
    siguiente();
  }

  // ElevenLabs: se pide la frase siguiente mientras suena la anterior, para que hable fluido
  function reproducirFrasesEleven(frases, vozId, alEmpezarCada, alTerminar, mio) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    abortActual = ctrl;
    var pedidos = [];
    function pedir(i) {
      if (i < frases.length && !pedidos[i]) {
        pedidos[i] = pedirAudio(frases[i], vozId, ctrl ? ctrl.signal : undefined);
        pedidos[i].catch(function () {}); // el error se maneja cuando le toca reproducirse
      }
      return pedidos[i];
    }
    var i = 0;
    function siguiente() {
      if (mio !== ticket) return;
      if (i >= frases.length) { if (alTerminar) alTerminar(); return; }
      var idx = i++;
      pedir(idx); pedir(idx + 1);
      pedidos[idx].then(function (blob) {
        if (mio !== ticket) return null;
        return tocarBlob(blob, function () { if (mio === ticket) alEmpezarCada(); }).then(function () { return 'ok'; });
      }).then(function (r) { if (r === 'ok') siguiente(); }, function (err) {
        if (mio !== ticket) return;
        if (err && err.name === 'AbortError') return;
        // Falló ElevenLabs: lo que falta se lee con la voz del navegador y se avisa (una vez)
        var cuota = err && err.codigo === 'cuota';
        elevenCaido = true; // no se vuelve a intentar hasta recargar (si era cuota, seguiría fallando)
        // Si la función `tts` todavía no está desplegada (404) se cae a la voz del navegador sin molestar con avisos
        if (!(err && err.codigo === 'nodisponible')) {
          avisarUnaVez(cuota ? 'cuota' : 'caida', cuota
            ? 'Se acabó la cuota de voz premium: uso la voz del navegador.'
            : 'La voz premium no está disponible ahora: uso la del navegador.');
        }
        reproducirFrasesNavegador(frases.slice(idx), vozId, alEmpezarCada, alTerminar, mio);
      });
    }
    siguiente();
  }

  // Reproduce el texto frase por frase; si algo corta (ticket distinto) se abandona
  function reproducir(texto, vozId, alEmpezarCada, alTerminar) {
    cancelarAudio();
    var mio = ++ticket;
    var frases = partirFrases(textoParaVoz(texto));
    if (!frases.length) { if (alTerminar) alTerminar(); return; }
    if (elevenDisponible()) reproducirFrasesEleven(frases, vozId, alEmpezarCada, alTerminar, mio);
    else reproducirFrasesNavegador(frases, vozId, alEmpezarCada, alTerminar, mio);
  }

  // Corta todo: audio que suena, pedidos pendientes y frases en cola
  function cancelarAudio() {
    ticket++;
    if (abortActual) { try { abortActual.abort(); } catch (e) {} abortActual = null; }
    if (audioEl) { try { audioEl.onplaying = audioEl.onended = audioEl.onerror = null; audioEl.pause(); audioEl.removeAttribute('src'); audioEl.load(); } catch (e) {} }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    var estabaHablando = hablando || hablandoMuestra;
    hablando = false; hablandoMuestra = false;
    if (estabaHablando) refrescarOrbe();
  }

  // Lo que app.js usa cada vez que el asistente responde (o que se toca "Escuchar")
  MF.registrarVoz({
    hablar: function (texto, alTerminar) {
      esperandoIA = false;
      reproducir(texto, MF.getVoz(), function () { hablando = true; refrescarOrbe(); }, function () {
        hablando = false; refrescarOrbe();
        if (alTerminar) alTerminar();
      });
      refrescarOrbe();
    },
    cancelar: cancelarAudio
  });

  // ---------- Toques ----------
  function tocarOrbe() {
    desbloquearAudio();
    if (hablando) { cancelarAudio(); return; }          // cortar el audio
    if (micActivo) { detenerMic(false); return; }        // terminó de hablar: se manda
    if (esperandoIA) return;
    iniciarMic();
  }

  // ---------- Elegir una voz ----------
  function pintarSelector() {
    var v = VOCES[vozElegidaPreview];
    $('vPickNombre').textContent = v.titulo;
    $('vPickDesc').textContent = v.desc;
    $('dot1Btn').firstElementChild.classList.toggle('on', vozElegidaPreview === '1');
    $('dot2Btn').firstElementChild.classList.toggle('on', vozElegidaPreview === '2');
    refrescarOrbe();
  }
  function elegirPreview(n) {
    if (vozElegidaPreview === n) return;
    cancelarAudio();
    vozElegidaPreview = n;
    pintarSelector();
  }
  function tocarMuestra() {
    desbloquearAudio();
    if (hablandoMuestra) { cancelarAudio(); return; }
    reproducir(FRASE_MUESTRA, vozElegidaPreview, function () { hablandoMuestra = true; refrescarOrbe(); }, function () { hablandoMuestra = false; refrescarOrbe(); });
  }

  // ---------- API para app.js ----------
  window.MFAsis = {
    pintarUso: pintarUso,
    alAbrir: function (vista) {
      // Al tocar la burbuja se abre primero el chat de texto (con el micrófono al lado de la escritura
      // para pasar a la pantalla de voz); la voz solo se abre si se pide a propósito
      var v = vista === 'voz' ? 'voz' : 'chat';
      if (v === 'voz' && !SR) v = 'chat';
      esperandoIA = false; hablando = false; hablandoMuestra = false; micActivo = false;
      mostrarTextoVoz('');
      this.alCambiarVoz(MF.getVoz());
      mostrarVista(v);
    },
    alCerrar: function () {
      detenerMic(true);
      cancelarAudio();
      esperandoIA = false;
      vistaActual = null;
      $('vConv').classList.remove('on'); $('vElegir').classList.remove('on'); $('chatPanel').classList.remove('on');
      $('chatBack').classList.remove('modo-chat', 'open');
    },
    alCambiarVoz: function (n) {
      vozElegidaPreview = n;
      var nom = $('chatVozNombre'); if (nom) nom.textContent = VOCES[n].nombre;
      var mini = $('chatMini'); if (mini) mini.classList.toggle('v2', n === '2');
      refrescarOrbe();
      if (vistaActual === 'elegir') pintarSelector();
    }
  };

  // ---------- Conexión de botones ----------
  function iniciar() {
    // En pantallas anchas el asistente es una ventana flotante: tocar afuera la cierra
    $('chatBack').addEventListener('click', function (e) { if (e.target === this) MF.cerrar(); });
    $('orbBtn').onclick = tocarOrbe;
    $('vMicBtn').onclick = function () { desbloquearAudio(); if (micActivo) detenerMic(false); else iniciarMic(); };
    $('vTecladoBtn').onclick = function () { cancelarAudio(); mostrarVista('chat'); };
    $('vCerrarBtn').onclick = function () { MF.cerrar(); };
    $('vozLeerBtn').onclick = function () { MF.setVozActivada(!MF.vozActivada()); };
    $('vozElegirBtn').onclick = function () { vistaAntesDeElegir = 'voz'; mostrarVista('elegir'); };
    $('chatWhoBtn').onclick = function () { vistaAntesDeElegir = 'chat'; mostrarVista('elegir'); };
    $('vElegirVolver').onclick = function () { cancelarAudio(); mostrarVista(vistaAntesDeElegir); };
    $('orbPickBtn').onclick = tocarMuestra;
    $('dot1Btn').onclick = function () { elegirPreview('1'); };
    $('dot2Btn').onclick = function () { elegirPreview('2'); };
    $('vUsarBtn').onclick = function () { cancelarAudio(); MF.setVoz(vozElegidaPreview); mostrarVista(vistaAntesDeElegir); };
    // En el chat de texto, el micrófono pasa a la pantalla de voz (si el navegador puede dictar)
    var cm = $('chatMicBtn');
    if (cm) {
      if (!SR) cm.style.display = 'none';
      else cm.onclick = function () { desbloquearAudio(); mostrarVista('voz'); };
    }
    if (!SR) { var t = $('vTecladoBtn'); if (t) t.style.display = 'none'; }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && vistaActual) { e.stopPropagation(); MF.cerrar(); }
    });
    MFAsis_ready();
    pintarUso();
  }
  function MFAsis_ready() { window.MFAsis.alCambiarVoz(MF.getVoz()); }

  // app.js inicia en DOMContentLoaded; este archivo se carga después, así que su
  // listener corre una vez que app.js ya conectó sus botones (y puede pisarlos).
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
