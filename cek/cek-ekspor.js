// 24 Sep 2026 — 📦 Ekspor Data: cadangan seluruh isi users/{uid} jadi satu JSON.
//
// Cek yang PALING penting di berkas ini yang pertama: daftar koleksi di
// lib/dataExport.ts harus LENGKAP. Firestore dari sisi klien tidak bisa
// mendaftar koleksi milik sebuah dokumen, jadi daftar itu ditulis tangan — dan
// daftar tulis tangan adalah daftar yang bisa ketinggalan. Kalau suatu hari
// ada fitur baru dengan koleksi baru dan namanya lupa ditambahkan, data fitur
// itu TIDAK akan pernah ikut tercadangkan, diam-diam, sampai hari orang
// benar-benar butuh cadangannya. Cek di bawah membuat kelalaian itu mustahil
// lewat tanpa ketahuan.
//
// Sisanya menjalankan mesinnya SUNGGUHAN di atas Firestore tiruan: bentuk
// berkasnya, penyandian Timestamp, subkoleksi, hitungan dokumen, dan sikapnya
// saat satu koleksi gagal dibaca.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const ROOT = AKAR;
const R = AKAR + '/';
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else {
    gagal++;
    console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`);
  }
}

// ==================== 1. Daftar koleksinya lengkap ====================
console.log('\nDaftar koleksi — tidak boleh ada yang tertinggal');

const sumberEkspor = baca('lib/dataExport.ts');

/** Nama koleksi yang benar-benar dipakai kode, dipindai dari lib/*.ts. */
function koleksiTerpakai() {
  const pola = /\b(?:doc|collection)\(\s*db\s*,\s*'users'\s*,\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'/g;
  const nama = new Set();
  const dir = path.join(ROOT, 'lib');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const isi = fs.readFileSync(path.join(dir, f), 'utf8');
    let m;
    while ((m = pola.exec(isi)) !== null) nama.add(m[1]);
  }
  return nama;
}

// Daftar di dalam berkasnya sendiri (dibaca dari teksnya, bukan diketik ulang
// di sini — kalau diketik ulang, cek ini cuma membandingkan dua salinan).
const blokDaftar = sumberEkspor.slice(
  sumberEkspor.indexOf('export const EXPORT_COLLECTIONS'),
  sumberEkspor.indexOf('];', sumberEkspor.indexOf('export const EXPORT_COLLECTIONS')),
);
const didaftar = new Set([...blokDaftar.matchAll(/'([^']+)'/g)].map((m) => m[1]));
const dipakai = koleksiTerpakai();
const kurang = [...dipakai].filter((n) => !didaftar.has(n)).sort();
const lebih = [...didaftar].filter((n) => !dipakai.has(n)).sort();

ok('SEMUA koleksi yang dipakai kode ada di EXPORT_COLLECTIONS',
  kurang.length === 0, kurang.join(', '));
ok('tidak ada nama karangan yang tak dipakai kode mana pun',
  lebih.length === 0, lebih.join(', '));
ok('jumlahnya masuk akal (≥ 40 koleksi)', didaftar.size >= 40, String(didaftar.size));

// Subkoleksi: jalur bertingkat di lib/ harus punya induknya di daftar sub.
const polaSub = /\b(?:doc|collection)\(\s*db\s*,\s*'users'\s*,\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'\s*,\s*[^,)]+,\s*'([^']+)'/g;
const subTerpakai = new Map();
{
  const dir = path.join(ROOT, 'lib');
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.ts'))) {
    const isi = fs.readFileSync(path.join(dir, f), 'utf8');
    let m;
    while ((m = polaSub.exec(isi)) !== null) {
      if (!subTerpakai.has(m[1])) subTerpakai.set(m[1], new Set());
      subTerpakai.get(m[1]).add(m[2]);
    }
  }
}
const subKurang = [];
for (const [induk, anak] of subTerpakai) {
  for (const a of anak) {
    if (!new RegExp(`${induk}:\\s*\\[[^\\]]*'${a}'`).test(sumberEkspor)) {
      subKurang.push(`${induk}/${a}`);
    }
  }
}
ok('SEMUA subkoleksi bertingkat ada di EXPORT_SUBCOLLECTIONS',
  subKurang.length === 0, subKurang.join(', '));

// ==================== 2. Mesinnya dijalankan sungguhan ====================
console.log('\nMesin ekspor — dijalankan atas Firestore tiruan');

const OUT = path.join(__dirname, 'keluar-ekspor');
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc',
      R + 'lib/dataExport.ts',
      '--ignoreConfig',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const DIR = fs.existsSync(path.join(OUT, 'lib')) ? path.join(OUT, 'lib') : OUT;
if (!fs.existsSync(path.join(DIR, 'dataExport.js'))) {
  console.log('  ✗ gagal mengompilasi dataExport.js');
  process.exit(1);
}

// Timestamp tiruan yang bentuknya sama dengan milik Firestore.
class FakeTimestamp {
  constructor(seconds, nanoseconds) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  toDate() { return new Date(this.seconds * 1000); }
}

/** Isi Firestore palsu: koleksi → { id → data }, plus subkoleksi. */
const ISI = {
  revive: {
    '2026-09-24': { title: 'ARE YOU TOO BUSY', date: new FakeTimestamp(1790000000, 500) },
    '2026-09-23': { title: 'Kedua', date: new FakeTimestamp(1789913600, 0) },
  },
  bills: { 'bill-a': { title: 'Makan bareng', total: 250000 } },
  funds: { 'self-reward': { balance: 300000 } },
  tasks: { 't1': { text: 'Beli galon', done: false } },
};
const SUB = {
  'bills/bill-a/media': { photo: { photo: 'AAAA' } },
  'funds/self-reward/entries': {
    'e1': { amount: 50000, at: new FakeTimestamp(1790000001, 0) },
  },
};
/** Koleksi yang sengaja dibuat gagal dibaca. */
const RUSAK = 'transactions';

let bacaan = 0;
const tercipta = [];
let ditulis = null;
let dibagikan = null;

// SATU objek tiruan firebase/firestore, dipakai bersama oleh dataExport DAN
// liveDoc. Ini penting: `encodeTimestamps` di liveDoc memeriksa
// `value instanceof Timestamp`, jadi kalau keduanya dapat kelas Timestamp yang
// berbeda (atau undefined), penyandiannya tidak akan pernah kena dan cek di
// bawah lulus palsu.
const FIRESTORE = {
  Timestamp: FakeTimestamp,
  collection: (_db, ...bagian) => ({ jalur: bagian.slice(2).join('/') }),
  getDocs: async (q) => {
    if (q.jalur === RUSAK) throw new Error('ditolak');
    const sumber = ISI[q.jalur] ?? SUB[q.jalur] ?? {};
    const docs = Object.entries(sumber).map(([id, data]) => ({
      id,
      data: () => data,
    }));
    bacaan += docs.length;
    return { empty: docs.length === 0, docs };
  },
};

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (/\/firebase$/.test(req) || req === './firebase') return { db: {} };
  if (req === 'firebase/firestore') return FIRESTORE;
  if (req === '@react-native-async-storage/async-storage') {
    return { default: { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } };
  }
  if (req === 'expo-file-system') {
    return {
      Paths: { cache: '/cache' },
      File: class {
        constructor(_dir, nama) { this.nama = nama; this.uri = `file:///cache/${nama}`; this.exists = false; }
        create() { tercipta.push(this.nama); }
        write(isi) { ditulis = isi; }
        delete() {}
      },
    };
  }
  if (req === 'expo-sharing') {
    return {
      isAvailableAsync: async () => true,
      shareAsync: async (uri, opts) => { dibagikan = { uri, opts }; },
    };
  }
  return asli(req, parent, isMain);
};

const X = require(path.join(DIR, 'dataExport.js'));
Module._load = asli;

const langkah = [];
const hasil = (async () =>
  X.exportAllData('uid-vix', '2.0.0', (p) => langkah.push(p)))();

hasil.then((h) => {
  const obj = JSON.parse(h.json);

  ok('berkasnya menyebut dirinya sendiri (app, versi, waktu, uid)',
    obj.app === 'vix-super-app' && obj.version === '2.0.0' &&
    typeof obj.exportedAt === 'string' && obj.uid === 'uid-vix');

  ok('hanya koleksi yang ADA isinya yang ikut ditulis',
    Object.keys(obj.collections).sort().join(',') === 'bills,funds,revive,tasks',
    Object.keys(obj.collections).join(','));

  ok('dokumen disimpan per id, isinya di bawah "data"',
    obj.collections.revive['2026-09-24'].data.title === 'ARE YOU TOO BUSY' &&
    obj.collections.tasks.t1.data.text === 'Beli galon');

  ok('Timestamp disandikan __ts__ [detik, nano], BUKAN jadi null',
    JSON.stringify(obj.collections.revive['2026-09-24'].data.date) ===
      JSON.stringify({ __ts__: [1790000000, 500] }),
    JSON.stringify(obj.collections.revive['2026-09-24'].data.date));

  ok('penyandiannya memakai encodeTimestamps milik liveDoc, bukan salinan',
    /import \{ encodeTimestamps \} from '\.\/liveDoc'/.test(sumberEkspor) &&
      !/__ts__/.test(sumberEkspor) &&
      /export function encodeTimestamps/.test(baca('lib/liveDoc.ts')));

  ok('subkoleksi ikut, dipisah rapi di bawah "sub"',
    obj.collections.bills['bill-a'].sub.media.photo.photo === 'AAAA' &&
    obj.collections.funds['self-reward'].sub.entries.e1.amount === 50000);

  ok('Timestamp di dalam SUBkoleksi ikut disandikan juga',
    JSON.stringify(obj.collections.funds['self-reward'].sub.entries.e1.at) ===
      JSON.stringify({ __ts__: [1790000001, 0] }));

  ok('dokumen tanpa subkoleksi tidak dapat kolom "sub" kosong',
    obj.collections.revive['2026-09-24'].sub === undefined &&
    obj.collections.tasks.t1.sub === undefined);

  // 5 dokumen induk (revive ×2, bills, funds, tasks) + 2 subdokumen
  // (bills/media/photo, funds/entries/e1). Angkanya dipatok TEPAT, bukan
  // "lebih dari nol": inilah yang membuat subkoleksi yang diam-diam berhenti
  // ikut terbaca langsung ketahuan.
  ok('docCount = jumlah dokumen yang BENAR-BENAR dibaca (termasuk subkoleksi)',
    h.docCount === bacaan && h.docCount === 7, `${h.docCount} vs ${bacaan}`);

  ok('satu koleksi gagal TIDAK membatalkan sisanya, dan disebut jujur',
    h.errors.length === 1 && h.errors[0] === RUSAK &&
    obj.missing.join(',') === RUSAK && h.filledCount === 4);

  ok('kemajuannya dilaporkan tiap koleksi, ditutup "selesai"',
    langkah.length === didaftar.size + 1 &&
    langkah[0].done === 0 && langkah[0].total === didaftar.size &&
    langkah[langkah.length - 1].label === 'selesai',
    String(langkah.length));

  // ==================== 3. Menyerahkan berkasnya ====================
  console.log('\nBerbagi berkas');

  return X.shareExport(h.json, X.exportFileName('2026-09-24')).then(() => {
    ok('nama berkasnya bertanggal & jelas miliknya siapa',
      X.exportFileName('2026-09-24') === 'vix-cadangan-2026-09-24.json',
      X.exportFileName('2026-09-24'));
    ok('ditulis ke folder CACHE (bukan menumpuk selamanya di HP)',
      tercipta.length === 1 && dibagikan.uri === 'file:///cache/vix-cadangan-2026-09-24.json');
    ok('isinya persis JSON hasil ekspor, dibagikan sebagai application/json',
      ditulis === h.json && dibagikan.opts.mimeType === 'application/json' &&
      dibagikan.opts.UTI === 'public.json');
    ok('ukuran dilaporkan enak dibaca',
      X.formatBytes(900) === '900 B' && X.formatBytes(2048) === '2 KB' &&
      X.formatBytes(1500000) === '1,4 MB',
      [X.formatBytes(900), X.formatBytes(2048), X.formatBytes(1500000)].join(' · '));

    // ==================== 4. Layarnya ====================
    console.log('\nLayar System ⚙️ — tombolnya');

    const layar = baca('app/system.tsx');
    ok('tombolnya ada di layar System, memakai PrimaryButton bersama',
      /<PrimaryButton/.test(layar) && /Ekspor semua data/.test(layar) &&
      /from '@\/components\/common\/PrimaryButton'/.test(layar));
    ok('HANYA jalan saat di-click — tidak ada useEffect yang memanggilnya',
      /onPress=\{onExport\}/.test(layar) &&
      !/useEffect\([^)]*exportAllData/.test(layar) &&
      !/useEffect\(\(\) => \{\s*onExport/.test(layar));
    ok('pakai useBusyTask bersama, jadi tak mungkin jalan dobel',
      /useBusyTask<'ekspor'>\(\)/.test(layar) && /busy === 'ekspor'/.test(layar));
    ok('kemajuannya kelihatan di tombolnya sendiri',
      /Membaca \$\{exportStep\}/.test(layar));
    ok('hasilnya dilaporkan: jumlah dokumen, koleksi, ukuran',
      /dokumen · \$\{hasil\.filledCount\} koleksi · \$\{formatBytes/.test(layar));
    ok('gagal berbagi & gagal ekspor punya pesan sendiri-sendiri',
      /sharing off/.test(layar) && /Gagal mengekspor data\. Coba lagi\./.test(layar));
    ok('versinya ikut dicatat dari expo-constants, bukan diketik',
      /Constants\.expoConfig\?\.version/.test(layar));

    console.log(gagal === 0
      ? '\n✅ LULUS — daftar koleksi lengkap, ekspor & berbagi terbukti benar.'
      : `\n❌ ${gagal} cek gagal.`);
    process.exit(gagal === 0 ? 0 : 1);
  });
}).catch((e) => {
  console.log('  ❌ meledak: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
