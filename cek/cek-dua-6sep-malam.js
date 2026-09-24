// Dua permintaan (6 Sep 2026, larut):
//   1. Fun Futsal: daftar "Jadwal Main Terdekat" dibuang, pintunya tinggal —
//      dan tampilan halamannya dirapikan.
//   2. 👤 Edit Profile: label "Catatan bebas" dibuang.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

// ============================================================
console.log('=== 1. Fun Futsal: daftar dibuang, pintunya tinggal ===');
// ============================================================
const tab = baca('components/friends/FutsalTab.tsx');

c('kartu jadwal di daftar sudah tidak dirender',
  !/<FutsalSessionCard/.test(tab));
c('impornya ikut dibuang, bukan ditinggal menganggur',
  !/FutsalSessionCard/.test(tab));
// Komponennya sendiri TIDAK dihapus — halaman Jadwal Main memakainya.
c('komponennya tetap ada & tetap dipakai halaman Jadwal Main',
  fs.existsSync(R + 'components/friends/FutsalSessionCard.tsx') &&
    /<FutsalSessionCard/.test(baca('app/futsal-schedule.tsx')));

// 6 Sep 2026 (malam, batch kedua): pintunya PINDAH lagi — dari baris judul di
// dalam daftar jadi tombol 📅 di pojok header. Judul bagian yang isinya cuma
// satu tombol itu judul yang tak memayungi apa pun; di pojok header ia juga
// tak lagi ikut menggulung hilang sama sekali.
c('baris "Jadwal Main" benar-benar hilang dari sub-tab',
  !/<SectionRow/.test(tab) && !/futsal-schedule/.test(tab));
c('pintunya jadi tombol 📅 di header, di antara 💰 kas & 🏅 papan',
  /emoji="💰"[\s\S]{0,220}emoji="📅"[\s\S]{0,220}emoji="🏅"/.test(
    baca('app/friends.tsx'),
  ));

// Patokan sticky menghitung ANAK LANGSUNG ScrollView — satu anak hilang, satu
// nomor ikut turun.
c('nomor patokan judul Anggota ikut turun ke 3',
  /^const STICKY_HEADERS = \[3\];$/m.test(tab));
{
  const a = tab.indexOf('stickyHeaderIndices={STICKY_HEADERS}');
  const b = tab.indexOf('      </ScrollView>', a);
  const anak = tab
    .slice(a, b)
    .split('\n')
    .filter((l) => /^ {8}<[A-Za-z]/.test(l));
  c('anak ke-3 memang judul Anggota, dan jumlahnya tinggal 5',
    anak.length === 5 && anak[3].includes('<SectionToggle'),
    anak.map((l, i) => i + ':' + l.trim().slice(0, 16)).join(' '));
}

console.log('\n--- tampilan kartu jadwal terdekat ---');
c('kartunya bertanda bisa diklik (›)', /styles\.heroChevron/.test(tab));
c('tandanya cuma muncul kalau memang ada tujuannya',
  /\{berikut \? \(\s*\n\s*<VixText heading="bold" additionalStyle=\{styles\.heroChevron\}>/.test(tab));
// Chipnya sendiri kini komponen bersama <InfoChip/> (dipakai juga Catatan
// Khotbah & His Promise), jadi bentuknya tak lagi ditulis di layar ini.
c('keterangannya jadi chip, bukan tiga baris teks bersambung',
  /styles\.heroChips/.test(tab) && (tab.match(/<InfoChip/g) || []).length === 4);
c('chipnya memakai rupa "di atas kartu gelap"',
  (tab.match(/tone="onDark"/g) || []).length === 4);
c('keempat keterangannya tetap ada: jam, lapangan, pemain, iuran',
  /🕗 \$\{sessionTimeRange\(berikut\)\}/.test(tab) &&
    /📍 \$\{berikut\.venue \|\| 'lapangan belum diisi'\}/.test(tab) &&
    /👥 \$\{berikut\.squad\.length\} pemain/.test(tab) &&
    /formatRupiah\(berikut\.fee\)\}\/orang/.test(tab));
c('kartunya tetap satu klik ke rincian sesi',
  /onPress=\{\(\) => berikut && bukaRincian\(berikut\)\}/.test(tab));
c('belum ada jadwal → kartunya tetap bicara, tidak kosong',
  /Belum ada jadwal/.test(tab) && /Tentukan jadwal sekarang ⚽/.test(tab));

// Warna chipnya dari palet, bukan hex baru yang ditulis di layar.
const warna = baca('assets/style/color.ts');
c('warna latar chipnya masuk palet bersama',
  /SURFACE_ON_DARK: '#FFFFFF1F',/.test(warna));
c('layar tidak menulis hex sendiri',
  !/#[0-9A-Fa-f]{6}/.test(tab));
// Latar melengkung pada <Text> tetap siku di iOS tanpa overflow: 'hidden' —
// dijaga sekali di komponen bersamanya, bukan di tiap layar yang memakainya.
const chip = baca('components/common/InfoChip.tsx');
c('sudut chipnya benar-benar melengkung di iOS',
  /chip: \{[\s\S]{0,200}overflow: 'hidden',/.test(chip));
c('ketiga rupanya dari palet, bukan hex yang diketik ulang',
  /Color\.CONTRAST_CONTAINER/.test(chip) &&
    /Color\.SURFACE_ON_DARK/.test(chip) &&
    /theme\.bg/.test(chip) &&
    !/#[0-9A-Fa-f]{6}/.test(chip));
// Salinan yang dulu tertulis DUA KALI untuk satu hal yang sama.
c('daftar & halaman Catatan Khotbah memakai chip yang sama',
  /<InfoChip/.test(baca('app/sermon.tsx')) &&
    /<InfoChip/.test(baca('components/spiritual/SermonTab.tsx')) &&
    !/metaChip/.test(baca('app/sermon.tsx')) &&
    !/metaChip/.test(baca('components/spiritual/SermonTab.tsx')));

// ============================================================
console.log('\n=== 2. 👤 Edit Profile: label "Catatan bebas" dibuang ===');
// ============================================================
const profil = baca('app/profile.tsx');
// Yang tersisa cuma penyebutannya di KOMENTAR (menerangkan kenapa labelnya
// dibuang), bukan tulisan yang tampil di layar.
const profilKode = profil
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');
c('labelnya sudah tidak ada', !/Catatan bebas/.test(profilKode));
c('judul bagiannya TETAP (itu yang menerangkan kolomnya)',
  /title: '📝 Catatan',/.test(profil));
c('petunjuk di dalam kolomnya tetap ada',
  /placeholder: 'Hal penting lain biar tidak lupa…',/.test(profil));
c('kolomnya sendiri tidak ikut hilang', /key: 'notes',/.test(profil));
// Labelnya jadi opsional, bukan diisi string kosong: string kosong tetap
// merender <VixText> yang tinggi barisnya ikut memakan ruang.
c('labelnya jadi opsional di tipenya', /  label\?: string;/.test(profil));
c('barisnya tidak lagi dirender kalau labelnya kosong',
  (profil.match(/\{f\.label \? \(/g) || []).length === 2);
// 23 Sep 2026: label kolom profil dapat lambang di depan & Huruf Besar Tiap
// Kata, sama seperti label kolom di seluruh app.
c('kolom lain tetap berlabel seperti biasa',
  /label: '🏠 Alamat'/.test(profil) && /label: '📱 No\. HP'/.test(profil) &&
    /label: '✉️ Email'/.test(profil));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
