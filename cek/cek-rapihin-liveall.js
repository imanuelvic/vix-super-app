// /rapihin 21 Sep 2026: hooks/useLiveAll.ts — satu hook untuk blok "banyak
// langganan Firestore sekaligus" (useEffect + `const fail` + unsubscribeAll([…])).
// 35 tempat memakainya; unsubscribeAll kini cuma dipanggil dari dalam hook.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-rapihin-liveall');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const semua = ['app', 'components', 'hooks'].flatMap(function jelajah(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(d + '/' + e.name) : /\.tsx?$/.test(e.name) ? [d + '/' + e.name] : []);
});

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

// ============ Dijalankan sungguhan: hooks/useLiveAll dengan React tiruan ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'hooks/useLiveAll.ts'), '--ignoreConfig', '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler', '--jsx', 'react'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// React tiruan: useEffect dijalankan langsung kalau dependency-nya berubah,
// pembersihnya dipanggil saat berubah lagi.
let efek = [];
let idx = 0;
let userSekarang = { uid: 'u1' };
const React = {
  useEffect(fn, deps) {
    const i = idx++;
    const lama = efek[i];
    const berubah = !lama || deps.length !== lama.deps.length || deps.some((d, k) => d !== lama.deps[k]);
    if (berubah) {
      if (lama?.bersih) lama.bersih();
      efek[i] = { deps, bersih: fn() };
    }
  },
};
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'react') return React;
  if (req === '@/contexts/auth') return { useAuth: () => ({ user: userSekarang }) };
  if (req === '@/lib/messages') return { LOAD_ERROR: 'GALAT_MUAT' };
  if (req === '@/lib/liveDoc') return { unsubscribeAll: (list) => () => list.forEach((u) => u()) };
  return asli(req, parent, isMain);
};
const { useLiveAll } = require(path.join(OUT, 'useLiveAll.js'));
Module._load = asli;
const render = (fn) => { idx = 0; return fn(); };

console.log('\n=== useLiveAll: perilaku ===');
let pasang = [];
let lepas = [];
const sub = (nama) => (uid, fail) => { pasang.push(`${nama}:${uid}`); return () => lepas.push(nama); };
const galat = [];
const setError = (m) => galat.push(m);

render(() => useLiveAll((uid, fail) => [sub('a')(uid, fail), sub('b')(uid, fail)], { onError: setError }));
ok('dua langganan dipasang sekali dengan uid user', pasang.join(',') === 'a:u1,b:u1' && lepas.length === 0);
render(() => useLiveAll((uid, fail) => [sub('a')(uid, fail), sub('b')(uid, fail)], { onError: setError }));
ok('render ulang dengan panah BARU tidak memasang ulang (subscribe bukan dependency)', pasang.length === 2);
let failDiterima;
render(() => useLiveAll((uid, fail) => { failDiterima = fail; return []; }, { onError: setError, deps: ['x'] }));
ok('deps berubah → langganan lama dilepas (a, b), yang baru dipasang', lepas.join(',') === 'a,b');
failDiterima();
ok('fail → onError menerima LOAD_ERROR', galat.length === 1 && galat[0] === 'GALAT_MUAT');
efek = []; pasang = []; lepas = [];
render(() => useLiveAll((uid) => [sub('c')(uid)], { when: false }));
ok('when: false → tidak berlangganan', pasang.length === 0);
render(() => useLiveAll((uid) => [sub('c')(uid)], { when: true }));
ok('when jadi true → baru berlangganan', pasang.join(',') === 'c:u1');
userSekarang = null;
render(() => useLiveAll((uid) => [sub('c')(uid)], { when: true }));
ok('tanpa user → dilepas & tidak berlangganan', lepas.join(',') === 'c' && pasang.length === 1);
efek = []; pasang = []; userSekarang = { uid: 'u2' };
let failTanpaOnError;
render(() => useLiveAll((uid, fail) => { failTanpaOnError = fail; return [sub('d')(uid)]; }));
failTanpaOnError();
ok('tanpa onError → fail diam saja (tidak melempar); uid baru dipakai', pasang.join(',') === 'd:u2');

console.log('\n=== Tidak ada blok baku yang tersisa ===');
const langsung = semua.filter((f) => f !== 'hooks/useLiveAll.ts' && /unsubscribeAll\(/.test(baca(f)));
ok('unsubscribeAll hanya dipanggil dari hooks/useLiveAll.ts', langsung.length === 0, langsung.join(', '));
// (contoh di komentar dokumentasi hook-nya sendiri dikecualikan)
const failManual = semua.filter((f) => f !== 'hooks/useLiveAll.ts' && /const fail = \(\) => set\w*Error\(LOAD_ERROR\);/.test(baca(f)));
ok('tidak ada lagi `const fail = () => setError(LOAD_ERROR)` tulis tangan', failManual.length === 0, failManual.join(', '));
const pemakai = semua.filter((f) => /useLiveAll\(/.test(baca(f)) && f !== 'hooks/useLiveAll.ts');
ok('≥ 33 berkas memakai useLiveAll', pemakai.length >= 33, String(pemakai.length));
ok('yang memakainya tidak menyisakan impor useEffect / LOAD_ERROR / useAuth / unsubscribeAll yang nganggur',
  pemakai.every((f) => {
    const s = baca(f);
    const impor = s.split('\n').filter((l) => /^import/.test(l)).join('\n');
    const badan = s.replace(/^import[\s\S]*?from '[^']+';\n/gm, '');
    return (!/\buseEffect\b/.test(impor) || /useEffect\(/.test(badan)) &&
      (!/\bLOAD_ERROR\b/.test(impor) || /LOAD_ERROR/.test(badan)) &&
      (!/\buseAuth\b/.test(impor) || /useAuth\(\)/.test(badan)) &&
      !/unsubscribeAll/.test(impor);
  }));

console.log('\n=== Bentuk pemakaiannya ===');
ok('galat: `(uid, fail) => [ … ]` + `{ onError: setError }` (core-recap, friends, health, visitations, core-calendar)',
  ['app/core-recap.tsx', 'app/friends.tsx', 'app/health.tsx', 'app/visitations.tsx', 'app/core-calendar.tsx']
    .every((f) => /useLiveAll\(\s*\n\s*\(uid, fail\) => \[[\s\S]*?\],\s*\n\s*\{ onError: setError \},\s*\n\s*\);/.test(baca(f))));
ok('langganan berparameter hari/minggu → deps (fitness dayId, learning weekId, morning-prayer todayId, reflection-feed todayId)',
  /\{ onError: setError, deps: \[dayId\] \}/.test(baca('app/fitness.tsx')) &&
  /\{ deps: \[weekId\] \}/.test(baca('app/learning.tsx')) &&
  /\{ deps: \[todayId\] \}/.test(baca('app/morning-journey.tsx')) &&
  /\{ onError: setError, deps: \[todayId\] \}/.test(baca('app/reflection-feed.tsx')));
// 24 Sep 2026: opsinya bertambah `onError` — sampai tanggal itu layar Today
// memasang 37 langganan tanpa satu pun penangan galat, jadi kegagalan muat
// tidak meninggalkan jejak apa pun di layar. Cek-nya ikut diperketat, bukan
// dilonggarkan: deps-nya tetap dipatok persis, DAN sekarang wajib ada onError.
ok('Today (useTodayData): deps [todayId, weekId, mark] + onError (baris menunggu semua sumber lewat mark)',
  /\{ deps: \[todayId, weekId, mark\], onError: setLoadError \}/.test(baca('hooks/useTodayData.ts')) &&
  /mark\('leaders', setLeaders\), fail\)/.test(baca('hooks/useTodayData.ts')));
ok('Dashboard: dua konstanta kuartal dihitung di dalam panah berbadan blok',
  /useLiveAll\(\s*\n\s*\(uid\) => \{\s*\n\s*const nowQ = quarterOf\(new Date\(\)\);\s*\n\s*const wheelQid = quarterDocId\(nowQ\.year, nowQ\.q\);\s*\n\s*return \[/.test(baca('app/reminders.tsx')) &&
  /\{ deps: \[todayId, weekId\] \}/.test(baca('app/reminders.tsx')));
ok('langganan yang menunggu syarat → when (bill !!id, LinkedNotesButton/ConnectCoreButton open, ShareToLeaderSheet pernahDibuka)',
  /\{ onError: setError, deps: \[id\], when: !!id \}/.test(baca('app/bill/[id].tsx')) &&
  /\{ when: open \}/.test(baca('components/core/LinkedNotesButton.tsx')) &&
  /\{ when: open \}/.test(baca('components/spiritual/ConnectCoreButton.tsx')) &&
  /\{ onError: setError, when: pernahDibuka \}/.test(baca('components/core/ShareToLeaderSheet.tsx')));
ok('callback yang membersihkan galat saat data datang tetap ada (core, car, donor, ex-leaders)',
  ['app/(tabs)/core.tsx', 'app/car.tsx', 'app/donor.tsx', 'app/ex-leaders.tsx']
    .every((f) => /\(next\) => \{\s*\n\s*set\w+\(next\);\s*\n\s*setError\(null\);|\(l\) => \{\s*\n\s*setLeaders\(l\);\s*\n\s*setError\(null\);/.test(baca(f))));
ok('revive: galatnya ke setFormError (pesan form), bukan setError',
  /\{ onError: setFormError \}/.test(baca('app/revive.tsx')));
ok('useRewardStats (hook) ikut memakainya', /useLiveAll\(/.test(baca('hooks/useRewardStats.ts')));
ok('hook-nya: eslint-disable exhaustive-deps DIBERI alasan, deps = [user, when, onError, ...deps]',
  /\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\s*\n\s*\}, \[user, when, onError, \.\.\.deps\]\);/.test(baca('hooks/useLiveAll.ts')) &&
  /`subscribe` sengaja bukan dependency/.test(baca('hooks/useLiveAll.ts')));
// 22 Sep 2026: keduanya ikut pindah — useLiveAll menerima parameter (deps) dan
// tidak memegang state (nilai awal undefined MorningJourneyGate tetap).
ok('daily-priority: langganan berparameter hari → deps [todayId]; MorningJourneyGate: state undefined-nya tetap',
  /useLiveAll\(\(uid, fail\) => \[subscribePriorityDay\(uid, todayId, setDay, fail\)\], \{\s*\n\s*onError: setError,\s*\n\s*deps: \[todayId\],\s*\n\s*\}\);/.test(baca('app/daily-priority.tsx')) &&
  /useLiveAll\(\(uid\) => \[subscribeLoginStreak\(uid, setLogin\)\]\);/.test(baca('components/spiritual/MorningJourneyGate.tsx')) &&
  /useState<LoginStreak \| null \| undefined>\(undefined\)/.test(baca('components/spiritual/MorningJourneyGate.tsx')));
ok('sisa efek langganan tulis tangan CUMA version.tsx (efek campuran: langganan + fetch + reset bulanan)',
  (() => {
    const sisa = [];
    // Implementasi hook-nya sendiri dikecualikan (contoh di komentarnya
    // memuat blok lama sebagai ilustrasi).
    for (const f of semua.filter((x) => x !== 'hooks/useLive.ts' && x !== 'hooks/useLiveAll.ts')) {
      const s = baca(f);
      const re = /useEffect\(\(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/g;
      let m;
      while ((m = re.exec(s))) if (/(^|[^\w])(subscribe[A-Z]\w*|liveDoc|liveList)\(/.test(m[0])) sisa.push(f);
    }
    return sisa.join(',') === 'app/system.tsx';
  })());

console.log(gagal === 0 ? '\n✅ LULUS — useLiveAll menggantikan blok unsubscribeAll.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
