// /rapihin Batch 3 — rollout util bersama + buang dead code.
//   1. photoUri()  : prefix "data:image/jpeg;base64," yang dulu diketik 10×
//   2. LoadingCenter: dua spinner tengah yang disalin apa adanya
//   3. loadErrorOf/saveErrorOf/deleteErrorOf: kalimat galat yang dirangkai 11×
//   4. style key & variabel mati
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-rapihin-batch3');
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

// ---------- Kompilasi ----------
fs.rmSync(OUT, { recursive: true, force: true });
try {
  execFileSync(
    process.execPath,
    [
      R + 'node_modules/typescript/bin/tsc', '--ignoreConfig',
      R + 'lib/photo.ts',
      R + 'lib/messages.ts',
      '--outDir', OUT,
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const M = (nama) => {
  for (const k of [`lib/${nama}.js`, `${nama}.js`]) {
    const p = path.join(OUT, ...k.split('/'));
    if (fs.existsSync(p)) return p;
  }
  console.log(`  ✗ gagal mengompilasi lib/${nama}.ts`);
  process.exit(1);
};

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (/^(expo-|expo$|react-native|@react-native|@\/)/.test(req)) return {};
  return asli(req, parent, isMain);
};
const foto = require(M('photo'));
const pesan = require(M('messages'));
Module._load = asli;

const cariTsx = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? cariTsx(p) : /\.tsx?$/.test(e.name) ? [p] : [];
  });
const semuaSumber = [
  ...cariTsx(R + 'app'), ...cariTsx(R + 'components'),
  ...cariTsx(R + 'lib'), ...cariTsx(R + 'hooks'), ...cariTsx(R + 'contexts'),
];
const rel = (p) => p.replace(/\\/g, '/').replace(R, '');

// =====================================================================
console.log('\n== 1. photoUri(): alamat foto dirangkai SEKALI ==');
// =====================================================================
c('hasilnya persis sama dengan yang dulu diketik tangan',
  foto.photoUri('AAA') === 'data:image/jpeg;base64,AAA', foto.photoUri('AAA'));
c('jenisnya jpeg (bukan jpg — `image/jpg` tidak dikenal & fotonya diam saja)',
  /^data:image\/jpeg;base64,/.test(foto.photoUri('x')));

// Inilah gunanya: literalnya tinggal di SATU berkas.
const perakit = semuaSumber.filter((p) =>
  /data:image\/jpeg;base64,/.test(fs.readFileSync(p, 'utf8')),
);
c('cuma lib/photo.ts yang menyimpan bentuk alamatnya',
  perakit.length === 1 && rel(perakit[0]) === 'lib/photo.ts',
  perakit.map(rel).join(', '));

// Semua yang menampilkan foto memakai helper itu — layar MAUPUN PDF.
const PEMAKAI = [
  'app/profile.tsx', 'app/bill/[id].tsx', 'app/family.tsx',
  'components/core/MonthlyTab.tsx', 'components/fun/FunArchive.tsx',
  'lib/monthlyPdf.ts',
];
const kurang = PEMAKAI.filter((f) => !/photoUri\(/.test(baca(f)));
c(`${PEMAKAI.length} berkas penampil foto memakainya`, kurang.length === 0,
  kurang.join(', '));
c('PDF notulen ikut memakainya (bukan cuma layar)',
  /<img src="\$\{photoUri\(p\)\}"/.test(baca('lib/monthlyPdf.ts')));

// Efek samping yang ditemukan waktu merapikan: `profile.photo` & `m.photo`
// bertipe `string | null`, dan template literal DIAM saja menerima null —
// hasilnya alamat "…base64,null" yang tak pernah menampilkan apa pun.
// Sekarang tipenya string, jadi TypeScript yang menjaganya.
c('photoUri hanya menerima string (null tak bisa lolos diam-diam)',
  /export function photoUri\(base64: string\): string/.test(baca('lib/photo.ts')));
c('penjaganya di layar: nilainya sendiri yang dicek, bukan alias boolean',
  /\) : profile\.photo \? \(/.test(baca('app/profile.tsx')) &&
  /\{m\.photo \? \(/.test(baca('app/family.tsx')));
c('alias hasPhoto yang mematikan penyempitan tipe sudah dibuang',
  !/hasPhoto/.test(baca('app/profile.tsx')) &&
  !/hasPhoto/.test(baca('app/family.tsx')));

// =====================================================================
console.log('\n== 2. LoadingCenter dipakai, salinannya dibuang ==');
// =====================================================================
const home = baca('app/(tabs)/index.tsx');
const layout = baca('app/_layout.tsx');
c('Home memakai LoadingCenter',
  /<LoadingCenter size="large" \/>/.test(home) &&
  /@\/components\/common\/LoadingCenter/.test(home));
c('style loadingCenter yang menyalin isinya sudah dibuang',
  !/loadingCenter/.test(home));
c('Home tak lagi mengimpor ActivityIndicator',
  !/ActivityIndicator/.test(home));
// 23 Sep 2026: layar boot jadi ANIMASI pembuka (VixSplash) — latarnya
// MAIN_DARK, sama dengan splash bawaan di app.json, jadi tidak ada kilas.
c('layar boot memakai animasi pembuka VixSplash',
  /<VixSplash \/>/.test(layout) &&
  /backgroundColor: Color\.MAIN_DARK/.test(baca('components/common/VixSplash.tsx')));
c('_layout tak lagi mengimpor ActivityIndicator/View',
  !/ActivityIndicator/.test(layout) && !/\bView\b/.test(layout));
// Ukuran "large" tetap dipakai layar penuh yang MASIH memakai LoadingCenter
// (Today); layar boot sudah punya animasinya sendiri.
c('layar penuh tetap memakai ukuran besar',
  (home.match(/size="large"/g) ?? []).length >= 1);
c('LoadingCenter memang menerima style & size (bukan asal dioper)',
  /size = 'small'/.test(baca('components/common/LoadingCenter.tsx')) &&
  /\[styles\.center, style\]/.test(baca('components/common/LoadingCenter.tsx')));

// =====================================================================
console.log('\n== 3. Kalimat galat: satu bentuk, teks tak berubah ==');
// =====================================================================
c('loadErrorOf sama persis dengan teks lama',
  pesan.loadErrorOf('mutasi') === 'Gagal memuat mutasi. Cek koneksi internet.',
  pesan.loadErrorOf('mutasi'));
c('saveErrorOf sama persis dengan teks lama',
  pesan.saveErrorOf('budget') === 'Gagal menyimpan budget. Coba lagi.',
  pesan.saveErrorOf('budget'));
c('deleteErrorOf sama persis dengan teks lama',
  pesan.deleteErrorOf('target') === 'Gagal menghapus target. Coba lagi.',
  pesan.deleteErrorOf('target'));
c('pesan umum LOAD/SAVE/DELETE tidak ikut berubah',
  pesan.LOAD_ERROR === 'Gagal memuat data. Coba lagi.' &&
  pesan.SAVE_ERROR === 'Gagal menyimpan. Coba lagi.' &&
  pesan.DELETE_ERROR === 'Gagal menghapus. Coba lagi.' &&
  pesan.PHOTO_ERROR === 'Gagal mengambil foto. Coba lagi.');

// Tiga konstanta di lib/ SENGAJA ditinggalkan: akhirannya masing-masing beda
// ("Cek koneksi lalu coba lagi." / "Periksa koneksimu, lalu coba lagi." /
// "Coba lagi ya."), jadi memakai helper akan MENGUBAH tulisan yang dilihat
// pengguna — itu bukan merapikan. Dicatat di sini sebagai utang yang diketahui;
// yang dijaga: jangan sampai bertambah.
const DIKENAL = ['lib/news.ts', 'lib/shareImage.ts', 'lib/youtube.ts'];
const masihRakit = semuaSumber
  .filter((p) => rel(p) !== 'lib/messages.ts' &&
    /'Gagal (memuat|menyimpan|menghapus) /.test(fs.readFileSync(p, 'utf8')))
  .map(rel);
c('tak ada layar yang merangkai kalimatnya sendiri lagi',
  masihRakit.every((f) => DIKENAL.includes(f)),
  masihRakit.filter((f) => !DIKENAL.includes(f)).join(', ') || 'bersih');
c('sisanya cuma tiga konstanta lib yang bunyinya memang beda',
  masihRakit.length === 3, masihRakit.join(', '));

// Yang dipanggil harus benar-benar diimpor — kalau tidak, layarnya crash saat
// gagal, yaitu tepat saat pesannya paling dibutuhkan.
for (const f of ['app/saku.tsx', 'app/saku/[key].tsx', 'app/tasks.tsx',
  'components/finance/BudgetingTab.tsx', 'components/habits/HabitsTab.tsx']) {
  const src = baca(f);
  const dipakai = [...src.matchAll(/\b((?:load|save|delete)ErrorOf)\(/g)]
    .map((m) => m[1]);
  const impor = /from '@\/lib\/messages'/.test(src)
    ? src.slice(0, src.indexOf("from '@/lib/messages'"))
    : '';
  const hilang = [...new Set(dipakai)].filter((n) => !impor.includes(n));
  c(`${f.padEnd(34)} mengimpor semua yang dipakainya`,
    dipakai.length > 0 && hilang.length === 0, hilang.join(', '));
}

// =====================================================================
console.log('\n== 4. Dead code benar-benar mati sebelum dibuang ==');
// =====================================================================
const MATI = [
  ['app/history.tsx', ['chipWrap']],
  ['components/core/FollowupTab.tsx', ['emptyText', 'fieldLabel', 'formGap']],
  ['components/habits/HabitsTab.tsx', ['pickChip']],
  ['components/health/StepsTab.tsx', ['msLabelOn']],
  ['components/learning/WeekTab.tsx',
    ['mainTopicCard', 'mainTopicTitle', 'mainTopicHint', 'topicCard', 'topicCardDone']],
];
let jml = 0;
for (const [f, kunci] of MATI) {
  const src = baca(f);
  const sisa = kunci.filter((k) => new RegExp(`^ {2}${k}: `, 'm').test(src));
  jml += kunci.length;
  c(`${f.replace(/^(app|components)\//, '').padEnd(26)} ${kunci.length} style mati dibuang`,
    sisa.length === 0, sisa.join(', '));
}
c(`total ${jml} style key mati`, jml === 11, jml);

// Dibuang karena TIDAK dipakai — bukan karena kebetulan tak terbaca. Yang
// diakses secara dinamis (styles[nada]) TIDAK boleh ikut tersapu.
const dinamis = semuaSumber.filter((p) => /styles\[/.test(fs.readFileSync(p, 'utf8')));
c('tak ada berkas yang memilih style secara dinamis di antara yang disunting',
  MATI.every(([f]) => !dinamis.map(rel).includes(f)), dinamis.map(rel).join(', '));
// Keduanya sempat dilaporkan "tak terpakai" oleh pemindai — palsu: kuncinya
// dipilih lewat variabel (borders[tone]) atau dipakai berkas lain
// (summaryText.value). Yang dijaga bukan cuma pemakaiannya, tapi KUNCINYA
// masih ada — menghapus kuncinya membuat gaya itu senyap jadi undefined.
const deadline = baca('components/common/Deadline.tsx');
c('Deadline: pemilihan dinamisnya utuh',
  /borders\[tone\]/.test(deadline) && /tags\[tone\]/.test(deadline));
c('Deadline: keempat nada masih punya gayanya',
  ['over', 'warn', 'ok'].every(
    (k) => (deadline.match(new RegExp(`^ {2}${k}: `, 'gm')) ?? []).length === 2,
  ) && /^ {2}unknown: /m.test(deadline));
const ringkas = baca('components/common/SummaryCard.tsx');
c('SummaryCard: summaryText.label & .value masih ada & dipakai',
  /^ {2}label: /m.test(ringkas) && /^ {2}value: /m.test(ringkas) &&
  /summaryText\.label/.test(ringkas) && /summaryText\.value/.test(ringkas));

console.log('\n' + (ok ? 'LULUS: semua benar.' : 'GAGAL: ada yang tidak cocok.'));
process.exit(ok ? 0 : 1);