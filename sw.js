const CACHE_NAME = 'je-cliente-v2';
const BASE = '/EsteticaAutomotiva';
const ASSETS = [
  `${BASE}/index.html`,
  `${BASE}/login.html`,
  `${BASE}/manifest.json`,
  `${BASE}/vars.css`,
  `${BASE}/client.css`,
  `${BASE}/firebase-config.js`,
  `${BASE}/cloudinary.js`,
  `${BASE}/auth.js`,
  `${BASE}/client.js`,
  `${BASE}/icon-192.png`,
  `${BASE}/icon-512.png`
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firestore.googleapis.com') || url.includes('identitytoolkit') || url.includes('cloudinary.com') || url.includes('googleapis.com') || url.includes('gstatic.com')) return;
  e.respondWith(caches.match(e.request).then(cached => {
    const network = fetch(e.request).then(r => { if (r && r.status === 200 && r.type === 'basic') caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone())); return r; }).catch(() => cached || caches.match(`${BASE}/index.html`));
    return cached || network;
  }));
});
