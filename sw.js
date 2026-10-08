/* Ritual service worker — offline-first shell.
   Network is optional. Cross-origin requests are never hijacked by the offline fallback. */
const CACHE = 'ritual-v5';
const ASSETS = [
  './',
  './index.html',
  './ritual-v2.js',
  './sw.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './brand/ritual-mark.svg',
  './brand/ritual-wordmark.svg'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        ASSETS.map(function (asset) {
          return cache.add(asset).catch(function () {});
        })
      );
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
          return caches.delete(key);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;

  var url = new URL(event.request.url);
  var sameOrigin = url.origin === self.location.origin;

  /* Never turn an unrelated/offline third-party request into index.html. */
  if (!sameOrigin) return;

  /* Navigation: cached app first, then network, then cached app as the offline fallback. */
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).catch(function () {
          return new Response('Ritual is offline. Reopen the installed app.', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=utf-8'}
          });
        });
      })
    );
    return;
  }

  /* Static same-origin assets: cache first, then network, then fail normally. */
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) {
            cache.put(event.request, copy).catch(function () {});
          });
        }
        return response;
      });
    })
  );
});
