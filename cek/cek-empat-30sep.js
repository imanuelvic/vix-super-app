// Empat permintaan 30 Sep 2026:
//   1. 📍 Wishlist bulan berjalan ditagih TIAP SENIN sampai dicentang.
//   2. 📈 Investment: bacaan AI harian/mingguan + grafik satu layar penuh
//      yang bisa dicubit.
//   3. 🚗 Kartu atas sub-tab Parts diganti isian KILOMETER.
//   4. 🏝️ Fitur Rekreasi dihapus TOTAL.
//
// Yang bisa dijalankan, DIJALANKAN (bukan cuma dicocokkan tulisannya): rumus
// wishlist, rumus kilometer, peras deret harga, dan pembaca jawaban AI.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-empat-30sep');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
/** Isi berkas TANPA komentar — supaya cek tidak pernah membaca komentar sebagai kode. */
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
      path.join(ROOT, 'lib/timeline.ts'),
      path.join(ROOT, 'lib/car.ts'),
      path.join(ROOT, 'lib/marketAi.ts'),
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
        if (k === 'Schema') {
          return new Proxy({}, { get: () => () => ({}) });
        }
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
const TL = require(path.join(OUT, 'timeline.js'));
const CAR = require(path.join(OUT, 'car.js'));
const MA = require(path.join(OUT, 'marketAi.js'));
Module._load = asli;

const ts = (y, m, d) => {
  const dt = new Date(y, m - 1, d, 9, 0);
  return { toDate: () => dt, toMillis: () => dt.getTime() };
};

// =====================================================================
console.log('\n=== 1. 📍 Wishlist bulan berjalan ditagih tiap Senin ===');
// =====================================================================
{
  // 21 Sep 2026 = Senin, 22 Sep 2026 = Selasa.
  const senin = new Date(2026, 8, 21, 9, 0);
  const selasa = new Date(2026, 8, 22, 9, 0);
  ok('Senin dikenali sebagai hari penagihnya', TL.timelineNagDay(senin) === true);
  ok('hari lain TIDAK menagih', TL.timelineNagDay(selasa) === false);

  const items = [
    { id: 'a', title: 'Race 10K', category: 'health', month: 8, done: false },
    { id: 'b', title: 'Sudah beres', category: 'fun', month: 8, done: true },
    { id: 'c', title: 'Bulan depan', category: 'fun', month: 9, done: false },
    { id: 'd', title: 'Target tahunan', category: 'fun', month: null, done: false },
  ];
  const menunggu = TL.timelineMonthPending(items, senin).map((i) => i.id);
  ok('yang ditagih: belum dicentang DAN bulan berjalan',
    JSON.stringify(menunggu) === '["a"]', JSON.stringify(menunggu));
  // Target tahunan (month null) sengaja TIDAK ikut: ia memang tidak punya
  // bulan, jadi menagihnya tiap Senin sepanjang tahun cuma jadi kebisingan.
  ok('target tahunan tidak ikut ditagih',
    !TL.timelineMonthPending(items, senin).some((i) => i.month === null));
  // Inilah syarat berhentinya, dan satu-satunya.
  ok('semuanya dicentang → tidak ada yang ditagih lagi',
    TL.timelineMonthPending(items.map((i) => ({ ...i, done: true })), senin).length === 0);
  ok('bulan berganti → yang ditagih ikut berganti sendiri',
    TL.timelineMonthPending(items, new Date(2026, 9, 5)).map((i) => i.id).join() === 'c');

  // --- Barisnya di layar Today & langganannya ---
  const today = kode('lib/today.ts');
  ok('baris Today-nya cuma lahir di hari Senin & saat masih ada yang menunggu',
    /if \(timelineNagDay\(now\) && wishlistBulanIni\.length > 0\)/.test(today));
  ok("barisnya membuka Timeline, tempat centangnya ada",
    /id: 'timeline-month',[\s\S]{0,400}?href: \{ pathname: '\/timeline' \}/.test(today));
  // Modelnya TIDAK boleh ikut bersyarat hari Senin: notifikasinya dijadwalkan
  // MINGGUAN ke iOS, jadi penjadwalnya harus melihat isinya di hari apa pun.
  ok('model.timeline dihitung TANPA syarat hari (penjadwal mingguan butuh itu)',
    /timeline: \{\s*\n\s*pending: wishlistBulanIni\.length,/.test(baca('lib/today.ts')));

  const hook = kode('hooks/useTodayData.ts');
  ok('wishlist tahun berjalan ikut dilanggan layar Today',
    /subscribeTimelineYear\(uid, tahun, mark\('timeline', setTimeline\), fail\)/.test(hook));
  ok('tahunnya dari todayId, bukan dari jam yang berdetak tiap menit',
    /const tahun = Number\(todayId\.slice\(0, 4\)\);/.test(hook));
  ok('satu dokumen per tahun → satu pembacaan, bukan seluruh koleksi',
    /'timeline', String\(year\)/.test(baca('lib/timeline.ts')));

  const notify = kode('lib/notify.ts');
  ok("kelompok pengingatnya berdiri sendiri, jadi bisa dimatikan sendiri",
    /\| 'timeline'/.test(notify) && /key: 'timeline', emoji: '📍'/.test(notify));
  ok('pemicunya MINGGUAN Senin (weekday 2), bukan harian yang didiamkan sendiri',
    /id: 'timeline-month',[\s\S]{0,200}?weekday: 2,/.test(notify));
  // Penjaga paling penting bagian ini: slot TANPA weekday dijadwalkan HARIAN.
  ok('penjadwalnya memang membedakan weekday dari harian',
    /s\.weekday === undefined\s*\n?\s*\? \{ type: DAILY/.test(notify));
}

// =====================================================================
console.log('\n=== 2a. 🚗 Kartu atas Parts: kilometer, bukan ringkasan ===');
// =====================================================================
{
  // --- Rumusnya dijalankan sungguhan ---
  const pertama = { km: 100000, at: ts(2026, 9, 1) };
  ok('catatan pertama belum bisa menghitung laju (tidak mengarang angka)',
    CAR.odometerPerMonth(pertama) === null);
  ok('tanpa catatan sama sekali juga null', CAR.odometerPerMonth(null) === null);

  const dua = { km: 101200, at: ts(2026, 10, 1), prevKm: 100000, prevAt: ts(2026, 9, 1) };
  const laju = CAR.odometerPerMonth(dua);
  ok('dua catatan → laju km per bulan', laju !== null && Math.round(laju) === 1200,
    String(laju));
  // Odometer tidak pernah mundur; kalau angkanya turun itu salah ketik, dan
  // laju negatif akan membuat perkiraan servis 10.000 km ikut ngawur.
  ok('angka mundur (salah ketik) tidak menghasilkan laju',
    CAR.odometerPerMonth({ km: 99000, at: ts(2026, 10, 1), prevKm: 100000, prevAt: ts(2026, 9, 1) }) === null);
  // Jeda terlalu pendek: satu perjalanan jauh bisa membuat angkanya ngawur.
  ok('jeda di bawah seminggu belum dihitung',
    CAR.odometerPerMonth({ km: 100500, at: ts(2026, 9, 4), prevKm: 100000, prevAt: ts(2026, 9, 1) }) === null);

  // --- Tempat simpannya: dokumen yang SAMA, bukan koleksi baru ---
  const car = baca('lib/car.ts');
  ok('menumpang dokumen status sparepart (nol listener & nol baca tambahan)',
    /function carPartsRef\(uid: string\) \{\s*\n\s*return doc\(db, 'users', uid, 'car', 'parts'\);/.test(car));
  ok('jalur Firestore-nya tidak diganti nama', !/'car', 'odometer'/.test(car));
  ok('menulisnya merge, jadi status sparepart tidak tertimpa',
    /setDoc\(carPartsRef\(uid\), \{ odometer: baru \}, \{ merge: true \}\)/.test(car));
  ok('langganannya pembaca kedua dokumen yang sama, bukan listener baru',
    /subscribeCarOdometer\(uid, setOdometer, fail\)/.test(kode('app/car.tsx')));

  // --- Kartunya ---
  const parts = kode('components/car/PartsTab.tsx');
  const kartu = baca('components/car/OdometerCard.tsx');
  ok('ringkasan "N bagian perlu perhatian" benar-benar hilang dari kartunya',
    !/Kondisi perawatan/.test(parts) && !/countCarAttention/.test(parts));
  // Angkanya TIDAK hilang dari app: ia tetap jadi badge tab & badge tile Home,
  // dan justru itu alasan kartunya tidak perlu mengulanginya.
  ok('angkanya tetap hidup sebagai badge tab Parts',
    /countCarAttention\(parts \?\? \{\}, new Date\(\)\)/.test(kode('app/car.tsx')));
  ok('kartunya menerima isian kilometer', /<OdometerCard odometer=\{odometer\} \/>/.test(parts));
  ok('isiannya dimulai dari angka terakhir, bukan kosong',
    /setKm\(odometer \? groupDigits\(String\(odometer\.km\)\) : ''\);/.test(kode('components/car/OdometerCard.tsx')));
  ok('angka lebih kecil dari catatan terakhir DITOLAK (salah ketik)',
    /if \(odometer && angka < odometer\.km\)/.test(kode('components/car/OdometerCard.tsx')));
  ok('kosong / nol juga ditolak', /if \(angka <= 0\)/.test(kode('components/car/OdometerCard.tsx')));
  ok('gagal simpan pakai hook bersama useFormSave', /useFormSave\(\)/.test(kartu));
  ok('kartunya memakai SummaryCard bersama, bukan kotak buatan sendiri',
    /<SummaryCard>/.test(kartu) && /summaryText\.(label|value)/.test(kartu));

  // --- Tempat kartunya jadi milik pemanggil ---
  // `kode()`, bukan `baca()`: komentar di atas prop itu MENYEBUT <SummaryCard>
  // untuk menjelaskan sejarahnya, dan cek yang membaca komentar sebagai kode
  // akan merah padahal justru sudah benar.
  const up = kode('components/common/UpkeepList.tsx');
  ok('UpkeepList cuma memutuskan LETAK kartunya, isinya milik tiap fitur',
    /summary: ReactNode;/.test(up) && /\{summary\}/.test(up) && !/<SummaryCard/.test(up));
  ok('Residence tetap ringkasan tiga barisnya seperti semula',
    /<SummaryCard\s*\n\s*label="Kebersihan rumah"/.test(baca('components/residence/ChoreTab.tsx')));
}

// =====================================================================
console.log('\n=== 2b. 📈 Grafik harga satu layar penuh & bisa dicubit ===');
// =====================================================================
{
  const chart = baca('components/investment/PriceChart.tsx');
  const layar = baca('components/investment/ChartFullscreen.tsx');
  const pasar = kode('components/investment/MarketTab.tsx');

  ok('tingginya jadi prop, bawaannya TETAP seperti semula (kartu tidak bergeser)',
    /height = H,/.test(chart) && /const H = 224;/.test(chart));
  ok('seluruh hitungannya ikut prop itu, tidak ada yang tertinggal memakai H',
    /const plotH = height - PAD_T - PAD_B;/.test(chart) &&
    (chart.match(/y=\{height - AXIS_LABEL_DY\}/g) ?? []).length === 2 &&
    !/height: H \}/.test(chart));

  ok('grafiknya bisa di-click dari kartu harga',
    /onPress=\{\(\) => setBesar\(true\)\}/.test(pasar) && /<ChartFullscreen/.test(pasar));
  ok('istilahnya "click", bukan tekan/ketuk',
    /Click grafiknya untuk satu layar penuh/.test(baca('components/investment/MarketTab.tsx')));

  ok('bisa dicubit untuk memperbesar', /Gesture\.Pinch\(\)/.test(layar));
  ok('bisa digeser sesudah diperbesar', /Gesture\.Pan\(\)/.test(layar));
  // Jalan keluar yang pasti: tanpa ini, cubitan yang kelewat jauh membuat
  // bagian yang dicari hilang dari layar tanpa cara mengembalikannya.
  ok('click dua kali mengembalikan ke utuh',
    /Gesture\.Tap\(\)\s*\n?\s*\.numberOfTaps\(2\)/.test(layar));
  ok('pembesarannya berbatas, tidak bisa ditarik tak terhingga',
    /const SKALA_MIN = 1;/.test(layar) && /const SKALA_MAKS = \d+;/.test(layar) &&
    /n < SKALA_MIN \? SKALA_MIN : n > SKALA_MAKS \? SKALA_MAKS : n/.test(layar));
  // Modal itu hierarki view terpisah — tanpa root ini, gesturnya mati diam.
  ok('GestureHandlerRootView dipasang di dalam Modal',
    /<Modal[\s\S]{0,200}?<GestureHandlerRootView/.test(layar));
  ok('grafik yang diperbesar tidak menimpa kepala & kaki layarnya',
    /panggung: \{\s*\n\s*flex: 1,\s*\n\s*overflow: 'hidden',/.test(layar));
  ok('deretnya sama dengan yang di kartu (tidak mengambil data lagi)',
    /series=\{data\.series\}/.test(pasar) && !/loadGold|loadBtc|fetch\(/.test(layar));
}

// =====================================================================
console.log('\n=== 2c. ✨ Bacaan AI pasar: harian & mingguan ===');
// =====================================================================
{
  // --- Peras deret harga: DIJALANKAN ---
  const deret = [];
  for (let i = 0; i < 40; i++) deret.push({ date: `2026-08-${i + 1}`, price: 1000 + i * 10 });
  const s = MA.seriesStat(deret);
  ok('harga sekarang = titik terakhir', s.now === 1390);
  ok('perubahan 1 titik dihitung benar', Math.round(s.d1 * 100) / 100 === 0.72);
  ok('tertinggi & terendah dari seluruh deret', s.high === 1390 && s.low === 1000);
  ok('posisi di rentang: sedang di puncak → 100', Math.round(s.pos) === 100);
  ok('deret terlalu pendek → null, bukan angka karangan',
    MA.seriesStat([{ date: '2026-08-01', price: 1 }]) === null);

  const brief = MA.marketBrief({ emas: s, btc: s, kurs: s });
  ok('ringkasannya menyebut ketiga asetnya',
    /EMAS/.test(brief) && /BITCOIN/.test(brief) && /KURS USD/.test(brief));
  // Inilah pagar biaya yang sebenarnya: deret 6 bulan itu ratusan titik, dan
  // mengirimnya mentah adalah cara tercepat menghabiskan kuota gratis.
  ok('yang dikirim BELASAN angka, bukan ratusan titik mentah',
    brief.length < 1200 && !/1050|1120|1240/.test(brief), String(brief.length));
  ok('satuan titiknya disebut, supaya "30 titik" tidak dibaca "sebulan persis"',
    /satu titik = satu hari perdagangan/.test(brief));

  // --- Pembaca jawaban: DIJALANKAN ---
  const sinyal = {
    arah: 'naik', keyakinan: 'sedang', ringkas: 'Emas menguat pelan.',
    alasan: ['Naik 3% sebulan.', 'Kurs melemah.'], cermati: 'Kalau kurs berbalik.',
    aksi: 'Cicil pembelian.',
  };
  const hasil = MA.finalizeMarketAnalysis({ emas: sinyal, btc: sinyal, catatan: 'Bukan nasihat.' });
  ok('jawaban benar terbaca utuh',
    hasil.emas.arah === 'naik' && hasil.btc.keyakinan === 'sedang' &&
    hasil.emas.alasan.length === 2);
  const lempar = (f) => { try { f(); return false; } catch { return true; } };
  ok('arah yang tidak dikenal DITOLAK, bukan diloloskan apa adanya',
    lempar(() => MA.finalizeMarketAnalysis({ emas: { ...sinyal, arah: 'meroket' }, btc: sinyal })));
  ok('jawaban kosong ditolak', lempar(() => MA.finalizeMarketAnalysis({})));
  ok('alasan dipangkas maksimal 4 baris',
    MA.finalizeMarketAnalysis({
      emas: { ...sinyal, alasan: ['a', 'b', 'c', 'd', 'e', 'f'] }, btc: sinyal,
    }).emas.alasan.length === 4);
  // Dua aturan gaya app ini ditegakkan di PENYARING, bukan cuma diminta ke
  // model: tanda pisah panjang & emoji.
  const kotor = MA.finalizeMarketAnalysis({
    emas: { ...sinyal, ringkas: `Emas ${String.fromCharCode(0x2014)} naik 🔥` }, btc: sinyal,
  });
  ok('tanda pisah panjang dibersihkan dari jawabannya',
    !kotor.emas.ringkas.includes(String.fromCharCode(0x2014)), kotor.emas.ringkas);
  ok('emoji dibuang (lambang arahnya dipasang app sendiri)',
    !/🔥/.test(kotor.emas.ringkas), kotor.emas.ringkas);
  ok('catatan penutup tidak pernah kosong',
    MA.finalizeMarketAnalysis({ emas: sinyal, btc: sinyal }).catatan.length > 0);

  // --- Pagar biaya & kejujuran ---
  const src = baca('lib/marketAi.ts');
  ok('lewat pagar bersama lib/aiGuard.ts (dedupe, cooldown, kunci 429)',
    /guardedAiCall\(`market\|/.test(src));
  ok('punya jatah sendiri per hari, di atas pagar umum',
    /export const MARKET_DAILY_CAP = \d+;/.test(src) && /marketAttemptsLeft/.test(src));
  ok('hasilnya disimpan per hari → membuka tabnya lagi TIDAK memanggil AI lagi',
    /AsyncStorage/.test(src) && /loadMarketAiDay|saveMarketAiDay/.test(src));
  ok('tidak menulis Firestore sama sekali untuk ini (nol baca & tulis)',
    !/firebase\/firestore/.test(src) && !/setDoc|doc\(db/.test(src));
  ok('tanpa kunci API apa pun di kode', !/AIza[\w-]{10,}|apiKey|API_KEY/.test(src));
  ok('tanpa Vertex AI / Cloud Function (proyek wajib tetap Spark)',
    !/vertex|Vertex|functions|onCall/.test(src));
  // Ini bukan penasihat keuangan, dan promptnya harus mengatakannya sendiri.
  ok('prompt melarang angka ramalan yang pasti',
    /JANGAN menyebut angka ramalan yang pasti/.test(src));
  ok('prompt melarang menyuruh beli atau menjual',
    /JANGAN menyuruh membeli atau menjual/.test(src));
  ok('prompt melarang mengarang berita', /JANGAN mengarang berita/.test(src));
  ok('data campur aduk → jawabannya "sideways", bukan dipaksa punya arah',
    /jawab "sideways" dengan keyakinan "rendah"/.test(src));
  ok('kurs USD ikut dibaca, karena harganya dalam Rupiah',
    /KURS USD ke IDR ikut menggerakkannya/.test(src));

  // --- Layarnya ---
  const tab = kode('components/investment/AnalysisTab.tsx');
  ok('dua rentang: harian & mingguan',
    /key: 'harian'/.test(tab) && /key: 'mingguan'/.test(tab));
  ok('beritanya dari RSS publik yang sudah ada, bukan sumber berbayar baru',
    /fetchNews\('crypto'\)/.test(tab) && /fetchNews\('bloomberg'\)/.test(tab));
  ok('satu sumber berita mati tidak membatalkan bacaannya',
    /Promise\.allSettled/.test(tab));
  ok('angka yang dibaca AI ikut ditampilkan, jadi jawabannya bisa diperiksa',
    /Angka yang dibaca/.test(baca('components/investment/AnalysisTab.tsx')));
  ok('sisa jatah hari ini diberitahu terus terang',
    /Sisa \$\{sisa\} dari \$\{MARKET_DAILY_CAP\} bacaan hari ini/.test(baca('components/investment/AnalysisTab.tsx')));
  ok('jatah habis → tombolnya mati, bukan mencoba lalu gagal',
    /disabled=\{!pasar \|\| hari === null \|\| sisa === 0\}/.test(tab));
  ok('peringatan "bukan nasihat keuangan" ada di layarnya sendiri',
    /BUKAN\s*\n?\s*nasihat\s*\n?\s*keuangan/.test(baca('components/investment/AnalysisTab.tsx')));
  ok('tabnya terdaftar & ada di pencarian fitur',
    /\{ key: 'analysis', label: 'Analysis', icon: 'sparkles' \}/.test(baca('app/investment.tsx')) &&
    /params: \{ tab: 'analysis' \}/.test(baca('lib/featureIndex.ts')));
  ok('emas, BTC & kurs diambil sekaligus (dibaca bersama, bukan sendiri-sendiri)',
    /export async function loadMarketAll/.test(baca('lib/market.ts')) &&
    /loadMarketAll/.test(tab));
}

// =====================================================================
console.log('\n=== 3. 🏝️ Rekreasi dihapus total ===');
// =====================================================================
{
  ok('kategorinya tinggal Summit & Race',
    /export type FunCategory = 'summit' \| 'race';/.test(baca('lib/fun.ts')));
  // Kategori "reflection" ikut dibuang: sejak 30 Agu 2026 ia tidak punya tab
  // sendiri dan cuma menumpang di Rekreasi, jadi ia ikut hilang bersamanya.
  const jejak = [
    'app/fun.tsx', 'lib/fun.ts', 'lib/featureIndex.ts',
    'components/fun/FunArchive.tsx', 'components/fun/FunEntryScreen.tsx',
    'app/fun/[id].tsx',
  ].filter((f) => /'recreation'|'reflection'/.test(kode(f)));
  ok('tak ada satu pun jejak kategorinya tertinggal', jejak.length === 0, jejak.join(', '));
  ok('tab Recreation hilang dari layar Fun', !/label: 'Recreation'/.test(baca('app/fun.tsx')));
  ok('judul fiturnya ikut jujur (bukan lagi "Fun & Recreation")',
    /title="Fun 🎉"/.test(baca('app/fun.tsx')) && !/Fun & Recreation 🎉/.test(baca('app/fun.tsx')));
  ok('judulnya sama dengan label tile-nya di Home',
    /key: 'fun', sort: \d+, label: 'Fun'/.test(baca('lib/featureGrid.ts')));
  ok('pintu pencariannya ikut dicabut (tak ada rute ke tab yang sudah tiada)',
    !/tab: 'recreation'/.test(baca('lib/featureIndex.ts')));
  ok('ikon tab yang jadi yatim ikut dibuang',
    !/'beach\.umbrella\.fill':/.test(baca('components/ui/icon-symbol.tsx')));
  // Yang TIDAK ikut dihapus, dan itu disengaja: area Wheel of Life "Fun
  // Recreation", kategori pengeluaran dengan nama sama, dan kelompok kreator
  // YouTube "Recreation". Ketiganya fitur lain yang kebetulan senama.
  ok('area Wheel of Life "Fun Recreation" TIDAK ikut terhapus',
    /key: 'fun', label: 'Fun Recreation'/.test(baca('lib/wheel.ts')));
  ok('kategori pengeluaran "Fun Recreation" TIDAK ikut terhapus',
    /key: 'fun-recreation', label: 'Fun Recreation'/.test(baca('lib/categories.ts')));
  ok('kelompok kreator YouTube "Recreation" TIDAK ikut terhapus',
    /kind: 'recreation'/.test(baca('lib/youtube.ts')));
  // Arsipnya sendiri tetap berdiri untuk Summit & Race.
  ok('arsip Summit & Race tetap jalan',
    /<FunArchive category="summit" \/>/.test(baca('app/fun.tsx')) &&
    /<FunArchive category="race"/.test(baca('app/health.tsx')));
}

// =====================================================================
console.log('\n=== 4. Aturan tetap proyek ===');
// =====================================================================
{
  const jalur = [
    'lib/timeline.ts', 'lib/car.ts', 'lib/marketAi.ts', 'lib/market.ts',
    'lib/fun.ts', 'lib/notifyCopy.ts',
    'components/car/OdometerCard.tsx', 'components/investment/AnalysisTab.tsx',
    'components/investment/ChartFullscreen.tsx', 'components/investment/MarketTab.tsx',
    'components/investment/PriceChart.tsx', 'app/fun.tsx', 'app/investment.tsx',
  ];
  const berkas = jalur.map(baca);
  // PriceChart & ChartFullscreen memang memegang warna khas aset (emas & BTC)
  // yang bukan warna merek app, jadi keduanya dikecualikan dengan sadar.
  const berhex = jalur.filter(
    (f) => !/PriceChart|CryptoTab/.test(f) && /#[0-9A-Fa-f]{6}/.test(baca(f)),
  );
  ok('tidak ada warna hex mentah di luar warna khas aset', berhex.length === 0, berhex.join(', '));
  ok('istilahnya "click", bukan klik/ketuk/tekan',
    !berkas.some((s) => /\b(klik|Klik|ketuk|Ketuk|tekan|ditekan|menekan)\b/.test(s)));
  const emDash = [];
  for (const s of jalur.map(kode)) {
    for (const m of s.match(/'[^'\n]*'|`[^`\n]*`|"[^"\n]*"/g) || []) {
      if (m.includes(String.fromCharCode(0x2014))) emDash.push(m.slice(0, 40));
    }
  }
  ok('tanpa tanda pisah panjang di teks yang tampil', emDash.length === 0, emDash.join(' | '));
  // Cubit & geser memakai gesture-handler + reanimated yang MEMANG sudah
  // terpasang (dipakai SheetModal sejak lama), jadi tetap cukup eas update.
  ok('tanpa modul native baru (cukup eas update)',
    !berkas.some((s) =>
      /from 'react-native-(?!reanimated|gesture-handler|safe-area-context|svg|webview)/.test(s)));
  const dep = JSON.parse(baca('package.json')).dependencies;
  ok('gesture-handler & reanimated memang sudah ada sebelumnya',
    !!dep['react-native-gesture-handler'] && !!dep['react-native-reanimated']);
  // Hapus PERMANEN, tidak pernah soft-delete.
  ok('tidak ada soft-delete yang diselundupkan',
    !berkas.some((s) => /isDeleted|archived:/.test(s)));
}

console.log('\n' + (gagal === 0
  ? '✅ LULUS — wishlist Senin, bacaan AI pasar, grafik layar penuh, kilometer mobil, Rekreasi terhapus.'
  : `❌ ${gagal} cek gagal.`));
process.exit(gagal === 0 ? 0 : 1);
