// 15 Sep 2026 sore: papan Reward 🏆 — batang kemajuan tiap baris tiga
// petak SEJAJAR, dan urutan petaknya ditulis tangan per baris (Good Habit &
// Daily Steps naik ke baris pertama; tiga bacaan Alkitab berdampingan).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-papan-achv');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const lib = baca('lib/reward.ts');
const petak = baca('components/common/BadgeTile.tsx');
const layar = baca('app/reward.tsx');
const laman = baca('app/reward-category.tsx');
const grid = baca('lib/featureGrid.ts');

// ============ Urutan papan: dijalankan sungguhan ============
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
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {} };
  if (req.startsWith('@/assets/style/color')) {
    return { Color: new Proxy({}, { get: () => '#000' }) };
  }
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const A = require(path.join(OUT, 'reward.js'));
Module._load = asli;

console.log('\n=== Urutan petak: tiga-tiga per baris, persis seperti di layar ===');
const label = A.REWARD_CATEGORIES.map((c) => c.label);
const baris = (n) => label.slice(n * 3, n * 3 + 3).join(' | ');
ok('12 kategori, pas 4 baris × 3', label.length === 12, String(label.length));
ok('baris 1: Morning Prayer | Good Habit | Daily Steps',
  baris(0) === 'Morning Prayer | Good Habit | Daily Steps', baris(0));
ok('baris 2: Morning Reading | Midday Reading | Night Reading (kiri → tengah → kanan)',
  baris(1) === 'Morning Reading | Midday Reading | Night Reading', baris(1));
ok('baris 3: Distance | Weekly Steps | Weekly Strength',
  baris(2) === 'Distance | Weekly Steps | Weekly Strength', baris(2));
ok('baris 4: Water | Learning | Fitness',
  baris(3) === 'Water | Learning | Fitness', baris(3));
ok('urutannya ditulis PER BARIS di kode (bukan satu deret panjang)',
  /const PAPAN: RewardCategoryKey\[\]\[\] = \[\s*\n\s*\['login', 'health', 'steps'\],\s*\n\s*\['bibleMorning', 'bibleDaytime', 'bibleNight'\],\s*\n\s*\['run', 'week', 'strength'\],\s*\n\s*\['water', 'learning', 'fitness'\],\s*\n\];/.test(lib));
ok('kategori yang lupa ditaruh di papan jatuh ke BELAKANG, bukan hilang',
  /return i === -1 \? URUTAN_PAPAN\.length : i;/.test(lib) &&
  /\[\.\.\.CATEGORIES\]\.sort\(\s*\(a, b\) => papanIndex\(a\.key\) - papanIndex\(b\.key\),\s*\)/.test(lib));
ok('tiap kunci di papan memang kategori yang ada (tidak ada salah tulis)',
  [...lib.matchAll(/\['(\w+)', '(\w+)', '(\w+)'\]/g)].flatMap((m) => m.slice(1, 4))
    .every((k) => A.REWARD_CATEGORIES.some((c) => c.key === k)));

console.log('\n=== Bekas aturan lama (urut grid Home) benar-benar dicabut ===');
ok('kolom `feature` tak ada lagi di kategori', !/feature: '/.test(lib));
ok('rewards.ts tak lagi membaca lib/homeGrid', !/homeGrid/.test(lib));
const semua = ['app', 'components', 'lib', 'hooks'].flatMap(function jelajah(d) {
  const p = path.join(ROOT, d);
  return fs.readdirSync(p, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(path.join(d, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(d, e.name)] : []);
});
ok('homeFeatureIndex sudah tidak ada di mana pun (export mati ikut dibuang)',
  !semua.some((f) => /homeFeatureIndex/.test(baca(f))));
ok('HOME_FEATURES sendiri tetap ada untuk Home & Dashboard',
  /export const HOME_FEATURES: HomeFeature\[\] = \[\.\.\.FEATURES\]\.sort\(/.test(grid));

console.log('\n=== Batang kemajuan sebaris SEJAJAR ===');
ok('kaki petak dibungkus dan didorong ke dasar (marginTop auto)',
  /<View style=\{styles\.foot\}>\{children\}<\/View>/.test(petak) &&
  /foot: \{ marginTop: 'auto', alignSelf: 'stretch', alignItems: 'center' \}/.test(petak));
ok('petaknya TIDAK dikunci tingginya (supaya bisa direntang setinggi barisnya)',
  /tile: \{ width: '33\.33%', alignItems: 'center', paddingHorizontal: 4, gap: 4 \}/.test(petak));
ok('gridnya tidak menimpa alignItems (stretch bawaan yang merentang petak)',
  !/grid: \{[^}]*alignItems/.test(petak));
ok('batang kategori masih selebar petak & jadi anak BadgeTile',
  /catBar: \{\s*\n\s*width: '100%',/.test(layar) &&
  /<BadgeTile[\s\S]{0,400}<View style=\{styles\.catBar\}>/.test(layar));
ok('halaman kategori memakai petak yang sama (teks angkanya ikut sejajar)',
  /<BadgeTile[\s\S]{0,300}<VixText[\s\S]{0,200}✅ terbuka/.test(laman));
ok('judul tetap maksimal dua baris', /numberOfLines=\{2\}/.test(petak));

console.log(gagal === 0 ? '\n✅ LULUS — papan sejajar & urutannya sesuai permintaan.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
