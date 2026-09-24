// Dua permintaan:
//   1. Fun & Recreation mendarat di sub-tab Creators
//   2. Bible Reading membuka tab sesuai JAM saat dibuka (pagi 1, siang 12,
//      malam 21) — bukan selalu Pagi
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-tab-bawaan');
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
      R + 'lib/spiritual.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

// Satu berkas akar saja → tsc menaruh hasilnya RATA (tanpa folder lib/).
const M = (rel) => {
  for (const k of [rel, path.basename(rel)]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi ${rel}`);
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
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const sp = require(M('lib/spiritual.js'));

console.log('\n== 1. Fun & Recreation mendarat di Creators ==');

const fun = baca('app/fun.tsx');
c('sub-tab pembukanya Creators',
  /useTabScroll<FunTab>\('creators', \{/.test(fun));
c('bukan Summit lagi', !/useTabScroll<FunTab>\('summit'/.test(fun));
c('ketiga sub-tabnya tetap ada & urutannya tidak digeser',
  /key: 'summit'[\s\S]*key: 'creators'[\s\S]*key: 'recreation'/.test(fun));
c('Creators tetap bisa ditinggalkan (Summit & Recreation masih di daftar)',
  /\{ key: 'summit', label: 'Summit'/.test(fun) &&
  /\{ key: 'recreation', label: 'Recreation'/.test(fun));

console.log('\n== 2. Bible Reading membuka tab sesuai jam ==');

c('garis jamnya 1 · 12 · 21',
  JSON.stringify(sp.BIBLE_TAB_HOURS) ===
    JSON.stringify([
      { key: 'morning', fromHour: 1 },
      { key: 'daytime', fromHour: 12 },
      { key: 'night', fromHour: 21 },
    ]),
  JSON.stringify(sp.BIBLE_TAB_HOURS));

const jam = (h) => sp.bibleSessionOfClock(new Date(2026, 7, 31, h, 30));
const harusnya = [
  [0, 'night'], // tengah malam = ekor hari kemarin
  [1, 'morning'],
  [5, 'morning'],
  [9, 'morning'],
  [11, 'morning'], // dulu di sini pun Pagi — kebetulan benar
  [12, 'daytime'],
  [15, 'daytime'],
  [17, 'daytime'], // DULU jatuh ke Pagi, ini yang diperbaiki
  [20, 'daytime'],
  [21, 'night'],
  [23, 'night'],
];
const meleset = harusnya
  .filter(([h, s]) => jam(h) !== s)
  .map(([h, s]) => `jam ${h} harusnya ${s}, dapat ${jam(h)}`);
c('tiap jam membuka sesi yang benar', meleset.length === 0, meleset.join(' · '));

const kosong = [];
for (let h = 0; h < 24; h++) {
  if (!['morning', 'daytime', 'night'].includes(jam(h))) kosong.push(h);
}
c('SELALU ada jawabannya, jam berapa pun (24 dari 24)', kosong.length === 0, kosong.join(', '));

// Inti perbaikannya: di antara jendela baca, dulu tidak ada sesi yang berjalan.
c('jam-jam "sela" dulu tak punya sesi berjalan sama sekali',
  sp.bibleSessionNow(new Date(2026, 7, 31, 17, 0)) === null &&
  sp.bibleSessionNow(new Date(2026, 7, 31, 11, 0)) === null &&
  sp.bibleSessionNow(new Date(2026, 7, 31, 20, 0)) === null);
c('jam 17.00 sekarang membuka Siang, bukan Pagi', jam(17) === 'daytime');

console.log('\n== 3. Jendela BACA-nya sendiri tidak ikut digeser ==');

// Dua angka yang gampang tertukar: jendela "terhitung tepat waktu" (kartu di
// Home & streak) vs garis pemilih tab. Yang berubah cuma yang kedua.
const meta = (k) => sp.BIBLE_SESSIONS.find((s) => s.key === k);
c('pagi tetap 5–10', meta('morning').fromHour === 5 && meta('morning').toHour === 10);
c('siang tetap 12–15', meta('daytime').fromHour === 12 && meta('daytime').toHour === 15);
c('malam tetap 21–24', meta('night').fromHour === 21 && meta('night').toHour === 24);
c('bibleSessionNow masih mengembalikan null di luar jendela — pemakai lain (kartu Home, tombol 🔥) bergantung padanya',
  sp.bibleSessionNow(new Date(2026, 7, 31, 6, 0)) === 'morning' &&
  sp.bibleSessionNow(new Date(2026, 7, 31, 16, 0)) === null);

console.log('\n== 4. Terpasang di layarnya ==');

const tab = baca('components/spiritual/BibleReadingTab.tsx');
c('tab arsip memakai pemilih berdasarkan jam', /bibleSessionOfClock\(new Date\(\)\)/.test(tab));
c('tidak lagi jatuh ke Pagi', !/bibleSessionNow\(new Date\(\)\) \?\? 'morning'/.test(tab));
c('sesi yang DITUJU tetap menang (sesudah "✅ Sudah baca")',
  /openSession \?\? bibleSessionOfClock\(new Date\(\)\)/.test(tab));
c('tabnya dihitung ulang tiap sub-tab ditekan (konten re-mount lewat scrollKey)',
  /key=\{scrollKey\}/.test(baca('app/(tabs)/walk.tsx')));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);