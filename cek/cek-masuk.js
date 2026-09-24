// 🌊 Layar Masuk versi 2.0 (23 Sep 2026): sapaan besar, kartu mengambang,
// sakelar pil Masuk/Daftar, dan ombak warna utama di kaki layar.
// Logika autentikasinya TIDAK boleh berubah sedikit pun.
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

const login = baca('app/login.tsx');
const ombak = baca('components/auth/WelcomeWaves.tsx');
const pil = baca('components/auth/AuthToggle.tsx');

console.log('\n=== 1. Logika masuk/daftar TIDAK berubah ===');
ok('signIn & signUp dari contexts/auth, dipilih oleh mode yang sama',
  /const \{ signIn, signUp \} = useAuth\(\);/.test(login) &&
  /await signUp\(email, password\);/.test(login) && /await signIn\(email, password\);/.test(login));
ok('email pemilik tetap terisi otomatis dari EXPO_PUBLIC_OWNER_EMAIL',
  /useState\(process\.env\.EXPO_PUBLIC_OWNER_EMAIL \?\? ''\)/.test(login));
ok('kolom kosong ditolak sebelum menyentuh jaringan',
  /if \(!email \|\| !password\) \{\s*\n\s*setError\('Email dan password wajib diisi\.'\);/.test(login));
ok('kesembilan pesan galat Firebase masih dipetakan apa adanya',
  ['auth/invalid-email', 'auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found',
    'auth/email-already-in-use', 'auth/weak-password', 'auth/network-request-failed',
    'auth/invalid-api-key', 'auth/not-configured', 'auth/not-owner'].every((k) => login.includes(k)));
ok('peringatan .env belum diisi tetap ada', /!isFirebaseConfigured &&/.test(login) && /Firebase belum dikonfigurasi/.test(login));
ok('👁️ lihat password & ✕ hapus isinya tetap ada',
  /secureTextEntry=\{!showPassword\}/.test(login) && /name=\{showPassword \? 'eye\.slash' : 'eye'\}/.test(login) &&
  /onPress=\{\(\) => setPassword\(''\)\}/.test(login));
ok('tombolnya mati & berputar selama proses', /disabled=\{loading\}/.test(login) && /<ActivityIndicator color=\{Color\.TEXT_REVERSE\}/.test(login));
ok('tidak ada password/email yang ditulis ke penyimpanan mana pun',
  !/AsyncStorage/.test(login) && !/console\.log/.test(login));

console.log('\n=== 2. Sapaan yang menyambut ===');
ok('memakai sapaan jam yang SAMA dengan seluruh app (greetingText), bukan salinan',
  /import \{ greetingText \} from '@\/components\/common\/Greeting';/.test(login) &&
  /\{greetingText\(\)\}/.test(login));
ok('sapaannya huruf paling besar (display) & kalimat penyambut di bawahnya',
  /heading="display"/.test(login) && /Selamat datang kembali/.test(login));
ok('kalimatnya ikut berganti saat pindah ke Daftar', /isSignup\s*\n?\s*\? 'Satu akun untuk semuanya/.test(login));
ok('masuknya berurutan: sapaan dulu, kartunya menyusul',
  /hadirKartu\.value = withDelay\(140, withTiming\(1, gerak\)\)/.test(login));
ok('istilah: tanpa tekan/ketuk/tap/klik & tanpa em dash di string',
  !/\b(tekan|ditekan|menekan|ketuk|diketuk|tap|klik)\b/i.test(login.replace(/\/\/.*$/gm, '')) &&
  !/['"`][^'"`\n]*—[^'"`\n]*['"`]/.test(login.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')));

console.log('\n=== 3. Sakelar pil Masuk / Daftar ===');
ok('satu kartu, dua pilihan (bukan dua layar berbeda)', /<AuthToggle mode=\{mode\} onChange=\{setMode\}/.test(login));
ok('pilnya BERGESER ke pilihan yang aktif (translateX, bukan warna bertukar)',
  /transform: \[\{ translateX: geser\.value \* separuh \}\]/.test(pil) &&
  /withTiming\(mode === 'signup' \? 1 : 0/.test(pil));
ok('lebarnya diukur (onLayout), jadi pas di layar mana pun', /onLayout=\{ukur\}/.test(pil) && /e\.nativeEvent\.layout\.width/.test(pil));
ok('pilnya di BAWAH labelnya & tidak bisa disentuh', /<Animated\.View style=\{\[styles\.pil[\s\S]{0,80}pointerEvents="none"/.test(pil));
ok('warnanya dari palet app (MAIN + TEXT_REVERSE), bukan hex lepas',
  /backgroundColor: Color\.MAIN/.test(pil) && /color: Color\.TEXT_REVERSE/.test(pil) && !/#[0-9a-f]{6}/i.test(pil));

console.log('\n=== 4. Ombak warna utama ===');
ok('tiga lapis, kecepatan & arah berbeda (itu yang bikin terasa dalam)',
  (ombak.match(/<Lapis /g) ?? []).length === 3 && /arah=\{1\}/.test(ombak) && /arah=\{-1\}/.test(ombak));
ok('warnanya MAIN, kepekatannya yang berbeda', (ombak.match(/warna=\{Color\.MAIN\}/g) ?? []).length === 3 && !/#[0-9a-f]{6}/i.test(ombak));
ok('gelombangnya digambar dua kali lebar layar & berulang tiap satu lebar (lompatan baliknya tak kelihatan)',
  /width: lebar \* 2/.test(ombak) && /T \$\{w \* 2\} \$\{y\}/.test(ombak));
ok('putarannya tak berujung & rata (withRepeat -1, Easing.linear)',
  /withRepeat\(\s*\n?\s*withTiming\(akhir, \{ duration: durasi, easing: Easing\.linear \}\),\s*\n?\s*-1,/.test(ombak));
ok('ada napas naik-turun pelan di seluruh tumpukannya', /napas\.value = withRepeat\(/.test(ombak) && /translateY: \(1 - napas\.value\) \* 6/.test(ombak));
ok('berjalan di utas UI (Reanimated), tanpa setState & tanpa setInterval',
  !/setInterval|setTimeout/.test(ombak) && !/useState/.test(ombak));
ok('gambarnya tidak pernah mencuri sentuhan', /pointerEvents="none"/.test(ombak));
ok('ombaknya di lapis paling bawah layar Masuk', login.indexOf('<WelcomeWaves />') < login.indexOf('<KeyboardAvoidingView'));
ok('kartunya menyisakan ruang untuk ombak (tidak duduk di atas gelombang)',
  /paddingBottom: WAVE_HEIGHT \* 0\.42/.test(login));

console.log('\n=== 5. Rupa 2.0 ===');
ok('kartunya mengambang halus (SHADOW_SOFT) & tombolnya melayang (SHADOW_RAISED)',
  /\.\.\.SHADOW_SOFT,/.test(login) && /\.\.\.SHADOW_RAISED,/.test(login));
ok('semua warnanya dari assets/style/color.ts', !/#[0-9a-f]{3,8}\b/i.test(login));
ok('papan ketik tidak menutupi kolomnya (KeyboardAvoidingView + ScrollView)',
  /<KeyboardAvoidingView/.test(login) && /keyboardShouldPersistTaps="handled"/.test(login));
ok('layarnya ikut aturan tepi bawah app (edges top saja)', /edges=\{\['top'\]\}/.test(login));

console.log(gagal === 0 ? '\n✅ LULUS — layar Masuk baru, logikanya utuh.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
