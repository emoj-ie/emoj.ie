const CACHE_NAME = 'emojie-3df3e19d5161370d';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/about/',
  '/about/index.html',
  '/style.css',
  '/generated-pages.js',
  '/home-app.mjs',
  '/home-utils.mjs',
  '/grouped-openmoji.json',
  '/favicon.ico',
  '/logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isEmojiAsset(url) {
  return (
    url.pathname.startsWith('/assets/emoji/base/') ||
    (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/openmoji/') && url.pathname.endsWith('.svg'))
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (isEmojiAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;

        return fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() =>
            new Response('Emoji asset unavailable offline', {
              status: 503,
              statusText: 'Service Unavailable',
            })
          );
      })
    );
    return;
  }

  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
          .catch(() => cached || caches.match('/index.html'));

        return cached || networkFetch;
      })
    );
  }
});
