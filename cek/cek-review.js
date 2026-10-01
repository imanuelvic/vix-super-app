// 📋 Financial Review (1 Okt 2026) — sub-tab keempat Finance.
//
// Rekap bulanan pemilik app sejak 2015 masuk ke dalam app: catatan lama
// disalin ke lib/financeReview.ts, dan mulai REVIEW_LIVE_FROM app menghitung
// sendiri dari transaksinya.
//
// ── Kenapa suite ini yang paling penting di antara suite tampilan ─────────
// Angka-angka ini SUDAH DIBACA SEBELAS TAHUN di lembar aslinya. Satu saja
// yang meleset, yang terbaca bukan "app-nya salah" melainkan "ingatanku yang
// salah". Jadi yang diuji di sini bukan apakah layarnya ada, melainkan apakah
// hitungannya SAMA PERSIS dengan lembar aslinya: tiap TOTAL bulanan 2022
// sampai 2026, tiap total tahunan 2015 sampai 2026, dan rata-ratanya.
//
// Angka pembanding di bawah disalin langsung dari baris TOTAL & AVERAGE di
// spreadsheet-nya, BUKAN dari hasil hitungan modul yang diuji.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-review');
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
    ['tsc', path.join(ROOT, 'lib/financeReview.ts'), '--ignoreConfig',
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
const R = require(path.join(OUT, 'financeReview.js'));
Module._load = asli;

// ============ Angka pembanding, disalin dari spreadsheet aslinya ============

/** Baris TOTAL tiap bulan (Januari sampai Desember). null = belum ada. */
const TOTAL_BULANAN = {
  2022: [5395000, 3912500, 3986500, 6645000, 8837500, 6228000, 6565500, 7298500, 8161500, 9732500, 9050500, 12856000],
  2023: [7738000, 8276500, 8440000, 9892500, 10698000, 10355500, 10138500, 8091000, 9290500, 9245000, 8947500, 12376500],
  2024: [10460000, 7278889, 8784726, 5989432, 8004345, 11348706, 8886250, 10249150, 10992800, 10688064, 11882679, 8872033],
  2025: [13621299, 9510859, 10141946, 10961715, 23953622, 14276328, 15116814, 16776025, 13292061, 12812342, 14343364, null],
  2026: [16173436, 12283600, 15587900, 14628284, 15229408, 12504144, null, null, null, null, null, null],
};

/** Kolom TOTAL di ujung kanan tiap tahun. */
const TOTAL_TAHUNAN = {
  2015: { keluar: 5243500 },
  2016: { keluar: 35748000 },
  2017: { masuk: 43363800, keluar: 41974000 },
  2018: { masuk: 30421500, keluar: 20713100 },
  2019: { masuk: 23450000 },
  2020: { masuk: 22800000 },
  2021: { masuk: 34900000, keluar: 6527000 },
  2022: { masuk: 97250000, keluar: 88669000 },
  2023: { masuk: 116500000, keluar: 113489500 },
  2024: { masuk: 123097205, keluar: 113437074 },
  2025: { masuk: 142738430, keluar: 154806375 },
  2026: { masuk: 75032500, keluar: 86406772 },
};

/** Kolom AVERAGE di ujung kanan. */
const RATA = {
  2015: { keluar: 1747833 },
  2018: { keluar: 2959014 },
  2020: { masuk: 1900000 },
  2024: { masuk: 10258100, keluar: 9453090, sisa: 805011 },
  2026: { masuk: 10718929, keluar: 14401129, sisa: -3682200 },
};

const tahun = R.reviewYears();
const cari = (y) => tahun.find((t) => t.year === y);

// =====================================================================
console.log('\n=== 1. Angkanya SAMA PERSIS dengan lembar aslinya ===');
// =====================================================================
{
  const salahBulan = [];
  for (const [y, deret] of Object.entries(TOTAL_BULANAN)) {
    const t = cari(Number(y));
    deret.forEach((harap, i) => {
      if (harap === null) return;
      if (t.months[i].outflow !== harap) {
        salahBulan.push(`${y}-${i + 1}: ${t.months[i].outflow} ≠ ${harap}`);
      }
    });
  }
  ok('TOTAL tiap bulan 2022 sampai 2026 cocok (56 angka)',
    salahBulan.length === 0, salahBulan.slice(0, 4).join(' · '));

  const salahTahun = [];
  for (const [y, t] of Object.entries(TOTAL_TAHUNAN)) {
    const h = cari(Number(y));
    if (t.masuk !== undefined && h.income.total !== t.masuk) {
      salahTahun.push(`${y} masuk ${h.income.total} ≠ ${t.masuk}`);
    }
    if (t.keluar !== undefined && h.outflow.total !== t.keluar) {
      salahTahun.push(`${y} keluar ${h.outflow.total} ≠ ${t.keluar}`);
    }
  }
  ok('TOTAL tiap tahun 2015 sampai 2026 cocok',
    salahTahun.length === 0, salahTahun.slice(0, 4).join(' · '));

  const salahRata = [];
  for (const [y, r] of Object.entries(RATA)) {
    const h = cari(Number(y));
    if (r.masuk !== undefined && h.income.average !== r.masuk) salahRata.push(`${y} masuk`);
    if (r.keluar !== undefined && h.outflow.average !== r.keluar) salahRata.push(`${y} keluar`);
    if (r.sisa !== undefined && h.balance.average !== r.sisa) {
      salahRata.push(`${y} sisa ${h.balance.average} ≠ ${r.sisa}`);
    }
  }
  ok('AVERAGE cocok, termasuk yang bulannya belum penuh',
    salahRata.length === 0, salahRata.join(' · '));
}

// =====================================================================
console.log('\n=== 2. Aturan hitungnya ===');
// =====================================================================
{
  // Rata-rata membagi dengan BULAN YANG TERISI, bukan dengan dua belas. 2026
  // pemasukannya 7 bulan, pengeluarannya 6 — kalau dibagi 12 dua-duanya
  // langsung meleset jauh.
  const dua6 = cari(2026);
  ok('rata-rata dibagi jumlah bulan terisi, bukan 12',
    dua6.income.months === 7 && dua6.expense.months === 6 &&
    dua6.income.average === Math.round(dua6.income.total / 7),
    `masuk ${dua6.income.months} bulan, keluar ${dua6.expense.months} bulan`);

  // Rata-rata SISA mengikuti lembar aslinya: rata masuk dikurangi rata keluar,
  // bukan rata-rata dari sisa tiap bulan. Dua-duanya "benar", tapi yang kedua
  // berselisih dengan angka yang sudah dibaca bertahun-tahun.
  ok('rata-rata sisa = rata masuk dikurangi rata keluar',
    dua6.balance.average === -3682200 &&
    dua6.balance.average !== Math.round(dua6.balance.total / 7));

  // `null` ≠ 0. Pemasukan 2020 memang bernilai nol di beberapa bulan (dicatat,
  // nilainya nol) dan itu IKUT membagi rata-rata; bulan yang tak pernah
  // dicatat tidak ikut.
  const duaNol = cari(2020);
  ok('nol yang DICATAT ikut membagi rata-rata',
    duaNol.income.months === 12 && duaNol.income.average === 1900000);
  ok('bulan yang tak pernah dicatat tidak ikut membagi',
    cari(2015).expense.months === 3);
  ok('bulan kosong bertanda null, bukan 0',
    cari(2015).months[0].expense === null && cari(2015).months[9].expense === 1946500);

  // Tanpa catatan pemasukan, "sisa" cuma pengeluaran yang dibalik tandanya.
  ok('sisa null kalau pemasukannya memang tak pernah dicatat',
    cari(2016).months[0].balance === null && cari(2016).months[0].outflow === 2150000);
  // Sebaliknya: ada pemasukan tapi pengeluaran belum dicatat → sisa = masuk.
  ok('masuk tanpa keluar: sisanya seluruh pemasukan (Juli 2026)',
    cari(2026).months[6].outflow === null && cari(2026).months[6].balance === 10990000);

  ok('keluar = pengeluaran + tabungan + investasi',
    cari(2026).months[0].outflow ===
      cari(2026).months[0].expense + cari(2026).months[0].saving + cari(2026).months[0].investment);
  ok('tahun terbaru di depan', tahun[0].year > tahun[tahun.length - 1].year);
}

// =====================================================================
console.log('\n=== 3. App mengambil alih mulai REVIEW_LIVE_FROM ===');
// =====================================================================
{
  const tx = (y, m, d, type, amount) => ({
    id: `${y}${m}${d}${type}${amount}`,
    type,
    category: 'x',
    amount,
    date: { toDate: () => new Date(y, m, d), toMillis: () => new Date(y, m, d).getTime() },
  });

  const per = R.liveMonths([
    tx(2026, 8, 3, 'income', 12_000_000),
    tx(2026, 8, 5, 'expense', 4_000_000),
    tx(2026, 8, 9, 'expense', 1_000_000),
    tx(2026, 8, 20, 'saving', 2_000_000),
    tx(2026, 8, 21, 'investment', 500_000),
    tx(2026, 9, 2, 'income', 11_000_000),
  ]);
  ok('transaksi dikelompokkan per bulan & per jenis',
    per['2026-09'].income === 12_000_000 && per['2026-09'].expense === 5_000_000 &&
    per['2026-09'].saving === 2_000_000 && per['2026-09'].investment === 500_000 &&
    per['2026-10'].income === 11_000_000);

  const dengan = R.reviewYears(per);
  const y26 = dengan.find((t) => t.year === 2026);
  ok('September 2026 diambil dari transaksi app',
    y26.months[8].income === 12_000_000 && y26.months[8].source === 'app' &&
    y26.months[8].outflow === 7_500_000);
  ok('Januari 2026 TETAP dari catatan lama, tidak tertimpa',
    y26.months[0].income === 9_565_000 && y26.months[0].source === 'catatan');
  ok('tahunnya ditandai sebagian hidup', y26.live === true);

  // Transaksi SEBELUM garis batas tidak boleh menimpa catatan lama, walau
  // kebetulan ada di Firestore (mis. transaksi Juli 2026 dari masa app ini
  // baru lahir). Catatan lama yang menang, karena ia yang utuh sebulan penuh.
  const sebelum = R.reviewYears(R.liveMonths([tx(2026, 0, 5, 'income', 999)]));
  ok('transaksi sebelum garis batas diabaikan',
    sebelum.find((t) => t.year === 2026).months[0].income === 9_565_000);

  ok('garis batasnya satu baris, mudah digeser',
    /export const REVIEW_LIVE_FROM = '\d{4}-\d{2}';/.test(baca('lib/financeReview.ts')));

  // Tahun yang belum ada di catatan lama ikut terbit sendiri, jadi berkasnya
  // tidak perlu disunting tiap ganti tahun.
  const depan = R.reviewYears(R.liveMonths([tx(2027, 1, 4, 'income', 5_000_000)]));
  ok('tahun baru muncul sendiri tanpa menyunting kode',
    depan[0].year === 2027 && depan[0].months[1].income === 5_000_000);
}

// =====================================================================
console.log('\n=== 4. Sub-tab Review & tombol header ===');
// =====================================================================
{
  const fin = kode('app/finance.tsx');

  // 1 Okt 2026: Budgeting & Dashboard bertukar tempat (lihat
  // cek-budget-recap.js), jadi Review tidak lagi bertetangga dengan Budgeting.
  // Yang dijaga tetap sama: ia sub-tab PALING KANAN.
  ok('Review jadi sub-tab PALING KANAN',
    /\{ key: 'review', label: 'Review'[^}]*\},\s*\n\];/.test(fin));
  ok('tipenya ikut, bukan cuma daftarnya',
    /type FinanceTab = 'dashboard' \| 'transactions' \| 'budgeting' \| 'review';/.test(fin));

  // Inti permintaan kedua: 🤝 & 👛 cuma di Transaksi.
  ok('🤝 Pinjaman & 👛 Saku HANYA di sub-tab Transaksi',
    /tab === 'transactions' \? \(\s*\n\s*<View style=\{styles\.headerButtons\}>/.test(fin) &&
    /\) : undefined\s*\n\s*\}\s*\n\s*\/>/.test(fin));
  ok('navigasi BULAN tidak ikut tampil di Review (ia punya navigasi tahun)',
    /\{tab !== 'review' && \(/.test(fin));

  // Rekap sebelas tahun tidak perlu hidup per detik, dan selama sub-tab lain
  // yang dibuka ia tidak boleh membaca Firestore sama sekali.
  ok('transaksinya DIAMBIL SEKALI saat sub-tabnya dibuka, bukan dilanggan',
    /if \(!user \|\| !unlocked \|\| tab !== 'review' \|\| reviewTx !== null\) return;/.test(fin) &&
    /fetchTransactionsRange\(user\.uid, reviewLiveStart\(\)/.test(fin));
  ok('kebocoran setState sesudah layar ditutup dijaga',
    /let hidup = true;[\s\S]{0,320}if \(hidup\) setReviewTx\(rows\);/.test(fin));
}

// =====================================================================
console.log('\n=== 5. Tampilan & PDF ===');
// =====================================================================
{
  const tab = kode('components/finance/ReviewTab.tsx');
  const pdf = baca('lib/financeReviewPdf.ts');

  // Di layar HP bulan HARUS turun ke bawah; dua belas kolom angka tidak
  // pernah terbaca utuh di layar selebar 393pt.
  ok('di layar bulannya turun ke bawah, kolomnya cuma masuk/keluar/sisa',
    /aktif\.months\.map\(\(m\) => \(/.test(tab) &&
    />\s*Masuk\s*<\/VixText>/.test(tab) && />\s*Keluar\s*<\/VixText>/.test(tab) &&
    />\s*Sisa\s*<\/VixText>/.test(tab));
  ok('di iPad tabelnya berhenti di tengah, tidak melar ke tepi',
    /kolom: \{ \.\.\.CONTENT_COLUMN \}/.test(tab));
  ok('dua belas baris selalu digambar, yang kosong cuma dipudarkan',
    /barisKosong: \{ opacity: 0\.45 \}/.test(tab) &&
    /\[styles\.baris, kosong && styles\.barisKosong\]/.test(tab));
  ok('ada TOTAL & RATA-RATA di kaki tabel',
    /label="TOTAL"/.test(tab) && /label="RATA-RATA"/.test(tab));
  ok('daftar semua tahun bisa di-click untuk berpindah',
    /onPress=\{\(\) => setYear\(t\.year\)\}/.test(tab));
  ok('tombol 📤 berdiri di sebelah tahun yang sedang dilihat',
    /<EmojiButton emoji="📤" busy=\{bagikanBusy\} onPress=\{bagikan\} \/>/.test(tab));
  ok('galat PDF-nya memakai pesan bersama',
    /pdfErrorOf\('rekap'\)/.test(tab));

  // Di kertas mendatar bentuk lembar aslinya justru yang paling enak dibaca.
  ok('PDF-nya SELALU mendatar (dua belas kolom bulan)',
    /sharePdf\(\s*\n\s*financeReviewHtml\(tahun, semua, dibuat\),[\s\S]{0,160}true,\s*\n\s*\);/.test(pdf));
  ok('di kertas bulannya melintang, seperti lembar aslinya',
    /MONTH_NAMES\.map\(/.test(pdf) && /<th scope="col">Rata-rata<\/th>/.test(pdf));
  ok('rinciannya dibuka: pengeluaran, tabungan & investasi berdiri sendiri',
    /barisHtml\('Pengeluaran'/.test(pdf) && /barisHtml\('Tabungan'/.test(pdf) &&
    /barisHtml\('Investasi'/.test(pdf));
  ok('tabel semua tahun ikut tercetak',
    /Semua Tahun/.test(pdf) && /class="tahun"/.test(pdf));
  // Permintaannya terang: tanggalnya DI BAWAH laporannya.
  ok('tanggal dibagikan ada DI BAWAH laporannya',
    /class="dibagikan"/.test(pdf) &&
    pdf.indexOf('catatan + dibagikan') > 0);
  ok('angkanya tidak dihitung ulang di PDF',
    !/\.reduce\(/.test(pdf) && !/months \* /.test(pdf));
}

console.log(
  gagal === 0 ? '\n✅ SEMUA LULUS.' : `\n❌ ${gagal} cek gagal.`,
);
process.exit(gagal === 0 ? 0 : 1);
