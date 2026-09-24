// 14 Sep 2026 — Health › Race: "saat di-click, bukan kebuka modal, tetapi
// kebuka halaman baru sendiri, dan ada avoid keyboard jangan lupa."
//
// Formnya PINDAH, bukan disalin: sheet di FunArchive dibuang, dan satu layar
// (components/fun/FunEntryScreen.tsx) melayani Race, Summit, & Rekreasi
// sekaligus lewat dua pintu — app/race/[id] (pita Health) & app/fun/[id]
// (pita Fun). Yang dijaga suite ini: pintunya benar, formnya utuh, sheetnya
// benar-benar habis, dan keyboard-nya dihindari.
const AKAR = require('./akar');
const fs = require('fs');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra ? `  → ${extra}` : ''));
};

const layar = baca('components/fun/FunEntryScreen.tsx');
const arsip = baca('components/fun/FunArchive.tsx');
const pintuRace = baca('app/race/[id].tsx');
const pintuFun = baca('app/fun/[id].tsx');
const tema = baca('lib/featureTheme.ts');
const tataletak = baca('app/_layout.tsx');
const rute = baca('.expo/types/router.d.ts');

// =====================================================================
console.log('=== 1. Click kartu / Tambah → halaman, bukan sheet ===');
// =====================================================================
{
  c('FunArchive tidak lagi memakai SheetModal sama sekali',
    !/SheetModal/.test(arsip));
  c('tidak ada lagi state form yang tertinggal di daftar',
    !/formOpen|editingId|setTitle|setMedalPhoto|handleSave|handleDelete/.test(arsip));
  c('click kartu → pindah layar', /onPress=\{\(\) => bukaIsian\(item\.id\)\}/.test(arsip));
  c('click "Tambah" → layar yang sama dengan id "new"',
    /onPress=\{\(\) => bukaIsian\('new'\)\}/.test(arsip));

  // Pintunya dipilih dari kategori — dan alasannya warna pita.
  c('Race lewat /race (pita Health), sisanya lewat /fun (pita Fun)',
    /if \(category === 'race'\) \{\s*\n\s*router\.push\(\{ pathname: '\/race\/\[id\]', params: \{ id \} \}\);/.test(arsip) &&
      /router\.push\(\{ pathname: '\/fun\/\[id\]', params: \{ id, category \} \}\);/.test(arsip));
}

// =====================================================================
console.log('\n=== 2. Dua pintu, SATU layar ===');
// =====================================================================
{
  c('app/race/[id] cuma membungkus FunEntryScreen dengan kategori race',
    /<FunEntryScreen category="race" \/>/.test(pintuRace) &&
      pintuRace.split('\n').filter((l) => l.trim() && !l.trim().startsWith('//')).length <= 6);
  c('app/fun/[id] cuma membungkus FunEntryScreen (kategori dari param)',
    /<FunEntryScreen \/>/.test(pintuFun));
  c('warna pita: race → health', /^\s*race: 'health',/m.test(tema));
  c('kedua rute terdaftar di Stack',
    /<Stack\.Screen name="race\/\[id\]" \/>/.test(tataletak) &&
      /<Stack\.Screen name="fun\/\[id\]" \/>/.test(tataletak));
  c('typed routes sudah mengenal keduanya (router.push tidak ditolak tsc)',
    /race\/\[id\]/.test(rute) && /fun\/\[id\]/.test(rute));

  // Kategori dari param DIJALANKAN: yang tak dikenal jatuh ke Rekreasi, dan
  // kategori yang dipatok pintunya (race) menang atas param apa pun.
  const m = layar.match(
    /const category: FunCategory =\s*\n?\s*kategoriTetap \?\?\s*\n?\s*\((.+?)\);/,
  );
  c('penentu kategori terbaca dari sumbernya', !!m, m?.[1]);
  if (m) {
    const tentukan = new Function(
      'kategoriTetap', 'kategoriParam', 'KATEGORI',
      `return kategoriTetap ?? (${m[1]});`,
    );
    const K = ['summit', 'race', 'reflection', 'recreation'];
    c('param "summit" → summit', tentukan(undefined, 'summit', K) === 'summit');
    c('param ngawur → jatuh ke Rekreasi, bukan crash',
      tentukan(undefined, 'apa-ini', K) === 'recreation');
    c('tanpa param → Rekreasi', tentukan(undefined, undefined, K) === 'recreation');
    c('pintu race menang walau param bilang lain',
      tentukan('race', 'summit', K) === 'race');
  }
}

// =====================================================================
console.log('\n=== 3. Keyboard dihindari, tombol tetap terlihat ===');
// =====================================================================
{
  // "ada avoid keyboard jangan lupa" — inilah jawabannya.
  c('isiannya di dalam KeyboardAwareScrollView',
    /<KeyboardAwareScrollView contentContainerStyle=\{styles\.content\}>/.test(layar));
  c('Batal/Simpan dipatok di footer, di luar gulungan',
    // 16 Sep 2026: footer menambahkan insets.bottom sendiri (edges top saja).
    /<\/KeyboardAwareScrollView>\s*\n\s*<View style=\{\[styles\.footer, \{ paddingBottom: Math\.max\(insets\.bottom, 12\) \}\]\}>\s*\n\s*<DualButtons/.test(layar));
  c('kolom pertama fokus otomatis HANYA saat menambah',
    /autoFocus=\{isNew\}/.test(layar));
}

// =====================================================================
console.log('\n=== 4. Formnya utuh — tidak ada kolom yang hilang saat pindah ===');
// =====================================================================
{
  for (const [apa, pola] of [
    ['nama (label ikut kategorinya)', /placeholder=\{meta\.titleLabel\}/],
    ['lokasi', /placeholder="Lokasi \(opsional\)"/],
    ['detail (label ikut kategorinya)', /placeholder=\{meta\.detailLabel\}/],
    ['tanggal', /<DateField value=\{date\} onChange=\{setDate\} \/>/],
    ['catatan', /placeholder="Catatan \(opsional\)"/],
    ['Race: harga pendaftaran', /placeholder="Harga pendaftaran"/],
    // Waktu tempuh kini tiga kolom (jam · menit · detik), disimpan detik utuh.
    ['Race: jarak (km)', /placeholder="Jarak \(km\), mis\. 10 atau 21,1"/],
    ['Race: waktu tempuh jam·menit·detik (angka saja, 2 digit)',
      /onChangeText=\{\(t\) => ubah\(t\.replace\(\/\[\^0-9\]\/g, ''\)\.slice\(0, 2\)\)\}/],
    ['Race: pace dihitung app, bukan diketik', /const pace = racePace\(finishSec, parseDecimal\(distance\)\);/],
    ['Race: foto medali', /Tambah Foto Medali/],
    ['Race: hapus foto', /onPress=\{\(\) => setMedalPhoto\(null\)\}/],
    ['Summit: 5 kolom anggaran', /Jasa OT[\s\S]*Sewa barang[\s\S]*Transportasi[\s\S]*SIMAKSI[\s\S]*Lain-lain/],
    ['Summit: total anggaran live', /\{formatRupiah\(summitBudgetLive\)\}/],
  ]) {
    c(`kolom ${apa}`, pola.test(layar));
  }

  // Field khusus HANYA ditulis untuk kategorinya — tak ada key undefined ke
  // Firestore pada kategori lain.
  c('field Race hanya ditulis untuk race',
    /if \(category === 'race'\) \{\s*\n\s*next\.price = parseAmount\(price\);/.test(layar));
  c('field Summit hanya ditulis untuk summit',
    // 16 Sep 2026: gunung dari daftar (mountainId) ikut ditulis, sebelum anggaran.
    /if \(category === 'summit'\) \{\s*\n\s*next\.mountainId = [^;]+;\s*\n\s*next\.costOT = parseAmount\(costOT\);/.test(layar));
  c('nama wajib diisi — pesannya menyebut label kategorinya',
    /setError\(`Isi \$\{meta\.titleLabel\.toLowerCase\(\)\} dulu\.`\)/.test(layar));
  c('hapus hanya saat mengedit, konfirmasi inline seperti layar lain',
    /\{!isNew && \(\s*\n\s*<InlineDelete/.test(layar));
  // Tiga jalan keluar, satu tujuan: daftar di belakangnya. Simpan & hapus
  // memanggilnya sesudah Firestore menjawab; Batal langsung.
  c('simpan & hapus sama-sama kembali ke daftar',
    (layar.match(/router\.back\(\);/g) || []).length === 2 &&
      /onCancel=\{\(\) => router\.back\(\)\}/.test(layar));
}

// =====================================================================
console.log('\n=== 5. Isi awal MENYUSUL tanpa setState di efek ===');
// =====================================================================
{
  // Data Firestore datang sesudah layar terbuka. useDraft membuat kolomnya
  // ikut data itu sampai diketik — tanpa useEffect yang mengisi state.
  c('semua kolom lewat useDraft', (layar.match(/useDraft/g) || []).length >= 13);
  // Satu-satunya efek di layar ini adalah langganan Firestore — setState-nya
  // ada di CALLBACK (dipanggil saat data tiba), bukan di badan efek. Dipaku
  // bentuk utuhnya, jadi efek kedua yang mengisi state akan langsung ketahuan.
  // 16 Sep 2026: langganannya lewat useLive → layar ini tanpa useEffect.
  c('langganan lewat useLive; tak ada useEffect (apalagi setState di badannya)',
    (layar.match(/useEffect\(/g) || []).length === 0 &&
      /useLive<FunData>\(subscribeFun, \{ onError: setError \}\)/.test(layar));
  c('entri lama ditunggu dulu sebelum formnya digambar',
    /const loading = !isNew && data === null;/.test(layar));

  // rupiahDraft dijalankan: nol/undefined → kolom kosong, bukan "0".
  const m = layar.match(/const rupiahDraft = (\(n\?: number\) => .+);/);
  c('pengubah angka→teks uang terbaca', !!m);
  if (m) {
    const groupDigits = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const f = new Function('groupDigits', `return ${m[1].replace(/\(n\?: number\)/, '(n)')};`)(groupDigits);
    c('undefined → kolom kosong', f(undefined) === '');
    c('0 → kolom kosong (bukan "0")', f(0) === '');
    c('300000 → "300.000"', f(300000) === '300.000', f(300000));
  }
}

// =====================================================================
console.log('\n=== 6. Tidak ada salinan kedua ===');
// =====================================================================
{
  // Kalau form-nya masih ada di dua tempat, perubahan berikutnya cuma sampai
  // di salah satunya.
  const berkas = [];
  (function sisir(dir) {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) sisir(p);
      else if (/\.tsx?$/.test(e.name)) berkas.push(p);
    }
  })('app');
  (function sisir(dir) {
    for (const e of fs.readdirSync(R + dir, { withFileTypes: true })) {
      const p = dir + '/' + e.name;
      if (e.isDirectory()) sisir(p);
      else if (/\.tsx?$/.test(e.name)) berkas.push(p);
    }
  })('components');
  const punyaFormMedali = berkas.filter((f) => /Tambah Foto Medali/.test(baca(f)));
  c('form medali cuma ada di satu berkas',
    punyaFormMedali.length === 1 && punyaFormMedali[0] === 'components/fun/FunEntryScreen.tsx',
    punyaFormMedali.join(', '));
}

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);
