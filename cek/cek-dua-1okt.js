// Dua permintaan 1 Okt 2026 (petang):
//
//   1. Budgeting 💰
//      a. Budget yang sudah DIKUNCI tetap boleh DIBUKA untuk melihat
//         sub-budget yang sudah dibuat. Unlock baru diminta saat mau MENGUBAH.
//      b. Tombol Rekomendasi Budget AI: menyusun budget dari realisasi tiga
//         bulan terakhir, diperlihatkan dulu, baru disetujui & ter-set.
//
//   2. Puasa 🍽️
//      a. Hari yang sudah dikunci jadi TAMPILAN BACA, tanpa kotak isian, dan
//         kekosongannya dijelaskan ("gagal, jadi tidak diisi").
//      b. Kartu keadaan di layar Puasa dibuang; langsung tombol Hari per Hari.
//      c. Daftar puasa menampilkan tanda BERHASIL dan tanda GAGAL.
//
// Mesin angkanya (riwayat per kategori, pembagian ulang sub-budget, hitungan
// hari puasa) DIJALANKAN sungguhan atas data buatan, bukan sekadar dicocokkan
// tulisannya: yang dipertaruhkan di sini angka budget dan catatan puasa yang
// tidak bisa diulang, jadi salah hitung jauh lebih mahal daripada salah layar.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-dua-1okt');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Isi berkas TANPA komentar — supaya cek tidak membaca komentar sebagai kode. */
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc',
      path.join(ROOT, 'lib/budgetAi.ts'),
      path.join(ROOT, 'lib/budgets.ts'),
      path.join(ROOT, 'lib/fasting.ts'),
      '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
  if (req === './firebase') return { db: {}, auth: {}, app: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  // Gemini-nya dipalsukan: yang diuji di sini penyusun angkanya, bukan
  // jaringannya. `stripEmDash` tetap yang sebenarnya supaya penyaring tanda
  // pisah panjang benar-benar teruji.
  if (req === './gemini') {
    return {
      TANDA_PISAH: String.fromCharCode(0x2014),
      stripEmDash: (s) => s.split(String.fromCharCode(0x2014)).join(',').trim(),
      AiAnswerError: class AiAnswerError extends Error {},
      geminiModel: () => ({}),
      geminiErrorMessage: (_e, u) => u,
      parseJsonAnswer: (x) => x,
      withModelFallback: (f) => f('x'),
    };
  }
  if (req === './aiGuard') return { guardedAiCall: (_k, run) => run() };
  if (req.startsWith('firebase/')) {
    return new Proxy({}, {
      get: (_, k) => {
        if (k === 'Timestamp') {
          return { fromDate: (d) => ({ toDate: () => d, toMillis: () => d.getTime() }) };
        }
        if (k === 'Schema') return new Proxy({}, { get: () => () => ({}) });
        return () => ({});
      },
    });
  }
  if (req === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: { getItem: async () => null, setItem: async () => {} } };
  }
  if (/^(expo-|react-native|@expo|react$)/.test(req)) return new Proxy({}, { get: () => () => ({}) });
  return asli(req, parent, isMain);
};
const A = require(path.join(OUT, 'budgetAi.js'));
const B = require(path.join(OUT, 'budgets.js'));
const F = require(path.join(OUT, 'fasting.js'));
Module._load = asli;

/** Transaksi buatan: tanggalnya dibungkus seperti Timestamp Firestore. */
const tx = (y, m, d, type, category, amount) => ({
  id: `${y}${m}${d}${category}${amount}`,
  type,
  category,
  amount,
  date: { toDate: () => new Date(y, m, d), toMillis: () => new Date(y, m, d).getTime() },
});

// Tiga bulan riwayat, persis bentuk yang dioper layar Finance (MonthSlice).
const RIWAYAT = [
  { monthId: '2026-07', items: [
    tx(2026, 6, 25, 'income', 'ndc-salary', 10_800_000),
    tx(2026, 6, 3, 'expense', 'food-drink', 2_100_000),
    tx(2026, 6, 5, 'expense', 'snacks', 460_000),
  ] },
  { monthId: '2026-08', items: [
    tx(2026, 7, 25, 'income', 'ndc-salary', 10_800_000),
    tx(2026, 7, 3, 'expense', 'food-drink', 2_400_000),
    tx(2026, 7, 5, 'expense', 'snacks', 520_000),
  ] },
  { monthId: '2026-09', items: [
    tx(2026, 8, 25, 'income', 'ndc-salary', 10_800_000),
    tx(2026, 8, 3, 'expense', 'food-drink', 1_900_000),
    tx(2026, 8, 5, 'expense', 'snacks', 610_000),
  ] },
];

const ALOKASI = {
  'expense:food-drink': 2_000_000,
  'expense:transportation': 2_000_000,
  'saving:emergency-fund': 500_000,
};

// =====================================================================
console.log('\n=== 1a. 🔒 Budget terkunci boleh DILIHAT, bukan cuma dibuka kuncinya ===');
// =====================================================================
{
  const bt = kode('components/finance/BudgetingTab.tsx');

  ok('click kategori saat terkunci tidak lagi langsung melempar ke Unlock',
    /function openEdit\(category: FinanceCategory\) \{\s*\n\s*setEditing\(category\);/.test(bt) &&
    !/function openEdit\(category: FinanceCategory\) \{\s*\n\s*if \(locked\)/.test(bt));
  ok('judulnya berganti jadi "🔒 Budget Terkunci", bukan "🎯 Set Budget"',
    /\{locked \? '🔒 Budget Terkunci' : '🎯 Set Budget'\}/.test(bt));
  ok('yang digambar tampilan baca, bukan formulir yang dimatikan',
    /\{locked && editing \? \(\s*\n\s*<BacaBudget/.test(bt) &&
    /function BacaBudget\(\{/.test(bt));

  // Inilah inti permintaannya: sub-budget yang sudah dibuat HARUS kelihatan.
  ok('tiap sub-budget yang sudah dibuat ikut tampil (nama, realisasi, nominal)',
    /subs=\{subDraft\.map\(\(s\) => \(\{/.test(bt) &&
    /subs\.map\(\(s\) => \(/.test(bt) &&
    /\{formatRupiah\(s\.realized\)\}/.test(bt) &&
    /\{formatRupiah\(s\.amount\)\}/.test(bt));
  ok('nominal & realisasi kategorinya juga ikut terbaca',
    /\{formatRupiah\(budget\)\}/.test(bt) && /\{formatRupiah\(realized\)\}/.test(bt));

  // Kuncinya tidak hilang, ia cuma pindah ke tempat yang benar.
  const iBaca = bt.indexOf('<BacaBudget');
  const iMoney = bt.indexOf('<MoneyInput');
  const iSimpan = bt.indexOf('confirmLabel="Simpan"');
  ok('tak ada satu pun kotak isian di cabang terkunci',
    iBaca > 0 && iMoney > iBaca && iSimpan > iMoney &&
    /\) : \(\s*\n\s*<>/.test(bt.slice(iBaca, iMoney)));
  ok('tombolnya Unlock, dan Unlock menutup dialog bacanya dulu',
    /confirmLabel="🔓 Unlock"[\s\S]{0,120}onConfirm=\{onUnlock\}/.test(bt) &&
    /function bukaUnlock\(\) \{\s*\n\s*setEditing\(null\);\s*\n\s*setUnlockError\(null\);\s*\n\s*setUnlockOpen\(true\);/.test(bt));
  ok('salin bulan lalu (yang MENGUBAH angka) tetap lewat Unlock',
    /function handleCopyPress\(\) \{\s*\n\s*if \(locked\) \{\s*\n\s*bukaUnlock\(\);/.test(bt));
  ok('alasan unlock tetap wajib & tetap tercatat',
    /unlockReason\.trim\(\)\.length < 3/.test(bt) &&
    /await unlockBudget\(user\.uid, year, month, unlockReason\)/.test(bt));
}

// =====================================================================
console.log('\n=== 1b. 🤖 Rekomendasi Budget AI: angkanya ===');
// =====================================================================
{
  ok('rata-rata pemasukan dihitung dari riwayat',
    A.avgMonthlyIncome(RIWAYAT) === 10_800_000);
  // Bulan tanpa SATU PUN transaksi hampir selalu berarti app-nya memang belum
  // dipakai, bukan bahwa pemasukannya nol. Kalau ikut membagi, seluruh rencana
  // turun tanpa alasan.
  ok('bulan yang kosong melompong tidak ikut membagi',
    A.avgMonthlyIncome([{ monthId: '2026-06', items: [] }, ...RIWAYAT]) === 10_800_000);
  ok('riwayat kosong → 0, bukan pembagian nol', A.avgMonthlyIncome([]) === 0);

  const rows = A.budgetHistoryRows('expense', RIWAYAT, ALOKASI);
  const kunci = rows.map((r) => r.key);
  ok('barisnya urut seperti daftar kategori app, bukan urut besar angka',
    JSON.stringify(kunci) === JSON.stringify(['food-drink', 'transportation', 'snacks']),
    kunci.join(', '));
  const makan = rows.find((r) => r.key === 'food-drink');
  ok('realisasi tiap bulan urut lama ke baru',
    JSON.stringify(makan.spent) === JSON.stringify([2_100_000, 2_400_000, 1_900_000]));
  ok('rata-ratanya benar', makan.avg === Math.round(6_400_000 / 3));
  ok('budget yang terpasang sekarang ikut terbawa', makan.current === 2_000_000);
  ok('kategori berbudget tapi belum terpakai TETAP ikut (biar bisa dipangkas)',
    rows.find((r) => r.key === 'transportation').avg === 0);
  ok('kategori tanpa realisasi DAN tanpa budget tidak ikut (hemat token)',
    !kunci.includes('groceries') && !kunci.includes('travel'));
  ok('labelnya lengkap dengan emojinya', makan.label === '🍛 Food Drink');

  // Batas wajar = pemasukan dikurangi alokasi jenis LAIN yang sudah dipasang
  // sendiri. Tanpa ini, usulan Pengeluaran bisa diam-diam menelan jatah
  // Tabungan & Investasi yang sudah ditetapkan.
  ok('batas wajar = pemasukan dikurangi alokasi jenis lain',
    A.budgetCeiling('expense', ALOKASI, 10_800_000) === 10_300_000);
  ok('jenis Income tidak punya batas semacam itu',
    A.budgetCeiling('income', ALOKASI, 10_800_000) === 0);
  ok('tanpa data pemasukan, tidak ada batas yang dikarang',
    A.budgetCeiling('expense', ALOKASI, 0) === 0);

  const brief = A.budgetBrief('expense', 'Oktober 2026', rows, ['Jul', 'Agu', 'Sep'], 10_800_000, 10_300_000);
  ok('brief menyebut bulan yang direncanakan & bulan riwayatnya',
    brief.includes('Oktober 2026') && brief.includes('Jul, Agu, Sep'));
  ok('tiap kategori dikirim beserta KODE-nya di kurung siku',
    brief.includes('[food-drink]') && brief.includes('[snacks]'));
  ok('batas totalnya ikut dikirim, berformat Rupiah',
    /10\.300\.000/.test(brief));
  // Inilah yang menjaga kuota gratisnya: yang dikirim rangkuman per kategori,
  // bukan transaksi satu per satu.
  ok('yang dikirim rangkuman, bukan transaksi satu per satu',
    brief.split('\n').length <= 12 && !brief.includes('2026-07-03'));
}

// =====================================================================
console.log('\n=== 1b. 🤖 Jawaban AI dipagari sebelum menyentuh angka ===');
// =====================================================================
{
  const rows = A.budgetHistoryRows('expense', RIWAYAT, ALOKASI);
  const plan = A.finalizeBudgetPlan({
    ringkas: 'Tahan jajan, naikkan makan sedikit.',
    items: [
      { key: 'food-drink', amount: 2_150_000, alasan: 'rata-rata tiga bulan segitu' },
      { key: 'food-drink', amount: 9_000_000, alasan: 'kunci yang sama dua kali' },
      { key: 'kategori-karangan', amount: 1_000_000, alasan: 'tidak ada di app' },
      { key: 'snacks', amount: -50_000, alasan: 'negatif' },
      { key: 'transportation', amount: 1_234_567, alasan: 'belum bulat' },
    ],
    catatan: '',
  }, rows);

  ok('kategori karangan DIBUANG, tidak dibiarkan lewat',
    !plan.items.some((i) => i.key === 'kategori-karangan'));
  ok('kunci yang sama dua kali cuma dipakai yang pertama',
    plan.items.filter((i) => i.key === 'food-drink').length === 1 &&
    plan.items.find((i) => i.key === 'food-drink').amount === 2_150_000);
  ok('nominal negatif dibuang', !plan.items.some((i) => i.amount < 0));
  ok('nominalnya dibulatkan ke puluhan ribu',
    plan.items.find((i) => i.key === 'transportation').amount === 1_230_000);
  ok('catatan yang kosong diisi sendiri, tidak dibiarkan menggantung',
    plan.catatan.length > 0);

  const bersih = A.finalizeBudgetPlan({
    ringkas: `Rapi${String.fromCharCode(0x2014)} sekali ✨`,
    items: [{ key: 'snacks', amount: 500_000, alasan: 'turun 🔥 dikit' }],
    catatan: 'oke',
  }, rows);
  ok('tanda pisah panjang & emoji dibersihkan dari jawabannya',
    !bersih.ringkas.includes(String.fromCharCode(0x2014)) &&
    !/✨/.test(bersih.ringkas) && !/🔥/.test(bersih.items[0].alasan));

  let lempar = false;
  try { A.finalizeBudgetPlan({ ringkas: '', items: [] }, rows); } catch { lempar = true; }
  ok('jawaban kosong melempar galat, bukan menulis budget nol', lempar);
}

// =====================================================================
console.log('\n=== 1b. 🤖 Menerapkan usulan: sub-budget ikut dibagi ulang ===');
// =====================================================================
{
  ok('perbandingannya tetap & jumlahnya persis',
    JSON.stringify(B.scaleAmounts([1_200_000, 800_000], 2_400_000)) ===
      JSON.stringify([1_440_000, 960_000]));
  const bagi = B.scaleAmounts([333_333, 333_333, 333_334], 1_000_000);
  ok('sisa pembulatan tidak hilang: jumlahnya tetap persis target',
    bagi.reduce((a, b) => a + b, 0) === 1_000_000, bagi.join('+'));
  ok('tidak ada hasil negatif', B.scaleAmounts([10, 1_000_000], 20_000).every((n) => n >= 0));
  ok('daftar kosong, total nol, atau target nol tidak bikin pembagian nol',
    JSON.stringify(B.scaleAmounts([], 1_000_000)) === '[]' &&
    JSON.stringify(B.scaleAmounts([0, 0], 1_000_000)) === '[0,0]' &&
    JSON.stringify(B.scaleAmounts([100, 200], 0)) === '[0,0]');

  const patch = B.budgetPlanPatch(
    'expense',
    [
      { key: 'food-drink', amount: 2_400_000 },
      { key: 'transportation', amount: 1_500_000 },
    ],
    {
      'food-drink': [
        { key: 'warung', amount: 1_200_000 },
        { key: 'kopi', amount: 800_000 },
        { key: 'belum-diisi', amount: 0 },
      ],
      transportation: [],
    },
  );
  ok('budget kategorinya ditulis', patch['expense:food-drink'] === 2_400_000);
  ok('sub-budget-nya ikut naik menurut perbandingannya',
    patch['expense:food-drink:warung'] === 1_440_000 &&
    patch['expense:food-drink:kopi'] === 960_000);
  // Ini yang paling mudah terlewat: di layar Budgeting, budget kategori yang
  // punya sub = TOTAL sub-nya. Kalau angkanya tidak dibagi ulang, layarnya
  // menampilkan satu angka dan jumlah sub-nya angka lain.
  ok('jumlah sub = budget kategorinya (invarian layar Budgeting)',
    patch['expense:food-drink:warung'] + patch['expense:food-drink:kopi'] ===
      patch['expense:food-drink']);
  ok('sub yang memang belum pernah diisi tidak tiba-tiba kebagian angka',
    patch['expense:food-drink:belum-diisi'] === undefined);
  ok('kategori tanpa sub cukup angka kategorinya',
    patch['expense:transportation'] === 1_500_000 &&
    Object.keys(patch).filter((k) => k.startsWith('expense:transportation:')).length === 0);
}

// =====================================================================
console.log('\n=== 1b. 🤖 Uang: tetap gratis, tetap berpagar ===');
// =====================================================================
{
  const src = baca('lib/budgetAi.ts');

  ok('lewat pagar bersama lib/aiGuard.ts, dengan kunci per jenis+bulan+percobaan',
    /guardedAiCall\(`budget\|\$\{type\}\|\$\{bulanId\}\|\$\{attempt\}\|\$\{brief\}`/.test(src));
  ok('punya cadangan model kalau kuota model utamanya penuh',
    /withModelFallback\(async \(nama\) =>/.test(src));
  ok('jatahnya sendiri 3 usulan per hari', A.BUDGET_AI_DAILY_CAP === 3);
  // Kunci penyimpanannya tetap "ai:budget:<dayId>" — awalannya sekarang
  // dirakit lib/aiDay.ts dari nama fiturnya (lihat cek-rapihin-ai-hari.js).
  ok('hasilnya disimpan seharian per jenis+bulan, jadi membuka lagi gratis',
    /aiDayStore<BudgetAiDay>\('budget', EMPTY_BUDGET_AI_DAY/.test(src) &&
    /kunciRencana = \(\s*\n?\s*type: FinanceType,\s*\n?\s*bulanId: string,\s*\n?\s*\): KunciRencana => `\$\{type\}\|\$\{bulanId\}`/.test(src));
  ok('jatah habis dihitung, tidak dibiarkan minus',
    A.budgetAttemptsLeft({ attempts: 9, hasil: {} }) === 0 &&
    A.budgetAttemptsLeft({ attempts: 1, hasil: {} }) === 2);
  ok('jawabannya berbentuk JSON berskema (bukan teks bebas yang ditebak)',
    /responseMimeType: 'application\/json'/.test(src) && /responseSchema: SKEMA/.test(src));
  ok('jatah token longgar — token "berpikir" Gemini 3.x ikut dihitung ke situ',
    /maxOutputTokens: 8192/.test(src));
  ok('suhunya rendah: ini menyusun angka, bukan menulis puisi',
    /temperature: 0\.2/.test(src));
  ok('tidak ada kunci Gemini di kode, tidak ada Vertex AI',
    !/AIza/.test(src) && !/vertex/i.test(src));
  ok('galatnya dijelaskan tanpa menakut-nakuti soal biaya',
    /AI belum bisa menyusun budget sekarang/.test(src));
}

// =====================================================================
console.log('\n=== 1b. 🤖 Alurnya: lihat dulu, setujui, baru ditulis ===');
// =====================================================================
{
  const kartu = kode('components/finance/BudgetAiCard.tsx');
  const bt = kode('components/finance/BudgetingTab.tsx');
  const fin = kode('app/finance.tsx');

  ok('kartunya terpasang di sub-tab Budgeting',
    /<BudgetAiCard\s/.test(bt) && /history=\{history\}/.test(bt) &&
    /locked=\{locked\}/.test(bt) && /onUnlock=\{bukaUnlock\}/.test(bt));
  // Riwayat tiga bulan SUDAH dilanggan layar Finance untuk Dashboard & Coach.
  // Kartu ini menumpang langganan yang sama: nol read tambahan.
  ok('riwayatnya menumpang langganan yang sudah ada (nol read tambahan)',
    /<BudgetingTab[\s\S]{0,200}history=\{history\}/.test(fin) &&
    !/subscribe\w+\(/.test(kartu));

  const iSusun = kartu.indexOf('async function susun');
  const iTerapkan = kartu.indexOf('async function terapkan');
  ok('meminta usulan TIDAK menulis apa pun ke Firestore',
    iSusun > 0 && iTerapkan > iSusun &&
    !/applyBudgetPlan/.test(kartu.slice(iSusun, iTerapkan)));
  ok('yang menulis cuma tombol setujui, lewat applyBudgetPlan + budgetPlanPatch',
    /await applyBudgetPlan\(\s*\n\s*user\.uid,\s*\n\s*year,\s*\n\s*month,\s*\n\s*budgetPlanPatch\(type, rencana\.items, subs\),/.test(kartu) &&
    /confirmLabel="✅ Setujui & Set"[\s\S]{0,200}onConfirm=\{terapkan\}/.test(kartu));
  ok('saat terkunci, menyetujui pun harus lewat Unlock dulu',
    /locked && rencana \? \(/.test(kartu) &&
    /confirmLabel="🔓 Unlock dulu"/.test(kartu) &&
    kartu.indexOf('locked && rencana ? (') < kartu.indexOf('confirmLabel="✅ Setujui & Set"'));
  ok('sebelum diminta, angka dasarnya diperlihatkan dulu (bisa dinilai sendiri)',
    /Inilah angka yang dibaca AI/.test(kartu));
  ok('total SESUDAH disetujui dihitung utuh, termasuk kategori yang tidak disebut AI',
    /const usul = rencana\?\.items\.find\(\(i\) => i\.key === r\.key\);\s*\n\s*return a \+ \(usul \? usul\.amount : r\.current\);/.test(kartu));
  ok('usulan yang melewati batas wajar diberi peringatan, bukan diloloskan diam-diam',
    /const lewatBatas = ceiling > 0 && totalSesudah > ceiling;/.test(kartu) &&
    /Melewati batas wajar/.test(kartu));
  ok('jatah & usulan tersimpan baru dibaca saat sheet-nya DIBUKA',
    /useAiDay\(today, loadBudgetAiDay, open\)/.test(kartu));
  // Riwayat tiga bulan dimuat TERPISAH dari transaksi bulan ini, jadi sheet
  // ini bisa terbuka sedetik sebelum riwayatnya tiba. Satu click di detik itu
  // akan mengirim "realisasi 0" dan menerima rencana yang memangkas semuanya.
  ok('tidak bisa diminta sebelum riwayatnya benar-benar ada isinya',
    /const siap = rows\.length > 0 && history\.some\(\(h\) => h\.items\.length > 0\);/.test(kartu) &&
    /\{!siap \? \(/.test(kartu) && /!siap \? undefined :/.test(kartu));
}

// =====================================================================
console.log('\n=== 2a. 🍽️ Hari puasa yang terkunci jadi tampilan baca ===');
// =====================================================================
{
  const hari = kode('app/fasting-days.tsx');

  ok('terkunci → yang digambar BacaHari, bukan formulir',
    /\{terkunci \? \(/.test(hari) && /<BacaHari day=\{draft\} \/>/.test(hari) &&
    /function BacaHari\(\{ day \}: \{ day: FastingDay \}\)/.test(hari));
  ok('isiannya jadi tampilan baca bersama (ReadBlock), sama seperti layar Puasa',
    /<ReadBlock label="🙏 Pokok Doa Hari Ini" text=\{day\.prayer\} \/>/.test(hari) &&
    /<ReadBlock label="✨ Jawaban Doa Hari Ini" text=\{day\.answer\} \/>/.test(hari));

  // Kotak isian yang cuma dimatikan tetap terlihat seperti kotak yang menunggu
  // diketik. Yang diperiksa: kotaknya benar-benar tidak digambar, bukan
  // sekadar `editable={false}`.
  const iBaca = hari.indexOf('<BacaHari');
  const iForm = hari.indexOf('<FormInput');
  ok('tidak ada kotak isian sama sekali di cabang terkunci',
    iBaca > 0 && iForm > iBaca && !/editable=\{!busy && !terkunci\}/.test(hari));
  ok('pilihan ✓/✗ ikut hilang, diganti keterangan keadaannya',
    !/disabled=\{terkunci\}/.test(hari) &&
    /\{day\.failed\s*\n?\s*\? 'Puasa gagal'/.test(hari));

  // Inti permintaannya: kosong karena GAGAL dan kosong karena lupa mencatat
  // terlihat sama persis, padahal artinya jauh berbeda.
  ok('kalau gagal & tidak ada catatan, kekosongannya DIJELASKAN',
    /const kosong = !day\.prayer\.trim\(\) && !day\.answer\.trim\(\);/.test(hari) &&
    /Puasa hari ini gagal, jadi catatannya tidak diisi\./.test(hari));
  ok('kosong tanpa gagal dapat kalimatnya sendiri, bukan kalimat gagal',
    /Tidak ada catatan yang ditulis untuk hari ini\./.test(hari));
  ok('menyimpan tetap mustahil saat terkunci (pagar lama tidak dilepas)',
    /if \(!user \|\| !planId \|\| terkunci\) return;/.test(hari));
}

// =====================================================================
console.log('\n=== 2b. 🍽️ Kartu keadaan dibuang, langsung tombol Hari per Hari ===');
// =====================================================================
{
  const puasa = baca('app/fasting.tsx');

  ok('kartu keadaannya benar-benar dibuang, bukan disembunyikan',
    !/<SummaryCard/.test(puasa) && !/<ProgressBar/.test(puasa) &&
    !/const keadaan =/.test(puasa) && !/pillSoon/.test(puasa));
  ok('gaya kartunya ikut dibuang (tidak jadi gaya nganggur)',
    !/\n  hero: \{/.test(puasa) && !/\n  pill: \{/.test(puasa));
  ok('yang pertama terlihat sekarang pintu Hari per Hari',
    puasa.indexOf('📆 Lihat Hari per Hari') < puasa.indexOf('📝 Tentang Puasa'));
  ok('hitungan harinya pindah ke situ, tidak ikut hilang',
    /`✅ \$\{progress\.done\} berhasil\$\{/.test(puasa) &&
    /dari \$\{progress\.total\} hari`/.test(puasa));
  ok('yang belum mulai tetap menghitung mundur, bukan dilapori "0 berhasil"',
    /belumMulai\s*\n?\s*\? `🗓️ Mulai \$\{menujuMulai\} hari lagi`/.test(puasa));
  ok('tanggalnya tetap terbaca di bagian Periode di bawahnya',
    /label="Mulai puasa"/.test(puasa) && /label="Selesai puasa"/.test(puasa));
  ok('keadaan terkunci tetap diumumkan di pita judul',
    /'🔒 Sudah dikunci, tinggal dibaca'/.test(puasa));
}

// =====================================================================
console.log('\n=== 2c. 🍽️ Daftar puasa: tanda berhasil DAN tanda gagal ===');
// =====================================================================
{
  const rencana = {
    id: 'p1', title: 'Pergumulan Hubungan', prayer: '', rules: '', answer: '',
    startId: '2026-09-21', endId: '2026-09-26',
    days: {
      '2026-09-21': { prayer: '', done: false, failed: true, answer: '' },
      '2026-09-22': { prayer: '', done: true, failed: false, answer: '' },
      '2026-09-23': { prayer: 'didoakan', done: false, answer: '' },
      // 24 sampai 26 belum disentuh sama sekali.
    },
  };
  const h = F.fastingProgress(rencana);
  ok('hari berhasil & hari gagal dihitung terpisah',
    h.done === 1 && h.failed === 1 && h.total === 6,
    `done ${h.done} · failed ${h.failed} · total ${h.total}`);
  // Hari yang cuma ditulisi pokok doa BUKAN hari yang gagal. Dua hal itu
  // tidak boleh tertukar: yang satu belum dijawab, yang satu dijawab "tidak".
  ok('hari yang belum dijawab tidak dihitung gagal',
    h.done + h.failed < h.total);
  ok('catatan lama tanpa field `failed` terbaca sebagai belum dijawab, bukan gagal',
    F.fastingProgress({
      ...rencana,
      days: { '2026-09-21': { prayer: '', done: false, answer: '' } },
    }).failed === 0);

  const tab = kode('components/spiritual/FastingTab.tsx');
  ok('daftarnya memakai satu komponen tanda bersama',
    /function Tanda\(\{/.test(tab) &&
    /const \{ done, failed, total \} = fastingProgress\(p\);/.test(tab));
  ok('tandanya tampil di baris arsip DAN di kartu puasa yang sedang berjalan',
    /<Tanda done=\{done\} failed=\{failed\} \/>/.test(tab) &&
    /<Tanda\s*\n?\s*done=\{aktifTanda\.done\}\s*\n?\s*failed=\{aktifTanda\.failed\}/.test(tab));
  ok('keduanya disebut terang-terangan: berhasil & gagal',
    /✅ \{done\} berhasil/.test(tab) && /✗ \{failed\} gagal/.test(tab));
  ok('yang nol tidak digambar (tidak ada "0 gagal" yang menagih)',
    /if \(done === 0 && failed === 0\) return null;/.test(tab) &&
    /\{done > 0 && \(/.test(tab) && /\{failed > 0 && \(/.test(tab));
  // Di kartu ungu pekat, hijau & merahnya tidak terbaca — yang membedakan
  // tinggal lambangnya.
  ok('di kartu gelap warnanya ikut menyesuaikan',
    /onDark \? styles\.tandaOnDark : styles\.tandaDone/.test(tab) &&
    /tandaOnDark: \{ color: Color\.TEXT_ON_DARK_MUTED \}/.test(baca('components/spiritual/FastingTab.tsx')));
}

console.log(
  gagal === 0 ? '\n✅ SEMUA LULUS.' : `\n❌ ${gagal} cek gagal.`,
);
process.exit(gagal === 0 ? 0 : 1);
