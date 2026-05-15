// ============================================================
// SERVICE WORKER — J&E Estética Automotiva
// GitHub Pages: /EsteticaAutomotiva/
// ============================================================
const CACHE_NAME  = 'je-estetica-v4';
const BASE        = '/EsteticaAutomotiva';

const ASSETS = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/login.html`,
  `${BASE}/admin.html`,
  `${BASE}/specialist.html`,
  `${BASE}/manifest.json`,
  `${BASE}/css/vars.css`,
  `${BASE}/css/client.css`,
  `${BASE}/css/admin.css`,
  `${BASE}/js/firebase-config.js`,
  `${BASE}/js/cloudinary.js`,
  `${BASE}/js/auth.js`,
  `${BASE}/js/client.js`,
  `${BASE}/js/admin.js`,
  `${BASE}/js/specialist.js`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
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
  const url = e.request.url;

  // Nunca cacheia serviços externos dinâmicos
  if (url.includes('firestore.googleapis.com') ||
      url.includes('identitytoolkit') ||
      url.includes('cloudinary.com') ||
      url.includes('googleapis.com/css') ||
      url.includes('gstatic.com')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(e.request, response.clone()));
        }
        return response;
      }).catch(() => cached || caches.match(`${BASE}/index.html`));

      return cached || network;
    })
  );
});
