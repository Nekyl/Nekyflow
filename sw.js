// sw.js — PWA Service worker (network-first for dev, cache fallback)
const CACHE_NAME = 'nekyflow-v8';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // JS, CSS, HTML — network-first (fresh code > cached)
  if (url.pathname.match(/\.(js|css|html)$/) || url.pathname === '/') {
    e.respondWith(
      fetch(e.request)
        .then(networkRes => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          }
          return networkRes;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Images, icons, manifest — cache-first (fast, rarely changes)
  if (url.pathname.match(/\.(png|jpg|svg|ico|webmanifest|woff2?|ttf)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
    return;
  }

  // Everything else — network-first
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
