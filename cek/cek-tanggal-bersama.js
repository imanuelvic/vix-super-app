// /rapihin: pemeriksaan "bulan yang sama" & "hari yang sama" yang dulu ditulis
// ulang di enam tempat sekarang jadi satu fungsi di lib/format.ts.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-tanggal-bersama');
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
      R + 'lib/token.ts',
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
      doc: () => {}, setDoc: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  return asli.call(this, req, parent, isMain);
})(Module._load);

const fmt = require(M('format'));
const tok = require(M('token'));

const ts = (d) => ({ toDate: () => d });

console.log('\n== 1. Fungsi bersamanya sendiri ==');

c('bulan & tahun sama → sama',
  fmt.sameMonth(new Date(2026, 7, 3), new Date(2026, 7, 29)) === true);
c('bulan sama tapi TAHUN beda → TIDAK sama (jebakan yang dijaga)',
  fmt.sameMonth(new Date(2025, 7, 15), new Date(2026, 7, 15)) === false);
c('beda bulan → tidak sama',
  fmt.sameMonth(new Date(2026, 6, 31), new Date(2026, 7, 1)) === false);
c('Desember → Januari tahun berikutnya bukan bulan yang sama',
  fmt.sameMonth(new Date(2026, 11, 31), new Date(2027, 0, 1)) === false);

c('hari sama walau jamnya beda → sama',
  fmt.sameDay(new Date(2026, 7, 3, 6, 30), new Date(2026, 7, 3, 23, 59)) === true);
c('beda hari di bulan yang sama → tidak sama',
  fmt.sameDay(new Date(2026, 7, 3), new Date(2026, 7, 4)) === false);
c('tanggal sama tapi bulan beda → tidak sama',
  fmt.sameDay(new Date(2026, 6, 3), new Date(2026, 7, 3)) === false);
c('tanggal sama tapi tahun beda → tidak sama',
  fmt.sameDay(new Date(2025, 7, 3), new Date(2026, 7, 3)) === false);
c('sehari yang sama pasti sebulan yang sama juga', (() => {
  const a = new Date(2026, 4, 9, 1), b = new Date(2026, 4, 9, 22);
  return fmt.sameDay(a, b) && fmt.sameMonth(a, b);
})());

// 2 Sep 2026: bentuk tanggal baru untuk cap waktu Wheel of Life. Empat
// bentuk ini cuma beda SATU bagian — gampang salah ambil, jadi keempatnya
// dipatok berdampingan di sini supaya bedanya kelihatan sekali baca.
console.log('\n== 1b. Senin, 31 Agu 2026 (formatDayDate) ==');
const senin = new Date(2026, 7, 31); // 31 Agustus 2026, hari Senin
c('hari UTUH, bulan 3 huruf, tahun 4 angka',
  fmt.formatDayDate(senin) === 'Senin, 31 Agu 2026', fmt.formatDayDate(senin));
c('bukan formatFullDate (bulannya utuh)',
  fmt.formatFullDate(senin) === 'Senin, 31 Agustus 2026');
c('bukan formatShortDayDate (harinya disingkat)',
  fmt.formatShortDayDate(senin) === 'Sen, 31 Agu 2026');
c('bukan formatGreetingDate (tahunnya 2 angka)',
  fmt.formatGreetingDate(senin) === 'Senin, 31 Agu 26');
// Bulannya dipinjam dari formatShortDate — kalau nanti daftar bulan diubah,
// keduanya ikut berubah bersama, bukan salah satunya saja.
c('menumpang formatShortDate, bukan menyalin daftar bulannya lagi',
  fmt.formatDayDate(senin).endsWith(fmt.formatShortDate(senin)));
c('tanggal 1 digit tidak dipaksa jadi 2 digit',
  fmt.formatDayDate(new Date(2026, 0, 4)) === 'Minggu, 4 Jan 2026',
  fmt.formatDayDate(new Date(2026, 0, 4)));

console.log('\n== 2. Perilaku Token tidak bergeser ==');

const spans = [
  { to: { at: ts(new Date(2026, 7, 2)) } },
  { to: { at: ts(new Date(2026, 7, 28)) } },
  { to: { at: ts(new Date(2026, 6, 30)) } },   // bulan lain
  { to: { at: ts(new Date(2025, 7, 10)) } },   // bulan sama, TAHUN LALU
];
c('spansOfMonth cuma mengambil bulan itu di tahun itu',
  tok.spansOfMonth(spans, 2026, 7).length === 2,
  `${tok.spansOfMonth(spans, 2026, 7).length} dari ${spans.length}`);
c('spansOfMonth tidak ikut menjumlah bulan yang sama tahun lalu',
  tok.spansOfMonth(spans, 2025, 7).length === 1);
c('bulan tanpa isi → daftar kosong', tok.spansOfMonth(spans, 2026, 0).length === 0);

const belian = [
  { date: ts(new Date(2026, 7, 5)), cost: 100 },
  { date: ts(new Date(2026, 7, 21)), cost: 200 },
  { date: ts(new Date(2026, 8, 1)), cost: 400 },
  { date: ts(new Date(2025, 7, 5)), cost: 800 },
];
c('purchasesOfMonth menyaring bulan yang benar',
  tok.purchasesOfMonth(belian, 2026, 7).reduce((s, p) => s + p.cost, 0) === 300);
c('purchasesOfMonth memisahkan tahun',
  tok.purchasesOfMonth(belian, 2025, 7).reduce((s, p) => s + p.cost, 0) === 800);

const kini = new Date(2026, 7, 3, 20, 0);
const catatan = (jam) => ({ at: ts(new Date(2026, 7, 3, jam)) });
c('readingDue: belum dicatat hari ini → masih ditagih',
  tok.readingDue([{ at: ts(new Date(2026, 7, 2, 7)) }], kini) === true);
c('readingDue: baru sekali hari ini → masih ditagih',
  tok.readingDue([catatan(7)], kini) === true);
c('readingDue: sudah dua kali hari ini → beres',
  tok.readingDue([catatan(7), catatan(19)], kini) === false);
c('readingDue: dua catatan tapi HARI KEMARIN → tetap ditagih',
  tok.readingDue([
    { at: ts(new Date(2026, 7, 2, 7)) },
    { at: ts(new Date(2026, 7, 2, 19)) },
  ], kini) === true);
c('readingDue: dua catatan tanggal sama BULAN LALU → tetap ditagih',
  tok.readingDue([
    { at: ts(new Date(2026, 6, 3, 7)) },
    { at: ts(new Date(2026, 6, 3, 19)) },
  ], kini) === true);

console.log('\n== 3. Tak ada lagi yang menulis ulang ==');

const PEMAKAI = [
  'components/car/LogTab.tsx',
  'components/device/DeviceLogTab.tsx',
  'components/device/PlanTab.tsx',
  'components/residence/LogTab.tsx',
  'components/residence/UtilityTab.tsx',
  'lib/token.ts',
  'lib/usage.ts',
];
const masihMentah = PEMAKAI.filter((f) => /getFullYear\(\) ===|getMonth\(\) ===/.test(baca(f)));
c(`${PEMAKAI.length} berkas tak lagi membandingkan tahun/bulan sendiri`,
  masihMentah.length === 0, masihMentah.join(', '));

const takImpor = PEMAKAI.filter((f) => !/from '@?\/?(@\/)?lib\/format'|from '\.\/format'/.test(baca(f)) || !/\bsameMonth\b/.test(baca(f)));
c('semuanya memanggil sameMonth dari lib/format', takImpor.length === 0, takImpor.join(', '));

c('UtilityTab tak lagi punya sameMonth versinya sendiri',
  !/const sameMonth = \(/.test(baca('components/residence/UtilityTab.tsx')));

c('token.ts memakai sameDay untuk "sudah dicatat hari ini"',
  /sameDay\(r\.at\.toDate\(\), now\)/.test(baca('lib/token.ts')));

// Tanggal acuan dibuat sekali, bukan satu Date baru untuk tiap entri daftar.
const tokenSrc = baca('lib/token.ts');
c('tanggal acuan dibuat SEKALI di luar penyaring, bukan tiap entri',
  (tokenSrc.match(/const acuan = new Date\(year, month, 1\);/g) || []).length === 2 &&
  !/filter\(\([^)]*\) => sameMonth\([^)]*new Date\(/.test(tokenSrc));

console.log('\n== 4. Dead code ==');

const habits = baca('components/habits/HabitsTab.tsx');
c('keptCount yang tak terpakai sudah dibuang', !/keptCount/.test(habits));
c('tapi kolom `kept` sendiri MASIH dipakai (bukan ikut dibuang)',
  /a\.kept/.test(habits) && /kept: boolean/.test(baca('lib/habits.ts')));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);