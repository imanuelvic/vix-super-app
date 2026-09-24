// Buktikan penyebab beda angka Budget: Dashboard 14,7 jt vs Budgeting 8,45 jt.
// Rumus LAMA Dashboard dibandingkan langsung dengan rumus barunya, memakai
// fungsi ASLI dari lib/budgets.ts + daftar kategori ASLI dari lib/categories.ts.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };
const rp = (n) => 'Rp' + n.toLocaleString('id-ID');

function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(mod.exports, mod, ...nama.map((n) => luar[n]));
  return mod.exports;
}

// Daftar kategori ASLI (Color cuma dipakai untuk warna, distub).
const categories = muat(
  baca('lib/categories.ts').replace(/^import[\s\S]*?from '[^']+';\n/gm, ''),
  { Color: new Proxy({}, { get: () => '#000' }) },
);
const { FINANCE_CATEGORIES } = categories;

// Ambil budgetKey + totalBudgetOf apa adanya dari lib/budgets.ts.
const src = baca('lib/budgets.ts');
const potong = (nama) => {
  const a = src.indexOf(`export function ${nama}`);
  const b = src.indexOf('\n}', a) + 2;
  return src.slice(a, b).replace('export function', 'function');
};
const budgets = muat(
  potong('budgetKey') + potong('subBudgetKey') + potong('totalBudgetOf') +
    '\nexport { budgetKey, subBudgetKey, totalBudgetOf };',
  { FINANCE_CATEGORIES },
);
const { budgetKey, subBudgetKey, totalBudgetOf } = budgets;

// ---------- Rumus LAMA Dashboard, disalin persis dari sumber sebelum diperbaiki ----------
function totalLama(allocations, type) {
  let planned = 0;
  for (const [key, value] of Object.entries(allocations)) {
    if (key.startsWith(`${type}:`)) planned += value;
  }
  return planned;
}
// Rumus layar Budgeting: jumlah kolom `allocated` semua BARIS yang tampil.
function totalBaris(allocations, type, realisasi = {}) {
  return FINANCE_CATEGORIES[type]
    .map((c2) => ({
      cat: c2,
      allocated: allocations[budgetKey(type, c2.key)] ?? 0,
      realized: realisasi[budgetKey(type, c2.key)] ?? 0,
    }))
    .filter((r) => r.cat.active || r.allocated > 0 || r.realized > 0)
    .reduce((s, r) => s + r.allocated, 0);
}

// ---------- Data contoh, disusun mengikuti angka di layar Budgeting ----------
// Food Drink & Transportation memakai sub-budget (4 sub, seperti di foto);
// nominal kategorinya = TOTAL sub-nya, persis aturan roll-up BudgetingTab.
const alokasi = {};
function pasangKategori(kunci, nominal, subs = null) {
  alokasi[budgetKey('expense', kunci)] = nominal;
  if (subs) for (const [s, v] of Object.entries(subs)) {
    alokasi[subBudgetKey('expense', kunci, s)] = v;
  }
}
pasangKategori('food-drink', 1_950_000, { sarapan: 600_000, 'makan-siang': 700_000, 'makan-malam': 500_000, kopi: 150_000 });
pasangKategori('transportation', 1_800_000, { bensin: 1_000_000, tol: 300_000, parkir: 200_000, ojol: 300_000 });
pasangKategori('travel', 0);
pasangKategori('groceries', 1_500_000, { beras: 500_000, telur: 400_000, sabun: 300_000, lain: 300_000 });
pasangKategori('snacks', 1_000_000, { 'cemilan-kantor': 600_000, 'cemilan-rumah': 400_000 });
pasangKategori('rent', 1_500_000);
pasangKategori('gathering-core', 400_000);
pasangKategori('insurance', 300_000);

const KATEGORI = 8_450_000; // total budget kategori (yang tampil di Budgeting)
const SUB = Object.entries(alokasi)
  .filter(([k]) => k.split(':').length === 3)
  .reduce((s, [, v]) => s + v, 0);

console.log('=== Data contoh (meniru angka di foto) ===');
console.log(`  total budget kategori          ${rp(KATEGORI)}`);
console.log(`  total nominal sub-budget       ${rp(SUB)}   ← sudah termasuk di angka atas`);
c('total kategorinya memang 8.450.000', totalBaris(alokasi, 'expense') === KATEGORI);

console.log('\n=== Dari mana angka Dashboard yang lama ===');
const lama = totalLama(alokasi, 'expense');
console.log(`  rumus lama  = ${rp(lama)}`);
console.log(`  seharusnya  = ${rp(KATEGORI)}`);
console.log(`  selisih     = ${rp(lama - KATEGORI)}  (persis = total sub-budget)`);
c('rumus lama menghitung sub-budget DUA KALI', lama === KATEGORI + SUB);
c('makin banyak sub, makin melenceng', lama > KATEGORI);

console.log('\n=== Sesudah diperbaiki ===');
c('Dashboard = Budgeting, angka yang sama',
  totalBudgetOf(alokasi, 'expense') === totalBaris(alokasi, 'expense'));
c(`hasilnya ${rp(KATEGORI)}`, totalBudgetOf(alokasi, 'expense') === KATEGORI);
c('key sub-budget tidak ikut dijumlah',
  totalBudgetOf(alokasi, 'expense') === KATEGORI &&
    Object.keys(alokasi).some((k) => k.split(':').length === 3));

console.log('\n=== Hal lain yang ikut terjaga ===');
// Sisa alokasi milik kategori yang sudah tidak ada di daftar → tak boleh
// diam-diam menambah angka, karena di layar Budgeting pun ia tak muncul.
const denganSampah = { ...alokasi, 'expense:kategori-yang-sudah-dihapus': 5_000_000 };
c('alokasi kategori yang sudah tidak ada diabaikan',
  totalBudgetOf(denganSampah, 'expense') === KATEGORI &&
    totalLama(denganSampah, 'expense') === lama + 5_000_000);
c('jenis lain tidak tercampur (saving/investment terpisah)',
  totalBudgetOf({ ...alokasi, 'saving:car-fund': 9_000_000 }, 'expense') === KATEGORI &&
    totalBudgetOf({ ...alokasi, 'saving:car-fund': 9_000_000 }, 'saving') === 9_000_000);
c('map kosong → 0', totalBudgetOf({}, 'expense') === 0);
c('kategori nonaktif yang masih punya budget tetap dihitung',
  (() => {
    const nonaktif = FINANCE_CATEGORIES.income.find((x) => !x.active);
    if (!nonaktif) return true; // tidak ada kategori nonaktif → tak ada yang diuji
    return totalBudgetOf({ [budgetKey('income', nonaktif.key)]: 700_000 }, 'income') === 700_000;
  })());

console.log('\n=== Kedua layar memakai SATU rumus ===');
// 22 Sep 2026: isi Dashboard lama (Budget vs Realisasi) pindah ke MonthDetails.
const dt = baca('components/finance/MonthDetails.tsx');
const bt = baca('components/finance/BudgetingTab.tsx');
c('MonthDetails (rincian Dashboard) memanggil totalBudgetOf', /planned: totalBudgetOf\(budget, p\.key\)/.test(dt));
c('MonthDetails tak lagi menyapu key sendiri', !/startsWith\(`\$\{p\.key\}:`\)/.test(dt));
c('BudgetingTab memanggil totalBudgetOf', /const totalAllocated = totalBudgetOf\(budget, type\)/.test(bt));
c('rumusnya cuma ada di lib/budgets.ts',
  (src.match(/export function totalBudgetOf/g) || []).length === 1);

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
