// Lulus KPP — user interface. Logic lives in selection/scoring/attempt/storage.
import { EXAM_CONFIG, CHAPTERS, VEHICLES } from './config.js';
import { selectExamQuestions, selectPracticeQuestions, filterPractice, isEligible } from './selection.js';
import { classify, formatPercent } from './scoring.js';
import { createExamAttempt, setAnswer, clearAnswer, toggleFlag, goTo, submitAttempt, remainingMs, isExpired, answeredCount, formatClock, formatDuration } from './attempt.js';
import { createStore } from './storage.js';
import { shuffle, newId } from './rng.js';

const store = createStore();
const root = document.getElementById('app');

const S = {
  data: null,
  bank: [],
  byId: new Map(),
  view: 'home',
  params: {},
  setup: { chapter: 'all', vehicle: 'all', count: '10' },
  practice: null,
  reviewFilter: 'all',
  sheet: null,
  notice: null,
  submitting: false,
  timerId: null,
  lastResult: null,
};

// ---------------------------------------------------------------- icons
const I = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M8 7h7"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/>',
  chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  minus: '<path d="M6 12h12"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  left: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5h.01"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
  road: '<path d="M8 3L5 21M16 3l3 18"/><path d="M12 4v3M12 10.5v3M12 17v3"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const brandMark = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><path d="M7 3L4.5 21M17 3l2.5 18" stroke="#FFFFFF" stroke-width="2.2"/><path d="M12 4v3M12 10.5v3M12 17v3" stroke="#3BC2B9" stroke-width="2.6"/></svg></span>`;

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETTERS = ['A', 'B', 'C', 'D'];
const fmtDate = (t) => { try { return new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t)); } catch { return new Date(t).toLocaleString(); } };
const chLabel = (c) => `Bab ${c}: ${CHAPTERS[c]}`;
const formatLine = (cfg = EXAM_CONFIG) => `${cfg.questionCount} soalan • ${cfg.durationMinutes} minit • Lulus ${cfg.passMark}/${cfg.questionCount}`;

function sourceLine(q) {
  const book = q.sources.find((s) => s.type === 'book');
  const parts = [`Buku KPP 2025, Bab ${book.chapter}, ${esc(book.section)}, hlm. ${book.printedPage}`];
  const webs = q.sources.filter((s) => s.type === 'web');
  if (webs.length) {
    parts.push('Disahkan dalam talian: ' + webs.map((w) => `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(S.data?.sources?.[w.key]?.title || w.key)}</a> (${esc(w.verifiedOn)})`).join('; '));
  }
  return `<p class="source">Sumber: ${parts.join('. ')}.</p>`;
}

function figure(q) {
  if (!q.image) return '';
  return `<figure class="q-figure"><img src="${esc(q.image.src)}" alt="${esc(q.image.alt)}" width="170" height="170" data-alt="${esc(q.image.alt)}"></figure>`;
}

function statusPill(status) {
  if (status === 'correct') return `<span class="pill pill-ok">${icon('check')}Betul</span>`;
  if (status === 'incorrect') return `<span class="pill pill-bad">${icon('x')}Salah</span>`;
  return `<span class="pill pill-neutral">${icon('minus')}Tidak dijawab</span>`;
}

const bookmarks = () => new Set(store.getBookmarks());
function toggleBookmark(qid) {
  const b = bookmarks();
  if (b.has(qid)) b.delete(qid); else b.add(qid);
  store.saveBookmarks([...b]);
}
function bookmarkBtn(qid) {
  const on = bookmarks().has(qid);
  return `<button class="icon-btn" data-act="bookmark" data-q="${esc(qid)}" aria-pressed="${on}">${icon('bookmark')}<span>${on ? 'Ditanda' : 'Tanda soalan'}</span></button>`;
}

function recordMistake(q, wrong) {
  const m = store.getMistakes();
  if (wrong) m[q.id] = { at: Date.now(), q };
  else delete m[q.id];
  store.saveMistakes(m);
}
const mistakeList = () => Object.values(store.getMistakes()).sort((a, b) => b.at - a.at).map((x) => x.q);

// ---------------------------------------------------------------- navigation
function go(view, params = {}) {
  S.view = view;
  S.params = params;
  S.sheet = null;
  if (view !== 'review') S.reviewFilter = params.filter || 'all';
  render();
  window.scrollTo(0, 0);
  const h = root.querySelector('h1, h2, [data-autofocus]');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

const TAB_OF = { home: 'home', practiceSetup: 'practice', practiceSummary: 'practice', practiceReview: 'practice', examIntro: 'exam', result: 'exam', review: 'exam', progress: 'progress', about: 'progress' };
function tabbar() {
  const t = TAB_OF[S.view];
  if (!t) return '';
  const tab = (key, label, ic, view) => `<li><button class="tab" data-act="nav" data-view="${view}" ${t === key ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button></li>`;
  return `<nav class="tabbar" aria-label="Navigasi utama"><ul>${tab('home', 'Utama', 'home', 'home')}${tab('practice', 'Latihan', 'book', 'practiceSetup')}${tab('exam', 'Ujian', 'timer', 'examIntro')}${tab('progress', 'Prestasi', 'chart', 'progress')}</ul></nav>`;
}

// ---------------------------------------------------------------- views
function storageNotice() {
  if (store.persistent) return '';
  return `<div class="notice" role="status">${icon('alert')}<div><b>Storan peranti tidak tersedia.</b><p class="small">Kemajuan dan keputusan hanya disimpan sehingga halaman ini ditutup. Buka aplikasi dalam pelayar biasa (bukan mod peribadi) untuk menyimpan kemajuan.</p></div></div>`;
}
function flashNotice() {
  if (!S.notice) return '';
  const n = S.notice; S.notice = null;
  return `<div class="notice ${n.kind === 'info' ? 'info' : ''}" role="status">${icon(n.kind === 'info' ? 'info' : 'alert')}<div><p>${n.html}</p></div></div>`;
}

function viewHome() {
  const hist = store.getExamHistory();
  const active = store.getActiveExam();
  const mistakes = mistakeList();
  const latest = hist[0];
  const best = hist.reduce((m, a) => Math.max(m, a.result.correct), 0);
  const resume = active && active.status === 'active' ? `
    <section class="card resume" aria-labelledby="resume-h">
      <div class="card-head"><h2 class="card-title" id="resume-h">Ujian belum selesai</h2><span class="pill pill-teal">${answeredCount(active)}/${active.questionIds.length} dijawab</span></div>
      <p class="muted small">Masa terus berjalan walaupun aplikasi ditutup.</p>
      <p class="clock tnum" data-live-clock>${formatClock(remainingMs(active))} berbaki</p>
      <button class="btn btn-primary btn-block" data-act="resume">${icon('timer')}Sambung Ujian</button>
    </section>` : '';
  const stats = latest ? `
    <section class="card" aria-labelledby="stats-h">
      <div class="card-head"><h2 class="card-title" id="stats-h">Prestasi ujian simulasi</h2><button class="text-btn" data-act="open-result" data-id="${esc(latest.id)}">Lihat terkini</button></div>
      <div class="stats">
        <div class="stat"><span class="v">${latest.result.correct}/${latest.result.total}</span><span class="k">Skor terkini</span></div>
        <div class="stat"><span class="v">${best}/${EXAM_CONFIG.questionCount}</span><span class="k">Skor terbaik</span></div>
        <div class="stat"><span class="v">${hist.length}</span><span class="k">Ujian selesai</span></div>
      </div>
      <p class="small muted">Keputusan terkini: ${latest.result.passed ? 'LULUS' : 'BELUM LULUS'}, ${fmtDate(latest.submittedAt)}.</p>
    </section>` : `
    <section class="card" aria-labelledby="stats-h">
      <h2 class="card-title" id="stats-h">Prestasi ujian simulasi</h2>
      <div class="empty">${icon('chart')}<p>Belum ada ujian simulasi yang lengkap. Skor terkini, skor terbaik dan bilangan ujian akan dipaparkan di sini selepas ujian pertama anda.</p></div>
    </section>`;
  const revise = mistakes.length ? `<button class="btn btn-secondary btn-block" data-act="practice-mistakes">${icon('refresh')}Ulang Kaji Soalan Salah (${mistakes.length})</button>` : '';
  return `
  <main class="screen">
    <header class="topbar"><div class="brand">${brandMark}<span>Lulus KPP</span></div><button class="text-btn" data-act="nav" data-view="about">Tentang</button></header>
    ${storageNotice()}${flashNotice()}
    <section class="hero" aria-labelledby="hero-h">
      <h1 id="hero-h">Sedia untuk ujian teori KPP?</h1>
      <p>Latih soalan daripada buku teks KPP edisi 2025, kemudian cuba simulasi ujian bermasa dan semak setiap jawapan.</p>
      <span class="format-chip tnum">${EXAM_CONFIG.questionCount} soalan <span class="dot">•</span> ${EXAM_CONFIG.durationMinutes} minit <span class="dot">•</span> Lulus ${EXAM_CONFIG.passMark}/${EXAM_CONFIG.questionCount}</span>
      <div class="btn-stack">
        <button class="btn btn-primary" data-act="${active ? 'resume' : 'nav'}" data-view="examIntro">${icon('timer')}Mula Ujian Simulasi</button>
        <button class="btn btn-secondary" data-act="nav" data-view="practiceSetup">${icon('book')}Latihan Mengikut Bab</button>
      </div>
    </section>
    ${resume}
    ${revise}
    ${stats}
    <p class="footnote">${S.data.counts.verified} soalan disemak daripada 6 bab buku teks. Aplikasi latihan bebas, tidak berafiliasi dengan JPJ.</p>
  </main>`;
}

function viewPracticeSetup() {
  const st = S.setup;
  const avail = filterPractice(S.bank, st).length;
  const chOpt = (val, label, n) => `<label class="choice"><input type="radio" name="chapter" id="ch-${val}" value="${val}" ${String(st.chapter) === String(val) ? 'checked' : ''}><span><span class="num">${val === 'all' ? '★' : val}</span><b>${esc(label)}</b><i>${n}</i></span></label>`;
  const chapters = Object.keys(CHAPTERS).map((c) => chOpt(c, CHAPTERS[c], filterPractice(S.bank, { chapter: c, vehicle: st.vehicle }).length)).join('');
  const seg = (name, val, label) => `<label><input type="radio" name="${name}" id="${name}-${val}" value="${val}" ${st[name] === val ? 'checked' : ''}><span>${label}</span></label>`;
  const nMist = mistakeList().length;
  const nBook = store.getBookmarks().filter((id) => S.byId.has(id)).length;
  const plannedN = st.count === 'all' ? avail : Math.min(Number(st.count), avail);
  return `
  <main class="screen">
    <header><h1 class="title">Latihan</h1><p class="subtitle">Tanpa had masa. Jawapan dan penjelasan dipaparkan selepas setiap soalan.</p></header>
    ${storageNotice()}${flashNotice()}
    ${(nMist || nBook) ? `<div class="btn-row">
      ${nMist ? `<button class="btn btn-secondary" data-act="practice-mistakes">${icon('refresh')}Soalan salah (${nMist})</button>` : ''}
      ${nBook ? `<button class="btn btn-secondary" data-act="practice-bookmarks">${icon('bookmark')}Ditanda (${nBook})</button>` : ''}
    </div>` : ''}
    <section class="card">
      <fieldset class="field"><legend>Pilih bab</legend>
        <div class="choice-list">${chOpt('all', 'Semua bab (campuran)', filterPractice(S.bank, { chapter: 'all', vehicle: st.vehicle }).length)}${chapters}</div>
      </fieldset>
    </section>
    <section class="card">
      <fieldset class="field"><legend>Jenis kenderaan</legend>
        <div class="seg">${seg('vehicle', 'all', 'Semua')}${seg('vehicle', 'motokar', 'Kereta')}${seg('vehicle', 'motosikal', 'Motosikal')}${seg('vehicle', 'bersama', 'Bersama')}</div>
        <p class="small muted">"Bersama" ialah topik yang sama untuk kereta dan motosikal.</p>
      </fieldset>
      <fieldset class="field"><legend>Bilangan soalan</legend>
        <div class="seg tnum">${seg('count', '10', '10')}${seg('count', '20', '20')}${seg('count', 'all', `Semua (${avail})`)}</div>
      </fieldset>
    </section>
    <button class="btn btn-primary btn-block" data-act="practice-start" ${avail ? '' : 'disabled'}>${icon('book')}${avail ? `Mula latihan: ${plannedN} soalan` : 'Tiada soalan untuk pilihan ini'}</button>
  </main>`;
}

function startPractice(questions, title, origin = 'setup') {
  if (!questions.length) { S.notice = { html: 'Tiada soalan untuk dilatih.', kind: 'info' }; go('practiceSetup'); return; }
  const order = {};
  for (const q of questions) order[q.id] = shuffle(q.options.map((o) => o.id));
  S.practice = { id: newId('latihan'), title, origin, questions, order, index: 0, selected: {}, results: {} };
  const ps = store.getPracticeStats();
  store.savePracticeStats({ ...ps, sessions: ps.sessions + 1 });
  go('practiceRun');
}

function optionsHtml(q, orderIds, { selected, reveal, disabled, act }) {
  return `<div class="options" role="radiogroup" aria-label="Pilihan jawapan">${orderIds.map((oid, i) => {
    const o = q.options.find((x) => x.id === oid);
    const isSel = selected === oid;
    let cls = '', mark = '';
    if (reveal) {
      if (oid === q.correct) { cls = 'is-correct'; mark = `<span class="mark">${icon('check')}Jawapan betul</span>`; }
      else if (isSel) { cls = 'is-wrong'; mark = `<span class="mark">${icon('x')}Pilihan anda</span>`; }
    }
    return `<button class="opt ${cls}" role="radio" aria-checked="${isSel}" data-act="${act}" data-opt="${esc(oid)}" ${disabled ? 'disabled' : ''}><span class="letter" aria-hidden="true">${LETTERS[i]}</span><span class="txt"><span class="visually-hidden">Pilihan ${LETTERS[i]}: </span>${esc(o.text)}</span>${mark}</button>`;
  }).join('')}</div>`;
}

function viewPracticeRun() {
  const P = S.practice;
  if (!P) return viewPracticeSetup();
  const q = P.questions[P.index];
  const n = P.questions.length;
  const sel = P.selected[q.id];
  const res = P.results[q.id];
  const revealed = res != null;
  const feedback = revealed ? `
    <div class="feedback ${res === 'correct' ? 'ok' : 'bad'}" role="status" aria-live="polite">
      <p class="verdict">${icon(res === 'correct' ? 'check' : 'x')}${res === 'correct' ? 'Betul' : 'Salah'}</p>
      ${res === 'correct' ? '' : `<p><b>Jawapan betul:</b> ${esc(q.options.find((o) => o.id === q.correct).text)}</p>`}
      <p>${esc(q.explanation)}</p>
      ${sourceLine(q)}
    </div>` : '';
  const last = P.index === n - 1;
  return `
  <main class="screen">
    <header class="topbar"><button class="back-btn" data-act="practice-end">${icon('left')}Tamat latihan</button><span class="small muted">${esc(P.title)}</span></header>
    <div class="q-meta"><span class="q-count tnum">Soalan ${P.index + 1} daripada ${n}</span><span class="pill pill-neutral">${esc(VEHICLES[q.vehicle])}</span></div>
    <div class="progress" role="progressbar" aria-label="Kemajuan latihan" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${P.index + 1}"><i style="width:${((P.index + 1) / n) * 100}%"></i></div>
    <article class="card q-card">
      <p class="eyebrow">${esc(chLabel(q.chapter))}</p>
      ${figure(q)}
      <h2 class="q-text" id="qtext">${esc(q.text)}</h2>
      ${optionsHtml(q, P.order[q.id], { selected: sel, reveal: revealed, disabled: revealed, act: 'p-choose' })}
      ${feedback}
      <div class="q-meta">${bookmarkBtn(q.id)}</div>
    </article>
    <div class="btn-row">
      ${revealed
        ? `<button class="btn btn-primary" data-act="${last ? 'practice-end' : 'p-next'}" data-autofocus>${last ? 'Lihat keputusan' : 'Seterusnya'}${icon('right')}</button>`
        : `<button class="btn btn-secondary" data-act="p-skip">${last ? 'Langkau & tamat' : 'Langkau'}</button><button class="btn btn-primary" data-act="p-check" ${sel ? '' : 'disabled'}>${icon('check')}Semak Jawapan</button>`}
    </div>
  </main>`;
}

function practiceCounts(P) {
  const correct = Object.values(P.results).filter((r) => r === 'correct').length;
  const incorrect = Object.values(P.results).filter((r) => r === 'incorrect').length;
  return { correct, incorrect, unanswered: P.questions.length - correct - incorrect, total: P.questions.length };
}

function viewPracticeSummary() {
  const P = S.practice;
  if (!P) return viewPracticeSetup();
  const c = practiceCounts(P);
  const wrongQs = P.questions.filter((q) => P.results[q.id] !== 'correct');
  return `
  <main class="screen">
    <header><p class="eyebrow">Latihan selesai</p><h1 class="title">${esc(P.title)}</h1></header>
    <section class="card">
      <p class="big-score"><span class="n tnum">${c.correct}</span> / ${c.total} betul</p>
      <div class="stats">
        <div class="stat"><span class="v k-ok">${c.correct}</span><span class="k">Betul</span></div>
        <div class="stat"><span class="v k-bad">${c.incorrect}</span><span class="k">Salah</span></div>
        <div class="stat"><span class="v">${c.unanswered}</span><span class="k">Tidak dijawab</span></div>
      </div>
      <p class="small muted">Statistik latihan disimpan berasingan daripada keputusan ujian simulasi.</p>
    </section>
    <div class="btn-stack">
      <button class="btn btn-primary" data-act="nav" data-view="practiceReview">Semak Jawapan</button>
      ${wrongQs.length ? `<button class="btn btn-secondary" data-act="practice-retry-wrong">${icon('refresh')}Ulang soalan salah & tidak dijawab (${wrongQs.length})</button>` : ''}
      <button class="btn btn-secondary" data-act="nav" data-view="practiceSetup">Latihan baharu</button>
      <button class="btn btn-ghost" data-act="nav" data-view="home">Kembali ke Utama</button>
    </div>
  </main>`;
}

function reviewList(items, filter, emptyMsg) {
  const shown = items.filter((it) => filter === 'all' || it.status === filter);
  if (!shown.length) return `<div class="card"><p class="muted">${emptyMsg}</p></div>`;
  return shown.map((it) => {
    const { q, n, chosen, status, order } = it;
    const chosenText = chosen ? q.options.find((o) => o.id === chosen)?.text : null;
    const correctText = q.options.find((o) => o.id === q.correct).text;
    return `
    <article class="card review-item" aria-label="Soalan ${n}">
      <div class="card-head"><span class="q-count tnum">Soalan ${n}</span>${statusPill(status)}</div>
      ${figure(q)}
      <h3 class="q-text">${esc(q.text)}</h3>
      <div class="ans">
        ${status === 'unanswered'
          ? `<p class="ans-line">${icon('minus')}<span><b>Jawapan anda:</b> Tidak dijawab</span></p>`
          : `<p class="ans-line ${status === 'correct' ? 'ok' : 'bad'}">${icon(status === 'correct' ? 'check' : 'x')}<span><b>Jawapan anda:</b> ${esc(chosenText)}</span></p>`}
        ${status === 'correct' ? '' : `<p class="ans-line ok">${icon('check')}<span><b>Jawapan betul:</b> ${esc(correctText)}</span></p>`}
      </div>
      <p>${esc(q.explanation)}</p>
      <p class="small"><b>${esc(chLabel(q.chapter))}</b></p>
      ${sourceLine(q)}
      <div>${bookmarkBtn(q.id)}</div>
    </article>`;
  }).join('');
}

function filterBar(items) {
  const count = (f) => items.filter((it) => f === 'all' || it.status === f).length;
  const b = (f, label) => `<button data-act="review-filter" data-f="${f}" aria-pressed="${S.reviewFilter === f}">${label} (${count(f)})</button>`;
  return `<div class="filters" role="group" aria-label="Tapis jawapan">${b('all', 'Semua')}${b('correct', 'Betul')}${b('incorrect', 'Salah')}${b('unanswered', 'Tidak Dijawab')}</div>`;
}

function viewPracticeReview() {
  const P = S.practice;
  if (!P) return viewPracticeSetup();
  const items = P.questions.map((q, i) => ({ q, n: i + 1, chosen: P.results[q.id] ? P.selected[q.id] : null, status: P.results[q.id] || 'unanswered' }));
  return `
  <main class="screen">
    <header class="topbar"><button class="back-btn" data-act="nav" data-view="practiceSummary">${icon('left')}Ringkasan</button></header>
    <h1 class="title">Semak jawapan latihan</h1>
    ${filterBar(items)}
    ${reviewList(items, S.reviewFilter, 'Tiada soalan dalam kategori ini.')}
  </main>`;
}

function viewExamIntro() {
  const active = store.getActiveExam();
  const d = S.data.counts.byChapter;
  return `
  <main class="screen">
    <header><h1 class="title">${esc(EXAM_CONFIG.name)}</h1><p class="subtitle">Simulasi ujian Bahagian I berkomputer, gabungan kereta dan motosikal.</p></header>
    ${storageNotice()}${flashNotice()}
    <section class="card">
      <div class="stats">
        <div class="stat"><span class="v">${EXAM_CONFIG.questionCount}</span><span class="k">Soalan</span></div>
        <div class="stat"><span class="v">${EXAM_CONFIG.durationMinutes}</span><span class="k">Minit</span></div>
        <div class="stat"><span class="v">${EXAM_CONFIG.passMark}/${EXAM_CONFIG.questionCount}</span><span class="k">Markah lulus</span></div>
      </div>
      <div class="prose small">
        <ul>
          <li>Satu markah bagi setiap jawapan betul. Tiada markah negatif.</li>
          <li><b>Jawapan betul dan penjelasan hanya dipaparkan selepas ujian dihantar.</b></li>
          <li>Anda boleh menukar jawapan, bergerak ke soalan sebelum atau seterusnya, dan menanda soalan untuk disemak semula.</li>
          <li>Masa terus berjalan walaupun anda menutup aplikasi. Ujian dihantar secara automatik apabila masa tamat.</li>
        </ul>
      </div>
    </section>
    ${active ? `<button class="btn btn-primary btn-block" data-act="resume">${icon('timer')}Sambung Ujian (${formatClock(remainingMs(active))} berbaki)</button>` : `<button class="btn btn-primary btn-block" data-act="exam-start">${icon('timer')}Mula Ujian</button>`}
    <section class="card">
      <h2 class="card-title">Tentang format ini</h2>
      <p class="small">Bilangan soalan, masa dan markah lulus mengikut FAQ KPP Gabungan JPJ (berkuat kuasa 29 Ogos 2025, disemak ${esc(EXAM_CONFIG.source.verifiedOn)}). Soalan aplikasi ini ialah soalan latihan asli berdasarkan buku teks, bukan soalan sebenar JPJ, dan antara muka ini tidak meniru perisian ujian rasmi.</p>
      <p class="small muted">Taburan soalan setiap ujian ialah taburan latihan aplikasi ini sendiri (bukan kuota rasmi JPJ): Bab 1: ${EXAM_CONFIG.practiceDistribution[1]}, Bab 2: ${EXAM_CONFIG.practiceDistribution[2]}, Bab 3: ${EXAM_CONFIG.practiceDistribution[3]}, Bab 4: ${EXAM_CONFIG.practiceDistribution[4]}, Bab 5: ${EXAM_CONFIG.practiceDistribution[5]}, Bab 6: ${EXAM_CONFIG.practiceDistribution[6]}. Bank soalan: ${Object.values(d).reduce((a, b) => a + b, 0)} soalan.</p>
    </section>
  </main>`;
}

function viewExam() {
  const A = store.getActiveExam();
  if (!A) return viewExamIntro();
  const q = A.questions[A.current];
  const n = A.questionIds.length;
  const rem = remainingMs(A);
  const flagged = !!A.flags[q.id];
  const sel = A.answers[q.id];
  return `
  <main class="screen exam-screen">
    <div class="exam-head">
      <div class="eh-row"><p class="name">${esc(A.config.name)}</p><button class="btn-exit" data-act="exam-exit" aria-label="Keluar sementara; ujian disimpan dan masa terus berjalan">Keluar</button></div>
      <div class="eh-row"><p class="count tnum">Soalan ${A.current + 1} daripada ${n}</p><div class="timer ${rem < 5 * 60_000 ? 'low' : ''}" role="timer" aria-label="Masa berbaki">${icon('timer')}<span data-live-clock>${formatClock(rem)}</span></div></div>
    </div>
    <p class="visually-hidden" aria-live="polite" id="time-warn"></p>
    <article class="card q-card">
      <div class="q-meta"><span class="eyebrow">${esc(chLabel(q.chapter))}</span>${flagged ? `<span class="pill" style="background:var(--warn-soft);color:var(--warn)">${icon('flag')}Ditanda</span>` : ''}</div>
      ${figure(q)}
      <h2 class="q-text" id="qtext">${esc(q.text)}</h2>
      ${optionsHtml(q, A.optionOrder[q.id], { selected: sel, reveal: false, disabled: false, act: 'e-choose' })}
      ${sel ? `<button class="text-btn" data-act="e-clear">Kosongkan jawapan</button>` : `<p class="small muted">Belum dijawab.</p>`}
    </article>
  </main>
    <div class="exam-bar">
      <div class="exam-bar-inner">
        <button class="btn btn-secondary" data-act="e-prev" ${A.current === 0 ? 'disabled' : ''}>${icon('left')}Sebelum</button>
        <button class="btn btn-secondary" data-act="e-flag" aria-pressed="${flagged}" aria-label="${flagged ? 'Buang tanda semakan' : 'Tanda untuk semakan'}">${icon('flag')}</button>
        <button class="btn btn-primary" data-act="e-next" ${A.current === n - 1 ? 'disabled' : ''}>Seterusnya${icon('right')}</button>
      </div>
      <div class="exam-bar-sub">
        <button class="btn btn-secondary" data-act="sheet" data-sheet="palette">${icon('grid')}Senarai soalan</button>
        <button class="btn btn-secondary" data-act="sheet" data-sheet="submit">${icon('send')}Hantar ujian</button>
      </div>
    </div>`;
}

function sheetPalette() {
  const A = store.getActiveExam();
  if (!A) return '';
  const cells = A.questionIds.map((id, i) => {
    const ans = A.answers[id] != null;
    const fl = !!A.flags[id];
    const label = `Soalan ${i + 1}, ${ans ? 'dijawab' : 'belum dijawab'}${fl ? ', ditanda' : ''}${i === A.current ? ', soalan semasa' : ''}`;
    return `<button class="pal tnum ${ans ? 'answered' : ''} ${i === A.current ? 'current' : ''}" data-act="e-goto" data-i="${i}" aria-label="${label}">${i + 1}${fl ? `<span class="flag">${icon('flag')}</span>` : ''}</button>`;
  }).join('');
  const nAns = answeredCount(A);
  return `
    <div class="sheet-handle" aria-hidden="true"></div>
    <h2 id="sheet-h">Senarai soalan</h2>
    <p class="small muted tnum">${nAns} dijawab, ${A.questionIds.length - nAns} belum dijawab, ${Object.keys(A.flags).length} ditanda.</p>
    <div class="legend"><span><i class="sw a"></i>Dijawab</span><span><i class="sw"></i>Belum dijawab</span><span><i class="sw f"></i>Ditanda</span><span><i class="sw c"></i>Semasa</span></div>
    <div class="palette">${cells}</div>
    <button class="btn btn-secondary" data-act="sheet-close">Tutup</button>`;
}

function sheetSubmit() {
  const A = store.getActiveExam();
  if (!A) return '';
  const nAns = answeredCount(A);
  const nUn = A.questionIds.length - nAns;
  const nFlag = Object.keys(A.flags).length;
  return `
    <div class="sheet-handle" aria-hidden="true"></div>
    <h2 id="sheet-h">Hantar ujian?</h2>
    <div class="stats">
      <div class="stat"><span class="v">${nAns}</span><span class="k">Dijawab</span></div>
      <div class="stat"><span class="v">${nUn}</span><span class="k">Belum dijawab</span></div>
      <div class="stat"><span class="v">${nFlag}</span><span class="k">Ditanda</span></div>
    </div>
    ${nUn ? `<div class="notice">${icon('alert')}<div><p>${nUn} soalan belum dijawab dan akan dikira sebagai tidak dijawab (0 markah).</p></div></div>` : '<p class="small muted">Semua soalan telah dijawab.</p>'}
    ${nUn ? `<button class="btn btn-secondary" data-act="e-first-unanswered">Kembali ke soalan belum dijawab</button>` : ''}
    ${nFlag ? `<button class="btn btn-secondary" data-act="e-first-flagged">Semak soalan ditanda</button>` : ''}
    <button class="btn btn-primary" data-act="e-submit">${icon('send')}${nUn ? 'Hantar juga' : 'Hantar sekarang'}</button>
    <button class="btn btn-ghost" data-act="sheet-close">Teruskan menjawab</button>`;
}

function sheetReset() {
  return `
    <div class="sheet-handle" aria-hidden="true"></div>
    <h2 id="sheet-h">Padam semua data tempatan?</h2>
    <p>Ini akan memadam semua keputusan ujian, ujian yang sedang berjalan, statistik latihan, soalan ditanda dan senarai soalan salah daripada peranti ini. Tindakan ini tidak boleh dibatalkan.</p>
    <button class="btn btn-danger" data-act="reset-confirm">${icon('trash')}Ya, padam semua</button>
    <button class="btn btn-secondary" data-act="sheet-close">Batal</button>`;
}

function findAttempt(id) {
  if (S.lastResult && S.lastResult.id === id) return S.lastResult;
  return store.getExamHistory().find((a) => a.id === id) || null;
}

function viewResult() {
  const A = findAttempt(S.params.id);
  if (!A) return `<main class="screen"><h1 class="title">Keputusan tidak dijumpai</h1><button class="btn btn-primary" data-act="nav" data-view="home">Kembali ke Utama</button></main>`;
  const r = A.result;
  const cfg = A.config;
  const chapters = Object.entries(r.byChapter).sort(([a], [b]) => a - b).map(([c, v]) => `
    <div class="chbar"><div class="lbl"><b>${esc(chLabel(c))}</b><span class="tnum">${v.correct}/${v.total}</span></div>
    <div class="bar" role="img" aria-label="Bab ${c}: ${v.correct} betul daripada ${v.total}"><i style="width:${(v.correct / v.total) * 100}%"></i></div></div>`).join('');
  const reasonNote = A.submitReason === 'timeout' ? '<div class="notice info">' + icon('info') + '<div><p>Masa tamat. Ujian dihantar secara automatik.</p></div></div>'
    : A.submitReason === 'resume-expired' ? '<div class="notice info">' + icon('info') + '<div><p>Masa ujian tamat semasa aplikasi ditutup. Ujian dihantar menggunakan jawapan yang telah disimpan.</p></div></div>' : '';
  return `
  <main class="screen">
    <header><p class="eyebrow">${esc(cfg.name)} · ${fmtDate(A.submittedAt)}</p><h1 class="visually-hidden">Keputusan ujian</h1></header>
    ${S.params.fresh ? reasonNote : ''}
    ${!store.persistent ? storageNotice() : ''}
    <section class="verdict-card ${r.passed ? 'pass' : 'fail'}" aria-label="Keputusan">
      <p class="verdict-badge">${icon(r.passed ? 'check' : 'x')}${r.passed ? 'LULUS' : 'BELUM LULUS'}</p>
      <p class="big-score">Jawapan betul: <span class="n tnum">${r.correct}/${r.total}</span></p>
      <p class="small">Syarat lulus: Minimum ${cfg.passMark} jawapan betul.${r.passed ? '' : ` Anda perlukan ${cfg.passMark - r.correct} lagi jawapan betul.`}</p>
    </section>
    <section class="card">
      <div class="breakdown">
        <div class="stat"><span class="v tnum">${r.correct}</span><span class="k k-ok">${icon('check')}Betul</span></div>
        <div class="stat"><span class="v tnum">${r.incorrect}</span><span class="k k-bad">${icon('x')}Salah</span></div>
        <div class="stat"><span class="v tnum">${r.unanswered}</span><span class="k">${icon('minus')}Tidak dijawab</span></div>
        <div class="stat"><span class="v tnum">${formatPercent(r.percent)}</span><span class="k">Markah</span></div>
      </div>
      <p class="small"><b>Masa digunakan:</b> ${formatDuration(A.timeUsedMs)} daripada ${cfg.durationMinutes} minit</p>
    </section>
    <div class="btn-stack">
      <button class="btn btn-primary" data-act="open-review" data-id="${esc(A.id)}">Semak Jawapan</button>
      ${(r.incorrect + r.unanswered) ? `<button class="btn btn-secondary" data-act="result-retry" data-id="${esc(A.id)}">${icon('refresh')}Ulang Kaji Soalan Salah (${r.incorrect + r.unanswered})</button>` : ''}
      <button class="btn btn-secondary" data-act="exam-new">${icon('timer')}Cuba Ujian Baharu</button>
      <button class="btn btn-ghost" data-act="nav" data-view="home">Kembali ke Utama</button>
    </div>
    <section class="card">
      <h2 class="card-title">Prestasi mengikut bab</h2>
      <div class="chbars">${chapters}</div>
    </section>
    <p class="footnote">Versi format ${esc(cfg.version)} · bank soalan ${esc(A.bankVersion)}. Keputusan ini disimpan bersama soalan dan skema jawapan yang digunakan.</p>
  </main>`;
}

function viewReview() {
  const A = findAttempt(S.params.id);
  if (!A) return viewResult();
  const items = A.questions.map((q, i) => ({ q, n: i + 1, chosen: A.answers[q.id] || null, status: A.result.perQuestion[q.id] || classify(q, A.answers[q.id]) }));
  return `
  <main class="screen">
    <header class="topbar"><button class="back-btn" data-act="open-result" data-id="${esc(A.id)}">${icon('left')}Keputusan</button><span class="small muted tnum">${A.result.correct}/${A.result.total} betul</span></header>
    <h1 class="title">Semak jawapan</h1>
    ${filterBar(items)}
    ${reviewList(items, S.reviewFilter, 'Tiada soalan dalam kategori ini.')}
  </main>`;
}

function viewProgress() {
  const hist = store.getExamHistory();
  const ps = store.getPracticeStats();
  const passed = hist.filter((a) => a.result.passed).length;
  const best = hist.reduce((m, a) => Math.max(m, a.result.correct), 0);
  const recent = hist.slice(0, 10).map((a) => `
    <li><button class="row-btn" data-act="open-result" data-id="${esc(a.id)}">
      <span class="grow"><b class="tnum">${a.result.correct}/${a.result.total} · ${formatPercent(a.result.percent)}</b><span class="small muted">${fmtDate(a.submittedAt)}</span></span>
      ${a.result.passed ? `<span class="pill pill-ok">${icon('check')}LULUS</span>` : `<span class="pill pill-bad">${icon('x')}BELUM LULUS</span>`}
      ${icon('chev', 'chev')}
    </button></li>`).join('');
  const nBook = store.getBookmarks().filter((id) => S.byId.has(id)).length;
  const answered = ps.correct + ps.incorrect;
  return `
  <main class="screen">
    <header><h1 class="title">Prestasi</h1><p class="subtitle">Semua data disimpan dalam peranti ini sahaja.</p></header>
    ${storageNotice()}${flashNotice()}
    <section class="card">
      <h2 class="card-title">Ujian simulasi</h2>
      ${hist.length ? `<div class="stats">
        <div class="stat"><span class="v">${hist.length}</span><span class="k">Ujian selesai</span></div>
        <div class="stat"><span class="v">${best}/${EXAM_CONFIG.questionCount}</span><span class="k">Skor terbaik</span></div>
        <div class="stat"><span class="v">${Math.round((passed / hist.length) * 100)}%</span><span class="k">Kadar lulus</span></div>
      </div>
      <h3 class="eyebrow">Keputusan terkini</h3>
      <ul class="list">${recent}</ul>` : `<div class="empty">${icon('chart')}<p>Belum ada ujian simulasi yang lengkap.</p></div>
      <button class="btn btn-primary" data-act="nav" data-view="examIntro">Mula Ujian Simulasi</button>`}
    </section>
    <section class="card">
      <h2 class="card-title">Latihan</h2>
      ${ps.sessions ? `<div class="stats">
        <div class="stat"><span class="v">${ps.sessions}</span><span class="k">Sesi dimulakan</span></div>
        <div class="stat"><span class="v">${answered}</span><span class="k">Soalan disemak</span></div>
        <div class="stat"><span class="v">${answered ? Math.round((ps.correct / answered) * 100) + '%' : '–'}</span><span class="k">Ketepatan</span></div>
      </div>` : `<div class="empty">${icon('book')}<p>Belum ada sesi latihan.</p></div>`}
      <div class="btn-row">
        ${nBook ? `<button class="btn btn-secondary" data-act="practice-bookmarks">${icon('bookmark')}Soalan ditanda (${nBook})</button>` : ''}
        ${mistakeList().length ? `<button class="btn btn-secondary" data-act="practice-mistakes">${icon('refresh')}Soalan salah (${mistakeList().length})</button>` : ''}
      </div>
    </section>
    <section class="card">
      <h2 class="card-title">Aplikasi</h2>
      <ul class="list">
        <li><button class="row-btn" data-act="nav" data-view="about"><span class="grow"><b>Tentang Lulus KPP</b><span class="small muted">Sumber, format ujian dan penafian</span></span>${icon('chev', 'chev')}</button></li>
        <li><button class="row-btn" data-act="sheet" data-sheet="reset"><span class="grow"><b style="color:var(--bad)">Padam data tempatan</b><span class="small muted">Buang semua keputusan dan kemajuan dari peranti ini</span></span>${icon('trash', 'chev')}</button></li>
      </ul>
    </section>
  </main>`;
}

function viewAbout() {
  const c = S.data.counts;
  const src = S.data.primarySource;
  return `
  <main class="screen">
    <header class="topbar"><button class="back-btn" data-act="nav" data-view="progress">${icon('left')}Prestasi</button></header>
    <h1 class="title">Tentang Lulus KPP</h1>
    <section class="card">
      <p><b>Aplikasi latihan bebas. Tidak berafiliasi dengan atau disahkan oleh JPJ.</b></p>
      <p class="small">Soalan dalam aplikasi ini ialah soalan latihan asli yang ditulis berdasarkan fakta dan objektif pembelajaran buku teks. Ia bukan soalan sebenar ujian JPJ.</p>
    </section>
    <section class="card">
      <h2 class="card-title">Format ujian</h2>
      <dl class="kv">
        <dt>Format</dt><dd>${esc(formatLine())}</dd>
        <dt>Sumber</dt><dd><a href="${esc(EXAM_CONFIG.source.url)}" target="_blank" rel="noopener">${esc(EXAM_CONFIG.source.title)}</a></dd>
        <dt>Berkuat kuasa</dt><dd>29 Ogos 2025</dd>
        <dt>Disemak pada</dt><dd>${esc(EXAM_CONFIG.source.verifiedOn)}</dd>
        <dt>Versi</dt><dd>${esc(EXAM_CONFIG.version)}</dd>
      </dl>
      <p class="small muted">Taburan soalan mengikut bab ialah taburan latihan aplikasi ini, bukan kuota rasmi JPJ.</p>
    </section>
    <section class="card">
      <h2 class="card-title">Bank soalan</h2>
      <dl class="kv">
        <dt>Sumber utama</dt><dd>${esc(src.title)}</dd>
        <dt>Soalan aktif</dt><dd>${c.verified} (Bab 1: ${c.byChapter[1]}, Bab 2: ${c.byChapter[2]}, Bab 3: ${c.byChapter[3]}, Bab 4: ${c.byChapter[4]}, Bab 5: ${c.byChapter[5]}, Bab 6: ${c.byChapter[6]})</dd>
        <dt>Bergambar</dt><dd>${c.withImage}</dd>
        <dt>Dikecualikan</dt><dd>${c.excluded} (maklumat bercanggah atau belum disahkan)</dd>
        <dt>Versi</dt><dd>${esc(S.data.bankVersion)}</dd>
      </dl>
      <p class="small">Fakta yang boleh berubah (format ujian, kelas lesen, tempoh lesen) disemak dengan sumber kerajaan dalam talian. Ambang mata demerit KEJARA dalam buku berbeza dengan portal MyGOV, jadi soalan berkenaan dikecualikan daripada ujian.</p>
      <p class="small muted">Papan tanda dan garisan jalan ialah ilustrasi asli berdasarkan bentuk, warna dan simbol dalam buku teks.</p>
    </section>
    <section class="card">
      <h2 class="card-title">Data anda</h2>
      <p class="small">Tiada akaun diperlukan. Keputusan, soalan ditanda dan kemajuan disimpan dalam pelayar peranti ini sahaja dan tidak dihantar ke mana-mana pelayan.</p>
    </section>
  </main>`;
}

// ---------------------------------------------------------------- render
const VIEWS = { home: viewHome, practiceSetup: viewPracticeSetup, practiceRun: viewPracticeRun, practiceSummary: viewPracticeSummary, practiceReview: viewPracticeReview, examIntro: viewExamIntro, exam: viewExam, result: viewResult, review: viewReview, progress: viewProgress, about: viewAbout };
const SHEETS = { palette: sheetPalette, submit: sheetSubmit, reset: sheetReset };

function render() {
  const focusId = document.activeElement?.id;
  const html = (VIEWS[S.view] || viewHome)();
  const sheet = S.sheet && SHEETS[S.sheet] ? `<div class="sheet-backdrop" data-act="sheet-close-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">${SHEETS[S.sheet]()}</div></div>` : '';
  root.innerHTML = html + tabbar() + sheet;
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  if (S.sheet) root.querySelector('.sheet button')?.focus();
  syncTimer();
}

// ---------------------------------------------------------------- exam control
function startExam() {
  const active = store.getActiveExam();
  if (active) { resumeExam(); return; }
  const recentIds = new Set(store.getExamHistory().slice(0, EXAM_CONFIG.recentAttemptsToAvoid).flatMap((a) => a.questionIds));
  let questions;
  try { questions = selectExamQuestions(S.bank, EXAM_CONFIG, { recentIds }); }
  catch (e) { S.notice = { html: esc(e.message) }; go('examIntro'); return; }
  const attempt = createExamAttempt({ questions, config: EXAM_CONFIG, bankVersion: S.data.bankVersion });
  store.saveActiveExam(attempt);
  go('exam');
}

function resumeExam() {
  const A = store.getActiveExam();
  if (!A) { go('examIntro'); return; }
  if (isExpired(A)) { finalizeExam('resume-expired'); return; }
  go('exam');
}

function updateExam(fn) {
  const A = store.getActiveExam();
  if (!A) { go('home'); return; }
  if (isExpired(A)) { finalizeExam('timeout'); return; }
  const next = fn(A);
  store.saveActiveExam(next);
  render();
}

/** Submits the active exam exactly once, whatever triggers it. */
function finalizeExam(reason) {
  if (S.submitting) return;
  S.submitting = true;
  try {
    const A = store.getActiveExam();
    if (!A) return;
    const { attempt, alreadySubmitted } = submitAttempt(A, { now: Date.now(), reason });
    const firstTime = store.addExamResult(attempt);
    store.clearActiveExam();
    S.lastResult = attempt;
    if (!alreadySubmitted && firstTime !== false) {
      for (const q of attempt.questions) recordMistake(q, attempt.result.perQuestion[q.id] !== 'correct');
    }
    go('result', { id: attempt.id, fresh: true });
  } finally {
    S.submitting = false;
  }
}

function syncTimer() {
  const needs = S.view === 'exam' || (S.view === 'home' && store.getActiveExam()) || S.view === 'examIntro';
  if (needs && !S.timerId) S.timerId = setInterval(tick, 1000);
  if (!needs && S.timerId) { clearInterval(S.timerId); S.timerId = null; }
}

let warned = false;
function tick() {
  const A = store.getActiveExam();
  if (!A) { syncTimer(); return; }
  if (isExpired(A)) { finalizeExam('timeout'); return; }
  const rem = remainingMs(A);
  for (const el of root.querySelectorAll('[data-live-clock]')) el.textContent = S.view === 'exam' ? formatClock(rem) : `${formatClock(rem)} berbaki`;
  const t = root.querySelector('.timer');
  if (t) t.classList.toggle('low', rem < 5 * 60_000);
  if (rem < 5 * 60_000 && !warned) {
    warned = true;
    const w = document.getElementById('time-warn');
    if (w) w.textContent = 'Kurang daripada 5 minit lagi.';
  }
}

function checkExpiry() {
  const A = store.getActiveExam();
  if (A && isExpired(A)) finalizeExam(S.view === 'exam' ? 'timeout' : 'resume-expired');
  else if (S.view === 'exam') tick();
}

// ---------------------------------------------------------------- practice control
function practiceSelect(oid) {
  const P = S.practice;
  const q = P.questions[P.index];
  if (P.results[q.id]) return;
  P.selected[q.id] = oid;
  render();
}
function practiceCheck() {
  const P = S.practice;
  const q = P.questions[P.index];
  const sel = P.selected[q.id];
  if (!sel || P.results[q.id]) return;
  const res = classify(q, sel);
  P.results[q.id] = res;
  const ps = store.getPracticeStats();
  store.savePracticeStats({ ...ps, answered: ps.answered + 1, correct: ps.correct + (res === 'correct' ? 1 : 0), incorrect: ps.incorrect + (res === 'incorrect' ? 1 : 0) });
  recordMistake(q, res !== 'correct');
  render();
  root.querySelector('.feedback')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function practiceNext() {
  const P = S.practice;
  if (P.index < P.questions.length - 1) { P.index++; go('practiceRun'); } else go('practiceSummary');
}

// ---------------------------------------------------------------- events
const ACTIONS = {
  nav: (d) => go(d.view),
  resume: () => resumeExam(),
  'exam-start': () => startExam(),
  'exam-new': () => startExam(),
  'exam-exit': () => { S.notice = { html: 'Ujian disimpan. Masa terus berjalan; tekan <b>Sambung Ujian</b> untuk kembali.', kind: 'info' }; go('home'); },
  'open-result': (d) => go('result', { id: d.id }),
  'open-review': (d) => { S.reviewFilter = 'all'; S.view = 'review'; S.params = { id: d.id }; render(); window.scrollTo(0, 0); },
  'review-filter': (d) => { S.reviewFilter = d.f; render(); },
  'result-retry': (d) => {
    const A = findAttempt(d.id);
    if (!A) return;
    startPractice(A.questions.filter((q) => A.result.perQuestion[q.id] !== 'correct'), 'Ulang kaji soalan salah', 'attempt');
  },
  'practice-start': () => {
    const st = S.setup;
    const label = st.chapter === 'all' ? 'Semua bab' : `Bab ${st.chapter}`;
    const veh = st.vehicle === 'all' ? '' : ` · ${VEHICLES[st.vehicle]}`;
    startPractice(selectPracticeQuestions(S.bank, st, st.count), label + veh);
  },
  'practice-mistakes': () => startPractice(shuffle(mistakeList()), 'Ulang kaji soalan salah', 'mistakes'),
  'practice-bookmarks': () => startPractice(shuffle(store.getBookmarks().map((id) => S.byId.get(id)).filter(Boolean)), 'Soalan ditanda', 'bookmarks'),
  'practice-retry-wrong': () => { const P = S.practice; startPractice(P.questions.filter((q) => P.results[q.id] !== 'correct'), 'Ulang soalan salah', 'practice'); },
  'practice-end': () => go('practiceSummary'),
  'p-choose': (d) => practiceSelect(d.opt),
  'p-check': () => practiceCheck(),
  'p-skip': () => practiceNext(),
  'p-next': () => practiceNext(),
  bookmark: (d) => { toggleBookmark(d.q); render(); },
  'e-choose': (d) => updateExam((A) => setAnswer(A, A.questionIds[A.current], d.opt)),
  'e-clear': () => updateExam((A) => clearAnswer(A, A.questionIds[A.current])),
  'e-flag': () => updateExam((A) => toggleFlag(A, A.questionIds[A.current])),
  'e-prev': () => { updateExam((A) => goTo(A, A.current - 1)); window.scrollTo(0, 0); },
  'e-next': () => { updateExam((A) => goTo(A, A.current + 1)); window.scrollTo(0, 0); },
  'e-goto': (d) => { S.sheet = null; updateExam((A) => goTo(A, Number(d.i))); window.scrollTo(0, 0); },
  'e-first-unanswered': () => { S.sheet = null; updateExam((A) => goTo(A, A.questionIds.findIndex((id) => A.answers[id] == null))); window.scrollTo(0, 0); },
  'e-first-flagged': () => { S.sheet = null; updateExam((A) => goTo(A, A.questionIds.findIndex((id) => A.flags[id]))); window.scrollTo(0, 0); },
  'e-submit': () => finalizeExam('manual'),
  sheet: (d) => { S.sheet = d.sheet; render(); },
  'sheet-close': () => { S.sheet = null; render(); },
  'reset-confirm': () => {
    store.resetAll();
    S.practice = null; S.lastResult = null; S.sheet = null;
    S.notice = { html: 'Semua data tempatan telah dipadam.', kind: 'info' };
    go('home');
  },
};

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  if (el.dataset.act === 'sheet-close-bg') { if (e.target === el) { S.sheet = null; render(); } return; }
  if (el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  try { fn(el.dataset, el); }
  catch (err) {
    console.error(err);
    if (/tamat/.test(err.message)) { checkExpiry(); return; }
    S.notice = { html: esc(err.message) };
    render();
  }
});

root.addEventListener('change', (e) => {
  const t = e.target;
  if (t.name === 'chapter' || t.name === 'vehicle' || t.name === 'count') {
    S.setup[t.name] = t.value;
    render();
  }
});

// Replace an image that fails to load with a clear text fallback.
root.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || img.dataset.failed) return;
  img.dataset.failed = '1';
  const box = document.createElement('div');
  box.className = 'img-missing';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', img.dataset.alt || 'Gambar');
  box.textContent = `Gambar tidak dapat dimuatkan. Penerangan gambar: ${img.dataset.alt || ''}`;
  img.closest('figure')?.replaceWith(box);
}, true);

root.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.sheet) { S.sheet = null; render(); }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) checkExpiry(); });
window.addEventListener('focus', checkExpiry);
window.addEventListener('pageshow', checkExpiry);
window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('lulusKpp')) { checkExpiry(); if (S.view !== 'practiceRun') render(); } });

// ---------------------------------------------------------------- boot
async function loadData() {
  if (globalThis.__KPP_DATA__) return globalThis.__KPP_DATA__;
  const res = await fetch('data/questions.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function boot() {
  try {
    S.data = await loadData();
  } catch (e) {
    root.innerHTML = `<main class="screen"><div class="notice">${icon('alert')}<div><b>Bank soalan tidak dapat dimuatkan.</b><p class="small">Semak sambungan internet dan muat semula halaman. Selepas pemuatan pertama, aplikasi boleh digunakan tanpa internet.</p><button class="btn btn-primary" onclick="location.reload()">Cuba lagi</button></div></div></main>`;
    return;
  }
  S.bank = S.data.questions.filter(isEligible);
  S.byId = new Map(S.bank.map((q) => [q.id, q]));
  const A = store.getActiveExam();
  if (A && isExpired(A)) { finalizeExam('resume-expired'); }
  else render();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !globalThis.__KPP_NO_SW__) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable here */ });
  }
}

boot();
