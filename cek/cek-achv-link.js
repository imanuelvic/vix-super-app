// Tombol streak 🔥 → layar Reward dengan modal kategorinya SUDAH terbuka.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-achv');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Jalankan penyaring kategorinya sungguhan ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/reward.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  // Firestore & langganan tidak dipakai fungsi yang diuji — distub supaya
  // modulnya bisa dimuat tanpa jaringan/kunci API.
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {} };
  // Warna cuma dipakai tampilan; di sini yang diuji logikanya.
  if (req.startsWith('@/assets/style/color')) {
    return { Color: new Proxy({}, { get: () => '#000' }) };
  }
  if (req.startsWith('firebase/')) {
    return new Proxy({}, { get: () => () => ({}) });
  }
  return asli(req, parent, isMain);
};
const A = require(path.join(OUT, 'reward.js'));
Module._load = asli;

console.log('\n=== Penyaring kategori dari tautan ===');
ok('kunci yang sah diteruskan apa adanya',
  A.rewardCategoryOf('health') === 'health' &&
  A.rewardCategoryOf('login') === 'login' &&
  A.rewardCategoryOf('bibleNight') === 'bibleNight');
ok('SEMUA kategori yang ada di layar bisa dituju lewat tautan',
  A.REWARD_CATEGORIES.every((c) => A.rewardCategoryOf(c.key) === c.key),
  A.REWARD_CATEGORIES.map((c) => c.key).join(','));
ok('tanpa parameter → tidak ada modal yang dibuka',
  A.rewardCategoryOf(undefined) === null);
ok('parameter kosong → tidak ada modal yang dibuka',
  A.rewardCategoryOf('') === null);
ok('kunci ngawur/salah tulis → layarnya tetap terbuka biasa, tidak error',
  A.rewardCategoryOf('healt') === null &&
  A.rewardCategoryOf('kebiasaan') === null &&
  A.rewardCategoryOf('__proto__') === null &&
  A.rewardCategoryOf('constructor') === null);

// Rinciannya sekarang HALAMAN sendiri, bukan modal di layar daftar. Yang
// dijaga tetap sama: tautan berkategori mendarat langsung di kategorinya,
// tanpa singgah di daftar dan tanpa kedipan.
console.log('\n=== Halaman kategori membaca parameternya ===');
const layar = baca('app/reward-category.tsx');
ok('kategori dibaca dari parameter tautan',
  /const \{ cat \} = useLocalSearchParams<\{ cat\?: string \}>\(\);/.test(layar) &&
  /const key = rewardCategoryOf\(cat\);/.test(layar));
ok('dibaca saat render, bukan lewat efek — isinya ada sejak render pertama ' +
   '(tak ada kedipan halaman kosong dulu)',
  !/useEffect/.test(layar));
ok('kategori tak dikenal → halaman jujur, bukan layar rusak',
  /const meta = REWARD_CATEGORIES\.find\(\(c\) => c\.key === key\);/.test(layar) &&
  /if \(!meta\) \{/.test(layar));
ok('layar daftarnya sendiri tak lagi memuat modal kategori',
  !/openCat/.test(baca('app/reward.tsx')));

console.log('\n=== Pil 🔥 mengantar kategorinya ===');
const pil = baca('components/common/StreakPill.tsx');
ok('pil menerima kategori (opsional)',
  /category\?: RewardCategoryKey;/.test(pil));
ok('ada kategori → dikirim sebagai parameter cat ke halaman kategorinya',
  /pathname: '\/reward-category', params: \{ cat: category \}/.test(pil));
ok('tanpa kategori → tetap membuka daftar Reward biasa (pil umum 🏆 Home)',
  /: '\/reward',/.test(pil));

console.log('\n=== Tiap tombol menuju kategorinya sendiri ===');
const habits = baca('app/habits.tsx');
const dash = baca('app/reminders.tsx');
const home = baca('app/(tabs)/index.tsx');

ok('Habits: pil 🔥 → 🍎 Kebiasaan Sehat',
  /<StreakPill\s*\n\s*streak=\{activeStreak\(streak \?\? null, dayId\)\}\s*\n\s*category="health"/.test(habits));
ok('Dashboard: kolom ✅ Habits → 🍎 Kebiasaan Sehat',
  /pathname: '\/reward',\s*\n\s*params: \{ cat: 'health' \},/.test(dash));
ok('Dashboard: kolom 📖 Revive → daftar Reward (belum ada kategori Revive)',
  A.REWARD_CATEGORIES.every((c) => c.key !== 'revive'));
// 22 Sep 2026: pil 🏆🔥 Home dibuang bersama launcher-nya; pintu umum ke
// daftar Reward kini tile di tab Life (tanpa kategori).
ok('Life: tile Reward membuka daftarnya (memang tidak mewakili satu kategori)',
  /route: '\/reward'/.test(BACA_TODAY('lib/featureGrid.ts')) && !/🏆🔥/.test(home));

console.log('\n=== Dua kolom Dashboard: dua tombol bersaudara ===');
const iKartu = dash.indexOf('<View style={styles.streakCard}>');
const isiKartu = dash.slice(iKartu, dash.indexOf('</View>', dash.indexOf('Habits\n')));
ok('kartunya bukan lagi satu tombol besar', iKartu > -1);
ok('dua tombol terpisah di dalamnya',
  (isiKartu.match(/<PressableScale/g) ?? []).length === 2);
ok('tidak ada Pressable bersarang (di iOS tidak andal)',
  !/<PressableScale[\s\S]{0,400}<PressableScale/.test(isiKartu.replace(/<\/PressableScale>/g, '\n---\n').split('---')[0]));
ok('garis pemisahnya tetap ada di antara keduanya',
  /<View style=\{styles\.streakDivider\} \/>/.test(isiKartu));
ok('area click tetap selebar & setinggi kartunya (padding + margin negatif)',
  /paddingVertical: 18,\s*\n\s*marginVertical: -18,/.test(dash));
ok('tampilan kartunya tidak berubah (warna, sudut, padding tetap)',
  /streakCard: \{[\s\S]{0,220}backgroundColor: Color\.ACCENT,[\s\S]{0,160}paddingVertical: 18,/.test(dash));
ok('angka yang ditampilkan tidak berubah',
  /\{revive\?\.count \?\? 0\}/.test(dash) &&
  /\{activeStreak\(habitStreak, todayId\)\}/.test(dash));

console.log(gagal === 0
  ? '\n✅ LULUS — pil streak mendarat langsung di modal kategorinya.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
