// Tanggal di kartu visitasi jadi "ddd, dd mmm yy · 🕒 jj.mm" — bentuk yang SAMA
// SAMA PERSIS di sub-tab Visitation & layar Riwayat Visitasi.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-tanggal');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ===================================================================
console.log('\n=== Bentuk tanggalnya (fungsi dijalankan sungguhan) ===');
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/format.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs',
      '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
const F = require(path.join(OUT, 'format.js'));

// Senin, 31 Agustus 2026, jam 19.00 (bulan JS 0-based → 7 = Agustus).
const senin = new Date(2026, 7, 31, 19, 0);
ok('persis seperti yang diminta: "Sen, 31 Agu 26 · 🕒 19.00"',
  F.formatCompactDateTime(senin) === 'Sen, 31 Agu 26 · 🕒 19.00',
  F.formatCompactDateTime(senin));

// TANGGALNYA apa adanya (nol di depan itu bahasa mesin), tapi JAMNYA tetap 2
// digit — "9.05" terbaca seperti angka pecahan, bukan jam.
const awalBulan = new Date(2026, 8, 2, 9, 5);
ok('tanggal 1 digit apa adanya, jam tetap 2 digit',
  F.formatCompactDateTime(awalBulan) === 'Rab, 2 Sep 26 · 🕒 09.05',
  F.formatCompactDateTime(awalBulan));

ok('tengah malam tetap tampil 00.00 (bukan kosong / 24.00)',
  F.formatCompactDateTime(new Date(2026, 0, 1, 0, 0)) === 'Kam, 1 Jan 26 · 🕒 00.00',
  F.formatCompactDateTime(new Date(2026, 0, 1, 0, 0)));

ok('tahunnya 2 digit, ikut berganti dengan benar',
  F.formatCompactDateTime(new Date(2027, 11, 25, 8, 30)) === 'Sab, 25 Des 27 · 🕒 08.30',
  F.formatCompactDateTime(new Date(2027, 11, 25, 8, 30)));

// Ketujuh hari & dua belas bulan harus 3 huruf semua.
const hari = [];
for (let d = 1; d <= 7; d++) hari.push(F.formatCompactDateTime(new Date(2026, 1, d, 7, 0)).split(',')[0]);
ok('nama hari 3 huruf, tujuh-tujuhnya',
  hari.join(' ') === 'Min Sen Sel Rab Kam Jum Sab', hari.join(' '));
const bulan = [];
for (let m = 0; m < 12; m++) {
  bulan.push(F.formatCompactDateTime(new Date(2026, m, 15, 7, 0)).split(' ')[2].replace(',', ''));
}
ok('nama bulan 3 huruf, dua belas-belasnya',
  bulan.join(' ') === 'Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des',
  bulan.join(' '));

ok('tidak menimpa/merusak formatter tanggal lain yang sudah ada',
  F.formatFullDate(senin) === 'Senin, 31 Agustus 2026' &&
  F.formatCompactDate(senin) === 'Sen, 31 Agu 26' &&
  F.formatTime(senin) === '19.00');

// ===================================================================
console.log('\n=== Dipakai di kartunya, bukan cuma dibuat ===');
const body = baca('components/core/VisitationCardBody.tsx');
ok('kartu visitasi memakai bentuk baru itu',
  /📆 \{formatCompactDateTime\(v\.date\.toDate\(\)\)\}/.test(body));
ok('bentuk panjang yang lama sudah tidak dipakai di kartu',
  !/formatFullDate/.test(body));

console.log('\n=== Sama persis di kedua layar ===');
const tab = baca('components/core/VisitationTab.tsx');
const riwayat = baca('app/visitations.tsx');
ok('sub-tab Visitation memakai <VisitationCardBody/>',
  /<VisitationCardBody/.test(tab));
ok('Riwayat Visitasi memakai <VisitationCardBody/> yang SAMA',
  /<VisitationCardBody/.test(riwayat));
ok('tak satu pun dari keduanya menggambar tanggalnya sendiri',
  !/formatCompactDateTime|formatFullDate\(v\.date/.test(riwayat) &&
  !/formatCompactDateTime/.test(tab));

console.log('\n=== Jam pertemuannya tidak hilang dari tempat lain ===');
ok('PDF notulen tetap menulis jam mulainya',
  /\{ label: 'Mulai', value: `\$\{formatTime\(d\)\} WIB` \}/.test(baca('lib/visitationPdf.ts')));
ok('kolom 🕒 Jam pertemuan di form tetap ada',
  // (16 Sep 2026: labelnya kamu ubah jadi 'Jam Pertemuan'.)
  /🕒 Jam Pertemuan/.test(baca('components/core/VisitationFormFields.tsx')) &&
  /<TimeField/.test(baca('components/core/VisitationFormFields.tsx')));
ok('tanggal & jam tetap SATU kolom Timestamp (tak ada kolom baru di Firestore)',
  /date: Timestamp\.fromDate\(date\)/.test(baca('hooks/useVisitationForm.ts')) &&
  !/time:/.test(baca('hooks/useVisitationForm.ts')));

console.log('\n=== Pencarian tetap jalan ===');
// Kotak cari memakai bentuk PANJANG sebagai bahan cari, jadi mengetik
// "agustus" tetap ketemu walau kartunya menulis "Agu".
ok('bahan pencarian masih memakai tanggal bentuk panjang',
  /formatFullDate\(\s*\n?\s*v\.date\.toDate\(\),?\s*\n?\s*\)/.test(tab) ||
  /formatFullDate\(/.test(tab));
const bahan = `${F.formatFullDate(senin)}`.toLowerCase();
ok('"agustus", "senin", & "2026" semuanya masih cocok',
  bahan.includes('agustus') && bahan.includes('senin') && bahan.includes('2026'));
ok('"agu" & "sen" (seperti yang tertulis di kartu) juga cocok',
  bahan.includes('agu') && bahan.includes('sen'));

console.log(gagal === 0
  ? '\n✅ LULUS — tanggal+jam ringkas, sama di kedua layar.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
