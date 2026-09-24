// Tujuh permintaan:
//   1. Chip kategori News turun baris (tak pernah terpotong) + pencet 2×
//   2. Electricity/Water/Wifi/Maintenance DIHAPUS permanen + urutan baru
//   3. Sub-budget Iuran Lingkungan & Water Heater dihapus
//   4. Residence › Log jadi BACA-SAJA (tombol catat dibuang)
//   5. Tab Air-Listrik menampilkan sub-jenisnya + "Data dari Finance"
//   6. LEARNING & FUN tukar tempat
//   7. Steps disederhanakan + keterangan reset + judul target
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-tujuh-baru');
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
      R + 'lib/categories.ts', R + 'lib/budgets.ts', R + 'lib/residence.ts',
      R + 'lib/tasks.ts', R + 'lib/transactions.ts',
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

// ---------- Tiruan Firestore yang MENCATAT apa yang ditulis ----------
const tulisan = [];
let dokumenBudget = [];
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
      collection: (_db, ...p) => ({ path: p.join('/') }),
      getDocs: async () => ({ docs: dokumenBudget }),
      updateDoc: async (ref, data) => tulisan.push({ ref, data }),
      deleteField: () => '<<hapus>>',
      doc: () => ({}), getDoc: async () => ({ data: () => undefined }),
      setDoc: async () => {}, deleteDoc: async () => {},
      onSnapshot: () => () => {}, orderBy: () => {}, query: () => {},
      limit: () => {}, where: () => {}, writeBatch: () => ({
        delete: () => {}, commit: async () => {},
      }),
    };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: () => () => {} };
  if (/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const kat = require(M('categories'));
const bud = require(M('budgets'));
const res = require(M('residence'));
const tsk = require(M('tasks'));

// =====================================================================
console.log('=== 1. Chip News: digeser, sama seperti baris chip lainnya ===');
// =====================================================================
{
  const chip = baca('components/common/ChipRow.tsx');
  // 1 Sep 2026: mode turun baris (`wrap`) DIBUANG. Ia memang menampilkan
  // semua chip sekaligus, tapi baris keduanya tertimpa isi di bawahnya
  // sampai chip terakhir terpotong separuh — dan barisnya jadi satu-satunya
  // baris chip di app yang bentuknya beda sendiri. Yang menjaga "tak ada yang
  // terpotong" sekarang `activeIndex` (lihat cek-chip-geser.js).
  // Komentarnya sendiri menceritakan mode yang dibuang, dan cerita itu memang
  // harus tetap ada — jadi yang diperiksa kodenya saja.
  const kode = chip.replace(/\/\/.*$/gm, '');
  // Mode turun baris & spread tetap DIBUANG. Yang kemudian ditambahkan
  // (`fit` = muat sebaris, lebar dibagi rata) bukan menghidupkan keduanya:
  // ia tidak pernah menurunkan baris dan tidak menggeser apa pun.
  c('mode turun baris & spread tetap dibuang',
    !/flexWrap/.test(kode) && !/spread/.test(kode));
  c('…dan bentuk bawaannya tetap baris yang digeser', /horizontal\b/.test(kode));
  c('animasi masuk chip-nya tetap ada',
    (chip.match(/\{isi\}/g) ?? []).length === 1 && /FadeInRight/.test(chip));

  const tab = baca('components/news/NewsTab.tsx');
  c('News memakai bentuk yang sama',
    /<ChipRow\s*\n\s*activeIndex=\{NEWS_SOURCES\.findIndex/.test(tab));

  // Pencet 2× = muat ulang + balik ke paling atas.
  const fn = tab.slice(tab.indexOf('function pilihSumber'),
    tab.indexOf('return (', tab.indexOf('function pilihSumber')));
  // 15 Sep 2026: daftar sumber baru langsung dari atas (scrollTo tanpa animasi).
  c('sumber BEDA → cuma ganti sumber (+ gulung ke atas), tidak memuat ulang paksa',
    /if \(key !== source\) \{[\s\S]{0,300}setSource\(key\);\s*\n\s*listRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\s*\n\s*return;/.test(fn) &&
      !/if \(key !== source\) \{[\s\S]{0,300}reload\(\)[\s\S]{0,50}return;/.test(fn));
  c('sumber SAMA (pencet ke-2) → muat ulang', /reload\(\)/.test(fn));
  c('dan digulung balik ke paling atas',
    /listRef\.current\?\.scrollTo\(\{ y: 0/.test(fn));
  c('daftarnya memang dipegang ref-nya', /ref=\{listRef\}/.test(tab));
}

// =====================================================================
console.log('\n=== 2. Empat kategori budget DIHAPUS permanen ===');
// =====================================================================
{
  const DIBUANG = ['electricity', 'water', 'wifi', 'maintenance'];
  const sisa = DIBUANG.filter((k) =>
    kat.FINANCE_CATEGORIES.expense.some((x) => x.key === k));
  c('keempatnya lenyap dari daftar kategori', sisa.length === 0, sisa.join(', '));
  // Total budget menjumlah per kategori yang ADA — jadi nominal yatimnya
  // otomatis tidak ikut terhitung lagi.
  c('alokasi yatimnya tidak ikut menambah total budget', (() => {
    const alokasi = {
      'expense:electricity': 1000000,
      'expense:water': 150000,
      'expense:residence': 2050000,
    };
    return bud.totalBudgetOf(alokasi, 'expense') === 2050000;
  })(), String(bud.totalBudgetOf({
    'expense:electricity': 1000000, 'expense:residence': 2050000,
  }, 'expense')));

  // Urutan dua paling bawah.
  const key = kat.FINANCE_CATEGORIES.expense.map((x) => x.key);
  // 31 Agu 2026: Travel ikut turun ke paling bawah, jadi urutan tiga terakhir
  // sekarang Ministry → Insurance → Travel (lihat cek-delapan-permintaan.js).
  c('tiga paling bawah: Ministry, Insurance, Travel',
    key.slice(-3).join(' → ') === 'gathering-core → insurance → travel',
    key.slice(-3).join(' → '));

  // --- Penghapusan Firestore yang SUNGGUHAN ---
  c('daftar yang dibuang ditulis satu per satu, bukan aturan otomatis',
    Array.isArray(bud.REMOVED_BUDGET_KEYS) &&
      bud.REMOVED_BUDGET_KEYS.includes('expense:electricity') &&
      bud.REMOVED_BUDGET_KEYS.includes('expense:residence:iuran'),
    `${bud.REMOVED_BUDGET_KEYS.length} key`);

  // Dijalankan di atas dua dokumen bulan tiruan.
  tulisan.length = 0;
  dokumenBudget = [
    {
      ref: 'budgets/2026-08',
      data: () => ({
        allocations: {
          'expense:electricity': 1000000,
          'expense:water': 150000,
          'expense:wifi': 250000,
          'expense:maintenance': 650000,
          'expense:residence': 2050000,
          'expense:residence:iuran': 100000,
          'expense:residence:water-heater': 50000,
          'expense:residence:rent': 900000,
          'expense:food-drink': 500000,
        },
      }),
    },
    // Bulan yang memang sudah bersih — TIDAK boleh ditulis ulang.
    {
      ref: 'budgets/2026-09',
      data: () => ({ allocations: { 'expense:residence': 2050000 } }),
    },
  ];
  const n = require('util').promisify((cb) =>
    bud.purgeRemovedBudgets('u1').then((v) => cb(null, v), cb));

  (async () => {
    const terhapus = await n();
    c('enam alokasi terhapus', terhapus === 6, String(terhapus));
    c('cuma bulan yang kotor yang ditulis ulang', tulisan.length === 1,
      `${tulisan.length} tulis`);
    const sisaAlokasi = tulisan[0]?.data.allocations ?? {};
    c('yang dibuang benar-benar hilang',
      !('expense:electricity' in sisaAlokasi) &&
        !('expense:residence:iuran' in sisaAlokasi) &&
        !('expense:residence:water-heater' in sisaAlokasi));
    // Yang paling penting: tetangganya TIDAK ikut terhapus.
    c('budget lain tidak tersenggol sedikit pun',
      sisaAlokasi['expense:residence'] === 2050000 &&
        sisaAlokasi['expense:food-drink'] === 500000 &&
        sisaAlokasi['expense:residence:rent'] === 900000,
      JSON.stringify(sisaAlokasi));

    // Dijalankan lagi pada data yang sudah bersih → NOL tulis.
    tulisan.length = 0;
    dokumenBudget = [{
      ref: 'budgets/2026-08',
      data: () => ({ allocations: { 'expense:residence': 2050000 } }),
    }];
    const lagi = await bud.purgeRemovedBudgets('u1');
    c('aman dijalankan berulang — kedua kali nol tulis',
      lagi === 0 && tulisan.length === 0, `${lagi} terhapus, ${tulisan.length} tulis`);

    lanjut();
  })();
}

function lanjut() {
// =====================================================================
console.log('\n=== 3. Sub Iuran Lingkungan & Water Heater dibuang ===');
// =====================================================================
{
  const key = res.RESIDENCE_LOG_TYPES.map((t) => t.key);
  c('iuran & water-heater lenyap',
    !key.includes('iuran') && !key.includes('water-heater'), key.join(', '));
  const subs = bud.subsOf({}, 'expense', 'residence').map((s) => s.label);
  c('dan ikut lenyap dari sub-budget Residence',
    !subs.some((l) => /Iuran|Water Heater/.test(l)), subs.join(' | '));
  c('sub yang lain tetap ada',
    subs.some((l) => l.includes('Rent')) &&
      subs.some((l) => l.includes('Wifi')) &&
      subs.some((l) => l.includes('Maintenance')));
  // Transaksi lama bersub 'iuran' tak lagi dianggap pengeluaran rumah —
  // barisnya di Log ikut hilang, jadi dokumennya harus ikut dibersihkan.
  c('transaksi lama bersub iuran tak lagi dicocokkan',
    !bud.isResidenceTransaction('expense', 'residence', 'iuran'));
  c('layar Residence membuang log berjenis yang sudah tidak ada',
    /!RESIDENCE_LOG_TYPES\.some\(\(t\) => t\.key === l\.type\)/.test(
      baca('app/residence.tsx')));
}

// =====================================================================
console.log('\n=== 4. Residence › Log jadi BACA-SAJA ===');
// =====================================================================
{
  // Komentar dibuang dulu — penjelasan "tombolnya sudah dibuang" di dalam
  // berkasnya sendiri memuat kalimat yang dicari.
  const log = baca('components/residence/LogTab.tsx');
  const logKode = log.replace(/^\s*\/\/.*$/gm, '');
  c('tombol "Catat Pengeluaran" sudah tidak ada',
    !/Catat Pengeluaran/.test(logKode) && !/PrimaryButton/.test(logKode));
  c('tak ada lagi form/modal di tab Log',
    !/SheetModal|EditFooter|FormInput|MoneyInput/.test(log));
  c('tak ada satu pun tulis Firestore dari sini',
    !/addResidenceLog|updateResidenceLog|deleteResidenceLog|addDoc|setDoc/.test(log));
  c('barisnya baca-saja seperti Log di Car & Device',
    /active=\{false\}/.test(log) && /disabled/.test(log));
  c('menyebut asal datanya', /Data dari Finance/.test(log));
  // Penulis manualnya benar-benar dibuang dari lib, bukan sekadar tak dipakai.
  const lib = baca('lib/residence.ts');
  c('addResidenceLog & updateResidenceLog dihapus dari lib',
    !/export function addResidenceLog/.test(lib) &&
      !/export function updateResidenceLog/.test(lib));
  // Yang dari Finance tetap masuk.
  c('sinkron dari Finance tetap ada', /export function syncResidenceLog/.test(lib));
}

// =====================================================================
console.log('\n=== 5. Tab Air-Listrik: sub-jenis + asal datanya ===');
// =====================================================================
{
  const u = baca('components/residence/UtilityTab.tsx');
  c('barisnya menampilkan JENIS-nya, bukan nama kategori',
    /RESIDENCE_LOG_TYPES\.find\(\(r\) => r\.key === jenis\)/.test(u) &&
      !/categoryOf\('expense', t\.category\)/.test(u));
  c('menyebut asal datanya, sama seperti tab Log & fitur Car',
    /Data dari Finance/.test(u));
  // Nama jenisnya sesuai permintaan.
  const meta = (k) => res.RESIDENCE_LOG_TYPES.find((t) => t.key === k);
  c('jenis air bernama "Air PAM"', meta('water').label === 'Air PAM',
    meta('water').label);
  c('jenis listrik bernama "Listrik Token", bukan "Listrik (token)"',
    meta('electric').label === 'Listrik Token', meta('electric').label);
  c('ringkasan di atasnya ikut memakai nama itu',
    /⚡ Listrik Token/.test(u) && !/Listrik \(token\)/.test(u));
  c('keduanya tetap di kelompok utility (tab ini), bukan tab Log',
    meta('water').group === 'utility' && meta('electric').group === 'utility');
}

// =====================================================================
console.log('\n=== 6. LEARNING & FUN tukar tempat ===');
// =====================================================================
{
  const key = tsk.TASK_CATEGORIES.map((k) => k.key);
  c('urutannya: … ministry → fun → learning',
    key.join(',') === 'personal,work,ministry,fun,learning', key.join(','));
  // Kuncinya tidak boleh ikut berubah — task lama tersimpan pakai key ini.
  c('key-nya sendiri tidak diubah (task lama tetap ketemu kategorinya)',
    key.includes('learning') && key.includes('fun'));
  c('jumlah kategorinya tetap 5', key.length === 5);
}

// =====================================================================
console.log('\n=== 7. Steps: lebih sederhana + kapan resetnya ===');
// =====================================================================
{
  const s = baca('components/health/StepsTab.tsx');
  c('reset HARIAN disebut jam 00.00',
    /RESET_HARIAN = '🔄 Mulai lagi tiap hari, jam 00\.00'/.test(s));
  c('reset MINGGUAN disebut hari Senin',
    /RESET_MINGGUAN = '🔄 Mulai lagi tiap Senin'/.test(s));
  c('reset BULANAN disebut tanggal 1',
    /RESET_BULANAN = '🔄 Mulai lagi tiap tanggal 1'/.test(s));
  // Tiap kartu memakai keterangannya yang benar.
  // 15 Sep 2026: di bawah keterangan harian ada petunjuk izin Apple Health
  // (cuma tampil saat angkanya 0) — ia yang menutup kartu, keterangan
  // hariannya tetap tepat di atasnya.
  c('kartu hari ini memakai keterangan harian',
    /\{RESET_HARIAN\}[\s\S]{0,260}\{PETUNJUK_IZIN\}[\s\S]{0,80}<\/SummaryCard>/.test(s));
  c('kartu Minggu Ini memakai keterangan mingguan',
    /title="📅 This Week"\s*\n\s*reset=\{RESET_MINGGUAN\}/.test(s));
  c('kartu bulanan memakai keterangan bulanan',
    /MONTH_NAMES\[now\.getMonth\(\)\][\s\S]{0,40}reset=\{RESET_BULANAN\}/.test(s));
  c('kartu Anjuran Kesehatan ikut menyebut periodenya (mingguan juga)',
    /🩺 Anjuran Kesehatan[\s\S]{0,200}\{RESET_MINGGUAN\}/.test(s));

  // Penyederhanaan: patokan harian yang SUDAH tembus tidak ditampilkan lagi.
  c('patokan harian hanya menampilkan yang BELUM tembus',
    /const belumTembus = RUN_DAY_MILESTONES\.filter\(\(m\) => todayKm < m\.km\)/.test(s));
  c('kalau semuanya tembus, diganti satu baris perayaan',
    /belumTembus\.length === 0 \?/.test(s) &&
      /Semua patokan hari ini sudah tembus/.test(s));
  c('baris "sudah tercapai" digabung ke baris langkahnya',
    !/\$\{hit\.label\} tercapai/.test(s));

  // Judul kartunya.
  // Tiga tempat yang TAMPIL: kartu kosong, kartu terisi, & judul dialognya.
  // Komentar pembukanya dibuang dulu supaya yang dihitung memang yang digambar.
  const w = baca('components/health/WeekTargetCard.tsx').replace(/^\s*\/\/.*$/gm, '');
  c('judulnya "Target Langkah Mingguan" di ketiga tempatnya',
    (w.match(/🎯 Target Langkah Mingguan/g) ?? []).length === 3 &&
      !/🎯 Target Mingguan/.test(w),
    `${(w.match(/🎯 Target Langkah Mingguan/g) ?? []).length}×`);
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
}