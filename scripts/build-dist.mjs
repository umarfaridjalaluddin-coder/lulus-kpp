// Produces:
//   dist/pwa/                 installable, offline-capable PWA (deploy as static files)
//   dist/artifact/index.html  single self-contained page (no service worker)
// Run after: node scripts/images.mjs && node scripts/build-bank.mjs
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { createRequire } from 'node:module';

const ROOT = new URL('../', import.meta.url).pathname;
const APP = join(ROOT, 'app');
const DIST = join(ROOT, 'dist');
rmSync(DIST, { recursive: true, force: true });
mkdirSync(join(DIST, 'pwa'), { recursive: true });
mkdirSync(join(DIST, 'artifact'), { recursive: true });

// ---------- icons (PNG versions are regenerated only when sharp is available) ----------
let sharp = null;
for (const base of [import.meta.url, '/opt/npm-tools/']) { try { sharp = createRequire(base)('sharp'); break; } catch { /* try next */ } }
const iconSvg = readFileSync(join(APP, 'assets/icon.svg'));
if (sharp) {
await sharp(iconSvg).resize(192, 192).png().toFile(join(APP, 'assets/icon-192.png'));
await sharp(iconSvg).resize(512, 512).png().toFile(join(APP, 'assets/icon-512.png'));
const maskable = Buffer.from(String(iconSvg).replace('rx="112"', 'rx="0"'));
await sharp(maskable).resize(512, 512).png().toFile(join(APP, 'assets/icon-maskable-512.png'));
} else console.warn('sharp not found: keeping existing PNG icons');

// ---------- PWA ----------
cpSync(APP, join(DIST, 'pwa'), { recursive: true, filter: (p) => !p.endsWith('sw.template.js') && !p.endsWith('_gallery.html') });
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else files.push(relative(join(DIST, 'pwa'), p)); } };
walk(join(DIST, 'pwa'));
const precache = ['./', ...files.filter((f) => f !== 'sw.js')].map((f) => (f === './' ? f : `./${f}`));
const version = createHash('sha256').update(files.map((f) => readFileSync(join(DIST, 'pwa', f))).join('')).digest('hex').slice(0, 10);
const sw = readFileSync(join(APP, 'sw.template.js'), 'utf8').replace("'lulus-kpp-__VERSION__'", `'lulus-kpp-${version}'`).replace('PRECACHE = __PRECACHE__;', `PRECACHE = ${JSON.stringify(precache, null, 2)};`);
writeFileSync(join(DIST, 'pwa', 'sw.js'), sw);

// ---------- Single-file artifact ----------
// Concatenate ES modules in dependency order, dropping import/export syntax.
const order = ['config.js', 'rng.js', 'scoring.js', 'selection.js', 'attempt.js', 'storage.js', 'app.js'];
let js = '';
for (const f of order) {
  let src = readFileSync(join(APP, 'js', f), 'utf8');
  src = src.replace(/^import[\s\S]*?from\s+'[^']+';\s*$/gm, '');
  src = src.replace(/^export\s+(const|function|async function|let|class)\s/gm, '$1 ');
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`Unhandled module syntax in ${f}`);
  js += `\n// ---- ${f} ----\n${src}`;
}
const data = JSON.parse(readFileSync(join(APP, 'data/questions.json'), 'utf8'));
for (const q of data.questions) {
  if (q.image) {
    const svg = readFileSync(join(APP, q.image.src), 'utf8').trim();
    q.image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
}
const css = readFileSync(join(APP, 'css/app.css'), 'utf8');
const safeJson = JSON.stringify(data).replace(/</g, '\\u003c');
const page = `<title>Lulus KPP</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
${css}
</style>
<div id="app" class="app" lang="ms"><div class="boot" id="boot" role="status"><div class="boot-mark" aria-hidden="true"></div><p>Memuatkan soalan…</p></div></div>
<script>window.__KPP_NO_SW__ = true; window.__KPP_DATA__ = ${safeJson};</script>
<script>
(function () {
${js}
})();
</script>
`;
writeFileSync(join(DIST, 'artifact', 'index.html'), page);
// GitHub Pages serves the PWA from /docs on the main branch.
rmSync(join(ROOT, 'docs'), { recursive: true, force: true });
cpSync(join(DIST, 'pwa'), join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs', '.nojekyll'), '');
console.log(`PWA: ${files.length + 1} files (cache ${version}); artifact: ${(page.length / 1024).toFixed(0)} KB`);
