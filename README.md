# Lulus KPP: Jalan ke Lesen

A mobile-first Malaysian KPP driving-theory learning game in Bahasa Melayu. Choose a car or motorcycle, drive along animated Malaysian roads, stop at checkpoints to answer KPP questions, learn from each explanation, and take a timed **Simulasi KPP Gabungan** mock exam (70 questions, 75 minutes, pass 56/70).

It is an educational quiz with driving-themed animation, not a driving-skills assessment. Installable PWA, works offline after the first load, no account; progress is stored in the browser.

> Aplikasi latihan bebas. Tidak berafiliasi dengan atau disahkan oleh JPJ.

**Live site:** https://umarfaridjalaluddin-coder.github.io/lulus-kpp/ (served from `docs/` on `main`). On a phone, open it and choose *Add to Home Screen* / *Install app*.

## What's in it

- **Mod Pengembaraan** – 6 chapters split into 40 stages of about 10 questions. The vehicle drives between checkpoints; at each stop answer cards deal in once, the player selects (a small vehicle marker moves beside the choice), confirms with *Sahkan Jawapan*, sees *Betul!* or *Belum tepat* with the explanation and source, then taps *Teruskan*. 10 XP for a correct **first** attempt only; no speed bonus, no lives, stages can be replayed. Badges, chapter progress, XP-unlocked vehicle colours and scenery unlocks.
- **Latihan Bebas** – any chapter or mixed, Semua / Motokar / Motosikal / Topik bersama, 10 / 20 / all, animation on or off, bookmarks, mistakes review.
- **Simulasi Ujian KPP** – calm static screen, 70 unique questions, absolute-deadline timer, previous/next, flags, question navigator, answer changes, results only after submission. Pass: the vehicle arrives at a destination gate; not yet: it stops at a learning checkpoint with a *Latih topik lemah* button.
- **Visual questions** – 54 sign/marking/traffic-light images, 22 picture-answer questions (pick the sign, light, marking or junction path), 48 diagrams (junction arrows, safe following distance, highlighted car/motorcycle components). Every visual has a text equivalent.
- **Settings** – animation on/off, reduced motion (follows the device by default), sound (off by default), haptics, text size.

## Run locally

```bash
cd docs            # or dist/pwa after a build
python3 -m http.server 8080
# open http://localhost:8080
```

The service worker (offline + install) needs `localhost` or HTTPS.

## Rebuild after changes

Requires Node.js 18+ (no npm install needed).

```bash
node scripts/images.mjs       # draw sign / marking SVGs  -> app/assets/img, content/images.json
node scripts/build-bank.mjs   # validate + build question bank -> app/data/questions.json, reports/question-bank.csv
node scripts/build-dist.mjs   # dist/pwa (+ service worker), dist/artifact (single file), copy PWA to docs/
node --test tests/logic.test.mjs tests/game.test.mjs   # 23 unit tests
# browser acceptance tests (Playwright + Chromium):
cd dist/pwa && python3 -m http.server 8765 &
node tests/e2e.mjs http://127.0.0.1:8765/ ./shots     # 79 checks at 390×844
```

`build-bank.mjs` fails on duplicate IDs, missing sections/pages, unknown sources/images/captions, invalid diagram specs, wrong option counts, duplicate options, near-duplicate questions, a distribution that does not sum to 70, or a chapter with too few eligible questions.

## Edit content

- **Questions:** `content/bank/babN.mjs`; picture-answer questions in `babN-gambar.mjs` (`oi` = option images, `od` = option diagrams; the correct one first). Every question needs `sec` and `pg`; add `web: ['KEY']` for facts checked online; `status: 'excluded'` + `note` keeps it out of scored modes.
- **Question diagrams:** `content/visuals.mjs` (a diagram must never reveal the answer).
- **Picture captions:** `content/captions.mjs` (describe the picture, never its meaning).
- **Exam format:** `app/js/config.js` → `EXAM_CONFIG` (versioned, with source and verification dates).

## Structure

```
app/js/config.js     exam format (versioned) + chapter/topic names
app/js/selection.js  exam selection (chapter balance, vehicle mix, no repeated picture) + practice filters
app/js/scoring.js    scoring by stable option IDs, no negative marking
app/js/attempt.js    exam attempt state, absolute deadline, idempotent submit
app/js/progress.js   stages, first-attempt accuracy, XP, badges, cosmetics, settings
app/js/storage.js    localStorage with in-memory fallback
app/js/visuals.js    junction / distance / component diagrams (SVG)
app/js/scene.js      animated road scene and vehicles (canvas)
app/js/app.js        user interface
content/             question sources, captions, diagram map, sources registry
reports/question-bank.csv   every question with section, page, answer, sources
SOURCES.md           sources, verification dates, conflicts, content status
```

Animations follow quiz state only; they never decide or change answers or scores. Completed exams store their own questions, answer key and config, so content updates never change past results.
