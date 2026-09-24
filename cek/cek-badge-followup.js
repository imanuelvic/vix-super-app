// 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`, bukan `user.uid`.
// 11 Sep 2026 — "kalau di layar Follow Up ada tanda belum dikerjakan, badge-nya
// harus ada juga di sub-tab Follow Up dan di Home."
//
// Keluhannya lahir jam 07.55: kartu CL di sub-tab Follow Up bergaris merah &
// bertitik merah, tapi badge sub-tab dan badge tile CORE di Home sama-sama
// kosong. Sebabnya dua aturan yang berbeda untuk satu perkara yang sama —
// kartunya cuma melihat `!done`, badge-nya menunggu jam 09.00 (followupDue).
//
// Yang dijaga suite ini BUKAN "badge-nya ada", tapi hal yang lebih keras:
// ANGKA DI LUAR = JUMLAH KARTU MERAH DI DALAM, pada jam berapa pun. Aturan
// kartunya diambil dari sumber layarnya lalu DIJALANKAN, bukan dicocokkan
// hurufnya — jadi kalau salah satu sisi bergeser sendiri, di sinilah merahnya.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-badge-followup');
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
      R + 'lib/core.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
if (!fs.existsSync(path.join(DIR, 'core.js'))) {
  console.log('  ✗ gagal mengompilasi core.ts');
  process.exit(1);
}

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'firebase/firestore') {
    return {
      collection: () => ({}), doc: () => ({ path: 'x' }), setDoc: async () => {},
      getDoc: async () => ({ data: () => ({}) }), onSnapshot: () => () => {},
      deleteField: () => '__d__', query: () => ({}), orderBy: () => ({}),
      limit: () => ({}), writeBatch: () => ({}), arrayUnion: () => ({}),
      deleteDoc: async () => {},
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (req === './firebase' || req.endsWith('/firebase')) return { db: {} };
  if (req === './liveDoc' || req.endsWith('/liveDoc')) {
    return { liveDoc: () => () => {}, unsubscribeAll: () => () => {} };
  }
  if (/^@\/assets\/style\/color$/.test(req)) {
    return { Color: new Proxy({}, { get: (_, k) => `Color.${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const CORE = require(path.join(DIR, 'core.js'));

const tab = baca('components/core/FollowupTab.tsx');
const layarCore = baca('app/(tabs)/core.tsx');
const home = baca('app/(tabs)/index.tsx');
const libCore = baca('lib/core.ts');

// Hari keluhannya: Jumat 11 Sep 2026.
const HARI = '2026-09-11';
const jam = (h, m = 0) => new Date(2026, 8, 11, h, m);

// =====================================================================
console.log('=== 1. Gerbang jamnya benar-benar hilang dari kodenya ===');
// =====================================================================
{
  // Bukan sekadar "tidak dipanggil" — fungsinya memang sudah tidak ada, jadi
  // tak ada yang bisa memanggilnya lagi secara tidak sengaja.
  c('followupHourReached sudah tidak ada sama sekali',
    CORE.followupHourReached === undefined &&
      !/followupHourReached/.test(libCore));

  // Isi followupDue dipotong dari sumbernya lalu diperiksa: tak boleh ada
  // pembacaan jam di dalamnya. Gerbang baru yang diselundupkan lewat
  // getHours/getMinutes ketahuan di sini.
  const awal = libCore.indexOf('export function followupDue<');
  const badan = libCore.slice(awal, libCore.indexOf('\n}', awal));
  c('badan followupDue tidak membaca jam sama sekali',
    awal > -1 && !/getHours|getMinutes|FROM_HOUR/.test(badan));

  // Jendela kartu Home 09.00–09.30 SENGAJA tetap ada — ia bukan penagih,
  // cuma tepukan bahu di jam yang paling mungkin dikerjakan.
  // 22 Sep 2026: jendela 09.00–09.30 DIBUANG — baris Follow Up di Today
  // menagih sepanjang hari dari followupDue yang sama.
  c('jendela kartu Home 09.00–09.30 dibuang; Today memakai followupDue sepanjang hari',
    typeof CORE.followupCardWindow === 'undefined' &&
      /followupDue\(leaders, now, input\.weeklyFocus, todayId\)/.test(BACA_TODAY('lib/today.ts')));
}

// =====================================================================
console.log('\n=== 2. Aturan kartu merah, diambil dari layarnya & dijalankan ===');
// =====================================================================
// Ini jantungnya: kalau aturan di kartu dan aturan di badge sudah tidak sama,
// tidak ada gunanya memeriksa badge-nya sendiri.
let kartuMerah; // (leader, dayId) => apakah kartunya merah
{
  const m = tab.match(/done: l\.(\w+) === (\w+),/);
  c('syarat kartu CL terbaca dari sumbernya', !!m, m ? `${m[1]} === ${m[2]}` : '');
  if (m) {
    const medan = m[1];
    kartuMerah = (l, dayId) => !(l[medan] === dayId);
  }

  // Titik merah & garis merah dipasang dari syarat yang SAMA (`!done`), dan
  // tidak dibungkus syarat jam apa pun.
  c('titik merah dipasang dari !done', /\{!done && <AttentionMark corner \/>\}/.test(tab));
  c('garis merah dipasang dari !done juga', /attentionBorder\(!done\)/.test(tab));
  c('tak ada syarat jam yang membungkusnya di layar ini',
    !/getHours|followupHourReached|followupCardWindow/.test(tab));
}

// =====================================================================
console.log('\n=== 3. Angka di luar = jumlah kartu merah di dalam ===');
// =====================================================================
{
  const leaders = [
    { id: 'a', name: 'David', heart: '💙', lastFollowupDayId: null,
      birthDay: 1, birthMonth: 1 },
    { id: 'b', name: 'Reyki', heart: '🖤', lastFollowupDayId: null,
      birthDay: 2, birthMonth: 2 },
    { id: 'c', name: 'Riky', heart: '🤎', lastFollowupDayId: null,
      birthDay: 3, birthMonth: 3 },
  ];
  const fokus = { weekIdx: -1, ids: [] }; // undian bawaan
  const hitung = (ls, now, greets = {}, mainTeam = []) =>
    CORE.coreAttention({
      leaders: ls, mainTeam, visitations: [], greets,
      focus: fokus, now, todayId: HARI,
    });

  // Berapa kartu yang MERAH di layar, dijalankan dari aturan kartunya sendiri.
  const merahDiLayar = (ls, now) =>
    CORE.focusLeaders(ls, now, fokus).filter((l) => kartuMerah(l, HARI)).length;

  // Disapu semenit demi semenit. Satu jam yang meleset saja sudah cukup untuk
  // mengulang persis keluhan yang memicu perubahan ini.
  const meleset = [];
  for (let mnt = 0; mnt < 24 * 60; mnt++) {
    const t = jam(Math.floor(mnt / 60), mnt % 60);
    if (hitung(leaders, t).followup !== merahDiLayar(leaders, t)) meleset.push(mnt);
  }
  c('sepanjang 1.440 menit, badge = jumlah kartu merah',
    meleset.length === 0,
    meleset.length === 0 ? '1440 menit cocok' : `${meleset.length} menit meleset`);

  // Jam keluhannya, disebut sendiri supaya kalau suatu saat merah, pesannya
  // langsung menunjuk kejadian aslinya.
  c('jam 07.55 — badge TIDAK lagi kosong',
    hitung(leaders, jam(7, 55)).followup > 0,
    `${hitung(leaders, jam(7, 55)).followup} tertagih`);
  c('jam 00.05 pun sudah menagih', hitung(leaders, jam(0, 5)).followup > 0);

  // Dikerjakan → kartunya tidak merah lagi, badge-nya ikut padam. Keduanya
  // harus berubah BERSAMAAN, bukan cuma salah satu.
  const sudah = leaders.map((l) => ({ ...l, lastFollowupDayId: HARI }));
  c('semua dikerjakan → kartu bersih & badge padam bersamaan',
    merahDiLayar(sudah, jam(7, 55)) === 0 &&
      hitung(sudah, jam(7, 55)).followup === 0);

  // Ulang tahun hari ini yang belum diucapkan ikut terhitung — penyusun kedua
  // badge sub-tab, dan kartunya pun bertanda merah di layar yang sama.
  // `birthMonth` di lib/core.ts 0-based (dioper langsung ke `new Date`), jadi
  // September = 8. Sempat tertulis 9 di sini → ulang tahunnya jatuh ke Oktober
  // dan cek-nya merah; memang seharusnya merah.
  const ultah = [
    { ...leaders[0], lastFollowupDayId: HARI, birthDay: 11, birthMonth: 8, birthYear: 1996 },
  ];
  const sisa = sudah.slice(1);
  c('ulang tahun hari ini yang belum diucapkan ikut dihitung',
    hitung([...ultah, ...sisa], jam(7, 55)).followup >
      hitung([...ultah, ...sisa], jam(7, 55), { a: HARI }).followup);

  // total = penjumlahan bagian-bagiannya, jadi angka di Home selalu punya
  // tujuan di dalam.
  const p = hitung(leaders, jam(7, 55));
  c('total tile Home = visitation + followup', p.total === p.visitation + p.followup);
}

// =====================================================================
console.log('\n=== 4. Angkanya sampai ke kedua tempat yang diminta ===');
// =====================================================================
{
  // Sub-tab Follow Up di dalam layar CORE.
  c('badge sub-tab Follow Up dipasang dari coreAttention',
    /withBadge\(TABS, \{[\s\S]{0,160}followup: perhatian\.followup,/.test(layarCore));
  c('perhatian-nya memang coreAttention, bukan hitungan sendiri',
    /const perhatian = coreAttention\(\{/.test(layarCore) &&
      !/focusLeaders\([^)]*\)\.filter/.test(layarCore));

  // Tile CORE di Home.
  c('badge tab CORE di kaki app dipasang dari coreAttention (22 Sep 2026)',
    /const coreBadge = coreAttention\(\{ leaders, mainTeam, visitations, greets, focus, now, todayId \}\)/.test(BACA_TODAY('app/(tabs)/_layout.tsx')) &&
      /tabBarBadge: coreBadge > 0 \? coreBadge : undefined,/.test(BACA_TODAY('app/(tabs)/_layout.tsx')));

  // Keduanya menunggu dokumennya tiba dulu — badge yang berkedip salah sekejap
  // tiap layar dibuka sama buruknya dengan badge yang tidak muncul.
  c('Today menunggu langganannya sampai sebelum menggambar barisnya',
    /const SOURCES = \d+;/.test(BACA_TODAY('hooks/useTodayData.ts')) &&
      /subscribeWeeklyFocus\(uid, mark\('weeklyFocus', setWeeklyFocus\), fail\)/.test(BACA_TODAY('hooks/useTodayData.ts')));
  c('CORE ikut jam berjalan, jadi badge-nya berganti sendiri tiap hari',
    /const \{ now, todayId: dayId \} = useNow\(\);/.test(layarCore));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
