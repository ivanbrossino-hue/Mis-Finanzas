// Service Worker de "Mis Finanzas" — solo cachea el cascarón estático (HTML/CSS/JS
// propios) para que la app abra al toque e instale como PWA en Android/iPhone.
// Todo lo demás (Supabase, Google Fonts, Tailwind CDN) pasa directo a la red: no
// queremos servir datos ni sesiones viejas desde caché.
//
// IMPORTANTE: subí CACHE_VERSION cada vez que cambies este archivo o la lista de
// ASSETS — si no, los navegadores que ya instalaron la PWA pueden seguir viendo
// una versión vieja del cascarón por un rato.
const CACHE_VERSION = 'v46';
const CACHE_NAME = 'mis-finanzas-' + CACHE_VERSION;
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=22',
  './app.js?v=34',
  './datos-iniciales.js',
  './manifest.json',
  './logo.png',
  './chat-logo.png',
  './icons/shortcut-gasto.png',
  './icons/shortcut-ingreso.png',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) { return cache.addAll(ASSETS); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

// ---- Web Push: mostrar la notificación que mandó enviar-notificacion ----
self.addEventListener('push', function (event) {
  var datos = {};
  try { datos = event.data ? event.data.json() : {}; } catch (e) {}
  var titulo = datos.titulo || 'Mis Finanzas';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || '',
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      data: { url: datos.url || './' },
      tag: datos.tag || undefined,
    })
  );
});

// Al tocar la notificación: si ya hay una pestaña de la app abierta, la enfoca
// en vez de abrir una nueva.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (lista) {
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].url.indexOf(location.origin) === 0 && 'focus' in lista[i]) return lista[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', function (event) {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // CDNs, Supabase: siempre a la red

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      const red = fetch(event.request).then(function (res) {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copia); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || red;
    })
  );
});
