// Permintaan 8 (4 Sep 2026): "pastikan fitur habits ini perhitungannya benar,
// terbaca ketika habis hari jam 00.00, dan semua kebiasaan wajib/penting sudah
// tercentang semua di hari itu."
//
// Yang diperiksa cek ini ATURANNYA, bukan isi datamu (daftar kebiasaanmu
// tinggal di Firestore, bukan di kode):
//   1. hari berganti TEPAT jam 00.00 — bukan jam 4 subuh, bukan jam lain;
//   2. streak naik HANYA kalau SEMUA kebiasaan Inti hari itu tercentang;
//   3. yang ditandai ✗ (dilewati) dihitung BELUM beres, bukan dikeluarkan;
//   4. bolong sehari memutus streaknya, dan bersambung kalau kemarin beres;
//   5. angka yang dipajang mati sendiri kalau streaknya memang sudah putus.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8').replace(/\r\n/g, '\n');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (!s && extra ? ` → ${extra}` : ''));
};

const tsc = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
const pasang = (js, req) => {
  const mod = { exports: {} };
  new Function('exports', 'module', 'require', js)(mod.exports, mod, req);
  return mod.exports;
};
const shim = (nama) => {
  if (nama === './firebase') return { db: {} };
  if (nama === './liveDoc') return { liveDoc: () => () => {} };
  if (nama === 'firebase/firestore') return new Proxy({}, { get: () => () => ({}) });
  if (nama === './format') return require(R + 'scratchpad/format-asli.js');
  return new Proxy({}, { get: () => () => undefined });
};

// lib/habits.ts butuh beberapa modul lain; yang dipakai cek ini cuma fungsi
// murni score/streak, jadi sisanya boleh diganti boneka.
const H = pasang(tsc(baca('lib/habits.ts')), shim);
const { coreDone, dailyScore, isCoreHabit } = H;

const habit = (id, tier) => ({ id, label: id, slot: 'morning', tier });
const INTI = ['a', 'b', 'c'].map((i) => habit(i, 'core'));
const BONUS = [habit('x', 'support'), habit('y', 'optional')];
const SEMUA = [...INTI, ...BONUS];

// ============================================================
console.log('=== 1. Yang menentukan streak cuma kebiasaan Inti ===');
// ============================================================
c('kebiasaan Inti dikenali dari `tier`', isCoreHabit(INTI[0]) && !isCoreHabit(BONUS[0]));
c('semua Inti tercentang → hari itu beres',
  coreDone(SEMUA, { a: true, b: true, c: true }) === true);
c('satu Inti bolong → belum beres',
  coreDone(SEMUA, { a: true, b: true }) === false);
c('bonus tidak ikut menentukan',
  coreDone(SEMUA, { a: true, b: true, c: true, x: false, y: false }) === true);
c('daftar kosong tidak pernah terbaca "beres"', coreDone([], {}) === false);

console.log('\n   Yang ditandai ✗ dihitung BELUM beres');
c('dilewati ≠ selesai',
  coreDone(SEMUA, { a: true, b: true, c: true }, { c: true }) === false);
c('…dan skornya ikut turun',
  dailyScore(SEMUA, { a: true, b: true, c: true }, { c: true }) < 10);

// ============================================================
console.log('\n=== 2. Skor harian = cermin streaknya ===');
// ============================================================
// 10 hanya untuk yang benar-benar beres semua — kalau tidak, "10/10" bisa
// muncul di hari yang masih bolong.
c('10/10 cuma kalau semua Inti beres',
  dailyScore(SEMUA, { a: true, b: true, c: true }) === 10);
// 10 kebiasaan Inti — persis sebanyak kebiasaan wajib di daftar sekarang.
// 9 tercentang: pembulatan biasa memberi 10, dan "10/10" di hari yang masih
// bolong itu kebohongan kecil yang bikin streak terasa salah hitung.
const SEPULUH = 'abcdefghij'.split('').map((i) => habit(i, 'core'));
const sembilan = Object.fromEntries('abcdefghi'.split('').map((i) => [i, true]));
c('9 dari 10 Inti → 9, bukan 10 (pembulatan tidak boleh menipu)',
  dailyScore(SEPULUH, sembilan) === 9, String(dailyScore(SEPULUH, sembilan)));
c('10 dari 10 Inti → 10, dan harinya beres',
  dailyScore(SEPULUH, { ...sembilan, j: true }) === 10 &&
  coreDone(SEPULUH, { ...sembilan, j: true }) === true);
c('2 dari 3 Inti → 7 (ikut perbandingannya, bukan angka asal)',
  dailyScore(SEMUA, { a: true, b: true }) === 7);
c('belum ada yang dicentang → 0', dailyScore(SEMUA, {}) === 0);
c('skor 10 dan "hari beres" selalu sejalan', [
  {}, { a: true }, { a: true, b: true }, { a: true, b: true, c: true },
].every((d) => (dailyScore(SEMUA, d) === 10) === coreDone(SEMUA, d)));

// ============================================================
console.log('\n=== 3. Hari berganti jam 00.00 ===');
// ============================================================
const health = baca('lib/health.ts');
const format = baca('lib/format.ts');
// dayDocId → dayId → tanggal LOKAL perangkat, tanpa geser jam sama sekali.
c('id hari kebiasaan = tanggal lokal apa adanya',
  /export function dayDocId\(d: Date\): string \{\s*\n\s*return dayId\(d\);/.test(health));
c('dayId dibentuk dari tanggal LOKAL — bukan UTC, bukan jam',
  /getMonth\(\) \+ 1/.test(format) && /d\.getDate\(\)/.test(format) &&
  /d\.getFullYear\(\)/.test(format) && !/getUTC/.test(format));
c('tidak ada pergeseran jam (mis. "− 4 jam") di id harian',
  !/setHours\(-|- 4 \* 60 \* 60 \* 1000/.test(format));
// Satu dokumen per hari → jam 00.00 dokumennya berganti dengan sendirinya.
c('ceklisnya satu dokumen per hari, jadi reset tengah malam otomatis',
  /users\/\{uid\}\/habitDays\/\{YYYY-MM-DD\}/.test(health));

// ============================================================
console.log('\n=== 4. Naik & putusnya streak ===');
// ============================================================
c('naik maksimal SEKALI sehari',
  /if \(streak\?\.lastDayId === todayId\) return Promise\.resolve\(\)/.test(health));
c('bersambung hanya kalau kemarin yang terakhir beres',
  /const continued = streak !== null && streak\.lastDayId === yesterdayId\(\);/.test(health) &&
  /count: continued \? streak\.count \+ 1 : 1,/.test(health));
c('angka yang dipajang mati kalau terakhir beres bukan hari ini/kemarin',
  /if \(streak\.lastDayId === todayId \|\| streak\.lastDayId === yesterdayId\(\)\) \{\s*\n\s*return streak\.count;/.test(health));

console.log('\n   Layar Habits');
const tab = baca('components/habits/HabitsTab.tsx');
c('streak dinaikkan dari keadaan "semua Inti beres", bukan dari tombolnya',
  /const coreAllDone = coreDone\(habits, day\.done, day\.skipped\);/.test(tab) &&
  /if \(!user \|\| !coreAllDone \|\| streak\?\.lastDayId === dayId\) return;/.test(tab));
// Centang bisa datang dari fitur LAIN (olahraga dicentang di Fitness), jadi
// menaikkannya cuma di dalam handleToggle akan melewatkan hari-hari itu.
c('hari yang ditutup dari fitur lain tetap terhitung',
  /useEffect\(\(\) => \{\s*\n\s*if \(!user \|\| !coreAllDone/.test(tab));
// ANGKANYA tetap cuma dari `dailyScore` — layar tidak boleh menghitung
// sendiri. Yang boleh (dan sejak 6 Sep memang ada) adalah MENDAFTAR baris
// wajibnya untuk dialog "isi score": itu menampilkan, bukan menghitung.
c('skor & streak dibaca dari fungsi yang sama, tidak dihitung ulang di layar',
  /dailyScore\(habits, day\.done, day\.skipped\)/.test(tab) &&
  (tab.match(/dailyScore\(/g) || []).length === 1 &&
  !/dailyScore = /.test(tab));
c('dialog isi score cuma MENDAFTAR baris wajibnya, tidak menghitung angkanya',
  /const wajib = grouped\[s\.key\]\.filter\(isCoreHabit\);/.test(tab) &&
  !/Math\.round\([^)]*wajib/.test(tab));

console.log(ok ? '\n✅ LULUS — hitungan Habits terbukti.' : '\n❌ ADA YANG GAGAL');
process.exit(ok ? 0 : 1);
