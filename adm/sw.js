// ============================================================
// SERVICE WORKER — J&E Estética Automotiva (ADM PWA)
// ============================================================
const CACHE_NAME = 'je-adm-v1';
const BASE       = '/EsteticaAutomotiva';

// Arquivos que o ADM PWA precisa para funcionar offline
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
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url  = new URL(e.request.url);
  const path = url.pathname;

  // Deixa o Firebase e Cloudinary passarem direto (sem cache)
  if (url.hostname !== location.hostname) return;

  // ✅ CHAVE: quando o PWA abre /EsteticaAutomotiva/adm/ ou /adm/index.html,
  // o SW serve o admin.html real — sem redirecionar, sem sair do scope
  if (path === `${BASE}/adm/` || path === `${BASE}/adm/index.html`) {
    e.respondWith(
      caches.match(`${BASE}/admin.html`)
        .then(cached => cached || fetch(`${BASE}/admin.html`))
    );
    return;
  }

  // Estratégia: cache primeiro, atualiza em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            caches.open(CACHE_NAME).then(c => c.put(e.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached || caches.match(`${BASE}/adm/index.html`));

      return cached || network;
    })
  );
});
