// Enam permintaan 1 Okt 2026:
//   1. ✗ Tombol "Hapus" di riwayat pembayaran Lending jadi tombol ✗ kecil.
//   2. ✨ Bacaan AI pindah ke DALAM tiap sub-tab Investment (lihat juga
//      cek-empat-30sep.js untuk mesinnya).
//   3. 📤 Laporan keuangan PDF berkolom bulan + pilih rentang 1/3/6/12 bulan.
//   4. 🔴 Angka di ikon app = jumlah badge yang kelihatan di dalam app.
//   5. 📋 Tombol salin di modal Edit Entry fitur Saku.
//   6. 🔔 Tombol lonceng Work menuju Reminder kategori WORK.
//
// Mesin laporannya DIJALANKAN atas transaksi buatan, bukan sekadar dicocokkan
// tulisannya: ini angka uang, dan satu kesalahan penjumlahan di PDF yang
// dipresentasikan jauh lebih mahal daripada layar yang salah.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-enam-1okt');
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
    ['tsc', path.join(ROOT, 'lib/financeReport.ts'), '--ignoreConfig',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === '@/assets/style/color') return { Color: new Proxy({}, { get: () => '#000000' }) };
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (/^(expo-|react-native|@expo|@react-native|react$)/.test(req)) {
    return new Proxy({}, { get: () => () => ({}) });
  }
  return asli(req, parent, isMain);
};
const R = require(path.join(OUT, 'financeReport.js'));
Module._load = asli;

/** Transaksi buatan: tanggalnya dibungkus seperti Timestamp Firestore. */
const tx = (y, m, d, type, category, amount) => ({
  id: `${y}${m}${d}${category}${amount}`,
  type,
  category,
  amount,
  date: { toDate: () => new Date(y, m, d) },
});

// =====================================================================
console.log('\n=== 1. ✗ Tombol hapus di riwayat pembayaran Lending ===');
// =====================================================================
{
  const debts = kode('app/debts.tsx');
  const x = baca('components/common/DeleteX.tsx');

  ok('tombolnya ✗ kecil bersama, bukan tulisan "Hapus" merah',
    /<DeleteX onPress=\{\(\) => setHapusBayar\(p\.id\)\} \/>/.test(debts) &&
    !/Hapus\s*\n?\s*<\/VixText>/.test(debts));
  ok('bentuknya satu komponen, dipakai bersama tab Transaksi',
    /<DeleteX onPress=\{\(\) => setConfirmDelete\(item\)\} \/>/.test(
      kode('components/finance/TransactionsTab.tsx')));
  ok('ukurannya kecil & samar, tapi daerah sentuhnya diperlebar',
    /size=\{16\}/.test(x) && /color=\{Color\.TEXT_PLACEHOLDER\}/.test(x) &&
    /hitSlop=\{10\}/.test(x));

  // Ini yang paling penting: tombolnya mengecil, jadi konfirmasinya WAJIB ada.
  // Sebelum ini "Hapus" langsung menghapus tanpa tanya, dan semua hapus di app
  // ini permanen.
  ok('di-click → konfirmasi dulu, tidak langsung menghapus',
    /hapusBayar === p\.id \? \(/.test(debts) &&
    /<InlineDeleteConfirm/.test(debts) &&
    !/onPress=\{\(\) => handleDeletePayment\(p\.id\)\}/.test(debts));
  // Sheet ini sendiri sudah modal, dan iOS tidak menampilkan modal di atas
  // modal — jadi konfirmasinya HARUS inline, bukan ConfirmDialog.
  ok('konfirmasinya inline (iOS tidak menampilkan modal di atas modal)',
    /export function InlineDeleteConfirm/.test(baca('components/common/InlineDelete.tsx')));
  ok('kalimat konfirmasinya tetap satu untuk seluruh app',
    /Yakin mau menghapus\? Tindakan ini permanen\./.test(
      baca('components/common/InlineDelete.tsx')));
  ok('hapusnya tetap PERMANEN, bukan ditandai',
    /deleteDebtPayment\(user\.uid, paying, paymentId\)/.test(debts));
}

// =====================================================================
console.log('\n=== 2. ✨ Analysis masuk ke tiap sub-tab Investment ===');
// =====================================================================
{
  // Mesin & panelnya diperiksa lengkap di cek-empat-30sep.js bagian 2c.
  // Yang dijaga DI SINI cuma pemindahannya: tidak ada tab yatim yang
  // tertinggal, dan keempat sub-tab benar-benar mendapat panelnya.
  const inv = kode('app/investment.tsx');
  ok('sub-tab Analysis tersendiri sudah tidak ada',
    !/key: 'analysis'/.test(inv) && !/AnalysisTab/.test(inv));
  ok('tabnya tinggal empat aset', (() => {
    const keys = [...inv.matchAll(/\{ key: '(\w+)', label: '[^']+'/g)].map((m) => m[1]);
    return JSON.stringify(keys) === '["crypto","emas","saham","forex"]';
  })());
  ok('panelnya satu komponen, dipasang sekali di MarketTab',
    /<AnalysisPanel /.test(kode('components/investment/MarketTab.tsx')));
  // Pintu pencarian "analisis" tidak boleh menuju tab yang sudah tiada.
  ok('pencarian "analisis" menuju sub-tab yang MASIH ada',
    !/tab: 'analysis'/.test(baca('lib/featureIndex.ts')) &&
    /'Analysis Pasar'[\s\S]{0,120}tab: 'emas'/.test(baca('lib/featureIndex.ts')));
  ok('ikon tab yang jadi yatim ikut dibuang',
    !/^\s*'sparkles':/m.test(kode('components/ui/icon-symbol.tsx')));
}

// =====================================================================
console.log('\n=== 3. 📤 Laporan keuangan PDF berkolom bulan ===');
// =====================================================================
{
  // ---- Deret bulannya ----
  const tiga = R.reportMonths(2026, 8, 3); // berakhir September 2026
  ok('rentang berakhir di bulan yang dibuka, urut lama → baru',
    tiga.map((m) => m.id).join(',') === '2026-07,2026-08,2026-09');
  ok('judul kolomnya singkat', tiga.map((m) => m.label).join(',') === 'Jul,Agu,Sep');
  // Melintasi tahun → tahunnya WAJIB ikut, kalau tidak "Jan" yang mana?
  const duabelas = R.reportMonths(2026, 8, 12);
  ok('12 bulan: melintasi tahun, jadi tahunnya ikut di judul kolom',
    duabelas.length === 12 && duabelas[0].id === '2025-10' &&
    duabelas[0].label === 'Okt 25' && duabelas[11].label === 'Sep 26');
  const batas = R.reportBounds(tiga);
  ok('batas kueri: awal bulan pertama sampai SEBELUM awal bulan sesudahnya',
    batas.start.getTime() === new Date(2026, 6, 1).getTime() &&
    batas.end.getTime() === new Date(2026, 9, 1).getTime());

  // ---- Angkanya: DIJALANKAN ----
  const items = [
    tx(2026, 6, 5, 'income', 'salary', 10_000_000),
    tx(2026, 6, 10, 'expense', 'snacks', 300_000),
    tx(2026, 6, 20, 'expense', 'snacks', 200_000),
    tx(2026, 7, 3, 'expense', 'snacks', 450_000),
    tx(2026, 7, 9, 'income', 'salary', 10_000_000),
    tx(2026, 8, 1, 'expense', 'groceries', 1_000_000),
    tx(2026, 8, 2, 'saving', 'emergency-fund', 500_000),
    tx(2026, 8, 4, 'income', 'salary', 10_000_000),
    // Di LUAR rentang: tidak boleh ikut terhitung.
    tx(2026, 5, 1, 'expense', 'snacks', 9_999_999),
  ];
  const lap = R.buildFinanceReport(items, tiga);

  ok('transaksi di luar rentang diabaikan', lap.txCount === 8);
  const snacks = lap.sections
    .find((s) => s.type === 'expense')
    .rows.find((r) => r.key === 'snacks');
  ok('satu kategori, satu baris, angkanya per bulan',
    JSON.stringify(snacks.perMonth) === '[500000,450000,0]' && snacks.total === 950_000);
  const expense = lap.sections.find((s) => s.type === 'expense');
  ok('subtotal bagian = jumlah barisnya',
    JSON.stringify(expense.totalPerMonth) === '[500000,450000,1000000]' &&
    expense.total === 1_950_000);
  // Kategori yang nol di SELURUH rentang tidak boleh jadi baris: dua puluh
  // baris nol cuma menyembunyikan baris yang benar-benar berisi.
  ok('kategori yang nol di seluruh rentang tidak ikut jadi baris',
    expense.rows.every((r) => r.total > 0) && expense.rows.length === 2);
  ok('sisa bersih = income dikurangi expense + saving + investment',
    JSON.stringify(lap.netPerMonth) === '[9500000,9550000,8500000]' &&
    lap.netTotal === 27_550_000);
  // Urutan barisnya mengikuti daftar kategori app, BUKAN besarnya angka:
  // laporan bulan ini & bulan depan harus bisa ditumpuk dan dibandingkan.
  ok('urutan barisnya tetap (bisa dibandingkan antar-laporan)', (() => {
    const kebalik = R.buildFinanceReport([...items].reverse(), tiga);
    const kunci = (l) => l.sections.find((s) => s.type === 'expense').rows.map((r) => r.key);
    return JSON.stringify(kunci(lap)) === JSON.stringify(kunci(kebalik));
  })());
  ok('laporan tanpa transaksi tetap sah (bukan crash)', (() => {
    const kosong = R.buildFinanceReport([], tiga);
    return kosong.txCount === 0 && kosong.netTotal === 0 &&
      kosong.sections.every((s) => s.rows.length === 0);
  })());
  ok('judul laporannya menyebut rentangnya',
    R.reportTitle(tiga) === 'Juli 2026 sampai September 2026' &&
    R.reportTitle(R.reportMonths(2026, 8, 1)) === 'September 2026');

  // ---- Rupanya ----
  const pdf = baca('lib/financeReportPdf.ts');
  ok('bentuknya TABEL, kategori ke bawah & bulan ke samping',
    /<table class="tabel">/.test(pdf) && /<th scope="col">\$\{escapeHtml\(m\.label\)\}/.test(pdf));
  ok('ada kolom Total di ujung kanan & baris Sisa bersih di bawah',
    /<th scope="col">Total<\/th>/.test(pdf) && /'Sisa bersih'/.test(pdf));
  // Dua belas kolom angka di kertas tegak terlalu sempit untuk dibaca,
  // apalagi ditunjukkan ke orang lain.
  ok('kertasnya MENDATAR begitu bulannya lebih dari tiga',
    /laporan\.months\.length > 3/.test(pdf) &&
    /landscape \? \{ width: 792, height: 612 \} : \{\}/.test(baca('lib/pdfDoc.ts')));
  ok('memakai kerangka PDF bersama (kop, logo, kaki), bukan HTML sendiri',
    /pdfShellHtml\(/.test(pdf) && /sharePdf\(/.test(pdf) && /pdfFileName\(/.test(pdf));
  ok('teksnya di-escape, jadi nama kategori aneh tidak merusak HTML-nya',
    /escapeHtml\(/.test(pdf));
  ok('angka hitungannya TIDAK dihitung ulang di berkas rupanya',
    !/reduce\(/.test(pdf));

  // ---- Tombol & pilihannya ----
  const rev = kode('app/finance-review.tsx');
  ok('empat pilihan rentang: 1 · 3 · 6 · 12 bulan',
    JSON.stringify(R.REPORT_RANGES.map((r) => r.months)) === '[1,3,6,12]');
  ok('tombol 📤 ada di Monthly Review (bukan Weekly)',
    /kind === 'month' \? \(\s*\n?\s*<EmojiButton emoji="📤"/.test(rev));
  ok('rentangnya dipilih dulu lewat sheet, bukan langsung membuat 12 bulan',
    /REPORT_RANGES\.map\(/.test(rev) && /bagikanLaporan\(r\.months\)/.test(rev));
  // Dibaca SEKALI JALAN: melanggan selusin bulan di latar demi satu berkas
  // yang dibuat sesekali cuma menambah pembacaan Firestore yang tak terpakai.
  ok('transaksinya dibaca sekali jalan, bukan dilanggan',
    /await fetchTransactionsRange\(user\.uid, start, end\)/.test(rev) &&
    /export async function fetchTransactionsRange/.test(baca('lib/transactions.ts')) &&
    /await getDocs\(rangeQuery\(uid, start, end\)\)/.test(baca('lib/transactions.ts')));
  // Bentuk barisnya WAJIB sama dengan langganannya — kalau tidak, laporan dan
  // layar bisa membaca dokumen yang sama dengan bentuk berbeda.
  ok('bentuk barisnya sama dengan langganannya (satu pemeta bernama)',
    /return \{ \.\.\.d\.data\(\), id: d\.id \} as Transaction;/.test(
      baca('lib/transactions.ts')) &&
    /liveList<Transaction>\(rangeQuery\(uid, start, end\), onChange, onError, baris\)/.test(
      baca('lib/transactions.ts')));
  ok('gagal cetak pakai pesan bersama, bukan kalimat karangan sendiri',
    /setBagikanError\(pdfErrorOf\('laporan'\)\)/.test(rev));
}

// =====================================================================
console.log('\n=== 4. 🔴 Angka di ikon app ===');
// =====================================================================
{
  const nf = kode('lib/notify.ts');
  const tabs = kode('app/(tabs)/_layout.tsx');

  // SEBAB bug-nya: `model.today.length` dipangkas ke TODAY_MAX, jadi begitu
  // ada tujuh hal atau lebih, ikonnya menempel di 7 dan terlihat macet.
  ok('TODAY_MAX memang 7 (itu sebab angka lamanya mentok)',
    /export const TODAY_MAX = 7;/.test(baca('lib/today.ts')));
  ok('angkanya tidak lagi diambil dari daftar Today yang sudah dipangkas',
    !/setBadgeCountAsync\(jumlahHariIni\)/.test(nf));
  ok('sekarang = jumlah badge CORE + Work yang kelihatan di dalam app',
    /setAppBadge\(coreBadge \+ workBadge\)/.test(tabs));
  // Dipasang dari layar tab, bukan layar Today: layar tab selalu hidup selama
  // app dibuka, jadi angkanya ikut berubah di layar mana pun kamu berada.
  ok('dipasang dari layar tab (selalu hidup), bukan dari layar Today',
    /useEffect\(\(\) => \{\s*\n\s*setAppBadge\(/.test(tabs) &&
    !/setAppBadge/.test(kode('hooks/useTodayData.ts')));
  ok('angka yang sama tidak ditulis dua kali ke sistem',
    /if \(n === badgeTerakhir\) return;/.test(nf));
  ok('tidak pernah negatif & selalu bulat', /Math\.max\(0, Math\.round\(jumlah\)\)/.test(nf));
  ok('pengingat dimatikan → angkanya dinolkan & sidiknya dilupakan',
    /setBadgeCountAsync\(0\)/.test(nf) && /badgeTerakhir = -1;/.test(nf));
  // Kedua badge itu dihitung dari fungsi yang SAMA dengan badge sub-tab di
  // dalam layarnya — itu yang membuat jumlahnya bisa dicocokkan sendiri.
  ok('kedua angkanya dari fungsi yang sama dengan badge sub-tabnya',
    /coreAttention\(\{/.test(tabs) && /workAttention\(\{/.test(tabs));
}

// =====================================================================
console.log('\n=== 5. 📋 Salin mutasi di fitur Saku ===');
// =====================================================================
{
  const saku = kode('app/saku/[key].tsx');
  ok('tombol 📋 di kanan judul modal Edit Entry',
    /headerRight=\{/.test(saku) && /<CopyChip/.test(saku));
  ok('bentuknya sama dengan tombol salin di tab Transaksi',
    /from '@\/components\/common\/CopyAction'/.test(baca('app/saku/[key].tsx')) &&
    /from '@\/components\/common\/CopyAction'/.test(
      baca('components/finance/TransactionsTab.tsx')));
  ok('konfirmasinya inline (iOS tidak menampilkan modal di atas modal)',
    /<CopyConfirm/.test(saku) && /confirmCopy && \(/.test(saku));
  // Salinannya DATA BARU bertanggal hari ini; aslinya tidak disentuh.
  ok('salinannya entri BARU, bukan mengubah yang lama',
    /await addFundEntry\(user\.uid, key, \{/.test(saku) &&
    !/updateFundEntry[\s\S]{0,200}handleCopy/.test(saku));
  ok('arah masuk/keluarnya ikut tersalin',
    /direction: editing\.direction,/.test(saku));
  // addFundEntry satu batch dengan saldo dompetnya, jadi saldo mustahil
  // ketinggalan dari entrinya.
  ok('saldo saku ikut berubah dalam satu batch yang sama',
    /const batch = writeBatch\(db\);[\s\S]{0,400}balance: increment\(/.test(
      baca('lib/saku.ts')));
  ok('isian tak sah ditolak sebelum menulis apa pun',
    /const invalid = validate\(editTitle, editCause, value\);[\s\S]{0,200}setConfirmCopy\(false\);/.test(saku));
}

// =====================================================================
console.log('\n=== 6. 🔔 Lonceng Work menuju Reminder kategori WORK ===');
// =====================================================================
{
  const work = kode('app/(tabs)/work.tsx');
  ok('tujuannya membawa kategorinya',
    /router\.push\(\{ pathname: '\/tasks', params: \{ category: 'work' \} \}\)/.test(work));
  ok('badge-nya memang menghitung task WORK hari ini',
    /badge=\{perhatian\.tasks\}/.test(work) &&
    /Task kategori WORK hari ini yang belum dicentang/.test(baca('lib/career.ts')));
  // Kategori itu harus benar-benar dikenali layar tujuannya, bukan diabaikan
  // diam-diam lalu jatuh ke PERSONAL seperti sebelumnya.
  ok('layar Reminder memang membaca & memakai param kategorinya',
    /TASK_CATEGORIES\.some\(\(c\) => c\.key === categoryParam\)/.test(baca('app/tasks.tsx')) &&
    /\{ key: 'work', label: 'WORK'/.test(baca('lib/tasks.ts')));
}

// =====================================================================
console.log('\n=== 7. Aturan tetap proyek ===');
// =====================================================================
{
  const jalur = [
    'lib/financeReport.ts', 'lib/financeReportPdf.ts', 'lib/transactions.ts',
    'components/common/DeleteX.tsx', 'components/common/InlineDelete.tsx',
    'components/investment/AnalysisPanel.tsx',
    'app/finance-review.tsx', 'app/debts.tsx', 'app/saku/[key].tsx',
    'app/(tabs)/work.tsx', 'app/(tabs)/_layout.tsx',
  ];
  const berkas = jalur.map(baca);
  const berhex = jalur.filter((f) => !/financeReportPdf/.test(f) && /#[0-9A-Fa-f]{6}/.test(baca(f)));
  // financeReportPdf memang memegang warna CETAK (PDF itu HTML, bukan layar);
  // warna layar tetap wajib lewat token Color.
  ok('warna layar semua dari Color; hex cuma di PDF (HTML cetak)',
    berhex.length === 0, berhex.join(', '));
  ok('istilahnya "click", bukan klik/ketuk/tekan',
    !berkas.some((s) => /\b(klik|Klik|ketuk|Ketuk|tekan|ditekan|menekan)\b/.test(s)));
  const emDash = [];
  for (const s of jalur.map(kode)) {
    for (const m of s.match(/'[^'\n]*'|`[^`\n]*`|"[^"\n]*"/g) || []) {
      if (m.includes(String.fromCharCode(0x2014))) emDash.push(m.slice(0, 40));
    }
  }
  ok('tanpa tanda pisah panjang di teks yang tampil', emDash.length === 0, emDash.join(' | '));
  ok('judul layar & sheet tetap Inggris',
    /title="📤 Share Financial Report"/.test(baca('app/finance-review.tsx')));
  ok('tanpa modul native baru (cukup eas update)',
    !berkas.some((s) =>
      /from 'react-native-(?!reanimated|gesture-handler|safe-area-context|svg|webview)/.test(s)));
  // PDF-nya memakai expo-print & expo-sharing yang MEMANG sudah terpasang.
  const dep = JSON.parse(baca('package.json')).dependencies;
  ok('expo-print & expo-sharing memang sudah ada sebelumnya',
    !!dep['expo-print'] && !!dep['expo-sharing']);
  ok('tidak ada soft-delete yang diselundupkan',
    !berkas.some((s) => /isDeleted|archived:/.test(s)));
}

console.log('\n' + (gagal === 0
  ? '✅ LULUS — tombol ✗, Analysis per sub-tab, laporan PDF, badge ikon, salin mutasi, lonceng Work.'
  : `❌ ${gagal} cek gagal.`));
process.exit(gagal === 0 ? 0 : 1);
