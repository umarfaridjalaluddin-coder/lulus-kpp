// Generates original SVG illustrations of Malaysian road signs, markings and
// traffic lights used by question images. Designs follow the shapes, colours
// and symbols shown in the KPP textbook (MSBT5, 2025) but are drawn from scratch.
// Run: node scripts/images.mjs  -> writes app/assets/img/*.svg + content/images.json
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('../app/assets/img/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const C = {
  yellow: '#FFCC00', black: '#111111', red: '#D7141A', white: '#FFFFFF',
  blue: '#0B57A4', orange: '#F28C00', road: '#4A4F55', green: '#14A44D', amber: '#F5A100',
};

const svg = (title, body, vb = '0 0 200 200') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img"><title>${title}</title>${body}</svg>\n`;

// ---------- shape helpers ----------
const diamond = (inner, fill = C.yellow) =>
  `<rect x="35" y="35" width="130" height="130" rx="10" transform="rotate(45 100 100)" fill="${C.black}"/>` +
  `<rect x="42" y="42" width="116" height="116" rx="7" transform="rotate(45 100 100)" fill="${fill}"/>` + inner;

const ring = (inner, fill = C.white) =>
  `<circle cx="100" cy="100" r="92" fill="${C.red}"/><circle cx="100" cy="100" r="72" fill="${fill}"/>` + inner;

const slash = `<line x1="49" y1="49" x2="151" y2="151" stroke="${C.red}" stroke-width="15"/>`;

const blueDisc = (inner) => `<circle cx="100" cy="100" r="92" fill="${C.blue}"/>` +
  `<circle cx="100" cy="100" r="88" fill="none" stroke="${C.white}" stroke-width="3"/>` + inner;

const arrowHead = (x, y, dir, size = 26, fill = C.black) => {
  // dir: up, down, left, right
  const s = size;
  const pts = {
    up: `${x},${y - s} ${x - s},${y + 2} ${x + s},${y + 2}`,
    down: `${x},${y + s} ${x - s},${y - 2} ${x + s},${y - 2}`,
    left: `${x - s},${y} ${x + 2},${y - s} ${x + 2},${y + s}`,
    right: `${x + s},${y} ${x - 2},${y - s} ${x - 2},${y + s}`,
  }[dir];
  return `<polygon points="${pts}" fill="${fill}"/>`;
};

const car = (x, y, fill, scale = 1) =>
  // simple front-view car silhouette centred at x,y
  `<g transform="translate(${x} ${y}) scale(${scale})">` +
  `<path d="M-22 4 L-17 -12 Q-15 -17 -9 -17 L9 -17 Q15 -17 17 -12 L22 4 Z" fill="${fill}"/>` +
  `<rect x="-26" y="2" width="52" height="16" rx="5" fill="${fill}"/>` +
  `<rect x="-12" y="-13" width="24" height="10" rx="2" fill="${C.white}"/>` +
  `<circle cx="-16" cy="10" r="4" fill="${C.white}"/><circle cx="16" cy="10" r="4" fill="${C.white}"/>` +
  `<rect x="-24" y="17" width="9" height="8" rx="2" fill="${fill}"/><rect x="15" y="17" width="9" height="8" rx="2" fill="${fill}"/></g>`;

const octagon = (cx, cy, r, label, fs) => {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 8) + i * Math.PI / 4;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  const inner = pts.map((p) => { const [x, y] = p.split(',').map(Number); return `${(cx + (x - cx) * 0.9).toFixed(1)},${(cy + (y - cy) * 0.9).toFixed(1)}`; });
  return `<polygon points="${pts.join(' ')}" fill="${C.red}"/>` +
    `<polygon points="${inner.join(' ')}" fill="none" stroke="${C.white}" stroke-width="${r / 22}"/>` +
    (label ? `<text x="${cx}" y="${cy + fs * 0.36}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="${fs}" text-anchor="middle" fill="${C.white}" textLength="${r * 1.45}" lengthAdjust="spacingAndGlyphs">${label}</text>` : '');
};

const plate = (fill, lines, opts = {}) => {
  const { w = 180, h = 120, fg = C.white, fs = 24 } = opts;
  const x = (200 - w) / 2, y = (200 - h) / 2;
  const lh = fs * 1.25;
  const startY = 100 - ((lines.length - 1) * lh) / 2 + fs * 0.35;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}"/>` +
    `<rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" rx="7" fill="none" stroke="${fg}" stroke-width="3"/>` +
    lines.map((t, i) => `<text x="100" y="${(startY + i * lh).toFixed(1)}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="${fs}" text-anchor="middle" fill="${fg}">${t}</text>`).join('');
};

const K = C.black;
const thick = (d, w = 16, col = K) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="miter"/>`;

// ---------- image catalogue ----------
// Each entry: file id -> { title (neutral description used as alt text), body }
// Alt text describes what is drawn, never the answer wording, so it is fair for screen-reader users
// without being a give-away beyond what sighted users see.
const images = {
  // ===== Isyarat berbahaya (diamond kuning) =====
  'w-simpang-empat': {
    alt: 'Papan tanda berlian kuning berbingkai hitam dengan simbol tambah (+) hitam.',
    body: diamond(thick('M100 52 V148 M52 100 H148', 18)),
  },
  'w-simpang-t': {
    alt: 'Papan tanda berlian kuning dengan simbol huruf T hitam.',
    body: diamond(thick('M100 150 V82 M55 82 H145', 18)),
  },
  'w-simpang-kiri': {
    alt: 'Papan tanda berlian kuning dengan garisan menegak hitam dan satu cabang ke kiri.',
    body: diamond(thick('M100 150 V50 M100 100 H55', 18)),
  },
  'w-simpang-kanan': {
    alt: 'Papan tanda berlian kuning dengan garisan menegak hitam dan satu cabang ke kanan.',
    body: diamond(thick('M100 150 V50 M100 100 H145', 18)),
  },
  'w-selekoh-kanan': {
    alt: 'Papan tanda berlian kuning dengan anak panah hitam yang melengkung ke kanan.',
    body: diamond(thick('M88 150 V105 Q88 78 115 78 H118', 16) + arrowHead(130, 78, 'right', 20)),
  },
  'w-selekoh-kiri': {
    alt: 'Papan tanda berlian kuning dengan anak panah hitam yang melengkung ke kiri.',
    body: diamond(thick('M112 150 V105 Q112 78 85 78 H82', 16) + arrowHead(70, 78, 'left', 20)),
  },
  'w-selekoh-berkembar': {
    alt: 'Papan tanda berlian kuning dengan anak panah hitam berbentuk S, mula-mula membelok ke kanan kemudian ke kiri.',
    body: diamond(thick('M88 152 V128 Q88 110 104 104 Q120 98 120 82 Q120 72 108 66', 14) + `<polygon points="94,58 116,56 106,76" fill="${K}"/>`),
  },
  'w-bengkang-bengkok': {
    alt: 'Papan tanda berlian kuning dengan garisan hitam beralun naik ke atas.',
    body: diamond(thick('M100 152 Q80 140 100 124 Q120 108 100 92 Q80 76 100 60', 13) + arrowHead(100, 56, 'up', 16)),
  },
  'w-bulatan': {
    alt: 'Papan tanda berlian kuning dengan tiga anak panah hitam membentuk bulatan.',
    body: diamond(
      [0, 120, 240].map((r) => `<g transform="rotate(${r} 100 100)"><path d="M100 70 A30 30 0 0 1 126 85" fill="none" stroke="${K}" stroke-width="10"/><polygon points="133,80 132,98 116,91" fill="${K}"/></g>`).join('')),
  },
  'w-lampu-isyarat': {
    alt: 'Papan tanda berlian kuning dengan simbol tiang lampu isyarat: lampu merah di atas, jingga di tengah dan hijau di bawah.',
    body: diamond(`<rect x="82" y="55" width="36" height="90" rx="8" fill="${K}"/><circle cx="100" cy="72" r="10" fill="${C.red}"/><circle cx="100" cy="100" r="10" fill="${C.amber}"/><circle cx="100" cy="128" r="10" fill="${C.green}"/>`),
  },
  'w-jalan-sempit': {
    alt: 'Papan tanda berlian kuning dengan dua garisan hitam yang semakin rapat ke arah atas di kedua-dua belah.',
    body: diamond(thick('M72 150 V120 L88 95 V52 M128 150 V120 L112 95 V52', 12)),
  },
  'w-bonggol': {
    alt: 'Papan tanda berlian kuning dengan anak panah hitam ke atas di atas satu bonggol hitam.',
    body: diamond(`<path d="M55 140 Q100 100 145 140 Z" fill="${K}"/>` + thick('M100 112 V78', 12) + arrowHead(100, 72, 'up', 18)),
  },
  'w-dua-hala': {
    alt: 'Papan tanda berlian kuning dengan dua anak panah hitam bertentangan arah, satu ke atas dan satu ke bawah.',
    body: diamond(thick('M82 145 V82', 11) + arrowHead(82, 72, 'up', 16) + thick('M118 55 V118', 11) + arrowHead(118, 128, 'down', 16)),
  },
  'w-bahaya-lain': {
    alt: 'Papan tanda berlian kuning dengan tanda seru hitam.',
    body: diamond(`<rect x="91" y="55" width="18" height="62" rx="4" fill="${K}"/><circle cx="100" cy="136" r="11" fill="${K}"/>`),
  },
  'w-berhenti-hadapan': {
    alt: 'Papan tanda berlian kuning dengan simbol oktagon merah kecil bertulis BERHENTI.',
    body: diamond(octagon(100, 100, 40, 'BERHENTI', 15)),
  },
  'w-beri-laluan-hadapan': {
    alt: 'Papan tanda berlian kuning dengan segi tiga terbalik berbingkai merah dan bahagian tengah putih.',
    body: diamond(`<polygon points="62,70 138,70 100,138" fill="${C.red}"/><polygon points="76,78 124,78 100,120" fill="${C.white}"/>`),
  },
  'w-pejalan-kaki': {
    alt: 'Papan tanda berlian kuning dengan simbol seorang pejalan kaki hitam sedang berjalan di atas jalur lintasan.',
    body: diamond(`<circle cx="104" cy="62" r="10" fill="${K}"/>` +
      thick('M101 76 L95 106 M97 84 L80 98 M98 84 L116 96 M95 106 L82 132 M95 106 L114 130', 9) +
      `<rect x="62" y="138" width="16" height="7" fill="${K}"/><rect x="84" y="138" width="16" height="7" fill="${K}"/><rect x="106" y="138" width="16" height="7" fill="${K}"/><rect x="128" y="138" width="12" height="7" fill="${K}"/>`),
  },
  'w-pucuk-rebong': {
    alt: 'Papan segi empat tepat kuning dengan tiga tanda anak panah (chevron) hitam yang menghala ke kanan.',
    body: `<rect x="15" y="55" width="170" height="90" rx="8" fill="${K}"/><rect x="21" y="61" width="158" height="78" rx="5" fill="${C.yellow}"/>` +
      [40, 85, 130].map((x) => `<polygon points="${x},70 ${x + 22},70 ${x + 44},100 ${x + 22},130 ${x},130 ${x + 22},100" fill="${K}"/>`).join(''),
  },
  // ===== Isyarat larangan =====
  'p-dilarang-masuk': {
    alt: 'Papan tanda bulat merah penuh dengan satu bar mendatar putih di tengah.',
    body: `<circle cx="100" cy="100" r="92" fill="${C.red}"/><rect x="38" y="86" width="124" height="28" fill="${C.white}"/>`,
  },
  'p-had-laju-50': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan nombor 50.',
    body: ring(`<text x="100" y="124" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="72" text-anchor="middle" fill="${K}">50</text>`),
  },
  'p-had-laju-90': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan nombor 90.',
    body: ring(`<text x="100" y="124" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="72" text-anchor="middle" fill="${K}">90</text>`),
  },
  'p-had-laju-110': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan nombor 110.',
    body: ring(`<text x="100" y="122" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="62" text-anchor="middle" fill="${K}" textLength="112" lengthAdjust="spacingAndGlyphs">110</text>`),
  },
  'p-had-laju-tamat': {
    alt: 'Papan tanda bulat putih berbingkai hitam nipis dengan jalur hitam tebal menyerong.',
    body: `<circle cx="100" cy="100" r="92" fill="${C.white}" stroke="${K}" stroke-width="4"/><line x1="40" y1="160" x2="160" y2="40" stroke="${K}" stroke-width="26"/>`,
  },
  'p-dilarang-memotong': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan dua kereta hitam bersebelahan dipangkah garisan merah menyerong, dan plat di bawahnya bertulis DILARANG MEMOTONG.',
    body: ring(car(72, 98, K, 1.0) + car(128, 98, K, 1.0) + slash) + subPlate(['DILARANG', 'MEMOTONG']),
    vb: '0 0 200 280',
  },
  'p-berat-dilarang-memotong': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan dua lori hitam bersebelahan dipangkah garisan merah menyerong, dan plat di bawahnya bertulis DILARANG MEMOTONG.',
    body: ring(truck(74, 100) + truck(126, 100) + slash) + subPlate(['DILARANG', 'MEMOTONG']),
    vb: '0 0 200 280',
  },
  'p-dilarang-hon': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan simbol hon (trompet) hitam dipangkah garisan merah menyerong.',
    body: ring(`<path d="M55 92 H95 L135 72 V128 L95 108 H55 Z" fill="${K}"/><rect x="55" y="88" width="14" height="24" fill="${K}"/>` + slash),
  },
  'p-dilarang-pusing-balik': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan anak panah hitam berbentuk huruf U terbalik dipangkah garisan merah menyerong.',
    body: ring(thick('M80 145 V88 Q80 62 104 62 Q126 62 126 88 V118', 15) + arrowHead(126, 130, 'down', 20) + slash),
  },
  'p-dilarang-belok-kanan': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan anak panah hitam membelok ke kanan dipangkah garisan merah menyerong.',
    body: ring(thick('M85 148 V95 Q85 82 98 82 H118', 15) + arrowHead(130, 82, 'right', 20) + slash),
  },
  'p-dilarang-belok-kiri': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan anak panah hitam membelok ke kiri dipangkah garisan merah menyerong.',
    body: ring(thick('M115 148 V95 Q115 82 102 82 H82', 15) + arrowHead(70, 82, 'left', 20) + `<line x1="151" y1="49" x2="49" y2="151" stroke="${C.red}" stroke-width="15"/>`),
  },
  'p-dilarang-letak': {
    alt: 'Papan tanda bulat biru berbingkai merah dengan satu garisan merah menyerong.',
    body: `<circle cx="100" cy="100" r="92" fill="${C.red}"/><circle cx="100" cy="100" r="74" fill="${C.blue}"/><line x1="48" y1="48" x2="152" y2="152" stroke="${C.red}" stroke-width="16"/>`,
  },
  'p-dilarang-berhenti': {
    alt: 'Papan tanda bulat biru berbingkai merah dengan dua garisan merah bersilang membentuk X.',
    body: `<circle cx="100" cy="100" r="92" fill="${C.red}"/><circle cx="100" cy="100" r="74" fill="${C.blue}"/><line x1="48" y1="48" x2="152" y2="152" stroke="${C.red}" stroke-width="16"/><line x1="152" y1="48" x2="48" y2="152" stroke="${C.red}" stroke-width="16"/>`,
  },
  'p-berhenti': {
    alt: 'Papan tanda oktagon (lapan segi) merah bertulis BERHENTI dengan huruf putih.',
    body: octagon(100, 100, 92, 'BERHENTI', 36),
  },
  'p-had-lebar': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan tulisan 2.5m di antara dua anak panah hitam yang menghala ke tengah.',
    body: ring(`<polygon points="34,100 52,84 52,116" fill="${K}"/><polygon points="166,100 148,84 148,116" fill="${K}"/><text x="100" y="116" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="36" text-anchor="middle" fill="${K}">2.5m</text>`),
  },
  'p-had-berat': {
    alt: 'Papan tanda bulat putih berbingkai merah dengan tulisan 8t.',
    body: ring(`<text x="100" y="122" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="66" text-anchor="middle" fill="${K}">8t</text>`),
  },
  'p-kawasan-kemalangan': {
    alt: 'Papan segi empat tepat merah bertulis AWAS KAWASAN KEMALANGAN dengan huruf putih.',
    body: plate(C.red, ['AWAS', 'KAWASAN', 'KEMALANGAN'], { fs: 22 }),
  },
  // ===== Isyarat mandatori =====
  'm-jalan-terus': {
    alt: 'Papan tanda bulat biru dengan anak panah putih menghala lurus ke atas.',
    body: blueDisc(thick('M100 150 V80', 18, C.white) + arrowHead(100, 70, 'up', 30, C.white)),
  },
  'm-belok-kiri': {
    alt: 'Papan tanda bulat biru dengan anak panah putih menghala ke kiri.',
    body: blueDisc(thick('M150 100 H80', 18, C.white) + arrowHead(70, 100, 'left', 30, C.white)),
  },
  'm-kekal-kiri': {
    alt: 'Papan tanda bulat biru dengan anak panah putih menyerong ke bawah sebelah kiri.',
    body: blueDisc(`<g transform="rotate(-135 100 100)">` + thick('M100 150 V80', 18, C.white) + arrowHead(100, 70, 'up', 30, C.white) + `</g>`),
  },
  'm-mana-mana-hala': {
    alt: 'Papan tanda bulat biru dengan dua anak panah putih, satu menyerong ke bawah kiri dan satu ke bawah kanan.',
    body: blueDisc(
      `<g transform="rotate(-150 78 92)">` + thick('M78 120 V78', 14, C.white) + arrowHead(78, 70, 'up', 20, C.white) + `</g>` +
      `<g transform="rotate(150 122 92)">` + thick('M122 120 V78', 14, C.white) + arrowHead(122, 70, 'up', 20, C.white) + `</g>`),
  },
  'm-jalan-sehala': {
    alt: 'Papan segi empat tepat biru bertulis JALAN SEHALA dengan anak panah putih menghala ke kanan.',
    body: `<rect x="10" y="55" width="180" height="90" rx="8" fill="${C.blue}"/><rect x="16" y="61" width="168" height="78" rx="5" fill="none" stroke="${C.white}" stroke-width="3"/>` +
      `<text x="100" y="92" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="19" text-anchor="middle" fill="${C.white}">JALAN SEHALA</text>` +
      thick('M40 115 H140', 8, C.white) + arrowHead(150, 115, 'right', 12, C.white),
  },
  'm-ikut-kiri': {
    alt: 'Papan segi empat tepat biru bertulis IKUT KIRI JIKA TIDAK MEMOTONG.',
    body: plate(C.blue, ['IKUT KIRI', 'JIKA TIDAK', 'MEMOTONG'], { w: 170, h: 140, fs: 22 }),
  },
  // ===== Garisan jalan (pandangan atas) =====
  'r-garisan-putus': {
    alt: 'Pandangan atas jalan dua lorong dengan garisan tengah putih terputus-putus.',
    body: road(`${dashes(100)}`),
  },
  'r-berkembar-terus': {
    alt: 'Pandangan atas jalan dua lorong dengan dua garisan putih berterusan dan selari di tengah.',
    body: road(`<rect x="92" y="0" width="5" height="200" fill="${C.white}"/><rect x="103" y="0" width="5" height="200" fill="${C.white}"/>`),
  },
  'r-terus-dan-putus': {
    alt: 'Pandangan atas jalan dua lorong. Di tengah ada garisan putih berterusan di sebelah kanan dan garisan putih terputus-putus di sebelah kiri. Kereta A berada di lorong kiri, bersebelahan garisan terputus-putus.',
    body: road(`${dashes(94)}<rect x="104" y="0" width="5" height="200" fill="${C.white}"/>` + topCar(65, 130, C.blue, 'A')),
  },
  'r-kuning-tepi': {
    alt: 'Pandangan atas jalan dengan garisan kuning berterusan di sepanjang tepi kiri jalan.',
    body: road(`${dashes(100)}<rect x="34" y="0" width="5" height="200" fill="${C.yellow}"/>`),
  },
  'r-petak-kuning': {
    alt: 'Pandangan atas persimpangan dengan petak berbingkai kuning yang diisi garisan kuning bersilang.',
    body: `<rect width="200" height="200" fill="${C.road}"/>` +
      `<rect x="45" y="45" width="110" height="110" fill="none" stroke="${C.yellow}" stroke-width="5"/>` +
      `<clipPath id="pk"><rect x="45" y="45" width="110" height="110"/></clipPath><g clip-path="url(#pk)" stroke="${C.yellow}" stroke-width="4">` +
      [...Array(12)].map((_, i) => `<line x1="${i * 22}" y1="0" x2="${i * 22 - 200}" y2="200"/><line x1="${200 - i * 22}" y1="0" x2="${400 - i * 22}" y2="200"/>`).join('') + `</g>`,
  },
  'r-lintasan-belang': {
    alt: 'Pandangan atas jalan dengan jalur-jalur putih tebal selari melintang jalan seperti belang zebra.',
    body: road([...Array(7)].map((_, i) => `<rect x="${32 + i * 20}" y="70" width="12" height="60" fill="${C.white}"/>`).join('') + `<rect x="30" y="58" width="140" height="4" fill="${C.white}" opacity="0"/>`, true),
  },
  'r-kuning-melintang': {
    alt: 'Pandangan atas jalan dengan beberapa garisan kuning nipis melintang jalan secara berulang.',
    body: road([...Array(6)].map((_, i) => `<rect x="30" y="${40 + i * 22}" width="140" height="5" fill="${C.yellow}"/>`).join('')),
  },
  'r-chevron': {
    alt: 'Pandangan atas jalan dengan kawasan bertanda jalur-jalur putih menyerong berbentuk anak panah (chevron) di tengah jalan.',
    body: road(`<polygon points="100,30 125,170 75,170" fill="none" stroke="${C.white}" stroke-width="4"/>` +
      `<clipPath id="cv"><polygon points="100,30 125,170 75,170"/></clipPath><g clip-path="url(#cv)" stroke="${C.white}" stroke-width="6">` +
      [...Array(9)].map((_, i) => `<polyline points="60,${70 + i * 18} 100,${50 + i * 18} 140,${70 + i * 18}" fill="none"/>`).join('') + `</g>`, true),
  },
  // ===== Lampu isyarat =====
  'l-merah': { alt: 'Lampu isyarat trafik dengan lampu paling atas (merah) menyala; lampu tengah dan bawah padam.', body: light('red') },
  'l-jingga': { alt: 'Lampu isyarat trafik dengan lampu tengah (jingga) menyala; lampu atas dan bawah padam.', body: light('amber') },
  'l-hijau': { alt: 'Lampu isyarat trafik dengan lampu paling bawah (hijau) menyala; lampu atas dan tengah padam.', body: light('green') },
  'l-anak-panah': { alt: 'Lampu isyarat trafik dengan lampu merah menyala di atas dan satu anak panah hijau menghala ke kanan menyala di bawah.', body: light('arrow') },
};

function subPlate(lines) {
  return `<rect x="22" y="198" width="156" height="76" rx="9" fill="${K}"/><rect x="27" y="203" width="146" height="66" rx="6" fill="${C.white}"/>` +
    lines.map((t, i) => `<text x="100" y="${232 + i * 30}" font-family="Arial Narrow, Arial, sans-serif" font-weight="700" font-size="22" text-anchor="middle" fill="${K}">${t}</text>`).join('');
}
function truck(x, y) {
  return `<rect x="${x - 21}" y="${y - 32}" width="42" height="52" rx="4" fill="${K}"/><rect x="${x - 23}" y="${y + 18}" width="46" height="10" fill="${K}"/>` +
    `<rect x="${x - 21}" y="${y + 26}" width="10" height="9" fill="${K}"/><rect x="${x + 11}" y="${y + 26}" width="10" height="9" fill="${K}"/><rect x="${x - 15}" y="${y + 6}" width="30" height="5" fill="${C.white}"/>`;
}
function road(inner, noCentre = false) {
  return `<rect width="200" height="200" fill="#7DA35A"/><rect x="25" y="0" width="150" height="200" fill="${C.road}"/>` +
    `<rect x="28" y="0" width="4" height="200" fill="${C.white}" opacity="${noCentre ? 1 : 1}"/><rect x="168" y="0" width="4" height="200" fill="${C.white}"/>` + inner;
}
function dashes(x) {
  return [...Array(7)].map((_, i) => `<rect x="${x - 2.5}" y="${i * 30 + 4}" width="5" height="16" fill="${C.white}"/>`).join('');
}
function topCar(x, y, fill, label) {
  return `<rect x="${x - 13}" y="${y - 22}" width="26" height="44" rx="7" fill="${fill}"/><rect x="${x - 10}" y="${y - 14}" width="20" height="10" rx="2" fill="#CFE3F5"/>` +
    `<text x="${x}" y="${y + 16}" font-family="Arial, sans-serif" font-weight="700" font-size="14" text-anchor="middle" fill="${C.white}">${label}</text>`;
}
function light(on) {
  const off = '#3A3F44';
  const top = on === 'red' || on === 'arrow' ? C.red : off;
  const mid = on === 'amber' ? C.amber : off;
  const bot = on === 'green' ? C.green : off;
  let s = `<rect x="80" y="160" width="40" height="40" fill="#5D646B"/><rect x="62" y="12" width="76" height="168" rx="14" fill="#1C2024"/>` +
    `<circle cx="100" cy="46" r="22" fill="${top}"/><circle cx="100" cy="96" r="22" fill="${mid}"/>`;
  if (on === 'arrow') {
    s += `<circle cx="100" cy="146" r="22" fill="${off}"/><path d="M86 146 H106" stroke="${C.green}" stroke-width="7"/><polygon points="116,146 104,136 104,156" fill="${C.green}"/>`;
  } else s += `<circle cx="100" cy="146" r="22" fill="${bot}"/>`;
  return s;
}

const manifest = {};
for (const [id, { alt, body, vb }] of Object.entries(images)) {
  writeFileSync(new URL(`${id}.svg`, OUT), svg(alt, body, vb));
  manifest[id] = { file: `assets/img/${id}.svg`, alt };
}
writeFileSync(new URL('../content/images.json', import.meta.url), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${Object.keys(manifest).length} images`);
