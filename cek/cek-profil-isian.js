// Modal 👤 Edit Profile: kolom yang jawabannya pasti tidak lagi diketik bebas —
// tanggal lahir lewat date picker, agama/golongan darah/status perkawinan
// lewat daftar pilihan, kolom angka lewat papan angka. Plus foto profil bisa
// diganti langsung dari lingkaran di atas nama.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-profil-isian');
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
      R + 'lib/profile.ts',
      R + 'lib/health.ts',
      R + 'components/common/SelectField.tsx',
      '--outDir', OUT,
      '--jsx', 'react-jsx',
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (rel) => {
  const p = path.join(OUT, ...rel.split('/'));
  if (!fs.existsSync(p)) {
    console.log(`  ✗ gagal mengompilasi ${rel}`);
    process.exit(1);
  }
  return p;
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
  if (req === 'react-native') {
    return { StyleSheet: { create: (o) => o }, View: 'View', ScrollView: 'ScrollView' };
  }
  if (req === 'react-native-reanimated') {
    return {
      default: { View: 'AView' },
      FadeInUp: { duration: () => ({}) },
      useAnimatedStyle: () => ({}),
      useSharedValue: () => ({ value: 0 }),
      withTiming: () => 0,
    };
  }
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (req === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' };
  if (req === 'react') return { useState: () => [null, () => {}], useEffect: () => {} };
  if (/PressableScale$/.test(req)) return { PressableScale: 'PressableScale' };
  if (/VixText$/.test(req)) return { VixText: 'VixText' };
  if (/icon-symbol$/.test(req)) return { IconSymbol: 'IconSymbol' };
  if (/^(expo-|expo$|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const fmt = require(M('lib/format.js'));
const prof = require(M('lib/profile.js'));
const health = require(M('lib/health.js'));
const sel = require(M('components/common/SelectField.js'));

const layar = baca('app/profile.tsx');
const dateField = baca('components/common/DateField.tsx');

console.log('\n== 1. Tanggal lahir: dibaca balik dari teks tersimpan ==');

c('teks yang sudah tersimpan terbaca jadi tanggal', (() => {
  const d = fmt.parseLongDate('1 Januari 1998');
  return d && d.getFullYear() === 1998 && d.getMonth() === 0 && d.getDate() === 1;
})());
c('bolak-balik lewat formatDate tidak berubah', (() => {
  const d = new Date(1998, 0, 1);
  return fmt.formatDate(fmt.parseLongDate(fmt.formatDate(d))) === '1 Januari 1998';
})());
c('kedua belas bulan terbaca', (() => {
  for (let m = 0; m < 12; m++) {
    const teks = fmt.formatDate(new Date(2026, m, 15));
    const d = fmt.parseLongDate(teks);
    if (!d || d.getMonth() !== m) return false;
  }
  return true;
})());
c('tanggal yang TIDAK ADA ditolak, bukan digeser diam-diam',
  fmt.parseLongDate('31 Februari 2026') === null,
  String(fmt.parseLongDate('31 Februari 2026')));
c('kolom kosong / tulisan ngawur → null',
  fmt.parseLongDate('') === null &&
  fmt.parseLongDate('besok') === null &&
  fmt.parseLongDate('1 Januarix 1998') === null);
c('huruf besar-kecil tak jadi soal', (() => {
  const d = fmt.parseLongDate('17 agustus 1945');
  return d && d.getMonth() === 7 && d.getDate() === 17;
})());
// Tahun WAJIB 4 angka. "1 Januari 98" yang lolos akan jadi tahun 98 Masehi —
// tanggalnya terbaca "berhasil" padahal ngawur, jadi lebih baik ditolak.
c('tahun 2 angka ditolak, tidak ditebak jadi 1998',
  fmt.parseLongDate('1 Januari 98') === null &&
  fmt.parseLongDate('1 Januari 199') === null,
  String(fmt.parseLongDate('1 Januari 98')));

// Kolomnya tetap MENYIMPAN teks tampilan — jadi data lama tidak perlu dipindah.
c('yang disimpan tetap teks tampilan, bukan format baru',
  /\[f\.key\]: formatDate\(d\)/.test(layar) && !/dayDocId\(d\)/.test(layar));
c('rodanya diisi dari teks tersimpan itu juga',
  /value=\{parseLongDate\(form\[f\.key\]\)\}/.test(layar));
c('lahir di masa depan tidak bisa dipilih',
  /maximumDate=\{new Date\(\)\}/.test(layar));

console.log('\n== 2. Kolom kosong tidak berpura-pura sudah terisi ==');

c('DateField menerima "belum diisi" (null)', /value: Date \| null/.test(dateField));
c('yang null menampilkan tulisan pengganti, bukan tanggal hari ini',
  /value \? formatFullDate\(value\) : \(placeholder \?\? /.test(dateField));
c('warnanya ikut redup seperti placeholder kolom lain',
  /value \? styles\.text : styles\.placeholder/.test(dateField));
c('roda picker tetap berdiri di suatu tanggal',
  /const shown = value \?\? maximumDate \?\? new Date\(\);/.test(dateField) &&
  /value=\{shown\}/.test(dateField));
c('batas tanggal diteruskan ke pickernya',
  /maximumDate=\{maximumDate\}/.test(dateField) && /minimumDate=\{minimumDate\}/.test(dateField));
c('kolom kosong tak punya jam untuk dipertahankan',
  /value \? mergeDate\(value, selected\) : selected/.test(dateField));
c('layar Profil memberi tulisan penggantinya',
  /placeholder="Pilih tanggal lahir"/.test(layar));

console.log('\n== 3. Daftar pilihan yang benar ==');

const AGAMA = ['Islam', 'Kristen Protestan', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu'];
c('enam agama yang diakui negara ada semua',
  AGAMA.every((a) => prof.RELIGIONS.includes(a)), prof.RELIGIONS.join(' · '));
c('Kepercayaan ikut (boleh di KTP sejak 2017)', prof.RELIGIONS.includes('Kepercayaan'));
c('tidak ada yang dobel',
  new Set(prof.RELIGIONS).size === prof.RELIGIONS.length);

c('empat status perkawinan sesuai KTP',
  JSON.stringify(prof.MARITAL_STATUSES) ===
    JSON.stringify(['Belum kawin', 'Kawin', 'Cerai hidup', 'Cerai mati']),
  prof.MARITAL_STATUSES.join(' · '));
c('jenis kelamin ikut bahasa app ini',
  JSON.stringify(prof.GENDERS) === JSON.stringify(['Cowok', 'Cewek']));

c('golongan darah TIDAK ditulis ulang — pakai daftar Data Tubuh',
  JSON.stringify(health.BLOOD_TYPES) === JSON.stringify(['A', 'B', 'AB', 'O']) &&
  /options: BLOOD_TYPES/.test(layar) &&
  /from '@\/lib\/health'/.test(layar));
// Komentarnya sendiri MENYEBUT BLOOD_TYPES (menjelaskan kenapa tak ditulis
// ulang di sana), jadi yang diperiksa kodenya saja — bukan seluruh berkas.
const profSrc = baca('lib/profile.ts').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
c('lib/profile tidak punya daftar golongan darah sendiri',
  !/export const \w*BLOOD/i.test(profSrc) && !/\['A', 'B', 'AB', 'O'\]/.test(profSrc));

console.log('\n== 4. Isian lama tidak hilang begitu daftarnya dibakukan ==');

// Persis keadaan di HP: tersimpan "Tidak kawin", sedangkan daftar bakunya
// berbunyi "Belum kawin".
const dgnLama = sel.textOptions(prof.MARITAL_STATUSES, 'Tidak kawin');
c('isian lama tetap muncul sebagai pilihan',
  dgnLama.some((o) => o.key === 'Tidak kawin'),
  dgnLama.map((o) => o.key).join(' · '));
c('ditandai supaya jelas itu bukan pilihan baku',
  dgnLama.find((o) => o.key === 'Tidak kawin').sub === 'isian lama');
c('ia ditaruh paling belakang, bukan menggeser daftar bakunya',
  dgnLama[dgnLama.length - 1].key === 'Tidak kawin' &&
  dgnLama[0].key === 'Belum kawin');
c('isian yang SUDAH baku tidak digandakan',
  sel.textOptions(prof.MARITAL_STATUSES, 'Kawin').length ===
    prof.MARITAL_STATUSES.length);
c('kolom kosong tidak menambah pilihan hantu',
  sel.textOptions(prof.RELIGIONS, '').length === prof.RELIGIONS.length &&
  sel.textOptions(prof.RELIGIONS, '   ').length === prof.RELIGIONS.length);
c('layar Profil memang memakainya', /options=\{textOptions\(f\.options, form\[f\.key\]\)\}/.test(layar));

console.log('\n== 5. Kolom mana pakai bentuk apa ==');

// 22 Sep 2026: labelnya dikapitalkan sendiri oleh pemilik app ("🎂 Tanggal Lahir").
c('tanggal lahir → date picker', /\{ key: 'birthDate', label: '🎂 Tanggal Lahir', date: true \}/.test(layar));
const berdaftar = ['gender', 'religion', 'bloodType', 'maritalStatus'];
const tanpaDaftar = berdaftar.filter(
  (k) => !new RegExp(`key: '${k}'[^}]*options:`).test(layar),
);
c('jenis kelamin, agama, golongan darah, & status perkawinan pakai daftar',
  tanpaDaftar.length === 0, tanpaDaftar.join(', '));

c('modalnya benar-benar menggambar ketiga bentuk itu',
  /f\.date \? \(/.test(layar) && /<DateField/.test(layar) &&
  /\) : f\.options \? \(/.test(layar) && /<SelectField/.test(layar) &&
  /<FormInput/.test(layar));

console.log('\n== 6. Kolom angka pakai papan angka ==');

const ANGKA = ['nik', 'kk', 'npwp', 'bpjs'];
const bukanAngka = ANGKA.filter(
  (k) => !new RegExp(`key: '${k}'[\\s\\S]{0,90}?keyboard: 'number-pad'`).test(layar),
);
c('NIK, KK, NPWP, & BPJS pakai papan angka', bukanAngka.length === 0, bukanAngka.join(', '));
c('📱 No. HP pakai papan telepon', /key: 'phone'[\s\S]{0,60}keyboard: 'phone-pad'/.test(layar));
c('email pakai papan email & tidak dikapitalkan otomatis',
  /key: 'email'[\s\S]{0,90}keyboard: 'email-address', lowercase: true/.test(layar) &&
  /autoCapitalize=\{f\.lowercase \? 'none' : undefined\}/.test(layar));
c('paspor TIDAK dipaksa angka (nomornya berhuruf, mis. C1234567)',
  /\{ key: 'passport', label: '🛂 No\. Paspor' \}/.test(layar));

c('panjang NIK & KK dipatok 16, BPJS 13',
  /key: 'nik'[\s\S]{0,110}maxLength: 16/.test(layar) &&
  /key: 'kk'[\s\S]{0,140}maxLength: 16/.test(layar) &&
  /key: 'bpjs'[\s\S]{0,140}maxLength: 13/.test(layar) &&
  /maxLength=\{f\.maxLength\}/.test(layar));
c('NPWP sengaja TIDAK dipatok (masa peralihan 15 → 16 digit)',
  !/key: 'npwp'[\s\S]{0,90}maxLength/.test(layar));

console.log('\n== 7. Foto profil dari lingkaran di atas nama ==');

c('lingkarannya jadi tombol', /style=\{styles\.avatar\}\s*\n\s*onPress=\{handleHeroPhoto\}/.test(layar));
c('langsung tersimpan, tanpa lewat modal Ubah',
  /const photo = await pickCompressedPhoto\(\);\s*\n\s*if \(photo\) await saveProfile\(user\.uid, \{ \.\.\.profile, photo \}\);/.test(layar));
c('memakai pemilih foto bersama (sudah dikompres & dipotong kotak)',
  /pickCompressedPhoto/.test(layar) &&
  /pickCompressedImage\(\{ width: 144, compress: 0\.5, square: true \}\)/.test(baca('lib/family.ts')));
c('ada lencana 📷 supaya kelihatan bisa ditekan',
  /styles\.avatarBadge/.test(layar) && /name="camera\.fill"/.test(layar));
c('lencananya di LUAR lingkaran — lingkarannya memotong isinya',
  /avatarWrap: \{ marginBottom: 4 \}/.test(layar) &&
  /<View style=\{styles\.avatarBadge\} pointerEvents="none">/.test(layar) &&
  /avatarBadge: \{\s*\n\s*position: 'absolute'/.test(layar));
c('sedang mengambil foto → lingkarannya berputar, tombolnya mati',
  /foto\.busy === 'hero' \? \(/.test(layar) &&
  /disabled=\{foto\.busy !== null\}/.test(layar));
c('kotak foto di dalam modal Ubah tetap ada (dua jalan, satu hasil)',
  /styles\.photoPicker/.test(layar) && /onPress=\{handlePickPhoto\}/.test(layar));
c('keduanya punya kunci sibuk sendiri, tak saling berputar',
  /useBusyTask<'modal' \| 'hero'>\(\)/.test(layar) &&
  /const photoBusy = foto\.busy === 'modal';/.test(layar));
c('gagal ganti foto sekarang kelihatan (dulu pesannya tak pernah tergambar)',
  /fail: \(\) => setError\(PHOTO_ERROR\)/.test(layar) &&
  /<FormError message=\{error\} gap="none" additionalStyle=\{styles\.contentError\} \/>/.test(layar));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);