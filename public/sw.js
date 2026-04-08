/* Basic app-shell service worker for pulp. */
const CACHE_NAME = 'pulp-shell-v1';

const APP_SHELL = [
  '/',
  '/pricing',
  '/explore',
  '/build',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.ico',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? Promise.resolve() : caches.delete(k))))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          // Cache same-origin navigations and static assets opportunistically.
          try {
            const url = new URL(req.url);
            if (url.origin === self.location.origin && (req.mode === 'navigate' || url.pathname.startsWith('/_next/'))) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
            }
          } catch {
            // ignore
          }
          return res;
        })
        .catch(() => cached || fetch(req));
    })
  );
});

