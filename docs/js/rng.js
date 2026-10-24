// Small seedable PRNG so selection and shuffling are reproducible in tests.
export function makeRng(seed = Date.now() ^ Math.floor(Math.random() * 1e9)) {
  let s = (seed >>> 0) || 0x9e3779b9;
  return function rand() {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newId(prefix = 'id') {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${r}`;
}
