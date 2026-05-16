// ============================================================
// SERVICE WORKER — J&E Estética Automotiva (ADM PWA)
// Scope: /EsteticaAutomotiva/adm/
// ============================================================
const CACHE_NAME = 'je-adm-v2';
const BASE       = '/EsteticaAutomotiva';

const ASSETS = [
  `${BASE}/adm/`,
  `${BASE}/adm/index.html`,
  `${BASE}/adm/manifest.json`,
  `${BASE}/admin.html`,
  `${BASE}/login.html`,
  `${BASE}/css/vars.css`,
  `${BASE}/css/admin.css`,
  `${BASE}/js/firebase-config.js`,
  `${BASE}/js/cloudinary.js`,
  `${BASE}/js/auth.js`,
  `${BASE}/js/admin.js`,
  `${BASE}/icons/icon-192-adm.png`,
  `${BASE}/icons/icon-512-adm.png`
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS).catch(err => {
        console.warn('[SW-ADM] Alguns assets falharam no cache:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        // Remove apenas caches antigos do ADM, não do cliente ou ESP
        keys.filter(k => k.startsWith('je-adm-') && k !== CACHE_NAME)
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

  // ✅ CHAVE: /adm/ e /adm/index.html → serve admin.html real
  if (path === `${BASE}/adm/` || path === `${BASE}/adm/index.html`) {
    e.respondWith(
      caches.match(`${BASE}/admin.html`)
        .then(cached => cached || fetch(`${BASE}/admin.html`)
          .then(response => {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(c => c.put(`${BASE}/admin.html`, response.clone()));
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
        .catch(() => cached || caches.match(`${BASE}/admin.html`));

      return cached || network;
    })
  );
});
