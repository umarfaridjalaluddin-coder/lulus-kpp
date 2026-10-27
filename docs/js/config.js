// Exam format configuration. Single versioned source of truth.
// To update the format, change values here, bump `version`, and record the
// new source + verification date. Completed attempts store a copy of the
// config they used, so changes never alter historical results.
export const EXAM_CONFIG = Object.freeze({
  version: '2025-10-gabungan-1',
  name: 'Simulasi KPP Gabungan',
  questionCount: 70,
  durationMinutes: 75,
  passMark: 56,
  vehicleScope: ['motokar', 'motosikal'],
  source: {
    title: 'FAQ KPP Gabungan (JPJ)',
    url: 'https://www.jpj.gov.my/wp-content/uploads/2025/10/FAQ-KPP-GABUNGAN-NEW.pdf',
    effectiveDate: '2025-08-29',
    verifiedOn: '2026-10-24',
    recheckedOn: '2026-10-27',
    notes: '70 soalan, 1 jam 15 minit, lulus 56/70. Semua kelas lesen kecuali kelas E. Format lama (50 soalan, 45 minit, 42/50) tidak lagi digunakan untuk ujian gabungan. Semakan semula 27 Okt 2026: tiada format baharu ditemui.',
  },
  // The app's own practice distribution. JPJ has not published topic quotas,
  // question order or section pass rules; this is NOT an official quota.
  practiceDistribution: Object.freeze({ 1: 28, 2: 5, 3: 13, 4: 9, 5: 8, 6: 7 }),
  // Avoid repeating questions used in this many most recent exams, where the bank allows.
  recentAttemptsToAvoid: 2,
});

export const CHAPTERS = Object.freeze({
  1: 'Lesen Memandu Malaysia',
  2: 'Kod Etika dan Tatakelakuan Pemandu',
  3: 'Teori Pemanduan Berhemah',
  4: 'Pemanduan dalam Pelbagai Keadaan',
  5: 'Komponen yang Perlu Diselenggara',
  6: 'Peralatan Keselamatan dan Bantuan Kecemasan',
});

export const VEHICLES = Object.freeze({
  bersama: 'Kereta & motosikal',
  motokar: 'Kereta',
  motosikal: 'Motosikal',
});

export const TOPICS = Object.freeze({
  lesen: 'Lesen memandu',
  isyarat: 'Tanda isyarat jalan raya',
  garisan: 'Garisan jalan & lampu isyarat',
  hazard: 'Hazard & pemanduan defensif',
  kejara: 'Sistem KEJARA',
  etika: 'Etika pemandu',
  berhemah: 'Pemanduan berhemah',
  keadaan: 'Pemanduan pelbagai keadaan',
  senggara: 'Penyelenggaraan kenderaan',
  keselamatan: 'Peralatan keselamatan',
  kecemasan: 'Kecemasan & bantuan',
});
