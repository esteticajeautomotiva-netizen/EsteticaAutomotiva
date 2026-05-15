// ============================================================
// SERVICE WORKER — J&E Estética Automotiva
// ============================================================
const CACHE_NAME = 'je-estetica-v3';

const ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/admin.html',
  '/specialist.html',
  '/manifest.json',
  '/css/vars.css',
  '/css/client.css',
  '/css/admin.css',
  '/js/firebase-config.js',
  '/js/cloudinary.js',
  '/js/auth.js',
  '/js/client.js',
  '/js/admin.js',
  '/js/specialist.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Instala e pré-cacheia os assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Remove caches antigos
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Estratégia: Network first → Cache fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Nunca cacheia Firebase, Cloudinary ou googleapis (dinâmicos)
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
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return response;
      }).catch(() => cached || caches.match('/index.html'));

      // Retorna cache imediatamente se existir; atualiza em background
      return cached || network;
    })
  );
});