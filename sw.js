const VERSION = 'v1.2.1';
const CACHE = 'mosaed-pwa-' + VERSION;
const FONT_CACHE = 'mosaed-fonts-v1';
const CORE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './storage.js',
  './icon-192.png',
  './icon-512.png',
  './maskable-192.png',
  './maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
  './pdfjs-lib.b64',
  './pdfjs-worker.b64'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('mosaed-pwa-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // خطوط Google: تُخزَّن عند أول تحميل وتعمل بعدها بدون إنترنت
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(FONT_CACHE).then((c) =>
        c.match(req).then((hit) => {
          const net = fetch(req).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone());
            return res;
          }).catch(() => hit);
          return hit || net;
        })
      )
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // التنقّل: الصفحة المخزّنة فورًا مع تحديثها من الشبكة في الخلفية
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match('./index.html').then((hit) => {
        const net = fetch(new Request('./index.html', { cache: 'no-cache' })).then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
          return res;
        });
        if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
        return net;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // باقي الملفات: من الكاش، ثم الشبكة مع تحديث الكاش
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) {
        fetch(req).then((res) => {
          if (res && res.ok) caches.open(CACHE).then((c) => c.put(req, res));
        }).catch(() => {});
        return hit;
      }
      return fetch(req).then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      });
    })
  );
});
