// Game progress: adventure stages, first-attempt accuracy, XP, badges,
// cosmetic unlocks and settings. Pure functions on plain objects; the UI
// persists the returned state. Game XP never feeds into exam scoring.
import { isEligible } from './selection.js';

export const XP_PER_FIRST_CORRECT = 10;
export const STAGE_TARGET_SIZE = 10;

export const ENVIRONMENTS = {
  perumahan: 'Kawasan Perumahan',
  bandar: 'Jalan Bandar',
  luarbandar: 'Jalan Luar Bandar',
  lebuhraya: 'Lebuh Raya',
  malam: 'Perjalanan Malam',
  hujan: 'Cuaca Hujan',
};
const CHAPTER_ENVS = {
  1: ['perumahan', 'bandar'],
  2: ['bandar', 'perumahan'],
  3: ['luarbandar', 'bandar'],
  4: ['lebuhraya', 'malam', 'hujan', 'luarbandar'],
  5: ['perumahan', 'luarbandar', 'malam'],
  6: ['lebuhraya', 'hujan', 'bandar'],
};

export const COLOURS = [
  { id: 'teal', name: 'Hijau Teal', hex: '#0C807C', xp: 0 },
  { id: 'putih', name: 'Putih Mutiara', hex: '#F2F4F5', xp: 0 },
  { id: 'merah', name: 'Merah Saga', hex: '#C8312B', xp: 100 },
  { id: 'kuning', name: 'Kuning Padi', hex: '#E9B500', xp: 250 },
  { id: 'biru', name: 'Biru Laut', hex: '#1D5FA8', xp: 500 },
  { id: 'ungu', name: 'Ungu Senja', hex: '#6D4AA8', xp: 800 },
];

export const BADGES = {
  'peringkat-pertama': { name: 'Langkah Pertama', desc: 'Lengkapkan peringkat pertama.' },
  sempurna: { name: 'Teliti', desc: 'Jawab semua soalan satu peringkat dengan betul pada cubaan pertama.' },
  'xp-100': { name: '100 XP', desc: 'Kumpul 100 XP.' },
  'xp-500': { name: '500 XP', desc: 'Kumpul 500 XP.' },
  'xp-1000': { name: '1,000 XP', desc: 'Kumpul 1,000 XP.' },
  'bab-1': { name: 'Bab 1 Selesai', desc: 'Lengkapkan semua peringkat Bab 1.' },
  'bab-2': { name: 'Bab 2 Selesai', desc: 'Lengkapkan semua peringkat Bab 2.' },
  'bab-3': { name: 'Bab 3 Selesai', desc: 'Lengkapkan semua peringkat Bab 3.' },
  'bab-4': { name: 'Bab 4 Selesai', desc: 'Lengkapkan semua peringkat Bab 4.' },
  'bab-5': { name: 'Bab 5 Selesai', desc: 'Lengkapkan semua peringkat Bab 5.' },
  'bab-6': { name: 'Bab 6 Selesai', desc: 'Lengkapkan semua peringkat Bab 6.' },
  pengembara: { name: 'Sampai ke Lesen', desc: 'Lengkapkan keenam-enam bab pengembaraan.' },
};

export function newGameState() {
  return {
    version: 1,
    vehicle: null, // { type: 'car'|'motorcycle', color }
    xp: 0,
    firstAttempts: {}, // qid -> { correct, at }
    stages: {}, // stageId -> { completedAt, plays, lastCorrect, total, perfect }
    badges: {}, // badgeId -> at
    envSeen: {},
    homeScene: 'perumahan',
    lastStage: null,
  };
}

export function normalizeGameState(s) {
  const base = newGameState();
  if (!s || typeof s !== 'object') return base;
  return { ...base, ...s, firstAttempts: { ...(s.firstAttempts || {}) }, stages: { ...(s.stages || {}) }, badges: { ...(s.badges || {}) }, envSeen: { ...(s.envSeen || {}) } };
}

/** Deterministic stages: each chapter's eligible questions sorted by ID, split into near-equal groups of about 10. */
export function buildStages(bank) {
  const out = [];
  for (let ch = 1; ch <= 6; ch++) {
    const qs = bank.filter((q) => isEligible(q) && q.chapter === ch).map((q) => q.id).sort();
    if (!qs.length) continue;
    const n = Math.max(1, Math.round(qs.length / STAGE_TARGET_SIZE));
    const envs = CHAPTER_ENVS[ch];
    for (let i = 0; i < n; i++) {
      const start = Math.round((i * qs.length) / n);
      const end = Math.round(((i + 1) * qs.length) / n);
      out.push({ id: `B${ch}-P${String(i + 1).padStart(2, '0')}`, chapter: ch, index: i, count: n, questionIds: qs.slice(start, end), env: envs[i % envs.length] });
    }
  }
  return out;
}

export function stagesOfChapter(stages, ch) { return stages.filter((s) => s.chapter === ch); }

export function isStageUnlocked(state, stages, stageId) {
  const st = stages.find((s) => s.id === stageId);
  if (!st) return false;
  if (st.index === 0) return true;
  const prev = stages.find((s) => s.chapter === st.chapter && s.index === st.index - 1);
  return !!state.stages[prev.id]?.completedAt;
}

/** The stage the player should continue with. */
export function nextStage(state, stages) {
  if (state.lastStage) {
    const last = stages.find((s) => s.id === state.lastStage);
    if (last && !state.stages[last.id]?.completedAt) return last;
    if (last) {
      const after = stages.find((s) => s.chapter === last.chapter && s.index === last.index + 1);
      if (after && !state.stages[after.id]?.completedAt) return after;
    }
  }
  return stages.find((s) => !state.stages[s.id]?.completedAt) || stages[0];
}

/**
 * Record an adventure answer. Only the first attempt ever made on a question
 * counts for accuracy and XP; later attempts never overwrite it.
 */
export function recordAnswer(state, qid, correct, now = Date.now()) {
  if (state.firstAttempts[qid]) return { state, xpGained: 0, firstTime: false };
  const xpGained = correct ? XP_PER_FIRST_CORRECT : 0;
  return {
    state: { ...state, xp: state.xp + xpGained, firstAttempts: { ...state.firstAttempts, [qid]: { correct: !!correct, at: now } } },
    xpGained,
    firstTime: true,
  };
}

/** Finish a stage play. `answers` = { qid: 'correct'|'incorrect'|'unanswered' } for this play. */
export function completeStage(state, stages, stageId, answers, now = Date.now()) {
  const st = stages.find((s) => s.id === stageId);
  const vals = Object.values(answers);
  const correct = vals.filter((v) => v === 'correct').length;
  const prev = state.stages[stageId] || { plays: 0 };
  const perfect = vals.length > 0 && correct === vals.length;
  let next = {
    ...state,
    lastStage: stageId,
    envSeen: { ...state.envSeen, [st.env]: true },
    stages: { ...state.stages, [stageId]: { completedAt: prev.completedAt || now, plays: prev.plays + 1, lastCorrect: correct, total: vals.length, perfect: prev.perfect || perfect } },
  };
  const before = new Set(Object.keys(state.badges));
  const badges = { ...next.badges };
  const award = (id) => { if (!badges[id]) badges[id] = now; };
  award('peringkat-pertama');
  if (perfect) award('sempurna');
  for (let ch = 1; ch <= 6; ch++) {
    const list = stagesOfChapter(stages, ch);
    if (list.length && list.every((s) => next.stages[s.id]?.completedAt)) award(`bab-${ch}`);
  }
  if ([1, 2, 3, 4, 5, 6].every((ch) => badges[`bab-${ch}`])) award('pengembara');
  next = { ...next, badges };
  next = awardXpBadges(next, now);
  const newBadges = Object.keys(next.badges).filter((b) => !before.has(b));
  return { state: next, newBadges, newUnlocks: newColourUnlocks(state.xp, next.xp) };
}

export function awardXpBadges(state, now = Date.now()) {
  const badges = { ...state.badges };
  for (const [id, n] of [['xp-100', 100], ['xp-500', 500], ['xp-1000', 1000]]) if (state.xp >= n && !badges[id]) badges[id] = now;
  return { ...state, badges };
}

export const unlockedColours = (xp) => COLOURS.filter((c) => xp >= c.xp);
export const isColourUnlocked = (xp, id) => unlockedColours(xp).some((c) => c.id === id);
export function newColourUnlocks(xpBefore, xpAfter) {
  return COLOURS.filter((c) => c.xp > xpBefore && c.xp <= xpAfter).map((c) => c.id);
}
export const unlockedScenes = (state) => Object.keys(ENVIRONMENTS).filter((e) => e === 'perumahan' || state.envSeen[e]);

/** First-attempt accuracy per chapter (adventure only). */
export function firstAttemptStats(state, bank) {
  const byId = new Map(bank.map((q) => [q.id, q]));
  const out = { attempted: 0, correct: 0, byChapter: {} };
  for (const [qid, fa] of Object.entries(state.firstAttempts)) {
    const q = byId.get(qid);
    if (!q) continue;
    out.attempted++; if (fa.correct) out.correct++;
    const c = (out.byChapter[q.chapter] ||= { attempted: 0, correct: 0 });
    c.attempted++; if (fa.correct) c.correct++;
  }
  return out;
}

export function journeyProgress(state, stages) {
  const done = stages.filter((s) => state.stages[s.id]?.completedAt).length;
  return { done, total: stages.length, percent: stages.length ? Math.round((done / stages.length) * 100) : 0 };
}

// ---------------------------------------------------------------- settings
export const DEFAULT_SETTINGS = { animation: true, reducedMotion: 'auto', sound: false, haptics: true, textSize: 'normal' };
export function normalizeSettings(s) {
  const out = { ...DEFAULT_SETTINGS, ...(s || {}) };
  if (!['auto', 'on', 'off'].includes(out.reducedMotion)) out.reducedMotion = 'auto';
  if (!['normal', 'large', 'xlarge'].includes(out.textSize)) out.textSize = 'normal';
  return out;
}
/** 'full' = animated driving; 'static' = no movement (animation off or reduced motion). */
export function motionMode(settings, prefersReduced) {
  if (!settings.animation) return 'static';
  if (settings.reducedMotion === 'on') return 'static';
  if (settings.reducedMotion === 'auto' && prefersReduced) return 'static';
  return 'full';
}
