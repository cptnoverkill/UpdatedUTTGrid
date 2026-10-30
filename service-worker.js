// UTTData service worker
// Bump CACHE whenever you deploy new files so devices pick up the update.
const CACHE = 'uttdata-v4';
const CDN_THREE = 'https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js';
const PRECACHE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './three.min.js'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // Add files one by one so a single missing file can't block installation.
      .then(cache => Promise.all(PRECACHE.map(url => cache.add(url).catch(err => console.warn('Precache skipped:', url, err)))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // App page: network first so updates arrive, cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  // Backup copy of the 3D engine from the CDN: keep it for offline use.
  if (req.url === CDN_THREE) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Other same-origin files: serve from cache, refresh in the background.
  event.respondWith(
    caches.match(req).then(hit => {
      const network = fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || network;
    })
  );
});
