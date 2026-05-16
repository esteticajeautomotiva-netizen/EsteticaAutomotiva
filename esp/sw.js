// ============================================================
// SERVICE WORKER — J&E Estética Automotiva (ESP PWA)
// ============================================================
const CACHE_NAME = 'je-esp-v1';
const BASE       = '/EsteticaAutomotiva';

const ASSETS = [
  `${BASE}/esp/`,
  `${BASE}/esp/index.html`,
  `${BASE}/esp/manifest.json`,
  `${BASE}/specialist.html`,
  `${BASE}/login.html`,
  `${BASE}/css/vars.css`,
  `${BASE}/css/admin.css`,
  `${BASE}/js/firebase-config.js`,
  `${BASE}/js/cloudinary.js`,
  `${BASE}/js/auth.js`,
  `${BASE}/js/specialist.js`,
  `${BASE}/icons/icon-192-esp.png`,
  `${BASE}/icons/icon-512-esp.png`
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS).catch(err => {
        console.warn('[SW-ESP] Alguns assets falharam no cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url  = new URL(e.request.url);
  const path = url.pathname;

  if (url.hostname !== location.hostname) return;

  // ✅ Serve specialist.html para qualquer acesso à raiz do scope
  if (path === `${BASE}/esp/` || path === `${BASE}/esp/index.html`) {
    e.respondWith(
      caches.match(`${BASE}/specialist.html`)
        .then(cached => cached || fetch(`${BASE}/specialist.html`))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const toCache = response.clone(); // clona ANTES de usar
            caches.open(CACHE_NAME).then(c => c.put(e.request, toCache));
          }
          return response;
        })
        .catch(() => cached || caches.match(`${BASE}/esp/index.html`));

      return cached || network;
    })
  );
});
