// Version is auto-detected from index.html meta tag
// Just change the meta tag in index.html and the SW picks it up automatically
const CACHE_VERSION = '2.0.1'; // Fallback version
const CACHE_NAME = 'embarque-' + CACHE_VERSION;
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install: cache core files and detect version from index.html
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    fetch('./index.html', { cache: 'no-store' })
      .then(r => r.text())
      .then(text => {
        const match = text.match(/<meta name="app-version" content="([^"]+)"/);
        const detectedVersion = match ? match[1] : CACHE_VERSION;
        const cacheName = 'embarque-' + detectedVersion;
        return caches.open(cacheName).then(cache => cache.addAll(urlsToCache));
      })
      .catch(() => caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)))
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    fetch('./index.html', { cache: 'no-store' })
      .then(r => r.text())
      .then(text => {
        const match = text.match(/<meta name="app-version" content="([^"]+)"/);
        const currentVersion = match ? match[1] : CACHE_VERSION;
        const currentCacheName = 'embarque-' + currentVersion;
        return caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== currentCacheName) {
                return caches.delete(cacheName);
              }
            })
          );
        });
      })
      .catch(() => {
        // Fallback: just clean caches that don't match fallback
        return caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME) {
                return caches.delete(cacheName);
              }
            })
          );
        });
      })
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML, cache-first for others
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Always fetch index.html from network (no cache)
  if (request.mode === 'navigate' || request.url.endsWith('index.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          // Update cache with fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) return response;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
      .catch(() => {})
  );
});

// Listen for skip waiting message
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
