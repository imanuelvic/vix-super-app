// Tombol Sign Out 🚪 pindah dari tab Life ke layar System (28 Sep 2026).
//
// Permintaannya empat hal: (1) hilang dari Life, (2) ada di System tepat DI
// BAWAH Cadangan Data, (3) tombolnya MERAH, (4) ditanya dulu sebelum keluar.
//
// Yang paling perlu dijaga bukan keempatnya, melainkan yang tidak diminta
// tapi mudah rusak: `logout` sendiri harus tetap membersihkan simpanan di HP
// SEBELUM signOut. Kalau urutannya terbalik, dokumen akun lama tertinggal di
// disk sesudah keluar.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const life = baca('app/(tabs)/life.tsx');
const system = baca('app/system.tsx');
const auth = baca('contexts/auth.tsx');

// =====================================================================
console.log('=== 1. Hilang dari tab Life ===');
// =====================================================================
ok('tidak ada lagi tombol keluar di pojok judul Life',
  !/onPress=\{logout\}/.test(life) &&
  !/rectangle\.portrait\.and\.arrow\.right/.test(life));
ok('`logout` tidak lagi diambil dari useAuth di sana',
  !/logout/.test(life.replace(/\{\/\*[\s\S]*?\*\/\}/g, '')));
// Bungkus baris judulnya ikut dilepas karena tinggal satu anak. Gaya yang
// ditinggalkan tanpa pemakai = entri nganggur, dan itu yang diperiksa di sini
// (pemindai gaya-mati juga menangkapnya, tapi di sini alasannya tercatat).
ok('gaya baris judul yang jadi nganggur ikut dibuang', !/titleRow/.test(life));
// Jaraknya TIDAK boleh berubah: judul & kolom cari dulu berjarak `gap: 8`
// milik header, dan itu harus tetap begitu sesudah bungkusnya dilepas.
ok('jarak judul → kolom cari tidak bergeser (gap 8 milik header)',
  /header: \{[\s\S]{0,200}gap: 8,\s*\n\s*\},/.test(life));
// Sisa isi tab Life tidak boleh ikut terbawa.
ok('grid fitur & pencariannya utuh',
  /LIFE_FEATURES\.map/.test(life) && /searchFeatures\(query\)/.test(life) &&
  /logFeatureUse\(user\.uid/.test(life));

// =====================================================================
console.log('\n=== 2. Ada di System, TEPAT di bawah Cadangan Data ===');
// =====================================================================
const iCadangan = system.indexOf('📦 Cadangan Data');
const iAkun = system.indexOf('🚪 Akun');
const iTombol = system.indexOf('label="Sign Out"');
ok('bagian 🚪 Akun ada di layar System', iAkun > -1);
ok('letaknya SESUDAH 📦 Cadangan Data, bukan sebelumnya',
  iCadangan > -1 && iAkun > iCadangan);
// "Tepat di bawah" — tidak boleh ada bagian lain menyelip di antaranya.
ok('tidak ada bagian lain menyelip di antara keduanya', (() => {
  // Potongannya dari TULISAN "📦 Cadangan Data" sampai TULISAN "🚪 Akun", jadi
  // judul yang ikut terpotong di dalamnya tepat satu: pembuka 🚪 Akun sendiri.
  // Lebih dari itu berarti ada bagian ketiga yang menyelip di antaranya.
  const antara = system.slice(iCadangan, iAkun);
  const judul = antara.match(/heading="title" additionalStyle=\{styles\.sectionTitle\}/g) || [];
  return judul.length === 1;
})());
ok('tombolnya ada di dalam bagian itu', iTombol > iAkun);
ok('menyebut akun yang sedang dipakai (biar jelas keluar dari mana)',
  /Masuk sebagai \{user\?\.email \?\? '-'\}/.test(system));
ok('memakai tombol utama bersama, bukan tombol buatan sendiri',
  /<PrimaryButton\s*\n\s*label="Sign Out"/.test(system) &&
  /from '@\/components\/common\/PrimaryButton'/.test(system));

// =====================================================================
console.log('\n=== 3. Merah, dan merahnya dari token ===');
// =====================================================================
{
  const blok = system.slice(iTombol - 200, iTombol + 400);
  ok('warnanya Color.DANGER, bukan hex yang diketik sendiri',
    /background=\{Color\.DANGER\}/.test(blok));
  ok('DANGER memang warna merah bahaya yang dipakai seluruh app',
    /DANGER: '#C0392B',/.test(baca('assets/style/color.ts')));
  ok('tidak ada warna hex mentah di layar ini', !/#[0-9A-Fa-f]{6}/.test(system));
  // Merah HANYA untuk ini di layar System — kalau tombol lain ikut merah,
  // peringatannya kehilangan arti.
  ok('cuma tombol ini yang merah di layar System',
    (system.match(/Color\.DANGER/g) || []).length === 1);
}

// =====================================================================
console.log('\n=== 4. Ditanya dulu sebelum keluar ===');
// =====================================================================
ok('tombolnya TIDAK langsung keluar — cuma membuka dialog',
  /onPress=\{\(\) => setConfirmKeluar\(true\)\}/.test(system) &&
  !/onPress=\{onLogout\}/.test(system));
ok('memakai ConfirmDialog bersama, bukan dialog buatan sendiri',
  /<ConfirmDialog/.test(system) &&
  /from '@\/components\/common\/ConfirmDialog'/.test(system));
ok('pertanyaannya jelas & tombol iyanya bertuliskan "Keluar"',
  /title="Keluar dari akun\?"/.test(system) && /confirmLabel="Keluar"/.test(system));
ok('keterangannya menenangkan hal yang benar: data di server tidak terhapus',
  /Datamu di server tidak ada yang terhapus/.test(system));
ok('yang benar-benar keluar cuma sesudah dikonfirmasi',
  /onConfirm=\{onLogout\}/.test(system) && /await logout\(\);/.test(system));
ok('Batal menutup dialog tanpa keluar',
  /onCancel=\{\(\) => setConfirmKeluar\(false\)\}/.test(system));
ok('tombol & dialognya menunjukkan sedang bekerja',
  (system.match(/busy=\{busy === 'keluar'\}/g) || []).length === 2);
ok('gagal keluar punya pesannya sendiri, terpisah dari galat ekspor',
  /setLogoutError\('Gagal keluar\. Coba lagi\.'\)/.test(system) &&
  /<ScreenError message=\{logoutError\} \/>/.test(system) &&
  /<ScreenError message=\{exportError\} \/>/.test(system));

// =====================================================================
console.log('\n=== 5. Tidak bisa bertabrakan dengan pencadangan ===');
// =====================================================================
ok('keluar & ekspor berbagi SATU penjaga sibuk',
  /useBusyTask<'ekspor' \| 'keluar'>\(\)/.test(system));
ok('keduanya lewat run() yang sama, jadi yang kedua diabaikan',
  /key: 'ekspor',/.test(system) && /key: 'keluar',/.test(system) &&
  /if \(busy !== null\) return;/.test(baca('hooks/useBusyTask.ts')));

// =====================================================================
console.log('\n=== 6. Yang TIDAK boleh berubah: apa arti "keluar" ===');
// =====================================================================
// Ini bagian terpenting berkas ini. Tombolnya boleh pindah ke mana saja,
// tapi urutan di dalam `logout` tidak boleh: bersihkan simpanan di HP DULU,
// baru lepas sesinya. Terbalik = dokumen akun lama tertinggal di disk.
ok('logout membersihkan simpanan di HP SEBELUM melepas sesi', (() => {
  const blok = /logout: async \(\) => \{([\s\S]*?)\n {6}\},/.exec(auth)?.[1] ?? '';
  const iBersih = blok.indexOf('clearLiveCache()');
  const iKeluar = blok.indexOf('signOut(auth)');
  return iBersih > -1 && iKeluar > iBersih;
})());
ok('tidak ada jalan keluar lain yang melewati pembersihan itu',
  (system.match(/logout\(\)/g) || []).length === 1 &&
  !/signOut\(/.test(system) && !/signOut\(/.test(life));

// =====================================================================
console.log('\n=== 7. Aturan tetap proyek ===');
// =====================================================================
{
  const berkas = [life, system];
  ok('istilahnya "click", bukan klik/ketuk/tekan',
    !berkas.some((s) => /\b(klik|Klik|ketuk|Ketuk|tekan|ditekan|menekan)\b/.test(s)));
  const emDash = [];
  for (const s of berkas) {
    for (const m of s.match(/'[^'\n]*'|`[^`\n]*`|"[^"\n]*"/g) || []) {
      if (m.includes(String.fromCharCode(0x2014))) emDash.push(m.slice(0, 40));
    }
  }
  ok('tanpa tanda pisah panjang di teks yang tampil', emDash.length === 0, emDash.join(' | '));
  ok('tanpa modul native baru (cukup eas update)',
    !/from 'react-native-(?!reanimated|gesture-handler|safe-area-context|svg|webview)/.test(system));
}

console.log('\n' + (gagal === 0
  ? '✅ LULUS — Sign Out pindah ke System, merah, & ditanya dulu.'
  : `❌ ${gagal} cek gagal.`));
process.exit(gagal === 0 ? 0 : 1);
