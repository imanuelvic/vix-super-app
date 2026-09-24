// /rapihin: pembentuk id tanggal ("2026-07-24") & kunci bulan ("2026-07") yang
// dulu ditulis ulang di enam tempat sekarang jadi satu, plus kartu berita yang
// digambar dua kali jadi satu komponen.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-id-kunci');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/format.ts',
      R + 'lib/health.ts',
      R + 'lib/core.ts',
      R + 'lib/multiplication.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
      collection: () => {}, deleteDoc: () => {}, doc: () => {}, getDocs: () => {},
      limit: () => {}, onSnapshot: () => {}, orderBy: () => {}, query: () => {},
      setDoc: () => {}, where: () => {}, addDoc: () => {}, updateDoc: () => {},
      writeBatch: () => {}, increment: () => {}, getDoc: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const fmt = require(M('format'));
const health = require(M('health'));
const core = require(M('core'));
const multi = require(M('multiplication'));

console.log('\n== 1. Bentuknya benar & selalu berdigit dua ==');

c('id harian', fmt.dayId(new Date(2026, 6, 24)) === '2026-07-24', fmt.dayId(new Date(2026, 6, 24)));
c('bulan & tanggal satu digit tetap diberi nol di depan',
  fmt.dayId(new Date(2026, 0, 4)) === '2026-01-04', fmt.dayId(new Date(2026, 0, 4)));
c('jam & menit tidak ikut mengubah tanggalnya',
  fmt.dayId(new Date(2026, 6, 24, 23, 59)) === '2026-07-24');
c('kunci bulan', fmt.monthId(2026, 6) === '2026-07', fmt.monthId(2026, 6));
c('Januari jadi "01", bukan "1"', fmt.monthId(2026, 0) === '2026-01');
c('Desember jadi "12"', fmt.monthId(2026, 11) === '2026-12');
c('kunci bulan dari sebuah tanggal', fmt.monthIdOf(new Date(2026, 0, 31)) === '2026-01');

// Inilah alasan bentuknya HARUS satu: id ini jadi nama dokumen Firestore.
// "2026-7-4" tak akan pernah bertemu "2026-07-04" — datanya masih ada tapi
// tak terbaca lagi.
c('id harian selalu 10 huruf, kunci bulan selalu 7', (() => {
  for (let m = 0; m < 12; m++) {
    for (const d of [1, 9, 10, 28]) {
      if (fmt.dayId(new Date(2026, m, d)).length !== 10) return false;
      if (fmt.monthId(2026, m).length !== 7) return false;
    }
  }
  return true;
})());

// Waktu LOKAL, bukan UTC: toISOString() menggeser tanggal untuk WIB.
c('memakai waktu lokal, bukan UTC',
  fmt.dayId(new Date(2026, 6, 24, 0, 30)) === '2026-07-24' &&
  fmt.dayId(new Date(2026, 6, 24, 0, 30)) !==
    new Date(2026, 6, 24, 0, 30).toISOString().slice(0, 10) === false ||
  fmt.dayId(new Date(2026, 6, 24, 6, 0)) === '2026-07-24');

console.log('\n== 2. Keenam salinannya sudah menumpang yang sama ==');

c('dayDocId (lib/health) memberi hasil yang sama persis',
  health.dayDocId(new Date(2026, 6, 24)) === fmt.dayId(new Date(2026, 6, 24)) &&
  health.dayDocId(new Date(2026, 0, 4)) === '2026-01-04');
c('monthDocId (lib/core) sama',
  core.monthDocId(new Date(2026, 7, 15)) === fmt.monthIdOf(new Date(2026, 7, 15)) &&
  core.monthDocId(new Date(2026, 7, 15)) === '2026-08');
// insuranceMonthKey dulu ikut diuji di sini. Tab Insurance sudah dihapus
// permanen (lihat cek-timeline-career.js), jadi yang diperiksa sekarang justru
// KEBALIKANNYA: lib/career tak boleh menyisakan apa pun soal agent asuransi.
c('lib/career bersih dari insurance (tab-nya dihapus permanen)',
  !/insurance|Insurance|asuransi/i.test(baca('lib/career.ts')));
c('stepMonthKey (lib/multiplication) sama',
  multi.stepMonthKey({ date: { toDate: () => new Date(2026, 4, 9) } }) === '2026-05');

// Yang diperiksa: tak ada lagi yang MERANGKAI sendiri "YYYY-MM" / "YYYY-MM-DD".
const PEMAKAI = [
  'lib/health.ts',
  'lib/healthkit.ts',
  'lib/budgets.ts',
  'lib/career.ts',
  'lib/core.ts',
  'lib/multiplication.ts',
];
const masihRakit = PEMAKAI.filter((f) =>
  /padStart\(2, '0'\)/.test(baca(f).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')),
);
c(`${PEMAKAI.length} berkas tak lagi merangkai idnya sendiri`,
  masihRakit.length === 0, masihRakit.join(', '));

// Bentuk `-${String(x + 1).padStart(2, '0')}` itu ciri khas perakit id
// bulan/tanggal — beda dari padStart untuk jam & menit yang memang wajar ada
// di banyak formatter.
const rakitId = /-\$\{String\([^)]*\+ 1\)\.padStart\(2, '0'\)\}/;
const perakit = fs
  .readdirSync(R + 'lib')
  .filter((n) => n.endsWith('.ts') && rakitId.test(baca('lib/' + n)));
c('cuma lib/format yang menyimpan cara merangkainya',
  perakit.length === 1 && perakit[0] === 'format.ts', perakit.join(', '));

c('nama lamanya dipertahankan (layar & data tak perlu ikut diubah)',
  /export function dayDocId/.test(baca('lib/health.ts')) &&
  /export function monthDocId/.test(baca('lib/core.ts')) &&
  /export function stepMonthKey/.test(baca('lib/multiplication.ts')));

c('budgets memakai helper bersamanya langsung (pembungkusnya dibuang)',
  /monthId\(year, month\)/.test(baca('lib/budgets.ts')) &&
  !/function monthDocId/.test(baca('lib/budgets.ts')));
c('healthkit tak lagi punya localDayId sendiri',
  !/localDayId/.test(baca('lib/healthkit.ts')));
c('healthkit tidak jadi ikut menyeret firebase (format tak punya dependency)',
  !/firebase/.test(baca('lib/healthkit.ts')) &&
  !/^import/m.test(baca('lib/format.ts')));

console.log('\n== 3. Kartu berita cuma digambar sekali ==');

const kartu = baca('components/news/NewsCard.tsx');
const tab = baca('components/news/NewsTab.tsx');
const simpan = baca('app/news-saved.tsx');

c('komponen bersamanya ada', fs.existsSync(R + 'components/news/NewsCard.tsx'));
c('kedua daftar memakainya',
  /<NewsCard/.test(tab) && /<NewsCard/.test(simpan));
c('bentuk kartunya tak lagi ditulis di kedua layar',
  !/styles\.card\b/.test(tab) && !/styles\.card\b/.test(simpan) &&
  !/markButton/.test(tab) && !/markButton/.test(simpan));
// `styles.` di depannya penting: news-saved masih memakai KOLOM DATA bernama
// savedAt, dan itu bukan gaya yang menganggur.
const gayaMati = /styles\.(cardMain|metaRow|savedAt|cardTitle|source)\b/;
c('gaya yang jadi nganggur ikut dibuang',
  !gayaMati.test(tab) && !gayaMati.test(simpan));
c('tombolnya tetap BERSAUDARA dengan area click, bukan bertumpuk',
  /<\/PressableScale>\s*<PressableScale style=\{styles\.mark\}/.test(kartu));
c('lambangnya terisi kalau sudah tersimpan',
  /name=\{saved \? 'bookmark\.fill' : 'bookmark'\}/.test(kartu));
c('baris "kapan disimpan" jadi prop, cuma dipakai daftar tersimpan',
  /footer\?: string;/.test(kartu) &&
  /footer=\{`🔖 disimpan/.test(simpan) && !/footer=/.test(tab));
c('daftar tersimpan lambangnya selalu terisi', /\n\s+saved\n/.test(simpan));
c('umur berita dihitung di satu tempat',
  /newsAge\(publishedAt, now\)/.test(kartu) &&
  !/newsAge/.test(tab) && !/newsAge/.test(simpan));

console.log('\n== 4. Dead code sisa editan pemilik ==');

const ht = baca('components/habits/HabitsTab.tsx');
const disc = baca('components/learning/DiscussionTab.tsx');
c('keptCount sudah dibuang', !/keptCount/.test(ht));
c('kolom `kept` sendiri MASIH dipakai (bukan ikut dibuang)', /a\.kept/.test(ht));
c('sisa kartu "bahan utama" di Discussion bersih',
  !/skillAreaMeta|skillOf\(|skillOfWeek/.test(disc) && !/mainTopic/.test(disc));
c('prop `week` yang tak lagi dipakai ikut dilepas',
  !/week: LearningWeek/.test(disc) &&
  /<DiscussionTab topicsDone=\{topicsDone\} now=\{now\} \/>/.test(baca('app/learning.tsx')));
c('tapi skillOf & skillOfWeek TIDAK ikut dihapus dari lib (masih dipakai layar lain)',
  /export function skillOf/.test(baca('lib/learning.ts')) &&
  /skillOfWeek/.test(baca('components/learning/WeekTab.tsx')));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);