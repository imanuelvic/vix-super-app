// Batch /rapihin: penutup sheet ubah (<EditDelete/> + <DualButtons/>) jadi
// satu <EditFooter/>.
//
// Komponennya DIJALANKAN di atas tiruan kecil React (React.createElement
// dipalsukan jadi pohon objek biasa), jadi yang diuji apa yang benar-benar
// digambar & prop apa yang diteruskan — bukan tulisannya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const R = AKAR + '/';
const OUT = path.join(__dirname, 'keluar-editfooter');
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
      R + 'components/common/EditFooter.tsx',
      '--outDir', OUT,
      '--jsx', 'react-jsx',
      '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler',
    ],
    { stdio: 'pipe' },
  );
} catch { /* keluhan tipe diabaikan */ }

const MODUL = fs.existsSync(path.join(OUT, 'components', 'common', 'EditFooter.js'))
  ? path.join(OUT, 'components', 'common', 'EditFooter.js')
  : path.join(OUT, 'EditFooter.js');
if (!fs.existsSync(MODUL)) {
  console.log('  ✗ gagal mengompilasi EditFooter.tsx');
  process.exit(1);
}

// ---------- Tiruan JSX ----------
// jsx(type, props) → objek biasa. Anak-anaknya dikumpulkan lewat Fragment.
const FRAGMENT = Symbol('Fragment');
const jsx = (type, props) => ({ type, props });
const jsxs = jsx;

Module._load = ((asli) => function (req, parent, isMain) {
  if (req === 'react/jsx-runtime') return { jsx, jsxs, Fragment: FRAGMENT };
  // Kedua anaknya dipalsukan jadi penanda, supaya bisa dikenali di pohonnya.
  if (/DualButtons$/.test(req)) return { DualButtons: 'DualButtons' };
  if (/EditDelete$/.test(req)) return { EditDelete: 'EditDelete' };
  if (/^(@\/|expo-|expo$|react-native|@react-native)/.test(req)) return {};
  return asli.call(this, req, parent, isMain);
})(Module._load);

const { EditFooter } = require(MODUL);

/** Ratakan pohon jadi daftar {type, props}. */
function anak(hasil) {
  if (!hasil || typeof hasil !== 'object') return [];
  if (hasil.type === FRAGMENT) {
    const isi = hasil.props.children;
    return (Array.isArray(isi) ? isi : [isi]).flatMap(anak);
  }
  return [hasil];
}

// =====================================================================
console.log('=== 1. Yang digambar & urutannya ===');
// =====================================================================
const jejak = [];
const dasar = {
  editing: { id: 'x1' },
  deleteLabel: 'Hapus catatan ini',
  busy: false,
  onDelete: () => jejak.push('delete'),
  onCancel: () => jejak.push('cancel'),
  onConfirm: () => jejak.push('confirm'),
};
{
  const bagian = anak(EditFooter(dasar));
  c('menggambar TEPAT dua bagian', bagian.length === 2, String(bagian.length));
  c('Hapus DI ATAS pasangan tombol (aksi merusak jauh dari tombol tersering)',
    bagian[0]?.type === 'EditDelete' && bagian[1]?.type === 'DualButtons',
    bagian.map((b) => b.type).join(' → '));
}

// =====================================================================
console.log('\n=== 2. Prop diteruskan apa adanya ===');
// =====================================================================
{
  const [ed, db] = anak(EditFooter(dasar));
  c('editing & label sampai ke tombol hapus',
    ed.props.editing === dasar.editing && ed.props.label === 'Hapus catatan ini');
  c('onDelete-nya milik tombol hapus, BUKAN tertukar dengan onConfirm', (() => {
    jejak.length = 0;
    ed.props.onDelete();
    return jejak.join(',') === 'delete';
  })());
  c('onCancel & onConfirm sampai ke pasangan tombol', (() => {
    jejak.length = 0;
    db.props.onCancel();
    db.props.onConfirm();
    return jejak.join(',') === 'cancel,confirm';
  })());
  c('bawaan tombol utamanya "Simpan"', db.props.confirmLabel === 'Simpan',
    db.props.confirmLabel);
  c('bisa diganti kalau memang beda',
    anak(EditFooter({ ...dasar, confirmLabel: 'Tambah' }))[1].props.confirmLabel ===
      'Tambah');
}

// =====================================================================
console.log('\n=== 3. `busy` mengunci KEDUANYA — ini inti perbaikannya ===');
// =====================================================================
// Kalau cuma DualButtons yang dapat `busy`, tombol Simpan mati saat menyimpan
// tapi tombol Hapus di atasnya masih hidup — sekali ditekan, penghapusan
// berjalan di tengah penyimpanan.
{
  for (const busy of [false, true]) {
    const [ed, db] = anak(EditFooter({ ...dasar, busy }));
    c(`busy=${busy} → sampai ke KEDUANYA`,
      ed.props.busy === busy && db.props.busy === busy,
      `hapus=${ed.props.busy} tombol=${db.props.busy}`);
  }
  // Diperiksa dari BADAN komponennya saja (di bawah komentar pembuka —
  // contoh kode di komentar itu juga memuat `busy={busy}`).
  const sumber = baca('components/common/EditFooter.tsx');
  const badan = sumber.slice(sumber.indexOf('export function EditFooter'));
  c('satu prop busy, diteruskan ke dua-duanya — mustahil dioper setengah',
    (badan.match(/busy=\{busy\}/g) ?? []).length === 2 &&
      (badan.match(/busy: boolean;/g) ?? []).length === 1,
    `${(badan.match(/busy=\{busy\}/g) ?? []).length}× diteruskan`);
}

// =====================================================================
console.log('\n=== 4. Kelima belas sheet memakainya ===');
// =====================================================================
const F = [
  // (core-ideas dicabut 16 Sep 2026.)
  'app/reward.tsx', 'app/core-rules.tsx',
  'app/diseases.tsx', 'app/donor.tsx', 'app/history.tsx', 'app/timeline.tsx',
  'app/visitations.tsx', 'components/car/LogTab.tsx',
  'components/career/AffiliateTab.tsx', 'components/career/FulltimeTab.tsx',
  'components/core/VisitationTab.tsx',
  'components/fitness/NotesTab.tsx',
  'components/friends/PlacesTab.tsx',
];
{
  let pakai = 0;
  const sisa = [];
  for (const f of F) {
    const s = baca(f);
    if (/<EditFooter/.test(s) &&
        /import \{ EditFooter \} from '@\/components\/common\/EditFooter';/.test(s)) {
      pakai++;
    }
    // Pasangan lamanya tidak boleh tertinggal DI BERKAS INI.
    if (/<EditDelete\b/.test(s)) sisa.push(f);
  }
  // 14 Sep 2026 sore: sheet notulen MonthlyTab jadi layar sendiri
  // (app/core/monthly/[id].tsx) dengan pola project/edit: Hapus di ujung
  // isi (InlineDelete), Batal/Simpan di footer. Jadi tinggal 14 sheet;
  // 16 Sep 2026 sheet Idea For CORE dicabut bersama fiturnya → 13.
  c('13 sheet memakai EditFooter', pakai === 13, `${pakai}/13`);
  c('layar notulen tetap berbunyi "Hapus notulen ini" (InlineDelete, seperti project/edit)',
    /<InlineDelete\s*\n\s*label="Hapus notulen ini"/.test(baca('app/core/monthly/[id].tsx')) &&
      !/<EditFooter|<EditDelete/.test(baca('app/core/monthly/[id].tsx')));
  c('tak ada lagi <EditDelete/> yang ditulis tangan di ketujuh belasnya',
    sisa.length === 0, sisa.join(', '));

  // Bunyi tombol hapusnya TIDAK boleh ikut berubah — tiap layar punya
  // kalimatnya sendiri, dan itu memang harus begitu.
  const LABEL = {
    'app/reward.tsx': 'Hapus hadiah ini',
    'app/core-rules.tsx': 'Hapus panduan ini',
    'app/diseases.tsx': 'Hapus catatan ini',
    'app/donor.tsx': 'Hapus jadwal ini',
    'app/history.tsx': 'Hapus kejadian ini',
    'app/timeline.tsx': 'Hapus wishlist ini',
    'app/visitations.tsx': 'Hapus permanen jadwal ini',
    'components/car/LogTab.tsx': 'Hapus catatan ini',
    'components/career/AffiliateTab.tsx': 'Hapus ide ini',
    'components/career/FulltimeTab.tsx': 'Hapus prioritas ini',
    'components/core/VisitationTab.tsx': 'Hapus jadwal ini',
    'components/fitness/NotesTab.tsx': 'Hapus catatan ini',
    'components/friends/PlacesTab.tsx': 'Hapus tempat ini',
  };
  const meleset = Object.entries(LABEL).filter(
    ([f, l]) => !new RegExp(`deleteLabel="${l}"`).test(baca(f)),
  );
  c('bunyi tombol hapus tiap layar sama persis seperti sebelumnya',
    meleset.length === 0, meleset.map(([f]) => f).join(', ') || '17 label');

  // Yang tombol utamanya memang beda tidak ikut disamaratakan.
  c('Donor tetap "Tambah" saat baru, "Simpan" saat mengubah',
    /confirmLabel=\{editing === 'new' \? 'Tambah' : 'Simpan'\}/.test(
      baca('app/donor.tsx')));
  // Diperiksa dari ELEMEN <EditFooter/>-nya saja — sebagian berkas masih
  // punya sheet LAIN yang memakai <DualButtons/> sendiri, dan itu sah.
  const elemen = (f) => {
    const s = baca(f);
    const i = s.indexOf('<EditFooter');
    return i < 0 ? '' : s.slice(i, s.indexOf('/>', i) + 2);
  };
  c('yang lain tidak menulis confirmLabel lagi (ikut bawaannya)',
    F.filter((f) => f !== 'app/donor.tsx')
      .every((f) => !/confirmLabel=/.test(elemen(f))),
    F.filter((f) => f !== 'app/donor.tsx')
      .filter((f) => /confirmLabel=/.test(elemen(f)))
      .join(', ') || '16 sheet');

  // core-rules memetakan `kind` jadi {id} — pemetaan itu harus ikut terbawa.
  c('core-rules tetap memetakan kind → {id} untuk tombol hapusnya',
    /editing=\{\s*\n\s*editing === null \|\| editing === 'new' \? editing : \{ id: editing\.kind \}\s*\n\s*\}/.test(
      baca('app/core-rules.tsx')));
}

// =====================================================================
console.log('\n=== 5. Impor yang jadi nganggur ikut dibuang ===');
// =====================================================================
{
  const masihPakaiDual = F.filter((f) => /<DualButtons/.test(baca(f)));
  const imporSalah = F.filter((f) => {
    const s = baca(f);
    const impor = /import \{ DualButtons \}/.test(s);
    return impor !== /<DualButtons/.test(s);
  });
  c('DualButtons cuma diimpor kalau memang masih dipakai sendiri',
    imporSalah.length === 0, imporSalah.join(', '));
  c('(sebagian memang masih punya sheet lain yang memakainya)',
    masihPakaiDual.length > 0, masihPakaiDual.join(', ') || 'tidak ada');
  const imporEd = F.filter((f) => /import \{ EditDelete \}/.test(baca(f)));
  c('EditDelete tak lagi diimpor di ketujuh belasnya',
    imporEd.length === 0, imporEd.join(', '));
  // Komponen aslinya TIDAK dihapus — dipakai EditFooter, dan itu satu-satunya
  // pemakainya sekarang.
  c('EditDelete & DualButtons tetap ada sebagai komponen',
    fs.existsSync(R + 'components/common/EditDelete.tsx') &&
      fs.existsSync(R + 'components/common/DualButtons.tsx'));
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);