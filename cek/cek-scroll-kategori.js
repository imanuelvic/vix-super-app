// Dua permintaan:
//   1. Indikator scroll (garis abu-abu) dihapus di modal & dialog — di foto ia
//      menabrak tombol ✕ sub-budget di modal 🎯 Set Budget
//   2. Dua kategori income baru: 🖥️ Side Hustle & 💎 Business
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-scroll-kategori');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/categories.ts',
      R + 'lib/budgets.ts',
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

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => {}, doc: () => {}, getDocs: async () => ({ docs: [] }),
      setDoc: () => Promise.resolve(), onSnapshot: () => {}, getDoc: () => {},
      deleteField: () => 'HAPUS', updateDoc: () => {},
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const kat = require(M('categories'));
const bud = require(M('budgets'));
Module._load = asli;

// =====================================================================
console.log('\n== 1. Indikator scroll di modal & dialog ==');
// =====================================================================
// Semua .tsx dipindai: ScrollView/FlatList yang berada DI DALAM SheetModal
// atau CenterDialog wajib menyembunyikan indikatornya. Dipindai, bukan
// didaftar dengan tangan — modal baru besok ikut terjaring sendiri.
const cariTsx = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? cariTsx(p) : e.name.endsWith('.tsx') ? [p] : [];
  });

const dalamModal = [];
for (const p of [...cariTsx(R + 'app'), ...cariTsx(R + 'components')]) {
  const baris = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  let dalam = 0;
  baris.forEach((ln, i) => {
    if (/<(SheetModal|CenterDialog)\b/.test(ln)) dalam++;
    if (/<\/(SheetModal|CenterDialog)>/.test(ln)) { dalam--; return; }
    if (dalam > 0 && /<(ScrollView|FlatList)\b/.test(ln)) {
      dalamModal.push({
        f: p.replace(/\\/g, '/').replace(R, '') + ':' + (i + 1),
        sembunyi: /showsVerticalScrollIndicator=\{false\}/.test(
          baris.slice(i, i + 8).join('\n'),
        ),
      });
    }
  });
}
c('memang ada isi modal yang bisa digulir untuk diperiksa',
  dalamModal.length >= 12, dalamModal.length);
const lolos = dalamModal.filter((x) => !x.sembunyi);
c(`${dalamModal.length} penggulung di dalam modal/dialog menyembunyikan indikatornya`,
  lolos.length === 0, lolos.map((x) => x.f).join(', '));

// Modal 🎯 Set Budget — yang ada di foto. Indikatornya persis menimpa tombol ✕
// tiap baris sub-budget, jadi ini yang paling wajib.
const bt = baca('components/finance/BudgetingTab.tsx');
c('daftar sub-budget di modal 🎯 Set Budget ikut bersih',
  /<ScrollView\s+style=\{styles\.subScroll\}\s+nestedScrollEnabled\s+showsVerticalScrollIndicator=\{false\}>/
    .test(bt.replace(/\r\n/g, '\n')));
c('sub-budget tetap bisa digulir sendiri di dalam modal (nestedScrollEnabled)',
  /nestedScrollEnabled/.test(bt));

// SheetModal menggulir isinya sendiri — kalau ia memunculkan indikator lagi,
// semua sheet ikut bergaris walau anaknya sudah bersih.
c('penggulung bawaan SheetModal juga menyembunyikan indikatornya',
  /showsVerticalScrollIndicator=\{false\}/.test(baca('components/common/SheetModal.tsx')));

// Yang SENGAJA dibiarkan: tiga daftar panjang yang dulu justru dibuat
// scrollbar-nya hitam & selalu tampil. Di daftar ratusan transaksi, itu
// satu-satunya penunjuk "aku ada di mana" — dan itu bukan modal.
const TETAP = [
  ['components/finance/TransactionsTab.tsx', 'daftar transaksi'],
  ['app/saku/[key].tsx', 'detail fund'],
  ['components/fun/FunArchive.tsx', 'arsip Fun'],
];
for (const [f, nama] of TETAP) {
  const src = baca(f).replace(/\r\n/g, '\n');
  c(`${nama.padEnd(17)} tetap punya scrollbar yang terlihat (bukan modal)`,
    /showsVerticalScrollIndicator\n/.test(src) &&
    /persistentScrollbar/.test(src) && /indicatorStyle="black"/.test(src));
}

// Baris chip mendatar sudah lama menyembunyikan indikatornya — jangan sampai
// ikut terbalik saat menyapu.
c('baris chip mendatar tetap tanpa indikator',
  /showsHorizontalScrollIndicator=\{false\}/.test(baca('components/common/ChipRow.tsx')));

// =====================================================================
console.log('\n== 2. Dua kategori income baru ==');
// =====================================================================
const income = kat.FINANCE_CATEGORIES.income;
const aktif = kat.activeCategories('income');
const kunciIncome = income.map((x) => x.key);

const cariKat = (k) => income.find((x) => x.key === k);
c('🖥️ Side Hustle ada & aktif',
  !!cariKat('side-hustle') && cariKat('side-hustle').label === 'Side Hustle' &&
  cariKat('side-hustle').icon === '🖥️' && cariKat('side-hustle').active === true);
c('💎 Business ada & aktif',
  !!cariKat('business') && cariKat('business').label === 'Business' &&
  cariKat('business').icon === '💎' && cariKat('business').active === true);
c('keduanya benar-benar muncul di pilihan saat menambah transaksi',
  aktif.some((x) => x.key === 'side-hustle') && aktif.some((x) => x.key === 'business'));

// Ditaruh di EKOR. Kalau disisipkan di tengah, kartu budget lama ikut bergeser
// tempatnya tiap kali kategori baru ditambah — membingungkan tanpa alasan.
c('ditambahkan di ekor, urutan kategori lama tak bergeser',
  kunciIncome.slice(0, 6).join(' · ') ===
    'ndc-salary · ndc-incentive · agent-commissions · preloved · trading-crypto · ndc-bonus',
  kunciIncome.join(' · '));
c('dua yang baru berurutan: Side Hustle lalu Business',
  kunciIncome.slice(-2).join(' · ') === 'side-hustle · business',
  kunciIncome.slice(-2).join(' · '));

// key = id yang tersimpan di Firestore. Kalau bentrok dengan yang sudah ada,
// budget & transaksi dua kategori berbeda akan saling menimpa.
const semuaKunci = kat.FINANCE_TYPES.flatMap((t) =>
  kat.FINANCE_CATEGORIES[t].map((x) => `${t}:${x.key}`),
);
c('tak ada key kembar di seluruh jenis',
  new Set(semuaKunci).size === semuaKunci.length,
  semuaKunci.length - new Set(semuaKunci).size + ' kembar');
c('key budget-nya berdiri sendiri (income:business ≠ saving:business-capital)',
  bud.budgetKey('income', 'business') === 'income:business' &&
  bud.budgetKey('income', 'business') !== bud.budgetKey('saving', 'business-capital'));

// Kalau key-nya sampai salah ketik, transaksinya tampil sebagai "❓".
c('kategori tersimpan terbaca balik dengan nama & ikonnya',
  kat.categoryOf('income', 'side-hustle').icon === '🖥️' &&
  kat.categoryOf('income', 'business').label === 'Business' &&
  kat.categoryOf('income', 'business').icon !== '❓');

// Keduanya kategori baru — jangan sampai ikut terdaftar sebagai yang dihapus.
c('bukan termasuk kategori yang dibuang dari budget',
  !bud.REMOVED_BUDGET_KEYS.some(
    (k) => k === 'income:side-hustle' || k === 'income:business',
  ));

console.log('\n' + (ok ? 'LULUS: semua benar.' : 'GAGAL: ada yang tidak cocok.'));
process.exit(ok ? 0 : 1);