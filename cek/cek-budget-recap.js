// 📊 Rekap Budgeting & 🚨 Emergency Fund (1 Okt 2026).
//
// Dua layar baru di pita sub-tab Budgeting, plus Budgeting & Dashboard yang
// bertukar tempat.
//
// Yang paling penting di berkas ini: RUMUS TARGET dana darurat & dana pensiun.
// Rumusnya tidak pernah ditulis di spreadsheet pemilik app, jadi dicari balik
// dari angka panel kanan Financial Review lalu dicocokkan ke seluruh tahun
// yang punya datanya. Kalau rumusnya digeser diam-diam, angka target di layar
// akan berselisih dengan lembar yang sudah dibacanya bertahun-tahun, dan yang
// terbaca bukan "app-nya beda" melainkan "ingatanku salah".
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-budget-recap');
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
      path.join(ROOT, 'lib/budgetRecap.ts'),
      path.join(ROOT, 'lib/emergencyFund.ts'),
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
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (/^(expo-|react-native|@expo|@react-native|react$)/.test(req)) {
    return new Proxy({}, { get: () => () => ({}) });
  }
  return asli(req, parent, isMain);
};
const R = require(path.join(OUT, 'budgetRecap.js'));
const E = require(path.join(OUT, 'emergencyFund.js'));
Module._load = asli;

const tx = (y, m, d, type, category, amount) => ({
  id: `${y}${m}${d}${category}${amount}`,
  type,
  category,
  amount,
  date: { toDate: () => new Date(y, m, d), toMillis: () => new Date(y, m, d).getTime() },
});
const ts = (y, m, d) => ({
  toDate: () => new Date(y, m, d),
  toMillis: () => new Date(y, m, d).getTime(),
});

// =====================================================================
console.log('\n=== 1. Rekap setahun: rencana & kenyataan ===');
// =====================================================================
{
  const budgets = {
    '2026-01': { allocations: {
      'expense:food-drink': 2_000_000,
      'expense:snacks': 500_000,
      // Sub-budget: nominalnya SUDAH termasuk di budget kategorinya.
      'expense:food-drink:warung': 1_200_000,
      // Jenis lain tidak boleh ikut terhitung.
      'saving:emergency-fund': 900_000,
    } },
    '2026-02': { allocations: { 'expense:food-drink': 2_200_000 } },
  };
  const items = [
    tx(2026, 0, 5, 'expense', 'food-drink', 1_800_000),
    tx(2026, 0, 9, 'expense', 'food-drink', 300_000),
    tx(2026, 1, 3, 'expense', 'snacks', 400_000),
    tx(2026, 0, 4, 'saving', 'emergency-fund', 900_000),
    // Tahun lain: harus diabaikan walau ikut terkirim.
    tx(2025, 0, 5, 'expense', 'food-drink', 99_000_000),
  ];

  const rencana = R.buildBudgetRecap({ year: 2026, type: 'expense', mode: 'budget', budgets, items });
  ok('budget diambil per bulan dari dokumen bulanannya',
    rencana.rows.find((r) => r.key === 'food-drink').perMonth[0] === 2_000_000 &&
    rencana.rows.find((r) => r.key === 'food-drink').perMonth[1] === 2_200_000);
  // Menjumlah kategori DAN sub-nya bikin angkanya dobel — ini pagar yang sama
  // dengan totalBudgetOf di lib/budgets.ts.
  ok('sub-budget TIDAK ikut dijumlah (kalau ikut, angkanya dobel)',
    rencana.totalPerMonth[0] === 2_500_000,
    String(rencana.totalPerMonth[0]));
  ok('jenis lain tidak bocor masuk',
    !rencana.rows.some((r) => r.key === 'emergency-fund'));

  const kenyataan = R.buildBudgetRecap({ year: 2026, type: 'expense', mode: 'realisasi', budgets, items });
  ok('realisasi dijumlah per kategori per bulan',
    kenyataan.rows.find((r) => r.key === 'food-drink').perMonth[0] === 2_100_000 &&
    kenyataan.rows.find((r) => r.key === 'snacks').perMonth[1] === 400_000);
  ok('transaksi di luar tahunnya diabaikan',
    kenyataan.rows.find((r) => r.key === 'food-drink').total === 2_100_000);

  ok('urutan barisnya ikut daftar kategori app, bukan besar angkanya',
    JSON.stringify(rencana.rows.map((r) => r.key)) ===
      JSON.stringify(['food-drink', 'snacks']));
  ok('kategori yang nol sepanjang tahun tidak digambar',
    !kenyataan.rows.some((r) => r.total === 0));
  // Dua belas kolom yang isinya cuma dua bulan tidak boleh membuat
  // rata-ratanya terbaca seperenam dari yang sebenarnya.
  ok('rata-rata dibagi BULAN YANG TERISI, bukan 12',
    rencana.rows.find((r) => r.key === 'food-drink').average === 2_100_000 &&
    rencana.rows.find((r) => r.key === 'food-drink').months === 2);

  const beda = R.recapGap(rencana, kenyataan);
  ok('selisihnya = kenyataan dikurangi rencana',
    beda[0] === kenyataan.totalPerMonth[0] - rencana.totalPerMonth[0]);
}

// =====================================================================
console.log('\n=== 2. Target dana: rumusnya cocok dengan lembar aslinya ===');
// =====================================================================
{
  // Angka pembanding disalin dari panel kanan Financial Review, bukan dari
  // hasil hitungan modul yang diuji.
  const tahun = (income, iBulan, expense, eBulan) => ({
    income: { total: income, months: iBulan, average: 0 },
    expense: { total: expense, months: eBulan, average: 0 },
  });

  const dua6 = [tahun(75_032_500, 7, 57_411_772, 6)];
  ok('dana darurat 2026 = rata-rata pemasukan × 5 (Rp53.594.643)',
    E.emergencyTarget(dua6).target === 53_594_643,
    String(E.emergencyTarget(dua6).target));
  ok('dana pensiun 2026 = rata-rata pengeluaran × 300 (Rp2.870.588.600)',
    E.pensionTarget(dua6).target === 2_870_588_600,
    String(E.pensionTarget(dua6).target));

  const dua5 = [tahun(142_738_430, 11, 109_485_380, 11)];
  ok('dana darurat 2025 cocok (Rp64.881.105)',
    E.emergencyTarget(dua5).target === 64_881_105);
  ok('dana pensiun 2025 cocok (Rp2.985.964.909)',
    E.pensionTarget(dua5).target === 2_985_964_909);

  const dua4 = [tahun(123_097_205, 12, 80_533_526, 12)];
  ok('dana darurat 2024 cocok (Rp51.290.502)',
    E.emergencyTarget(dua4).target === 51_290_502);
  ok('dana pensiun 2024 cocok (Rp2.013.338.150)',
    E.pensionTarget(dua4).target === 2_013_338_150);

  ok('pengalinya ditulis sebagai nama, bukan angka lepas',
    E.EMERGENCY_MULTIPLIER === 5 && E.PENSION_MONTHS === 300);

  // Di bulan Januari, tahun berjalan baru punya satu bulan. Target yang
  // dihitung dari satu bulan melompat tiap kali satu transaksi besar masuk.
  const dua = [tahun(10_000_000, 1, 8_000_000, 1), tahun(120_000_000, 12, 96_000_000, 12)];
  ok('dirata-rata dari dua tahun terakhir, bukan dari tahun berjalan saja',
    E.TARGET_YEARS === 2 &&
    E.emergencyTarget(dua).months === 13 &&
    E.emergencyTarget(dua).target === Math.round((130_000_000 / 13) * 5));
  ok('tahun yang kosong dilewati, bukan ikut membagi',
    E.emergencyTarget([tahun(0, 0, 0, 0), ...dua6]).target === 53_594_643);
  ok('belum ada catatan sama sekali → 0, bukan pembagian nol',
    E.emergencyTarget([]).target === 0 && E.emergencyTarget([]).months === 0);
}

// =====================================================================
console.log('\n=== 3. Kemajuan & mutasi berjalan ===');
// =====================================================================
{
  const maju = E.fundProgress(9_150_000, 30_000_000);
  ok('persennya benar (30,5% seperti lembar aslinya)',
    Math.round(maju.percent * 100) / 100 === 30.5);
  ok('kurangnya dihitung', maju.short === 20_850_000 && maju.done === false);
  ok('terlampaui → 100%, tidak meluber',
    E.fundProgress(40_000_000, 30_000_000).percent === 100 &&
    E.fundProgress(40_000_000, 30_000_000).short === 0 &&
    E.fundProgress(40_000_000, 30_000_000).done === true);
  ok('tanpa target tidak dibagi nol', E.fundProgress(100, 0).percent === 0);

  const entries = [
    { id: 'c', title: 'Mei', cause: '', direction: 'debit', amount: 3_000_000, date: ts(2025, 4, 10) },
    { id: 'a', title: 'Jan', cause: '', direction: 'debit', amount: 150_000, date: ts(2025, 0, 28) },
    { id: 'd', title: 'Pakai', cause: '', direction: 'credit', amount: 500_000, date: ts(2025, 5, 2) },
    { id: 'b', title: 'Feb', cause: '', direction: 'debit', amount: 50_000, date: ts(2025, 1, 28) },
  ];
  const rows = E.fundRows(entries);
  // Inilah yang membuat daftar ini beda dari mutasi Saku biasa: tiap baris
  // menjawab "waktu itu sudah terkumpul berapa".
  ok('saldo berjalan dihitung dari yang PALING LAMA',
    rows[rows.length - 1].running === 150_000 &&
    rows[rows.length - 2].running === 200_000);
  ok('yang ditampilkan terbaru di depan',
    rows[0].entry.id === 'd' && rows[0].running === 2_700_000);
  ok('uang keluar mengurangi saldo berjalan', rows[0].running < rows[1].running);
  ok('mutasi kosong tidak melempar', E.fundRows([]).length === 0);

  const arus = E.fundFlow(entries);
  ok('masuk & keluar dijumlah terpisah',
    arus.addition === 3_200_000 && arus.reduction === 500_000);
  // Dibagi BULAN yang ada setorannya (Jan, Feb, Mei = 3), bukan jumlah mutasi.
  ok('rata-rata setoran dibagi per BULAN, bukan per mutasi',
    E.averageDeposit(entries) === Math.round(3_200_000 / 3));
  ok('uang keluar tidak ikut jadi rata-rata setoran',
    E.averageDeposit([entries[2]]) === 0);

  ok('sisa bulan dibulatkan ke ATAS (setengah bulan tetap butuh sebulan)',
    E.monthsToTarget(E.fundProgress(0, 1_000_000), 300_000) === 4);
  ok('sudah tercapai atau belum pernah menabung → tidak menjanjikan apa-apa',
    E.monthsToTarget(E.fundProgress(2_000_000, 1_000_000), 300_000) === null &&
    E.monthsToTarget(E.fundProgress(0, 1_000_000), 0) === null);
}

// =====================================================================
console.log('\n=== 4. Sub-tab & dua tombolnya ===');
// =====================================================================
{
  const fin = kode('app/finance.tsx');

  ok('Budgeting & Dashboard bertukar tempat',
    /\{ key: 'budgeting', label: 'Budgeting'[^}]*\},\s*\n\s*\{ key: 'transactions'[^}]*\},\s*\n\s*\{ key: 'dashboard'[^}]*\},\s*\n\s*\{ key: 'review'/.test(fin));
  ok('📊 Rekap & 🚨 Emergency Fund HANYA di sub-tab Budgeting',
    /tab === 'budgeting' \? \(/.test(fin) &&
    /emoji="📊"/.test(fin) && /emoji="🚨"/.test(fin));
  ok('🤝 & 👛 tetap hanya di Transaksi',
    /tab === 'transactions' \? \(/.test(fin) &&
    fin.indexOf("tab === 'transactions' ? (") < fin.indexOf("tab === 'budgeting' ? ("));
  ok('rekap dibuka di tahun yang sedang dilihat',
    /params: \{ year: String\(year\) \}/.test(fin));

  const layout = baca('app/_layout.tsx');
  ok('kedua rutenya terdaftar di navigator',
    /<Stack\.Screen name="budget-recap" \/>/.test(layout) &&
    /<Stack\.Screen name="emergency-fund" \/>/.test(layout));
  const tipe = baca('.expo/types/router.d.ts');
  ok('kedua rutenya terdaftar di typed routes',
    tipe.includes('/budget-recap') && tipe.includes('/emergency-fund'));
}

// =====================================================================
console.log('\n=== 5. Layar rekap & PDF-nya ===');
// =====================================================================
{
  const layar = kode('app/budget-recap.tsx');
  const pdf = baca('lib/budgetRecapPdf.ts');

  ok('sakelar Rencana / Kenyataan menukar isi tabel yang sama',
    /SegmentTabs tabs=\{MODE\} value=\{mode\} onChange=\{setMode\}/.test(layar) &&
    /const aktif = mode === 'budget' \? budgetRecap : realisasiRecap;/.test(layar));
  ok('budget dua belas bulan lewat SATU query rentang, tanpa index baru',
    /subscribeBudgetRange\(\s*\n\s*uid,\s*\n\s*monthId\(year, 0\),\s*\n\s*monthId\(year, 11\)/.test(layar));
  ok('transaksinya diambil sekali per tahun, bukan dilanggan',
    /fetchTransactionsRange\(user\.uid, new Date\(year, 0, 1\), new Date\(year \+ 1, 0, 1\)\)/.test(layar));
  ok('angka tahun lalu tidak sempat muncul di bawah judul tahun ini',
    /useKeyedData<number, Transaction\[\]>\(year\)/.test(layar));
  ok('di iPad tabelnya berhenti di tengah',
    /kolom: \{ \.\.\.CONTENT_COLUMN \}/.test(layar));

  // Permintaannya terang: modal untuk memilih bulan mana yang ditarik.
  ok('ada modal pilih bulan, plus pilihan setahun penuh',
    /<SheetModal\s*\n\s*visible=\{bagikan\}\s*\n\s*title="📤 Share Budget Recap"/.test(layar) &&
    /onPress=\{\(\) => kirim\(null\)\}/.test(layar) &&
    /onPress=\{\(\) => kirim\(i\)\}/.test(layar));
  ok('bulan yang kosong tidak ikut ditawarkan',
    /const bulanBerisi = MONTH_NAMES\.map/.test(layar));

  ok('PDF-nya SELALU mendatar',
    /budgetRecapHtml\(budget, realisasi, bulan, dibuat\),[\s\S]{0,160}true,\s*\n\s*\);/.test(pdf));
  ok('setahun → dua tabel berkolom bulan plus baris selisihnya',
    /tabelTahun\(budget, 'Rencana \(budget\)'\)/.test(pdf) &&
    /tabelTahun\(\s*\n?\s*realisasi,\s*\n?\s*'Kenyataan \(realisasi\)'/.test(pdf));
  ok('sebulan → budget, realisasi, selisih & persen terpakai',
    /<th scope="col">Budget<\/th>/.test(pdf) &&
    /<th scope="col">Realisasi<\/th>/.test(pdf) &&
    /<th scope="col">Selisih<\/th>/.test(pdf) &&
    /<th scope="col">Terpakai<\/th>/.test(pdf));
  ok('tanggal dibagikan ada DI BAWAH laporannya',
    /class="dibagikan"/.test(pdf) && pdf.indexOf('catatan + dibagikan') > 0);
}

// =====================================================================
console.log('\n=== 6. Emergency Fund: satu data, dua bacaan ===');
// =====================================================================
{
  const layar = kode('app/emergency-fund.tsx');
  const saku = baca('lib/saku.ts');

  // Menabung dari layar Saku maupun dari sini harus jadi SATU data.
  ok('mutasinya dompet Saku biasa, bukan simpanan kembar',
    /const FUND_KEY = 'emergency';/.test(layar) &&
    /subscribeFundEntries\(uid, FUND_KEY, setEntries/.test(layar) &&
    /\{ key: 'emergency', label: 'Emergency', icon: '🚨' \}/.test(saku));
  ok('menabung & mengubah mutasi tetap di layar Saku (satu tempat menulis)',
    /pathname: '\/saku\/\[key\]'/.test(layar) &&
    !/addFundEntry|updateFundEntry|deleteFundEntry/.test(layar));
  ok('targetnya DIHITUNG dari catatan, bukan diketik tangan',
    /emergencyTarget\(years\)/.test(layar) && /pensionTarget\(years\)/.test(layar) &&
    !/useState.*target/i.test(layar));
  ok('kedua target tampil beserta asal angkanya',
    /nama="Dana Darurat"/.test(layar) && /nama="Dana Pensiun"/.test(layar) &&
    /per bulan × 5/.test(layar) && /per bulan × \$\{PENSION_MONTHS\}/.test(layar));
  ok('tiap mutasi menyebut saldo berjalannya',
    /formatShortRupiah\(row\.running\)/.test(layar));
  ok('ada jawaban "berapa bulan lagi"',
    /monthsToTarget\(maju, rata\)/.test(layar) &&
    /bulan lagi kalau setoranmu tetap segini/.test(layar));
}

// =====================================================================
console.log('\n=== 7. Teksnya disederhanakan ===');
// =====================================================================
{
  // Kalimat panjang di layar uang bukan cuma tidak enak dibaca: ia membuat
  // orang berhenti membacanya sama sekali, lalu menebak sendiri.
  const BERKAS = [
    'components/finance/BudgetingTab.tsx',
    'components/finance/BudgetAiCard.tsx',
    'components/finance/CoachCard.tsx',
    'components/finance/SafeToSpendHero.tsx',
    'components/finance/FocusCard.tsx',
    'components/finance/ReviewTab.tsx',
    'app/budget-recap.tsx',
    'app/emergency-fund.tsx',
  ];
  const MAKS = 110;
  const panjang = [];
  for (const f of BERKAS) {
    const s = kode(f);
    for (const m of s.matchAll(/(detail|subtitle)="([^"]+)"/g)) {
      if (m[2].length > MAKS) panjang.push(`${f}: ${m[2].slice(0, 60)}…`);
    }
    for (const m of s.matchAll(/>\s*\n?\s*([A-Z][^<>{}]{10,})\s*\n?\s*<\//g)) {
      const teks = m[1].replace(/\s+/g, ' ').trim();
      if (teks.length > MAKS) panjang.push(`${f}: ${teks.slice(0, 60)}…`);
    }
  }
  ok(`tidak ada kalimat layar lebih dari ${MAKS} huruf`, panjang.length === 0,
    panjang.slice(0, 3).join(' · '));

  const bt = kode('components/finance/BudgetingTab.tsx');
  ok('kalimat kunci budget dipendekkan, artinya tetap',
    /Sesudah dikunci, mengubah budget harus pakai alasan\./.test(bt) &&
    /Transaksi tetap jalan seperti biasa\./.test(bt));
  ok('kalimat unlock dipendekkan, alasannya tetap wajib',
    /Tulis alasannya dulu\./.test(bt) && /unlockReason\.trim\(\)\.length < 3/.test(bt));
}

console.log(
  gagal === 0 ? '\n✅ SEMUA LULUS.' : `\n❌ ${gagal} cek gagal.`,
);
process.exit(gagal === 0 ? 0 : 1);
