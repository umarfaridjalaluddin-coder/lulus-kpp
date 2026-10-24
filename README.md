# Lulus KPP

Malaysian KPP theory practice app in Bahasa Melayu: chapter practice with instant explanations, a timed **Simulasi KPP Gabungan** mock exam (70 questions, 75 minutes, pass 56/70), full answer review and saved progress. Installable PWA that works offline after the first load. No account or backend; everything is stored in the browser.

> Aplikasi latihan bebas. Tidak berafiliasi dengan atau disahkan oleh JPJ.

## Run it

**Quickest (already built):**

```bash
cd dist/pwa
python3 -m http.server 8080
# open http://localhost:8080 on your computer or phone (same Wi-Fi: http://<computer-ip>:8080)
```

The service worker (offline mode and install) needs `localhost` or HTTPS.

**Live site (GitHub Pages):** https://umarfaridjalaluddin-coder.github.io/lulus-kpp/ — served from the `docs/` folder on `main`. On a phone, open it and choose *Add to Home Screen* / *Install app*.

**Deploy elsewhere:** upload the contents of `docs/` (same as `dist/pwa/`) to any static HTTPS host.

`dist/artifact/index.html` is the same app as one self-contained file (no service worker, so no offline install). It is the version published as the Claude artifact.

## Rebuild after changes

Requires Node.js 18+ (no npm install needed).

```bash
node scripts/images.mjs       # draw road-sign / marking SVGs  -> app/assets/img, content/images.json
node scripts/build-bank.mjs   # validate + build question bank -> app/data/questions.json, reports/question-bank.csv
node scripts/build-dist.mjs   # build dist/pwa (with service worker), dist/artifact, and copy the PWA to docs/ for GitHub Pages
node --test tests/logic.test.mjs   # 14 logic tests
# browser tests (needs Playwright + Chromium):
cd dist/pwa && python3 -m http.server 8765 &   # then:
node tests/e2e.mjs http://127.0.0.1:8765/ ./shots   # 73 checks at 390×844
```

`build-bank.mjs` fails on duplicate IDs, missing sections/pages, unknown sources or images, missing image files, wrong option counts, duplicate options, near-duplicate questions, a distribution that does not sum to 70, or a chapter with too few eligible questions.

## Edit content

- **Questions:** `content/bank/bab1.mjs` … `bab6.mjs`. Write the correct answer first in `o`; the build assigns stable option IDs (`a`–`d`) and a shuffled stored order. Every question needs `sec` (book section) and `pg` (page). Add `web: ['KEY']` when a changeable fact was checked online (keys in `content/sources.json`). Set `status: 'excluded'` with a `note` to keep a question out of every scored test.
- **Exam format:** `app/js/config.js` → `EXAM_CONFIG`. Bump `version` and update `source.verifiedOn` when you change it. The per-chapter `practiceDistribution` is this app's own balance, not an official JPJ quota.
- **Images:** `scripts/images.mjs`.

## Structure

```
app/                 source PWA (no build step needed to run it from a server)
  js/config.js       versioned exam configuration
  js/selection.js    question selection (chapter balance, vehicle mix, avoid recent)
  js/scoring.js      scoring (stable option IDs, no negative marking)
  js/attempt.js      attempt state, absolute deadline timer, idempotent submit
  js/storage.js      localStorage persistence with in-memory fallback
  js/app.js          user interface
  data/questions.json  generated, versioned question bank
content/             question source files, sources registry, image catalogue
scripts/             image, bank and dist builders
tests/               unit + browser tests
reports/question-bank.csv  every question with section, page, answer, sources (for review)
SOURCES.md           sources, verification dates, conflicts, content status
```

## Behaviour notes

- Each exam stores the exact questions, answer key, option order and config it used, so later content updates never change past results.
- The timer uses a saved absolute deadline: refreshing or closing does not pause it. If the app is reopened after the deadline, the exam is submitted with the saved answers and the original deadline.
- Submission is idempotent: double taps, a timeout racing a manual submit, or a reload mid-submit still produce one result.
- Practice statistics are kept separate from mock-exam statistics.
