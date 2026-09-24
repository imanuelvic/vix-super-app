// /rapihin 16 Sep 2026: hooks/useLive.ts — satu hook untuk blok langganan
// Firestore baku (useState null + useEffect if(!user) return subscribeX(...)).
// 21 tempat memakainya; yang sengaja TIDAK diubah: MorningJourneyGate
// (undefined = belum termuat, beda dari null), daily-priority (ada parameter
// tanggal), tasks (pesan galat khusus loadErrorOf).
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-rapihin-live');
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

// ============ Dijalankan sungguhan: hooks/useLive dengan React tiruan ============
try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'hooks/useLive.ts'), '--ignoreConfig', '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck', '--esModuleInterop',
      '--moduleResolution', 'bundler', '--jsx', 'react'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

// React tiruan: useState menyimpan di sel, useEffect dijalankan langsung kalau
// dependency-nya berubah, dan pembersihnya dipanggil saat berubah lagi.
let sel = [];
let efek = [];
let idx = 0;
let userSekarang = { uid: 'u1' };
const React = {
  useState(awal) {
    const i = idx++;
    if (!(i in sel)) sel[i] = typeof awal === 'function' ? awal() : awal;
    return [sel[i], (v) => { sel[i] = typeof v === 'function' ? v(sel[i]) : v; }];
  },
  useEffect(fn, deps) {
    const i = idx++;
    const lama = efek[i];
    const berubah = !lama || deps.some((d, k) => d !== lama.deps[k]);
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
  return asli(req, parent, isMain);
};
const { useLive } = require(path.join(OUT, 'useLive.js'));
Module._load = asli;

const render = (fn) => { idx = 0; return fn(); };

console.log('\n=== useLive: perilaku ===');
let langganan = [];
let dilepas = 0;
const subscribe = (uid, onChange, onError) => {
  langganan.push({ uid, onChange, onError });
  return () => { dilepas++; };
};
const galat = [];
const setError = (m) => galat.push(m);

let hasil = render(() => useLive(subscribe, { onError: setError }));
ok('mulai null (= memuat), langganan dibuat sekali dengan uid user', hasil[0] === null && langganan.length === 1 && langganan[0].uid === 'u1');
langganan[0].onChange([1, 2]);
hasil = render(() => useLive(subscribe, { onError: setError }));
ok('data dari Firestore masuk; render ulang TIDAK berlangganan lagi (subscribe & setError stabil)',
  JSON.stringify(hasil[0]) === '[1,2]' && langganan.length === 1 && dilepas === 0);
langganan[0].onError();
ok('gagal → onError menerima LOAD_ERROR', galat.length === 1 && galat[0] === 'GALAT_MUAT');
hasil[1]([9]);
hasil = render(() => useLive(subscribe, { onError: setError }));
ok('setter dikembalikan untuk pembaruan optimis', JSON.stringify(hasil[0]) === '[9]');
userSekarang = { uid: 'u2' };
render(() => useLive(subscribe, { onError: setError }));
ok('ganti user → langganan lama dilepas, yang baru pakai uid baru', dilepas === 1 && langganan.length === 2 && langganan[1].uid === 'u2');
userSekarang = null;
render(() => useLive(subscribe, { onError: setError }));
ok('tanpa user → dilepas & tidak berlangganan', dilepas === 2 && langganan.length === 2);

sel = []; efek = []; userSekarang = { uid: 'u1' }; langganan = [];
hasil = render(() => useLive(subscribe, { initial: {} }));
ok('initial {} → mulai {} (bukan null), tanpa onError tak apa-apa', JSON.stringify(hasil[0]) === '{}' && langganan.length === 1);
langganan[0].onError();
ok('gagal tanpa onError → diam saja (tidak melempar)', true);

console.log('\n=== Tidak ada blok baku yang tersisa ===');
const BAKU = /useEffect\(\(\) => \{\s*\n\s*if \(!user\) return;\s*\n\s*return (subscribe\w+)\(\s*user\.uid,\s*(set\w+),?\s*(\(\) =>\s*setError\(LOAD_ERROR\)|\(\) => undefined)?,?\s*\);\s*\n\s*\}, \[user\]\);/g;
const sisa = [];
for (const f of semua) {
  const s = baca(f);
  let m;
  while ((m = BAKU.exec(s))) sisa.push(`${f}:${m[1]}`);
}
// 22 Sep 2026: MorningJourneyGate pun ikut useLiveAll (hook itu tak memegang
// state, jadi nilai awal undefined-nya tetap) — tidak ada sisa sama sekali.
ok('tidak ada blok baku yang tersisa', sisa.length === 0, sisa.join(', '));
const pemakai = semua.filter((f) => /useLive</.test(baca(f)));
ok('≥ 20 berkas memakai useLive', pemakai.length >= 20, String(pemakai.length));
ok('yang memakai useLive tidak lagi mengimpor useEffect tanpa dipakai / LOAD_ERROR tanpa dipakai',
  pemakai.every((f) => {
    const s = baca(f);
    const badan = s.replace(/^import[\s\S]*?from '[^']+';\n/gm, '');
    return (!/\buseEffect\b/.test(s.split('\n').filter((l) => /^import/.test(l)).join('\n')) || /useEffect\(/.test(badan)) &&
      (!/LOAD_ERROR/.test(s.split('\n').slice(0, 60).join('\n')) || /LOAD_ERROR/.test(badan));
  }));

console.log('\n=== Bentuk pemakaiannya ===');
ok('null-awal + galat: promise, project, project/edit, multiplication, monthly, checkup, mountains, FunEntryScreen',
  ['app/promise.tsx', 'app/project/[id].tsx', 'app/project/edit/[id].tsx', 'app/multiplication/[id].tsx',
    'app/core/monthly/[id].tsx', 'app/checkup-status.tsx', 'app/mountains.tsx', 'components/fun/FunEntryScreen.tsx']
    .every((f) => /useLive<[^>]+>\(\w+, \{\s*onError: setError,?\s*\}\)/.test(baca(f))));
ok('setError dideklarasikan SEBELUM useLive yang memakainya',
  ['app/promise.tsx', 'app/mountains.tsx', 'components/fun/FunEntryScreen.tsx', 'app/core/monthly/[id].tsx']
    .every((f) => baca(f).indexOf('const [error, setError]') < baca(f).indexOf('useLive<')));
ok('nilai awal bukan null dipertahankan: {} (book, steps, greets, manual), [] (leaders, rules, tasks), EMPTY_CORE_NOTE_LINKS',
  /useLive<ChaptersReadMap>\([\s\S]{0,60}initial: \{\}/.test(baca('app/book.tsx')) &&
  /useLive<StepDaysMap>\(subscribeStepDays, \{ initial: \{\} \}\)/.test(baca('app/steps.tsx')) &&
  /useLive<CoreLeader\[\]>\(subscribeCoreLeaders, \{ initial: \[\] \}\)/.test(baca('app/chat-templates.tsx')) &&
  /useLive<CoreNoteLinks>\(subscribeCoreNoteLinks, \{\s*\n\s*initial: EMPTY_CORE_NOTE_LINKS,/.test(baca('components/core/MonthlyTab.tsx')) &&
  /useLive<CoreNoteLinks>\(subscribeCoreNoteLinks, \{\s*\n\s*initial: EMPTY_CORE_NOTE_LINKS,/.test(baca('components/core/VisitationTab.tsx')));
ok('setter tetap dipertahankan di halaman bab buku (pembaruan optimis centang)',
  /const \[chapters, setChapters\] = useLive<ChaptersReadMap>/.test(baca('app/book/[key].tsx')));
ok('WeekTargetCard: tipe null-nya milik dokumennya (target boleh null)',
  /useLive<WeekDistanceTarget \| null>\(subscribeWeekTarget\)/.test(baca('components/health/WeekTargetCard.tsx')));
ok('MonthlyTab & project/[id] tidak lagi memakai useAuth (user tak dibutuhkan)',
  !/useAuth/.test(baca('components/core/MonthlyTab.tsx')) && !/useAuth/.test(baca('app/project/[id].tsx')));
ok('MorningJourneyGate tetap seperti semula (undefined = belum termuat)',
  /useState<LoginStreak \| null \| undefined>\(undefined\)/.test(baca('components/spiritual/MorningJourneyGate.tsx')));

console.log(gagal === 0 ? '\n✅ LULUS — useLive menggantikan 21 blok langganan.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
