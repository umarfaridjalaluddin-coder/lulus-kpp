import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXAM_CONFIG } from '../app/js/config.js';
import { selectExamQuestions } from '../app/js/selection.js';
import { makeRng } from '../app/js/rng.js';
import {
  buildStages, newGameState, recordAnswer, completeStage, isStageUnlocked, nextStage, unlockedColours,
  newColourUnlocks, firstAttemptStats, motionMode, normalizeSettings, journeyProgress, unlockedScenes,
} from '../app/js/progress.js';
import { renderVis, validateVis } from '../app/js/visuals.js';

const data = JSON.parse(readFileSync(new URL('../app/data/questions.json', import.meta.url)));
const bank = data.questions.filter((q) => q.status === 'verified');
const stages = buildStages(bank);

test('stages cover every eligible question exactly once, about 10 each', () => {
  const all = stages.flatMap((s) => s.questionIds);
  assert.equal(all.length, bank.length);
  assert.equal(new Set(all).size, bank.length);
  for (const s of stages) assert.ok(s.questionIds.length >= 7 && s.questionIds.length <= 13, `${s.id} has ${s.questionIds.length}`);
  for (let ch = 1; ch <= 6; ch++) assert.ok(stages.some((s) => s.chapter === ch), `chapter ${ch} has stages`);
});

test('stage building is deterministic', () => {
  assert.deepEqual(buildStages(bank), stages);
});

test('XP: 10 for a correct first attempt, nothing for wrong or repeat', () => {
  let s = newGameState();
  let r = recordAnswer(s, 'Q1', true); s = r.state;
  assert.equal(r.xpGained, 10); assert.equal(s.xp, 10);
  r = recordAnswer(s, 'Q2', false); s = r.state;
  assert.equal(r.xpGained, 0); assert.equal(s.xp, 10);
  // A later correct answer after seeing the explanation does not replace the first attempt.
  r = recordAnswer(s, 'Q2', true); s = r.state;
  assert.equal(r.firstTime, false); assert.equal(s.xp, 10); assert.equal(s.firstAttempts.Q2.correct, false);
  r = recordAnswer(s, 'Q1', true); assert.equal(r.xpGained, 0);
});

test('stage completion unlocks the next stage, gives badges, never locks out after wrong answers', () => {
  let s = newGameState();
  const [a, b] = stages.filter((x) => x.chapter === 2);
  assert.equal(isStageUnlocked(s, stages, a.id), true);
  assert.equal(isStageUnlocked(s, stages, b.id), false);
  const allWrong = Object.fromEntries(a.questionIds.map((id) => [id, 'incorrect']));
  const r = completeStage(s, stages, a.id, allWrong);
  s = r.state;
  assert.ok(r.newBadges.includes('peringkat-pertama'));
  assert.ok(!r.newBadges.includes('sempurna'));
  assert.equal(isStageUnlocked(s, stages, b.id), true, 'wrong answers still complete the stage');
  const allRight = Object.fromEntries(b.questionIds.map((id) => [id, 'correct']));
  const r2 = completeStage(s, stages, b.id, allRight);
  assert.ok(r2.newBadges.includes('sempurna'));
  const ch2 = stages.filter((x) => x.chapter === 2);
  if (ch2.length === 2) assert.ok(r2.newBadges.includes('bab-2'));
  assert.equal(nextStage(r2.state, stages).chapter !== undefined, true);
});

test('colour unlocks follow XP; scenery unlocks after playing an environment', () => {
  assert.deepEqual(unlockedColours(0).map((c) => c.id), ['teal', 'putih']);
  assert.ok(unlockedColours(100).some((c) => c.id === 'merah'));
  assert.deepEqual(newColourUnlocks(90, 260), ['merah', 'kuning']);
  let s = newGameState();
  assert.deepEqual(unlockedScenes(s), ['perumahan']);
  const st = stages.find((x) => x.env === 'lebuhraya');
  s = completeStage(s, stages, st.id, {}).state;
  assert.ok(unlockedScenes(s).includes('lebuhraya'));
});

test('first-attempt accuracy and journey progress', () => {
  let s = newGameState();
  const qs = bank.slice(0, 4);
  s = recordAnswer(s, qs[0].id, true).state;
  s = recordAnswer(s, qs[1].id, false).state;
  const st = firstAttemptStats(s, bank);
  assert.equal(st.attempted, 2); assert.equal(st.correct, 1);
  assert.equal(journeyProgress(s, stages).done, 0);
});

test('motion mode respects animation setting and reduced motion', () => {
  const d = normalizeSettings({});
  assert.equal(motionMode(d, false), 'full');
  assert.equal(motionMode(d, true), 'static');
  assert.equal(motionMode({ ...d, reducedMotion: 'off' }, true), 'full');
  assert.equal(motionMode({ ...d, reducedMotion: 'on' }, false), 'static');
  assert.equal(motionMode({ ...d, animation: false }, false), 'static');
  assert.equal(normalizeSettings({ textSize: 'huge' }).textSize, 'normal');
});

test('exams never contain two questions about the same picture', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const qs = selectExamQuestions(data.questions, EXAM_CONFIG, { rand: makeRng(seed) });
    const keys = qs.map((q) => q.visualKey).filter(Boolean);
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(qs.length, 70);
  }
});

test('every diagram spec in the bank renders with a text equivalent', () => {
  for (const q of bank) {
    const specs = [q.vis, ...q.options.map((o) => o.vis)].filter(Boolean);
    for (const sp of specs) {
      assert.equal(validateVis(sp), null, q.id);
      const r = renderVis(sp);
      assert.ok(r.svg.startsWith('<svg') && r.label.length > 10, q.id);
    }
    for (const o of q.options) if (o.img) assert.ok(o.text.length > 5 && o.img.alt, `${q.id} picture option has text`);
  }
});
