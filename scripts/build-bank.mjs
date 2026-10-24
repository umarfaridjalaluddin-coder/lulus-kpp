// Builds and validates the question bank.
// Input:  content/bank/bab*.mjs, content/sources.json, content/images.json
// Output: app/data/questions.json, reports/question-bank.csv
// Exit code 1 if any validation error is found.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { EXAM_CONFIG, CHAPTERS, VEHICLES, TOPICS } from '../app/js/config.js';

const root = new URL('../', import.meta.url);
const sources = JSON.parse(readFileSync(new URL('content/sources.json', root)));
const images = JSON.parse(readFileSync(new URL('content/images.json', root)));

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);

function hash32(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function seededPermutation(n, seedStr) {
  let s = hash32(seedStr) || 1;
  const rand = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const questions = [];
const seen = new Set();
for (let ch = 1; ch <= 6; ch++) {
  const mod = await import(new URL(`content/bank/bab${ch}.mjs`, root));
  for (const raw of mod.default) {
    const id = raw.id;
    if (!/^B[1-6]-[A-Z]{3}-[0-9X]{3}$/.test(id)) err(id, 'bad id format');
    if (seen.has(id)) err(id, 'duplicate id');
    seen.add(id);
    if (!id.startsWith(`B${ch}-`)) err(id, `id chapter does not match file bab${ch}`);
    if (!raw.sec) err(id, 'missing section');
    if (!Number.isInteger(raw.pg) || raw.pg < 1 || raw.pg > 202) err(id, 'missing/invalid page');
    if (!TOPICS[raw.topic]) err(id, `unknown topic ${raw.topic}`);
    if (!VEHICLES[raw.veh]) err(id, `unknown vehicle ${raw.veh}`);
    if (!raw.q || raw.q.length < 10) err(id, 'missing question');
    if (!raw.e || raw.e.length < 10) err(id, 'missing explanation');
    if (!Array.isArray(raw.o) || raw.o.length < 3 || raw.o.length > 4) err(id, 'needs 3–4 options');
    const optNorm = (raw.o || []).map(norm);
    if (new Set(optNorm).size !== optNorm.length) err(id, 'duplicate options');
    if (optNorm.some((o) => !o)) err(id, 'empty option');
    const status = raw.status || 'verified';
    if (!['verified', 'excluded'].includes(status)) err(id, `bad status ${status}`);
    if (status === 'excluded' && !raw.note) err(id, 'excluded question needs a note');
    for (const w of raw.web || []) if (!sources[w]) err(id, `unknown web source ${w}`);
    let image = null;
    if (raw.img) {
      if (!images[raw.img]) err(id, `unknown image ${raw.img}`);
      else if (!existsSync(new URL(`app/${images[raw.img].file}`, root))) err(id, `image file missing ${raw.img}`);
      else image = { id: raw.img, src: images[raw.img].file, alt: images[raw.img].alt };
    }
    // Stable option IDs + deterministic stored order.
    const perm = seededPermutation(raw.o.length, id);
    const letters = ['a', 'b', 'c', 'd'];
    const options = perm.map((srcIdx, pos) => ({ id: letters[pos], text: raw.o[srcIdx], _src: srcIdx }));
    const correct = options.find((o) => o._src === 0);
    if (!correct) err(id, 'no correct option');
    const srcRefs = [{ type: 'book', key: 'MSBT5', chapter: ch, section: raw.sec, pdfPage: raw.pg, printedPage: raw.pg }];
    for (const w of raw.web || []) srcRefs.push({ type: 'web', key: w, url: sources[w].url, verifiedOn: sources[w].verifiedOn });
    questions.push({
      id, chapter: ch, topic: raw.topic, vehicle: raw.veh, tags: raw.tags || [],
      text: raw.q,
      options: options.map(({ id: oid, text }) => ({ id: oid, text })),
      correct: correct?.id,
      explanation: raw.e,
      image,
      sources: srcRefs,
      status,
      note: raw.note || null,
    });
  }
}

// Near-duplicate check on question text (word-set Jaccard).
for (let i = 0; i < questions.length; i++) {
  const a = new Set(norm(questions[i].text).split(' '));
  for (let j = i + 1; j < questions.length; j++) {
    if (questions[i].image && questions[i].image.id === questions[j].image?.id && questions[i].text === questions[j].text) err(questions[j].id, `same image and text as ${questions[i].id}`);
    if (questions[i].image || questions[j].image) continue;
    const b = new Set(norm(questions[j].text).split(' '));
    const inter = [...a].filter((x) => b.has(x)).length;
    const jac = inter / (a.size + b.size - inter);
    if (jac > 0.8) err(questions[j].id, `near-duplicate of ${questions[i].id} (${jac.toFixed(2)})`);
  }
}

// Eligibility for the full exam.
const eligible = questions.filter((q) => q.status === 'verified');
const total = Object.values(EXAM_CONFIG.practiceDistribution).reduce((s, n) => s + n, 0);
if (total !== EXAM_CONFIG.questionCount) errors.push(`config: distribution sums to ${total}, expected ${EXAM_CONFIG.questionCount}`);
for (const [ch, quota] of Object.entries(EXAM_CONFIG.practiceDistribution)) {
  const n = eligible.filter((q) => q.chapter === Number(ch)).length;
  if (n < quota) errors.push(`chapter ${ch}: only ${n} eligible, needs ${quota}`);
  else if (n < quota * (EXAM_CONFIG.recentAttemptsToAvoid + 1)) warnings.push(`chapter ${ch}: ${n} eligible; fresh sets limited for repeated exams`);
}

const body = { questions };
const contentHash = createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 12);
const out = {
  bankVersion: `msbt5-2025.${contentHash}`,
  generatedOn: new Date().toISOString().slice(0, 10),
  primarySource: sources.MSBT5,
  sources,
  chapters: CHAPTERS,
  counts: {
    total: questions.length,
    verified: eligible.length,
    excluded: questions.length - eligible.length,
    byChapter: Object.fromEntries(Object.keys(CHAPTERS).map((c) => [c, eligible.filter((q) => q.chapter === Number(c)).length])),
    byVehicle: Object.fromEntries(Object.keys(VEHICLES).map((v) => [v, eligible.filter((q) => q.vehicle === v).length])),
    withImage: eligible.filter((q) => q.image).length,
  },
  ...body,
};

mkdirSync(new URL('app/data/', root), { recursive: true });
writeFileSync(new URL('app/data/questions.json', root), JSON.stringify(out));
mkdirSync(new URL('reports/', root), { recursive: true });
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csv = ['id,status,chapter,section,pdf_page,printed_page,topic,vehicle,image,question,correct_answer,explanation,web_sources,note']
  .concat(questions.map((q) => {
    const b = q.sources[0];
    return [q.id, q.status, q.chapter, b.section, b.pdfPage, b.printedPage, q.topic, q.vehicle, q.image?.id || '', q.text,
      q.options.find((o) => o.id === q.correct).text, q.explanation,
      q.sources.filter((s) => s.type === 'web').map((s) => `${s.key} (${s.verifiedOn})`).join('; '), q.note || ''].map(csvCell).join(',');
  }));
writeFileSync(new URL('reports/question-bank.csv', root), '﻿' + csv.join('\n'));

for (const w of warnings) console.warn('WARN', w);
if (errors.length) { for (const e of errors) console.error('ERROR', e); process.exit(1); }
console.log(`OK ${out.bankVersion}: ${out.counts.verified} verified, ${out.counts.excluded} excluded`, JSON.stringify(out.counts));
