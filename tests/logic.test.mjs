import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAM_CONFIG } from '../app/js/config.js';
import { selectExamQuestions } from '../app/js/selection.js';
import { scoreAttempt, formatPercent } from '../app/js/scoring.js';
import { createExamAttempt, setAnswer, clearAnswer, toggleFlag, submitAttempt, remainingMs, isExpired } from '../app/js/attempt.js';
import { createStore } from '../app/js/storage.js';
import { makeRng } from '../app/js/rng.js';

const data = JSON.parse(readFileSync(new URL('../app/data/questions.json', import.meta.url)));
const bank = data.questions;
const wrongOf = (q) => q.options.find((o) => o.id !== q.correct).id;

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function makeAttempt(seed = 1, now = 1_000_000) {
  const qs = selectExamQuestions(bank, EXAM_CONFIG, { rand: makeRng(seed) });
  return createExamAttempt({ questions: qs, config: EXAM_CONFIG, bankVersion: data.bankVersion, now, rand: makeRng(seed + 7), id: `t${seed}` });
}
/** Answer: first c correct, next w wrong, rest blank */
function scored(c, w) {
  const qs = selectExamQuestions(bank, EXAM_CONFIG, { rand: makeRng(42) });
  const answers = {};
  qs.forEach((q, i) => { if (i < c) answers[q.id] = q.correct; else if (i < c + w) answers[q.id] = wrongOf(q); });
  return scoreAttempt(qs, answers, EXAM_CONFIG);
}

test('every full exam has exactly 70 unique eligible questions (200 random draws)', () => {
  for (let s = 1; s <= 200; s++) {
    const qs = selectExamQuestions(bank, EXAM_CONFIG, { rand: makeRng(s) });
    assert.equal(qs.length, 70);
    assert.equal(new Set(qs.map((q) => q.id)).size, 70);
    assert.ok(qs.every((q) => q.status === 'verified'));
    const imgs = qs.filter((q) => q.image).map((q) => q.image.id);
    assert.equal(new Set(imgs).size, imgs.length, 'no repeated image in one exam');
    for (const [ch, n] of Object.entries(EXAM_CONFIG.practiceDistribution)) {
      assert.equal(qs.filter((q) => q.chapter === Number(ch)).length, n, `chapter ${ch}`);
    }
    assert.ok(qs.some((q) => q.vehicle === 'motokar'), 'car questions present');
    assert.ok(qs.some((q) => q.vehicle === 'motosikal'), 'motorcycle questions present');
  }
});

test('recent questions are avoided when the bank allows it', () => {
  const first = selectExamQuestions(bank, EXAM_CONFIG, { rand: makeRng(5) });
  const recent = new Set(first.map((q) => q.id));
  const second = selectExamQuestions(bank, EXAM_CONFIG, { rand: makeRng(6), recentIds: recent });
  const overlap = second.filter((q) => recent.has(q.id)).length;
  // Chapter 2 has 20 questions for a quota of 5, so zero overlap is achievable.
  assert.equal(overlap, 0);
});

test('55/70 fails and 56/70 passes', () => {
  assert.equal(scored(55, 15).passed, false);
  assert.equal(scored(56, 14).passed, true);
});

test('all-correct, all-wrong and all-unanswered score correctly', () => {
  const all = scored(70, 0); assert.deepEqual([all.correct, all.incorrect, all.unanswered, all.passed], [70, 0, 0, true]);
  const wrong = scored(0, 70); assert.deepEqual([wrong.correct, wrong.incorrect, wrong.unanswered, wrong.passed], [0, 70, 0, false]);
  const blank = scored(0, 0); assert.deepEqual([blank.correct, blank.incorrect, blank.unanswered, blank.passed], [0, 0, 70, false]);
});

test('spec example: 60 correct, 8 wrong, 2 unanswered', () => {
  const r = scored(60, 8);
  assert.equal(r.correct, 60); assert.equal(r.incorrect, 8); assert.equal(r.unanswered, 2);
  assert.equal(r.passed, true);
  assert.equal(formatPercent(r.percent), '85.7%');
});

test('correct + incorrect + unanswered always equals 70', () => {
  for (let c = 0; c <= 70; c += 7) for (let w = 0; w <= 70 - c; w += 9) {
    const r = scored(c, w);
    assert.equal(r.correct + r.incorrect + r.unanswered, 70);
  }
});

test('changing and clearing an answer updates state and score', () => {
  let a = makeAttempt(3);
  const q = a.questions[0];
  a = setAnswer(a, q.id, wrongOf(q), 1_000_100);
  assert.equal(scoreAttempt(a.questions, a.answers, EXAM_CONFIG).incorrect, 1);
  a = setAnswer(a, q.id, q.correct, 1_000_200);
  let r = scoreAttempt(a.questions, a.answers, EXAM_CONFIG);
  assert.equal(r.correct, 1); assert.equal(r.incorrect, 0);
  a = clearAnswer(a, q.id, 1_000_300);
  r = scoreAttempt(a.questions, a.answers, EXAM_CONFIG);
  assert.equal(r.correct, 0); assert.equal(r.unanswered, 70);
  a = toggleFlag(a, q.id, 1_000_400); assert.equal(a.flags[q.id], true);
  a = toggleFlag(a, q.id, 1_000_500); assert.equal(a.flags[q.id], undefined);
});

test('saved attempt restores the same questions, answers, option order and deadline', () => {
  const store = createStore(fakeStorage());
  let a = makeAttempt(9);
  a = setAnswer(a, a.questions[4].id, a.questions[4].correct, 1_000_500);
  a = toggleFlag(a, a.questions[7].id, 1_000_600);
  store.saveActiveExam(a);
  const back = store.getActiveExam();
  assert.deepEqual(back.questionIds, a.questionIds);
  assert.deepEqual(back.optionOrder, a.optionOrder);
  assert.deepEqual(back.answers, a.answers);
  assert.deepEqual(back.flags, a.flags);
  assert.equal(back.deadline, a.deadline);
  assert.equal(back.deadline - back.startedAt, 75 * 60 * 1000);
});

test('timer uses the absolute deadline', () => {
  const a = makeAttempt(11, 0);
  assert.equal(remainingMs(a, 60_000), 74 * 60_000);
  assert.equal(isExpired(a, 75 * 60_000 - 1), false);
  assert.equal(isExpired(a, 75 * 60_000), true);
  assert.throws(() => setAnswer(a, a.questions[0].id, a.questions[0].correct, 75 * 60_000 + 1));
});

test('timeout submission happens once and history has one entry', () => {
  const store = createStore(fakeStorage());
  let a = makeAttempt(12, 0);
  a = setAnswer(a, a.questions[0].id, a.questions[0].correct, 10);
  const first = submitAttempt(a, { now: 75 * 60_000 + 5000, reason: 'timeout' });
  assert.equal(first.alreadySubmitted, false);
  assert.equal(first.attempt.timeUsedMs, 75 * 60_000);
  const second = submitAttempt(first.attempt, { now: 75 * 60_000 + 9000, reason: 'timeout' });
  assert.equal(second.alreadySubmitted, true);
  assert.equal(store.addExamResult(first.attempt), true);
  assert.equal(store.addExamResult(second.attempt), false);
  assert.equal(store.getExamHistory().length, 1);
  assert.equal(store.getExamHistory()[0].result.correct, 1);
});

test('app closed past deadline: reopening finalises with saved answers and original deadline', () => {
  const store = createStore(fakeStorage());
  let a = makeAttempt(13, 0);
  for (const q of a.questions.slice(0, 30)) a = setAnswer(a, q.id, q.correct, 100);
  store.saveActiveExam(a);
  const reopened = store.getActiveExam();
  const later = 3 * 60 * 60_000;
  assert.equal(isExpired(reopened, later), true);
  const { attempt } = submitAttempt(reopened, { now: later, reason: 'resume-expired' });
  assert.equal(attempt.submittedAt, reopened.deadline);
  assert.equal(attempt.result.correct, 30);
  assert.equal(attempt.result.unanswered, 40);
});

test('answer review matches the submitted attempt even if the bank changes later', () => {
  let a = makeAttempt(14);
  const q = a.questions[0];
  a = setAnswer(a, q.id, q.correct, 1_000_100);
  const { attempt } = submitAttempt(a, { now: 1_000_200 });
  // Simulate a future content update that changes the key of the live bank.
  const live = bank.find((x) => x.id === q.id);
  const mutated = { ...live, correct: live.options.find((o) => o.id !== live.correct).id };
  assert.notEqual(mutated.correct, attempt.questions[0].correct);
  const rescore = scoreAttempt(attempt.questions, attempt.answers, attempt.config);
  assert.equal(rescore.correct, attempt.result.correct);
  assert.equal(attempt.result.perQuestion[q.id], 'correct');
});

test('completed results survive a new store instance (close and reopen)', () => {
  const backend = fakeStorage();
  const s1 = createStore(backend);
  const { attempt } = submitAttempt(makeAttempt(15), { now: 1_000_500 });
  s1.addExamResult(attempt);
  const s2 = createStore(backend);
  assert.equal(s2.getExamHistory()[0].id, attempt.id);
});

test('storage falls back to memory when unavailable', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('blocked'); }, removeItem() {} };
  const s = createStore(broken);
  assert.equal(s.persistent, false);
  s.saveBookmarks(['a']);
  assert.deepEqual(s.getBookmarks(), ['a']);
});
