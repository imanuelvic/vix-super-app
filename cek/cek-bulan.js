// Cek laporan pemakaian bulanan: judulnya menyebut bulan, rentangnya benar,
// mingguan tetap ada, dan retensinya ikut jadi bulanan.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

// ===== Jalankan logika aslinya (disalin persis dari lib/usage.ts & format.ts)
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const dayDocId = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthLabel = (d) => MONTH_NAMES[d.getMonth()];
const monthStart = (now) => new Date(now.getFullYear(), now.getMonth(), 1);
function monthDayIds(now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ids = [];
  for (const d = monthStart(now); d <= today; d.setDate(d.getDate() + 1)) {
    ids.push(dayDocId(d));
  }
  return ids;
}
const formatMonthRange = (now) => `1–${now.getDate()} ${MONTH_NAMES[now.getMonth()]}`;
function weekStart(now) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function weekDayIds(now) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ids = [];
  for (const d = new Date(weekStart(now)); d <= today; d.setDate(d.getDate() + 1)) {
    ids.push(dayDocId(d));
  }
  return ids;
}

console.log('\nJudul menyebut bulan apa');
for (const [tgl, bulan] of [
  [new Date(2026, 7, 21), 'Agustus'],
  [new Date(2026, 0, 1), 'Januari'],
  [new Date(2026, 11, 31), 'Desember'],
  [new Date(2027, 1, 28), 'Februari'],
]) ok(`${dayDocId(tgl)} → "Pemakaian bulan ${bulan}"`, monthLabel(tgl) === bulan);

console.log('\nRentang & deret hari bulan berjalan');
const h21 = new Date(2026, 7, 21);
ok('rentangnya 1–21 Agustus (bukan 1–31, karena belum lewat)',
  formatMonthRange(h21) === '1–21 Agustus');
const ids = monthDayIds(h21);
ok('21 hari terhitung (tgl 1 s/d hari ini)', ids.length === 21, `dapat ${ids.length}`);
ok('mulai 2026-08-01', ids[0] === '2026-08-01', ids[0]);
ok('berhenti hari ini, tidak menebak masa depan',
  ids[ids.length - 1] === '2026-08-21', ids[ids.length - 1]);
// Paling banyak 31 dokumen — ini batas biaya bacanya.
let maks = 0;
for (let b = 0; b < 12; b++) {
  const akhir = new Date(2026, b + 1, 0); // hari terakhir bulan b
  maks = Math.max(maks, monthDayIds(akhir).length);
}
ok(`paling banyak ${maks} dokumen sekali baca (batas biaya)`, maks === 31, `dapat ${maks}`);
ok('Februari tahun kabisat tetap benar (29 hari)',
  monthDayIds(new Date(2028, 1, 29)).length === 29);

console.log('\nMingguan disaring dari deret yang SAMA (tanpa baca tambahan)');
// Minggu 17–23 Agu 2026: Senin 17. Hari ini 21 → Sen..Jum = 5 hari.
const wIds = weekDayIds(h21);
const minggu = ids.filter((id) => wIds.includes(id));
ok('minggu ini = 17–21 Agustus (5 hari)', minggu.length === 5, `dapat ${minggu.length}`);
ok('mulai Senin 2026-08-17', minggu[0] === '2026-08-17', minggu[0]);
ok('semua hari minggu ini memang ada di deret bulan',
  wIds.every((id) => ids.includes(id)));
// Kasus rawan: awal bulan yang jatuh di TENGAH minggu.
// 1 Sep 2026 = Selasa → Senin-nya 31 Agustus, di luar deret bulan September.
const sep1 = new Date(2026, 8, 1);
const idsSep = monthDayIds(sep1);
const wSep = weekDayIds(sep1);
const mingguSep = idsSep.filter((id) => wSep.includes(id));
ok('1 September (Selasa): deret bulan cuma 1 hari', idsSep.length === 1);
ok('minggu ini ikut terpotong, tidak error & tidak dobel',
  mingguSep.length === 1 && mingguSep[0] === '2026-09-01',
  JSON.stringify(mingguSep));
ok('sisa minggu (31 Agu) memang tidak ikut — datanya sudah dihapus reset bulanan',
  wSep.includes('2026-08-31') && !mingguSep.includes('2026-08-31'));

// ===== Kode sungguhan =====
console.log('\nKode');
const usage = baca('lib/usage.ts');
const ver = baca('app/system.tsx');
const util = baca('components/residence/UtilityTab.tsx');
const fmt = baca('lib/format.ts');

ok('monthLabel ada di lib/format.ts (satu tempat, dipakai bersama)',
  /export function monthLabel/.test(fmt));
ok('tidak ada salinan monthLabel di lib/usage.ts', !/function monthLabel/.test(usage));
// Judulnya dipendekkan ("Pemakaian bulan Agustus" → "Bulan Agustus") sejak
// kedua kartu ditaruh sebelahan — di setengah lebar, judul panjang melipat
// jadi dua baris. Nama bulannya tetap disebut, itu yang penting.
ok('System: judulnya menyebut bulan berjalan',
  /📊 Bulan \{thisMonth\}/.test(ver));
ok('Air-Listrik: judulnya ikut menyebut bulan',
  /Pemakaian bulan \{monthLabel\(now\)\}/.test(util));
// Perbandingannya sendiri sekarang di lib/format (sameMonth) — dulu ditulis
// inline di sini. Yang dijaga tetap sama: yang dijumlah cuma bulan BERJALAN.
ok('Air-Listrik memang cuma menjumlah bulan berjalan (sameMonth)',
  /sameMonth\(d, now\)/.test(util) &&
  /from '@\/lib\/format'/.test(util));

ok('retensi ikut bulanan: batas hapus = tanggal 1',
  /const boundary = dayDocId\(monthStart\(now\)\)/.test(usage));
ok('hapusnya tetap PERMANEN (batch delete, bukan ditandai)',
  /batch\.delete\(d\.ref\)/.test(usage) && !/isDeleted|archived/.test(usage));
ok('resetPastWeeks lama sudah tidak ada', !/resetPastWeeks/.test(usage + ver));

ok('cuma SATU kali ambil data (deret bulan), minggu tinggal disaring',
  (ver.match(/fetchUsageDays\(/g) ?? []).length === 1 &&
  /monthMerged\.filter\(\(d\) => weekIds\.includes\(d\.dayId\)\)/.test(ver));
ok('hari ini tetap LIVE (disisipkan ke deret)',
  /today && d\.dayId === todayId \? today : d/.test(ver));
ok('bagian mingguan tetap ada (kini kartu KIRI, sebelahan dengan bulan)',
  /📊 Minggu ini/.test(ver) && /usageRowHero/.test(ver));
ok('daftar "📊 Per Hari · Minggu Ini" tetap memakai deret minggu',
  /📊 Per Hari · Minggu Ini/.test(ver) && /weekMerged\.map/.test(ver));
ok('formatWeekRange masih dipakai (Learning juga memakainya)',
  /formatWeekRange/.test(ver) && /formatWeekRange/.test(baca('components/learning/WeekTab.tsx')));

console.log(gagal === 0 ? '\n✅ LULUS — laporan bulanan benar & mingguan tetap utuh.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
