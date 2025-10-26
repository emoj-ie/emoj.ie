const CACHE_NAME = 'emojie-v1';
const STATIC_CACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/grouped-openmoji.json',
  '/logo.svg',
  '/favicon.ico',
  '/about/',
  '/about/index.html'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache when offline, cache emoji images on demand
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Handle emoji SVG requests from CDN - cache them when fetched
  if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/openmoji/') && url.pathname.endsWith('.svg')) {
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request)
            .then(response => {
              // Cache successful responses
              if (response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseClone);
                  });
              }
              return response;
            })
            .catch(() => {
              // If offline and not cached, return a placeholder or fallback
              return new Response('Emoji not available offline', {
                status: 503,
                statusText: 'Service Unavailable'
              });
            });
        })
    );
  } else {
    // For other requests, try cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          if (response) {
            return response;
          }
          return fetch(event.request)
            .then(response => {
              // Don't cache external resources that aren't emojis
              if (!response || response.status !== 200 || !response.type === 'basic') {
                return response;
              }

              // Cache same-origin requests
              if (url.origin === location.origin) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => {
                    cache.put(event.request, responseClone);
                  });
              }

              return response;
            })
            .catch(() => {
              // Return offline fallback for HTML pages
              if (event.request.destination === 'document') {
                return caches.match('/index.html');
              }
            });
        })
    );
  }
});
