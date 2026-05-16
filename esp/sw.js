// ============================================================
// SERVICE WORKER — J&E Estética Automotiva (ESP PWA)
// Scope: /EsteticaAutomotiva/esp/
// ============================================================
const CACHE_NAME = 'je-esp-v2';
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
        // Remove apenas caches antigos do ESP
        keys.filter(k => k.startsWith('je-esp-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url  = new URL(e.request.url);
  const path = url.pathname;

  // Deixa externos passarem direto (Firebase, Cloudinary, Google Fonts etc.)
  if (url.hostname !== location.hostname) return;

  // ✅ CHAVE: /esp/ e /esp/index.html → serve specialist.html real
  if (path === `${BASE}/esp/` || path === `${BASE}/esp/index.html`) {
    e.respondWith(
      caches.match(`${BASE}/specialist.html`)
        .then(cached => cached || fetch(`${BASE}/specialist.html`)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(c => c.put(`${BASE}/specialist.html`, response.clone()));
            }
            return response;
          })
        )
    );
    return;
  }

  // Estratégia: cache primeiro, rede em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const toCache = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, toCache));
          }
          return response;
        })
        .catch(() => cached || caches.match(`${BASE}/specialist.html`));

      return cached || network;
    })
  );
});
