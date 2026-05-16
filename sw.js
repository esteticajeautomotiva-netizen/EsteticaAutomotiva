// ============================================================
// SERVICE WORKER — J&E Estética Automotiva (CLIENTE PWA)
// Scope: /EsteticaAutomotiva/  (raiz — apenas arquivos do cliente)
// ============================================================
const CACHE_NAME = 'je-cliente-v5';
const BASE       = '/EsteticaAutomotiva';

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/login.html`,
  `${BASE}/manifest.json`,
  `${BASE}/css/vars.css`,
  `${BASE}/css/client.css`,
  `${BASE}/js/firebase-config.js`,
  `${BASE}/js/cloudinary.js`,
  `${BASE}/js/client.js`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS).catch(err => {
        console.warn('[SW-CLIENTE] Alguns assets falharam no cache:', err);
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

  // Deixa Firebase, Cloudinary e externos passarem direto
  if (url.hostname !== location.hostname) return;

  // NÃO intercepta rotas das subpastas adm/ e esp/
  // (cada uma tem seu próprio SW com scope dedicado)
  if (path.startsWith(`${BASE}/adm/`) || path.startsWith(`${BASE}/esp/`)) return;

  // Estratégia: cache primeiro, atualiza em background
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
        .catch(() => cached || caches.match(`${BASE}/index.html`));

      return cached || network;
    })
  );
});
