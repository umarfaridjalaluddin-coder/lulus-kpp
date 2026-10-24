// Exam attempt state: creation, answers, flags, timer and idempotent submission.
// All functions are pure (they return a new attempt object); persistence is
// handled by the caller after every change.
import { shuffle, newId } from './rng.js';
import { scoreAttempt } from './scoring.js';

const snapshot = (q) => JSON.parse(JSON.stringify(q));

export function createExamAttempt({ questions, config, bankVersion, now = Date.now(), rand = Math.random, id = newId('ujian') }) {
  if (questions.length !== config.questionCount) throw new Error('Bilangan soalan tidak sepadan dengan konfigurasi');
  const ids = questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) throw new Error('Soalan berulang dalam ujian');
  const optionOrder = {};
  for (const q of questions) optionOrder[q.id] = shuffle(q.options.map((o) => o.id), rand);
  return {
    id,
    kind: 'exam',
    status: 'active',
    config: snapshot(config),
    bankVersion,
    startedAt: now,
    deadline: now + config.durationMinutes * 60 * 1000,
    questionIds: ids,
    questions: questions.map(snapshot),
    optionOrder,
    answers: {},
    flags: {},
    current: 0,
    updatedAt: now,
  };
}

export function setAnswer(attempt, questionId, optionId, now = Date.now()) {
  assertOpen(attempt, now);
  const q = attempt.questions.find((x) => x.id === questionId);
  if (!q) throw new Error('Soalan tiada dalam ujian ini');
  if (!q.options.some((o) => o.id === optionId)) throw new Error('Pilihan jawapan tidak sah');
  return { ...attempt, answers: { ...attempt.answers, [questionId]: optionId }, updatedAt: now };
}

export function clearAnswer(attempt, questionId, now = Date.now()) {
  assertOpen(attempt, now);
  const answers = { ...attempt.answers };
  delete answers[questionId];
  return { ...attempt, answers, updatedAt: now };
}

export function toggleFlag(attempt, questionId, now = Date.now()) {
  assertOpen(attempt, now);
  const flags = { ...attempt.flags };
  if (flags[questionId]) delete flags[questionId]; else flags[questionId] = true;
  return { ...attempt, flags, updatedAt: now };
}

export function goTo(attempt, index) {
  const i = Math.max(0, Math.min(attempt.questionIds.length - 1, index));
  return { ...attempt, current: i };
}

export const remainingMs = (attempt, now = Date.now()) => Math.max(0, attempt.deadline - now);
export const isExpired = (attempt, now = Date.now()) => now >= attempt.deadline;

export function answeredCount(attempt) {
  return attempt.questionIds.filter((id) => attempt.answers[id] != null).length;
}

function assertOpen(attempt, now) {
  if (attempt.status !== 'active') throw new Error('Ujian ini telah dihantar');
  if (isExpired(attempt, now)) throw new Error('Masa ujian telah tamat');
}

/**
 * Finalise an attempt. Idempotent: calling it on an already-submitted attempt
 * returns that attempt unchanged with `alreadySubmitted: true`.
 * When submitted after the deadline (timeout or app reopened late), the end
 * time is the original deadline, so time used never exceeds the limit.
 */
export function submitAttempt(attempt, { now = Date.now(), reason = 'manual' } = {}) {
  if (attempt.status === 'submitted') return { attempt, alreadySubmitted: true };
  const endedAt = Math.min(now, attempt.deadline);
  const result = scoreAttempt(attempt.questions, attempt.answers, attempt.config);
  const done = {
    ...attempt,
    status: 'submitted',
    submittedAt: endedAt,
    submitReason: now >= attempt.deadline && reason === 'manual' ? 'timeout' : reason,
    timeUsedMs: endedAt - attempt.startedAt,
    result,
  };
  return { attempt: done, alreadySubmitted: false };
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDuration(ms) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m} minit ${s} saat`;
}
