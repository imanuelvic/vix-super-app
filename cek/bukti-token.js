// Uji NYATA hitungan Token listrik ⚡ & perapian tautan Notes Fitness 🔗 —
// fungsinya benar-benar DIJALANKAN, bukan dicocokkan teksnya.
//
// 24 Sep 2026: bagian "Rhema Story" DIBUANG dari sini. Modul yang diujinya,
// lib/rhemaStory.ts, sudah tidak ada: ia dibongkar jadi lib/bibleStory.ts
// (tata letak & nama berkas) + lib/shareImage.ts (pemenggalan baris), dan
// keduanya sudah diuji SUNGGUHAN oleh cek-story.js dengan modul terkompilasi
// yang nyata. Jadi ini bukan cakupan yang hilang, cuma pindah rumah.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-token');

// Dikompilasi sendiri tiap kali dijalankan, jadi tidak ada folder build
// yang harus disiapkan tangan dan tidak mungkin membaca hasil BASI.
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/token.ts'), path.join(ROOT, 'lib/fitNotes.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// tsc kadang menaruh hasilnya langsung di OUT, kadang di OUT/lib —
// tergantung akar bersama berkas yang diminta. Terima keduanya.
const BUILD = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;

class FakeTimestamp {
  constructor(ms) { this.ms = ms; }
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
  static now() { return new FakeTimestamp(Date.now()); }
  static fromDate(d) { return new FakeTimestamp(d.getTime()); }
}

// Stub modul yang butuh perangkat/jaringan — yang diuji fungsi MURNI-nya.
const asli = Module._load;
Module._load = function (req) {
  if (req === 'firebase/firestore') {
    return { Timestamp: FakeTimestamp, doc: () => ({}), setDoc: async () => {},
      collection: () => ({}), onSnapshot: () => () => {}, orderBy: () => ({}),
      query: () => ({}), limit: () => ({}), deleteDoc: async () => {},
      writeBatch: () => ({ set: () => {}, commit: async () => {} }),
      increment: (n) => n, deleteField: () => undefined, getDoc: async () => ({}) };
  }
  if (req === 'expo-file-system') return { File: class {}, Paths: { cache: '' } };
  if (req === 'expo-sharing') return { isAvailableAsync: async () => false, shareAsync: async () => {} };
  if (req === 'expo-image-picker' || req === 'expo-image-manipulator') return {};
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  return asli.apply(this, arguments);
};

const token = require(path.join(BUILD, 'token.js'));
const notes = require(path.join(BUILD, 'fitNotes.js'));

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}
const sama = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ===================== Token listrik =====================
console.log('\nToken listrik — angka dari spreadsheet aslimu');

// Baris nyata spreadsheet (30 Nov – 1 Des 2025):
//   pulang 30/11 22:20 sisa 118,60 → berangkat 1/12 07:50 sisa 108,37
//   pulang  1/12 23:50 sisa  96,54
// Harapan: di rumah 9,5 jam / 10,23 kWh ; ditinggal 16,0 jam / 11,83 kWh
const T = (y, m, d, h, mi) => new FakeTimestamp(new Date(y, m, d, h, mi).getTime());
const R = (id, at, kwh, kind) => ({ id, at, kwh, kind, note: '' });

const readings = [
  R('r1', T(2025, 10, 30, 22, 20), 118.60, 'home'),
  R('r2', T(2025, 11, 1, 7, 50), 108.37, 'out'),
  R('r3', T(2025, 11, 1, 23, 50), 96.54, 'home'),
  R('r4', T(2025, 11, 2, 7, 40), 87.99, 'out'),
];
const spans = token.usageSpans(readings);
ok('3 catatan berurutan → 3 selang waktu', spans.length === 3, String(spans.length));

const s1 = spans[0];
ok('selang 1 = DI RUMAH, 9,5 jam, 10,23 kWh',
  s1.atHome === true && Math.abs(s1.hours - 9.5) < 0.01 &&
  Math.abs(s1.kwh - 10.23) < 0.005,
  JSON.stringify({ atHome: s1.atHome, hours: s1.hours, kwh: s1.kwh }));

const s2 = spans[1];
ok('selang 2 = DITINGGAL, 16,0 jam, 11,83 kWh',
  s2.atHome === false && Math.abs(s2.hours - 16) < 0.01 &&
  Math.abs(s2.kwh - 11.83) < 0.005,
  JSON.stringify({ atHome: s2.atHome, hours: s2.hours, kwh: s2.kwh }));

ok('kWh per jam ikut benar (10,23 ÷ 9,5 = 1,077)',
  Math.abs(s1.perHour - 1.077) < 0.001, String(s1.perHour));

console.log('\n  Pemakaian dipisah: saat di rumah vs saat ditinggal');
const ring = token.summarize(spans);
ok('totalnya = jumlah ketiga selang',
  Math.abs(ring.kwh - (s1.kwh + s2.kwh + spans[2].kwh)) < 0.001);
ok('pecahannya menjumlah balik ke total',
  Math.abs(ring.homeKwh + ring.awayKwh - ring.kwh) < 0.001,
  `${ring.homeKwh} + ${ring.awayKwh}`);
ok('rata-rata harian dihitung dari JAM, bukan jumlah catatan',
  Math.abs(ring.perDay - (ring.kwh / ring.hours) * 24) < 0.001);

console.log('\n  Isi token di tengah TIDAK dianggap pemakaian minus');
// Ini yang merusak spreadsheet-mu: begitu token diisi, angka meteran NAIK dan
// selisihnya jadi minus — lalu semua rata-rata ikut ngawur (#DIV/0!, -862 kWh).
const denganIsi = [
  R('a', T(2026, 0, 1, 22, 0), 20, 'home'),
  R('b', T(2026, 0, 2, 8, 0), 10, 'out'),
  R('c', T(2026, 0, 2, 20, 0), 300, 'home'), // token diisi → meteran melonjak
  R('d', T(2026, 0, 3, 8, 0), 290, 'out'),
];
const spanIsi = token.usageSpans(denganIsi);
ok('selang yang meterannya NAIK dibuang, bukan jadi angka minus',
  spanIsi.length === 2 && spanIsi.every((s) => s.kwh >= 0),
  JSON.stringify(spanIsi.map((s) => s.kwh)));
ok('sisanya tetap terhitung benar (10 + 10 kWh)',
  Math.abs(token.summarize(spanIsi).kwh - 20) < 0.001);

console.log('\n  Rupiah & perkiraan habis');
const beli = [
  { id: 'p1', date: T(2025, 10, 30, 8, 0), cost: 200300, kwh: 114.96, platform: 'GoPay', note: '' },
];
ok('harga per kWh = Rp1.742 (200.300 ÷ 114,96)',
  Math.round(token.currentRate(beli)) === 1742,
  String(token.currentRate(beli)));
ok('pembelian bulan lain tidak ikut terhitung',
  token.purchasesOfMonth(beli, 2025, 10).length === 1 &&
  token.purchasesOfMonth(beli, 2025, 11).length === 0);

// Sisa 87,99 kWh dengan rata-rata pemakaian harian dari data di atas.
const hari = token.daysLeft(readings, ring.perDay);
ok('perkiraan sisa hari masuk akal (87,99 kWh ÷ pemakaian harian)',
  hari !== null && Math.abs(hari - 87.99 / ring.perDay) < 0.001,
  String(hari));
ok('belum ada data → tidak menebak sembarangan',
  token.daysLeft([], 5) === null && token.daysLeft(readings, 0) === null);

console.log('\n  Penagih catatan harian');
const kini = new Date(2026, 7, 23, 20, 0);
ok('belum dicatat hari ini → ditagih',
  token.readingDue([], kini) === true);
ok('baru sekali hari ini (pagi saja) → masih ditagih',
  token.readingDue([R('x', new FakeTimestamp(new Date(2026, 7, 23, 8, 0).getTime()), 50, 'out')], kini) === true);
ok('sudah dua kali hari ini → berhenti menagih',
  token.readingDue([
    R('x', new FakeTimestamp(new Date(2026, 7, 23, 8, 0).getTime()), 50, 'out'),
    R('y', new FakeTimestamp(new Date(2026, 7, 23, 19, 0).getTime()), 45, 'home'),
  ], kini) === false);
ok('catatan KEMARIN tidak ikut menghentikan tagihan hari ini',
  token.readingDue([
    R('x', new FakeTimestamp(new Date(2026, 7, 22, 8, 0).getTime()), 50, 'out'),
    R('y', new FakeTimestamp(new Date(2026, 7, 22, 19, 0).getTime()), 45, 'home'),
  ], kini) === true);

console.log('\n  Nilai ekstrem tidak bikin NaN');
ok('tanpa catatan sama sekali aman',
  token.usageSpans([]).length === 0 && token.summarize([]).perDay === 0);
ok('dua catatan berjam SAMA dibuang (tidak bagi nol)',
  token.usageSpans([
    R('a', T(2026, 0, 1, 8, 0), 20, 'home'),
    R('b', T(2026, 0, 1, 8, 0), 20, 'out'),
  ]).length === 0);
ok('urutan acak tetap dihitung benar (diurut dulu)',
  token.usageSpans([readings[1], readings[0]]).length === 1);

// ===================== Notes Fitness =====================
console.log('\nNotes Fitness — merapikan tautan');
const url = [
  ['youtube.com/watch?v=abc', 'https://youtube.com/watch?v=abc'],
  ['https://youtu.be/abc', 'https://youtu.be/abc'],
  ['  youtu.be/abc  ', 'https://youtu.be/abc'],
  ['mailto:a@b.com', 'mailto:a@b.com'],
  ['', ''],
];
for (const [masuk, harap] of url) {
  ok(`"${masuk.trim() || '(kosong)'}" → ${harap || '(kosong)'}`,
    notes.tidyUrl(masuk) === harap, notes.tidyUrl(masuk));
}
ok('nama situs dipendekkan & "www." dibuang',
  notes.urlHost('https://www.youtube.com/watch?v=x') === 'youtube.com' &&
  notes.urlHost('youtu.be/abc') === 'youtu.be' &&
  notes.urlHost('') === '');

console.log(gagal === 0
  ? '\n✅ LULUS — hitungan Token & perapian tautan Notes terbukti benar.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
