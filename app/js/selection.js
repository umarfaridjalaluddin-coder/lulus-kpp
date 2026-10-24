// Question selection for the full mock exam and practice sessions.
import { shuffle } from './rng.js';

export const isEligible = (q) => q.status === 'verified';

/**
 * Pick exactly `config.questionCount` unique eligible questions.
 * - Chapter counts follow config.practiceDistribution (the app's own practice
 *   distribution, not an official JPJ quota).
 * - Within a chapter, the vehicle mix follows that chapter's pool so both car
 *   and motorcycle knowledge appear.
 * - Questions used in recent attempts are picked last.
 * - Two questions that share an image are never in the same exam.
 * Throws if the bank cannot supply enough questions.
 */
export function selectExamQuestions(bank, config, { recentIds = new Set(), rand = Math.random } = {}) {
  const pool = bank.filter(isEligible);
  const target = config.questionCount;
  if (pool.length < target) throw new Error(`Bank soalan hanya ada ${pool.length} soalan layak; perlu ${target}.`);

  const picked = [];
  const pickedIds = new Set();
  const usedImages = new Set();
  const canTake = (q) => !pickedIds.has(q.id) && !(q.image && usedImages.has(q.image.id));
  const take = (q) => { picked.push(q); pickedIds.add(q.id); if (q.image) usedImages.add(q.image.id); };
  // Fresh questions first, each group shuffled.
  const ordered = (list) => [...shuffle(list.filter((q) => !recentIds.has(q.id)), rand), ...shuffle(list.filter((q) => recentIds.has(q.id)), rand)];

  for (const [chKey, quota] of Object.entries(config.practiceDistribution)) {
    const ch = Number(chKey);
    const chPool = pool.filter((q) => q.chapter === ch);
    // Split the chapter quota across vehicle groups in proportion to the pool (largest remainder).
    const groups = {};
    for (const q of chPool) (groups[q.vehicle] ||= []).push(q);
    const keys = Object.keys(groups);
    const exact = keys.map((k) => ({ k, v: (quota * groups[k].length) / chPool.length }));
    const alloc = Object.fromEntries(exact.map(({ k, v }) => [k, Math.floor(v)]));
    let left = quota - Object.values(alloc).reduce((s, n) => s + n, 0);
    for (const { k } of exact.sort((a, b) => (b.v % 1) - (a.v % 1))) { if (left-- > 0) alloc[k]++; }
    for (const k of keys) {
      let n = alloc[k];
      for (const q of ordered(groups[k])) { if (n <= 0) break; if (canTake(q)) { take(q); n--; } }
    }
    // Top up the chapter if a vehicle group ran short.
    let short = quota - picked.filter((q) => q.chapter === ch).length;
    for (const q of ordered(chPool)) { if (short <= 0) break; if (canTake(q)) { take(q); short--; } }
  }
  // Fill any remaining gap from the whole pool.
  for (const q of ordered(pool)) { if (picked.length >= target) break; if (canTake(q)) take(q); }
  if (picked.length !== target) throw new Error(`Hanya ${picked.length} soalan unik dapat dipilih; perlu ${target}.`);
  return shuffle(picked, rand);
}

/** Filter for practice: chapter ('all' or number), vehicle ('all'|'motokar'|'motosikal'|'bersama'). */
export function filterPractice(bank, { chapter = 'all', vehicle = 'all' } = {}) {
  return bank.filter((q) => isEligible(q)
    && (chapter === 'all' || q.chapter === Number(chapter))
    && (vehicle === 'all' || q.vehicle === vehicle));
}

export function selectPracticeQuestions(bank, filters, count, rand = Math.random) {
  const list = shuffle(filterPractice(bank, filters), rand);
  return count === 'all' ? list : list.slice(0, Number(count));
}
