// Service worker: precaches the app shell, question bank and every question
// image so practice and exams work offline after the first load.
// __VERSION__ and __PRECACHE__ are filled in by scripts/build-dist.mjs.
const CACHE = 'lulus-kpp-__VERSION__';
const PRECACHE = __PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('lulus-kpp-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Google Fonts: cache after first use; the app falls back to system fonts offline.
  if (url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); c.put(req, res.clone()); return res; } catch { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Question data: network first so updates arrive, cache when offline.
  if (url.pathname.endsWith('/data/questions.json')) {
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).catch(() =>
    req.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
