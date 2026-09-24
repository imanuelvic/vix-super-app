// Dua permintaan:
//   1. Nama bulan di rentang tanggal tab System cukup 3 huruf
//   2. Membuka Residence mendarat di sub-tab Token, bukan Maintenance
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-bulan-singkat');
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const { ukurHeading } = require('./ukur-teks.js');

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
      R + 'lib/usage.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => {}, doc: () => {}, getDoc: () => {}, getDocs: () => {},
      increment: () => {}, query: () => {}, setDoc: () => {}, where: () => {},
      writeBatch: () => {},
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  if (/\/health$/.test(req)) return { dayDocId: (d) => d.toISOString().slice(0, 10) };
  return asli.call(this, req, parent, isMain);
})(Module._load);

const fmt = require(M('format'));
const use = require(M('usage'));

console.log('\n== 1. Nama bulan 3 huruf ==');

const HARAP = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const salah = HARAP.map((h, i) => [h, fmt.monthShort(new Date(2026, i, 15))])
  .filter(([h, dapat]) => h !== dapat)
  .map(([h, dapat]) => `${h}≠${dapat}`);
c('kedua belas bulan benar singkatannya', salah.length === 0, salah.join(', '));
c('semuanya tepat 3 huruf',
  HARAP.every((_, i) => fmt.monthShort(new Date(2026, i, 1)).length === 3));

// Senin 31 Agustus 2026 — persis keadaan di layar yang dikeluhkan.
c('rentang minggu lintas bulan jadi singkat',
  use.formatWeekRange(new Date(2026, 7, 31)) === '31 Agu – 6 Sep',
  use.formatWeekRange(new Date(2026, 7, 31)));
c('rentang minggu dalam satu bulan cukup sebut bulannya sekali',
  use.formatWeekRange(new Date(2026, 7, 12)) === '10–16 Agu',
  use.formatWeekRange(new Date(2026, 7, 12)));
c('rentang minggu lintas TAHUN tetap benar',
  use.formatWeekRange(new Date(2026, 11, 31)) === '28 Des – 3 Jan',
  use.formatWeekRange(new Date(2026, 11, 31)));
c('rentang bulan berjalan jadi singkat',
  use.formatMonthRange(new Date(2026, 7, 31)) === '1–31 Agu',
  use.formatMonthRange(new Date(2026, 7, 31)));
c('rentang bulan menyebut tanggal HARI INI, bukan akhir bulan',
  use.formatMonthRange(new Date(2026, 7, 21)) === '1–21 Agu');

console.log('\n== 2. Itulah sebabnya: kartunya cuma setengah lebar ==');

// iPhone 15: 393 − 40 (padding layar) − 10 (gap antar-kartu) ÷ 2 − 32 (padding kartu)
const MUAT = (393 - 40 - 10) / 2 - 32;
const lebar = (t) => ukurHeading(t, 'label').lebar;

c('bentuk LAMA memang tidak muat sebaris (itu yang bikin terpotong)',
  lebar('🗓️ 31 Agustus – 6 September') > MUAT,
  `${lebar('🗓️ 31 Agustus – 6 September').toFixed(1)}pt dari ${MUAT.toFixed(1)}pt`);

const kasusTerpanjang = [
  new Date(2026, 7, 31), // 31 Agu – 6 Sep
  new Date(2026, 8, 28), // 28 Sep – 4 Okt
  new Date(2026, 10, 30), // 30 Nov – 6 Des
  new Date(2026, 11, 31), // 28 Des – 3 Jan
];
const pecah = kasusTerpanjang
  .map((d) => `🗓️ ${use.formatWeekRange(d)}`)
  .filter((t) => lebar(t) > MUAT);
c('semua bentuk baru muat sebaris di kartu setengah lebar', pecah.length === 0, pecah.join(', '));

const pecahBulan = [0, 8, 10, 11]
  .map((m) => `🗓️ ${use.formatMonthRange(new Date(2026, m, 30))}`)
  .filter((t) => lebar(t) > MUAT);
c('rentang bulannya juga muat', pecahBulan.length === 0, pecahBulan.join(', '));

c('keterangan di bawahnya jadi kebagian ruang lagi',
  lebar('reset tiap tanggal 1') <= MUAT && lebar('Sen–Min') <= MUAT);

console.log('\n== 3. Yang TIDAK ikut dipendekkan ==');

c('judul kartu tetap menyebut nama bulan penuh',
  fmt.monthLabel(new Date(2026, 7, 1)) === 'Agustus');
c('layar System masih memakai nama panjang untuk judulnya',
  /📊 Bulan \{thisMonth\}/.test(baca('app/system.tsx')));
c('"Pemakaian bulan Agustus" di Air-Listrik tidak berubah',
  /Pemakaian bulan \{monthLabel\(now\)\}/.test(baca('components/residence/UtilityTab.tsx')));

// Tanggal ringkas yang MEMANG sudah 3 huruf sejak dulu — bunyinya harus persis
// sama, karena sekarang ikut lewat monthShort.
c('formatShortDayDate tidak bergeser',
  fmt.formatShortDayDate(new Date(2026, 7, 31)) === 'Sen, 31 Agu 2026',
  fmt.formatShortDayDate(new Date(2026, 7, 31)));
c('formatCompactDate tidak bergeser',
  fmt.formatCompactDate(new Date(2026, 7, 16)) === 'Min, 16 Agu 26',
  fmt.formatCompactDate(new Date(2026, 7, 16)));
c('formatGreetingDate tidak bergeser',
  fmt.formatGreetingDate(new Date(2026, 7, 12)) === 'Rabu, 12 Agu 26',
  fmt.formatGreetingDate(new Date(2026, 7, 12)));
c('formatDate (nama panjang) tidak ikut dipendekkan',
  fmt.formatDate(new Date(2026, 7, 12)) === '12 Agustus 2026',
  fmt.formatDate(new Date(2026, 7, 12)));

const fmtSrc = baca('lib/format.ts');
c('pemotongan 3 huruf cuma ditulis SEKALI, di monthShort',
  (fmtSrc.match(/MONTH_NAMES\[[^\]]+\]\.slice\(0, 3\)/g) || []).length === 1);
c('usage.ts tak lagi menyusun nama bulannya sendiri',
  !/MONTH_NAMES/.test(baca('lib/usage.ts')));

console.log('\n== 4. Residence mendarat di Token ==');

const res = baca('app/residence.tsx');
// Bawaannya TETAP Token; yang ditambah cuma `tabs`, supaya reminder
// Perawatan di Dashboard bisa menuju sub-tab Maintenance lewat ?tab=.
c('sub-tab pembukanya Token',
  res.includes("useTabScroll<ResidenceTab>('token', {") &&
  res.includes('tabs: TABS,'));
c('bukan Maintenance lagi', !/useTabScroll<ResidenceTab>\('chores'\)/.test(res));
c('kelima sub-tabnya tetap ada & urutannya tidak digeser',
  /key: 'log'[\s\S]*key: 'utility'[\s\S]*key: 'token'[\s\S]*key: 'chores'[\s\S]*key: 'info'/.test(res));
c('Maintenance tetap bisa dituju (masih di daftar tab)',
  /\{ key: 'chores', label: 'Maintenance'/.test(res));
c('tagihan Perawatan tetap terlihat lewat badge merahnya',
  /chores: countResidenceAttention\(chores \?\? \{\}, new Date\(\)\)/.test(res));
c('badge Token juga tetap ada (catat meteran hari ini)',
  /token: readingDue\(readings \?\? \[\], new Date\(\)\) \? 1 : 0/.test(res));
c('Maintenance tetap melompat ke yang jatuh tempo (sekarang tiap dibuka)',
  /<ChoreTab status=\{chores\} \/>/.test(res) &&
    /useDueJump\(/.test(baca('components/common/UpkeepList.tsx')));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);