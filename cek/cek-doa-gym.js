// Uji: Doa Rantai 4 CL + kuota pagi 2, program Fitness cuma dumbbell/barbel,
// dan kebiasaan berpintasan (Baca Alkitab) jadi wajib.
const AKAR = require('./akar');
const BACA_TODAY = (p) => require('fs').readFileSync(AKAR + '/' + p, 'utf8').replace(/\r\n/g, '\n'); // 22 Sep 2026 Today OS
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(mod.exports, mod, ...nama.map((n) => luar[n]));
  return mod.exports;
}
const coreSrc = baca('lib/core.ts');
const potong = (src, nama, kata = 'export function') => {
  const a = src.indexOf(`${kata} ${nama}`);
  const b = src.indexOf('\n}', a) + 2;
  return src.slice(a, b).replace(kata, 'function');
};

console.log('=== Doa Rantai: 4 CORE Leader per sesi ===');
const doa = muat(
  'const PRAYER_FOLLOWUP_COUNT = ' +
    /const PRAYER_FOLLOWUP_COUNT = (\d+)/.exec(coreSrc)[1] + ';\n' +
    potong(coreSrc, 'weeklyLeaders') +
    potong(coreSrc, 'prayerSessionIndex', 'function') +
    potong(coreSrc, 'prayerFollowupLeaders') +
    '\nexport { prayerFollowupLeaders, PRAYER_FOLLOWUP_COUNT };',
);
const KUOTA = Number(/export const PRAYER_MORNING_QUOTA = (\d+)/.exec(coreSrc)[1]);
const cl = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));
const poin = Object.fromEntries(cl.map((l) => [l.id, ['pokok doa']]));
c('setelan sesi = 4 (dulu 3)', doa.PRAYER_FOLLOWUP_COUNT === 4);
c('6 CL punya pokok doa → 4 yang digilir hari ini',
  doa.prayerFollowupLeaders(cl, poin, new Date(2026, 7, 20)).length === 4);
c('CL yang belum punya pokok doa tidak ikut digilir',
  doa.prayerFollowupLeaders(cl, { a: ['x'], b: ['y'] }, new Date(2026, 7, 20)).length === 2);
c('gilirannya berputar tiap sesi (tidak orang yang sama terus)', (() => {
  const set = new Set();
  for (let i = 0; i < 6; i++) {
    set.add(doa.prayerFollowupLeaders(cl, poin, new Date(2026, 7, 18 + i)).map((l) => l.id).join(''));
  }
  return set.size > 1;
})());

console.log('\n=== Kuota gerbang pagi = 2, sisanya untuk malam ===');
c('PRAYER_MORNING_QUOTA = 2', KUOTA === 2);
// Rumus yang dipakai app/morning-journey.tsx, disalin persis dari sumbernya.
const mp = baca('app/morning-journey.tsx');
c('rumus kuota memang ada di sumbernya',
  /const chainQuota = Math\.min\(PRAYER_MORNING_QUOTA, chainRows\.length\)/.test(mp) &&
    /const chainLeft = chainDue \? Math\.max\(0, chainQuota - chainDoneCount\) : 0/.test(mp));
const sisa = (total, sudah) => {
  const quota = Math.min(KUOTA, total);
  return Math.max(0, quota - sudah);
};
c('4 CL · 0 didoakan → masih kurang 2', sisa(4, 0) === 2);
c('4 CL · 1 didoakan → masih kurang 1', sisa(4, 1) === 1);
c('4 CL · 2 didoakan → gerbang TERCENTANG (sisa 2 buat malam)', sisa(4, 2) === 0);
c('4 CL · 4 didoakan → tetap tercentang', sisa(4, 4) === 0);
c('kalau giliran cuma 1 CL, kuotanya ikut turun (gerbang tak mustahil)', sisa(1, 1) === 0);
c('tidak ada CL sama sekali → tak menahan gerbang', sisa(0, 0) === 0);

// 21 Sep 2026: hitungannya ada di app/morning-journey.tsx (yang mengoper
// chainLeft ke Morning Journey). Kalimat "Pagi ini cukup {chainQuota} dulu"
// DIHAPUS pemiliknya 27 Agu 2026; aturan kuotanya sendiri tetap dijaga.
c('kuota pagi tetap dihitung, bukan ikut terhapus bersama kalimatnya',
  /chainQuota/.test(mp) && /chainLeft=\{chainLeft\}/.test(mp) &&
    /chainLeft > 0\s*\n?\s*\? `Masih ada \$\{chainLeft\} CORE Leader yang menunggu didoakan pagi ini\.`/.test(baca('components/spiritual/journey/JourneySteps.tsx')));

console.log('\n=== Fitness: hanya dumbbell & barbel ===');
const fitSrc = baca('lib/fitness.ts');
const fit = muat(
  'type FitSession = any; type Exercise = any; type FitBlock = any;\n' +
    fitSrc.slice(fitSrc.indexOf('const WALK_WED'), fitSrc.indexOf('export const FIT_TIME_LABEL')) +
    '\nexport { FIT_PROGRAM };',
);
const semua = [];
for (const blok of ['A', 'B']) {
  for (const sesi of fit.FIT_PROGRAM[blok]) {
    for (const e of sesi.exercises) semua.push({ blok, hari: sesi.weekday, ...e });
  }
}
console.log(`  ${semua.length} baris gerakan diperiksa (blok A + B)`);

// Kata yang menandakan alat DI LUAR dumbbell/barbel/bangku/lantai.
const TERLARANG = [
  [/cable|kabel/i, 'kabel'],
  [/machine|mesin/i, 'mesin'],
  [/pulldown/i, 'pulldown (kabel)'],
  [/pushdown/i, 'pushdown (kabel)'],
  [/face pull/i, 'face pull (rope)'],
  [/rope/i, 'rope'],
  [/pull-?ups?\b/i, 'palang pull-up'],
  [/chin-?ups?\b/i, 'palang pull-up'],
  [/hanging/i, 'palang gantung'],
  [/ab wheel/i, 'ab wheel'],
  [/leg press/i, 'mesin leg press'],
  [/leg curls?/i, 'mesin leg curl'],
  [/leg extension/i, 'mesin leg extension'],
  [/t-?bar/i, 'landmine / T-bar'],
  [/smith/i, 'smith machine'],
  [/pec deck/i, 'pec deck'],
];
const nakal = [];
for (const e of semua) {
  for (const [re, alat] of TERLARANG) {
    if (re.test(e.name)) nakal.push(`blok ${e.blok} hari ${e.hari}: "${e.name}" → butuh ${alat}`);
  }
}
c('tak ada gerakan yang butuh alat di luar dumbbell/barbel', nakal.length === 0);
if (nakal.length) console.log('      ' + nakal.join('\n      '));
c('Straight-Arm Pulldown (yang kamu lingkari) sudah tidak ada',
  !semua.some((e) => /straight-?arm pulldown/i.test(e.name)));
c('id lama gerakan berkabel juga ikut hilang',
  !['cablefly', 'cablelateral', 'cablecrunch', 'straightarmpulldown', 'latpulldown',
    'seatedrow', 'facepull', 'triceppushdown', 'machinefly', 'legpress', 'hamcurl',
    'pullup', 'chinup', 'hangkneeraise', 'abwheel', 'tbarrow',
  ].some((id) => semua.some((e) => e.id === id)));

console.log('\n=== Programnya tetap utuh (bukan sekadar dihapus) ===');
for (const blok of ['A', 'B']) {
  const sesi = fit.FIT_PROGRAM[blok];
  c(`blok ${blok}: tetap 7 hari`, sesi.length === 7);
  c(`blok ${blok}: tiap hari latihan beban tetap 7 gerakan`,
    sesi.filter((s) => s.kind === 'strength').every((s) => s.exercises.length === 7));
  c(`blok ${blok}: tak ada gerakan kembar dalam satu sesi`,
    sesi.every((s) => new Set(s.exercises.map((e) => e.id)).size === s.exercises.length));
}
c('tiap gerakan berbeban punya saran kg (tak ada yang kosong tanpa sebab)',
  semua.every((e) => e.cardio || e.weight !== undefined));
c('tautan video yang tersisa memang milik gerakan yang tidak diganti', (() => {
  const berubah = ['dbfly', 'skullcrusher', 'barbellrow', 'dbpullover', 'chestrow',
    'reardeltrow', 'reversecrunch', 'dbstepup', 'inclinedbfly', 'leaninglateral',
    'weightedcrunch', 'underhandrow', 'dbrowtwo', 'shrug', 'weightedsitup', 'singlelegrdl'];
  // Gerakan baru sengaja TANPA video: tautannya tidak boleh dikarang.
  return semua.filter((e) => berubah.includes(e.id)).every((e) => !e.video);
})());

console.log('\n=== Habits: Baca Alkitab bisa dipencet & jadi wajib ===');
const hSrc = baca('lib/habits.ts');
// `isFixedHabit` sekarang ikut memanggil `isNoteDrivenHabit` (31 Agu 2026:
// baris bercatatan jadi wajib), jadi potongannya harus ikut dibawa.
const hab = muat(
  'type ScheduledHabit = any;\n' +
    // 14 Sep 2026: pintu Feed memakai pola bersama REFLECTION_JOURNAL_MATCH.
    'const REFLECTION_JOURNAL_MATCH = /reflection journal|rhema/i;\n' +
    potong(hSrc, 'isNoteDrivenHabit') +
    hSrc.slice(hSrc.indexOf('export type HabitLink'), hSrc.indexOf('/** Kebiasaan dari paket'))
      .replace(/^export /gm, '') +
    '\nexport { HABIT_LINKS, habitLink, habitMirror, isFixedHabit, isNoteDrivenHabit };',
  { Color: new Proxy({}, { get: (_, k) => String(k) }), FITNESS_HABIT_ID: 'fitness-link' },
);
// Nama persis seperti di daftar kebiasaanmu (ada emoji di depannya).
const pagi = { id: 'x1', label: '📖 Morning Bible Reading' };
const malam = { id: 'x2', label: '📖 Night Bible Reading' };
const biasa = { id: 'x3', label: '💊 Take Vitamin C & D' };
c('Morning Bible Reading → layar Baca Alkitab sesi PAGI', (() => {
  const l = hab.habitLink(pagi);
  return l && l.route.pathname === '/bible-reading' && l.route.params.session === 'morning';
})());
c('Night Bible Reading → sesi MALAM', (() => {
  const l = hab.habitLink(malam);
  return l && l.route.pathname === '/bible-reading' && l.route.params.session === 'night';
})());
// Keterangannya dipendekkan jadi "Buka …" (keputusan pemilik app). Yang tetap
// dijaga: keduanya menyebut SESI yang benar — pagi ke Pagi, malam ke Malam.
// Bahwa barisnya cermin (tercentang sendiri sesudah "✅ Sudah baca") diperiksa
// di baris berikutnya lewat habitMirror, bukan lewat kalimatnya.
c('keduanya dapat keterangan kecil yang menyebut sesinya',
  hab.habitLink(pagi).note === 'Buka Baca Alkitab › Pagi' &&
    hab.habitLink(malam).note === 'Buka Baca Alkitab › Malam');
c('dan keduanya memang terkunci sebagai cermin',
  hab.habitMirror(pagi) === 'bible-morning' &&
    hab.habitMirror(malam) === 'bible-night');
// Kartu di Home tidak lagi lompat langsung ke layar catat bacaan: ia mendarat
// di BARIS Bible Reading sesi jam itu di Habits — dan baris itulah yang membuka
// layar ini (route di atas). Tujuan akhirnya tetap sama, cuma lewat barisnya,
// jadi centangnya kelihatan dalam rangkaian hari itu.
c('baris Today mendarat di baris Habits sesi yang sama (22 Sep 2026)', (() => {
  const home = BACA_TODAY('lib/today.ts');
  return /pathname: '\/habits', params: \{ focus: `bible-\$\{bibleSession\}` \}/.test(home) &&
    hab.habitMirror(pagi) === 'bible-morning' &&
    hab.habitMirror(malam) === 'bible-night';
})());
c('centangnya tetap bisa diketuk sendiri (bukan cermin seperti Fitness)',
  !hab.habitLink(pagi).mirror && !hab.habitLink(malam).mirror);

console.log('\n=== Kebiasaan berpintasan = wajib, tak bisa dihapus ===');
c('Baca Alkitab pagi & malam terkunci', hab.isFixedHabit(pagi) && hab.isFixedHabit(malam));
c('Morning Exercise (cermin Fitness) ikut terkunci', hab.isFixedHabit({ id: 'fitness-link', label: '🏋️ Morning Exercise' }));
c('Protein + Fiber TIDAK lagi terkunci (pintasan Diet-nya sudah dibuang)',
  !hab.isFixedHabit({ id: 'p', label: '🍽️ Protein + Fiber + Micronutrients' }));
c('kebiasaan biasa TETAP bisa dihapus', !hab.isFixedHabit(biasa));
const ht = baca('components/habits/HabitsTab.tsx');
c('tombol hapus disembunyikan untuk kebiasaan wajib',
  /editing !== 'new' && editing && isFixedHabit\(editing\) \?/.test(ht));
c('Naik/Turun tetap ada untuk semua kebiasaan',
  /\{editing && editing !== 'new' && \(\s*\n\s*<View style=\{styles\.moveRow\}>/.test(ht));
c('menghapus tetap mungkin untuk kebiasaan biasa', /onDelete=\{handleDeleteHabit\}/.test(ht));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
