// Service worker: precaches the app shell, question bank and every question
// image so practice and exams work offline after the first load.
// __VERSION__ and __PRECACHE__ are filled in by scripts/build-dist.mjs.
const CACHE = 'lulus-kpp-3235b99217';
const PRECACHE = [
  "./",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/icon.svg",
  "./assets/img/l-anak-panah.svg",
  "./assets/img/l-hijau.svg",
  "./assets/img/l-jingga.svg",
  "./assets/img/l-merah.svg",
  "./assets/img/m-belok-kiri.svg",
  "./assets/img/m-ikut-kiri.svg",
  "./assets/img/m-jalan-sehala.svg",
  "./assets/img/m-jalan-terus.svg",
  "./assets/img/m-kekal-kiri.svg",
  "./assets/img/m-mana-mana-hala.svg",
  "./assets/img/p-berat-dilarang-memotong.svg",
  "./assets/img/p-berhenti.svg",
  "./assets/img/p-dilarang-belok-kanan.svg",
  "./assets/img/p-dilarang-belok-kiri.svg",
  "./assets/img/p-dilarang-berhenti.svg",
  "./assets/img/p-dilarang-hon.svg",
  "./assets/img/p-dilarang-letak.svg",
  "./assets/img/p-dilarang-masuk.svg",
  "./assets/img/p-dilarang-memotong.svg",
  "./assets/img/p-dilarang-pusing-balik.svg",
  "./assets/img/p-had-berat.svg",
  "./assets/img/p-had-laju-110.svg",
  "./assets/img/p-had-laju-50.svg",
  "./assets/img/p-had-laju-90.svg",
  "./assets/img/p-had-laju-tamat.svg",
  "./assets/img/p-had-lebar.svg",
  "./assets/img/p-kawasan-kemalangan.svg",
  "./assets/img/r-berkembar-terus.svg",
  "./assets/img/r-chevron.svg",
  "./assets/img/r-garisan-putus.svg",
  "./assets/img/r-kuning-melintang.svg",
  "./assets/img/r-kuning-tepi.svg",
  "./assets/img/r-lintasan-belang.svg",
  "./assets/img/r-petak-kuning.svg",
  "./assets/img/r-terus-dan-putus.svg",
  "./assets/img/w-bahaya-lain.svg",
  "./assets/img/w-bengkang-bengkok.svg",
  "./assets/img/w-berhenti-hadapan.svg",
  "./assets/img/w-beri-laluan-hadapan.svg",
  "./assets/img/w-bonggol.svg",
  "./assets/img/w-bulatan.svg",
  "./assets/img/w-dua-hala.svg",
  "./assets/img/w-jalan-sempit.svg",
  "./assets/img/w-lampu-isyarat.svg",
  "./assets/img/w-pejalan-kaki.svg",
  "./assets/img/w-pucuk-rebong.svg",
  "./assets/img/w-selekoh-berkembar.svg",
  "./assets/img/w-selekoh-kanan.svg",
  "./assets/img/w-selekoh-kiri.svg",
  "./assets/img/w-simpang-empat.svg",
  "./assets/img/w-simpang-kanan.svg",
  "./assets/img/w-simpang-kiri.svg",
  "./assets/img/w-simpang-t.svg",
  "./css/app.css",
  "./data/questions.json",
  "./index.html",
  "./js/app.js",
  "./js/attempt.js",
  "./js/config.js",
  "./js/rng.js",
  "./js/scoring.js",
  "./js/selection.js",
  "./js/storage.js",
  "./manifest.webmanifest"
];

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
