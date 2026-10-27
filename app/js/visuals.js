// Educational diagrams as inline SVG strings. Pure functions (no DOM), so the
// build script can validate specs and tests can render them in Node.
// Animated parts use the CSS class "anim-*"; CSS disables them under reduced motion.
// Every diagram returns { svg, label } where label is the text equivalent.

const C = {
  road: '#4A4F55', grass: '#8DBF5B', white: '#FFFFFF', yellow: '#FFCC00', red: '#D7141A',
  teal: '#0C807C', navy: '#0B2240', amber: '#F5A100', green: '#14A44D', body: '#9FB3C4', line: '#24384F',
  hi: '#F2A900',
};

const wrap = (vb, body, label, cls = '') =>
  `<svg class="diag ${cls}" viewBox="${vb}" role="img" aria-label="${escAttr(label)}" focusable="false" xmlns="http://www.w3.org/2000/svg"><title>${escAttr(label)}</title>${body}</svg>`;
function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

// ---------------------------------------------------------------- validation
const PARTS_CAR = ['engine-oil', 'battery', 'radiator', 'tyre', 'brake', 'fuel', 'lights', 'gearbox', 'steering', 'washer'];
const PARTS_MOTO = ['engine-oil', 'battery', 'tyre', 'brake', 'fuel', 'chain', 'lights', 'rear-light', 'horn', 'mirror'];
export const PART_LABEL = {
  'engine-oil': 'enjin (minyak enjin)', battery: 'bateri', radiator: 'radiator', tyre: 'tayar', brake: 'brek',
  fuel: 'tangki bahan bakar', lights: 'lampu', 'rear-light': 'lampu belakang / brek', gearbox: 'kotak gear',
  steering: 'stereng', washer: 'bekas air pencuci cermin', chain: 'rantai pacuan', horn: 'hon', mirror: 'cermin sisi',
};

export function validateVis(spec) {
  if (!spec || typeof spec !== 'object') return 'spec missing';
  switch (spec.type) {
    case 'junction':
      if (!['cross', 'T'].includes(spec.shape)) return 'junction.shape';
      if (spec.arrow != null && !['straight', 'left', 'right'].includes(spec.arrow)) return 'junction.arrow';
      return null;
    case 'turn':
      if (!['left', 'right'].includes(spec.dir)) return 'turn.dir';
      if (!['correct', 'wide', 'wrong-lane', 'oncoming', 'edge', 'centre'].includes(spec.variant)) return 'turn.variant';
      return null;
    case 'distance':
      if (![2, 4].includes(spec.seconds)) return 'distance.seconds';
      if (!['neutral', 'close'].includes(spec.state || 'neutral')) return 'distance.state';
      if (spec.counts === false && spec.seconds !== 2) return 'distance.counts';
      return null;
    case 'component':
      if (spec.vehicle === 'car' && !PARTS_CAR.includes(spec.part)) return `component.part ${spec.part}`;
      if (spec.vehicle === 'motorcycle' && !PARTS_MOTO.includes(spec.part)) return `component.part ${spec.part}`;
      if (!['car', 'motorcycle'].includes(spec.vehicle)) return 'component.vehicle';
      return null;
    default:
      return `unknown type ${spec.type}`;
  }
}

export function renderVis(spec) {
  switch (spec.type) {
    case 'junction': return junction(spec);
    case 'turn': return turn(spec);
    case 'distance': return distance(spec);
    case 'component': return component(spec);
    default: return { svg: '', label: '' };
  }
}

// ---------------------------------------------------------------- junction (top view)
function roadsTopView(shape, side) {
  // Main road runs bottom→top (x 50..110). Side road at y 40..100.
  let s = `<rect width="160" height="160" fill="${C.grass}"/><rect x="50" y="0" width="60" height="160" fill="${C.road}"/>`;
  if (shape === 'cross' || side === 'right') s += `<rect x="110" y="40" width="50" height="60" fill="${C.road}"/>`;
  if (shape === 'cross' || side === 'left') s += `<rect x="0" y="40" width="50" height="60" fill="${C.road}"/>`;
  if (shape === 'T') s = `<rect width="160" height="160" fill="${C.grass}"/><rect x="50" y="40" width="60" height="120" fill="${C.road}"/><rect x="0" y="40" width="160" height="60" fill="${C.road}"/>`;
  // centre lines (dashed) outside the junction box
  const dash = (x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.white}" stroke-width="2.5" stroke-dasharray="7 6"/>`;
  s += dash(80, 104, 80, 160);
  if (shape === 'cross') s += dash(80, 0, 80, 36);
  if (shape === 'cross' || side === 'right' || shape === 'T') s += dash(114, 70, 160, 70);
  if (shape === 'cross' || side === 'left' || shape === 'T') s += dash(0, 70, 46, 70);
  if (!shape && !side) s += dash(80, 0, 80, 36);
  // stop line for the approach lane
  s += `<line x1="50" y1="103" x2="80" y2="103" stroke="${C.white}" stroke-width="3"/>`;
  return s;
}
function carTop(x, y, rot = 0, fill = C.teal) {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-7" y="-11" width="14" height="22" rx="4" fill="${fill}" stroke="${C.white}" stroke-width="1.2"/><rect x="-5" y="-6" width="10" height="5" rx="1.5" fill="#CFE3F5"/></g>`;
}
function arrowPath(d, id) {
  return `<path class="anim-arrow" d="${d}" fill="none" stroke="${C.hi}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#ah-${id})" pathLength="100"/>`;
}
const arrowMarker = (id) => `<defs><marker id="ah-${id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${C.hi}"/></marker></defs>`;
let uid = 0;

function junction(spec) {
  const id = `j${++uid}`;
  let s = arrowMarker(id) + roadsTopView(spec.shape);
  s += carTop(65, 132);
  const paths = { straight: 'M65 118 V12', left: 'M65 118 V92 Q65 85 55 85 H8', right: 'M65 118 V80 Q65 55 90 55 H152' };
  if (spec.arrow) s += arrowPath(paths[spec.arrow], id);
  const shapeTxt = spec.shape === 'cross' ? 'simpang empat' : 'simpang T';
  const dirTxt = { straight: ' Anak panah menunjukkan kenderaan bergerak lurus melintasi simpang.', left: ' Anak panah menunjukkan kenderaan membelok ke kiri.', right: ' Anak panah menunjukkan kenderaan membelok ke kanan.' }[spec.arrow] || '';
  const label = `Rajah pandangan atas ${shapeTxt}. Kenderaan anda berada di lorong kiri sebelum garisan berhenti.${dirTxt}`;
  return { svg: wrap('0 0 160 160', s, label, 'diag-junction'), label };
}

const TURN = {
  right: {
    correct: { start: [72, 150], d: 'M72 140 V96 Q72 55 112 55 H154', txt: 'Kenderaan kekal di lorong kiri tetapi rapat ke garisan tengah, kemudian membelok ke kanan masuk ke lorong kiri jalan simpang.' },
    oncoming: { start: [72, 150], d: 'M72 140 L92 118 V96 Q92 55 120 55 H154', txt: 'Kenderaan masuk ke lorong bertentangan sebelum simpang, kemudian membelok ke kanan.' },
    'wrong-lane': { start: [72, 150], d: 'M72 140 V100 Q72 85 100 85 H154', txt: 'Kenderaan membelok ke kanan dan masuk ke lorong kanan jalan simpang (lorong arah bertentangan).' },
    edge: { start: [56, 150], d: 'M56 140 V100 Q56 55 112 55 H154', txt: 'Kenderaan rapat ke tepi kiri jalan, kemudian membelok ke kanan merentasi seluruh jalan.' },
  },
  left: {
    correct: { start: [58, 150], d: 'M58 140 V104 Q58 85 40 85 H6', txt: 'Kenderaan rapat ke sebelah kiri lorong, kemudian membelok ke kiri masuk ke lorong kiri jalan simpang.' },
    wide: { start: [58, 150], d: 'M58 140 L92 116 V104 Q92 85 50 85 H6', txt: 'Kenderaan menghala ke kanan dahulu (membelok lebar), kemudian membelok ke kiri.' },
    'wrong-lane': { start: [58, 150], d: 'M58 140 V96 Q58 55 30 55 H6', txt: 'Kenderaan membelok ke kiri dan masuk ke lorong kanan jalan simpang (lorong arah bertentangan).' },
    centre: { start: [76, 150], d: 'M76 140 V104 Q76 85 46 85 H6', txt: 'Kenderaan rapat ke garisan tengah, kemudian membelok ke kiri dari tengah jalan.' },
  },
};
function turn(spec) {
  const id = `t${++uid}`;
  const v = TURN[spec.dir][spec.variant];
  let s = arrowMarker(id) + roadsTopView(null, spec.dir);
  s += carTop(v.start[0], v.start[1]);
  s += arrowPath(v.d, id);
  return { svg: wrap('0 0 160 160', s, v.txt, 'diag-turn'), label: v.txt };
}
export function turnText(dir, variant) { return TURN[dir]?.[variant]?.txt; }

// ---------------------------------------------------------------- distance (side view)
function carSide(x, y, fill, label) {
  return `<g transform="translate(${x} ${y})"><path d="M-30 0 V-12 L-20 -14 L-12 -24 H12 L22 -14 L30 -12 V0 Z" fill="${fill}"/>` +
    `<path d="M-10 -21 H-1 V-14 H-16 Z M2 -21 H10 L17 -14 H2 Z" fill="#CFE3F5"/>` +
    `<circle cx="-18" cy="0" r="6" fill="${C.line}"/><circle cx="18" cy="0" r="6" fill="${C.line}"/>` +
    `<circle cx="-18" cy="0" r="2.4" fill="#C9D3DD"/><circle cx="18" cy="0" r="2.4" fill="#C9D3DD"/>` +
    (label ? `<text x="0" y="-30" font-family="Arial, sans-serif" font-weight="700" font-size="12" text-anchor="middle" fill="${C.navy}">${label}</text>` : '') + `</g>`;
}
function distance(spec) {
  const state = spec.state || 'neutral';
  const markerX = 170;
  const aX = state === 'close' ? markerX - 34 : markerX - 92;
  const bX = state === 'close' ? markerX + 70 : markerX + 30;
  let s = `<rect width="320" height="140" fill="#DDEFF7"/><rect y="100" width="320" height="40" fill="${C.road}"/>` +
    `<line x1="0" y1="118" x2="320" y2="118" stroke="${C.white}" stroke-width="2" stroke-dasharray="14 10"/>` +
    `<rect y="94" width="320" height="6" fill="${C.grass}"/>` +
    // fixed marker (tree)
    `<rect x="${markerX - 3}" y="64" width="6" height="34" fill="#6B4A2B"/><circle cx="${markerX}" cy="56" r="16" fill="#2E8B57"/>` +
    `<text x="${markerX + 20}" y="52" font-family="Arial, sans-serif" font-size="11" fill="${C.navy}">penanda tetap</text>` +
    carSide(bX, 112, C.red, 'B') + carSide(aX, 112, C.teal, 'A');
  if (spec.tow) s += `<rect x="${aX - 70}" y="96" width="34" height="14" rx="2" fill="#7C8B99"/><line x1="${aX - 36}" y1="106" x2="${aX - 30}" y2="106" stroke="${C.line}" stroke-width="2"/><circle cx="${aX - 53}" cy="112" r="5" fill="${C.line}"/>`;
  if (spec.wet) s += [...Array(14)].map((_, i) => `<line x1="${12 + i * 23}" y1="${8 + (i % 3) * 9}" x2="${6 + i * 23}" y2="${22 + (i % 3) * 9}" stroke="#7FA7C6" stroke-width="2"/>`).join('');
  const counts = spec.seconds === 4 ? ['satu ribu satu', 'satu ribu dua', 'satu ribu tiga', 'satu ribu empat'] : ['satu ribu satu', 'satu ribu dua'];
  if (spec.counts !== false) s += `<rect x="6" y="6" width="112" height="${10 + counts.length * 13}" rx="6" fill="#FFFFFF" fill-opacity=".85"/><g font-family="Arial, sans-serif" font-size="10.5" fill="${C.navy}">` + counts.map((c, i) => `<text class="anim-count" style="animation-delay:${i * 0.6}s" x="12" y="${19 + i * 13}">${i + 1}. ${c}</text>`).join('') + `</g>`;
  const label = `Rajah sisi: kereta B di hadapan kereta A, dengan sebatang pokok di tepi jalan${state === 'close' ? '. Kereta A hampir tiba di pokok' : ''}${spec.tow ? '. Kereta A sedang menarik treler' : ''}${spec.wet ? '. Hujan sedang turun' : ''}.${spec.counts !== false ? ` Kiraan: ${counts.join(', ')}.` : ''}`;
  return { svg: wrap('0 0 320 140', s, label, 'diag-distance'), label };
}

// ---------------------------------------------------------------- vehicle components
const CAR_PARTS = {
  'engine-oil': [80, 70, 16], battery: [96, 62, 12], radiator: [52, 74, 12], tyre: [86, 104, 20], brake: [86, 104, 10],
  fuel: [252, 70, 11], lights: [44, 80, 11], gearbox: [118, 92, 14], steering: [140, 56, 12], washer: [62, 60, 10],
};
const MOTO_PARTS = {
  'engine-oil': [152, 103, 18], battery: [178, 76, 12], tyre: [86, 116, 26], brake: [86, 116, 10], fuel: [150, 62, 16],
  chain: [194, 117, 16], lights: [92, 58, 10], 'rear-light': [237, 70, 10], horn: [90, 80, 8], mirror: [103, 14, 8],
};
function carProfile() {
  return `<path d="M36 96 V78 Q38 66 60 64 L104 58 L134 34 Q142 28 160 28 H214 Q230 28 244 46 L262 60 Q284 64 286 78 V96 Z" fill="${C.body}" stroke="${C.line}" stroke-width="3"/>` +
    `<path d="M140 40 Q146 34 160 34 H186 V60 H118 Z M192 34 H212 Q224 34 236 52 L240 60 H192 Z" fill="#E4EEF5" stroke="${C.line}" stroke-width="2"/>` +
    `<line x1="104" y1="60" x2="262" y2="60" stroke="${C.line}" stroke-width="2"/>` +
    [86, 236].map((x) => `<circle cx="${x}" cy="104" r="20" fill="${C.line}"/><circle cx="${x}" cy="104" r="9" fill="#C9D3DD"/>`).join('') +
    `<rect x="38" y="74" width="10" height="9" rx="2" fill="#FFF3B0" stroke="${C.line}" stroke-width="1.5"/><rect x="276" y="70" width="8" height="10" rx="2" fill="#F37C6B" stroke="${C.line}" stroke-width="1.5"/>`;
}
function motoProfile() {
  return [86, 236].map((x) => `<circle cx="${x}" cy="116" r="26" fill="none" stroke="${C.line}" stroke-width="7"/><circle cx="${x}" cy="116" r="5" fill="${C.line}"/>`).join('') +
    `<path d="M86 116 L106 40" stroke="${C.line}" stroke-width="6" stroke-linecap="round"/>` +
    `<path d="M96 30 L118 26" stroke="${C.line}" stroke-width="5" stroke-linecap="round"/><path d="M104 28 L100 14" stroke="${C.line}" stroke-width="2.5"/><rect x="96" y="10" width="14" height="8" rx="3" fill="#E4EEF5" stroke="${C.line}" stroke-width="2"/>` +
    `<path d="M120 76 Q130 50 160 50 Q186 50 192 66 L218 70 L246 68 L244 80 L196 84 L172 98 L130 98 Z" fill="${C.body}" stroke="${C.line}" stroke-width="3"/>` +
    `<rect x="130" y="88" width="44" height="30" rx="6" fill="#7C8B99" stroke="${C.line}" stroke-width="3"/>` +
    `<path d="M150 118 L236 116" stroke="${C.line}" stroke-width="3" stroke-dasharray="4 3"/>` +
    `<circle cx="92" cy="58" r="7" fill="#FFF3B0" stroke="${C.line}" stroke-width="2"/><rect x="85" y="76" width="9" height="7" rx="2" fill="${C.line}"/><rect x="232" y="66" width="10" height="9" rx="2" fill="#F37C6B" stroke="${C.line}" stroke-width="1.5"/>`;
}
function component(spec) {
  const isCar = spec.vehicle === 'car';
  const [x, y, r] = (isCar ? CAR_PARTS : MOTO_PARTS)[spec.part];
  const name = PART_LABEL[spec.part];
  const dy = isCar ? 0 : 6;
  let s = `<rect width="320" height="${isCar ? 150 : 160}" fill="#EEF4F7" rx="12"/><g transform="translate(0 ${dy})">` + (isCar ? carProfile() : motoProfile()) +
    `<circle class="anim-pulse" cx="${x}" cy="${y}" r="${r + 6}" fill="${C.hi}" fill-opacity=".28" stroke="${C.hi}" stroke-width="3"/>` +
    `<circle cx="${x}" cy="${y}" r="4" fill="${C.hi}"/></g>`;
  const [lx, ly] = isCar ? [160, 128] : [236, 6];
  s += `<rect x="${lx - 76}" y="${ly}" width="152" height="18" rx="9" fill="${C.navy}"/><text x="${lx}" y="${ly + 13}" font-family="Arial, sans-serif" font-weight="700" font-size="11" text-anchor="middle" fill="${C.white}">${name}</text>`;
  const label = `Rajah sisi ${isCar ? 'kereta' : 'motosikal'} dengan bahagian ${name} ditanda.`;
  return { svg: wrap(`0 0 320 ${isCar ? 150 : 160}`, s, label, 'diag-component'), label };
}
