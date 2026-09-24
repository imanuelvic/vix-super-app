// Bukti fitur Freelance yang baru:
//   1. Click kartu → HALAMAN RINCIAN (baca-saja), bukan modal isian.
//   2. Tombol ✏️ (EditButton bersama) → layar isian tersendiri.
//   3. Tiap item invoice punya PERKIRAAN harga satuan — terisi otomatis saat
//      dipilih, dan tetap disebut di placeholder & halaman rincian.
//
// lib/invoice.ts dijalankan beneran (modul native distub), sisanya cek kode.

const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(os.tmpdir(), 'cek-proyek-out');

let lulus = 0;
const gagal = [];
function ok(nama, syarat, info = '') {
  if (syarat) lulus++;
  else gagal.push(nama + (info ? ` — ${info}` : ''));
}

const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
// Buang komentar dulu — jangan sampai lolos gara-gara kalimat penjelasan.
const kodeSaja = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ================= 1. lib/invoice.ts dijalankan =================
try {
  execFileSync(
    'npx',
    [
      'tsc',
      path.join(ROOT, 'lib/invoice.ts'),
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
  // tsc mengeluh soal modul native — .js-nya tetap ditulis.
}

const aslinya = Module._load;
Module._load = function (permintaan, induk, isMain) {
  if (permintaan === './firebase') return { db: {} };
  if (permintaan === './liveDoc') return { liveDoc: () => () => {} };
  if (permintaan === './pdfDoc') {
    return { escapeHtml: (s) => String(s), sharePdf: async () => {} };
  }
  if (permintaan.startsWith('firebase/')) {
    return { doc: () => ({}), setDoc: async () => {}, deleteField: () => null };
  }
  if (/^expo-|^@react-native|^react-native/.test(permintaan)) return {};
  return aslinya(permintaan, induk, isMain);
};
const INV = require(path.join(OUT, 'invoice.js'));
Module._load = aslinya;

ok('INVOICE_PRESETS masih 8 item', INV.INVOICE_PRESETS.length === 8);
ok(
  'SEMUA item punya perkiraan harga > 0',
  INV.INVOICE_PRESETS.every(
    (p) => typeof p.price === 'number' && Number.isFinite(p.price) && p.price > 0,
  ),
  INV.INVOICE_PRESETS.filter((p) => !(p.price > 0))
    .map((p) => p.desc)
    .join(', '),
);
ok(
  'harganya bilangan bulat rupiah (bukan pecahan)',
  INV.INVOICE_PRESETS.every((p) => Number.isInteger(p.price)),
);
ok(
  'deskripsinya tidak berubah (id item lama tetap cocok)',
  INV.INVOICE_PRESETS.map((p) => p.desc).join('|') ===
    [
      'Jasa Pembuatan Website',
      'Jasa Pembuatan Aplikasi',
      'Maintenance (per bulan)',
      'Administrasi (per bulan)',
      'Pemasaran & SEO (per bulan)',
      'Lisensi & Tema',
      'Domain (.id / .com)',
      'Hosting',
    ].join('|'),
);
ok(
  'tidak ada deskripsi kembar (presetPrice tak mungkin ambigu)',
  new Set(INV.INVOICE_PRESETS.map((p) => p.desc.toLowerCase())).size === 8,
);

// presetPrice: ketemu apa adanya, beda huruf besar/kecil, & berspasi
for (const p of INV.INVOICE_PRESETS) {
  ok(`presetPrice("${p.desc}") = ${p.price}`, INV.presetPrice(p.desc) === p.price);
}
ok(
  'presetPrice tak peduli huruf besar/kecil',
  INV.presetPrice('jasa pembuatan website') === 7_500_000 &&
    INV.presetPrice('HOSTING') === 1_200_000,
);
ok('presetPrice memangkas spasi', INV.presetPrice('  Hosting  ') === 1_200_000);
ok(
  'item yang diketik sendiri → 0 (bukan undefined/NaN)',
  INV.presetPrice('Rapat di kafe') === 0 && INV.presetPrice('') === 0,
);

// ================= 2. Daftar Freelance: view + tombol pensil =================
const fre = kodeSaja(baca('components/career/FreelanceTab.tsx'));

ok(
  'daftar TIDAK lagi punya modal isian',
  !/SheetModal/.test(fre) && !/DualButtons/.test(fre),
);
ok(
  'state form ikut hilang dari daftar (nama/client/fee/deadline/items)',
  !/setFName|setFClient|setFFee|setFDeadline|setFItems|setFDone/.test(fre),
);
ok(
  'daftar tidak lagi menulis ke Firestore',
  !/saveFreelance/.test(fre),
);
ok(
  'click kartu → halaman rincian /project/[id]',
  /const openDetail = useCallback\(\s*\(p: FreelanceProject\) =>\s*router\.push\(\{ pathname: '\/project\/\[id\]', params: \{ id: p\.id \} \}\)/.test(
    fre,
  ),
);
ok(
  'tombol pensil = EditButton bersama (bukan bikin sendiri)',
  /from '@\/components\/common\/EditButton'/.test(fre) && /<EditButton/.test(fre),
);
ok(
  'pensil → layar isian /project/edit/[id] proyek itu',
  /<EditButton[\s\S]{0,220}pathname: '\/project\/edit\/\[id\]',\s*\n?\s*params: \{ id: p\.id \}/.test(
    fre,
  ),
);
ok(
  '"Tambah Proyek" juga ke layar isian, dengan id "new"',
  /label="Tambah Proyek"[\s\S]{0,200}pathname: '\/project\/edit\/\[id\]', params: \{ id: 'new' \}/.test(
    fre,
  ),
);

// Aturan iOS: tombol harus SAUDARA area click, bukan anaknya.
const iTap = fre.indexOf('style={styles.cardTap}');
const iTutupTap = fre.indexOf('</PressableScale>', iTap);
ok('area click kartunya ketemu', iTap > -1 && iTutupTap > iTap);
ok(
  'EditButton TIDAK bersarang di dalam area click (Pressable bersarang ≠ andal di iOS)',
  iTap > -1 && !fre.slice(iTap, iTutupTap).includes('EditButton'),
);
ok(
  'EditButton duduk di kolom kanan kartu, sesudah area click',
  fre.indexOf('<EditButton', iTutupTap) > iTutupTap,
);

// ================= 3. Halaman rincian: baca-saja =================
const det = kodeSaja(baca('app/project/[id].tsx'));

ok(
  'halaman rincian TIDAK punya isian apa pun (baca-saja)',
  !/FormInput|MoneyInput|DateField|CheckCircle|DualButtons/.test(det),
);
ok(
  'halaman rincian tidak menulis ke Firestore',
  !/saveFreelance/.test(det),
);
ok(
  'pensil di kanan atas header → layar isian',
  /right=\{\s*<EditButton[\s\S]{0,200}pathname: '\/project\/edit\/\[id\]'/.test(det),
);
ok(
  'menampilkan rincian biaya: qty × harga satuan = jumlah',
  /\{it\.qty\} × \{formatRupiah\(it\.price\)\}/.test(det) &&
    /formatRupiah\(it\.qty \* it\.price\)/.test(det),
);
ok(
  'harga yang belum diisi tetap menyebut PERKIRAAN-nya',
  /it\.price === 0 && perkiraan > 0/.test(det) &&
    /Perkiraan \{formatRupiah\(perkiraan\)\}/.test(det),
);
ok(
  'rincian masih kosong → daftar perkiraan tarif ditampilkan',
  /items\.length === 0[\s\S]{0,900}INVOICE_PRESETS\.map/.test(det),
);
ok(
  'invoice PDF dibuat dari data TERSIMPAN',
  /shareInvoicePdf\(project\)/.test(det),
);
ok(
  'proyek yang sudah dihapus tidak jadi halaman kosong',
  /Proyek ini sudah tidak ada/.test(det),
);
ok(
  'menunggu data dulu sebelum menggambar (tidak berkedip kosong)',
  /projects === null[\s\S]{0,200}<LoadingCenter/.test(det),
);

// ================= 4. Layar isian =================
const edit = kodeSaja(baca('app/project/edit/[id].tsx'));

// Ambil ISI tiap useEffect (sampai penutup "}, [") — jangan asal jarak
// karakter, deklarasi useDraft di bawahnya ikut kena.
const isiEfek = [...edit.matchAll(/useEffect\(\(\) => \{([\s\S]*?)\n  \}, \[/g)].map(
  (m) => m[1],
);
// 16 Sep 2026: langganannya pindah ke useLive, jadi layar ini TANPA useEffect
// sama sekali — dan memang tak boleh ada setState di badan efek mana pun.
ok(
  'isian memakai useDraft — bukan setState di dalam useEffect',
  /from '@\/hooks\/useDraft'/.test(edit) &&
    isiEfek.every((isi) => !/setF[A-Z]/.test(isi)),
);
ok(
  'langganan Firestore lewat useLive (bukan useEffect tulis tangan)',
  (edit.match(/useEffect\(/g) ?? []).length === 0 &&
    /useLive<FreelanceProject\[\]>\(subscribeFreelance, \{\s*onError: setError,?\s*\}\)/.test(
      edit,
    ),
);
ok('id "new" = tambah proyek baru', /const isNew = id === 'new';/.test(edit));
ok(
  'item preset langsung membawa perkiraan harganya',
  /addPresetItem\(desc: string, price: number\)/.test(edit) &&
    /price: groupDigits\(String\(price\)\)/.test(edit) &&
    /onPress=\{\(\) => addPresetItem\(p\.desc, p\.price\)\}/.test(edit),
);
ok(
  'chip preset menuliskan harganya',
  /label=\{`\+ \$\{p\.desc\} · \$\{formatShortRupiah\(p\.price\)\}`\}/.test(edit),
);
ok(
  'placeholder harga satuan menyebut perkiraannya',
  /perkiraan > 0[\s\S]{0,120}est\. \$\{formatRupiah\(perkiraan\)\}/.test(edit),
);
ok(
  'proyek lama: tunggu datanya dulu, jangan tampil kosong',
  /const loading = !isNew && projects === null;/.test(edit),
);
ok(
  'hapus proyek: permanen (tulis ulang daftar tanpa proyek itu)',
  /saveFreelance\(\s*user\.uid,\s*\(projects \?\? \[\]\)\.filter\(\(p\) => p\.id !== id\),\s*\)/.test(
    edit,
  ) && !/isDeleted|archived/.test(edit),
);
ok(
  'sesudah dihapus tidak balik ke halaman rincian yang sudah kosong',
  /router\.dismissTo\('\/work'\)/.test(edit),
);

// ================= 5. Rute terdaftar =================
const layout = kodeSaja(baca('app/_layout.tsx'));
ok(
  'kedua layar didaftarkan di Stack',
  /<Stack\.Screen name="project\/\[id\]" \/>/.test(layout) &&
    /<Stack\.Screen name="project\/edit\/\[id\]" \/>/.test(layout),
);
const tipe = baca('.expo/types/router.d.ts');
ok(
  'typed routes sudah di-regen (kalau tidak, tsc gagal di mesin lain)',
  tipe.includes('/project/[id]') && tipe.includes('/project/edit/[id]'),
);

// ---------- hasil ----------
if (gagal.length) {
  console.log('GAGAL:');
  gagal.forEach((g) => console.log('  ✗ ' + g));
  process.exitCode = 1;
} else {
  console.log(`LULUS: ${lulus} / ${lulus}`);
}
