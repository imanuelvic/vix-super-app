// Lima perbaikan tampilan:
// 1. "10 orang ⌄" tidak pernah jatuh ke baris bawah judul dropdown Leaders
// 2. kolom "Nama yang dituju" dipatok di atas Template Chat
// 3. lambang Pagi/Siang/Malam satu set untuk seluruh app
// 4. modal 👤 Edit Profile tidak lagi menutup-membuka sendiri saat mengetik
// 5. margin atas layar Puasa Baru disamakan dengan layar isian lain
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-lima');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ===================================================================
console.log('\n=== 1. Judul dropdown: jumlah orang & panah di kanan judul ===');
const leaders = baca('components/core/LeadersTab.tsx');

// Barisnya HARUS dipegang <View> di DALAM PressableScale, bukan style
// PressableScale-nya sendiri: ScrollView memindahkan style anak sticky-nya ke
// pembungkus buatannya & memberi anaknya `{flex:1}` polos, jadi
// flexDirection:'row' di situ hilang dan judul jatuh ke atas "10 orang ⌄".
ok('barisnya memang satu baris: judul kiri, sisanya kanan',
  /toggleRow:\s*\{\s*\n\s*flexDirection: 'row',\s*\n\s*justifyContent: 'space-between',\s*\n\s*alignItems: 'center',/.test(leaders));
ok('baris itu di DALAM PressableScale, tahan dari pemindahan style sticky',
  (leaders.match(/style=\{styles\.toggleHeader\}\s*\n\s*onPress=\{[^}]*\}>\s*\n\s*<View style=\{styles\.toggleRow\}>/g) ?? []).length === 2);
const blokToggleHeader = /toggleHeader:\s*\{([\s\S]*?)\n  \},/.exec(leaders);
ok('toggleHeader TIDAK lagi memegang flexDirection (percuma, ikut dipindah)',
  blokToggleHeader !== null &&
  !/flexDirection|justifyContent|alignItems/.test(blokToggleHeader[1]) &&
  /backgroundColor: Color\.BACKGROUND/.test(blokToggleHeader[1]),
  blokToggleHeader ? blokToggleHeader[1].trim() : 'blok tidak ketemu');
ok('judul yang mengalah kalau sempit (flexShrink 1)',
  /toggleTitle: \{ flexShrink: 1 \}/.test(leaders));
ok('"10 orang ⌄" TIDAK boleh menyusut → tak pernah terdorong ke baris bawah',
  /toggleRight:\s*\{[\s\S]{0,120}flexShrink: 0,/.test(leaders));
ok('judulnya dipotong "…" kalau kepanjangan, bukan dibuat dua baris',
  (leaders.match(/numberOfLines=\{1\}\s*\n\s*additionalStyle=\{styles\.toggleTitle\}/g) ?? []).length === 2);
ok('kedua judul (CORE Leader & Main Team) diperlakukan sama',
  /🫶 CORE Leader/.test(leaders) && /👥 Main Team/.test(leaders));

console.log('\n   yang tidak boleh berubah');
ok('isi kanannya tetap: jumlah orang / "Tutup" + panah naik-turun',
  /\{clOpen \? 'Tutup' : `\$\{leaders\.length\} orang`\}/.test(leaders) &&
  /\{mtOpen \? 'Tutup' : `\$\{mainTeam\.length\} orang`\}/.test(leaders) &&
  /name=\{clOpen \? 'chevron\.up' : 'chevron\.down'\}/.test(leaders));
ok('judulnya tetap DIPATOK saat digulir (stickyHeaderIndices)',
  /stickyHeaderIndices=\{STICKY_HEADERS\}/.test(leaders));

// ===================================================================
console.log('\n=== 2. Kolom nama Template Chat dipatok di atas ===');
const chat = baca('app/chat-templates.tsx');
const iPatok = chat.indexOf('<StickyTop>');
const iScroll = chat.indexOf('<KeyboardAwareScrollView');
const iTutupPatok = chat.indexOf('</StickyTop>');

ok('kolom nama dibungkus <StickyTop> (komponen patok bersama, bukan bikin baru)',
  iPatok > -1 && /from '@\/components\/common\/StickyTop'/.test(chat));
ok('letaknya DI LUAR & DI ATAS daftar yang digulir',
  iPatok > -1 && iScroll > -1 && iPatok < iScroll && iTutupPatok < iScroll);
const isiPatok = chat.slice(iPatok, iTutupPatok);
// Deretan chip nama CL sudah diganti SATU dropdown — jadi seluruh pemilihan
// nama muat di baris patok, tak ada lagi yang tercecer di dalam daftar.
ok('yang dipatok = label + dropdown namanya',
  /🙋 Nama yang Dituju/.test(isiPatok) &&
  /<SelectField/.test(isiPatok) && /options=\{pilihanNama\}/.test(isiPatok));
ok('deretan chip nama CL sudah tidak ada lagi di layar ini',
  !/<Chip/.test(chat) && !/chipWrap/.test(chat));
ok('aturan munculnya tidak berubah: hanya untuk kategori yang memakai {nama}',
  /\{fields\.includes\('nama'\) && \(\s*\n\s*<StickyTop>/.test(chat));
ok('kolom ketik "nama lain" ikut dipatok, hanya saat dipilih',
  /pilihan === MANUAL && \(/.test(isiPatok));
ok('kolom gelar tetap di dalam daftar (hanya muncul untuk Happy Graduation)',
  chat.indexOf("fields.includes('gelar')") > iScroll);
ok('bukan posisi absolute → tidak menutupi isi di bawahnya',
  !/position: 'absolute'/.test(chat));
ok('teks & tombol Kirim tidak disentuh',
  /Kirim 💬/.test(chat) && /shareTextToWhatsApp\(text/.test(chat));

// ===================================================================
console.log('\n=== 3. Lambang Pagi/Siang/Malam: satu set untuk semua ===');
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/daypart.ts'), '--ignoreConfig', '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
      '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }
const { DAYPART } = require(path.join(OUT, 'daypart.js'));

ok('satu sumber lambangnya ada & isinya bertiga',
  DAYPART.morning === '🌅' && DAYPART.daytime === '🌤️' && DAYPART.night === '🌙',
  JSON.stringify(DAYPART));

const pemakai = {
  'Habits (sesi kebiasaan)': 'lib/habits.ts',
  'Bacaan Alkitab': 'lib/spiritual.ts',
  'Reward': 'lib/reward.ts',
  'Sapaan Home': 'components/common/Greeting.tsx',
};
for (const [nama, berkas] of Object.entries(pemakai)) {
  const src = baca(berkas);
  ok(`${nama} memakai DAYPART`,
    /DAYPART\.(morning|daytime|night)/.test(src) && /daypart'/.test(src));
}

// Yang paling penting: Siang tidak lagi ☀️ di satu layar dan 🌤️ di layar lain.
const kodeSaja = (p) =>
  baca(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
ok('tidak ada lagi ☀️ dipakai sebagai lambang sesi',
  !/☀️/.test(kodeSaja('lib/spiritual.ts')) &&
  !/☀️/.test(kodeSaja('lib/reward.ts')) &&
  !/☀️/.test(kodeSaja('components/common/Greeting.tsx')));
ok('lambangnya tidak ditulis ulang mentah-mentah di daftar sesinya',
  !/emoji: '🌅'|emoji: '🌤️'|emoji: '🌙'/.test(baca('lib/habits.ts')) &&
  !/emoji: '🌅'|emoji: '☀️'|emoji: '🌙'/.test(baca('lib/spiritual.ts')) &&
  true);
ok('sesi Pagi Fitness ikut sumber yang sama',
  /\$\{DAYPART\.morning\} Sesi pagi/.test(baca('lib/fitness.ts')));
ok('"Selamat sore 🌇" tetap 🌇 (sore memang bukan salah satu sesi)',
  /'Selamat sore 🌇'/.test(baca('components/common/Greeting.tsx')));
ok('kata-kata chat buatanmu sendiri tidak ikut diubah',
  /Selamat pagi! ☀️ uda mo akhir minggu/.test(baca('lib/chatTemplates.ts')));

console.log('\n   yang tidak boleh berubah');
ok('nama & urutan sesi Habits tetap Pagi · Siang · Malam',
  /key: 'morning', label: 'Pagi'[\s\S]{0,80}key: 'daytime', label: 'Siang'[\s\S]{0,80}key: 'night', label: 'Malam'/.test(baca('lib/habits.ts')));
ok('jendela jam Bacaan Alkitab tidak digeser',
  /fromHour: 5, toHour: 10/.test(baca('lib/spiritual.ts')) &&
  /fromHour: 12, toHour: 15/.test(baca('lib/spiritual.ts')) &&
  /fromHour: 21, toHour: 24/.test(baca('lib/spiritual.ts')));
ok('kunci Firestore-nya tidak ikut berubah (data lama tetap terbaca)',
  /key: 'bibleDaytime'/.test(baca('lib/reward.ts')));

// ===================================================================
console.log('\n=== 4. Modal 👤 Edit Profile: tidak lagi menutup-membuka sendiri ===');
const profile = baca('app/profile.tsx');
ok('isinya DIPANGGIL sebagai fungsi, bukan dipasang sebagai komponen',
  /\{renderProfileContent\(\)\}|\(\s*\n\s*renderProfileContent\(\)\s*\n\s*\)/.test(profile) ||
  /renderProfileContent\(\)/.test(profile));
// Diuji dari KODENYA saja — komentar penjelas di atasnya memang menyebut
// bentuk lama itu supaya jelas apa yang tidak boleh dikembalikan.
ok('tidak ada lagi <ProfileContent /> (komponen jenis baru tiap render)',
  !/<ProfileContent/.test(kodeSaja('app/profile.tsx')));
ok('namanya huruf kecil → React tidak mungkin memperlakukannya sebagai komponen',
  /function renderProfileContent\(\)/.test(profile));
ok('sebabnya ditulis di kodenya, biar tidak dikembalikan tanpa sengaja',
  /BUKAN dipasang\s*\n\s*\/\/ sebagai komponen/.test(profile));
ok('modalnya sendiri tidak diubah (judul, isi, tombol simpan)',
  /title="👤 Edit Profile"/.test(profile) &&
  /onConfirm=\{handleSave\}/.test(profile) &&
  /onClose=\{\(\) => setEditOpen\(false\)\}/.test(profile));
ok('kolom isiannya tetap menulis ke form yang sama',
  profile.includes('setForm((prev) => ({') &&
  profile.includes('[f.key]: f.phone ? localPhone(t) : t,'));

// Penyakit yang sama dulu ada di tab Insurance (MetricCard bersarang). Tab-nya
// sudah dihapus permanen atas permintaan pemilik app, jadi yang tersisa untuk
// diperiksa cuma satu: berkasnya benar-benar tidak ada lagi.
ok('InsuranceTab.tsx sudah dihapus permanen',
  !fs.existsSync(path.join(ROOT, 'components/career/InsuranceTab.tsx')));

// ===================================================================
console.log('\n=== 5. Margin atas layar Puasa Baru ===');
const puasa = baca('app/fasting.tsx');
// 16 Sep 2026: paddingBottom 40 (dasar layar rata seperti Family, edges top saja).
ok('jarak atas daftarnya 4 (sama dengan layar isian lain)',
  /content: \{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 \}/.test(puasa));
ok('keenam kolomnya dikelompokkan, bukan berderet lurus',
  /<Bagian judul="📝 Tentang Puasa">/.test(puasa) &&
  /<Bagian judul="📆 Periode">/.test(puasa) &&
  /<Bagian judul="✨ Jawaban Doa">/.test(puasa) &&
  !/firstLabel/.test(puasa));
ok('label tiap kolom tetap berbunyi sama',
  /<Kolom label="Nama puasa">/.test(puasa) &&
  /<Kolom label="🙏 Pokok doa utama">/.test(puasa) &&
  /<Kolom label="📜 Peraturan puasa saya">/.test(puasa) &&
  /<Kolom label="Mulai puasa">/.test(puasa) &&
  /<Kolom label="Selesai puasa">/.test(puasa));
// SATU tombol simpan, di paling bawah. Dulu dua ("Simpan Perubahan" di tengah
// & "Simpan Jawaban Doa" di bawah) padahal keduanya memanggil fungsi yang
// sama dan menyimpan keenam kolomnya sekaligus.
ok('tinggal satu tombol simpan',
  /✅ Mulai Puasa/.test(puasa) && /💾 Simpan Perubahan/.test(puasa) &&
  !/Simpan Jawaban Doa/.test(puasa) &&
  (puasa.match(/<PrimaryButton/g) ?? []).length === 1);

console.log(gagal === 0
  ? '\n✅ LULUS — lima perbaikan tampilan, tanpa mengubah isinya.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
