// Local persistence. Uses localStorage when available and falls back to
// memory (with `persistent === false`) so the app still works for a session.
const NS = 'lulusKpp.v1';

export function createStore(backend = (() => { try { return globalThis.localStorage; } catch { return null; } })()) {
  let persistent = false;
  const mem = new Map();
  try {
    if (backend) {
      const k = `${NS}.__probe`;
      backend.setItem(k, '1');
      backend.removeItem(k);
      persistent = true;
    }
  } catch { persistent = false; }

  const read = (key, fallback) => {
    try {
      const raw = persistent ? backend.getItem(`${NS}.${key}`) : mem.get(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  };
  const write = (key, value) => {
    const raw = JSON.stringify(value);
    if (persistent) {
      try { backend.setItem(`${NS}.${key}`, raw); return true; }
      catch { mem.set(key, raw); return false; }
    }
    mem.set(key, raw);
    return true;
  };
  const remove = (key) => { try { if (persistent) backend.removeItem(`${NS}.${key}`); } catch { /* ignore */ } mem.delete(key); };

  return {
    get persistent() { return persistent; },
    // Active exam (at most one).
    getActiveExam: () => read('activeExam', null),
    saveActiveExam: (a) => write('activeExam', a),
    clearActiveExam: () => remove('activeExam'),
    // Completed exam attempts, newest first.
    getExamHistory: () => read('examHistory', []),
    /** Adds a submitted attempt once; repeat calls with the same id are ignored. */
    addExamResult(attempt) {
      const list = read('examHistory', []);
      if (list.some((a) => a.id === attempt.id)) return false;
      list.unshift(attempt);
      return write('examHistory', list.slice(0, 30));
    },
    getPracticeStats: () => read('practiceStats', { sessions: 0, answered: 0, correct: 0, incorrect: 0, skipped: 0 }),
    savePracticeStats: (s) => write('practiceStats', s),
    getBookmarks: () => read('bookmarks', []),
    saveBookmarks: (ids) => write('bookmarks', ids),
    // Question IDs to revise (wrong or unanswered), with when they were last missed.
    getMistakes: () => read('mistakes', {}),
    saveMistakes: (m) => write('mistakes', m),
    resetAll() {
      for (const k of ['activeExam', 'examHistory', 'practiceStats', 'bookmarks', 'mistakes']) remove(k);
    },
  };
}
