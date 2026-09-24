// Uji dokumentasi foto rapat: model → PDF → tampilan tombol yang dipindah.
// PDF-nya benar-benar dibangun ulang memakai buildHtml() asli, dengan 3 JPEG
// SUNGGUHAN (fixture kecil dari node_modules) sebagai foto rapat.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const OUT = path.join(__dirname, 'notulen-berfoto.html');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };
const baca = (f) => fs.readFileSync(R + f, 'utf8');

// ---------- 1. Model & penyimpanan ----------
console.log('=== Model & penyimpanan (lib/core.ts) ===');
const core = baca('lib/core.ts');
c('MonthlyMeeting punya photos: string[]', /photos: string\[\];/.test(core));
c('notulen LAMA tanpa foto tidak pecah (default [])',
  /photos: \(data\.photos as string\[\]\) \?\? \[\]/.test(core));
c('photos ikut ditulis saat simpan', /setDoc\(doc\(db, 'users', uid, 'coreMonthly', id\), \{[\s\S]*?photos: data\.photos,/.test(core));
c('batas 4 foto per rapat', /MAX_MEETING_PHOTOS = 4/.test(core));
c('foto dikecilkan 640px · JPEG 50% sebelum disimpan',
  /pickCompressedImage\(\{ width: 640, compress: 0\.5 \}\)/.test(core));

console.log('\n=== Pemilih foto: SATU, tidak lagi kembar tiga ===');
const photo = baca('lib/photo.ts');
c('lib/photo.ts jadi satu-satunya pemakai ImagePicker',
  /launchImageLibraryAsync/.test(photo) &&
    !/launchImageLibraryAsync/.test(baca('lib/family.ts')) &&
    !/launchImageLibraryAsync/.test(baca('lib/fun.ts')));
c('family.ts & fun.ts tak lagi impor expo-image-picker/manipulator sendiri',
  !/^import[^\n]*expo-image-(picker|manipulator)/m.test(baca('lib/family.ts')) &&
    !/^import[^\n]*expo-image-(picker|manipulator)/m.test(baca('lib/fun.ts')));
// Nilai LAMA tiap pemanggil — harus persis sama supaya hasil fotonya tak berubah.
c('avatar Family/Profil tetap 144px · 50% · crop kotak',
  /pickCompressedImage\(\{ width: 144, compress: 0\.5, square: true \}\)/.test(baca('lib/family.ts')));
c('medali Race tetap 360px · 50% · tanpa crop',
  /pickCompressedImage\(\{ width: 360, compress: 0\.5 \}\)/.test(baca('lib/fun.ts')));
c('hanya mode square yang memakai allowsEditing + aspect 1:1',
  /square\s*\?\s*\{[\s\S]*?allowsEditing: true,[\s\S]*?aspect: \[1, 1\],[\s\S]*?\}\s*:\s*\{ mediaTypes: \['images'\], quality: 1 \}/.test(photo));

// ---------- 2. PDF ----------
console.log('\n=== PDF notulen memuat fotonya ===');
function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(mod.exports, mod, ...nama.map((n) => luar[n]));
  return mod.exports;
}

const MONTHLY_AGENDA_POINTS = [
  { key: 'mentorship', label: 'MENTORSHIP', icon: '🎓' },
  { key: 'leadersMessage', label: "LEADER'S MESSAGE", icon: '📢' },
  { key: 'ndcInfo', label: 'NDC INFORMATION', icon: 'ℹ️' },
  { key: 'core', label: 'CORE', icon: '🙏' },
  { key: 'events', label: 'OUR EVENTS', icon: '📅' },
];
const DAY = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MON = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const formatFullDate = (d) => `${DAY[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
const formatTime = (d) => `${String(d.getHours()).padStart(2,'0')}.${String(d.getMinutes()).padStart(2,'0')}`;

const LOGO_CORE_GWU_DATA_URI = /'(data:image\/png;base64,[^']+)'/.exec(baca('assets/logoCoreGwu.ts'))[1];

const pdfDoc = muat(
  baca('lib/pdfDoc.ts')
    .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '')
    .replace(/export async function sharePdf[\s\S]*$/, '') +
    '\nexport { escapeHtml, htmlParagraphs, pdfFileName, pdfShellHtml };',
  { LOGO_CORE_GWU_DATA_URI },
);
// photoUri() dipakai ASLI dari lib/photo.ts, bukan ditiru di sini — kalau
// bentuk alamatnya berubah, PDF-nya ikut berubah dan tes ini harus tahu.
// (Impor expo-nya dibuang; yang dipanggil cuma photoUri yang tak memakainya.)
const fotoLib = muat(
  baca('lib/photo.ts').replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, ''),
);
c('photoUri asli terbaca dari lib/photo.ts',
  fotoLib.photoUri('AA') === 'data:image/jpeg;base64,AA');

const monthly = muat(
  'type MonthlyMeeting = any;\n' +
    baca('lib/monthlyPdf.ts')
      .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '')
      .replace(/export function shareMonthlyPdf[\s\S]*$/, '') +
    '\nexport { buildHtml };',
  {
    MONTHLY_AGENDA_POINTS, formatFullDate, formatTime,
    escapeHtml: pdfDoc.escapeHtml,
    htmlParagraphs: pdfDoc.htmlParagraphs,
    pdfShellHtml: pdfDoc.pdfShellHtml,
    pdfFileName: pdfDoc.pdfFileName,
    sharePdf: () => {},
    photoUri: fotoLib.photoUri,
  },
);

// JPEG ASLI (fixture kecil dari node_modules) — bukan gambar palsu.
//
// Dulu memakai fixture expo-updates; berkas itu ikut hilang saat proyek naik ke
// Expo SDK 57. Diganti gambar JPEG milik devtools React Native yang isinya sama
// nyatanya — yang diuji memang "base64 dari JPEG betulan", bukan gambar apa.
const IMG = 'node_modules/@react-native/debugger-frontend/dist/third-party/front_end/Images/react_native/';
const FIXTURES = [
  `${IMG}learn-debugging-basics.jpg`,
  `${IMG}learn-native-debugging.jpg`,
  `${IMG}learn-react-native-devtools.jpg`,
];
const fotoB64 = FIXTURES.map((f) => fs.readFileSync(R + f).toString('base64'));
c('fixture-nya JPEG betulan (magic FFD8FF)',
  FIXTURES.every((f) => fs.readFileSync(R + f).subarray(0, 3).toString('hex') === 'ffd8ff'));

const dasar = {
  title: '44. Meeting MCL CL - Juli 2026',
  date: { toDate: () => new Date(2026, 6, 25, 15, 0) },
  place: 'Ruang 1, NDC Central Park',
  points: {
    mentorship: '🗒️ Materi Mentoring Bulan Juli\n\n✨ Life Update',
    leadersMessage: "🎙️ MCL's Message\n\n- Jadilah orang yang dapat di andalkan!",
    ndcInfo: '🎓 Training Calon CORE Leader Batch 3 (2026)',
    core: '🎭 What event are you holding?',
    events: '🎪 Meeting MCL CL',
  },
};

const htmlTanpa = monthly.buildHtml({ ...dasar, photos: [] });
const htmlSatu = monthly.buildHtml({ ...dasar, photos: [fotoB64[0]] });
const htmlTiga = monthly.buildHtml({ ...dasar, photos: fotoB64 });

// Catatan: CSS .foto-grid memang selalu ikut (bagian dari ISI_CSS) — yang
// diperiksa di sini isi <body>-nya, bukan lembar gayanya.
c('tanpa foto → tak ada blok dokumentasi sama sekali di isinya',
  !htmlTanpa.includes('DOKUMENTASI') &&
    !htmlTanpa.includes('<div class="foto-grid') &&
    !htmlTanpa.includes('<img src="data:image/jpeg'));
c('3 foto → 3 <img> data:image/jpeg tercetak',
  (htmlTiga.match(/<img src="data:image\/jpeg;base64,/g) || []).length === 3);
c('tiap foto benar-benar ikut isinya (bukan cuma kerangka)',
  fotoB64.every((b) => htmlTiga.includes(b)));
c('judul blok "📸 DOKUMENTASI" muncul', /<span class="nomor">📸<\/span>\s*<h2>DOKUMENTASI<\/h2>/.test(htmlTiga));
c('foto TUNGGAL dibuat selebar isi (kelas .tunggal)',
  htmlSatu.includes('<div class="foto-grid tunggal">') &&
    htmlTiga.includes('<div class="foto-grid">'));
c('banyak foto → grid 2 kolom', /\.foto-grid img \{[\s\S]*?width: calc\(50% - 5px\);/.test(htmlTiga));
c('foto tidak dipotong (tinggi mengikuti aslinya)',
  !/\.foto-grid img \{[\s\S]*?object-fit/.test(htmlTiga));
// Kaki dokumen dipendekkan di commit 7300d5b — jumlah foto tidak lagi ditulis
// di situ. Yang penting: fotonya tetap tertanam (dicek di atas) dan kaki
// dokumen tidak menyisakan potongan kalimat lama di versi mana pun.
c('kaki dokumen = "Dikirim <tanggal lengkap>"',
  htmlTiga.includes('Dikirim ' + formatFullDate(new Date())));
c('kaki dokumen tidak lagi menghitung foto', !/foto dokumentasi/.test(htmlTiga));
c('kaki dokumen TANPA foto tidak menyebut apa-apa', !/foto dokumentasi/.test(htmlTanpa));
c('blok foto ada SESUDAH 5 poin agenda',
  htmlTiga.indexOf('DOKUMENTASI') > htmlTiga.indexOf('OUR EVENTS'));
// Src disaring ke abjad base64 → tak mungkin ada tanda kutip yang mematahkan HTML.
const jahat = monthly.buildHtml({ ...dasar, photos: ['AAA" onerror="alert(1)'] });
// '=' memang huruf sah base64 (padding), jadi ia tetap tinggal — yang penting
// TANDA KUTIP & spasinya hilang, sehingga atributnya mustahil dipatahkan.
c('tanda kutip/spasi dibuang dari src → atribut tak bisa dipatahkan',
  jahat.includes('src="data:image/jpeg;base64,AAAonerror=alert1"') &&
    !/onerror="/.test(jahat));

fs.writeFileSync(OUT, htmlTiga, 'utf8');

// ---------- 3. Tombol pindah ke atas ----------
console.log('\n=== Tombol pindah ke ATAS (Monthly) ===');
const mt = baca('components/core/MonthlyTab.tsx');
const kepala = /<View style=\{styles\.cardHeader\}>[\s\S]*?\n        <\/View>/.exec(mt)[0];
// Tombol ✏️-nya sekarang <EditButton> bersama — rupanya tak lagi ditulis di
// MonthlyTab, tapi sekali saja di components/common/EditButton.tsx.
c('Ubah & Share ada di dalam baris judul (paling atas)',
  /<EditButton/.test(kepala) && /icon="square\.and\.arrow\.up"/.test(kepala));
c('tak ada lagi baris tombol di KAKI kartu',
  !/actionRow/.test(mt) && !/CardActionButton/.test(mt));
c('tombolnya SAUDARA dari area ketuk, bukan anaknya (Pressable bersarang)',
  kepala.indexOf('</PressableScale>') < kepala.indexOf('<EditButton'));
// Penanda "sedang mencetak" kini datang dari hook bersama useBusyTask
// (dulu useState sharingId lokal) — bacanya jadi pdf.busy, artinya sama.
c('spinner tampil di tombol share saat PDF sedang dibuat',
  /icon="square\.and\.arrow\.up"[\s\S]*?busy=\{pdf\.busy === m\.id\}/.test(mt));

console.log('\n=== Panah buka/tutup dibuang ===');
c('tak ada lagi chevron di kartu Monthly',
  !/chevron\.(up|down)/.test(mt) && !/chevronTap/.test(mt));
c('buka/tutup tetap jalan — blok judul yang jadi sakelarnya',
  (mt.match(/setOpenId\(expanded \? null : m\.id\)/g) || []).length === 1);

console.log('\n=== Ikon rata & ringan, bukan emoji berwarna ===');
const eb0 = baca('components/common/EmojiButton.tsx');
c('EmojiButton bisa diisi ikon simbol', /icon \? \(\s*<IconSymbol name=\{icon\}/.test(eb0));
// Warnanya tak lagi dipatok: bundarannya ikut warna gelap fitur, isinya putih.
c('warna ikon bawaan ikut warna tombolnya',
  /color=\{iconColor \?\? isi\}/.test(eb0) &&
  /const isi = active && !danger \? theme\.fg : Color\.TEXT_REVERSE;/.test(eb0));
// Rupanya ditulis SEKALI di EditButton, lalu dipakai semua daftar — jadi di
// situlah warna & ikonnya sekarang diuji.
const tombolEdit = baca('components/common/EditButton.tsx');
c('tombol ✏️: ikon pensil, warnanya ikut fitur (tak lagi dipatok sendiri)',
  /icon="pencil"/.test(tombolEdit) && !/iconColor/.test(tombolEdit));
c('emoji tetap boleh (pintasan 🕘 📜 👛 dll tak berubah)',
  /emoji="🕘"|emoji="📜"/.test(baca('app/(tabs)/core.tsx')) && /emoji\?: string;/.test(eb0));

console.log('\n=== Tanggal ringkas "ddd, dd mmm yy" ===');
const fmt = baca('lib/format.ts');
c('formatCompactDate ada di lib/format.ts', /export function formatCompactDate/.test(fmt));
// Monthly kini memakainya lewat formatCompactDateTime — bentuk tanggal+jam
// yang SAMA juga dipakai kartu jadwal visitasi.
c('Monthly memakainya (lewat formatCompactDateTime)',
  /📆 \{formatCompactDateTime\(m\.date\.toDate\(\)\)\}/.test(mt) &&
  /return `\$\{formatCompactDate\(d\)\} · 🕒 \$\{formatTime\(d\)\}`/.test(fmt));
// 1 Sep 2026: penanda jamnya "Pk." → 🕒 (perubahan di lib/format.ts). Yang
// dijaga di sini tetap sama: tanggalnya dirangkai dari formatCompactDate,
// bukan rumus kedua yang ditulis ulang.
c('formatShortDayDateTime ikut memakainya (tak ada rumus kembar)',
  /return `\$\{formatCompactDate\(d\)\}, 🕒 \$\{formatTime\(d\)\}`/.test(fmt));
{
  // Jalankan sungguhan: Selasa, 25 Agustus 2026 harus jadi "Sel, 25 Agu 26".
  const js = ts.transpileModule(
    fmt.replace(/^export /gm, '') + '\nexports.f = formatCompactDate; exports.g = formatShortDayDateTime;',
    { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const m2 = { exports: {} };
  new Function('exports', 'module', js)(m2.exports, m2);
  c('25 Agustus 2026 → "Sel, 25 Agu 26"',
    m2.exports.f(new Date(2026, 7, 25)) === 'Sel, 25 Agu 26');
  // Nol di depan itu bahasa mesin, bukan bahasa orang.
  c('tanggal 1 digit ditulis 1 digit ("Sab, 5 Sep 26")',
    m2.exports.f(new Date(2026, 8, 5)) === 'Sab, 5 Sep 26',
    m2.exports.f(new Date(2026, 8, 5)));
  c('cap waktu System tetap ringkas & lengkap',
    m2.exports.g(new Date(2026, 7, 16, 2, 15)) === 'Min, 16 Agu 26, 🕒 02.15',
    m2.exports.g(new Date(2026, 7, 16, 2, 15)));
}

console.log('\n=== Jarak tombol di Car › Log ===');
const lt = baca('components/car/LogTab.tsx');
c('tombol "Catat Pengeluaran" diberi jarak ke kartu pertama',
  /label="Catat Pengeluaran"[\s\S]*?additionalStyle=\{styles\.addButton\}/.test(lt) &&
    // (16 Sep 2026: 10 yang sama, kini lewat CARD_GAP bersama.)
    /addButton: \{ marginBottom: CARD_GAP \}/.test(lt));
// Kartu barisnya kini milik bersama <ExpenseRow> (dipakai Car & Residence) —
// angkanya tetap 10, cuma pindah berkas.
c('jaraknya sama dengan jarak antar-kartu (10)',
  /row: \{[\s\S]*?marginBottom: 10,/.test(baca('components/common/ExpenseRow.tsx')) &&
    /<ExpenseRow/.test(lt));

console.log('\n=== Tombol Pertemuan: di kanan atas ===');
const vt = baca('components/core/VisitationTab.tsx');
c('tombolnya EmojiButton berikon share, bukan lagi tombol berlabel panjang',
  /<EmojiButton\s+icon="square\.and\.arrow\.up"/.test(vt) && !/CardActionButton/.test(vt));
// Kolom kanan sekarang SETINGGI kartu ('stretch') lalu isinya dipisah
// ke dua ujung: tombol share tetap di kanan ATAS, hitung mundurnya
// memojok ke kanan BAWAH.
c('duduk di kanan ATAS: kolom kanan setinggi kartu, isinya dipisah dua ujung',
  /cardRow: \{ flexDirection: 'row', alignItems: 'stretch', gap: 8 \}/.test(vt) &&
  /cardSide: \{ alignItems: 'flex-end', justifyContent: 'space-between', gap: 6 \}/.test(vt));
c('urutannya tetap: tombol share dulu, baru status di bawahnya',
  vt.indexOf('icon="square.and.arrow.up"') < vt.indexOf('<VisitationStatus'));
c('area ketuk (buka modal edit) tetap melar mengisi sisanya',
  /cardTapArea: \{ flex: 1 \}/.test(vt));
c('penanda hari kirim tidak hilang — latarnya menyala (active)',
  /icon="square\.and\.arrow\.up"\s*\n\s*active=\{perluKirim\}/.test(vt));
c('style shareRow lama sudah dibuang', !/shareRow/.test(vt));

console.log('\n=== EmojiButton: tambahan busy/disabled tak mengubah rupa ===');
const eb = baca('components/common/EmojiButton.tsx');
c('ukuran & bentuk tetap 42×42 bulat', /width: 42,\s*height: 42,\s*borderRadius: 21/.test(eb));
c('busy & disabled default mati → pemakai lama tak berubah',
  // \`locked\` (garis tepi abu untuk tombol berpintu PIN) ikut bawaan mati.
  /busy = false,\s*\n\s*danger = false,\s*\n\s*locked = false,\s*\n\s*disabled = false,/.test(eb));
c('saat busy, emoji diganti spinner & tombolnya dikunci',
  /disabled=\{disabled \|\| busy\}/.test(eb) && /busy \? \(\s*<ActivityIndicator/.test(eb));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
console.log('  tersimpan: ' + OUT);
console.log(`  ukuran fixture: ${fotoB64.map((b) => Math.round(b.length / 1024) + ' KB').join(' · ')} (base64)`);
process.exit(ok ? 0 : 1);
