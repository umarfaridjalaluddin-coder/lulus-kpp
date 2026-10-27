// Browser acceptance checks for Lulus KPP: Jalan ke Lesen (headless Chromium, phone size).
// Usage: node tests/e2e.mjs <baseUrl> <screenshotDir>
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const SHOTS = process.argv[3] || './shots';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); };
const KEY = 'lulusKpp.v1.';

const browser = await chromium.launch();
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) page.errors.push(m.text()); });
  return { ctx, page };
}
const getLS = (page, k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY + k);
const setLS = (page, k, v) => page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY + k, v]);
async function noOverflow(page, label) {
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  check(`no horizontal overflow: ${label}`, w.sw <= w.iw, `${w.sw} <= ${w.iw}`);
}
async function controlsVisible(page, sel, label) {
  const ok = await page.evaluate((sel) => [...document.querySelectorAll(sel)].every((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1; }), sel);
  check(`controls within screen: ${label}`, ok);
}
const shot = (page, n) => page.screenshot({ path: `${SHOTS}/${n}.png` });

// ================================================================ 1. Vehicle choice + full adventure stage
{
  const { ctx, page } = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.home-actions');
  const home = (await page.textContent('main')).replace(/\s+/g, ' ');
  check('home shows honest empty states', home.includes('Belum ada peringkat yang diselesaikan') && home.includes('Belum ada ujian simulasi yang lengkap') && home.includes('0 XP'));
  check('home shows required buttons', ['Mula Pengembaraan', 'Mula Ujian KPP', 'Latihan Mengikut Bab', 'Ulang Kaji Kesilapan'].every((t) => home.includes(t)));
  await noOverflow(page, 'home');
  await shot(page, '01-home');

  await page.click('.notice [data-view="garage"]');
  await page.waitForSelector('.veh-grid');
  check('locked colours cannot be chosen', await page.$eval('[data-c="merah"]', (b) => b.disabled));
  await page.click('[data-act="pick-vehicle"][data-t="motorcycle"]');
  await page.click('[data-act="pick-colour"][data-c="putih"]');
  await noOverflow(page, 'garage');
  await shot(page, '02-garage');
  await page.click('[data-act="save-vehicle"]');
  await page.waitForSelector('.home-actions');
  const game0 = await getLS(page, 'game');
  check('vehicle choice saved', game0.vehicle.type === 'motorcycle' && game0.vehicle.color === 'putih');

  await page.click('[data-act="adventure-continue"]');
  await page.waitForSelector('#play-scene');
  check('vehicle drives to a checkpoint before the question', !!(await page.$('.driving-note')));
  await shot(page, '03-driving');
  await page.waitForSelector('.q-card', { timeout: 6000 });
  check('route progress shows checkpoints', (await page.textContent('.route-label')).startsWith('Titik 1/'));
  const nQ = Number((await page.textContent('.route-label')).split('/')[1]);
  check('stage has about 10 questions', nQ >= 7 && nQ <= 13, String(nQ));
  check('answer cards dealt with animation class', !!(await page.$('.options.deal')));
  await noOverflow(page, 'question');
  await controlsVisible(page, '.confirm-bar .btn', 'play bar');
  await shot(page, '04-question');

  // Change selection before confirmation
  const opts = await page.$$('.options .opt');
  await opts[0].click();
  await opts[1].click();
  const checked = await page.$$eval('.options .opt', (els) => els.filter((e) => e.getAttribute('aria-checked') === 'true').map((e) => e.dataset.opt));
  const id1 = await opts[1].getAttribute('data-opt');
  check('changing selection keeps exactly the latest choice', checked.length === 1 && checked[0] === id1);
  check('vehicle marker moves beside the selected card', await page.$eval('.veh-marker', (m) => m.classList.contains('on')));
  check('Sahkan Jawapan enabled after selecting', await page.$eval('#confirm-btn', (b) => !b.disabled && b.textContent.includes('Sahkan Jawapan')));
  check('cards stay readable (no transform after deal)', await page.evaluate(() => new Promise((r) => setTimeout(() => r([...document.querySelectorAll('.options .opt')].every((o) => { const t = getComputedStyle(o).transform; return t === 'none' || t === 'matrix(1, 0, 0, 1, 0, 0)'; })), 700))));

  // Answer the whole stage: first question with the correct answer, rest alternate.
  let xpExpected = 0;
  for (let i = 0; i < nQ; i++) {
    if (i > 0) await page.waitForSelector('.options.deal', { timeout: 6000 });
    // Look up the correct option from the bank by question ID.
    const ans = await page.evaluate(async () => {
      const data = await (await fetch('data/questions.json')).json();
      const q = data.questions.find((x) => x.id === document.querySelector('.q-card').dataset.qid);
      return { correct: q.correct, wrong: q.options.find((o) => o.id !== q.correct).id };
    });
    const pick = i % 2 === 0 ? ans.correct : ans.wrong;
    await page.click(`.options .opt[data-opt="${pick}"]`);
    await page.click('#confirm-btn');
    await page.waitForSelector('.feedback');
    const fb = await page.textContent('.feedback');
    if (i === 0) {
      check('correct answer shows "Betul!" and explanation with source', fb.includes('Betul!') && fb.includes('Sumber: Buku KPP 2025'));
      check('first correct attempt shows +10 XP', fb.includes('+10 XP'));
      await shot(page, '05-feedback-correct');
    }
    if (i === 1) {
      check('wrong answer shows "Belum tepat" and the correct answer', fb.includes('Belum tepat') && fb.includes('Jawapan betul:'));
      check('correct card is labelled in text, not colour only', (await page.textContent('.opt.is-correct')).includes('Jawapan betul'));
      await shot(page, '06-feedback-wrong');
    }
    if (pick === ans.correct) xpExpected += 10;
    await page.click('#next-btn');
  }
  await page.waitForSelector('.verdict-card');
  const res = (await page.textContent('main')).replace(/\s+/g, ' ');
  const nC = Math.ceil(nQ / 2);
  check('stage result shows counts, time and chapter performance', res.includes(`Jawapan betul: ${nC}/${nQ}`) && res.includes('Masa digunakan') && res.includes('Prestasi mengikut bab'));
  check('stage result shows XP and badge', res.includes(`+${xpExpected} XP`) && res.includes('Langkah Pertama'));
  await shot(page, '07-stage-result');
  await noOverflow(page, 'stage result');
  const game1 = await getLS(page, 'game');
  check('XP saved = 10 × first-attempt correct', game1.xp === xpExpected, `${game1.xp}`);
  check('stage marked complete', Object.values(game1.stages).some((s) => s.completedAt));
  const fa = Object.values(game1.firstAttempts);
  check('first attempts recorded for every question', fa.length === nQ && fa.filter((x) => x.correct).length === nC);

  // Replay: correct answers on the same questions must not overwrite first attempts or add XP.
  await page.click('[data-act="stage-start"]:has-text("Main semula")');
  await page.waitForSelector('#play-scene');
  await page.click('.confirm-bar [data-act="skip-drive"]');
  await page.waitForSelector('.options .opt');
  const ans2 = await page.evaluate(async () => {
    const data = await (await fetch('data/questions.json')).json();
    const q = data.questions.find((x) => x.id === document.querySelector('.q-card').dataset.qid);
    return { id: q.id, correct: q.correct };
  });
  await page.click(`.options .opt[data-opt="${ans2.correct}"]`);
  await page.click('#confirm-btn');
  await page.waitForSelector('.feedback');
  const game2 = await getLS(page, 'game');
  check('replay: no extra XP, first attempt unchanged', game2.xp === xpExpected && game2.firstAttempts[ans2.id].correct === game1.firstAttempts[ans2.id].correct);
  // Leave via sheet
  await page.click('[data-sheet="leave"]');
  await page.waitForSelector('.sheet');
  await page.click('[data-act="leave-confirm"]');
  await page.waitForSelector('.tabs');
  check('leaving a stage returns to the map', !!(await page.$('.stages')));
  await noOverflow(page, 'adventure map');
  await shot(page, '08-map');

  // Free practice setup + filters
  await page.click('[data-act="main-tab"][data-t="practice"]');
  await page.check('#ch-5', { force: true });
  await page.check('#vehicle-motosikal', { force: true });
  const lbl = await page.textContent('[data-act="practice-start"]');
  check('practice filters (Bab 5 + Motosikal incl. shared)', /Mula latihan: 10 soalan/.test(lbl));
  await page.check('#count-all', { force: true });
  check('practice "Semua" uses available count', /Mula latihan: 27 soalan/.test(await page.textContent('[data-act="practice-start"]')), await page.textContent('[data-act="practice-start"]'));
  await page.uncheck('#practice-anim', { force: true });
  await page.check('#count-10', { force: true });
  await shot(page, '09-practice-setup');
  await page.click('[data-act="practice-start"]');
  await page.waitForSelector('.options .opt', { timeout: 3000 });
  check('practice without animation goes straight to the question', !(await page.$('.driving-note')));
  await page.click('[data-act="p-skip"]');
  await page.waitForSelector('.feedback');
  check('skipped question is never marked correct', (await page.textContent('.feedback')).includes('Tidak dijawab'));
  await page.click('[data-sheet="leave"]'); await page.click('[data-act="leave-results"]');
  await page.waitForSelector('.verdict-card');
  const pr = await page.$$eval('.stats .stat .v', (els) => els.map((e) => e.textContent.trim()));
  check('practice result separates betul / salah / tidak dijawab', pr[0] === '0' && pr[1] === '0' && pr[2] === '10', pr.join('/'));
  check('practice stats kept separately', (await getLS(page, 'practiceStats')).sessions >= 1 && (await getLS(page, 'game')).xp === xpExpected);
  await page.click('[data-act="nav"][data-view="sessionReview"]');
  await page.click('[data-f="unanswered"]');
  check('session review filter Tidak Dijawab', (await page.$$('.review-item')).length === 10);
  check('no script errors (adventure/practice)', page.errors.length === 0, page.errors.slice(0, 2).join(' | '));
  await ctx.close();
}

// ================================================================ 2. Exam
{
  const { ctx, page } = await newPage();
  await page.goto(BASE);
  await page.waitForSelector('.home-actions');
  await page.click('.home-actions [data-view="examIntro"]');
  await page.click('[data-act="exam-start"]');
  await page.waitForSelector('.exam-head');
  let A = await getLS(page, 'activeExam');
  check('exam has exactly 70 unique verified questions', A.questionIds.length === 70 && new Set(A.questionIds).size === 70 && A.questions.every((q) => q.status === 'verified'));
  check('deadline is 75 minutes', A.deadline - A.startedAt === 75 * 60_000);
  check('exam shows "Soalan 1 daripada 70" and timer', (await page.textContent('.exam-head')).includes('Soalan 1 daripada 70'));
  const q0 = A.questions[0];
  await page.click(`.opt[data-opt="${q0.correct}"]`);
  check('exam selection reveals nothing', !(await page.$('.feedback, .is-correct, .is-wrong, .xp-chip')));
  const wrong0 = q0.options.find((o) => o.id !== q0.correct).id;
  await page.click(`.opt[data-opt="${wrong0}"]`);
  A = await getLS(page, 'activeExam');
  check('exam answer change saved', A.answers[q0.id] === wrong0);
  await page.click('[data-act="e-flag"]');
  await noOverflow(page, 'exam');
  await controlsVisible(page, '.exam-bar .btn', 'exam bar');
  await shot(page, '10-exam');
  const before = await getLS(page, 'activeExam');
  await page.reload();
  await page.waitForSelector('.home-actions');
  await page.click('[data-act="resume"]');
  await page.waitForSelector('.exam-head');
  const after = await getLS(page, 'activeExam');
  check('refresh restores questions, option order, answers, flags and deadline',
    JSON.stringify([after.questionIds, after.optionOrder, after.answers, after.flags, after.deadline]) === JSON.stringify([before.questionIds, before.optionOrder, before.answers, before.flags, before.deadline]));

  // Picture-answer and diagram questions render in the exam (craft an attempt that contains them).
  await page.evaluate(async (KEY) => {
    const data = await (await fetch('data/questions.json')).json();
    const A = JSON.parse(localStorage.getItem(KEY + 'activeExam'));
    const pic = data.questions.find((q) => q.id === 'B1-PAP-004');
    const turn = data.questions.find((q) => q.id === 'B3-SMP-007');
    const comp = data.questions.find((q) => q.id === 'B5-MSK-009');
    [pic, turn, comp].forEach((q, k) => { A.questions[k + 1] = q; A.questionIds[k + 1] = q.id; A.optionOrder[q.id] = q.options.map((o) => o.id); });
    A.current = 1;
    localStorage.setItem(KEY + 'activeExam', JSON.stringify(A));
  }, KEY);
  await page.reload(); await page.waitForSelector('.home-actions'); await page.click('[data-act="resume"]');
  await page.waitForSelector('.options.pics');
  check('picture answers show 4 sign images with text captions', (await page.$$('.options.pics .opt img')).length === 4 && (await page.$$eval('.options.pics .opt .txt', (e) => e.every((x) => x.textContent.trim().length > 5))));
  await shot(page, '11-exam-picture');
  await page.click('[data-act="e-next"]');
  check('junction answers use road diagrams', (await page.$$('.options.pics .opt svg.diag')).length === 4);
  await shot(page, '12-exam-junction');
  await page.click('[data-act="e-next"]');
  check('maintenance question highlights the component', !!(await page.$('.q-figure svg.diag-component')));
  await noOverflow(page, 'exam diagrams');

  // 56 correct passes
  A = await getLS(page, 'activeExam');
  const a56 = {}; A.questions.slice(0, 56).forEach((q) => { a56[q.id] = q.correct; });
  await setLS(page, 'activeExam', { ...A, answers: a56 });
  await page.reload(); await page.waitForSelector('.home-actions'); await page.click('[data-act="resume"]');
  await page.click('[data-sheet="submit"]');
  await page.waitForSelector('.sheet');
  check('submit sheet shows answered/unanswered', /56\s*Dijawab/.test(await page.textContent('.sheet')) && /14\s*Belum dijawab/.test(await page.textContent('.sheet')));
  await page.click('[data-act="e-first-unanswered"]');
  check('return to unfinished question', (await getLS(page, 'activeExam')).current === 56);
  await page.click('[data-sheet="submit"]');
  await page.click('[data-act="e-submit"]');
  await page.waitForSelector('.verdict-card');
  let txt = (await page.textContent('main')).replace(/\s+/g, ' ');
  check('56/70 → LULUS', txt.includes('LULUS') && !txt.includes('BELUM LULUS') && txt.includes('Jawapan betul: 56/70') && txt.includes('Minimum lulus: 56/70'));
  check('breakdown 56 / 0 / 14 / 80.0%', /56\s*Betul/.test(txt) && /0\s*Salah/.test(txt) && /14\s*Tidak dijawab/.test(txt) && txt.includes('80.0%'));
  check('pass shows destination scene', !!(await page.$('#result-scene')) && txt.includes('Destinasi: Lesen'));
  check('one result saved', (await getLS(page, 'examHistory')).length === 1);
  await page.waitForTimeout(1500);
  await shot(page, '13-result-pass');
  await noOverflow(page, 'result');
  await page.click('[data-act="open-review"]');
  await page.click('[data-f="correct"]');
  check('review filter Betul = 56', (await page.$$('.review-item')).length === 56);
  await page.click('[data-f="unanswered"]');
  check('review filter Tidak Dijawab = 14', (await page.$$('.review-item')).length === 14);
  await shot(page, '14-review');

  // 55 correct fails
  await page.click('[data-act="open-result"]');
  await page.click('[data-act="exam-new"]');
  await page.waitForSelector('.exam-head');
  A = await getLS(page, 'activeExam');
  const a55 = {}; A.questions.forEach((q, i) => { a55[q.id] = i < 55 ? q.correct : q.options.find((o) => o.id !== q.correct).id; });
  await setLS(page, 'activeExam', { ...A, answers: a55 });
  await page.reload(); await page.waitForSelector('.home-actions'); await page.click('[data-act="resume"]');
  await page.click('[data-sheet="submit"]'); await page.click('[data-act="e-submit"]');
  await page.waitForSelector('.verdict-card');
  txt = (await page.textContent('main')).replace(/\s+/g, ' ');
  check('55/70 → BELUM LULUS with learning checkpoint', txt.includes('BELUM LULUS') && txt.includes('Jawapan betul: 55/70') && txt.includes('Titik Pembelajaran') && txt.includes('Latih topik lemah'));
  await page.waitForTimeout(1500);
  await shot(page, '15-result-fail');
  await page.click('[data-act="weak-practice"]');
  await page.waitForSelector('#play-scene');
  check('weak-topic practice starts', (await page.textContent('.topbar')).includes('Topik lemah'));
  await page.click('[data-sheet="leave"]'); await page.click('[data-act="leave-confirm"]');

  // Timeout auto-submits once
  await page.click('[data-act="nav"][data-view="examIntro"]');
  await page.click('[data-act="exam-start"]');
  await page.waitForSelector('.exam-head');
  A = await getLS(page, 'activeExam');
  await page.click(`.opt[data-opt="${A.questions[0].correct}"]`);
  A = await getLS(page, 'activeExam');
  await setLS(page, 'activeExam', { ...A, deadline: Date.now() + 1500 });
  await page.waitForSelector('.verdict-card', { timeout: 8000 });
  await page.waitForTimeout(2500);
  let hist = await getLS(page, 'examHistory');
  check('timeout submits exactly once with saved answer', hist.length === 3 && hist[0].submitReason === 'timeout' && hist[0].result.correct === 1);

  // Closed past deadline → finalised on reopen
  await page.click('[data-act="exam-new"]');
  await page.waitForSelector('.exam-head');
  A = await getLS(page, 'activeExam');
  const a3 = {}; A.questions.slice(0, 3).forEach((q) => { a3[q.id] = q.correct; });
  const dl = Date.now() - 60_000;
  await setLS(page, 'activeExam', { ...A, answers: a3, startedAt: dl - 75 * 60_000, deadline: dl });
  await page.goto('about:blank'); await page.goto(BASE);
  await page.waitForSelector('.verdict-card');
  hist = await getLS(page, 'examHistory');
  check('reopen after deadline finalises with saved answers', hist.length === 4 && hist[0].result.correct === 3 && hist[0].timeUsedMs === 75 * 60_000);

  // Results & progress survive reopening in a new tab
  const p2 = await ctx.newPage();
  p2.errors = [];
  p2.on('pageerror', (e) => p2.errors.push(e.message));
  await p2.goto(BASE); await p2.waitForSelector('.home-actions');
  const h2 = (await p2.textContent('main')).replace(/\s+/g, ' ');
  check('home shows latest + best after reopen', h2.includes('3/70') && h2.includes('56/70') && /4\s*Ujian selesai/.test(h2));
  await p2.click('[data-act="nav"][data-view="progress"]');
  await p2.waitForSelector('.badges');
  check('progress shows exam pass rate 25%', (await p2.textContent('main')).includes('25%'));
  await noOverflow(p2, 'progress');
  await p2.screenshot({ path: `${SHOTS}/16-progress.png` });
  await p2.click('.icon-link[data-view="settings"]');
  await p2.check('#textSize-xlarge', { force: true });
  check('text size setting applies', (await p2.evaluate(() => document.documentElement.style.fontSize)) === '125%');
  await noOverflow(p2, 'settings xlarge text');
  await p2.screenshot({ path: `${SHOTS}/17-settings.png` });
  await p2.check('#textSize-normal', { force: true });
  check('no script errors (exam)', page.errors.length === 0 && p2.errors.length === 0, [...page.errors, ...p2.errors].slice(0, 2).join(' | '));

  // Offline after first load
  await page.goto(BASE); await page.waitForSelector('.home-actions');
  const swOk = await page.evaluate(async () => !!(await navigator.serviceWorker.ready).active);
  check('service worker active', swOk);
  await page.reload(); await page.waitForTimeout(800);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.home-actions', { timeout: 8000 }).catch(() => {});
  check('app loads offline', !!(await page.$('.home-actions')));
  const imgsOk = await page.evaluate(async () => {
    const data = await (await fetch('data/questions.json')).json();
    const srcs = data.questions.flatMap((q) => [q.image?.src, ...q.options.map((o) => o.img?.src)]).filter(Boolean);
    const r = await Promise.all([...new Set(srcs)].map((s) => fetch(s).then((x) => x.ok).catch(() => false)));
    return r.length > 50 && r.every(Boolean);
  });
  check('all question images cached for offline use', imgsOk);
  await ctx.setOffline(false);
  await ctx.close();
}

// ================================================================ 3. Reduced motion
{
  const { ctx, page } = await newPage({ reducedMotion: 'reduce' });
  await page.goto(BASE);
  await page.waitForSelector('.home-actions');
  check('reduced motion detected', await page.evaluate(() => document.documentElement.classList.contains('motion-static')));
  await page.click('[data-act="adventure-continue"]');
  await page.waitForSelector('.veh-grid');
  await page.click('[data-act="save-vehicle"]');
  await page.waitForSelector('.options .opt', { timeout: 2000 });
  check('reduced motion: question appears without a driving transition', !(await page.$('.options.deal .opt')) || await page.$eval('.options .opt', (o) => getComputedStyle(o).animationName === 'none'));
  for (let i = 0; i < 3; i++) {
    await page.click('.options .opt');
    await page.click('#confirm-btn');
    await page.waitForSelector('.feedback');
    await page.click('#next-btn');
    await page.waitForSelector('.options .opt:not([disabled])', { timeout: 2000 });
  }
  check('reduced motion: route progress updates', (await page.textContent('.route-label')).startsWith('Titik 4/'));
  await shot(page, '18-reduced-motion');
  check('no script errors (reduced motion)', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}

// ================================================================ 4. Storage unavailable + missing assets
{
  const { ctx, page } = await newPage();
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await page.goto(BASE);
  await page.waitForSelector('.home-actions');
  check('storage unavailable shows a clear notice', (await page.textContent('main')).includes('Storan peranti tidak tersedia'));
  await page.click('.home-actions [data-view="examIntro"]');
  await page.click('[data-act="exam-start"]');
  await page.waitForSelector('.exam-head');
  await page.click('.opt');
  check('exam still works without storage', (await page.$$('.opt[aria-checked="true"]')).length === 1);
  check('no script errors (no storage)', page.errors.length === 0, page.errors.join(' | '));
  await ctx.close();
}
{
  const { ctx, page } = await newPage();
  await ctx.route('**/assets/img/w-*.svg', (r) => r.abort());
  await page.goto(BASE);
  await page.waitForSelector('.home-actions');
  await page.evaluate(async (KEY) => {
    const data = await (await fetch('data/questions.json')).json();
    const q = data.questions.find((x) => x.id === 'B1-BHY-001');
    const now = Date.now();
    localStorage.setItem(KEY + 'activeExam', JSON.stringify({ id: 'x', kind: 'exam', status: 'active', config: { name: 'Simulasi KPP Gabungan', questionCount: 70, durationMinutes: 75, passMark: 56, version: 't' }, bankVersion: 't', startedAt: now, deadline: now + 3600_000, questionIds: [q.id], questions: [q], optionOrder: { [q.id]: q.options.map((o) => o.id) }, answers: {}, flags: {}, current: 0 }));
  }, KEY);
  await page.reload(); await page.waitForSelector('.home-actions'); await page.click('[data-act="resume"]');
  await page.waitForSelector('.img-missing', { timeout: 4000 }).catch(() => {});
  check('missing image shows a text fallback', !!(await page.$('.img-missing')));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
