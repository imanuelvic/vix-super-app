// Istilah: "Click"/"click" — bukan "ketuk"/"ketukan"/"diketuk", bukan "tap".
// Berlaku untuk teks yang tampil di layar MAUPUN komentar kode.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// Semua berkas kode app ini.
const DIRS = ['app', 'components', 'lib', 'hooks', 'contexts', 'assets'];
function berkas(dir, keluar = []) {
  for (const nama of fs.readdirSync(dir)) {
    const p = path.join(dir, nama);
    if (fs.statSync(p).isDirectory()) berkas(p, keluar);
    else if (/\.tsx?$/.test(nama)) keluar.push(p);
  }
  return keluar;
}
const semua = DIRS.flatMap((d) => berkas(path.join(ROOT, d))).map((p) => ({
  nama: p.slice(ROOT.length + 1).split('\\').join('/'),
  isi: fs.readFileSync(p, 'utf8'),
}));

// ===================================================================
console.log('\n=== Tidak ada lagi "ketuk" & "tap" di seluruh app ===');
const sisaKetuk = semua.filter((f) => /ketuk/i.test(f.isi)).map((f) => f.nama);
ok('nol kemunculan "ketuk/Ketuk/ketukan/diketuk"',
  sisaKetuk.length === 0, sisaKetuk.join(', '));

// \b penting: "tetap", "setiap", "tahap" TIDAK boleh ikut kena.
// Nama API pustaka (Gesture.Tap() milik react-native-gesture-handler, dipakai
// tombol air mengambang) bukan istilah kita — dikecualikan, sisanya tetap.
const sisaTap = semua
  .filter((f) => /\b(tap|Tap|taps|tapped|tapping)\b/.test(f.isi.replace(/Gesture\.Tap\(\)/g, '')))
  .map((f) => f.nama);
ok('nol kemunculan kata "tap" yang berdiri sendiri',
  sisaTap.length === 0, sisaTap.join(', '));

console.log('\n=== Gantinya benar-benar terpasang ===');
const berklik = semua.filter((f) => /\bclick/i.test(f.isi));
ok(`kata "click" dipakai di ${berklik.length} berkas`, berklik.length >= 40,
  String(berklik.length));

// Teks yang benar-benar TAMPIL di layar (bukan komentar).
console.log('\n=== Teks yang tampil di layar ===');
for (const [nama, berkas_, pola] of [
  ['Sparepart mobil', 'components/car/PartsTab.tsx',
    /'Click bagian mana pun untuk memperbarui tanggalnya\.'/],
  ['Tugas rumah', 'components/residence/ChoreTab.tsx',
    /'Click item mana pun untuk memperbarui tanggalnya\.'/],
  ['Pohon keluarga', 'app/family.tsx', /Click siapa pun di pohon untuk berpindah/],
  // "Doa Rantai pagi" dulu ada di sini. 27 Agu 2026 PEMILIKNYA sendiri
  // menghapus blok komentar itu dari MorningPrayerGate.tsx (bersama dua baris
  // hint di layarnya), jadi tak ada lagi teks yang perlu dijaga di sana.
]) ok(nama, pola.test(baca(berkas_)));

// Yang tetap dijaga: kalau kata "ketuk"/"tap" muncul LAGI di berkas itu.
// 21 Sep 2026: gerbangnya jadi Morning Journey (tiga berkas).
ok('Morning Journey tetap bebas dari "ketuk"/"tap"',
  ['components/spiritual/MorningJourney.tsx', 'components/spiritual/journey/JourneySteps.tsx', 'components/spiritual/journey/JourneyCard.tsx',
    'components/spiritual/journey/JourneyTrail.tsx', 'lib/journey.ts']
    .every((f) => !/\bketuk|\btap\b/i.test(baca(f))));

console.log('\n=== Bentuk kata Indonesianya tetap benar ===');
const gabung = semua.map((f) => f.isi).join('\n');
ok('bentuk pasif jadi "di-click", bukan "diclick"',
  /di-click/.test(gabung) && !/\bdiclick/i.test(gabung));
ok('kepemilikan jadi "click-nya", bukan "clicknya"',
  /click-nya/.test(gabung) && !/\bclicknya/i.test(gabung));
ok('"double-tap" ikut jadi "double-click"',
  /double-click/.test(baca('lib/usage.ts')) && !/double-tap/.test(gabung));

console.log('\n=== Kata lain TIDAK ikut terbawa ===');
ok('"tetap" & "setiap" utuh (bukti \\b-nya bekerja)',
  /\btetap\b/.test(gabung) && /\bsetiap\b/.test(gabung) &&
  !/teclick|seclick/i.test(gabung));
ok('"tekanan darah" di fitur Health tidak tersentuh',
  /tekanan/i.test(gabung));
ok('"tekan/ditekan" sengaja DIBIARKAN (kata Indonesia biasa, bukan "ketuk")',
  /\bditekan\b/.test(gabung));
ok('nama fungsi & prop React tidak ikut diubah',
  /onPress=/.test(gabung) && /onPressIn/.test(gabung) &&
  /Pressable/.test(gabung) && !/onClick=/.test(gabung));
ok('kata-kata chat & teks doa tidak ikut rusak',
  /Selamat pagi! ☀️ uda mo akhir minggu/.test(baca('lib/chatTemplates.ts')));

console.log(gagal === 0
  ? '\n✅ LULUS — satu istilah: Click.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
