// Lulus KPP: Jalan ke Lesen — user interface.
// Quiz logic lives in selection/scoring/attempt/progress; animation lives in scene.js.
// Animations only follow quiz state and never change answers or scores.
import { EXAM_CONFIG, CHAPTERS, VEHICLES } from './config.js';
import { selectExamQuestions, selectPracticeQuestions, filterPractice, isEligible } from './selection.js';
import { classify, scoreAttempt, formatPercent } from './scoring.js';
import { createExamAttempt, setAnswer, clearAnswer, toggleFlag, goTo, submitAttempt, remainingMs, isExpired, answeredCount, formatClock, formatDuration } from './attempt.js';
import { createStore } from './storage.js';
import { shuffle, newId } from './rng.js';
import { renderVis } from './visuals.js';
import { RoadScene, drawCar, drawMoto } from './scene.js';
import {
  ENVIRONMENTS, COLOURS, BADGES, normalizeGameState, buildStages, stagesOfChapter, isStageUnlocked, nextStage,
  recordAnswer, completeStage, unlockedColours, isColourUnlocked, unlockedScenes, firstAttemptStats, journeyProgress,
  normalizeSettings, motionMode, XP_PER_FIRST_CORRECT,
} from './progress.js';

const store = createStore();
const root = document.getElementById('app');
const mq = globalThis.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;

const S = {
  data: null, bank: [], byId: new Map(), stages: [],
  view: 'home', params: {},
  game: normalizeGameState(store.getGame()),
  settings: normalizeSettings(store.getSettings()),
  setup: { chapter: 'all', vehicle: 'all', count: '10', animate: null },
  mainTab: 'adventure',
  session: null, lastSession: null,
  reviewFilter: 'all', sheet: null, notice: null,
  submitting: false, timerId: null, lastResult: null,
  scenes: [], openChapter: null,
};

// ---------------------------------------------------------------- icons
const I = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
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
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  car: '<path d="M3 16v-4l2-5h14l2 5v4"/><path d="M3 16h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>',
  bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  skip: '<path d="M5 5l9 7-9 7z"/><path d="M18 5v14"/>',
};
const icon = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
const checkDraw = '<svg class="draw" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const brandMark = `<span class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><path d="M7 3L4.5 21M17 3l2.5 18" stroke="#FFFFFF" stroke-width="2.2"/><path d="M12 4v3M12 10.5v3M12 17v3" stroke="#F2A900" stroke-width="2.6"/></svg></span>`;
const markerSvg = (type) => type === 'motorcycle'
  ? '<svg viewBox="0 0 26 18" aria-hidden="true"><circle cx="5" cy="13" r="4" fill="#0B2240"/><circle cx="21" cy="13" r="4" fill="#0B2240"/><path d="M5 13L11 7h7l3 6" stroke="#0B2240" stroke-width="2.4" fill="none"/></svg>'
  : '<svg viewBox="0 0 26 18" aria-hidden="true"><path d="M2 13V9l3-5h13l4 5h2v4z" fill="#0B2240"/><circle cx="7" cy="14" r="3" fill="#0B2240" stroke="#F2A900" stroke-width="1.5"/><circle cx="19" cy="14" r="3" fill="#0B2240" stroke="#F2A900" stroke-width="1.5"/></svg>';

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LETTERS = ['A', 'B', 'C', 'D'];
const fmtDate = (t) => { try { return new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(t)); } catch { return new Date(t).toLocaleString(); } };
const chLabel = (c) => `Bab ${c}: ${CHAPTERS[c]}`;
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const colourHex = (id) => (COLOURS.find((c) => c.id === id) || COLOURS[0]).hex;
const vehicleOf = () => S.game.vehicle || { type: 'car', color: 'teal' };
const motion = () => motionMode(S.settings, !!mq?.matches);

function sourceLine(q) {
  const book = q.sources.find((s) => s.type === 'book');
  const parts = [`Buku KPP 2025, Bab ${book.chapter}, ${esc(book.section)}, hlm. ${book.printedPage}`];
  const webs = q.sources.filter((s) => s.type === 'web');
  if (webs.length) parts.push('Disahkan dalam talian: ' + webs.map((w) => `<a href="${esc(w.url)}" target="_blank" rel="noopener">${esc(S.data?.sources?.[w.key]?.title || w.key)}</a> (${esc(w.verifiedOn)})`).join('; '));
  return `<p class="source">Sumber: ${parts.join('. ')}.</p>`;
}

function figure(q) {
  if (q.image) return `<figure class="q-figure"><img src="${esc(q.image.src)}" alt="${esc(q.image.alt)}" width="160" height="160" data-alt="${esc(q.image.alt)}"></figure>`;
  if (q.vis) {
    const r = renderVis(q.vis);
    return `<figure class="q-figure">${r.svg}<details><summary>Penerangan rajah</summary><p>${esc(r.label)}</p></details></figure>`;
  }
  return '';
}

function statusPill(status) {
  if (status === 'correct') return `<span class="pill pill-ok">${icon('check')}Betul</span>`;
  if (status === 'incorrect') return `<span class="pill pill-bad">${icon('x')}Salah</span>`;
  return `<span class="pill pill-neutral">${icon('minus')}Tidak dijawab</span>`;
}

function optionVisual(o) {
  if (o.img) return `<span class="opt-fig"><img src="${esc(o.img.src)}" alt="" width="120" height="120" data-alt="${esc(o.img.alt)}"></span>`;
  if (o.vis) return `<span class="opt-fig">${renderVis(o.vis).svg.replace('role="img"', 'aria-hidden="true"')}</span>`;
  return '';
}

/** Answer cards. mode: 'learn' (play), 'exam', 'reveal' (after confirm). */
function optionsHtml(q, orderIds, { selected, reveal, disabled, act, deal, marker }) {
  const pics = q.format && q.format !== 'text';
  const cards = orderIds.map((oid, i) => {
    const o = q.options.find((x) => x.id === oid);
    const isSel = selected === oid;
    let cls = '', mark = '';
    if (reveal) {
      if (oid === q.correct) { cls = 'is-correct'; mark = `<span class="mark">${icon('check')}Jawapan betul</span>`; }
      else if (isSel) { cls = 'is-wrong'; mark = `<span class="mark">${icon('x')}Pilihan anda</span>`; }
    }
    const head = pics ? `<span class="opt-head"><span class="letter" aria-hidden="true">${LETTERS[i]}</span>${mark}</span>${optionVisual(o)}` : `<span class="letter" aria-hidden="true">${LETTERS[i]}</span>`;
    return `<button class="opt ${cls}" role="radio" aria-checked="${isSel}" data-act="${act}" data-opt="${esc(oid)}" ${disabled ? 'disabled' : ''} aria-label="Pilihan ${LETTERS[i]}: ${esc(o.text)}${reveal && oid === q.correct ? ' (jawapan betul)' : ''}${reveal && isSel && oid !== q.correct ? ' (pilihan anda, salah)' : ''}">${head}<span class="txt">${esc(o.text)}${pics ? '' : mark}</span></button>`;
  }).join('');
  return `<div class="options ${pics ? 'pics' : ''} ${deal ? 'deal' : ''}" role="radiogroup" aria-labelledby="qtext">${cards}${marker ? `<span class="veh-marker" aria-hidden="true">${markerSvg(vehicleOf().type)}</span>` : ''}</div>`;
}

const bookmarks = () => new Set(store.getBookmarks());
function toggleBookmark(qid) { const b = bookmarks(); if (b.has(qid)) b.delete(qid); else b.add(qid); store.saveBookmarks([...b]); }
function bookmarkBtn(qid) {
  const on = bookmarks().has(qid);
  return `<button class="icon-btn" data-act="bookmark" data-q="${esc(qid)}" aria-pressed="${on}">${icon('bookmark')}<span>${on ? 'Ditanda' : 'Tanda soalan'}</span></button>`;
}
function recordMistake(q, wrong) {
  const m = store.getMistakes();
  if (wrong) m[q.id] = { at: Date.now(), q }; else delete m[q.id];
  store.saveMistakes(m);
}
const mistakeList = () => Object.values(store.getMistakes()).sort((a, b) => b.at - a.at).map((x) => S.byId.get(x.q.id) || x.q);
const saveGame = () => store.saveGame(S.game);

// ---------------------------------------------------------------- sound & haptics (off unless enabled)
let actx = null;
function sfx(kind) {
  if (!S.settings.sound) return;
  try {
    actx ||= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    const tones = { select: [[620, 0.05]], correct: [[660, 0.08], [880, 0.14]], wrong: [[392, 0.12], [330, 0.16]], finish: [[523, 0.1], [659, 0.1], [784, 0.18]] }[kind];
    let t = actx.currentTime;
    for (const [f, d] of tones) {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d * 0.9;
    }
  } catch { /* audio unavailable */ }
}
function buzz(pattern) { if (S.settings.haptics && navigator.vibrate) { try { navigator.vibrate(pattern); } catch { /* ignore */ } } }

// ---------------------------------------------------------------- settings application
function applySettings() {
  const sizes = { normal: '100%', large: '112.5%', xlarge: '125%' };
  document.documentElement.style.fontSize = sizes[S.settings.textSize];
  const m = motion();
  document.documentElement.classList.toggle('motion-full', m === 'full');
  document.documentElement.classList.toggle('motion-static', m !== 'full');
  for (const sc of S.scenes) sc.setMotion(sceneMotion());
}
const sceneMotion = () => (S.view === 'play' && S.session && !S.session.animate ? 'static' : motion());

// ---------------------------------------------------------------- navigation
function destroyScenes() { for (const sc of S.scenes) sc.destroy(); S.scenes = []; }
function go(view, params = {}) {
  S.view = view;
  S.params = params;
  S.sheet = null;
  if (!['review', 'sessionReview'].includes(view)) S.reviewFilter = 'all';
  render();
  window.scrollTo(0, 0);
  const h = root.querySelector('h1, h2, [data-autofocus]');
  if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
}

const TAB_OF = { home: 'home', garage: 'home', settings: 'progress', main: 'main', sessionResult: 'main', sessionReview: 'main', examIntro: 'exam', result: 'exam', review: 'exam', progress: 'progress', about: 'progress' };
function tabbar() {
  const t = TAB_OF[S.view];
  if (!t) return '';
  const tab = (key, label, ic, view) => `<li><button class="tab" data-act="nav" data-view="${view}" ${t === key ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></button></li>`;
  return `<nav class="tabbar" aria-label="Navigasi utama"><ul>${tab('home', 'Utama', 'home', 'home')}${tab('main', 'Main', 'play', 'main')}${tab('exam', 'Ujian', 'timer', 'examIntro')}${tab('progress', 'Prestasi', 'chart', 'progress')}</ul></nav>`;
}

function storageNotice() {
  if (store.persistent) return '';
  return `<div class="notice" role="status">${icon('alert')}<div><b>Storan peranti tidak tersedia.</b><p class="small">Kemajuan, XP dan keputusan hanya disimpan sehingga halaman ini ditutup. Buka aplikasi dalam pelayar biasa (bukan mod peribadi) untuk menyimpan kemajuan.</p></div></div>`;
}
function flashNotice() {
  if (!S.notice) return '';
  const n = S.notice; S.notice = null;
  return `<div class="notice ${n.kind === 'info' ? 'info' : ''}" role="status">${icon(n.kind === 'info' ? 'info' : 'alert')}<div><p>${n.html}</p></div></div>`;
}
const sceneCard = (id, cls = '', badge = '') => `<div class="scene-card ${cls}" id="${id}-wrap"><canvas id="${id}" aria-hidden="true"></canvas>${badge ? `<span class="scene-badge">${esc(badge)}</span>` : ''}</div>`;

// ---------------------------------------------------------------- HOME
function viewHome() {
  const hist = store.getExamHistory();
  const active = store.getActiveExam();
  const mistakes = mistakeList();
  const latest = hist[0];
  const best = hist.reduce((m, a) => Math.max(m, a.result.correct), 0);
  const jp = journeyProgress(S.game, S.stages);
  const next = nextStage(S.game, S.stages);
  const cols = unlockedColours(S.game.xp);
  const scenes = unlockedScenes(S.game);
  const resume = active && active.status === 'active' ? `
    <section class="card resume" aria-labelledby="resume-h">
      <div class="card-head"><h2 class="card-title" id="resume-h">Ujian KPP belum selesai</h2><span class="pill pill-teal">${answeredCount(active)}/${active.questionIds.length} dijawab</span></div>
      <p class="muted small">Masa terus berjalan walaupun aplikasi ditutup.</p>
      <p class="clock tnum" data-live-clock>${formatClock(remainingMs(active))} berbaki</p>
      <button class="btn btn-primary btn-block" data-act="resume">${icon('timer')}Sambung Ujian</button>
    </section>` : '';
  return `
  <main class="screen">
    <header class="topbar"><div class="brand">${brandMark}<span>Lulus KPP<small>Jalan ke Lesen</small></span></div><button class="icon-link" data-act="nav" data-view="settings" aria-label="Tetapan">${icon('gear')}</button></header>
    ${storageNotice()}${flashNotice()}
    <section class="hero-text" aria-labelledby="hero-h"><h1 id="hero-h" class="title">${S.game.vehicle ? 'Teruskan perjalanan ke lesen' : 'Mulakan perjalanan ke lesen'}</h1><p class="subtitle">Jawab soalan KPP di setiap titik semak sepanjang jalan.</p></section>
    ${sceneCard('home-scene', '', ENVIRONMENTS[S.game.homeScene])}
    ${S.game.vehicle ? '' : `<div class="notice info">${icon('car')}<div><p><b>Pilih kenderaan anda dahulu.</b> Kereta atau motosikal hanya mengubah animasi; soalan kekal sama.</p><button class="btn btn-sun" data-act="nav" data-view="garage">Pilih Kenderaan</button></div></div>`}
    <div class="home-actions">
      <button class="btn btn-primary" data-act="adventure-continue">${icon('play')}${jp.done ? 'Sambung Pengembaraan' : 'Mula Pengembaraan'}</button>
      <button class="btn btn-secondary" data-act="${active ? 'resume' : 'nav'}" data-view="examIntro">${icon('timer')}Mula Ujian KPP</button>
      <button class="btn btn-secondary" data-act="open-practice">${icon('book')}Latihan Mengikut Bab</button>
    </div>
    ${mistakes.length ? `<button class="btn btn-secondary btn-block" data-act="practice-mistakes">${icon('refresh')}Ulang Kaji Kesilapan (${mistakes.length})</button>` : `<p class="small muted">${icon('refresh').replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} Ulang Kaji Kesilapan: belum ada soalan salah untuk diulang kaji.</p>`}
    ${resume}
    <section class="card" aria-labelledby="journey-h">
      <div class="card-head"><h2 class="card-title" id="journey-h">Perjalanan</h2><span class="xp-chip">${icon('bolt')}${S.game.xp} XP</span></div>
      ${jp.done ? `<div class="bar" role="img" aria-label="${jp.done} daripada ${jp.total} peringkat selesai"><i style="width:${jp.percent}%"></i></div>
      <p class="small"><b class="tnum">${jp.done}/${jp.total}</b> peringkat selesai (${jp.percent}%). Seterusnya: ${esc(chLabel(next.chapter))}, Peringkat ${next.index + 1}.</p>`
    : `<div class="empty">${icon('play')}<p>Belum ada peringkat yang diselesaikan. ${S.stages.length} peringkat menanti dalam 6 bab.</p></div>`}
      <div class="card-head"><span class="small muted">Warna dibuka: ${cols.length}/${COLOURS.length} · Latar dibuka: ${scenes.length}/${Object.keys(ENVIRONMENTS).length}</span><button class="text-btn" data-act="nav" data-view="garage">Garaj${icon('chev')}</button></div>
    </section>
    <section class="card" aria-labelledby="stats-h">
      <div class="card-head"><h2 class="card-title" id="stats-h">Ujian KPP simulasi</h2>${latest ? `<button class="text-btn" data-act="open-result" data-id="${esc(latest.id)}">Lihat terkini</button>` : ''}</div>
      ${latest ? `<div class="stats">
        <div class="stat"><span class="v">${latest.result.correct}/${latest.result.total}</span><span class="k">Skor terkini</span></div>
        <div class="stat"><span class="v">${best}/${EXAM_CONFIG.questionCount}</span><span class="k">Skor terbaik</span></div>
        <div class="stat"><span class="v">${hist.length}</span><span class="k">Ujian selesai</span></div>
      </div><p class="small muted">Terkini: ${latest.result.passed ? 'LULUS' : 'BELUM LULUS'}, ${fmtDate(latest.submittedAt)}.</p>`
    : `<div class="empty">${icon('chart')}<p>Belum ada ujian simulasi yang lengkap. Skor terkini dan skor terbaik akan dipaparkan selepas ujian pertama anda.</p></div>`}
    </section>
    <p class="footnote">${S.data.counts.verified} soalan disemak daripada buku teks KPP 2025. Aplikasi latihan bebas, tidak berafiliasi dengan JPJ.</p>
  </main>`;
}

// ---------------------------------------------------------------- GARAGE (vehicle & cosmetics)
function viewGarage() {
  const v = S.params.draft || { ...vehicleOf() };
  S.params.draft = v;
  const colours = COLOURS.map((c) => {
    const ok = isColourUnlocked(S.game.xp, c.id);
    return `<button class="colour-btn" role="radio" aria-checked="${v.color === c.id}" data-act="pick-colour" data-c="${c.id}" ${ok ? '' : 'disabled'} aria-label="${esc(c.name)}${ok ? '' : `, dibuka pada ${c.xp} XP`}"><span class="dot" style="background:${c.hex}">${ok ? (v.color === c.id ? icon('check') : '') : icon('lock')}</span>${esc(c.name)}${ok ? '' : `<span>${c.xp} XP</span>`}</button>`;
  }).join('');
  const scenes = Object.entries(ENVIRONMENTS).map(([k, name]) => {
    const ok = unlockedScenes(S.game).includes(k);
    return `<label><input type="radio" name="homeScene" id="scene-${k}" value="${k}" ${S.game.homeScene === k ? 'checked' : ''} ${ok ? '' : 'disabled'}><span>${ok ? '' : icon('lock').replace('<svg', '<svg style="width:14px;height:14px;margin-right:4px"')}${esc(name)}</span></label>`;
  }).join('');
  return `
  <main class="screen">
    <header class="topbar"><button class="back-btn" data-act="nav" data-view="home">${icon('left')}Utama</button><span class="xp-chip">${icon('bolt')}${S.game.xp} XP</span></header>
    <h1 class="title">Garaj</h1>
    <section class="card">
      <h2 class="card-title">Pilih kenderaan</h2>
      <div class="veh-grid" role="radiogroup" aria-label="Kenderaan">
        <button class="veh-card" role="radio" aria-checked="${v.type === 'car'}" data-act="pick-vehicle" data-t="car"><canvas data-veh="car" width="300" height="168" aria-hidden="true"></canvas>Kereta</button>
        <button class="veh-card" role="radio" aria-checked="${v.type === 'motorcycle'}" data-act="pick-vehicle" data-t="motorcycle"><canvas data-veh="motorcycle" width="300" height="168" aria-hidden="true"></canvas>Motosikal</button>
      </div>
      <p class="small muted">Pilihan kenderaan hanya mengubah animasi dan rupa. Simulasi Ujian KPP Gabungan tetap merangkumi sukatan kereta dan motosikal.</p>
    </section>
    <section class="card">
      <h2 class="card-title">Warna</h2>
      <div class="colour-grid" role="radiogroup" aria-label="Warna kenderaan">${colours}</div>
      <p class="small muted">Warna baharu dibuka dengan XP daripada jawapan betul pada cubaan pertama dalam Mod Pengembaraan.</p>
    </section>
    <section class="card">
      <fieldset class="field"><legend>Latar laman utama</legend><div class="seg">${scenes}</div></fieldset>
      <p class="small muted">Latar dibuka selepas anda melengkapkan peringkat dalam persekitaran itu.</p>
    </section>
    <button class="btn btn-primary btn-block" data-act="save-vehicle">${icon('check')}${S.params.next === 'adventure' ? 'Simpan & mula pengembaraan' : 'Simpan pilihan'}</button>
  </main>`;
}
function drawGarageVehicles() {
  const v = S.params.draft || vehicleOf();
  for (const c of root.querySelectorAll('canvas[data-veh]')) {
    const g = c.getContext('2d'); if (!g) continue;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#D9E6EC'; g.fillRect(0, 124, c.width, 44);
    const hex = colourHex(v.color);
    if (c.dataset.veh === 'car') drawCar(g, 150, 136, 2.2, hex, 1, 0.4, false, true);
    else drawMoto(g, 150, 136, 1.75, hex, 1, 0.4, false, true);
  }
}

// ---------------------------------------------------------------- MAIN (adventure map + free practice)
function viewMain() {
  const tab = S.mainTab;
  return `
  <main class="screen">
    <header><h1 class="title">Main</h1><p class="subtitle">Pengembaraan mengikut bab, atau latihan bebas tanpa had masa.</p></header>
    ${storageNotice()}${flashNotice()}
    <div class="tabs" role="tablist" aria-label="Mod permainan">
      <button role="tab" aria-selected="${tab === 'adventure'}" data-act="main-tab" data-t="adventure">Mod Pengembaraan</button>
      <button role="tab" aria-selected="${tab === 'practice'}" data-act="main-tab" data-t="practice">Latihan Bebas</button>
    </div>
    ${tab === 'adventure' ? adventureMap() : practiceSetup()}
  </main>`;
}

function adventureMap() {
  const next = nextStage(S.game, S.stages);
  const fa = firstAttemptStats(S.game, S.bank);
  const chapters = Object.keys(CHAPTERS).map(Number).map((ch) => {
    const list = stagesOfChapter(S.stages, ch);
    const done = list.filter((s) => S.game.stages[s.id]?.completedAt).length;
    const open = S.openChapter === ch || (S.openChapter == null && next.chapter === ch);
    const acc = fa.byChapter[ch];
    const stages = list.map((s) => {
      const rec = S.game.stages[s.id];
      const unlocked = isStageUnlocked(S.game, S.stages, s.id);
      const isNext = s.id === next.id;
      return `<button class="stage ${rec?.completedAt ? 'done' : ''} ${isNext ? 'next' : ''}" data-act="stage-start" data-s="${s.id}" ${unlocked ? '' : 'disabled'} aria-label="Peringkat ${s.index + 1}, ${s.questionIds.length} soalan, ${ENVIRONMENTS[s.env]}${rec?.completedAt ? ', selesai' : unlocked ? '' : ', dikunci sehingga peringkat sebelumnya selesai'}">
        ${rec?.perfect ? `<span class="star">${icon('star')}</span>` : ''}${unlocked ? s.index + 1 : icon('lock')}<small>${s.questionIds.length} soalan</small></button>`;
    }).join('');
    return `<section class="card chapter">
      <button class="row-btn" data-act="toggle-chapter" data-ch="${ch}" aria-expanded="${open}" style="padding:0;min-height:0">
        <span class="ch-num ${done === list.length ? 'done' : ''}">${ch}</span>
        <span class="grow"><b>${esc(CHAPTERS[ch])}</b><span class="bar" aria-hidden="true"><i style="width:${(done / list.length) * 100}%"></i></span>
        <span class="small muted tnum">${done}/${list.length} peringkat${acc ? ` · ketepatan cubaan pertama ${Math.round((acc.correct / acc.attempted) * 100)}%` : ''}</span></span>
        ${icon('chev', 'chev')}
      </button>
      ${open ? `<div class="stages">${stages}</div>` : ''}
    </section>`;
  }).join('');
  return `
    <div class="card"><div class="card-head"><span><b>Peringkat seterusnya:</b> ${esc(chLabel(next.chapter))}, Peringkat ${next.index + 1}</span><span class="xp-chip">${icon('bolt')}${S.game.xp} XP</span></div>
    <button class="btn btn-primary" data-act="adventure-continue">${icon('play')}Sambung Pengembaraan</button>
    <p class="small muted">${XP_PER_FIRST_CORRECT} XP bagi setiap jawapan betul pada cubaan pertama. Tiada bonus kelajuan dan tiada nyawa; ulang peringkat bila-bila masa.</p></div>
    ${chapters}`;
}

function practiceSetup() {
  const st = S.setup;
  const avail = filterPractice(S.bank, st).length;
  const anim = st.animate ?? (motion() === 'full');
  const chOpt = (val, label, n) => `<label class="choice"><input type="radio" name="chapter" id="ch-${val}" value="${val}" ${String(st.chapter) === String(val) ? 'checked' : ''}><span><span class="num">${val === 'all' ? '★' : val}</span><b>${esc(label)}</b><i>${n}</i></span></label>`;
  const chapters = Object.keys(CHAPTERS).map((c) => chOpt(c, CHAPTERS[c], filterPractice(S.bank, { chapter: c, vehicle: st.vehicle }).length)).join('');
  const seg = (name, val, label) => `<label><input type="radio" name="${name}" id="${name}-${val}" value="${val}" ${st[name] === val ? 'checked' : ''}><span>${label}</span></label>`;
  const nMist = mistakeList().length;
  const nBook = store.getBookmarks().filter((id) => S.byId.has(id)).length;
  const plannedN = st.count === 'all' ? avail : Math.min(Number(st.count), avail);
  return `
    ${(nMist || nBook) ? `<div class="btn-row">
      ${nMist ? `<button class="btn btn-secondary" data-act="practice-mistakes">${icon('refresh')}Kesilapan (${nMist})</button>` : ''}
      ${nBook ? `<button class="btn btn-secondary" data-act="practice-bookmarks">${icon('bookmark')}Ditanda (${nBook})</button>` : ''}
    </div>` : ''}
    <section class="card"><fieldset class="field"><legend>Pilih bab</legend>
      <div class="choice-list">${chOpt('all', 'Semua bab (campuran)', filterPractice(S.bank, { chapter: 'all', vehicle: st.vehicle }).length)}${chapters}</div>
    </fieldset></section>
    <section class="card">
      <fieldset class="field"><legend>Kenderaan</legend>
        <div class="seg">${seg('vehicle', 'all', 'Semua')}${seg('vehicle', 'motokar', 'Motokar')}${seg('vehicle', 'motosikal', 'Motosikal')}${seg('vehicle', 'bersama', 'Topik bersama')}</div>
        <p class="small muted">Motokar dan Motosikal termasuk topik bersama yang sama untuk kedua-duanya.</p>
      </fieldset>
      <fieldset class="field"><legend>Bilangan soalan</legend>
        <div class="seg tnum">${seg('count', '10', '10')}${seg('count', '20', '20')}${seg('count', 'all', `Semua (${avail})`)}</div>
      </fieldset>
      <label class="switch" for="practice-anim"><span class="lbl"><b>Animasi pemanduan</b><span class="small muted">${motion() === 'full' ? 'Kenderaan bergerak antara titik semak.' : 'Gerakan dikurangkan; paparan statik digunakan.'}</span></span><input type="checkbox" id="practice-anim" ${anim ? 'checked' : ''}><span class="track"></span></label>
    </section>
    <button class="btn btn-primary btn-block" data-act="practice-start" ${avail ? '' : 'disabled'}>${icon('book')}${avail ? `Mula latihan: ${plannedN} soalan` : 'Tiada soalan untuk pilihan ini'}</button>`;
}

// ---------------------------------------------------------------- PLAY (adventure stage / practice)
function startSession({ kind, title, questions, stageId = null, env = null, animate = true }) {
  if (!questions.length) { S.notice = { html: 'Tiada soalan untuk dimainkan.', kind: 'info' }; go('main'); return; }
  const order = {};
  for (const q of questions) order[q.id] = shuffle(q.options.map((o) => o.id));
  S.session = {
    id: newId(kind), kind, title, stageId, env: env || envForChapter(questions[0].chapter), animate,
    questions, order, index: 0, selected: {}, results: {}, xp: 0, firstCorrect: 0, phase: 'driving', startedAt: Date.now(),
  };
  if (kind === 'practice') { const ps = store.getPracticeStats(); store.savePracticeStats({ ...ps, sessions: ps.sessions + 1 }); }
  go('play');
  beginCheckpoint();
}
const envForChapter = (ch) => ({ 1: 'perumahan', 2: 'bandar', 3: 'luarbandar', 4: 'lebuhraya', 5: 'perumahan', 6: 'lebuhraya' }[ch]);

function routeHtml(sess) {
  const n = sess.questions.length;
  const i = sess.index;
  const doneCount = sess.phase === 'feedback' ? i + 1 : i;
  const dots = n <= 20 ? `<span class="route-dots">${sess.questions.map((_, k) => `<span class="route-dot ${k < doneCount ? 'done' : ''} ${k === i ? 'now' : ''}"></span>`).join('')}</span>` : '';
  return `<div class="route" role="progressbar" aria-label="Kemajuan perjalanan" aria-valuemin="0" aria-valuemax="${n}" aria-valuenow="${doneCount}">
    <span class="route-label tnum">Titik ${i + 1}/${n}</span>
    <span class="route-track"><span class="route-line"></span><span class="route-done" style="width:${(doneCount / n) * 100}%"></span>${dots}</span>
    <span class="route-flag" title="Destinasi">${icon('flag')}</span></div>`;
}

function viewPlay() {
  const sess = S.session;
  if (!sess) return viewMain();
  return `
  <main class="screen play-screen ${sess.phase !== 'driving' ? 'asking' : ''}">
    <header class="topbar"><button class="back-btn" data-act="sheet" data-sheet="leave">${icon('left')}Keluar</button><span class="small muted" style="text-align:right">${esc(sess.title)}${sess.kind === 'adventure' ? ` · <b class="tnum" id="xp-live">+${sess.xp} XP</b>` : ''}</span></header>
    <div id="route">${routeHtml(sess)}</div>
    ${sceneCard('play-scene', '', ENVIRONMENTS[sess.env])}
    <div id="panel">${panelHtml(sess)}</div>
  </main>
  <div class="confirm-bar" id="bar">${barHtml(sess)}</div>`;
}

function panelHtml(sess) {
  const q = sess.questions[sess.index];
  if (sess.phase === 'driving') {
    return `<div class="driving-note" role="status"><span>Menuju Titik Semak ${sess.index + 1}…</span><button class="text-btn" data-act="skip-drive">${icon('skip')}Langkau animasi</button></div>`;
  }
  const res = sess.results[q.id];
  const reveal = sess.phase === 'feedback';
  const fb = reveal ? feedbackHtml(sess, q, res) : '';
  return `<article class="card q-card ${sess.phase === 'question' ? 'enter' : ''}" data-qid="${esc(q.id)}">
    <div class="q-meta"><span class="eyebrow">${esc(chLabel(q.chapter))}</span><span class="pill pill-neutral">${esc(VEHICLES[q.vehicle])}</span></div>
    ${figure(q)}
    <h2 class="q-text" id="qtext">${esc(q.text)}</h2>
    ${optionsHtml(q, sess.order[q.id], { selected: sess.selected[q.id], reveal, disabled: reveal, act: 'p-choose', deal: sess.phase === 'question', marker: !reveal })}
    ${fb}
    <div class="q-meta">${bookmarkBtn(q.id)}</div>
  </article>`;
}

function feedbackHtml(sess, q, res) {
  if (res === 'unanswered') return `<div class="feedback bad" role="status"><p class="verdict">${icon('minus')}Tidak dijawab</p><p><b>Jawapan betul:</b> ${esc(q.options.find((o) => o.id === q.correct).text)}</p><p>${esc(q.explanation)}</p>${sourceLine(q)}</div>`;
  const ok = res === 'correct';
  const xp = sess.lastXp ? `<span class="xp-chip xp-gain">${icon('bolt')}+${sess.lastXp} XP</span>` : '';
  const notFirst = sess.kind === 'adventure' && sess.lastFirstTime === false ? '<p class="small muted">Soalan ini pernah dijawab sebelum ini; XP hanya diberi untuk cubaan pertama.</p>' : '';
  return `<div class="feedback ${ok ? 'ok' : 'bad'}" role="status">
    <p class="verdict">${ok ? checkDraw : icon('x')}${ok ? 'Betul!' : 'Belum tepat'}</p>
    ${ok ? '' : `<p><b>Jawapan betul:</b> ${esc(q.options.find((o) => o.id === q.correct).text)}</p>`}
    <p>${esc(q.explanation)}</p>${xp}${notFirst}${sourceLine(q)}</div>`;
}

function barHtml(sess) {
  const last = sess.index === sess.questions.length - 1;
  if (sess.phase === 'driving') return `<div class="confirm-inner"><button class="btn btn-secondary btn-block" data-act="skip-drive">${icon('skip')}Langkau animasi</button></div>`;
  if (sess.phase === 'question') {
    const sel = sess.selected[sess.questions[sess.index].id];
    return `<div class="confirm-inner"><button class="btn btn-secondary" data-act="p-skip">Langkau</button><button class="btn btn-sun" data-act="p-confirm" id="confirm-btn" ${sel ? '' : 'disabled'}>${icon('check')}Sahkan Jawapan</button></div>`;
  }
  return `<div class="confirm-inner"><button class="btn btn-primary" data-act="p-next" id="next-btn">${last ? 'Lihat keputusan' : 'Teruskan'}${icon('right')}</button></div>`;
}

function updatePlay({ focus } = {}) {
  const sess = S.session;
  if (!sess || S.view !== 'play') return;
  const route = document.getElementById('route');
  const panel = document.getElementById('panel');
  const bar = document.getElementById('bar');
  if (!panel) { render(); return; }
  route.innerHTML = routeHtml(sess);
  root.querySelector('.play-screen')?.classList.toggle('asking', sess.phase !== 'driving');
  panel.innerHTML = panelHtml(sess);
  bar.innerHTML = barHtml(sess);
  const xp = document.getElementById('xp-live'); if (xp) xp.textContent = `+${sess.xp} XP`;
  const badge = root.querySelector('#play-scene-wrap .scene-badge'); if (badge) badge.textContent = ENVIRONMENTS[sess.env];
  if (focus === 'question') document.getElementById('qtext')?.setAttribute('tabindex', '-1'), document.getElementById('qtext')?.focus({ preventScroll: true });
  if (focus === 'feedback') root.querySelector('.feedback')?.scrollIntoView({ behavior: motion() === 'full' ? 'smooth' : 'auto', block: 'nearest' });
  if (focus === 'next') document.getElementById('next-btn')?.focus({ preventScroll: true });
}

function beginCheckpoint() {
  const sess = S.session;
  const i = sess.index;
  const q = sess.questions[i];
  if (sess.kind === 'practice') { const env = envForChapter(q.chapter); if (env !== sess.env) sess.env = env; }
  sess.phase = 'driving';
  updatePlay();
  const scene = S.scenes[0];
  if (scene) scene.setEnv(sess.env);
  const p = scene ? scene.driveToCheckpoint(`Titik ${i + 1}`) : Promise.resolve();
  p.then(() => {
    if (S.session !== sess || sess.index !== i || sess.phase !== 'driving') return;
    sess.phase = 'question';
    updatePlay({ focus: 'question' });
  });
}

function skipDrive() {
  const scene = S.scenes[0];
  if (scene) scene.finishAnim();
  else if (S.session?.phase === 'driving') { S.session.phase = 'question'; updatePlay({ focus: 'question' }); }
}

function playSelect(oid, el) {
  const sess = S.session;
  if (!sess || sess.phase !== 'question') return;
  const q = sess.questions[sess.index];
  if (!q.options.some((o) => o.id === oid)) return;
  sess.selected[q.id] = oid;
  // Patch in place so the cards stay still apart from the brief highlight.
  for (const b of root.querySelectorAll('.options .opt')) {
    const on = b.dataset.opt === oid;
    b.setAttribute('aria-checked', String(on));
    b.classList.toggle('pop', on && motion() === 'full');
  }
  const marker = root.querySelector('.veh-marker');
  if (marker && el) {
    marker.style.top = `${el.offsetTop + Math.min(el.offsetHeight / 2, 40) - 12}px`;
    marker.style.left = `${el.offsetLeft}px`;
    marker.classList.add('on');
  }
  const btn = document.getElementById('confirm-btn'); if (btn) btn.disabled = false;
  sfx('select'); buzz(8);
}

function playConfirm() {
  const sess = S.session;
  if (!sess || sess.phase !== 'question') return;
  const q = sess.questions[sess.index];
  const sel = sess.selected[q.id];
  if (!sel) return;
  const res = classify(q, sel);
  sess.results[q.id] = res;
  sess.lastXp = 0; sess.lastFirstTime = null;
  if (sess.kind === 'adventure') {
    const r = recordAnswer(S.game, q.id, res === 'correct');
    S.game = r.state; sess.lastXp = r.xpGained; sess.lastFirstTime = r.firstTime; sess.xp += r.xpGained;
    if (r.firstTime && res === 'correct') sess.firstCorrect++;
    saveGame();
  } else {
    const ps = store.getPracticeStats();
    store.savePracticeStats({ ...ps, answered: ps.answered + 1, correct: ps.correct + (res === 'correct' ? 1 : 0), incorrect: ps.incorrect + (res === 'incorrect' ? 1 : 0) });
  }
  recordMistake(q, res !== 'correct');
  sess.phase = 'feedback';
  updatePlay({ focus: 'feedback' });
  if (res === 'correct') { sfx('correct'); buzz(15); } else { sfx('wrong'); buzz([20, 40, 20]); }
}

function playSkip() {
  const sess = S.session;
  if (!sess || sess.phase !== 'question') return;
  const q = sess.questions[sess.index];
  sess.results[q.id] = 'unanswered';
  delete sess.selected[q.id];
  recordMistake(q, true);
  sess.lastXp = 0; sess.lastFirstTime = null;
  sess.phase = 'feedback';
  updatePlay({ focus: 'feedback' });
}

function playNext() {
  const sess = S.session;
  if (!sess || sess.phase !== 'feedback') return;
  if (sess.index >= sess.questions.length - 1) { finishSession(); return; }
  sess.index++;
  beginCheckpoint();
}

function sessionCounts(sess) {
  const byChapter = {};
  let correct = 0, incorrect = 0, unanswered = 0;
  for (const q of sess.questions) {
    const r = sess.results[q.id] || 'unanswered';
    if (r === 'correct') correct++; else if (r === 'incorrect') incorrect++; else unanswered++;
    const c = (byChapter[q.chapter] ||= { total: 0, correct: 0, incorrect: 0, unanswered: 0 });
    c.total++; c[r]++;
  }
  return { total: sess.questions.length, correct, incorrect, unanswered, percent: pct(correct, sess.questions.length), byChapter };
}

function finishSession({ early = false } = {}) {
  const sess = S.session;
  if (!sess) return;
  sess.endedAt = Date.now();
  const counts = sessionCounts(sess);
  let newBadges = [], newUnlocks = [];
  if (sess.kind === 'adventure' && sess.stageId && !early) {
    const answers = Object.fromEntries(sess.questions.map((q) => [q.id, sess.results[q.id] || 'unanswered']));
    const r = completeStage(S.game, S.stages, sess.stageId, answers);
    S.game = r.state; newBadges = r.newBadges; newUnlocks = r.newUnlocks;
    saveGame();
  }
  const summary = { id: sess.id, kind: sess.kind, title: sess.title, stageId: sess.stageId, at: sess.endedAt, timeUsedMs: sess.endedAt - sess.startedAt, xp: sess.xp, early, ...counts };
  if (Object.keys(sess.results).length) store.addSession(summary);
  S.lastSession = { ...summary, newBadges, newUnlocks, questions: sess.questions, order: sess.order, selected: sess.selected, results: sess.results };
  S.session = null;
  sfx('finish');
  go('sessionResult');
}

function chapterBars(byChapter) {
  return Object.entries(byChapter).sort(([a], [b]) => a - b).map(([c, v]) => `
    <div class="chbar"><div class="lbl"><b>${esc(chLabel(c))}</b><span class="tnum">${v.correct}/${v.total}</span></div>
    <div class="bar" role="img" aria-label="Bab ${c}: ${v.correct} betul daripada ${v.total}"><i style="width:${(v.correct / v.total) * 100}%"></i></div></div>`).join('');
}
function breakdown(r) {
  return `<div class="stats four">
    <div class="stat"><span class="v tnum">${r.correct}</span><span class="k k-ok">${icon('check')}Betul</span></div>
    <div class="stat"><span class="v tnum">${r.incorrect}</span><span class="k k-bad">${icon('x')}Salah</span></div>
    <div class="stat"><span class="v tnum">${r.unanswered}</span><span class="k">${icon('minus')}Tidak dijawab</span></div>
    <div class="stat"><span class="v tnum">${formatPercent(r.percent)}</span><span class="k">Markah</span></div>
  </div>`;
}

function viewSessionResult() {
  const L = S.lastSession;
  if (!L) return viewMain();
  const wrong = L.incorrect + L.unanswered;
  const stage = L.stageId ? S.stages.find((s) => s.id === L.stageId) : null;
  const nextSt = stage ? S.stages.find((s) => s.chapter === stage.chapter && s.index === stage.index + 1) : null;
  const badges = L.newBadges.map((b) => `<span class="badge">${icon('star')}${esc(BADGES[b]?.name || b)}</span>`).join('');
  const unlocks = L.newUnlocks.map((c) => `<span class="badge">${icon('car')}Warna baharu: ${esc(COLOURS.find((x) => x.id === c)?.name)}</span>`).join('');
  return `
  <main class="screen">
    <header><p class="eyebrow">${L.kind === 'adventure' ? 'Peringkat selesai' : 'Latihan selesai'}</p><h1 class="title">${esc(L.title)}</h1></header>
    <section class="verdict-card neutral">
      <p class="big-score">Jawapan betul: <span class="n tnum">${L.correct}/${L.total}</span></p>
      ${L.kind === 'adventure' ? `<span class="xp-chip">${icon('bolt')}+${L.xp} XP</span>` : ''}
    </section>
    <section class="card">
      ${breakdown(L)}
      <p class="small"><b>Masa digunakan:</b> ${formatDuration(L.timeUsedMs)}</p>
      <p class="small muted">${L.kind === 'adventure' ? 'XP dan ketepatan cubaan pertama disimpan berasingan daripada keputusan ujian simulasi.' : 'Statistik latihan disimpan berasingan daripada keputusan ujian simulasi.'}</p>
    </section>
    ${(badges || unlocks) ? `<section class="card"><h2 class="card-title">Ganjaran baharu</h2><div class="badges">${badges}${unlocks}</div></section>` : ''}
    <div class="btn-stack">
      <button class="btn btn-primary" data-act="nav" data-view="sessionReview">Semak Jawapan</button>
      ${nextSt ? `<button class="btn btn-sun" data-act="stage-start" data-s="${nextSt.id}">${icon('play')}Peringkat seterusnya</button>` : ''}
      ${wrong ? `<button class="btn btn-secondary" data-act="session-retry-wrong">${icon('refresh')}Ulang soalan salah (${wrong})</button>` : ''}
      ${stage ? `<button class="btn btn-secondary" data-act="stage-start" data-s="${stage.id}">${icon('refresh')}Main semula peringkat</button>` : ''}
      <button class="btn btn-ghost" data-act="nav" data-view="${L.kind === 'adventure' ? 'main' : 'main'}">Kembali ke ${L.kind === 'adventure' ? 'peta' : 'latihan'}</button>
    </div>
    <section class="card"><h2 class="card-title">Prestasi mengikut bab</h2><div class="chbars">${chapterBars(L.byChapter)}</div></section>
  </main>`;
}

function reviewList(items, filter, emptyMsg) {
  const shown = items.filter((it) => filter === 'all' || it.status === filter);
  if (!shown.length) return `<div class="card"><p class="muted">${emptyMsg}</p></div>`;
  return shown.map((it) => {
    const { q, n, chosen, status } = it;
    const ch = chosen ? q.options.find((o) => o.id === chosen) : null;
    const co = q.options.find((o) => o.id === q.correct);
    const thumb = (o) => (o?.img ? `<img src="${esc(o.img.src)}" alt="">` : o?.vis ? renderVis(o.vis).svg.replace('role="img"', 'aria-hidden="true"') : '');
    return `
    <article class="card review-item" aria-label="Soalan ${n}">
      <div class="card-head"><span class="q-count tnum">Soalan ${n}</span>${statusPill(status)}</div>
      ${figure(q)}
      <h3 class="q-text">${esc(q.text)}</h3>
      <div class="ans">
        ${status === 'unanswered'
          ? `<p class="ans-line">${icon('minus')}<span><b>Jawapan anda:</b> Tidak dijawab</span></p>`
          : `<p class="ans-line ${status === 'correct' ? 'ok' : 'bad'}">${icon(status === 'correct' ? 'check' : 'x')}${thumb(ch)}<span><b>Jawapan anda:</b> ${esc(ch?.text)}</span></p>`}
        ${status === 'correct' ? '' : `<p class="ans-line ok">${icon('check')}${thumb(co)}<span><b>Jawapan betul:</b> ${esc(co.text)}</span></p>`}
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
function viewSessionReview() {
  const L = S.lastSession;
  if (!L) return viewMain();
  const items = L.questions.map((q, i) => ({ q, n: i + 1, chosen: L.results[q.id] && L.results[q.id] !== 'unanswered' ? L.selected[q.id] : null, status: L.results[q.id] || 'unanswered' }));
  return `
  <main class="screen">
    <header class="topbar"><button class="back-btn" data-act="nav" data-view="sessionResult">${icon('left')}Keputusan</button><span class="small muted tnum">${L.correct}/${L.total} betul</span></header>
    <h1 class="title">Semak jawapan</h1>
    ${filterBar(items)}
    ${reviewList(items, S.reviewFilter, 'Tiada soalan dalam kategori ini.')}
  </main>`;
}

// ---------------------------------------------------------------- EXAM
function viewExamIntro() {
  const active = store.getActiveExam();
  const d = EXAM_CONFIG.practiceDistribution;
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
      <div class="prose small"><ul>
        <li>Satu markah bagi setiap jawapan betul. Tiada markah negatif.</li>
        <li><b>Jawapan betul dan penjelasan hanya dipaparkan selepas ujian dihantar.</b> Tiada XP atau reaksi kenderaan semasa ujian.</li>
        <li>Anda boleh menukar jawapan, bergerak ke soalan sebelum atau seterusnya, dan menanda soalan untuk disemak semula.</li>
        <li>Masa terus berjalan walaupun anda menutup aplikasi. Ujian dihantar secara automatik apabila masa tamat.</li>
        <li>Soalan merangkumi kereta dan motosikal, walau apa pun kenderaan pilihan anda dalam permainan.</li>
      </ul></div>
    </section>
    ${active ? `<button class="btn btn-primary btn-block" data-act="resume">${icon('timer')}Sambung Ujian (${formatClock(remainingMs(active))} berbaki)</button>` : `<button class="btn btn-primary btn-block" data-act="exam-start">${icon('timer')}Mula Ujian KPP</button>`}
    <section class="card">
      <h2 class="card-title">Tentang format ini</h2>
      <p class="small">Bilangan soalan, masa dan markah lulus mengikut FAQ KPP Gabungan JPJ (berkuat kuasa 29 Ogos 2025, disemak ${esc(EXAM_CONFIG.source.verifiedOn)}, disemak semula ${esc(EXAM_CONFIG.source.recheckedOn)}). Soalan aplikasi ini ialah soalan latihan asli berdasarkan buku teks, bukan soalan sebenar JPJ, dan antara muka ini tidak meniru perisian ujian rasmi.</p>
      <p class="small muted">Taburan soalan setiap ujian ialah taburan latihan aplikasi ini sendiri (bukan kuota rasmi JPJ): Bab 1: ${d[1]}, Bab 2: ${d[2]}, Bab 3: ${d[3]}, Bab 4: ${d[4]}, Bab 5: ${d[5]}, Bab 6: ${d[6]}.</p>
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
      <div class="q-meta"><span class="eyebrow">${esc(chLabel(q.chapter))}</span>${flagged ? `<span class="pill pill-sun">${icon('flag')}Ditanda</span>` : ''}</div>
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
  return `<div class="sheet-handle" aria-hidden="true"></div>
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
  return `<div class="sheet-handle" aria-hidden="true"></div>
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
  return `<div class="sheet-handle" aria-hidden="true"></div>
    <h2 id="sheet-h">Padam semua data tempatan?</h2>
    <p>Ini akan memadam keputusan ujian, ujian yang sedang berjalan, kemajuan pengembaraan, XP, warna yang dibuka, statistik latihan, soalan ditanda, senarai kesilapan dan tetapan daripada peranti ini. Tindakan ini tidak boleh dibatalkan.</p>
    <button class="btn btn-danger" data-act="reset-confirm">${icon('trash')}Ya, padam semua</button>
    <button class="btn btn-secondary" data-act="sheet-close">Batal</button>`;
}
function sheetLeave() {
  const sess = S.session;
  const done = sess ? Object.keys(sess.results).length : 0;
  return `<div class="sheet-handle" aria-hidden="true"></div>
    <h2 id="sheet-h">Keluar dari ${sess?.kind === 'adventure' ? 'peringkat' : 'latihan'} ini?</h2>
    <p>${done ? `${done} jawapan yang sudah disahkan kekal disimpan${sess?.kind === 'adventure' ? ' (termasuk XP dan cubaan pertama)' : ''}.` : 'Belum ada jawapan yang disahkan.'} ${sess?.kind === 'adventure' ? 'Peringkat hanya dikira selesai apabila semua titik semak dilalui.' : ''}</p>
    ${done ? `<button class="btn btn-secondary" data-act="leave-results">Tamat & lihat keputusan</button>` : ''}
    <button class="btn btn-danger" data-act="leave-confirm">Keluar</button>
    <button class="btn btn-primary" data-act="sheet-close">Teruskan perjalanan</button>`;
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
  const reasonNote = A.submitReason === 'timeout' ? `<div class="notice info">${icon('info')}<div><p>Masa tamat. Ujian dihantar secara automatik.</p></div></div>`
    : A.submitReason === 'resume-expired' ? `<div class="notice info">${icon('info')}<div><p>Masa ujian tamat semasa aplikasi ditutup. Ujian dihantar menggunakan jawapan yang telah disimpan.</p></div></div>` : '';
  return `
  <main class="screen">
    <header><p class="eyebrow">${esc(cfg.name)} · ${fmtDate(A.submittedAt)}</p><h1 class="visually-hidden">Keputusan ujian</h1></header>
    ${S.params.fresh ? reasonNote : ''}
    <section class="verdict-card ${r.passed ? 'pass' : 'fail'}" aria-label="Keputusan">
      <p class="verdict-badge">${icon(r.passed ? 'check' : 'x')}${r.passed ? 'LULUS' : 'BELUM LULUS'}</p>
      <p class="big-score">Jawapan betul: <span class="n tnum">${r.correct}/${r.total}</span></p>
      <p class="small"><b>Minimum lulus: ${cfg.passMark}/${cfg.questionCount}</b>${r.passed ? '' : `. Anda perlukan ${cfg.passMark - r.correct} lagi jawapan betul.`}</p>
    </section>
    ${sceneCard('result-scene', 'short', r.passed ? 'Destinasi: Lesen' : 'Titik Pembelajaran')}
    <p class="small">${r.passed ? 'Tahniah! Anda sampai ke destinasi. Teruskan latihan supaya bersedia untuk ujian sebenar.' : 'Hampir sampai. Berhenti di titik pembelajaran ini, latih topik yang lemah, kemudian cuba lagi.'}</p>
    <section class="card">
      ${breakdown(r)}
      <p class="small"><b>Masa digunakan:</b> ${formatDuration(A.timeUsedMs)} daripada ${cfg.durationMinutes} minit</p>
    </section>
    <div class="btn-stack">
      <button class="btn btn-primary" data-act="open-review" data-id="${esc(A.id)}">Semak Jawapan</button>
      ${r.passed ? '' : `<button class="btn btn-sun" data-act="weak-practice" data-id="${esc(A.id)}">${icon('book')}Latih topik lemah</button>`}
      ${(r.incorrect + r.unanswered) ? `<button class="btn btn-secondary" data-act="result-retry" data-id="${esc(A.id)}">${icon('refresh')}Ulang Kaji Kesilapan (${r.incorrect + r.unanswered})</button>` : ''}
      <button class="btn btn-secondary" data-act="exam-new">${icon('timer')}Cuba Ujian Baharu</button>
      <button class="btn btn-ghost" data-act="nav" data-view="home">Kembali ke Utama</button>
    </div>
    <section class="card"><h2 class="card-title">Prestasi mengikut bab</h2><div class="chbars">${chapterBars(r.byChapter)}</div></section>
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

// ---------------------------------------------------------------- PROGRESS / SETTINGS / ABOUT
function viewProgress() {
  const hist = store.getExamHistory();
  const ps = store.getPracticeStats();
  const sessions = store.getSessions();
  const passed = hist.filter((a) => a.result.passed).length;
  const best = hist.reduce((m, a) => Math.max(m, a.result.correct), 0);
  const jp = journeyProgress(S.game, S.stages);
  const fa = firstAttemptStats(S.game, S.bank);
  const recent = hist.slice(0, 8).map((a) => `
    <li><button class="row-btn" data-act="open-result" data-id="${esc(a.id)}">
      <span class="grow"><b class="tnum">${a.result.correct}/${a.result.total} · ${formatPercent(a.result.percent)}</b><span class="small muted">${fmtDate(a.submittedAt)}</span></span>
      ${a.result.passed ? `<span class="pill pill-ok">${icon('check')}LULUS</span>` : `<span class="pill pill-bad">${icon('x')}BELUM LULUS</span>`}${icon('chev', 'chev')}
    </button></li>`).join('');
  const recentSess = sessions.slice(0, 6).map((s) => `<li class="row-btn" style="cursor:default"><span class="grow"><b>${esc(s.title)}</b><span class="small muted">${s.kind === 'adventure' ? 'Pengembaraan' : 'Latihan'} · ${fmtDate(s.at)} · ${formatDuration(s.timeUsedMs)}</span></span><span class="tnum small"><b>${s.correct}/${s.total}</b></span></li>`).join('');
  const badges = Object.entries(BADGES).map(([id, b]) => S.game.badges[id]
    ? `<span class="badge" title="${esc(b.desc)}">${icon('star')}${esc(b.name)}</span>`
    : `<span class="badge locked" title="${esc(b.desc)}">${icon('lock')}${esc(b.name)}</span>`).join('');
  const answered = ps.correct + ps.incorrect;
  const chAcc = Object.keys(CHAPTERS).map((c) => { const v = fa.byChapter[c]; return v ? `<div class="chbar"><div class="lbl"><b>${esc(chLabel(c))}</b><span class="tnum">${v.correct}/${v.attempted}</span></div><div class="bar sun" role="img" aria-label="Bab ${c}: ${v.correct} betul daripada ${v.attempted} cubaan pertama"><i style="width:${(v.correct / v.attempted) * 100}%"></i></div></div>` : ''; }).join('');
  return `
  <main class="screen">
    <header class="topbar"><h1 class="title">Prestasi</h1><button class="icon-link" data-act="nav" data-view="settings" aria-label="Tetapan">${icon('gear')}</button></header>
    ${storageNotice()}${flashNotice()}
    <section class="card">
      <div class="card-head"><h2 class="card-title">Pengembaraan</h2><span class="xp-chip">${icon('bolt')}${S.game.xp} XP</span></div>
      <div class="stats">
        <div class="stat"><span class="v tnum">${jp.done}/${jp.total}</span><span class="k">Peringkat selesai</span></div>
        <div class="stat"><span class="v tnum">${fa.attempted}</span><span class="k">Soalan dicuba</span></div>
        <div class="stat"><span class="v tnum">${fa.attempted ? Math.round((fa.correct / fa.attempted) * 100) + '%' : '–'}</span><span class="k">Ketepatan cubaan pertama</span></div>
      </div>
      ${chAcc ? `<div class="chbars">${chAcc}</div>` : `<div class="empty">${icon('play')}<p>Belum ada soalan dijawab dalam Mod Pengembaraan.</p></div>`}
      <h3 class="eyebrow">Lencana</h3><div class="badges">${badges}</div>
      <button class="text-btn" data-act="nav" data-view="garage">Garaj: kenderaan, warna & latar${icon('chev')}</button>
    </section>
    <section class="card">
      <h2 class="card-title">Ujian KPP simulasi</h2>
      ${hist.length ? `<div class="stats">
        <div class="stat"><span class="v">${hist.length}</span><span class="k">Ujian selesai</span></div>
        <div class="stat"><span class="v">${best}/${EXAM_CONFIG.questionCount}</span><span class="k">Skor terbaik</span></div>
        <div class="stat"><span class="v">${Math.round((passed / hist.length) * 100)}%</span><span class="k">Kadar lulus</span></div>
      </div><h3 class="eyebrow">Keputusan terkini</h3><ul class="list">${recent}</ul>`
    : `<div class="empty">${icon('chart')}<p>Belum ada ujian simulasi yang lengkap.</p></div><button class="btn btn-primary" data-act="nav" data-view="examIntro">Mula Ujian KPP</button>`}
    </section>
    <section class="card">
      <h2 class="card-title">Latihan Bebas</h2>
      ${ps.sessions ? `<div class="stats">
        <div class="stat"><span class="v">${ps.sessions}</span><span class="k">Sesi dimulakan</span></div>
        <div class="stat"><span class="v">${answered}</span><span class="k">Soalan disemak</span></div>
        <div class="stat"><span class="v">${answered ? Math.round((ps.correct / answered) * 100) + '%' : '–'}</span><span class="k">Ketepatan</span></div>
      </div>` : `<div class="empty">${icon('book')}<p>Belum ada sesi latihan bebas.</p></div>`}
      ${recentSess ? `<h3 class="eyebrow">Sesi terkini</h3><ul class="list">${recentSess}</ul>` : ''}
    </section>
    <section class="card"><ul class="list">
      <li><button class="row-btn" data-act="nav" data-view="settings"><span class="grow"><b>Tetapan</b><span class="small muted">Animasi, gerakan, bunyi, getaran, saiz teks</span></span>${icon('chev', 'chev')}</button></li>
      <li><button class="row-btn" data-act="nav" data-view="about"><span class="grow"><b>Tentang Lulus KPP</b><span class="small muted">Sumber, format ujian dan penafian</span></span>${icon('chev', 'chev')}</button></li>
      <li><button class="row-btn" data-act="sheet" data-sheet="reset"><span class="grow"><b style="color:var(--bad)">Padam data tempatan</b><span class="small muted">Buang semua kemajuan dari peranti ini</span></span>${icon('trash', 'chev')}</button></li>
    </ul></section>
  </main>`;
}

function viewSettings() {
  const s = S.settings;
  const sw = (id, label, desc, on) => `<label class="switch" for="${id}"><span class="lbl"><b>${label}</b><span class="small muted">${desc}</span></span><input type="checkbox" id="${id}" data-setting="${id.replace('set-', '')}" ${on ? 'checked' : ''}><span class="track"></span></label>`;
  const seg = (name, val, label) => `<label><input type="radio" name="${name}" id="${name}-${val}" value="${val}" ${s[name] === val ? 'checked' : ''}><span>${label}</span></label>`;
  return `
  <main class="screen">
    <header class="topbar"><button class="back-btn" data-act="nav" data-view="progress">${icon('left')}Prestasi</button></header>
    <h1 class="title">Tetapan</h1>
    <section class="card">
      ${sw('set-animation', 'Animasi', 'Kenderaan bergerak antara titik semak dan kad jawapan beranimasi.', s.animation)}
      <fieldset class="field"><legend>Kurangkan gerakan</legend>
        <div class="seg">${seg('reducedMotion', 'auto', 'Ikut peranti')}${seg('reducedMotion', 'on', 'Hidup')}${seg('reducedMotion', 'off', 'Mati')}</div>
        <p class="small muted">${mq?.matches ? 'Peranti anda meminta gerakan dikurangkan.' : 'Peranti anda tidak meminta gerakan dikurangkan.'} Dengan gerakan dikurangkan, perjalanan ditunjukkan sebagai kemajuan statik.</p>
      </fieldset>
      ${sw('set-sound', 'Bunyi', 'Bunyi ringkas apabila memilih dan menyemak jawapan.', s.sound)}
      ${sw('set-haptics', 'Getaran', 'Getaran ringan pada peranti yang menyokongnya.', s.haptics)}
      <fieldset class="field"><legend>Saiz teks</legend>
        <div class="seg">${seg('textSize', 'normal', 'Biasa')}${seg('textSize', 'large', 'Besar')}${seg('textSize', 'xlarge', 'Sangat besar')}</div>
      </fieldset>
    </section>
    <button class="btn btn-secondary btn-block" data-act="nav" data-view="garage">${icon('car')}Tukar kenderaan & warna</button>
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
      <p class="small">"Jalan ke Lesen" ialah kuiz pembelajaran bertemakan pemanduan, bukan penilaian kemahiran memandu. Soalan ialah soalan latihan asli berdasarkan buku teks, bukan soalan sebenar ujian JPJ.</p>
    </section>
    <section class="card">
      <h2 class="card-title">Format ujian</h2>
      <dl class="kv">
        <dt>Format</dt><dd>${EXAM_CONFIG.questionCount} soalan • ${EXAM_CONFIG.durationMinutes} minit • Lulus ${EXAM_CONFIG.passMark}/${EXAM_CONFIG.questionCount}</dd>
        <dt>Sumber</dt><dd><a href="${esc(EXAM_CONFIG.source.url)}" target="_blank" rel="noopener">${esc(EXAM_CONFIG.source.title)}</a></dd>
        <dt>Berkuat kuasa</dt><dd>29 Ogos 2025</dd>
        <dt>Disemak pada</dt><dd>${esc(EXAM_CONFIG.source.verifiedOn)} (semakan semula ${esc(EXAM_CONFIG.source.recheckedOn)})</dd>
        <dt>Versi</dt><dd>${esc(EXAM_CONFIG.version)}</dd>
      </dl>
    </section>
    <section class="card">
      <h2 class="card-title">Bank soalan</h2>
      <dl class="kv">
        <dt>Sumber utama</dt><dd>${esc(src.title)}</dd>
        <dt>Soalan aktif</dt><dd>${c.verified} (Bab 1: ${c.byChapter[1]}, Bab 2: ${c.byChapter[2]}, Bab 3: ${c.byChapter[3]}, Bab 4: ${c.byChapter[4]}, Bab 5: ${c.byChapter[5]}, Bab 6: ${c.byChapter[6]})</dd>
        <dt>Soalan bergambar</dt><dd>${c.withImage} papan tanda/garisan, ${c.pictureAnswers} jawapan bergambar, ${c.withDiagram} rajah</dd>
        <dt>Dikecualikan</dt><dd>${c.excluded} (maklumat bercanggah atau belum disahkan)</dd>
        <dt>Versi</dt><dd>${esc(S.data.bankVersion)}</dd>
      </dl>
      <p class="small">Fakta yang boleh berubah disemak dengan sumber kerajaan dalam talian. Ambang mata demerit KEJARA dalam buku berbeza dengan portal MyGOV, jadi soalan berkenaan dikecualikan. Papan tanda, rajah dan kenderaan ialah ilustrasi asli.</p>
    </section>
    <section class="card"><h2 class="card-title">Data anda</h2><p class="small">Tiada akaun diperlukan. Semua kemajuan disimpan dalam pelayar peranti ini sahaja dan tidak dihantar ke mana-mana pelayan.</p></section>
  </main>`;
}

// ---------------------------------------------------------------- render & mount
const VIEWS = { home: viewHome, garage: viewGarage, main: viewMain, play: viewPlay, sessionResult: viewSessionResult, sessionReview: viewSessionReview, examIntro: viewExamIntro, exam: viewExam, result: viewResult, review: viewReview, progress: viewProgress, settings: viewSettings, about: viewAbout };
const SHEETS = { palette: sheetPalette, submit: sheetSubmit, reset: sheetReset, leave: sheetLeave };

function render() {
  const focusId = document.activeElement?.id;
  destroyScenes();
  const html = (VIEWS[S.view] || viewHome)();
  const sheet = S.sheet && SHEETS[S.sheet] ? `<div class="sheet-backdrop" data-act="sheet-close-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">${SHEETS[S.sheet]()}</div></div>` : '';
  root.innerHTML = html + tabbar() + sheet;
  mount();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
  if (S.sheet) root.querySelector('.sheet button')?.focus();
  syncTimer();
}

function makeScene(id, opts) {
  const c = document.getElementById(id);
  if (!c) return null;
  try {
    if (!c.getContext('2d')) throw new Error('no canvas');
    const v = vehicleOf();
    const sc = new RoadScene(c, { vehicle: { type: v.type, color: colourHex(v.color) }, motion: opts.motion ?? motion(), env: opts.env });
    S.scenes.push(sc);
    return sc;
  } catch {
    const w = document.getElementById(`${id}-wrap`);
    if (w) w.innerHTML = `<div class="scene-fallback small">Animasi tidak dapat dipaparkan pada peranti ini. Semua soalan dan ciri lain berfungsi seperti biasa.</div>`;
    return null;
  }
}

function mount() {
  if (S.view === 'home') { const sc = makeScene('home-scene', { env: S.game.homeScene }); sc?.cruise(36); }
  if (S.view === 'garage') drawGarageVehicles();
  if (S.view === 'play' && S.session) makeScene('play-scene', { env: S.session.env, motion: S.session.animate ? motion() : 'static' });
  if (S.view === 'result') {
    const A = findAttempt(S.params.id);
    const sc = makeScene('result-scene', { env: A?.result.passed ? 'luarbandar' : 'bandar' });
    if (sc && A) sc.driveToFinish(A.result.passed ? 'arrive' : 'learn');
  }
}

// ---------------------------------------------------------------- exam control
function startExam() {
  const active = store.getActiveExam();
  if (active) { resumeExam(); return; }
  const recentIds = new Set(store.getExamHistory().slice(0, EXAM_CONFIG.recentAttemptsToAvoid).flatMap((a) => a.questionIds));
  let questions;
  try { questions = selectExamQuestions(S.bank, EXAM_CONFIG, { recentIds }); }
  catch (e) { S.notice = { html: esc(e.message) }; go('examIntro'); return; }
  store.saveActiveExam(createExamAttempt({ questions, config: EXAM_CONFIG, bankVersion: S.data.bankVersion }));
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
  store.saveActiveExam(fn(A));
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
    if (!alreadySubmitted && firstTime !== false) for (const q of attempt.questions) recordMistake(q, attempt.result.perQuestion[q.id] !== 'correct');
    go('result', { id: attempt.id, fresh: true });
  } finally { S.submitting = false; }
}
function syncTimer() {
  const needs = S.view === 'exam' || ((S.view === 'home' || S.view === 'examIntro') && store.getActiveExam());
  if (needs && !S.timerId) S.timerId = setInterval(tick, 1000);
  if (!needs && S.timerId) { clearInterval(S.timerId); S.timerId = null; }
}
let warned = false;
function tick() {
  const A = store.getActiveExam();
  if (!A) { syncTimer(); return; }
  if (isExpired(A)) { finalizeExam(S.view === 'exam' ? 'timeout' : 'resume-expired'); return; }
  const rem = remainingMs(A);
  for (const el of root.querySelectorAll('[data-live-clock]')) el.textContent = S.view === 'exam' ? formatClock(rem) : `${formatClock(rem)} berbaki`;
  root.querySelector('.timer')?.classList.toggle('low', rem < 5 * 60_000);
  if (rem < 5 * 60_000 && !warned) { warned = true; const w = document.getElementById('time-warn'); if (w) w.textContent = 'Kurang daripada 5 minit lagi.'; }
}
function checkExpiry() {
  const A = store.getActiveExam();
  if (A && isExpired(A)) finalizeExam(S.view === 'exam' ? 'timeout' : 'resume-expired');
  else if (S.view === 'exam') tick();
}

// ---------------------------------------------------------------- starts
function startStage(stageId) {
  const st = S.stages.find((s) => s.id === stageId);
  if (!st) return;
  if (!isStageUnlocked(S.game, S.stages, stageId)) { S.notice = { html: 'Lengkapkan peringkat sebelumnya dahulu.', kind: 'info' }; go('main'); return; }
  const qs = shuffle(st.questionIds.map((id) => S.byId.get(id)).filter(Boolean));
  S.game = { ...S.game, lastStage: stageId }; saveGame();
  startSession({ kind: 'adventure', title: `Bab ${st.chapter} · Peringkat ${st.index + 1}`, questions: qs, stageId, env: st.env, animate: S.settings.animation });
}
function continueAdventure() {
  if (!S.game.vehicle) { go('garage', { next: 'adventure' }); return; }
  startStage(nextStage(S.game, S.stages).id);
}
const practiceAnimate = () => S.setup.animate ?? S.settings.animation;

// ---------------------------------------------------------------- events
const ACTIONS = {
  nav: (d) => go(d.view),
  'main-tab': (d) => { S.mainTab = d.t; render(); },
  'open-practice': () => { S.mainTab = 'practice'; go('main'); },
  'toggle-chapter': (d) => { const ch = Number(d.ch); const next = nextStage(S.game, S.stages); const open = S.openChapter === ch || (S.openChapter == null && next.chapter === ch); S.openChapter = open ? -1 : ch; render(); },
  'adventure-continue': () => continueAdventure(),
  'stage-start': (d) => { if (!S.game.vehicle) { go('garage', { next: 'adventure' }); return; } startStage(d.s); },
  resume: () => resumeExam(),
  'exam-start': () => startExam(),
  'exam-new': () => startExam(),
  'exam-exit': () => { S.notice = { html: 'Ujian disimpan. Masa terus berjalan; tekan <b>Sambung Ujian</b> untuk kembali.', kind: 'info' }; go('home'); },
  'open-result': (d) => go('result', { id: d.id }),
  'open-review': (d) => { S.reviewFilter = 'all'; go('review', { id: d.id }); },
  'review-filter': (d) => { S.reviewFilter = d.f; render(); },
  'result-retry': (d) => { const A = findAttempt(d.id); if (A) startSession({ kind: 'practice', title: 'Ulang kaji kesilapan', questions: A.questions.filter((q) => A.result.perQuestion[q.id] !== 'correct'), animate: practiceAnimate() }); },
  'weak-practice': (d) => {
    const A = findAttempt(d.id); if (!A) return;
    const weak = Object.entries(A.result.byChapter).map(([c, v]) => ({ c: Number(c), p: v.correct / v.total })).sort((a, b) => a.p - b.p).slice(0, 2).map((x) => x.c);
    const pool = shuffle(S.bank.filter((q) => weak.includes(q.chapter))).slice(0, 20);
    startSession({ kind: 'practice', title: `Topik lemah: Bab ${weak.join(' & ')}`, questions: pool, animate: practiceAnimate() });
  },
  'practice-start': () => {
    const st = S.setup;
    const label = st.chapter === 'all' ? 'Semua bab' : `Bab ${st.chapter}`;
    const veh = st.vehicle === 'all' ? '' : ` · ${{ motokar: 'Motokar', motosikal: 'Motosikal', bersama: 'Topik bersama' }[st.vehicle]}`;
    startSession({ kind: 'practice', title: label + veh, questions: selectPracticeQuestions(S.bank, st, st.count), animate: practiceAnimate() });
  },
  'practice-mistakes': () => startSession({ kind: 'practice', title: 'Ulang kaji kesilapan', questions: shuffle(mistakeList()).slice(0, 50), animate: practiceAnimate() }),
  'practice-bookmarks': () => startSession({ kind: 'practice', title: 'Soalan ditanda', questions: shuffle(store.getBookmarks().map((id) => S.byId.get(id)).filter(Boolean)), animate: practiceAnimate() }),
  'session-retry-wrong': () => { const L = S.lastSession; if (L) startSession({ kind: 'practice', title: 'Ulang soalan salah', questions: L.questions.filter((q) => L.results[q.id] !== 'correct'), animate: practiceAnimate() }); },
  'skip-drive': () => skipDrive(),
  'p-choose': (d, el) => playSelect(d.opt, el),
  'p-confirm': () => playConfirm(),
  'p-skip': () => playSkip(),
  'p-next': () => playNext(),
  'leave-confirm': () => { S.session = null; S.sheet = null; go(S.mainTab ? 'main' : 'home'); },
  'leave-results': () => { S.sheet = null; finishSession({ early: true }); },
  bookmark: (d, el) => { toggleBookmark(d.q); const on = bookmarks().has(d.q); el.setAttribute('aria-pressed', String(on)); el.querySelector('span').textContent = on ? 'Ditanda' : 'Tanda soalan'; },
  'pick-vehicle': (d) => { S.params.draft = { ...S.params.draft, type: d.t }; render(); },
  'pick-colour': (d) => { if (isColourUnlocked(S.game.xp, d.c)) { S.params.draft = { ...S.params.draft, color: d.c }; render(); } },
  'save-vehicle': () => {
    const v = S.params.draft || vehicleOf();
    S.game = { ...S.game, vehicle: { type: v.type, color: isColourUnlocked(S.game.xp, v.color) ? v.color : 'teal' } };
    saveGame();
    if (S.params.next === 'adventure') continueAdventure();
    else { S.notice = { html: 'Pilihan kenderaan disimpan.', kind: 'info' }; go('home'); }
  },
  'e-choose': (d) => { updateExam((A) => setAnswer(A, A.questionIds[A.current], d.opt)); sfx('select'); buzz(8); },
  'e-clear': () => updateExam((A) => clearAnswer(A, A.questionIds[A.current])),
  'e-flag': () => updateExam((A) => toggleFlag(A, A.questionIds[A.current])),
  'e-prev': () => { updateExam((A) => goTo(A, A.current - 1)); window.scrollTo(0, 0); },
  'e-next': () => { updateExam((A) => goTo(A, A.current + 1)); window.scrollTo(0, 0); },
  'e-goto': (d) => { S.sheet = null; updateExam((A) => goTo(A, Number(d.i))); window.scrollTo(0, 0); },
  'e-first-unanswered': () => { S.sheet = null; updateExam((A) => goTo(A, A.questionIds.findIndex((id) => A.answers[id] == null))); window.scrollTo(0, 0); },
  'e-first-flagged': () => { S.sheet = null; updateExam((A) => goTo(A, A.questionIds.findIndex((id) => A.flags[id]))); window.scrollTo(0, 0); },
  'e-submit': () => finalizeExam('manual'),
  sheet: (d) => { S.sheet = d.sheet; if (S.view === 'play') renderSheetOnly(); else render(); },
  'sheet-close': () => { S.sheet = null; if (S.view === 'play') renderSheetOnly(); else render(); },
  'reset-confirm': () => {
    store.resetAll();
    S.game = normalizeGameState(null); S.settings = normalizeSettings(null); applySettings();
    S.session = null; S.lastSession = null; S.lastResult = null; S.sheet = null;
    S.notice = { html: 'Semua data tempatan telah dipadam.', kind: 'info' };
    go('home');
  },
};

/** During play, open/close sheets without rebuilding the scene. */
function renderSheetOnly() {
  root.querySelector('.sheet-backdrop')?.remove();
  if (S.sheet && SHEETS[S.sheet]) {
    root.insertAdjacentHTML('beforeend', `<div class="sheet-backdrop" data-act="sheet-close-bg"><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h">${SHEETS[S.sheet]()}</div></div>`);
    root.querySelector('.sheet button')?.focus();
  }
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  if (el.dataset.act === 'sheet-close-bg') { if (e.target === el) { S.sheet = null; if (S.view === 'play') renderSheetOnly(); else render(); } return; }
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
  if (['chapter', 'vehicle', 'count'].includes(t.name)) { S.setup[t.name] = t.value; render(); return; }
  if (t.id === 'practice-anim') { S.setup.animate = t.checked; return; }
  if (t.name === 'homeScene') { S.game = { ...S.game, homeScene: t.value }; saveGame(); return; }
  if (t.dataset.setting) { S.settings = { ...S.settings, [t.dataset.setting]: t.checked }; store.saveSettings(S.settings); applySettings(); if (t.dataset.setting === 'sound' && t.checked) sfx('select'); return; }
  if (t.name === 'reducedMotion' || t.name === 'textSize') { S.settings = { ...S.settings, [t.name]: t.value }; store.saveSettings(S.settings); applySettings(); render(); }
});

// Arrow keys move between answer cards.
root.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && S.sheet) { S.sheet = null; if (S.view === 'play') renderSheetOnly(); else render(); return; }
  const opt = e.target.closest?.('.opt');
  if (!opt || !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const all = [...opt.parentElement.querySelectorAll('.opt:not([disabled])')];
  const i = all.indexOf(opt);
  const n = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? all[(i + 1) % all.length] : all[(i - 1 + all.length) % all.length];
  if (n) { e.preventDefault(); n.focus(); }
});

// Missing images get a text fallback.
root.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName !== 'IMG' || img.dataset.failed) return;
  img.dataset.failed = '1';
  const box = document.createElement('div');
  box.className = 'img-missing';
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', img.dataset.alt || 'Gambar');
  box.textContent = `Gambar tidak dapat dimuatkan. Penerangan: ${img.dataset.alt || ''}`;
  (img.closest('figure') || img.closest('.opt-fig') || img).replaceWith(box);
}, true);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { checkExpiry(); if (S.view === 'home') S.scenes[0]?.cruise(36); }
  else S.scenes.forEach((s) => s.stopCruise());
});
window.addEventListener('focus', checkExpiry);
window.addEventListener('pageshow', checkExpiry);
window.addEventListener('storage', (e) => { if (e.key && e.key.startsWith('lulusKpp')) { checkExpiry(); if (!['play', 'exam'].includes(S.view)) render(); } });
mq?.addEventListener?.('change', () => { applySettings(); });

// ---------------------------------------------------------------- boot
async function loadData() {
  if (globalThis.__KPP_DATA__) return globalThis.__KPP_DATA__;
  const res = await fetch('data/questions.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function boot() {
  applySettings();
  try { S.data = await loadData(); }
  catch {
    root.innerHTML = `<main class="screen"><div class="notice">${icon('alert')}<div><b>Bank soalan tidak dapat dimuatkan.</b><p class="small">Semak sambungan internet dan muat semula halaman. Selepas pemuatan pertama, aplikasi boleh digunakan tanpa internet.</p><button class="btn btn-primary" onclick="location.reload()">Cuba lagi</button></div></div></main>`;
    return;
  }
  S.bank = S.data.questions.filter(isEligible);
  S.byId = new Map(S.bank.map((q) => [q.id, q]));
  S.stages = buildStages(S.bank);
  const A = store.getActiveExam();
  if (A && isExpired(A)) finalizeExam('resume-expired');
  else render();
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !globalThis.__KPP_NO_SW__) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support unavailable */ });
  }
}

boot();
