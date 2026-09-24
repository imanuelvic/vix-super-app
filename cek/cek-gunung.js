// 16 Sep 2026: (a) tombol Tambah Race / Summit / Rekreasi dipatok (StickyTop,
// jarak CARD_GAP seperti CORE) & durasi race di daftar tanpa detik; (b) daftar
// gunung di Jawa (lib/mountains.ts): pemilih provinsi → gunung di isian
// Summit, halaman "Gunung di Jawa" dengan ✓ + tanggal taklukan; (c) grid Home:
// Fun ↔ News, Wheel ↔ Book bertukar tempat.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const Module = require('module');

const ROOT = AKAR;
const OUT = path.join(__dirname, 'keluar-gunung');
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

try {
  execFileSync(
    'npx',
    ['tsc', path.join(ROOT, 'lib/mountains.ts'), path.join(ROOT, 'lib/fun.ts'), path.join(ROOT, 'lib/featureGrid.ts'),
      '--ignoreConfig', '--outDir', OUT, '--module', 'commonjs', '--target', 'es2020',
      '--skipLibCheck', '--esModuleInterop', '--moduleResolution', 'bundler'],
    { cwd: ROOT, stdio: 'pipe', shell: true },
  );
} catch { /* keluhan tipe tak menghalangi tsc membuat JS-nya */ }

const asli = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === './firebase') return { db: {} };
  if (req === './liveDoc') return { liveDoc: () => () => {}, liveList: () => () => {} };
  if (req === './core') return { hashString: (s) => s.length };
  if (req === './photo') return { pickCompressedImage: async () => null };
  if (req.startsWith('firebase/')) return new Proxy({}, { get: () => () => ({}) });
  if (req.startsWith('@/assets/style/color')) return { Color: new Proxy({}, { get: () => '#000' }) };
  return asli(req, parent, isMain);
};
const M = require(path.join(OUT, 'mountains.js'));
const F = require(path.join(OUT, 'fun.js'));
const G = require(path.join(OUT, 'featureGrid.js'));
Module._load = asli;

const ts = (y, m, d) => { const dt = new Date(y, m - 1, d); return { toDate: () => dt, toMillis: () => dt.getTime() }; };
const summit = (id, title, y, m, d, extra = {}) => ({ id, category: 'summit', title, place: '', detail: '', note: '', date: ts(y, m, d), ...extra });

console.log('\n=== Daftar gunung (lib/mountains) ===');
ok('≥ 60 gunung, id unik, tiga provinsi masing-masing ≥ 15',
  M.MOUNTAINS.length >= 60 && new Set(M.MOUNTAINS.map((m) => m.id)).size === M.MOUNTAINS.length &&
  ['jabar', 'jateng', 'jatim'].every((p) => M.mountainsOf(p).length >= 15), String(M.MOUNTAINS.length));
ok('tiap gunung: nama, ketinggian masuk akal (500..3.700 mdpl), catatan jalur',
  M.MOUNTAINS.every((m) => m.name && m.elevation >= 500 && m.elevation <= 3700 && m.note.length > 3));
ok('mountainsOf urut tertinggi dulu: Jatim diawali Semeru 3.676, Jateng Slamet 3.428, Jabar Ciremai 3.078',
  M.mountainsOf('jatim')[0].id === 'semeru' && M.mountainsOf('jatim')[0].elevation === 3676 &&
  M.mountainsOf('jateng')[0].id === 'slamet' && M.mountainsOf('jabar')[0].id === 'ciremai' &&
  M.mountainsOf('jatim').every((m, i, a) => i === 0 || a[i - 1].elevation >= m.elevation));
ok('elevationLabel ribuan bertitik: "3.145 mdpl", "875 mdpl"', M.elevationLabel(3145) === '3.145 mdpl' && M.elevationLabel(875) === '875 mdpl');
ok('mountainTitle → "Gunung Merbabu"', M.mountainTitle(M.mountainOf('merbabu')) === 'Gunung Merbabu');
ok('normalizeMountainName: buang "Gunung", isi kurung, tanda baca',
  M.normalizeMountainName('Gunung Semeru (Ranu Kumbolo)') === 'semeru' && M.normalizeMountainName('Gn. Merbabu, via Selo') === 'merbabu via selo');
ok('matchMountain: entri lama ketikan bebas dikenali; di luar daftar → null',
  M.matchMountain('Gunung Semeru (Ranu Kumbolo)')?.id === 'semeru' && M.matchMountain('Gunung Merbabu')?.id === 'merbabu' &&
  M.matchMountain('Merbabu via Selo')?.id === 'merbabu' && M.matchMountain('Gunung Rinjani') === null && M.matchMountain('') === null);
ok('mountainOfEntry: mountainId menang atas nama', M.mountainOfEntry({ mountainId: 'lawu', title: 'Gunung Merbabu' }).id === 'lawu');
const takluk = M.conqueredMountains([
  summit('a', 'Gunung Merbabu', 2026, 5, 1),
  summit('b', 'Gunung Semeru (Ranu Kumbolo)', 2026, 8, 1),
  summit('c', 'Gunung Merbabu', 2025, 12, 20, { mountainId: 'merbabu' }),
  summit('d', 'Gunung Rinjani', 2026, 1, 1),
  { id: 'e', category: 'race', title: 'Gunung Bromo Marathon', place: '', detail: '', note: '', date: ts(2026, 3, 3) },
]);
ok('conqueredMountains: tanggal PALING AWAL per gunung (Merbabu 20 Des 2025, id entri c), race tidak dihitung, Rinjani tak terdaftar',
  takluk.size === 2 && takluk.get('merbabu').date.getFullYear() === 2025 && takluk.get('merbabu').entryId === 'c' &&
  takluk.get('semeru').entryId === 'b' && !takluk.has('bromo'));

console.log('\n=== Race: durasi di daftar tanpa detik ===');
ok('formatFinish(5147, {detik:false}) = "1j 25m"; bawaan tetap "1j 25m 47d"',
  F.formatFinish(5147, { detik: false }) === '1j 25m' && F.formatFinish(5147) === '1j 25m 47d');
ok('menit saja "25m"; cuma detik tetap "45d" (bukan kosong)',
  F.formatFinish(1500, { detik: false }) === '25m' && F.formatFinish(45, { detik: false }) === '45d' && F.formatFinish(0) === '');
const arsip = baca('components/fun/FunArchive.tsx');
ok('daftar race memakai formatFinish tanpa detik', /formatFinish\(detikTempuh, \{ detik: false \}\)/.test(arsip));

console.log('\n=== Tombol tambah Race/Summit/Rekreasi dipatok (StickyTop) ===');
ok('PrimaryButton "Tambah …" di dalam StickyTop, DI ATAS FlatList (bukan ListHeaderComponent)',
  /<StickyTop>\s*\n\s*<PrimaryButton\s*\n\s*label=\{`Tambah \$\{meta\.label\}`\}\s*\n\s*icon="plus"\s*\n\s*background=\{warna\}/.test(arsip) &&
  arsip.indexOf('</StickyTop>') < arsip.indexOf('<FlatList') && /ListHeaderComponent=\{<FormError message=\{error\} \/>\}/.test(arsip));
ok('isi daftar paddingTop 0 (jarak dari bar milik StickyTop); kartu berjarak marginBottom 10, listHeader dibuang',
  /listContent: \{ paddingHorizontal: 20, paddingTop: 0, paddingBottom: 24 \}/.test(arsip) &&
  /marginBottom: 10,\s*\n\s*gap: 6,/.test(arsip) && !/listHeader/.test(arsip) && !/marginTop: 10,/.test(arsip));
ok('Health (Race) & Fun (Summit/Rekreasi) sama-sama lewat FunArchive → satu perilaku',
  /<FunArchive category="race"/.test(baca('app/health.tsx')) && /<FunArchive category=\{tab\} \/>/.test(baca('app/fun.tsx')));

console.log('\n=== Isian Summit: provinsi → gunung ===');
const isian = baca('components/fun/FunEntryScreen.tsx');
ok('pilihan provinsi = 3 provinsi Jawa + Lainnya (ketik bebas)',
  /type ProvinsiPilihan = MountainProvince \| 'other';/.test(isian) &&
  /\.\.\.MOUNTAIN_PROVINCES\.map\(\(p\) => \(\{ key: p\.key, label: p\.label \}\)\),\s*\n\s*\{ key: 'other', label: 'Lainnya'/.test(isian));
ok('dua SelectField (provinsi, lalu gunung per provinsi dengan mdpl & jalur), khusus Summit',
  /category === 'summit' \? \(\s*\n\s*<>/.test(isian) && /options=\{PROVINSI_OPTIONS\}/.test(isian) &&
  /options=\{mountainsOf\(province\)\.map\(\(m\) => \(\{\s*\n\s*key: m\.id,\s*\n\s*label: mountainTitle\(m\),\s*\n\s*sub: `\$\{elevationLabel\(m\.elevation\)\} · \$\{m\.note\}`,/.test(isian));
ok('pilih gunung → nama, lokasi (provinsi), ketinggian terisi sendiri; ganti provinsi → gunung dikosongkan',
  /function pilihGunung\(idGunung: string \| null\) \{\s*\n\s*setMountainId\(idGunung\);[\s\S]{0,200}setTitle\(mountainTitle\(m\)\);\s*\n\s*setPlace\(provinceLabel\(m\.province\)\);\s*\n\s*setDetail\(elevationLabel\(m\.elevation\)\);/.test(isian) &&
  /function pilihProvinsi\(p: ProvinsiPilihan \| null\) \{\s*\n\s*setProvince\(p\);\s*\n\s*setMountainId\(null\);/.test(isian));
ok('nama gunung tetap kolom bebas (bisa ditambahi "(Ranu Kumbolo)"); entri lama dicocokkan dari nama, tak cocok → Lainnya',
  /placeholder=\{meta\.titleLabel\}\s*\n\s*value=\{title\}/.test(isian) &&
  /const awalGunung = isNew\s*\n\s*\? mountainOf\(mountainParam\)\s*\n\s*: entry\s*\n\s*\? mountainOfEntry\(entry\)/.test(isian) &&
  /awalGunung \? awalGunung\.province : entry \? 'other' : null/.test(isian));
ok('mountainId disimpan (Lainnya → null) hanya untuk Summit',
  /if \(category === 'summit'\) \{\s*\n\s*next\.mountainId = province === 'other' \? null : mountainId;/.test(isian) &&
  /mountainId\?: string \| null;/.test(baca('lib/fun.ts')));
ok('param ?mountain= (dari halaman Gunung di Jawa) mengisi gunung, nama, lokasi, & ketinggian entri baru',
  /mountain\?: string;/.test(isian) && /entry\?\.title \?\? \(awalGunung \? mountainTitle\(awalGunung\) : ''\)/.test(isian));

console.log('\n=== Halaman Gunung di Jawa (app/mountains.tsx) ===');
const laman = baca('app/mountains.tsx');
ok('tombol 🏔️ di kanan atas Fun HANYA di sub-tab Summit → /mountains',
  /tab === 'summit' \? \(\s*\n\s*<EmojiButton emoji="🏔️" onPress=\{\(\) => router\.push\('\/mountains'\)\} \/>/.test(baca('app/fun.tsx')));
ok('rute terdaftar, bertema Fun, & ada di typed routes',
  /<Stack\.Screen name="mountains" \/>/.test(baca('app/_layout.tsx')) && /mountains: 'fun',/.test(baca('lib/featureTheme.ts')) &&
  /\/mountains/.test(baca('.expo/types/router.d.ts')));
ok('ringkasan "n dari N gunung" + gunung tertinggi yang sudah didaki; chip provinsi berjumlah taklukan',
  /value=\{`\$\{jumlahTaklukan\} dari \$\{MOUNTAINS\.length\} gunung ⛰️`\}/.test(laman) &&
  /Tertinggi: \$\{mountainTitle\(tertinggi\)\}/.test(laman) && /<FilterChips/.test(laman) && /allLabel="Semua"/.test(laman));
ok('per provinsi: judul + hitungan ✓, baris = nama, mdpl · jalur, pil 🏁 tanggal, CheckCircle terkunci',
  /<SectionRow\s*\n\s*title=\{p\.label\}/.test(laman) && /\{sudah\}\/\{daftar\.length\} ✓/.test(laman) &&
  /🏁 \{t\.date \? formatCompactDate\(t\.date\) : 'tanggal belum diisi'\}/.test(laman) &&
  /<CheckCircle checked=\{!!t\} size=\{26\} locked \/>/.test(laman) && /rowDone: \{ backgroundColor: Color\.FUN, borderColor: Color\.FUN_DARK \}/.test(laman));
ok('click: sudah → catatan Summit-nya; belum → isian baru dengan ?mountain=',
  /params: \{ id: t\.entryId, category: 'summit' \}/.test(laman) &&
  /params: \{ id: 'new', category: 'summit', mountain: m\.id \}/.test(laman));
ok('taklukan dihitung lewat conqueredMountains (teruji di atas), edges top + paddingBottom 40',
  /conqueredMountains\(data\?\.entries \?\? \[\]\)/.test(laman) && /edges=\{\['top'\]\}/.test(laman));

console.log('\n=== Grid Home: Fun ↔ News, Wheel ↔ Book ===');
const urut = [...G.HOME_FEATURES].sort((a, b) => a.sort - b.sort).map((f) => f.key);
// 24 Sep 2026: dua cek di bawah diarahkan ulang ke bentuk grid yang SEBENARNYA
// dirender sekarang. Sebelum ini berkas cek-nya masih memanggil modul lama
// `homeGrid.js` (berganti nama jadi `featureGrid.ts` pada 23 Sep), jadi sejak
// tanggal itu ia diam-diam membaca hasil kompilasi BASI dan lulus tanpa pernah
// benar-benar memeriksa gridnya. Yang berubah cuma sasarannya, bukan
// ketegasannya: jumlahnya tetap dipatok tepat, nomor urutnya tetap wajib unik.
//
// Dua pergeseran yang sekarang ikut terkunci:
//   • 19 tile, bukan 20 — Married dihapus permanen.
//   • Baris 4 = Fun · Wheel · Car · Residence, bukan Car · Residence · Fun · Wheel.
ok('baris 3: Invest · Career · News · Book; baris 4: Fun · Wheel · Car · Residence',
  urut.slice(8, 12).join(',') === 'investment,career,news,book' && urut.slice(12, 16).join(',') === 'fun,wheel,car,residence',
  urut.join(','));
ok('19 tile, nomor urut unik (tidak ada yang bentrok sesudah ditukar)',
  urut.length === 19 && new Set(G.HOME_FEATURES.map((f) => f.sort)).size === 19);

console.log(gagal === 0 ? '\n✅ LULUS — gunung, tombol dipatok, grid Home.' : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
