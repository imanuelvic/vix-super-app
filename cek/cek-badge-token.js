// 11 Sep 2026 — "di sub-tab Token ada badge 1, tidak tahu itu badge untuk apa
// munculnya; gimana biar hilang atau saya tahu itu badge yang mana."
//
// Badge-nya sendiri BENAR: meteran hari ini baru tercatat sekali, dan memang
// butuh dua titik ukur untuk bisa menghitung pemakaian. Yang salah: di dalam
// sub-tabnya tidak ada satu pun tanda yang menunjuk penyebabnya, jadi
// satu-satunya cara tahu adalah membaca kodenya.
//
// Aturannya TIDAK diubah. Yang ditambah jawabannya — dan yang dijaga suite ini
// justru sambungannya: KARTU PENJELAS MUNCUL PERSIS SAAT BADGE MENYALA. Kalau
// keduanya bisa berbeda pendapat, jawabannya malah jadi kebohongan baru.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-badge-token');
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
      R + 'lib/token.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
if (!fs.existsSync(path.join(DIR, 'token.js'))) {
  console.log('  ✗ gagal mengompilasi token.ts');
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

const T = require(path.join(DIR, 'token.js'));

const tab = baca('components/residence/TokenTab.tsx');
const layar = baca('app/residence.tsx');

// Jumat 11 Sep 2026, jam 07.55 — persis keadaan saat keluhannya dilaporkan.
const KINI = new Date(2026, 8, 11, 7, 55);
const kemarin = new Date(2026, 8, 10, 19, 0);
const cat = (jam, kind) => ({
  id: String(Math.random()),
  at: { toDate: () => (jam instanceof Date ? jam : new Date(2026, 8, 11, jam)) },
  kwh: 10,
  kind,
  note: '',
});

// =====================================================================
console.log('=== 1. Badge & jawabannya lahir dari SATU perhitungan ===');
// =====================================================================
{
  // Kalau readingDue tidak lagi memanggil readingTodo, badge dan kartu
  // penjelasnya bisa berbeda pendapat — dan itu lebih buruk daripada tidak
  // ada penjelasan sama sekali.
  c('readingDue berangkat dari readingTodo',
    /return readingTodo\(readings, now\)\.due;/.test(baca('lib/token.ts')));

  // Dibuktikan juga dengan menjalankannya: 4 keadaan, dua-duanya harus sepakat.
  const keadaan = [
    ['belum dicatat', []],
    ['baru 1× (berangkat)', [cat(7, 'out')]],
    ['sudah 2× (berangkat + pulang)', [cat(7, 'out'), cat(19, 'home')]],
    ['2× jenis sama', [cat(7, 'out'), cat(8, 'out')]],
  ];
  const beda = keadaan.filter(
    ([, r]) => T.readingDue(r, KINI) !== T.readingTodo(r, KINI).due,
  );
  c('keduanya sepakat di semua keadaan', beda.length === 0,
    beda.map(([n]) => n).join(', ') || `${keadaan.length} keadaan cocok`);
}

// =====================================================================
console.log('\n=== 2. Aturannya sendiri TIDAK berubah ===');
// =====================================================================
{
  c('belum dicatat hari ini → badge menyala', T.readingDue([], KINI) === true);
  c('baru 1× hari ini → badge masih menyala',
    T.readingDue([cat(7, 'out')], KINI) === true);
  c('sudah 2× hari ini → badge padam',
    T.readingDue([cat(7, 'out'), cat(19, 'home')], KINI) === false);
  // Dua kali dengan jenis yang sama tetap DUA titik ukur — dan dari dua titik
  // itulah pemakaiannya dihitung. Itu yang sebenarnya ditagih, bukan jenisnya.
  c('2× jenis sama juga memadamkan badge (dua titik ukur tetap dua)',
    T.readingDue([cat(7, 'out'), cat(8, 'out')], KINI) === false);
  c('catatan KEMARIN tidak ikut menghitung',
    T.readingDue([cat(kemarin, 'out'), cat(kemarin, 'home')], KINI) === true);
}

// =====================================================================
console.log('\n=== 3. Jawabannya: tepat, bukan sekadar ada ===');
// =====================================================================
{
  const kosong = T.readingTodo([], KINI);
  c('belum dicatat → dua-duanya disebut kurang',
    kosong.count === 0 && kosong.missing.length === 2,
    kosong.missing.map((k) => k.label).join(' & '));

  const satu = T.readingTodo([cat(7, 'out')], KINI);
  c('baru 🚪 Berangkat → yang disebut kurang tinggal 🏠 Sampai rumah',
    satu.count === 1 &&
      satu.missing.length === 1 &&
      satu.missing[0].key === 'home',
    satu.missing.map((k) => `${k.icon} ${k.label}`).join(''));

  // Urutan terbalik ikut benar — kalau `missing` disusun dari daftar tetap
  // tanpa melihat yang sudah ada, cek ini yang merah duluan.
  const satuLagi = T.readingTodo([cat(19, 'home')], KINI);
  c('baru 🏠 Sampai rumah → yang disebut kurang tinggal 🚪 Berangkat',
    satuLagi.missing.length === 1 && satuLagi.missing[0].key === 'out');

  const beres = T.readingTodo([cat(7, 'out'), cat(19, 'home')], KINI);
  c('sudah lengkap → tidak ada yang kurang & badge padam',
    beres.missing.length === 0 && beres.due === false);

  // Selama badge menyala, jawabannya TIDAK boleh kosong. Kartu bertanda merah
  // yang tidak menyebutkan apa pun sama saja dengan badge tanpa penjelasan.
  const semua = [
    [], [cat(7, 'out')], [cat(19, 'home')],
    [cat(kemarin, 'out'), cat(7, 'out')],
  ];
  const bisu = semua.filter((r) => {
    const t = T.readingTodo(r, KINI);
    return t.due && t.missing.length === 0;
  });
  c('tiap kali badge menyala, selalu ada yang bisa disebut', bisu.length === 0);
}

// =====================================================================
console.log('\n=== 4. Jawabannya benar-benar sampai ke layar ===');
// =====================================================================
{
  c('badge sub-tab dipasang dari readingDue',
    /token: readingDue\(readings \?\? \[\], new Date\(\)\) \? 1 : 0,/.test(layar));
  c('TokenTab menghitung penyebabnya dari sumber yang sama',
    /const tagihan = readingTodo\(readings, now\);/.test(tab));

  // Kartunya digambar PERSIS saat badge menyala — syaratnya satu-satunya
  // `tagihan.due`, bukan syarat kedua yang bisa menyimpang.
  c('kartu penjelas muncul persis saat badge menyala',
    /\{tagihan\.due && \(/.test(tab));

  // Bentuknya mengikuti cara app ini menjawab "yang mana": garis merah +
  // titik berdenyut, sama seperti di sub-tab Follow Up.
  c('bertanda sama dengan penanda "yang mana" di layar lain',
    /attentionBorder\(true\)/.test(tab) && /<AttentionMark corner \/>/.test(tab));
  // Di-click langsung membuka sheet catat meteran — menjelaskan tanpa memberi
  // jalan keluar cuma memindahkan kebingungan.
  c('di-click langsung membuka sheet catat meteran',
    /onPress=\{openReadingAdd\}>[\s\S]{0,120}<AttentionMark corner \/>/.test(tab));
  // Kalimatnya DIPENDEKKAN user sendiri (15 Sep 2026): cukup 'tercatat N×' &
  // 'Catat sekali lagi'; sebab badge-nya sudah dijelaskan judul kartunya.
  c('teksnya ringkas: "tercatat N×" & "Catat sekali lagi" (suntingan user 15 Sep 2026)',
    /: `tercatat \$\{tagihan\.count\}×`/.test(tab) && /: 'Catat sekali lagi'\}/.test(tab) &&
      !/padam begitu hari ini/.test(tab));
  c('menyebut jenis yang masih kurang, bukan kalimat umum',
    /tagihan\.missing[\s\S]{0,120}\$\{k\.icon\} \$\{k\.label\}/.test(tab));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
