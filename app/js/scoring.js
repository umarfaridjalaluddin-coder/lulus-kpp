// Scoring. Correct = 1 mark; incorrect or unanswered = 0; no negative marking.
// Answers are matched by stable option ID, so shuffled display order never matters.

export function classify(question, answerId) {
  if (answerId == null || answerId === '') return 'unanswered';
  return answerId === question.correct ? 'correct' : 'incorrect';
}

/**
 * @param {Array} questions  the exact question snapshots used in the attempt
 * @param {Object} answers   { [questionId]: optionId }
 * @param {Object} config    { questionCount, passMark }
 */
export function scoreAttempt(questions, answers, config) {
  let correct = 0, incorrect = 0, unanswered = 0;
  const byChapter = {};
  const perQuestion = {};
  for (const q of questions) {
    const status = classify(q, answers[q.id]);
    perQuestion[q.id] = status;
    if (status === 'correct') correct++; else if (status === 'incorrect') incorrect++; else unanswered++;
    const c = (byChapter[q.chapter] ||= { total: 0, correct: 0, incorrect: 0, unanswered: 0 });
    c.total++; c[status]++;
  }
  const total = questions.length;
  if (correct + incorrect + unanswered !== total) throw new Error('Jumlah markah tidak konsisten');
  return {
    total,
    correct,
    incorrect,
    unanswered,
    percent: total ? Math.round((correct / total) * 1000) / 10 : 0,
    passed: correct >= config.passMark,
    passMark: config.passMark,
    byChapter,
    perQuestion,
  };
}

export const formatPercent = (p) => `${p.toFixed(1)}%`;
