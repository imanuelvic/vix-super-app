// Batch /rapihin: buka sub-tab lewat ?tab=… pindah ke useTabScroll.
//
// Enam layar (Profile, Career, CORE, Learning, News, Spiritual) dulu menyalin
// blok yang sama: baca param → fungsi penjaga → nilai awal → efek penyelaras.
// Sekarang cukup mengoper TABS-nya.
//
// Hook-nya DIJALANKAN di atas tiruan kecil React (useState/useEffect/
// useCallback) supaya yang diuji perilakunya, bukan tulisannya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-tab');
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
      R + 'components/common/useTabScroll.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const MODUL = fs.existsSync(path.join(OUT, 'components', 'common', 'useTabScroll.js'))
  ? path.join(OUT, 'components', 'common', 'useTabScroll.js')
  : path.join(OUT, 'useTabScroll.js');
if (!fs.existsSync(MODUL)) {
  console.log('  ✗ gagal mengompilasi useTabScroll.ts');
  process.exit(1);
}

// ---------- Tiruan React ----------
// Satu komponen. `render()` memutar ulang badannya dari awal (persis seperti
// React memanggil ulang fungsi komponen), lalu menjalankan efek yang
// dependency-nya berubah — itulah yang membuat "datang lagi dengan param
// berbeda" bisa diuji sungguhan.
const slots = [];
const effects = [];
let cursor = 0;
let effectCursor = 0;

function useState(init) {
  const i = cursor++;
  if (!(i in slots)) slots[i] = typeof init === 'function' ? init() : init;
  return [slots[i], (v) => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }];
}
function useCallback(fn) { return fn; }
function useEffect(fn, deps) {
  const i = effectCursor++;
  const prev = effects[i];
  const berubah =
    !prev || !deps || deps.length !== prev.deps.length ||
    deps.some((d, k) => !Object.is(d, prev.deps[k]));
  effects[i] = { deps, fn, jalankan: berubah };
}

// ---------- Tiruan expo-router ----------
let params = {};
const setParamsCalls = [];
Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'react') return { useState, useEffect, useCallback };
  if (req === 'expo-router') {
    return {
      useRouter: () => routerPalsu,
      useLocalSearchParams: () => params,
    };
  }
  return asli.call(this, req, parent, isMain);
})(Module._load);

const routerPalsu = {
  setParams: (p) => {
    setParamsCalls.push(p);
    params = { ...params, ...p };
  },
};

const { useTabScroll } = require(MODUL);

/** Pasang komponen; `render()` = satu putaran render + efeknya. */
function pasang(komponen) {
  slots.length = 0;
  effects.length = 0;
  return {
    render() {
      cursor = 0;
      effectCursor = 0;
      const hasil = komponen();
      for (const e of effects) if (e && e.jalankan) { e.jalankan = false; e.fn(); }
      return hasil;
    },
  };
}

const TABS = [{ key: 'news' }, { key: 'population' }];

// =====================================================================
console.log('=== 1. Tanpa `tabs`: paramnya diabaikan (11 layar lama) ===');
// =====================================================================
{
  params = { tab: 'population' }; // ada param, TAPI hook tak diberi daftarnya
  setParamsCalls.length = 0;
  const { render } = pasang(() => useTabScroll('news'));
  let api = render();
  c('param tidak dipedulikan → tetap tab bawaannya', api.tab === 'news', api.tab);
  c('router.setParams tidak pernah dipanggil', setParamsCalls.length === 0);

  api.onTabPress('population');
  api = render();
  c('menekan tab tetap berpindah', api.tab === 'population');
  c('scrollKey naik tiap ditekan', api.scrollKey === 1, String(api.scrollKey));

  api.onTabPress('population');
  api = render();
  // `repress` sudah dibuang: lompatan ke baris bertanda sekarang terjadi tiap
  // sub-tab DIBUKA, jadi tidak ada lagi yang perlu membedakan tekanan kedua.
  c('menekan tab yang SAMA tetap menaikkan scrollKey (konten re-mount ke atas)',
    api.scrollKey === 2);
  c('repress benar-benar tidak dilaporkan lagi', api.repress === undefined);
}

// =====================================================================
console.log('\n=== 2. Dengan `tabs`: ?tab=… membuka sub-tabnya ===');
// =====================================================================
{
  params = { tab: 'population' };
  setParamsCalls.length = 0;
  const { render } = pasang(() => useTabScroll('news', { tabs: TABS }));
  const api = render();
  c('param yang sah dipakai sejak render PERTAMA (tanpa kedip)',
    api.tab === 'population', api.tab);
  c('paramnya TIDAK dibersihkan (layar biasa)', setParamsCalls.length === 0);
}
{
  for (const nilai of ['tidak-ada', '', undefined, 'NEWS']) {
    params = { tab: nilai };
    const { render } = pasang(() => useTabScroll('news', { tabs: TABS }));
    c(`param "${nilai}" tidak dikenal → jatuh ke bawaannya`,
      render().tab === 'news');
  }
}

// =====================================================================
console.log('\n=== 3. Datang LAGI ke layar yang masih hidup ===');
// =====================================================================
{
  params = {};
  const { render } = pasang(() => useTabScroll('news', { tabs: TABS }));
  let api = render();
  c('tanpa param → tab bawaannya', api.tab === 'news');

  // Reminder Dashboard membuka layar yang SUDAH hidup dengan param baru.
  params = { tab: 'population' };
  api = render();          // render dengan param baru → efeknya jalan
  api = render();          // render sesudah setTab
  c('param baru masuk → ikut pindah walau layarnya tidak di-mount ulang',
    api.tab === 'population', api.tab);

  // Sesudah itu menekan tab sendiri tetap menang.
  api.onTabPress('news');
  api = render();
  c('pilihan sendiri sesudahnya tetap dituruti', api.tab === 'news', api.tab);
}

// =====================================================================
console.log('\n=== 4. clearParam: khusus layar tab yang tak pernah mati ===');
// =====================================================================
{
  // Profile itu TAB — layarnya tetap hidup. Kalau paramnya dibiarkan
  // menempel, kunjungan berikutnya lewat tombol tab bawah akan terus dipaksa
  // balik ke sub-tab yang sama.
  params = { tab: 'population' };
  setParamsCalls.length = 0;
  const { render } = pasang(() =>
    useTabScroll('news', { tabs: TABS, clearParam: true }),
  );
  let api = render();
  c('tetap membuka sub-tab yang diminta', api.tab === 'population', api.tab);
  c('paramnya langsung dibersihkan', setParamsCalls.length === 1 &&
    setParamsCalls[0].tab === '', JSON.stringify(setParamsCalls[0]));

  api = render();
  c('sesudah dibersihkan, tabnya TIDAK melompat balik ke bawaannya',
    api.tab === 'population', api.tab);

  api.onTabPress('news');
  api = render();
  c('lalu pindah tab sendiri → tidak ditarik balik oleh param lama',
    api.tab === 'news', api.tab);
}

// =====================================================================
console.log('\n=== 5. Keenam layar memakainya, penjaganya hilang ===');
// =====================================================================
const PAKAI = [
  ['app/profile.tsx', 'profile', true],
  ['app/(tabs)/work.tsx', 'focus', false], // 22 Sep 2026: tab Work membuka Focus dulu
  ['app/(tabs)/core.tsx', 'followup', false],
  ['app/learning.tsx', 'week', false],
  ['app/news.tsx', 'news', false],
  ['app/(tabs)/walk.tsx', 'revive', false],
];
for (const [f, bawaan, bersih] of PAKAI) {
  const src = baca(f);
  const nama = f.replace('app/', '').replace('(tabs)/', '').padEnd(16);
  c(`${nama} mengoper TABS ke useTabScroll`,
    new RegExp(`useTabScroll<[^>]+>\\('${bawaan}', \\{\\s*tabs: TABS,`).test(src));
  c(`${nama} penjaga & efek penyelarasnya sudah dibuang`,
    !/function isTab|function asCoreTab|isProfileTab|isCareerTab/.test(src) &&
      !/if \(isTab\(tabParam\)\) setTab/.test(src) &&
      !/tab: tabParam/.test(src));
  c(`${nama} clearParam ${bersih ? 'menyala' : 'mati'}`,
    /clearParam: true/.test(src) === bersih);
}

// Layar yang TIDAK memakai param sama sekali tidak boleh ikut berubah.
// Car, Fitness, Residence & Debts PINDAH ke daftar yang menerima ?tab=
// (4 Sep 2026): reminder Dashboard harus mendarat di sub-tab yang memang
// jadi sumber barisnya, bukan di tab bawaan layarnya.
const TANPA = ['app/finance.tsx', 'app/games.tsx', 'app/friends.tsx',
  'components/common/UpkeepList.tsx'];
const TAMBAHAN = [
  ['app/car.tsx', 'parts'],
  ['app/debts.tsx', 'theirs'],
  ['app/fitness.tsx', 'exercise'],
  ['app/residence.tsx', 'token'],
];
for (const [f, bawaan] of TAMBAHAN) {
  const src = baca(f);
  c(`${f.replace('app/', '').padEnd(16)} menerima ?tab= (tujuan reminder Dashboard)`,
    src.includes(`useTabScroll<`) &&
    src.includes(`>('${bawaan}', {`) &&
    src.includes('tabs: TABS,'));
}
c('layar tanpa ?tab= dipanggil persis seperti dulu (satu argumen)',
  TANPA.every((f) => !/useTabScroll<[^>]*>\([^)]*\{/.test(baca(f))),
  TANPA.length + ' berkas');

// Health & Tasks membaca paramnya sendiri untuk NILAI AWAL saja (tanpa efek
// penyelaras). Sengaja TIDAK ikut dipindah: memberi mereka `tabs` berarti
// menambahkan penyelaras yang belum pernah ada = perubahan perilaku.
c('Health & Tasks sengaja dibiarkan apa adanya',
  // `diet` sengaja TIDAK dikenali lagi — sub-tabnya sudah dihapus (2 Sep
  // 2026), dan pintasan lama yang mengarah ke sana mendarat di Steps.
  /tabParam === 'checkup' \|\| tabParam === 'race'/.test(baca('app/health.tsx')) &&
    !/'diet'/.test(baca('app/health.tsx')) &&
    /tabParam === 'priority' \? 'priority' : 'daily'/.test(baca('app/tasks.tsx')));

// =====================================================================
console.log('\n=== 6. Daftar tab yang sah = daftar tab yang TAMPIL ===');
// =====================================================================
// Career, Learning & News dulu menyalin kunci tabnya dengan tangan. Kalau
// salinannya pernah beda dari TABS, perpindahan ini akan mengubah perilaku —
// jadi dibuktikan dulu keduanya memang sama.
const LAMA = {
  // 'insurance' dulu ada di antara affiliate & business — dihapus permanen.
  // 22 Sep 2026: 'focus' (Work Today) ditambahkan di depan.
  'app/(tabs)/work.tsx': ['focus', 'fulltime', 'freelance', 'affiliate', 'business'],
  'app/learning.tsx': ['week', 'skills', 'topics'],
  'app/news.tsx': ['news', 'population'],
};
for (const [f, tangan] of Object.entries(LAMA)) {
  const blok = /const TABS[^=]*= \[([\s\S]*?)\n\];/.exec(baca(f));
  const dariTabs = [...blok[1].matchAll(/key: '([^']+)'/g)].map((m) => m[1]);
  c(`${f.replace('app/', '').padEnd(14)} daftar tangan == TABS`,
    JSON.stringify(dariTabs) === JSON.stringify(tangan),
    dariTabs.join(' · '));
}

// =====================================================================
console.log('\n=== 7. Pengecualian lint-nya jujur & cuma satu ===');
// =====================================================================
{
  const hook = baca('components/common/useTabScroll.ts');
  c('cuma SATU eslint-disable, dan alasannya ditulis',
    (hook.match(/eslint-disable/g) ?? []).length === 1 &&
      /paramnya harus disalin ke state/.test(hook));
  const semua = ['app/profile.tsx', 'app/(tabs)/work.tsx', 'app/(tabs)/core.tsx',
    'app/learning.tsx', 'app/news.tsx', 'app/(tabs)/walk.tsx'];
  c('tak ada eslint-disable yang ikut tersebar ke layarnya',
    semua.every((f) => !/set-state-in-effect/.test(baca(f))));
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
