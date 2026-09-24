// Dua permintaan:
//   1. PDF Timeline — tahunnya tercetak DUA KALI di baris tonggak tahun (jelek)
//   2. Career — subtitle diganti (soal semangat kerja) & sub-tab Insurance
//      dihapus PERMANEN, termasuk semua yang perihal agent asuransi
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-timeline-career');
const baca = (f) => fs.readFileSync(R + f, 'utf8');
const ada = (f) => fs.existsSync(R + f);
/** Buang komentar — kalau tidak, komentar yang MENYEBUT nama yang sudah dihapus
 *  membuat pemeriksaan "tak ada lagi" gagal padahal kodenya sudah bersih. */
const tanpaKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

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
      R + 'lib/timelinePdf.ts',
      R + 'lib/career.ts',
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

const cetakan = { html: null };
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: (_db, ...seg) => seg.join('/'),
      doc: (_db, ...seg) => seg.join('/'),
      getDocs: async () => ({ docs: [] }),
      setDoc: () => Promise.resolve(),
      Timestamp: { fromDate: (d) => ({ toDate: () => d }) },
      deleteDoc: () => {}, onSnapshot: () => {}, orderBy: () => {},
      query: () => {}, where: () => {}, limit: () => {}, getDoc: () => {},
    };
  }
  if (req === 'expo-print') {
    return {
      printToFileAsync: async ({ html }) => {
        cetakan.html = html;
        return { uri: '/tmp/palsu.pdf' };
      },
    };
  }
  if (req === 'expo-sharing') {
    return { isAvailableAsync: async () => true, shareAsync: async () => {} };
  }
  if (req === 'expo-file-system') {
    return {
      File: class {
        constructor() { this.uri = '/tmp/palsu.pdf'; this.exists = false; }
        rename() {} delete() {}
        get parentDirectory() { return '/tmp'; }
      },
    };
  }
  if (req === '@/assets/logoCoreGwu') {
    return { LOGO_CORE_GWU_DATA_URI: 'data:image/png;base64,AA' };
  }
  if (/\/firebase$/.test(req)) return { db: {} };
  if (/\/liveDoc$/.test(req)) return { liveDoc: (ref) => ref, liveList: () => () => {} };
  if (/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const { shareTimelinePdf } = require(M('timelinePdf'));
Module._load = asli;

const pdfSrc = baca('lib/timelinePdf.ts');
const layarCareer = baca('app/(tabs)/work.tsx');
const libCareer = baca('lib/career.ts');
const dash = baca('app/reminders.tsx');

(async () => {
  // =================================================================
  console.log('\n== 1. PDF Timeline: tahunnya cuma sekali per tonggak ==');
  // =================================================================
  const TAHUN = [
    {
      year: 2026,
      items: [
        { id: 'a', title: 'Holiday in Jogja', category: 'fun', month: 11, done: false },
      ],
    },
    {
      year: 2027,
      items: [
        { id: 'b', title: 'Finish Ayub', category: 'spirituality', month: 2, done: false },
        { id: 'c', title: 'Fasih Bahasa Inggris', category: 'future', month: 11, done: false },
      ],
    },
  ];
  await shareTimelinePdf(TAHUN, null, null, new Date(2026, 8, 1, 12, 16));
  const html = cetakan.html;
  c('PDF-nya benar-benar tercetak', typeof html === 'string' && html.length > 0);

  // Ambil TIAP baris tonggak tahun apa adanya, lalu hitung berapa kali angka
  // tahunnya muncul di dalamnya. Inilah keluhannya: dulu 2, seharusnya 1.
  const barisTahun = [...html.matchAll(/<div class="baris tahun">[\s\S]*?<\/div>\s*<\/div>/g)]
    .map((m) => m[0]);
  c('kedua tahunnya masing-masing dapat satu tonggak', barisTahun.length === 2,
    barisTahun.length);
  for (const [i, blok] of barisTahun.entries()) {
    const th = String(TAHUN[i].year);
    const muncul = (blok.match(new RegExp(th, 'g')) ?? []).length;
    c(`${th} ditulis TEPAT sekali di tonggaknya (dulu dua kali)`, muncul === 1, muncul);
  }

  // Yang bertahan: judul besar di kanan bulatan. Yang dibuang: salinan kecil di
  // kolom kiri. Dipilih begitu supaya tonggaknya tetap terbaca dari jauh.
  c('judul tahun yang besar tetap ada di kanan bulatan',
    /<div class="tahun-judul">2026<\/div>/.test(html) &&
    /<div class="tahun-judul">2027<\/div>/.test(html));
  c('kolom kiri baris tahun dikosongkan', /<div class="kapan"><\/div>/.test(html));
  c('tak ada lagi tahun tebal di kolom kiri', !/<div class="kapan"><b>/.test(html));
  c('aturan gaya .kapan b ikut dibuang (bukan cuma HTML-nya)',
    !/\.kapan b \{/.test(pdfSrc) && !/\.kapan b \{/.test(html));

  // Yang TIDAK boleh ikut hilang.
  c('bulatan besar penanda tahun tetap ada', /class="titik besar"/.test(html));
  c('ringkasan tahunnya tetap ada',
    /1 wishlist · 0 tercapai/.test(html) && /2 wishlist · 0 tercapai/.test(html));
  c('baris bulan tetap menyebut bulan + tahunnya (jangkar kalau halaman terpotong)',
    /Desember<small>2026<\/small>/.test(html) && /Maret<small>2027<\/small>/.test(html));
  c('wishlistnya tetap tercetak lengkap',
    /Holiday in Jogja/.test(html) && /Finish Ayub/.test(html) &&
    /Fasih Bahasa Inggris/.test(html));
  c('garis & bulatan tonggaknya tetap ada',
    /class="garis/.test(html) && /class="titik"/.test(html));

  // =================================================================
  console.log('\n== 2. Career: subtitle baru ==');
  // =================================================================
  const sub = /subtitle="([^"]*)"/.exec(layarCareer);
  c('subtitle "Empat topi, satu panggilan" sudah tidak ada',
    !/Empat topi/.test(layarCareer));
  c('subtitle-nya soal semangat mengerjakan pekerjaan',
    !!sub && /kerja/i.test(sub[1]), sub ? sub[1] : '—');
  c('subtitle-nya pendek (muat satu baris di header)',
    !!sub && sub[1].length <= 45, sub ? sub[1].length : '—');

  // =================================================================
  console.log('\n== 3. Sub-tab Insurance dihapus PERMANEN ==');
  // =================================================================
  c('berkas komponennya benar-benar dihapus',
    !ada('components/career/InsuranceTab.tsx'));
  c('tak ada sisa berkas insurance di folder career',
    fs.readdirSync(R + 'components/career').every((n) => !/insurance/i.test(n)),
    fs.readdirSync(R + 'components/career').join(' · '));

  const blok = /const TABS[^=]*= \[([\s\S]*?)\n\];/.exec(layarCareer);
  const kunci = [...blok[1].matchAll(/key: '([^']+)'/g)].map((m) => m[1]);
  // 22 Sep 2026: tab Work menambah 'focus' di depan; insurance tetap tiada.
  c('insurance tetap tiada; urutan empat topi tetap (didahului Focus)',
    kunci.join(' · ') === 'focus · fulltime · freelance · affiliate · business',
    kunci.join(' · '));
  c('tipe CareerTab ikut (bukan cuma daftarnya)',
    /type CareerTab = 'focus' \| 'fulltime' \| 'freelance' \| 'affiliate' \| 'business';/
      .test(layarCareer));

  for (const [nama, src] of [
    ['app/(tabs)/work.tsx', layarCareer],
    ['lib/career.ts', libCareer],
    ['app/reminders.tsx', dash],
  ]) {
    c(`${nama.padEnd(22)} bersih dari insurance/asuransi`,
      !/insurance|asuransi|Manulife|Allianz/i.test(tanpaKomentar(src)));
  }
  c('lib/career tak lagi mengimpor monthId yang jadi tak terpakai',
    !/monthId/.test(libCareer));
  c('dashboard tak lagi berlangganan dokumen insurance',
    !/subscribeInsurance/.test(dash) && !/setInsurance/.test(dash));

  // Langganan yang dibuang harus benar-benar berkurang satu — bukan sekadar
  // namanya diganti. (Satu langganan = satu pembacaan Firestore terus-menerus.)
  const langgananCareer = (layarCareer.match(/\bsubscribe[A-Z]\w*\(/g) ?? []);
  c('layar Career tinggal tiga langganan (roadmap, freelance, ide affiliate)',
    langgananCareer.length === 3, langgananCareer.join(' · '));

  // =================================================================
  console.log('\n== 4. Tak ada pintu yang menuju tab yang sudah tiada ==');
  // =================================================================
  // Kartu "Produktif Hari Ini" mengirim ?tab=… ke /career. Kalau salah satunya
  // masih 'insurance', tombolnya membuka layar Career yang jatuh ke tab
  // terakhir — pengguna menekan sesuatu lalu diam-diam dibawa ke tempat lain.
  const blokProd = dash.slice(
    dash.indexOf('const productivity'),
    dash.indexOf('const showProductivity'),
  );
  const tujuan = [...blokProd.matchAll(/tab: '([^']+)'/g)].map((m) => m[1]);
  c('semua ?tab=… kartu Produktif menunjuk tab Career yang benar-benar ada',
    tujuan.length > 0 && tujuan.every((t) => kunci.includes(t)),
    tujuan.join(' · '));
  c('saran pengganti asuransi memakai tab yang memang menghasilkan (affiliate)',
    /tab: 'affiliate', text: '📣/.test(dash));
  c('sarannya tetap tiga (kartunya tidak jadi kosong sebelah)',
    (dash.match(/id: 'pg-\d'/g) ?? []).length === 3);

  // =================================================================
  console.log('\n== 5. Yang SENGAJA tidak ikut dihapus ==');
  // =================================================================
  // "Insurance ☂️" di Finance itu PENGELUARAN (bayar premi), bukan pekerjaan
  // agent. Membuangnya akan membuat transaksi lama kehilangan nama & ikonnya.
  const kat = baca('lib/categories.ts');
  c('kategori pengeluaran Insurance ☂️ di Finance tetap ada',
    // 22 Sep 2026: + pace 'fixed' (Financial Awareness), kategorinya tetap.
    /\{ key: 'insurance', label: 'Insurance', icon: '☂️', active: true, pace: 'fixed' \}/.test(kat));

  console.log('\n' + (ok ? 'LULUS: semua benar.' : 'GAGAL: ada yang tidak cocok.'));
  process.exit(ok ? 0 : 1);
})();