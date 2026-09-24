// Arsip Rangkuman (14 Sep 2026): tanggal Senin → "Minggu ke-N (rentang)".
// Angkanya harus ISO 8601 (sama dengan kalender HP), rentangnya Senin s.d.
// Minggu, dan bentuknya menyesuaikan kalau menyeberang bulan / tahun.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = AKAR + '/';
const KELUAR = path.join(__dirname, 'keluar-minggu-ke');

let gagal = 0;
function c(nama, ok) {
  console.log((ok ? '  ok  ' : '  GAGAL') + ' ' + nama);
  if (!ok) gagal++;
}
const baca = (f) => fs.readFileSync(ROOT + f, 'utf8');

// --- jalankan lib/format.ts sungguhan ---
execFileSync(
  'node',
  [
    ROOT + 'node_modules/typescript/bin/tsc',
    '--ignoreConfig',
    '--outDir', KELUAR,
    '--module', 'commonjs',
    '--target', 'es2020',
    '--skipLibCheck',
    ROOT + 'lib/format.ts',
  ],
  { stdio: 'ignore' },
);
const fmt = require(path.join(KELUAR, 'format.js'));
const tgl = (y, m, d) => new Date(y, m - 1, d);

console.log('nomor minggu ISO');
c('7 Sep 2026 = minggu ke-37 tahun 2026',
  fmt.isoWeekOfMonday(tgl(2026, 9, 7)).week === 37 &&
    fmt.isoWeekOfMonday(tgl(2026, 9, 7)).year === 2026);
c('29 Des 2025 = minggu ke-1 tahun 2026 (Kamisnya sudah 1 Jan)',
  fmt.isoWeekOfMonday(tgl(2025, 12, 29)).week === 1 &&
    fmt.isoWeekOfMonday(tgl(2025, 12, 29)).year === 2026);
c('28 Des 2026 = minggu ke-53 tahun 2026 (Kamisnya masih 31 Des)',
  fmt.isoWeekOfMonday(tgl(2026, 12, 28)).week === 53 &&
    fmt.isoWeekOfMonday(tgl(2026, 12, 28)).year === 2026);
c('4 Jan 2027 = minggu ke-1 tahun 2027',
  fmt.isoWeekOfMonday(tgl(2027, 1, 4)).week === 1);
c('1 Jan 2024 (Senin persis) = minggu ke-1',
  fmt.isoWeekOfMonday(tgl(2024, 1, 1)).week === 1);
c('30 Des 2024 = minggu ke-1 tahun 2025',
  fmt.isoWeekOfMonday(tgl(2024, 12, 30)).week === 1 &&
    fmt.isoWeekOfMonday(tgl(2024, 12, 30)).year === 2025);

console.log('rentang tanggal');
c('sebulan: "7-13 Sep 2026"', fmt.formatWeekRange(tgl(2026, 9, 7)) === '7-13 Sep 2026');
c('menyeberang bulan: "28 Sep - 4 Okt 2026"',
  fmt.formatWeekRange(tgl(2026, 9, 28)) === '28 Sep - 4 Okt 2026');
c('menyeberang tahun: "29 Des 2025 - 4 Jan 2026"',
  fmt.formatWeekRange(tgl(2025, 12, 29)) === '29 Des 2025 - 4 Jan 2026');
c('label utuh: "Minggu ke-37 (7-13 Sep 2026)"',
  fmt.formatWeekLabel(tgl(2026, 9, 7)) === 'Minggu ke-37 (7-13 Sep 2026)');
c('tidak ada "—" di label', !/—/.test(fmt.formatWeekLabel(tgl(2026, 9, 28))));

console.log('halaman arsip');
const arsip = baca('app/learning-archive.tsx');
c('tanggal kartunya pakai label minggu dari Senin (weekId)',
  /📅 \{formatWeekLabel\(dayIdToDate\(n\.weekId\)\)\}/.test(arsip));
c('formatShortDayDate tidak lagi diimpor di sana', !/formatShortDayDate/.test(arsip));

console.log(gagal === 0 ? 'CEK-MINGGU-KE OK' : gagal + ' gagal');
process.exit(gagal === 0 ? 0 : 1);
