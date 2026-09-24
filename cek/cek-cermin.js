// Bukti: baris kebiasaan yang centangnya DICERMINKAN dari layar lain —
// 💡 Top 3 Priorities, 📖 Morning/Midday/Night Bible Reading — tidak bisa
// dicentang manual, dan tercentang sendiri begitu pekerjaannya benar dilakukan.
//
// lib/habits.ts, lib/spiritual.ts & lib/priority.ts dijalankan BENERAN.

const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(os.tmpdir(), 'cek-cermin-out');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const kodeSaja = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------- compile ----------
try {
  execFileSync(
    'npx',
    [
      'tsc',
      path.join(ROOT, 'lib/habits.ts'),
      path.join(ROOT, 'lib/spiritual.ts'),
      path.join(ROOT, 'lib/priority.ts'),
      '--ignoreConfig',
      '--outDir',
      OUT,
      '--module',
      'commonjs',
      '--target',
      'es2020',
      '--skipLibCheck',
      '--esModuleInterop',
      '--moduleResolution',
      'bundler',
    ],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch {
  // tipe modul native mengeluh — .js-nya tetap ditulis.
}

const aslinya = Module._load;
Module._load = function (permintaan, induk, isMain) {
  if (permintaan === './firebase') return { db: {} };
  if (permintaan === './liveDoc') return { liveDoc: () => () => {} };
  if (permintaan.endsWith('assets/style/color')) {
    return { Color: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) };
  }
  if (permintaan.startsWith('firebase/')) {
    return {
      doc: () => ({}),
      setDoc: async () => {},
      deleteField: () => null,
      Timestamp: { now: () => ({}), fromDate: () => ({}) },
    };
  }
  if (/^expo-|^@react-native|^react-native/.test(permintaan)) return {};
  return aslinya(permintaan, induk, isMain);
};
const H = require(path.join(OUT, 'habits.js'));
const S = require(path.join(OUT, 'spiritual.js'));
const P = require(path.join(OUT, 'priority.js'));
Module._load = aslinya;

// ================= 1. Baris mana yang jadi cermin =================
const kebiasaan = (label, extra = {}) => ({ id: 'x1', label, slot: 'morning', ...extra });

ok('Top 3 Priorities → cermin Daily Priority',
  H.habitMirror(kebiasaan('💡 Top 3 Priorities')) === 'priority');
ok('Morning Bible Reading → cermin sesi Pagi',
  H.habitMirror(kebiasaan('📖 Morning Bible Reading')) === 'bible-morning');
ok('Midday Bible Reading → cermin sesi Siang',
  H.habitMirror(kebiasaan('📖 Midday Bible Reading')) === 'bible-daytime');
ok('Night Bible Reading → cermin sesi Malam',
  H.habitMirror(kebiasaan('📖 Night Bible Reading')) === 'bible-night');
ok('Morning Exercise (id tetap) tetap cermin Fitness',
  H.habitMirror({ id: H.FITNESS_HABIT_ID, label: '🏋️ Morning Exercise', slot: 'morning' }) ===
    'fitness');

// Kebiasaan biasa TIDAK ikut terkunci.
for (const l of ['🧊 Soak Face on Cold Water', '💧 Minum Air', '😴 Tidur jam 22.00']) {
  ok(`"${l}" tetap dicentang sendiri (bukan cermin)`,
    H.habitMirror(kebiasaan(l)) === null);
}
// Baris berpintasan yang BUKAN cermin tetap bisa dicentang manual.
ok('baris Instagram tetap bisa dicentang manual (cuma pintasan)',
  H.habitMirror(kebiasaan('📱 Revive + IG Story')) === null);

// ================= 2. Aturan "sudah" tiap cermin =================
// --- Daily Priority: harus KETIGA-tiganya terisi ---
const prio = (...teks) =>
  Array.from({ length: P.PRIORITY_COUNT }, (_, i) => ({
    text: teks[i] ?? '',
    done: false,
  }));

ok('3 prioritas terisi → tercentang',
  P.priorityFilled(prio('a', 'b', 'c')) === P.PRIORITY_COUNT);
ok('baru 2 terisi → BELUM tercentang',
  P.priorityFilled(prio('a', 'b')) !== P.PRIORITY_COUNT);
ok('kosong semua → belum', P.priorityFilled(prio()) === 0);
ok('spasi doang tidak dihitung terisi',
  P.priorityFilled(prio('a', '   ', 'c')) === 2);
// Dicoret atau belum TIDAK berpengaruh — kebiasaannya "menentukan 3 prioritas".
const tercoret = prio('a', 'b', 'c').map((i) => ({ ...i, done: true }));
ok('sudah dicoret atau belum, sama saja',
  P.priorityFilled(tercoret) === P.PRIORITY_COUNT);

// --- Baca Alkitab: terisi & bukan ditandai lewat ---
const sesi = (m, d, n) => ({ morning: m, daytime: d, night: n });

ok('bacaan terisi → sudah baca',
  S.bibleSessionRead(sesi('Kej 1', '', ''), 'morning') === true);
ok('kosong → belum', S.bibleSessionRead(sesi('', '', ''), 'morning') === false);
ok('ditandai DILEWATI ≠ sudah baca',
  S.bibleSessionRead(sesi(S.BIBLE_SKIPPED, '', ''), 'morning') === false);
ok('tiap sesi berdiri sendiri',
  S.bibleSessionRead(sesi('Kej 1', '', 'Maz 1'), 'daytime') === false &&
    S.bibleSessionRead(sesi('Kej 1', '', 'Maz 1'), 'night') === true);

// Keadaan lengkap (centang + tanda ✗) — bentuknya sama dengan fitMirrorState.
// Jamnya kini ikut menentukan (sesi yang jendelanya habis ditandai ✗ sendiri),
// jadi diuji pada jam 08.00 — jendela Pagi masih terbuka, supaya yang diperiksa
// di sini murni isi catatannya. Aturan jam-lewatnya diuji di cek-story.js.
const PAGI = new Date(2026, 7, 26, 8, 0);
const cermin = (isi) => S.bibleMirrorState(sesi(isi, '', ''), 'morning', PAGI);
ok('sudah baca → { done: true, skipped: false }',
  JSON.stringify(cermin('Kej 1')) === JSON.stringify({ done: true, skipped: false }));
ok('dilewati → { done: false, skipped: true } (barisnya bertanda ✗)',
  JSON.stringify(cermin(S.BIBLE_SKIPPED)) ===
    JSON.stringify({ done: false, skipped: true }));
ok('belum apa-apa → { done: false, skipped: false }',
  JSON.stringify(cermin('')) === JSON.stringify({ done: false, skipped: false }));

// ================= 3. Baris Siang disisipkan sekali =================
const dasar = [
  { id: 'a', label: '📖 Morning Bible Reading', slot: 'morning' },
  { id: 'b', label: '📖 Night Bible Reading', slot: 'night' },
];
const setelah = H.withMiddayBible(dasar);
ok('baris Siang disisipkan kalau belum ada', setelah !== null);
ok('… ke sesi SIANG', setelah.at(-1).slot === 'daytime');
ok('… namanya Midday Bible Reading', /Midday Bible Reading/.test(setelah.at(-1).label));
ok('… ikut jadi cermin sesi Siang',
  H.habitMirror(setelah.at(-1)) === 'bible-daytime');
ok('… bertingkat inti 🟢 & area Spirit 🙏',
  setelah.at(-1).tier === 'core' && setelah.at(-1).area === 'spirit');
ok('… kebiasaan lama tidak tersentuh',
  setelah.length === 3 && setelah[0].id === 'a' && setelah[1].id === 'b');
ok('dipanggil lagi → null (TIDAK menulis ulang / tidak dobel)',
  H.withMiddayBible(setelah) === null);
ok('sudah ada versi ketikan sendiri → tidak ditambah lagi',
  H.withMiddayBible([{ id: 'z', label: 'midday bible reading', slot: 'daytime' }]) ===
    null);
ok('baris cermin wajib (tidak bisa dihapus dari daftar)',
  H.isFixedHabit(setelah.at(-1)) === true);

// ================= 4. Terpasang di layar =================
const layar = kodeSaja(baca('app/habits.tsx'));
ok('layar Habits mendengarkan Daily Priority & catatan Baca Alkitab',
  // 21 Sep 2026: langganan lewat useLiveAll → `subscribeX(uid, …)`.
  /subscribePriorityDay\(uid, dayId, setPriorities\)/.test(layar) &&
    /subscribeBibleReadingToday\(uid, dayId, setBible\)/.test(layar));
ok('baris Siang disisipkan hanya kalau withMiddayBible mengembalikan daftar',
  /const next = withMiddayBible\(schedule\);\s*\n\s*if \(next\) saveHabits\(/.test(layar));
ok('penyelarasan melewati baris fitness (punya efeknya sendiri)',
  /if \(kind === null \|\| kind === 'fitness'\) continue;/.test(layar));
ok('tanda ✗ diurus dulu, baru centangnya — sama seperti baris olahraga',
  /!!day\.skipped\[habit\.id\] !== want\.skipped[\s\S]{0,200}else if \(!!day\.done\[habit\.id\] !== want\.done\)/.test(
    layar,
  ));
// Menulis HANYA kalau berbeda: tiap panggilan tulis harus berada DI DALAM
// perbandingan "!== want", tidak boleh ada yang menulis tanpa syarat.
const efekCermin = /const want = mirrorState\([\s\S]*?\n  \}, \[user, dayId, day, schedule/.exec(
  layar,
);
ok('potongan efek penyelarasannya ketemu', efekCermin !== null);
ok('tidak ada tulis tanpa syarat (normalnya nol tulis Firestore)',
  efekCermin !== null &&
    (efekCermin[0].match(/setHabit(Done|Skipped)\(/g) ?? []).length === 2 &&
    (efekCermin[0].match(/!== want\.(done|skipped)/g) ?? []).length === 2);
ok('gagal menyinkronkan tidak boleh meledakkan layar',
  (layar.match(/\.catch\(\s*\(\) => undefined,?\s*\)/g) ?? []).length >= 3);

const tab = kodeSaja(baca('components/habits/HabitsTab.tsx'));
ok('lingkaran centang baris cermin DIKUNCI',
  /const mirrored = link\?\.mirrorOf !== undefined;/.test(tab) &&
    /locked=\{mirrored \|\| fromNote\}/.test(tab));
ok('click lingkarannya membuka layar asalnya, bukan mencentang',
  /mirrored \? openHabitLink\(link!\) : handleToggle\(habit\)/.test(tab));
ok('tombol ✗ tidak ada di baris cermin (dilewati dari layar asalnya)',
  /\{!mirrored && \(/.test(tab));
ok('tidak ada lagi sebutan "fromFitness" (cerminnya bukan cuma olahraga)',
  !/fromFitness/.test(tab));

const libH = kodeSaja(baca('lib/habits.ts'));
// Kalimatnya dipendekkan jadi "Buka …" (keputusan pemilik app) — yang tetap
// dijaga: TIAP baris cermin punya keterangan, tak ada yang telanjang.
ok('setiap baris cermin punya keterangan tujuannya',
  (libH.match(/note: 'Buka /g) ?? []).length >= 5);

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
