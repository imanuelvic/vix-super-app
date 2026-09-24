// 28 Agu 2026 — dua permintaan:
//   1. Berkas sub-tab Topics diganti nama jadi Discussion (ikut nama sub-tabnya)
//   2. "💬 Discussion This Week" ikut muncul di HOME, tepat di depan Doa
//      Syafaat, TAPI hanya jam 11.30–12.30, dan hanya selama ketiganya belum
//      dicentang (berlaku sepanjang minggu itu). Dashboard tetap seperti biasa.
//
// Jendela jamnya BENAR-BENAR dijalankan menit demi menit sepanjang 24 jam,
// bukan dicocokkan regex.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-diskusi');
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
      R + 'lib/learning.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
if (!fs.existsSync(path.join(DIR, 'learning.js'))) {
  console.log('  ✗ gagal mengompilasi learning.ts');
  process.exit(1);
}

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({}), setDoc: async () => {},
      onSnapshot: () => () => {}, deleteField: () => '__delete__',
      query: () => ({}), orderBy: () => ({}), limit: () => ({}),
      writeBatch: () => ({}), Timestamp: { fromDate: (d) => d },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (/^(expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const LRN = require(path.join(DIR, 'learning.js'));

// =====================================================================
console.log('=== 1. Berkasnya berganti nama jadi Discussion ===');
// =====================================================================
c('components/learning/DiscussionTab.tsx ada',
  fs.existsSync(R + 'components/learning/DiscussionTab.tsx'));
c('TopicsTab.tsx sudah tidak ada',
  !fs.existsSync(R + 'components/learning/TopicsTab.tsx'));
{
  const isi = baca('components/learning/DiscussionTab.tsx');
  const layar = baca('app/learning.tsx');
  c('komponennya ikut bernama DiscussionTab',
    /export function DiscussionTab\(\{/.test(isi) && !/TopicsTab/.test(isi));
  c('layar Learning memanggilnya dari berkas barunya',
    /import \{ DiscussionTab \} from '@\/components\/learning\/DiscussionTab';/.test(layar) &&
      /<DiscussionTab topicsDone=\{topicsDone\} now=\{now\} \/>/.test(layar));
  c('tak ada sisa rujukan "TopicsTab" di seluruh app/ & components/',
    ['app/learning.tsx', 'app/(tabs)/index.tsx', 'app/reminders.tsx',
      'components/learning/WeekTab.tsx', 'components/learning/SkillsTab.tsx',
    ].every((f) => !/TopicsTab/.test(baca(f))));
  // Isinya TIDAK boleh ikut berubah — ini murni ganti nama.
  c('isi sub-tabnya utuh (blok mingguan, daftar panjang, centangnya)',
    /💬 Discussion This Week/.test(isi) && /💬 Semua Bahan Diskusi/.test(isi) &&
      /weekly\.map/.test(isi) && /setTopicDone/.test(isi));
}

// =====================================================================
console.log('\n=== 2. Jendela 11.30–12.30 — dijalankan tiap menit, 24 jam ===');
// =====================================================================
{
  // 22 Sep 2026 (Today OS): jendela 11.30–12.30 DIBUANG bersama fungsinya.
  // Topik diskusi minggu ini jadi baris tingkat "up next" di Today (bukan
  // tagihan hari ini, tapi selalu terlihat sepanjang minggu).
  c('discussionWindowNow sudah tidak ada', typeof LRN.discussionWindowNow === 'undefined');
  const engine = BACA_TODAY('lib/today.ts');
  c('Today Engine: topik minggu ini dari pendingTopicsOfWeek → baris "next" ke Learning › Discussion',
    /const topics = pendingTopicsOfWeek\(input\.topicsDone, now\);/.test(engine) &&
      /id: 'learning-topics',[\s\S]{0,120}tier: 'next',/.test(engine) &&
      /pathname: '\/learning', params: \{ tab: 'topics' \}/.test(engine));
}

// =====================================================================
console.log('\n=== 3. Bertahan SEPANJANG minggu selama belum dicentang ===');
// =====================================================================
{
  // Senin 24 Agu 2026 … Minggu 30 Agu 2026.
  const senin = new Date(2026, 7, 24, 12, 0);
  const hari = Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 7, 24 + i, 12, 0));

  const kunci = (d) => LRN.topicsOfWeek(d).map((t) => t.key).join('|');
  c('ketiga topiknya sama tiap hari dalam minggu itu',
    hari.every((d) => kunci(d) === kunci(senin)), kunci(senin));

  const belumApaApa = hari.every(
    (d) => LRN.pendingTopicsOfWeek({}, d).length === 3,
  );
  c('belum ada yang dicentang → tetap 3 tertagih dari Senin sampai Minggu',
    belumApaApa);

  const topik = LRN.topicsOfWeek(senin);
  const duaBeres = { [topik[0].key]: true, [topik[1].key]: true };
  c('dicentang 2 → sisa 1, dan sisanya tetap muncul hari-hari berikutnya',
    hari.every((d) => LRN.pendingTopicsOfWeek(duaBeres, d).length === 1));

  const semuaBeres = Object.fromEntries(topik.map((t) => [t.key, true]));
  c('ketiganya dicentang → tidak ada lagi yang ditagih seminggu itu',
    hari.every((d) => LRN.pendingTopicsOfWeek(semuaBeres, d).length === 0));

  // Senin berikutnya topiknya berganti → centang lama tidak ikut membungkam.
  const seninDepan = new Date(2026, 7, 31, 12, 0);
  c('Senin berikutnya topiknya berganti & tagihannya hidup lagi',
    kunci(seninDepan) !== kunci(senin) &&
      LRN.pendingTopicsOfWeek(semuaBeres, seninDepan).length === 3);
}

// =====================================================================
console.log('\n=== 4. Kartunya di Home: di DEPAN Doa Syafaat ===');
// =====================================================================
{
  // 22 Sep 2026: kartu Home dibuang; di Today ia baris terlipat "Up next"
  // yang digambar sesudah semua langganan tiba (ready), dengan lambang
  // kelompok tiap topik & tujuan Learning › Discussion.
  const engine = BACA_TODAY('lib/today.ts');
  const today = BACA_TODAY('app/(tabs)/index.tsx');
  c('menunggu langganan tiba dulu (tak berkedip 3 topik)',
    /\{ready \? \(/.test(today) && /subscribeTopicsDone\(uid, mark\('topicsDone', setTopicsDone\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
  c('isinya ketiga topik lengkap dengan lambang kelompoknya',
    /topics\.map\(\(t\) => `\$\{topicGroupMeta\(t\.group\)\.emoji\} \$\{t\.label\}`\)/.test(engine));
  c('di-click → Learning, langsung sub-tab 💬 Discussion',
    /id: 'learning-topics',[\s\S]{0,300}pathname: '\/learning', params: \{ tab: 'topics' \}/.test(engine));
  c('tingkatnya "up next" (terlipat), bukan tagihan hari ini',
    /<FoldedList label="Up next" items=\{model\.upNext\} \/>/.test(today));
}

// =====================================================================
console.log('\n=== 5. Dashboard TIDAK ikut dibatasi jam ===');
// =====================================================================
{
  const dash = baca('app/reminders.tsx');
  c('kartunya di Dashboard tetap apa adanya (sepanjang hari)',
    /const learningTopics = pendingTopicsOfWeek\(topicsDone, now\);/.test(dash));
  c('discussionWindowNow sama sekali tidak dipakai di Semua Pengingat (fungsinya pun sudah tiada)',
    !/discussionWindowNow/.test(dash) && !/discussionWindowNow/.test(BACA_TODAY('lib/learning.ts')));
  c('judul & tujuannya di Dashboard tidak berubah',
    /title="💬 Discussion Reminder"/.test(dash) &&
      /params: \{ tab: 'topics' \}/.test(dash));

  // Badge tile Home juga tidak boleh ikut kena jam — badge itu tagihan, bukan
  // kartu; ia harus tetap menyala di luar jam 11.30–12.30.
  const home = baca('app/(tabs)/index.tsx');
  // 22 Sep 2026: badge tile Home dibuang; yang menagih tanpa memandang jam
  // kini baris Today (langkah hari ini) + baris "up next" (topik minggu ini).
  c('Today menagih Learning tanpa memandang jam (dueStep + pendingTopicsOfWeek)',
    /const step = dueStep\(input\.learningWeek\.steps, now\);/.test(BACA_TODAY('lib/today.ts')) &&
      /const topics = pendingTopicsOfWeek\(input\.topicsDone, now\);/.test(BACA_TODAY('lib/today.ts')));
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
