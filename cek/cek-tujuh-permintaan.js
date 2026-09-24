// Tujuh permintaan 28 Agu 2026:
//   1. 📓 Daily Reflection Journal → pintu ke Instagram Feed (sesudah terisi)
//   2. Tab News: baris kategori tidak melar saat memuat/gagal + "Tech"
//   3. Satu komponen bersama untuk semua baris chip yang digeser + animasinya
//   4. Nama baris "Share Revive ke Instastory" tetap kebagian pintasan IG
//   6. Subjudul header tidak naik-turun saat ganti sub-tab
//   7. Subjudul Spiritual = ayat penyembahan, berganti tiap hari
//
// (Permintaan 4 & 5 soal NAMA & EMOJI barisnya sendiri = data Firestore, bukan
// kode. Yang bisa diuji di sini cuma akibatnya pada pintasan — lihat bagian 4.)
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-tujuh-b');
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
      R + 'lib/habits.ts', R + 'lib/spiritual.ts', R + 'lib/news.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
for (const f of ['habits.js', 'spiritual.js', 'news.js']) {
  if (!fs.existsSync(path.join(DIR, f))) {
    console.log(`  ✗ gagal mengompilasi ${f}`);
    process.exit(1);
  }
}

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({}), setDoc: async () => {},
      onSnapshot: () => () => {}, deleteField: () => '__d__', query: () => ({}),
      orderBy: () => ({}), limit: () => ({}), writeBatch: () => ({}),
      arrayUnion: () => ({}), deleteDoc: async () => {},
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  // Warna cuma dipakai sebagai nilai yang dioper apa adanya — cukup dipalsukan
  // jadi nama warnanya sendiri, biar bisa dibaca kalau ada yang meleset.
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^@\/lib\//.test(req)) {
    const nama = req.replace('@/lib/', '') + '.js';
    if (fs.existsSync(path.join(DIR, nama))) return require(path.join(DIR, nama));
    return {};
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const H = require(path.join(DIR, 'habits.js'));
const S = require(path.join(DIR, 'spiritual.js'));
const N = require(path.join(DIR, 'news.js'));

const habit = (label, extra = {}) => ({
  id: 'x', label, slot: 'morning', area: 'spirit', tier: 'core', ...extra,
});

// =====================================================================
console.log('=== 1. 📓 Jurnal Refleksi → pintu ke Instagram Feed ===');
// =====================================================================
{
  const jurnal = habit('📓 Daily Reflection Journal');
  const link = H.habitLink(jurnal);
  c('barisnya punya pintasan', !!link, link ? link.note : 'null');
  c('tujuannya layar Generate Feed', !!link && link.route &&
    link.route.pathname === '/reflection-feed', link?.route?.pathname);
  c('ditandai `whenDone` (baru muncul sesudah terisi)', !!link && link.whenDone === true);
  c('keterangannya menyebut Instagram Feed', !!link && /Instagram Feed/.test(link.note),
    link?.note);

  // Nama lamanya ("Rhema") HARUS tetap kebagian — dokumen Firestore-nya masih
  // memakai nama itu di sebagian orang.
  c('nama lama "Rhema Pagi" juga dikenali',
    H.habitLink(habit('✍️ Rhema Pagi'))?.route?.pathname === '/reflection-feed');

  // 31 Agu 2026 DIBALIK: baris bercatatan justru jadi WAJIB. Tulisannya punya
  // layar pembaca sendiri (Generate Feed & Gratitude History 🙏) yang mencari
  // barisnya di daftar ini — hilang barisnya, layar itu kosong selamanya.
  c('barisnya sekarang terkunci (tulisannya punya layar pembaca sendiri)',
    H.isFixedHabit(jurnal) === true);
  c('baris cermin sungguhan tetap terkunci',
    H.isFixedHabit(habit('📖 Morning Bible Reading')) === true &&
      H.isFixedHabit(habit('🏋️ Workout', { id: 'fitness-link' })) === true);
  c('bukan baris cermin (centangnya tetap dari tulisannya sendiri)',
    H.habitMirror(jurnal) === null);
  c('dan bukan doneOnOpen (membukanya tidak mencentang apa pun)',
    H.habitLink(jurnal).doneOnOpen === undefined);

  // Penahannya di layar: pintasan `whenDone` disembunyikan selama belum dicentang.
  const tab = baca('components/habits/HabitsTab.tsx');
  c('HabitsTab menukar pintasannya sampai barisnya tercentang',
    /rawLink\?\.whenDone && !checked\s*\?\s*\(rawLink\.beforeDone \?\? null\)\s*:\s*rawLink/.test(tab));
  // Jurnal tidak punya pengganti → sebelum ditulis memang tanpa pintu sama
  // sekali, persis seperti dulu.
  c('yang tanpa pengganti tetap tidak berpintu sebelum dikerjakan',
    H.habitLink(jurnal).beforeDone === undefined);
  c('nama kebiasaan jadi bisa di-click begitu ada pintasannya',
    /onPress=\{\(\) => link && openHabitLink\(link, habit\)\}/.test(tab) &&
      /disabled=\{!link\}/.test(tab));
}

// =====================================================================
console.log('\n=== 2. Tab News: baris kategori & nama "Tech" ===');
// =====================================================================
{
  const chipRow = baca('components/common/ChipRow.tsx');
  // Inilah sebab chip-nya melar jadi kapsul raksasa saat memuat/gagal:
  // ScrollView bawaan RN memasang flexGrow: 1 pada dirinya sendiri.
  c('ChipRow mematikan flexGrow bawaan ScrollView',
    /scroll: \{ flexGrow: 0 \}/.test(chipRow));
  c('alasannya ditulis, bukan angka ajaib',
    /flexGrow: 1.*dirinya sendiri|baseHorizontal/s.test(chipRow));

  const news = baca('components/news/NewsTab.tsx');
  // Barisnya sempat berganti-ganti bentuk (spread → wrap → digeser lagi,
  // 1 Sep 2026). Yang dijaga di sini tetap sama sejak awal: barisnya dari
  // komponen bersama, bukan ScrollView tulisan tangan.
  c('NewsTab memakai ChipRow, bukan ScrollView horizontal sendiri',
    /<ChipRow\b/.test(news) && !/horizontal\s*\n\s*showsHorizontal/.test(news));
  // `spread` (melebar kalau muat) ikut dibuang bersama `wrap`: tak ada satu
  // layar pun yang memakainya.
  const kodeChip = chipRow.replace(/\/\/.*$/gm, ''); // komentarnya menyebutnya
  // `spread` (melebar kalau muat) tetap tiada. `fit` yang ada sekarang beda:
  // ia dipakai baris sumber News & memang menggantikan geseran, bukan
  // menambah mode yang menganggur.
  c('tak ada mode yang tidak dipakai siapa pun',
    !/spread/.test(kodeChip) &&
    (!/fit\?:/.test(kodeChip) ||
      /fit=\{\d/.test(baca('components/news/NewsTab.tsx'))));

  const tech = N.NEWS_SOURCES.find((s) => s.key === 'tech');
  c('"Teknologi" jadi "Tech"', tech.label === 'Tech', tech.label);
  c('lambang & keterangannya tidak ikut berubah',
    tech.emoji === '🤖' && /AI/.test(tech.sub), `${tech.emoji} ${tech.sub}`);
  c('label kelimanya tetap pendek (tak ada yang > 10 huruf selain Bloomberg)',
    N.NEWS_SOURCES.every((s) => s.label.length <= 10),
    N.NEWS_SOURCES.map((s) => s.label).join(' · '));
}

// =====================================================================
console.log('\n=== 3. Satu komponen untuk SEMUA baris chip yang digeser ===');
// =====================================================================
{
  const chipRow = baca('components/common/ChipRow.tsx');
  c('animasinya: chip masuk berurutan dari kanan dengan pantulan',
    /FadeInRight/.test(chipRow) && /\.springify\(\)/.test(chipRow) &&
      /Math\.min\(i, 8\) \* 45/.test(chipRow));
  c('jedanya dibatasi 8 chip pertama (baris panjang tidak terasa lambat)',
    /Math\.min\(i, 8\)/.test(chipRow));

  const PAKAI = [
    ['components/common/FilterChips.tsx', 'saringan (6 layar)'],
    ['components/news/NewsTab.tsx', 'sumber berita'],
    ['app/tasks.tsx', 'kategori Reminder'],
  ];
  for (const [f, apa] of PAKAI) {
    const s = baca(f);
    c(`${apa.padEnd(20)} memakai ChipRow`,
      /<ChipRow/.test(s) && /import \{ ChipRow \} from '@\/components\/common\/ChipRow';/.test(s));
    c(`${apa.padEnd(20)} tak lagi menulis ScrollView horizontal sendiri`,
      !/horizontal\s*\n\s*showsHorizontalScrollIndicator/.test(s));
  }

  // FilterChips menyentuh 6 layar sekaligus.
  const enam = ['app/history.tsx', 'app/visitations.tsx',
    'components/career/AffiliateTab.tsx', 'components/learning/DiscussionTab.tsx',
    'components/friends/PlacesTab.tsx', 'components/tasks/PriorityTab.tsx'];
  c('6 layar ikut kebagian lewat FilterChips tanpa diubah satu pun',
    enam.every((f) => /<FilterChips/.test(baca(f))), enam.length + ' layar');

  // Chip kategori Reminder punya badge & jadi sasaran seret — harus tetap utuh.
  const tasks = baca('app/tasks.tsx');
  c('badge & sasaran seret kategori Reminder tetap ada',
    /chipBadge/.test(tasks) && /catRefs\.current\[c\.key\] = r;/.test(tasks) &&
      /chipHoverRing/.test(tasks));
}

// =====================================================================
console.log('\n=== 4. Nama "Share Revive ke Instastory" tetap ke Instagram ===');
// =====================================================================
{
  const baru = H.habitLink(habit('📲 Share Revive ke Instastory'));
  c('namanya yang baru tetap kebagian pintasan Instagram',
    !!baru && baru.external && /instagram:\/\//.test(baru.external.scheme),
    baru ? baru.note : 'TIDAK ADA PINTASAN');
  c('nama lamanya juga masih jalan',
    H.habitLink(habit('📲 Revive + IG Story'))?.external?.scheme === 'instagram://app');
  c('"Share Revive ke WA CORE" tetap ke Spiritual › Revive (tidak tertukar)',
    H.habitLink(habit('📲 Share Revive ke WA CORE'))?.route?.pathname === '/walk');
  c('ejaan "Insta Story" (dua kata) ikut dikenali',
    H.habitLink(habit('Share Revive ke Insta Story'))?.external?.scheme ===
      'instagram://app');

  // Baris jurnal TIDAK boleh tersedot aturan Instagram (urutannya penting).
  c('baris jurnal tidak tertukar ke aturan Instagram',
    H.habitLink(habit('📓 Daily Reflection Journal')).route !== undefined);
}

// =====================================================================
console.log('\n=== 6. Subjudul header diam saat ganti sub-tab ===');
// =====================================================================
{
  const hdr = baca('components/common/ScreenHeader.tsx');
  c('tinggi baris judul dipatok, tidak ikut isinya',
    /const TITLE_ROW_HEIGHT = 46;/.test(hdr) &&
      /minHeight: TITLE_ROW_HEIGHT/.test(hdr));
  c('judul & tombol sama-sama ditengahkan (tidak saling mendorong)',
    /alignItems: 'center',\s*\n\s*gap: 10,\s*\n\s*minHeight/.test(hdr));
  c('jarak atas tombol pojok kanan dibuang (sumber selisihnya)',
    !/rightBox:[^}]*paddingTop/.test(hdr));
  c('46 ≥ tombol pojok kanan (42) & ≥ tinggi baris judul (45)', 46 >= 42 && 46 >= 45);

  // Yang menyebabkannya di Spiritual: tombol pojok kanan cuma ada di 2 dari 4
  // sub-tab, jadi barisnya dulu berganti tinggi tiap pindah.
  const sp = baca('app/(tabs)/walk.tsx');
  const punyaTombol = /tab === 'revive' \? \(/.test(sp) && /tab === 'bible' \? \(/.test(sp);
  c('Spiritual memang cuma bertombol di sub-tab Revive & Bible', punyaTombol);
}

// =====================================================================
console.log('\n=== 7. Subjudul Spiritual = ayat penyembahan harian ===');
// =====================================================================
{
  c('subjudulnya bukan kalimat tetap lagi',
    /subtitle=\{worshipVerseOfDay\(todayId\)\}/.test(baca('app/(tabs)/walk.tsx')) &&
      !/Being with God/.test(baca('app/(tabs)/walk.tsx')));

  const hari = (n) => `2026-08-${String(n).padStart(2, '0')}`;

  // Sepanjang satu hari nilainya HARUS sama — ini yang membuat tulisannya
  // tidak berkedip saat pindah sub-tab.
  const sekali = S.worshipVerseOfDay(hari(28));
  c('dipanggil 50× di hari yang sama → jawabannya sama terus',
    Array.from({ length: 50 }, () => S.worshipVerseOfDay(hari(28)))
      .every((v) => v === sekali), sekali);

  // Sepanjang setahun: berganti-ganti & seluruh daftarnya kebagian.
  const setahun = [];
  for (let i = 0; i < 365; i++) {
    const d = new Date(2026, 0, 1 + i);
    const id = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setahun.push(S.worshipVerseOfDay(id));
  }
  const dipakai = new Set(setahun);
  c('seluruh ayat kebagian giliran dalam setahun',
    dipakai.size === S.WORSHIP_VERSES.length,
    `${dipakai.size}/${S.WORSHIP_VERSES.length}`);
  const berganti = setahun.filter((v, i) => i > 0 && v !== setahun[i - 1]).length;
  c('benar-benar berganti (bukan itu-itu saja)', berganti > 250, `${berganti}× dalam 365 hari`);
  c('tak pernah undefined / kosong',
    setahun.every((v) => typeof v === 'string' && v.length > 0));

  // Isinya memang soal memuji & menyembah, dan panjangnya seragam supaya
  // tingginya satu baris di iPhone 15 maupun iPad.
  // Awalan meN- meluruhkan huruf pertama akar katanya: sembah→menyembah,
  // puji→memuji. Jadi yang dicari potongan yang selamat: embah, [mp]uji, …
  const KATA = /embah|[mp]uji|nyanyi|syukur|muliakan|ibadah|sukacita|sujud/i;
  const meleset = S.WORSHIP_VERSES.filter((v) => !KATA.test(v));
  c('semuanya soal memuji/menyembah', meleset.length === 0,
    meleset.length ? meleset.join(' | ') : `${S.WORSHIP_VERSES.length} ayat`);
  c('semuanya menyebut kitab & ayatnya',
    S.WORSHIP_VERSES.every((v) => / \(\D+ \d+:\d+\)$/.test(v)));
  const panjang = S.WORSHIP_VERSES.map((v) => v.length);
  c('panjangnya seragam (≤ 60 huruf, selisih ≤ 20)',
    Math.max(...panjang) <= 60 && Math.max(...panjang) - Math.min(...panjang) <= 20,
    `${Math.min(...panjang)}–${Math.max(...panjang)} huruf`);
  c('contoh yang diminta ada di daftarnya',
    S.WORSHIP_VERSES.some((v) => /roh dan kebenaran.*Yohanes 4:24/.test(v)));
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);