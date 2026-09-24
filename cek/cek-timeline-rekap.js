// Lima permintaan sekaligus:
//   1. Wheel of Life-ku & CL harus sama persis (layarnya memang satu)
//   2. Kategori wishlist = 8 area Wheel of Life, dipilih lewat dropdown
//   3. Kategori My History juga, plus dropdown
//   4. Galat palsu "Gagal memuat data" di Riwayat Syukur
//   5. Tombol share PDF Timeline (garis waktu) + rekap semua wishlist
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-timeline-rekap');
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
      R + 'lib/timelinePdf.ts',
      R + 'lib/history.ts',
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

// Jejak: doc()/collection() mengembalikan JALURNYA, getDocs mengembalikan
// dokumen palsu — jadi bisa diperiksa koleksi mana yang benar-benar dibaca.
let dokumen = [];
let jalurDibaca = null;
const cetakan = { html: null, dialog: null, berkas: null };
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: (_db, ...seg) => seg.join('/'),
      doc: (_db, ...seg) => seg.join('/'),
      getDocs: async (ref) => {
        jalurDibaca = ref;
        return { docs: dokumen.map((d) => ({ id: d.id, data: () => d })) };
      },
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
    return {
      isAvailableAsync: async () => true,
      shareAsync: async (_u, opt) => { cetakan.dialog = opt.dialogTitle; },
    };
  }
  if (req === 'expo-file-system') {
    return {
      File: class {
        constructor() { this.uri = '/tmp/palsu.pdf'; this.exists = false; }
        rename(n) { cetakan.berkas = n; }
        delete() {}
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
const tl = require(M('timeline'));
const wl = require(M('wheel'));
const hs = require(M('history'));
const { shareTimelinePdf } = require(M('timelinePdf'));
Module._load = asli;

const layarTL = baca('app/timeline.tsx');
const layarHS = baca('app/history.tsx');
const layarWheel = baca('app/wheel.tsx');
const syukur = baca('app/gratitude.tsx');

console.log('\n== 1. Wheel of Life-ku & CL: satu layar, satu tampilan ==');

c('tidak ada layar wheel kedua',
  !fs.existsSync(R + 'app/core-wheel.tsx') && !fs.existsSync(R + 'app/leader-wheel.tsx'));
// Yang boleh beda cuma SEBUTANNYA (judul, tombol kembali, kalimat sapaan) &
// nama pemilik di PDF-nya. Semua bagian isi — radar, fokus kuartal, cap waktu,
// skor per area, tombol share — harus digambar dari kode yang sama.
{
  const kode = layarWheel.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // Tiap cabang `owner ?` dicatat, lalu dipastikan tak ada yang menyentuh isi.
  const cabang = kode.match(/owner\s*\?/g) || [];
  const dilarang = [
    /owner \? [\s\S]{0,80}(RadarChart|ScoreMeter|stampBox|createdAt|updatedAt|focus)/,
    /\{owner && [\s\S]{0,60}(RadarChart|stampBox|EmojiButton)/,
    /!owner && /,
  ];
  c('cabang `owner ?` cuma untuk sebutan & nama pemilik, bukan isinya',
    cabang.length > 0 && !dilarang.some((p) => p.test(kode)), `${cabang.length} cabang`);
}
c('tombol share dipasang tanpa melihat pemiliknya',
  /right=\{\s*\n\s*mode === 'overview' && hasScores \? \(/.test(layarWheel));
{
  // Blok cap waktunya saja — di luar sini `owner` memang wajar muncul
  // (dioper ke penyimpanan bersama `data?.createdAt`).
  const mulai = layarWheel.indexOf('{(data.createdAt || data.updatedAt) && (');
  // 14 Sep malam: blok cap waktunya pindah ke ATAS "🎯 Quarter Focus"
  // (ujung anak 0 ScrollView); bloknya berakhir di penutup fragmen </>.
  const blok = layarWheel.slice(mulai, layarWheel.indexOf('</>', mulai));
  c('cap waktu dibuat/diubah digambar sekali untuk keduanya',
    mulai > 0 && !/owner/.test(blok));
}
c('data kuartalnya dibaca lewat jalur yang sama, cuma pemiliknya beda',
  /subscribeWheel\(\s*\n\s*uid,\s*\n\s*qid,[\s\S]{0,200}owner,\s*\n\s*\),/.test(layarWheel)); // 22 Sep 2026: efek langganannya jadi useLiveAll (callback & syarat sama).

console.log('\n== 2. Kategori = 8 area Wheel of Life ==');

const AREA = wl.WHEEL_AREAS.map((a) => a.key);
c('Wheel punya 8 area', AREA.length === 8, AREA.join(','));

// Diambil LANGSUNG dari WHEEL_AREAS, bukan diketik ulang — kalau diketik ulang,
// suatu saat ikon/urutannya beda sendiri tanpa ada yang sadar.
const cocok = (daftar, ekstra) =>
  AREA.every((k, i) => daftar[i].key === k) &&
  AREA.every((k, i) => daftar[i].icon === wl.WHEEL_AREAS[i].icon) &&
  AREA.every((k, i) => daftar[i].label === wl.WHEEL_AREAS[i].label) &&
  daftar.length === 9 &&
  daftar[8].key === ekstra;

c('Timeline: 8 area + Future Plan di ekornya',
  cocok(tl.TIMELINE_CATEGORIES, 'future'),
  tl.TIMELINE_CATEGORIES.map((x) => x.key).join(','));
c('History: 8 area + Education di ekornya',
  cocok(hs.HISTORY_CATEGORIES, 'education'),
  hs.HISTORY_CATEGORIES.map((x) => x.key).join(','));

// Tiga area yang DULU tidak ada di Timeline, satu yang tidak ada di History.
c('Spirituality, Health & Family akhirnya punya tempat di Timeline',
  ['spirituality', 'health', 'family'].every((k) =>
    tl.TIMELINE_CATEGORIES.some((x) => x.key === k)));
c('Health akhirnya punya tempat di History',
  hs.HISTORY_CATEGORIES.some((x) => x.key === 'health'));

// Data LAMA tidak boleh kehilangan nama & ikonnya.
c('wishlist lama berkategori Future Plan tetap terbaca',
  tl.TIMELINE_CATEGORY_META.future.label === 'Future Plan' &&
  tl.TIMELINE_CATEGORY_META.future.icon === '🎓');
c('kejadian lama berkategori Education tetap terbaca',
  hs.historyCategoryMeta('education').label === 'Education' &&
  hs.historyCategoryMeta('education').icon === '🏫');

console.log('\n== 3. Dipilih lewat dropdown, bukan deretan chip ==');

c('Timeline: kategori jadi dropdown',
  /<SelectField\s*\n\s*value=\{fCategory\}\s*\n\s*options=\{TIMELINE_CATEGORIES\.map/.test(layarTL));
c('Timeline: waktu jadi dropdown juga',
  /<SelectField\s*\n\s*value=\{fMonth === null \? 'tahunan' : String\(fMonth\)\}/.test(layarTL));
// "Tahunan" itu `month: null` di data — di dropdown ia perlu kunci teks
// sendiri, karena null di SelectField berarti "belum dipilih".
c('“Target Tahunan” bolak-balik ke month: null dengan benar',
  /\{ key: 'tahunan', label: '🎯 Target Tahunan' \}/.test(layarTL) &&
  /setFMonth\(k === null \|\| k === 'tahunan' \? null : Number\(k\)\)/.test(layarTL));
c('History: kategori jadi dropdown',
  /<SelectField\s*\n\s*value=\{fCategory\}\s*\n\s*options=\{HISTORY_CATEGORIES\.map/.test(layarHS));
c('deretan chip kategori benar-benar dibuang dari kedua modal',
  !/<Chip[\s\S]{0,120}fCategory === c\.key/.test(layarTL) &&
  !/<Chip[\s\S]{0,120}fCategory === c\.key/.test(layarHS));
c('Timeline tak lagi mengimpor Chip yang jadi nganggur',
  !/from '@\/components\/common\/Chip'/.test(layarTL));

console.log('\n== 4. Riwayat Syukur: galat yang tidak mau pergi ==');

// Sekali gagal (sinyal putus sedetik saat dibuka), pesannya menempel selamanya
// walau daftarnya sudah tampil lengkap di bawahnya.
c('galatnya dibersihkan begitu data sampai — di KETIGA langganannya',
  (syukur.match(/setError\(null\);/g) || []).length === 3 &&
  /setHabits\(next\);\s*\n\s*setError\(null\);/.test(syukur) &&
  /setNotes\(next\);[\s\S]{0,60}setError\(null\);/.test(syukur));
c('kegagalan sungguhan TETAP dilaporkan',
  // 22 Sep 2026: dua lewat `fail` useLiveAll, satu ditulis sendiri (spinner).
  (syukur.match(/setError\(LOAD_ERROR\)/g) || []).length === 1 &&
  (syukur.match(/\{ onError: setError/g) || []).length === 2);

console.log('\n== 5. Rekap & PDF: seluruh tahun, bukan satu tahun ==');

(async () => {
  const W = (id, items) => ({ id, items });

  // Jalurnya harus sama persis dengan langganan setahun — mustahil rekap
  // membaca cabang orang lain.
  dokumen = [];
  await tl.fetchTimelineAll('u1');
  c('punyaku dibaca dari users/{uid}/timeline',
    jalurDibaca === 'users/u1/timeline', jalurDibaca);
  await tl.fetchTimelineAll('u1', 'cl-lanemey');
  c('CL dibaca dari cabangnya sendiri',
    jalurDibaca === 'users/u1/coreTimeline/cl-lanemey/years', jalurDibaca);

  dokumen = [
    W('2028', [{ id: 'a', title: 'Nikah', category: 'relationship', month: 5, done: false }]),
    W('2026', [
      { id: 'b', title: 'Lunas KPR', category: 'finance', month: null, done: true },
      { id: 'c', title: 'Baca Ayub', category: 'ministry', month: 2, done: false },
      { id: 'd', title: 'Lari 5K', category: 'health', month: 2, done: true },
    ]),
    W('2027', []),
    W('bukan-tahun', [{ id: 'z', title: 'X', category: 'fun', month: 0, done: false }]),
  ];

  const semua = await tl.fetchTimelineAll('u1');
  c('tahun kosong & id yang bukan tahun dibuang',
    semua.length === 2 && semua.every((t) => Number.isFinite(t.year)),
    semua.map((t) => t.year).join(','));
  c('urut menaik — garis waktu harus maju, bukan mundur',
    semua[0].year === 2026 && semua[1].year === 2028);

  const totals = tl.timelineTotals(semua);
  c('total & tercapai dihitung dari SEMUA tahun',
    totals.total === 4 && totals.done === 2,
    `${totals.done}/${totals.total}`);

  const grup = tl.timelineGroups(semua[0].items);
  c('target tahunan didahulukan, lalu bulan urut',
    grup.length === 2 && grup[0].month === null && grup[1].month === 2);
  c('bulan tanpa wishlist tidak jadi titik kosong',
    grup.every((g) => g.items.length > 0));
  c('satu bulan bisa memuat beberapa wishlist', grup[1].items.length === 2);

  console.log('\n== 6. PDF-nya garis waktu, bukan daftar kartu ==');

  await shareTimelinePdf(semua, null, null, new Date(2026, 8, 1));
  const html = cetakan.html;
  fs.writeFileSync(path.join(__dirname, 'timeline-punyaku.html'), html);

  c('ada garis tegak & bulatan di tiap tonggak',
    /class="garis/.test(html) && /class="titik/.test(html));
  c('bukan kartu seperti di layar', !/class="kartu"/.test(html));
  c('tahun jadi tonggak besar', /class="titik besar"/.test(html));
  c('kolom kiri menyebut kapan', /class="kapan"/.test(html) && /Maret/.test(html));
  // Penandanya saja tidak cukup — aturan gayanya harus ikut ada, kalau tidak
  // garisnya tetap menjulur ke bawah melewati bulatan terakhir.
  c('garisnya berhenti di tonggak terakhir, tidak menggantung',
    /class="garis habis"/.test(html) &&
    /\.garis\.habis \{[^}]*height: 10px/.test(html));

  // Yang sudah berlalu TETAP dicetak — cuma warnanya lebih tenang.
  c('yang sudah lewat ikut tercetak & ditandai',
    /class="baris lewat"/.test(html) && /Lunas KPR/.test(html));
  c('yang akan datang juga', /Nikah/.test(html) && /2028/.test(html));
  c('tercapai & belum dibedakan', /✅/.test(html) && /⬜/.test(html));
  c('kategorinya ikut (ikon + namanya)',
    /💵 Lunas KPR/.test(html) && /Finance/.test(html));
  c('rekapnya ada di kop', /Tercapai/.test(html) && /2 dari 4/.test(html));
  c('rentang tahunnya disebut', /2026 – 2028/.test(html));

  c('judul & nama berkas untuk timeline SENDIRI',
    /My Timeline/.test(html) && cetakan.berkas === 'My Timeline.pdf',
    cetakan.berkas);

  cetakan.html = null;
  await shareTimelinePdf(semua, { name: 'Lanemey', heart: '💚' }, null, new Date(2026, 8, 1));
  c('…dan untuk CORE Leader, isinya sama cuma judulnya beda',
    /Timeline 💚 Lanemey/.test(cetakan.html) &&
    /class="titik/.test(cetakan.html) &&
    cetakan.berkas === 'Timeline 💚 Lanemey.pdf',
    cetakan.berkas);
  c('dialog share-nya jelas', cetakan.dialog === 'Bagikan Timeline', cetakan.dialog);

  // Tak ada wishlist sama sekali → tetap terbit, tapi jujur kosong.
  cetakan.html = null;
  await shareTimelinePdf([], null, null, new Date(2026, 8, 1));
  c('timeline kosong tidak menghasilkan halaman bohong',
    /Belum ada wishlist/.test(cetakan.html) && !/class="titik/.test(cetakan.html));

  console.log('\n== 7. Tombol share & rekap di layar Timeline ==');

  // 14 Sep malam: 📋 rekap ikut ke header, di kiri tombol bagikan.
  c('tombol share di pojok kanan header, seperti Wheel of Life (bersama 📋 rekap)',
    /right=\{\s*\n\s*<>[\s\S]{0,500}<EmojiButton\s*\n\s*icon="square\.and\.arrow\.up"/.test(layarTL));
  // Yang dicetak SELURUH tahun — jadi tahun berjalan yang kosong bukan alasan
  // menyembunyikan tombolnya.
  c('tombolnya tidak menunggu tahun ini terisi',
    !/hasScores[\s\S]{0,40}EmojiButton/.test(layarTL) &&
    !/items\.length > 0 \? \(\s*\n\s*<EmojiButton/.test(layarTL));
  // 16 Sep 2026: dua jalur (bagikan biasa & bagikan ke CL), dua-duanya muatSemua.
  // 22 Sep 2026: dua jalurnya kini di satu handleShare (langsung ke CL / biasa).
  c('PDF-nya memakai seluruh tahun, bukan `items` tahun ini',
    /: shareTimelinePdf\(await muatSemua\(\), pemilik\),/.test(layarTL) &&
    /shareTimelinePdf\(await muatSemua\(\), pemilik, \{/.test(layarTL));
  // 14 Sep malam: tahun lahirnya ikut, untuk baris umur di tiap tahun PDF.
  c('pemiliknya dioper (nama, hati, tahun lahir), jadi judul & umurnya benar untuk CL',
    /const pemilik = owner\s*\n\s*\? \{ name: orang, heart: params\.heart \?\? '📍', birthYear \}\s*\n\s*: null;/.test(layarTL));

  c('ada pintu rekap semua wishlist', /📋 All Wishlist Recap/.test(layarTL));
  // 16 Sep 2026: 3 pemanggil (bagikan biasa, bagikan ke CL, rekap), tetap satu pengambilan.
  c('rekap & PDF berbagi SATU pengambilan (tidak membaca dua kali)',
    (layarTL.match(/fetchTimelineAll\(/g) || []).length === 1 &&
    (layarTL.match(/await muatSemua\(\)/g) || []).length === 3);
  // Rekap basi lebih buruk daripada tidak ada rekap.
  c('diambil ulang tiap ditekan, bukan sekali seumur layar',
    /async function muatSemua\(\)[\s\S]{0,220}await fetchTimelineAll\(user\.uid, owner\);/.test(layarTL));
  c('rekapnya menampilkan total, tahun, & tiap wishlist-nya',
    /timelineTotals\(semua\)\.done/.test(layarTL) &&
    /timelineGroups\(t\.items\)\.map/.test(layarTL) &&
    /i\.done \? '✅' : '⬜'/.test(layarTL));
  c('dua tugas tidak bisa jalan berbarengan (share & rekap)',
    /useBusyTask<'pdf' \| 'rekap'>\(\)/.test(layarTL));

  console.log(ok ? '\nLULUS' : '\nGAGAL');
  process.exit(ok ? 0 : 1);
})();