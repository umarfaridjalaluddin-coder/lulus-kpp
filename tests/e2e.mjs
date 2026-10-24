// End-to-end checks in headless Chromium at phone size.
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/e2e.mjs <baseUrl> <screenshotDir>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const SHOTS = process.argv[3] || './shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });

const KEY = 'lulusKpp.v1.';
const getLS = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY + k);
const setLS = (k, v) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY + k, v]);
async function noOverflow(label) {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`no horizontal overflow: ${label}`, w.sw <= w.iw, `${w.sw} <= ${w.iw}`);
}
async function shot(name) { await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false }); }
async function clickText(text) { await page.getByRole('button', { name: text }).first().click(); }

// ---- Home (new user) ----
await page.goto(BASE);
await page.waitForSelector('.hero');
check('home shows format line', (await page.textContent('.format-chip')).replace(/\s+/g, ' ').includes('70 soalan • 75 minit • Lulus 56/70'));
check('home shows honest empty state', (await page.textContent('main')).includes('Belum ada ujian simulasi yang lengkap'));
check('no revise-mistakes button for new user', !(await page.textContent('main')).includes('Ulang Kaji Soalan Salah'));
await shot('01-home-empty'); await noOverflow('home');

// ---- Exam start ----
await clickText('Mula Ujian Simulasi');
await page.waitForSelector('text=Simulasi ujian Bahagian I');
check('intro explains answers revealed after submit', (await page.textContent('main')).includes('hanya dipaparkan selepas ujian dihantar'));
await shot('02-exam-intro'); await noOverflow('exam intro');
await clickText('Mula Ujian');
await page.waitForSelector('.exam-head');
check('exam shows "Soalan 1 daripada 70"', (await page.textContent('.exam-head .count')).includes('Soalan 1 daripada 70'));
let A = await getLS('activeExam');
check('active exam saved with 70 unique questions', A && A.questionIds.length === 70 && new Set(A.questionIds).size === 70);
check('deadline is 75 minutes after start', A.deadline - A.startedAt === 75 * 60 * 1000);
check('exam screen does not reveal answers', !(await page.$('.feedback')) && !(await page.$('.is-correct')));
await shot('03-exam-question'); await noOverflow('exam question');

// Answer Q1 wrong, then change to correct, then clear and reselect.
const q0 = A.questions[0];
const wrong0 = q0.options.find((o) => o.id !== q0.correct).id;
await page.click(`.opt[data-opt="${wrong0}"]`);
A = await getLS('activeExam');
check('selecting an answer saves it', A.answers[q0.id] === wrong0);
check('selected state is announced', (await page.getAttribute(`.opt[data-opt="${wrong0}"]`, 'aria-checked')) === 'true');
await page.click(`.opt[data-opt="${q0.correct}"]`);
A = await getLS('activeExam');
check('changing an answer updates saved state', A.answers[q0.id] === q0.correct);
await clickText('Kosongkan jawapan');
A = await getLS('activeExam');
check('clearing an answer removes it', A.answers[q0.id] === undefined);
await page.click(`.opt[data-opt="${q0.correct}"]`);
// Flag Q1, go next.
await page.click('[data-act="e-flag"]');
A = await getLS('activeExam');
check('flag saved', A.flags[q0.id] === true);
await clickText('Seterusnya');
check('next goes to question 2', (await page.textContent('.exam-head .count')).includes('Soalan 2 daripada 70'));

// ---- Refresh restores everything ----
const before = await getLS('activeExam');
await page.reload();
await page.waitForSelector('.hero, .exam-head');
if (await page.$('.hero')) await clickText('Sambung Ujian');
await page.waitForSelector('.exam-head');
const after = await getLS('activeExam');
check('refresh keeps question order', JSON.stringify(after.questionIds) === JSON.stringify(before.questionIds));
check('refresh keeps option order', JSON.stringify(after.optionOrder) === JSON.stringify(before.optionOrder));
check('refresh keeps answers & flags', JSON.stringify(after.answers) === JSON.stringify(before.answers) && JSON.stringify(after.flags) === JSON.stringify(before.flags));
check('refresh keeps deadline', after.deadline === before.deadline);
const shownOrder = await page.$$eval('.opt', (els) => els.map((e) => e.dataset.opt));
check('displayed option order matches saved order', JSON.stringify(shownOrder) === JSON.stringify(after.optionOrder[after.questionIds[after.current]]));

// ---- Palette ----
await clickText('Senarai soalan');
await page.waitForSelector('.palette');
check('palette has 70 cells', (await page.$$('.pal')).length === 70);
check('palette marks answered + flagged', !!(await page.$('.pal.answered .flag')));
check('palette marks current', (await page.getAttribute('.pal.current', 'aria-label')).includes('soalan semasa'));
await shot('04-palette'); await noOverflow('palette');
await page.click('.pal[data-i="9"]');
check('palette jumps to question 10', (await page.textContent('.exam-head .count')).includes('Soalan 10 daripada 70'));

// ---- Programmatically answer exactly 56 correct, rest blank, then submit via UI ----
A = await getLS('activeExam');
const answers56 = {};
A.questions.slice(0, 56).forEach((q) => { answers56[q.id] = q.correct; });
await setLS('activeExam', { ...A, answers: answers56 });
await page.reload(); await page.waitForSelector('.hero'); await clickText('Sambung Ujian');
await clickText('Hantar ujian');
await page.waitForSelector('.sheet');
check('submit sheet shows answered/unanswered counts', (await page.textContent('.sheet')).includes('56') && (await page.textContent('.sheet')).includes('14'));
await shot('05-submit-confirm');
await clickText('Kembali ke soalan belum dijawab');
const curIdx = (await getLS('activeExam')).current;
check('return to first unanswered question', curIdx === 56);
await clickText('Hantar ujian');
// Double tap submit.
await page.click('[data-act="e-submit"]');
await page.waitForSelector('.verdict-card');
let hist = await getLS('examHistory');
check('one result saved after submit', hist.length === 1);
let main = (await page.textContent('main')).replace(/\s+/g, ' ');
check('56/70 shows LULUS', main.includes('LULUS') && !main.includes('BELUM LULUS'));
check('result shows "Jawapan betul: 56/70"', main.includes('Jawapan betul: 56/70'));
check('result shows breakdown 56/0/14 and 80.0%', /56\s*Betul/.test(main) && /0\s*Salah/.test(main) && /14\s*Tidak dijawab/.test(main) && main.includes('80.0%'));
check('result shows pass requirement', main.includes('Minimum 56 jawapan betul'));
check('active exam cleared after submit', (await getLS('activeExam')) === null);
await shot('06-result-pass'); await noOverflow('result');
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await shot('06b-result-chapters');

// ---- Review ----
await clickText('Semak Jawapan');
await page.waitForSelector('.review-item');
check('review lists 70 questions', (await page.$$('.review-item')).length === 70);
await page.click('[data-f="unanswered"]');
check('review filter "Tidak Dijawab" shows 14', (await page.$$('.review-item')).length === 14);
check('unanswered shows "Tidak dijawab"', (await page.textContent('.review-item')).includes('Jawapan anda: Tidak dijawab'));
await page.click('[data-f="correct"]');
check('review filter "Betul" shows 56', (await page.$$('.review-item')).length === 56);
await page.click('[data-f="incorrect"]');
check('review filter "Salah" shows empty state', (await page.$$('.review-item')).length === 0);
await page.click('[data-f="all"]');
await shot('07-review'); await noOverflow('review');

// ---- Retry mistakes creates practice, original result untouched ----
await page.click('[data-act="open-result"]');
await page.waitForSelector('.verdict-card');
await clickText('Ulang Kaji Soalan Salah (14)');
await page.waitForSelector('.q-card');
check('retry mistakes opens a 14-question practice', (await page.textContent('.q-count')).includes('daripada 14'));
hist = await getLS('examHistory');
check('original result unchanged by retry', hist.length === 1 && hist[0].result.correct === 56);

// ---- Practice flow ----
const pq = await page.evaluate(() => document.querySelector('.q-text').textContent);
const opts = await page.$$('.opt');
await opts[0].click();
await clickText('Semak Jawapan');
await page.waitForSelector('.feedback');
const fb = await page.textContent('.feedback');
check('practice reveals verdict + explanation + source', /Betul|Salah/.test(fb) && fb.includes('Sumber: Buku KPP 2025'));
check('practice marks correct option with text label', (await page.textContent('.is-correct')).includes('Jawapan betul'));
await shot('08-practice-feedback'); await noOverflow('practice');
await page.click('[data-act="bookmark"]');
check('bookmark saved', (await getLS('bookmarks')).length === 1);
await clickText('Seterusnya');
await clickText('Langkau');
await clickText('Tamat latihan');
await page.waitForSelector('.big-score');
main = (await page.textContent('main')).replace(/\s+/g, ' ');
const vals = await page.$$eval('.stats .stat .v', (els) => els.map((e) => Number(e.textContent)));
check('practice summary betul/salah/tidak dijawab add up to 14', vals.length === 3 && vals[0] + vals[1] + vals[2] === 14 && vals[0] + vals[1] === 1, vals.join('/'));
await shot('09-practice-summary');
const ps = await getLS('practiceStats');
check('practice stats stored separately', ps.sessions >= 1 && ps.answered === 1);

// ---- Practice setup screen ----
await page.click('[data-act="nav"][data-view="practiceSetup"]');
await page.waitForSelector('.choice-list');
await page.check('#ch-5', { force: true });
await page.check('#vehicle-motosikal', { force: true });
const startLabel = await page.textContent('[data-act="practice-start"]');
check('setup filters chapter + vehicle', /Mula latihan: 10 soalan/.test(startLabel));
await page.check('#count-all', { force: true });
const nAll = await page.textContent('[data-act="practice-start"]');
check('"Semua" uses all available', /Mula latihan: 26 soalan/.test(nAll), nAll.trim());
await shot('10-practice-setup'); await noOverflow('practice setup');

// ---- New exam with 55 correct fails; avoids recent questions ----
await page.click('[data-act="nav"][data-view="examIntro"]');
await clickText('Mula Ujian');
await page.waitForSelector('.exam-head');
A = await getLS('activeExam');
const prevIds = new Set(hist[0].questionIds);
const overlap = A.questionIds.filter((id) => prevIds.has(id)).length;
check('new exam draws a fresh set', overlap === 0, `overlap ${overlap}`);
const answers55 = {};
A.questions.forEach((q, i) => { answers55[q.id] = i < 55 ? q.correct : q.options.find((o) => o.id !== q.correct).id; });
await setLS('activeExam', { ...A, answers: answers55 });
await page.reload(); await page.waitForSelector('.hero'); await clickText('Sambung Ujian');
await clickText('Hantar ujian');
await clickText('Hantar sekarang');
await page.waitForSelector('.verdict-card');
main = (await page.textContent('main')).replace(/\s+/g, ' ');
check('55/70 shows BELUM LULUS', main.includes('BELUM LULUS') && main.includes('Jawapan betul: 55/70'));
check('needs-one-more message', main.includes('Anda perlukan 1 lagi jawapan betul'));
await shot('11-result-fail');

// ---- Timeout while open: auto-submits once ----
await clickText('Cuba Ujian Baharu');
await page.waitForSelector('.exam-head');
A = await getLS('activeExam');
await page.click(`.opt[data-opt="${A.questions[A.current].correct}"]`);
A = await getLS('activeExam');
await setLS('activeExam', { ...A, deadline: Date.now() + 1500 });
await page.waitForSelector('.verdict-card', { timeout: 8000 });
await page.waitForTimeout(2500);
hist = await getLS('examHistory');
check('timeout auto-submits exactly once', hist.length === 3 && hist[0].submitReason === 'timeout');
check('timeout result keeps saved answer', hist[0].result.correct === 1);
check('timeout notice shown', (await page.textContent('main')).includes('Masa tamat'));

// ---- Closed past deadline: finalised on reopen ----
await clickText('Cuba Ujian Baharu');
await page.waitForSelector('.exam-head');
A = await getLS('activeExam');
const ans2 = {}; A.questions.slice(0, 3).forEach((q) => { ans2[q.id] = q.correct; });
const page2Deadline = Date.now() - 60_000;
await setLS('activeExam', { ...A, answers: ans2, startedAt: page2Deadline - 75 * 60_000, deadline: page2Deadline });
await page.goto('about:blank');
await page.goto(BASE);
await page.waitForSelector('.verdict-card');
hist = await getLS('examHistory');
check('reopen after deadline finalises with saved answers', hist.length === 4 && hist[0].result.correct === 3 && hist[0].submitReason === 'resume-expired');
check('reopen uses original deadline for time used', hist[0].timeUsedMs === 75 * 60_000);
check('reopen notice shown', (await page.textContent('main')).includes('semasa aplikasi ditutup'));

// ---- Results survive close/reopen; progress screen ----
const ctx2Page = await ctx.newPage();
await ctx2Page.goto(BASE);
await ctx2Page.waitForSelector('.hero');
const homeTxt = (await ctx2Page.textContent('main')).replace(/\s+/g, ' ');
check('home shows latest score, best and count after reopen', homeTxt.includes('3/70') && homeTxt.includes('56/70') && /4\s*Ujian selesai/.test(homeTxt));
check('home shows Ulang Kaji Soalan Salah', homeTxt.includes('Ulang Kaji Soalan Salah'));
await ctx2Page.screenshot({ path: `${SHOTS}/12-home-with-history.png` });
await ctx2Page.click('[data-act="nav"][data-view="progress"]');
await ctx2Page.waitForSelector('.list');
const prog = (await ctx2Page.textContent('main')).replace(/\s+/g, ' ');
check('progress shows pass rate 25%', prog.includes('25%'));
await ctx2Page.screenshot({ path: `${SHOTS}/13-progress.png` });
await ctx2Page.click('[data-act="nav"][data-view="about"]');
check('about has disclaimer', (await ctx2Page.textContent('main')).includes('Aplikasi latihan bebas. Tidak berafiliasi dengan atau disahkan oleh JPJ.'));
await ctx2Page.screenshot({ path: `${SHOTS}/14-about.png` });
await ctx2Page.close();

// ---- Reset with confirmation ----
await page.click('[data-act="nav"][data-view="progress"]');
await page.click('[data-sheet="reset"]');
await page.waitForSelector('.sheet');
await clickText('Batal');
check('reset cancel keeps data', (await getLS('examHistory')).length === 4);
await page.click('[data-sheet="reset"]');
await clickText('Ya, padam semua');
check('reset clears history', (await getLS('examHistory')) === null);

// ---- Offline after first load ----
const swReady = await page.evaluate(async () => { if (!('serviceWorker' in navigator)) return false; const r = await navigator.serviceWorker.ready; return !!r.active; });
check('service worker active', swReady);
await page.reload(); await page.waitForTimeout(800);
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.hero', { timeout: 8000 }).catch(() => {});
check('app loads offline', !!(await page.$('.hero')));
await page.click('[data-act="nav"][data-view="examIntro"]');
await clickText('Mula Ujian');
await page.waitForSelector('.q-figure img, .exam-head');
const imgOk = await page.evaluate(async () => {
  const A = JSON.parse(localStorage.getItem('lulusKpp.v1.activeExam'));
  const withImg = A.questions.filter((q) => q.image).map((q) => q.image.src);
  const r = await Promise.all(withImg.map((s) => fetch(s).then((x) => x.ok).catch(() => false)));
  return r.every(Boolean) && r.length > 0;
});
check('question images available offline', imgOk);
await ctx.setOffline(false);

// ---- Missing image fallback ----
await page.evaluate(() => {
  const A = JSON.parse(localStorage.getItem('lulusKpp.v1.activeExam'));
  A.questions[A.current].image = { id: 'x', src: 'assets/img/does-not-exist.svg', alt: 'Papan tanda ujian' };
  localStorage.setItem('lulusKpp.v1.activeExam', JSON.stringify(A));
});
await page.reload(); await page.waitForSelector('.hero'); await clickText('Sambung Ujian');
await page.waitForSelector('.img-missing', { timeout: 4000 }).catch(() => {});
check('missing image shows a text fallback', !!(await page.$('.img-missing')));

check('no script errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
