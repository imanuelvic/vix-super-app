// Lima permintaan 31 Agu 2026 (nama kebiasaan, navigasi sesudah "Sudah baca",
// & kutipan "kartu di dalam kartu" di tiga daftar Spiritual).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const OUT = path.join(__dirname, 'keluar-lima-p');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
try {
  require('child_process').execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/habits.ts', R + 'lib/spiritual.ts',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch {
  /* tsc mengeluh soal alias "@/…" yang distub; JS-nya tetap keluar */
}
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      doc: () => ({}), setDoc: () => Promise.resolve(), collection: () => ({}),
      query: (...a) => a, orderBy: () => ({}), limit: () => ({}),
      deleteDoc: () => Promise.resolve(), documentId: () => ({}),
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (/firebase$/.test(req)) return { db: {} };
  if (/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req.startsWith('@/assets/style/color')) {
    return { Color: new Proxy({}, { get: (_, k) => `#${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const H = require(path.join(OUT, 'habits.js'));
const S = require(path.join(OUT, 'spiritual.js'));
Module._load = asli;

const src = baca('lib/habits.ts');
const layarBaca = baca('app/bible-reading.tsx');
const spiritual = baca('app/(tabs)/walk.tsx');
const tabBaca = baca('components/spiritual/BibleReadingTab.tsx');
const quote = baca('components/spiritual/QuoteBox.tsx');
const sermon = baca('components/spiritual/SermonTab.tsx');
const puasa = baca('components/spiritual/FastingTab.tsx');

// Penggantian namanya DIJALANKAN sungguhan, bukan cuma dicari polanya di
// sumber: `HABIT_RENAMES` & `renamedHabit` tidak diekspor (memang tidak perlu),
// jadi potongannya diambil apa adanya dari berkasnya lalu dipanggil.
const ts = require(AKAR + '/node_modules/typescript');
const potongan =
  src.slice(src.indexOf('const HABIT_RENAMES'), src.indexOf('// ====', src.indexOf('function renamedHabit'))) +
  '\nexports.renamedHabit = renamedHabit;';
const modRename = { exports: {} };
new Function(
  'exports',
  'module',
  ts.transpileModule('type ScheduledHabit = any;\n' + potongan, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText,
)(modRename.exports, modRename);

/** Nama SEPERTI TERSIMPAN di Firestore → nama yang benar-benar tampil. */
const tampil = (label) =>
  modRename.exports.renamedHabit({ id: 'x', label, slot: 'morning' }).label;

// ===================================================================
console.log('=== 1. "Drink Creatine - Pk. 16.00" → "Drink Creatine" ===');
const kreatin = tampil('⚡ Drink Creatine - Pk. 16.00');
console.log(`  tersimpan "⚡ Drink Creatine - Pk. 16.00" → tampil "${kreatin}"`);
c('jam di belakang namanya benar-benar hilang', !/Pk\./.test(kreatin));
c('namanya jadi "⚡ Drink Creatine"', kreatin === '⚡ Drink Creatine');
c('jam berapa pun yang tersimpan ikut dibersihkan',
  tampil('⚡ Drink Creatine - Pk. 09.00') === '⚡ Drink Creatine');
c('kebiasaan LAIN tidak ikut kena', tampil('☕ Coffee - Pk. 14.00') === '☕ Coffee - Pk. 14.00');
// Jebakan yang nyata: daftarnya juga memuat "Drink Warm Water". Pola yang
// kelewat lebar (mis. /drink/i) akan mengganti NAMANYA jadi "Drink Creatine".
c('"Drink Warm Water" tidak ikut berubah jadi Creatine',
  tampil('🫖 Drink Warm Water') === '🫖 Drink Warm Water',
  tampil('🫖 Drink Warm Water'));
c('datanya TIDAK ditulis ulang — cuma diganti saat DIBACA',
  /\.map\(renamedHabit\)/.test(src) && !/updateDoc|batch\.update/.test(src));

// ===================================================================
console.log('\n=== 3. "Revive + IG Story" → "Share Revive ke IG Story" ===');
const ig = tampil('✝️ Revive + IG Story 📲');
console.log(`  tersimpan "✝️ Revive + IG Story 📲" → tampil "${ig}"`);
c('namanya benar-benar berganti', ig === '📱 Share Revive ke IG Story');
c('sebutannya serumpun dengan saudaranya (Share Revive ke …)',
  ig.startsWith('📱 Share Revive ke'));
c('baris Revive yang LAIN tidak ikut tertimpa',
  tampil('📱 Share Revive ke WAG') === '📱 Share Revive ke WAG');

// Yang paling gampang rusak diam-diam: pintasannya hilang karena namanya
// berubah. Dicek dengan menjalankan habitLink pada nama BARU-nya.
const igBaru = { id: 'x', label: '📱 Share Revive ke IG Story', slot: 'morning' };
const linkIg = H.habitLink(igBaru);
c('pintasan ke Instagram TIDAK ikut hilang', !!linkIg, linkIg?.note);
c('tujuannya memang aplikasi Instagram',
  linkIg?.external?.scheme === 'instagram://app');
c('tidak salah tertangkap aturan Revive→Spiritual',
  linkIg?.route === undefined);
// Saudaranya tidak boleh ikut tertukar.
const wag = H.habitLink({ id: 'y', label: '📱 Share Revive ke WAG', slot: 'morning' });
c('baris WAG tetap menuju Spiritual › Revive',
  wag?.route?.pathname === '/walk', wag?.note);

// ===================================================================
console.log('\n=== 2. Sesudah "Sudah baca" → arsip sesi itu juga ===');
c('tidak lagi router.back() sesudah menyimpan',
  !/bibleDayComplete\(today, session\),\s*\n\s*\);\s*\n\s*router\.back\(\);/.test(layarBaca));
c('memakai replace, bukan push (formulirnya sudah selesai)',
  /router\.replace\(\{\s*\n\s*pathname: '\/walk',\s*\n\s*params: \{ tab: 'bible', session \},/.test(layarBaca));
c('sesinya DIOPER apa adanya, bukan dihitung ulang dari jam sekarang',
  /params: \{ tab: 'bible', session \}/.test(layarBaca) &&
    !/params: \{ tab: 'bible', session: bibleSessionNow/.test(layarBaca));
c('layar Spiritual membaca ?session=…',
  /useLocalSearchParams<\{ session\?: string \}>/.test(spiritual));
c('param yang tidak sah diabaikan (bukan jadi sesi ngawur)',
  /BIBLE_SESSIONS\.some\(\(s\) => s\.key === sessionParam\)/.test(spiritual));
c('dioper ke tab arsipnya', /<BibleReadingTab days=\{bibleDays\} openSession=\{sesiDituju\} \/>/.test(spiritual));
// Cadangannya bukan lagi "jendela yang sedang berjalan, kalau tidak ada → Pagi"
// melainkan sesi yang JAM SEKARANG termasuk di dalamnya (bibleSessionOfClock).
// Yang dijaga di sini tetap sama: sesi yang DITUJU harus menang.
c('tab arsipnya memakai sesi itu sebagai pembuka',
  /openSession \?\? bibleSessionOfClock\(new Date\(\)\)/.test(tabBaca));
c('tanpa param → tetap ikut jam sekarang seperti dulu',
  /openSession\?: BibleSession;/.test(tabBaca));
// Ketiga kunci sesi memang sah — kalau tidak, paramnya diam-diam jatuh ke Pagi.
c('ketiga sesi dikenali paramnya',
  ['morning', 'daytime', 'night'].every((k) =>
    S.BIBLE_SESSIONS.some((s) => s.key === k)),
  S.BIBLE_SESSIONS.map((s) => s.key).join(', '));
c('sesi yang dicatat jam berapa pun tetap yang ditampilkan', (() => {
  // Menulis bacaan SIANG jam 23.00: bibleSessionNow bilang malam/none, tapi
  // yang harus terbuka tetap Siang.
  const malam = new Date(2026, 7, 30, 23, 0);
  const jamIni = S.bibleSessionNow(malam);
  console.log(`  jam 23.00 → sesi berjalan: ${jamIni ?? 'tidak ada'}`);
  return jamIni !== 'daytime';
})());

// ===================================================================
console.log('\n=== 4 & 5. Kutipan "kartu di dalam kartu" ===');
c('bentuknya jadi komponen bersama', /export function QuoteBox/.test(quote));
c('kosong → tidak menggambar kotak kosong', /if \(!text\.trim\(\)\) return null;/.test(quote));
c('warnanya dari palet, bukan hex tangan', !/#[0-9A-Fa-f]{6}/.test(quote));
c('garis tepi KIRI (bukan bingkai penuh)',
  /borderLeftWidth: 3/.test(quote) && !/borderWidth:/.test(quote));
c('tulisannya miring & diapit tanda kutip',
  /fontStyle: 'italic'/.test(quote) && /“\{text\.trim\(\)\}”/.test(quote));

console.log('\n  --- dipakai bertiga, bentuknya tak bisa berbeda lagi ---');
// `<QuoteBox\s+text=` — yang dicari PEMAKAIANNYA, bukan kata yang kebetulan
// muncul di komentar kode (jebakan yang sempat kejadian di sini).
for (const [nama, isi] of [
  ['Catatan Khotbah', sermon],
  ['Puasa', puasa],
  ['Revive', spiritual],
]) {
  c(`${nama} memakai <QuoteBox/>`, /<QuoteBox\s+text=/.test(isi));
}
c('gaya kutipan lamanya benar-benar dibuang dari Catatan Khotbah',
  !/quoteBox: \{/.test(sermon) && !/quoteText: \{/.test(sermon));
c('gaya kutipan lamanya dibuang dari kartu Revive',
  !/todayRhema/.test(spiritual));

console.log('\n  --- 4. daftar Puasa ---');
c('pokok doa utama TIDAK lagi muncul di daftar',
  !/🙏 \{p\.prayer\}/.test(puasa) && !/cardPrayer/.test(puasa));
c('jawaban doanya yang tampil, sebagai kutipan',
  /<QuoteBox text=\{p\.answer\} prefix="✨" lines=\{3\} \/>/.test(puasa));
c('gaya jawaban yang lama ikut dibuang', !/cardAnswer/.test(puasa));
c('pokok doanya tidak hilang dari DATA, cuma dari daftar',
  /prayer/.test(baca('lib/fasting.ts')) &&
    /p\.prayer|prayer/.test(baca('app/fasting.tsx')));

console.log('\n  --- 5. kartu Revive ---');
c('rhema-nya jadi kutipan',
  /<QuoteBox text=\{todayEntry\.rhema\} accent=\{Color\.SPIRITUAL_DARK\} \/>/.test(spiritual));
c('judul, bacaan & aplikasinya tetap ada',
  /\{todayEntry\.title\}/.test(spiritual) &&
    /📖 \{todayEntry\.passage\}/.test(spiritual) &&
    /🏃🏻‍➡️ \{todayEntry\.reflection\}/.test(spiritual));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);