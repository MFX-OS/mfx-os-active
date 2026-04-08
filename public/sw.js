var CACHE_NAME = 'mfx-mnpmy15e';
var STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/theme.css',
  '/js/mfx-bundle.d4af8c19.js',
  '/manifest.json'
];

// CDN resources to cache on first use
var CDN_CACHE = 'mfx-cdn-v1';
var CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'www.gstatic.com/firebasejs'
];

// Paths that should NEVER be cached (API, auth, Firestore, etc.)
var NO_CACHE_PATTERNS = [
  '/api/',
  '/__/',
  '/identitytoolkit',
  '/securetoken',
  '/v1/accounts',
  'firestore.googleapis.com',
  'firebaseinstallations.googleapis.com'
];

function shouldCache(url) {
  for (var i = 0; i < NO_CACHE_PATTERNS.length; i++) {
    if (url.indexOf(NO_CACHE_PATTERNS[i]) !== -1) return false;
  }
  return true;
}

function isCDN(url) {
  for (var i = 0; i < CDN_PATTERNS.length; i++) {
    if (url.indexOf(CDN_PATTERNS[i]) !== -1) return true;
  }
  return false;
}

// Install — cache static assets
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(STATIC_ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// Activate — clean old caches (keep CDN cache)
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME && n !== CDN_CACHE; })
          .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — strategy depends on resource type
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url = new URL(e.request.url);

  // CDN resources: Cache-first (fonts, Firebase SDK, libs rarely change)
  if (isCDN(url.href)) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        return fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CDN_CACHE).then(function(cache) {
              cache.put(e.request, clone);
            });
          }
          return response;
        }).catch(function() {
          return new Response('', { status: 503 });
        });
      })
    );
    return;
  }

  // Don't cache cross-origin non-CDN requests
  if (url.origin !== self.location.origin) return;

  // Don't cache API routes, Firebase auth, or Firestore calls
  if (!shouldCache(url.pathname + url.search)) return;

  // Hashed bundle files: Cache-first (immutable)
  if (/mfx-bundle\.[a-f0-9]+\.js$/.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(e.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // HTML navigation: Network-first with offline shell fallback
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').indexOf('text/html') !== -1) {
    e.respondWith(
      fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline — serve cached index.html (SPA routing)
        return caches.match('/index.html').then(function(cached) {
          return cached || new Response(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>MFX OS — Offline</title>' +
            '<style>body{background:#060d14;color:#e0f2fe;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
            '.c{text-align:center}.h{font-size:24px;color:#00e5ff;margin-bottom:12px}.p{color:#94a3b8;font-size:14px}' +
            '.b{margin-top:20px;padding:10px 24px;background:#00e5ff;color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px}</style></head>' +
            '<body><div class="c"><div class="h">MFX OS — Offline</div>' +
            '<div class="p">You appear to be offline. Your data is safe.<br>Reconnect to continue working.</div>' +
            '<button class="b" onclick="location.reload()">Retry</button></div></body></html>',
            { status: 200, headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
    return;
  }

  // All other static assets: Stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      var networkFetch = fetch(e.request).then(function(response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(function() {
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      });

      return cached || networkFetch;
    })
  );
});

// Background sync — queue offline writes
self.addEventListener('sync', function(e) {
  if (e.tag === 'mfx-sync') {
    e.waitUntil(
      // Process queued writes from IndexedDB
      self.clients.matchAll().then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'sync-ready' });
        });
      })
    );
  }
});

// Push notification handler (FCM)
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : { title: 'MFX OS', body: 'New notification' };
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'mfx-push',
      vibrate: [100, 50, 100],
      data: data.data || {}
    })
  );
});

self.addEventListener('notificationclick', function(e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(function(clients) {
      // Focus existing window if available
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf(self.location.origin) !== -1 && 'focus' in clients[i]) {
          return clients[i].focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// Message handler for cache management
self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data && e.data.type === 'CACHE_URLS' && e.source) {
    // Only accept CACHE_URLS from same-origin clients
    var urls = (e.data.urls || []).filter(function(u) {
      try { return new URL(u, self.location.origin).origin === self.location.origin; } catch(_) { return false; }
    });
    if (urls.length) caches.open(CACHE_NAME).then(function(cache) { cache.addAll(urls); });
  }
});
