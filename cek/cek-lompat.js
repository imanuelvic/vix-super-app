// Bukti: MEMBUKA sub-tab berbadge melompat ke baris merah pertama — apa pun
// urutan kejadian layout-nya.
//
// Syarat "tekanan kedua" (`repress`) sudah dibuang: yang tahu bahwa menekan
// sekali lagi akan melompat cuma yang menulis kodenya, dan bagi semua orang
// lain tekanan pertama sekadar terasa tidak melakukan apa-apa.
//
// hooks/useDueJump.ts dijalankan BENERAN di atas React tiruan kecil (useRef +
// useCallback), lalu kejadian layout-nya diperankan dua urutan:
//   A. baris terukur dulu, isi ScrollView menyusul
//   B. isi ScrollView terukur dulu, baris menyusul   ← ini yang dulu gagal
//
// Versi LAMA hook-nya ikut dijalankan untuk memastikan tes ini benar-benar
// menangkap bug-nya (kalau dua-duanya lulus, tesnya tidak membuktikan apa-apa).

const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(os.tmpdir(), 'cek-lompat-out');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

// ---------- React tiruan: cukup useRef & useCallback ----------
let slot = [];
let i = 0;
const React = {
  useRef(awal) {
    if (slot[i] === undefined) slot[i] = { current: awal };
    return slot[i++];
  },
  useCallback(fn) {
    i++;
    return fn;
  },
};

const aslinya = Module._load;
Module._load = function (permintaan, induk, isMain) {
  if (permintaan === 'react') return React;
  if (/^react-native/.test(permintaan)) return {};
  return aslinya(permintaan, induk, isMain);
};

try {
  execFileSync(
    'npx',
    [
      'tsc',
      path.join(ROOT, 'hooks/useDueJump.ts'),
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
  // tsc mengeluh soal tipe react-native — .js-nya tetap ditulis.
}
const { useDueJump } = require(path.join(OUT, 'useDueJump.js'));
Module._load = aslinya;

// ---------- Versi LAMA (sebelum diperbaiki), ditulis ulang apa adanya ----------
function useDueJumpLama(dueKey, enabled) {
  const ref = React.useRef(null);
  const rowY = React.useRef({});
  const jumped = React.useRef(false);
  const setRowY = React.useCallback((key, y) => {
    rowY.current[key] = y;
  });
  const onContentSizeChange = React.useCallback(() => {
    if (!enabled || jumped.current || !dueKey) return;
    const y = rowY.current[dueKey];
    if (y === undefined) return;
    jumped.current = true;
    ref.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  });
  return { ref, setRowY, onContentSizeChange };
}

// ---------- Panggung: satu daftar Maintenance seperti di layar ----------
// Kartu ringkasan + 4 baris; yang MERAH ada di baris ke-4 (di luar layar).
const BARIS = [
  { key: 'sisir', y: 120, merah: false },
  { key: 'handuk', y: 300, merah: false },
  { key: 'kamar-mandi', y: 480, merah: false },
  { key: 'sprei', y: 660, merah: true },
  { key: 'kulkas', y: 840, merah: true },
];
const MERAH_PERTAMA = BARIS.find((b) => b.merah).key;

/**
 * Jalankan satu kali "mount" lalu perankan kejadian layout-nya.
 * urutan 'baris-dulu' | 'isi-dulu'
 */
function jalankan(hook, { dueKey = MERAH_PERTAMA, enabled, urutan }) {
  slot = [];
  i = 0;
  // `enabled` hanya dioper ke versi LAMA — versi sekarang tidak punya
  // parameter itu lagi.
  const h = enabled === undefined ? hook(dueKey) : hook(dueKey, enabled);
  const dipanggil = [];
  h.ref.current = {
    scrollTo: (arg) => dipanggil.push(arg),
  };
  const ukurBaris = () => BARIS.forEach((b) => h.setRowY(b.key, b.y));
  if (urutan === 'baris-dulu') {
    ukurBaris();
    h.onContentSizeChange();
  } else {
    h.onContentSizeChange();
    ukurBaris();
  }
  return { h, dipanggil };
}

// ================= 1. Versi lama memang bocor di satu urutan =================
{
  const a = jalankan(useDueJumpLama, { urutan: 'baris-dulu', enabled: true });
  ok('versi LAMA: baris dulu → melompat', a.dipanggil.length === 1);

  const b = jalankan(useDueJumpLama, { urutan: 'isi-dulu', enabled: true });
  ok(
    'versi LAMA: isi dulu → TIDAK melompat (inilah bug-nya)',
    b.dipanggil.length === 0,
    `malah dipanggil ${b.dipanggil.length}×`,
  );
}

// ================= 2. Versi baru: kedua urutan sama-sama melompat ===========
for (const urutan of ['baris-dulu', 'isi-dulu']) {
  const { dipanggil } = jalankan(useDueJump, { urutan });
  ok(`urutan "${urutan}" → melompat tepat 1×`, dipanggil.length === 1);
  ok(
    `urutan "${urutan}" → ke baris merah pertama (660 − 8)`,
    dipanggil[0]?.y === 652,
    JSON.stringify(dipanggil[0]),
  );
  ok(`urutan "${urutan}" → beranimasi`, dipanggil[0]?.animated === true);
}

// ================= 3. Yang TIDAK boleh berubah =================
{
  // Sekarang justru sebaliknya: SEKALI dibuka sudah melompat. Tidak ada lagi
  // syarat tekanan kedua yang harus ditebak sendiri.
  const { dipanggil } = jalankan(useDueJump, { urutan: 'baris-dulu' });
  ok('sekali dibuka sudah melompat (tanpa syarat tekanan kedua)',
    dipanggil.length === 1);
}
{
  // ScrollView yang sudah punya ref sendiri (useScrollTop di Reminder
  // Prioritas & Fitness) mengoper ref itu ke sini — satu ScrollView tidak
  // boleh dipasangi dua ref.
  slot = [];
  i = 0;
  const luar = { current: null };
  const h = useDueJump(MERAH_PERTAMA, luar);
  const dipanggil = [];
  luar.current = { scrollTo: (arg) => dipanggil.push(arg) };
  ok('ref dari luar dipakai apa adanya', h.ref === luar);
  h.setRowY(MERAH_PERTAMA, 660);
  h.onContentSizeChange();
  ok('…dan lompatannya lewat ref itu', dipanggil.length === 1);
}
{
  // Badge kosong: tidak ada yang jatuh tempo → tetap di paling atas.
  const { dipanggil } = jalankan(useDueJump, {
    dueKey: null,
    urutan: 'isi-dulu',
  });
  ok('tidak ada baris merah → tidak melompat', dipanggil.length === 0);
}
{
  // Isi ScrollView terukur ulang berkali-kali (teks membungkus, dsb).
  const { h, dipanggil } = jalankan(useDueJump, { urutan: 'isi-dulu' });
  h.onContentSizeChange();
  h.onContentSizeChange();
  h.setRowY(MERAH_PERTAMA, 999);
  ok(
    'sekali saja per mount — layar tidak "kabur sendiri"',
    dipanggil.length === 1,
    `dipanggil ${dipanggil.length}×`,
  );
}
{
  // Baris paling atas: y kecil, hasilnya tidak boleh negatif.
  slot = [];
  i = 0;
  const h = useDueJump('atas');
  const dipanggil = [];
  h.ref.current = { scrollTo: (arg) => dipanggil.push(arg) };
  h.onContentSizeChange();
  h.setRowY('atas', 3);
  ok('y tidak pernah negatif', dipanggil[0]?.y === 0, JSON.stringify(dipanggil[0]));
}
{
  // Baris LAIN yang terukur tidak boleh memicu lompatan sebelum barisnya sendiri.
  slot = [];
  i = 0;
  const h = useDueJump(MERAH_PERTAMA);
  const dipanggil = [];
  h.ref.current = { scrollTo: (arg) => dipanggil.push(arg) };
  h.onContentSizeChange();
  h.setRowY('sisir', 120);
  h.setRowY('handuk', 300);
  ok('baris lain tidak memicu lompatan', dipanggil.length === 0);
  h.setRowY(MERAH_PERTAMA, 660);
  ok('baru melompat saat baris tujuannya terukur', dipanggil.length === 1);
}
{
  // Daftar belum sempat terukur sama sekali → diam, bukan melompat ke 0.
  slot = [];
  i = 0;
  const h = useDueJump(MERAH_PERTAMA);
  const dipanggil = [];
  h.ref.current = { scrollTo: (arg) => dipanggil.push(arg) };
  h.onContentSizeChange();
  ok('isi terukur tapi baris belum → tidak melompat ke atas', dipanggil.length === 0);
}

// ================= 4. Pemasangannya di layar =================
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const kodeSaja = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const upkeep = kodeSaja(baca('components/common/UpkeepList.tsx'));
ok(
  'UpkeepList memasang KEDUA isyaratnya (onLayout tiap baris + onContentSizeChange)',
  /onContentSizeChange=\{onContentSizeChange\}/.test(upkeep) &&
    /onLayout=\{\(e\) => setRowY\(row\.key, e\.nativeEvent\.layout\.y\)\}/.test(
      upkeep,
    ),
);
ok(
  'tujuannya = baris jatuh tempo PERTAMA menurut urutan tampil',
  /groups\.flatMap\(\(g\) => g\.rows\)\.find\(\(r\) => deadlineDue\(r\.tone\)\)/.test(
    upkeep,
  ),
);

const debts = kodeSaja(baca('app/debts.tsx'));
ok(
  'Pinjaman ikut memasang kedua isyaratnya',
  /onContentSizeChange=\{onContentSizeChange\}/.test(debts) &&
    /setRowY\(/.test(debts),
);

// Residence → Maintenance & Car → Parts tidak perlu meneruskan apa pun lagi:
// lompatannya milik UpkeepList sendiri, dan pemicunya mount.
const res = kodeSaja(baca('app/residence.tsx'));
const car = kodeSaja(baca('app/car.tsx'));
ok(
  'Residence → Maintenance tanpa isyarat tambahan',
  /<ChoreTab status=\{chores\} \/>/.test(res),
);
ok('Car → Parts tanpa isyarat tambahan', /<PartsTab status=\{parts\} \/>/.test(car));
ok(
  'repress benar-benar dibuang dari useTabScroll',
  !/repress/.test(kodeSaja(baca('components/common/useTabScroll.ts'))),
);

// Sembilan sub-tab berbadge lain ikut melompat ke tanda merahnya.
for (const f of [
  'components/device/PlanTab.tsx',
  'components/friends/SplitBillTab.tsx',
  'components/tasks/PriorityTab.tsx',
  'components/career/FulltimeTab.tsx',
  'components/career/FreelanceTab.tsx',
  'components/core/FollowupTab.tsx',
  'components/fitness/ExerciseTab.tsx',
  'components/learning/WeekTab.tsx',
]) {
  const src = kodeSaja(baca(f));
  ok(
    f + ' melompat ke tanda merahnya',
    /useDueJump\(/.test(src) &&
      /onContentSizeChange=\{onContentSizeChange\}/.test(src) &&
      /setRowY\(/.test(src),
  );
}

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
