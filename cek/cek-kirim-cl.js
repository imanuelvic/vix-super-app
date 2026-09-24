// Template Chat: kirim LANGSUNG ke nomor WA CL yang dituju.
// Penyusun tautannya DIJALANKAN dari sumbernya, bukan disalin ulang.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const OUT = path.join(__dirname, 'keluar-kirim-cl');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
try {
  require('child_process').execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/whatsapp.ts', R + 'lib/core.ts',
      '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch {
  /* tsc mengeluh soal alias "@/…" yang distub; JS-nya tetap keluar */
}

// Tangkap alamat yang DIBUKA, jangan sentuh apa pun di luar.
const dibuka = [];
const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (/linking$/.test(req)) {
    return {
      openExternalUrl: (url, opts) => {
        dibuka.push({ url, fallback: opts?.fallback ?? null });
        return Promise.resolve();
      },
    };
  }
  if (req === 'firebase/firestore') {
    return {
      doc: () => ({}), setDoc: () => Promise.resolve(), collection: () => ({}),
      query: (...a) => a, orderBy: () => ({}), where: () => ({}),
      limit: () => ({}), deleteDoc: () => Promise.resolve(),
      writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: () => Promise.resolve() }),
      Timestamp: { fromDate: (d) => d, now: () => new Date() },
    };
  }
  if (/firebase$/.test(req)) return { db: {} };
  if (/liveDoc$/.test(req)) return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req.startsWith('@/assets/style/color')) {
    return { Color: new Proxy({}, { get: (_, k) => `#${String(k)}` }) };
  }
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const WA = require(path.join(OUT, 'whatsapp.js'));
const CORE = require(path.join(OUT, 'core.js'));
Module._load = asli;

const layar = baca('app/chat-templates.tsx');
const PESAN = 'Pagi Elvina! 🌱 Semangat ya';

// ===================================================================
console.log('=== Tautan yang benar-benar dibuka ===');
dibuka.length = 0;
WA.openWhatsAppChat('81234567890', PESAN);
const langsung = dibuka[0];
console.log(`  ${langsung.url}`);
c('menuju wa.me nomor orangnya', langsung.url.startsWith('https://wa.me/6281234567890'));
c('kode negara +62 disisipkan sekali saja', (langsung.url.match(/wa\.me\/62/g) || []).length === 1);
c('pesannya ikut terbawa & ter-encode',
  langsung.url.includes(encodeURIComponent(PESAN)));
c('emoji di dalam pesan tidak merusak tautannya',
  decodeURIComponent(langsung.url.split('?text=')[1]) === PESAN);

dibuka.length = 0;
WA.shareTextToWhatsApp(PESAN);
const pilihSendiri = dibuka[0];
console.log(`  ${pilihSendiri.url}`);
c('tanpa nomor → tetap jalur "pilih chat sendiri"',
  pilihSendiri.url.startsWith('whatsapp://send?text=') &&
    !/wa\.me\/62/.test(pilihSendiri.url));
c('jalur itu masih punya cadangan web', /^https:\/\/wa\.me\/\?text=/.test(pilihSendiri.fallback));

// ===================================================================
console.log('\n=== Kapan masing-masing jalur dipakai ===');
c('CL yang dituju diambil dari daftar, bukan ditebak dari namanya',
  /const cl =\s*\n\s*pilihan === GRUP \|\| pilihan === MANUAL\s*\n\s*\? null\s*\n\s*: \(leaders\.find\(\(l\) => l\.id === pilihan\) \?\? null\);/.test(layar));
c('punya nomor → chat orangnya dibuka langsung',
  /if \(cl\?\.phone\) \{\s*\n\s*openWhatsAppChat\(cl\.phone, text, \(\) => setError\(WHATSAPP_ERROR\)\);\s*\n\s*return;\s*\n\s*\}/.test(layar));
c('selain itu → seperti dulu, pilih chat sendiri',
  /shareTextToWhatsApp\(text, \(\) => setError\(WHATSAPP_ERROR\)\);/.test(layar));
c('Grup CORE TIDAK pernah dikirim ke nomor pribadi',
  /pilihan === GRUP \|\| pilihan === MANUAL/.test(layar));
c('nama ketikan sendiri juga tidak', /pilihan === MANUAL \? namaLain\.trim\(\)/.test(layar));
c('nama yang disisipkan ke templat tetap dari CL yang sama (tak bisa beda)',
  /const nama = pilihan === MANUAL \? namaLain\.trim\(\) : \(cl\?\.name \?\? ''\);/.test(layar));

// ===================================================================
console.log('\n=== Nomor yang belum diisi ===');
// Semua CL bawaan lahir tanpa nomor — jadi keadaan ini BUKAN kasus langka,
// dan itulah sebabnya keterangannya wajib ada. `DEFAULT_LEADERS` tidak
// diekspor (memang tidak perlu), jadi blok datanya dibaca dari sumbernya.
const coreSrc = baca('lib/core.ts');
const awal = coreSrc.indexOf('const DEFAULT_LEADERS');
c('blok CL bawaan ketemu (kalau tidak, cek di bawah ini cuma pura-pura jalan)',
  awal > 0);
const blok = coreSrc.slice(awal, coreSrc.indexOf('\n];', awal));
const jumlahCl = (blok.match(/\{ id: '/g) || []).length;
const tanpaNomor = (blok.match(/phone: null/g) || []).length;
console.log(`  ${tanpaNomor}/${jumlahCl} CL bawaan belum punya nomor`);
c('memang belum ada yang terisi → keterangannya wajib ada',
  jumlahCl > 0 && tanpaNomor === jumlahCl);
c('ada keterangan kalau nomornya belum diisi',
  /Nomor WA \$\{cl\.name\} belum diisi/.test(layar));
c('keterangannya menunjuk tempat mengisinya',
  /Isi di CORE › Leaders/.test(layar) &&
    /params: \{ tab: 'leaders' \}/.test(layar));
c('keterangan itu bisa ditekan HANYA saat nomornya kosong',
  /disabled=\{!!cl\.phone\}/.test(layar));
c('kalau nomornya ADA, tujuannya ditulis sebelum ditekan',
  /Langsung ke chat \$\{cl\.name\} · \+62\$\{cl\.phone\}/.test(layar));
c('nomor kosong BUKAN dianggap galat (tak ada pesan merah)',
  !/setError\([^)]*belum diisi/.test(layar));
c('Grup CORE tidak ikut menampilkan keterangan itu', /\{cl && \(/.test(layar));

// ===================================================================
console.log('\n=== Nomor disimpan sebagai digit SETELAH +62 ===');
c('normalisasinya dipakai saat mengisi nomor', typeof CORE.normalizePhone === 'function');
for (const [masuk, harap] of [
  ['081234567890', '81234567890'],
  ['+6281234567890', '81234567890'],
  ['6281234567890', '81234567890'],
  ['0812-3456-7890', '81234567890'],
]) {
  c(`  "${masuk}" → ${harap}`, CORE.normalizePhone(masuk) === harap, String(CORE.normalizePhone(masuk)));
}
// Bukti sambungannya: nomor hasil normalisasi masuk ke tautan tanpa 0 ganda.
dibuka.length = 0;
WA.openWhatsAppChat(CORE.normalizePhone('081234567890'), PESAN);
c('nomor 08… tidak jadi "620812…" di tautannya',
  dibuka[0].url.startsWith('https://wa.me/6281234567890'), dibuka[0].url.split('?')[0]);

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);