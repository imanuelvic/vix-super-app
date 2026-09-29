// Dua permintaan (29 Sep 2026, siang):
//   1. God's Story jadi TIMELINE ke bawah: garis tegak, bulatan beremoji,
//      papan nama berselang-seling, judulnya di-click → modal penjelasan.
//      Kartu pembuka "kamu di babak Pengudusan" dibuang; babak berjalan
//      cukup DIBERI WARNA yang berbeda.
//   2. Jarak di bawah bar patok disamakan di seluruh Walk · CORE · Work.
//
// Bagian 2 berlaku untuk SELURUH app, bukan cuma layar yang dikeluhkan —
// keluhannya ("2026 di Testimony terlalu jauh dibanding Fasting") cuma satu
// gejala dari dua sebab yang tersebar: judul bagian pertama yang menambah
// jarak atasnya sendiri, dan enam salinan gaya "daftar kosong" dengan empat
// jarak berbeda.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n');
const kode = (p) =>
  baca(p)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const semuaTsx = ['app', 'components'].flatMap(function jelajah(d) {
  return fs.readdirSync(path.join(ROOT, d), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jelajah(d + '/' + e.name) : /\.tsx$/.test(e.name) ? [d + '/' + e.name] : []);
});

// =====================================================================
console.log("=== 1. God's Story jadi timeline ===");
// =====================================================================
{
  const tab = kode('components/spiritual/GospelStoryTab.tsx');
  const utuh = baca('components/spiritual/GospelStoryTab.tsx');

  ok('kartu pembuka "kamu di babak …" sudah tidak ada',
    !/Kamu di babak/.test(utuh) && !/heroCard/.test(tab));
  // Penanda "kamu di sini" sekarang WARNA, dan itu harus benar-benar ada —
  // kalau tidak, membuang kalimatnya berarti membuang penandanya sekaligus.
  ok('babak berjalan ditandai warna yang berbeda (bulatan & papan namanya)',
    /a\.key === GOSPEL_HERE/.test(tab) &&
    /here && styles\.bulatHere/.test(tab) &&
    /here && styles\.papanHere/.test(tab) &&
    /bulatHere: \{\s*\n\s*backgroundColor: Color\.SPIRITUAL_DEEP,/.test(utuh));

  ok('bentuknya timeline: garis tegak penyambung antar-babak',
    /garis: \{\s*\n\s*width: \d+,\s*\n\s*height: \d+,\s*\n\s*alignSelf: 'center',/.test(utuh) &&
    /\{i > 0 && <View style=\{styles\.garis\} \/>\}/.test(tab));
  ok('tiap babak punya bulatan beremoji',
    /<VixText additionalStyle=\{styles\.emoji\}>\{a\.emoji\}<\/VixText>/.test(tab) &&
    /borderRadius: BULAT \/ 2/.test(utuh));
  ok('papan namanya berselang-seling kiri-kanan',
    /const kanan = i % 2 === 0;/.test(tab) &&
    /\{!kanan \? papan : null\}/.test(tab) && /\{kanan \? papan : null\}/.test(tab));
  // Kedua sisi HARUS sama lebar, kalau tidak bulatannya bergeser dan garis
  // tegak di atas-bawahnya tidak lagi menyambung.
  ok('bulatannya tetap tepat di tengah berapa pun panjang namanya',
    /sisi: \{ flex: 1 \}/.test(utuh) &&
    (tab.match(/<View style=\{styles\.sisi\}>/g) ?? []).length === 2);

  ok('judulnya bisa di-click & membuka modal penjelasan',
    /onPress=\{\(\) => setBuka\(a\)\}/.test(tab) && /<SheetModal/.test(tab));
  ok('modalnya memakai SheetModal bersama, bukan dialog buatan sendiri',
    /from '@\/components\/common\/SheetModal'/.test(utuh));
  ok('judul modalnya = babak yang di-click',
    /title=\{buka \? `\$\{buka\.emoji\} \$\{buka\.title\}` : ''\}/.test(tab) &&
    /subtitle=\{buka\?\.titleId\}/.test(tab));
  // Isi yang dulu memenuhi lima kartu harus PINDAH, bukan hilang.
  ok('seluruh isi babaknya pindah ke modal, tidak ada yang hilang',
    ['buka.summary', 'buka.verseRef', 'buka.verseText', 'buka.now', 'buka.stage']
      .every((s) => tab.includes(s)));
  ok('ayatnya tetap bisa di-click ke YouVersion',
    /openYouVersion\(buka\.verseRef\)/.test(tab));
  // Batas kata WAJIB: tanpa `\b`, "buka.summary" di dalam modal ikut cocok
  // dengan pola "a.summary" (kata `buka` berakhiran huruf a) — dan ceknya
  // merah padahal justru sudah benar.
  ok('timeline-nya sendiri tidak lagi memuat isi panjangnya',
    !/\ba\.summary/.test(tab) && !/\ba\.verseText/.test(tab) && !/\ba\.now/.test(tab));

  // Datanya tidak boleh ikut berubah bentuk.
  const lib = baca('lib/gospelStory.ts');
  ok('kelima babak & urutannya tidak diutak-atik',
    ["'creation'", "'fall'", "'redemption'", "'renewal'", "'restoration'"]
      .every((k) => lib.includes(`key: ${k},`)) &&
    /export const GOSPEL_HERE = 'renewal';/.test(lib));
  ok('helper yang jadi yatim ikut dibuang (gospelHereAct)',
    !/gospelHereAct/.test(kode('lib/gospelStory.ts')));
}

// =====================================================================
console.log('\n=== 2. Jarak di bawah bar patok: satu irama ===');
// =====================================================================
{
  const section = baca('assets/style/section.ts');
  ok('ada token judul-bagian PERTAMA (jarak atasnya dinolkan)',
    /export const SECTION_SPACE_FIRST: \{ marginTop: number; marginBottom: number \} = \{\s*\n\s*\.\.\.SECTION_SPACE,\s*\n\s*marginTop: 0,\s*\n\};/.test(section));
  // Jarak BAWAHNYA tidak boleh ikut dinolkan: yang dibuang cuma jarak yang
  // sudah dipegang bar patok, bukan napas ke daftar di bawahnya.
  ok('jarak bawahnya TIDAK ikut berubah', /marginBottom: 10,/.test(section));

  // Dua layar yang judul bagiannya duduk tepat di bawah bar patok.
  const testimony = kode('components/spiritual/TestimonyTab.tsx');
  ok('Testimony: tahun PERTAMA tidak menambah jarak atasnya sendiri',
    /iTahun === 0 && styles\.yearTitleFirst/.test(testimony) &&
    /yearTitleFirst: \{ \.\.\.SECTION_SPACE_FIRST \}/.test(baca('components/spiritual/TestimonyTab.tsx')));
  ok('Testimony: tahun BERIKUTNYA tetap bernapas penuh (ia pemisah dua daftar)',
    /yearTitle: \{ \.\.\.SECTION_SPACE,/.test(baca('components/spiritual/TestimonyTab.tsx')));
  const visit = kode('components/core/VisitationTab.tsx');
  ok('Visitation: judul bagian pertamanya ikut aturan yang sama',
    /\[styles\.sectionRow, styles\.sectionRowFirst\]/.test(visit) &&
    /sectionRowFirst: \{ \.\.\.SECTION_SPACE_FIRST \}/.test(baca('components/core/VisitationTab.tsx')));

  // ---- "Daftar masih kosong": satu jarak untuk seluruh app ----
  // Sebelum ini enam sub-tab menyalin gayanya sendiri dengan EMPAT jarak atas
  // berbeda (8 · 8 · 8 · 10 · 10 · 20) — tidak ada satu pun yang salah
  // sendirian, yang salah tidak ada dua yang sama.
  //
  // Lingkupnya SEMPAT Walk · CORE · Work saja (itu yang diminta 29 Sep pagi),
  // lalu dituntaskan ke seluruh app pada batch /rapihin siang harinya. Jadi
  // sekarang ceknya se-app — dan penjaga lengkapnya (berikut pengecualian
  // pesan satu layar) tinggal di cek/cek-jarak-kartu.js, satu tempat dengan
  // penjaga irama jarak lainnya.
  const nakal = semuaTsx.filter(
    (f) => !f.endsWith('EmptyText.tsx') &&
      /empty: \{ textAlign: 'center', margin/.test(baca(f)),
  );
  ok('tidak ada lagi layar yang menyalin gaya "daftar kosong" sendiri',
    nakal.length === 0, nakal.join(', '));
  const pemakai = semuaTsx.filter((f) => /<EmptyText/.test(baca(f)));
  ok(`semuanya lewat <EmptyText> bersama (${pemakai.length} layar)`,
    pemakai.length >= 27);
  ok('jaraknya satu angka, dipegang komponennya sendiri',
    /empty: \{ textAlign: 'center', marginVertical: 10 \}/.test(
      baca('components/common/EmptyText.tsx')));
  // Keenam sub-tab yang baru dipindah memang ikut memakainya.
  for (const f of [
    'components/spiritual/PromiseTab.tsx', 'components/spiritual/FastingTab.tsx',
    'components/career/FulltimeTab.tsx', 'components/career/FreelanceTab.tsx',
    'components/core/MonthlyTab.tsx', 'components/core/MultiplicationTab.tsx',
  ]) {
    ok(`${path.basename(f)}: pakai <EmptyText>, bukan gaya sendiri`,
      /<EmptyText/.test(baca(f)) && !/styles\.empty/.test(baca(f)));
  }
}

// =====================================================================
console.log('\n=== 3. Aturan tetap proyek ===');
// =====================================================================
{
  const jalur = [
    'components/spiritual/GospelStoryTab.tsx', 'lib/gospelStory.ts',
    'components/spiritual/TestimonyTab.tsx', 'components/core/VisitationTab.tsx',
    'assets/style/section.ts',
  ];
  const berkas = jalur.map(baca);
  ok('tidak ada warna hex mentah', !berkas.some((s) => /#[0-9A-Fa-f]{6}/.test(s)));
  ok('istilahnya "click", bukan klik/ketuk/tekan',
    !berkas.some((s) => /\b(klik|Klik|ketuk|Ketuk|tekan|ditekan|menekan)\b/.test(s)));
  const emDash = [];
  for (const s of jalur.map(kode)) {
    for (const m of s.match(/'[^'\n]*'|`[^`\n]*`|"[^"\n]*"/g) || []) {
      if (m.includes(String.fromCharCode(0x2014))) emDash.push(m.slice(0, 40));
    }
  }
  ok('tanpa tanda pisah panjang di teks yang tampil', emDash.length === 0, emDash.join(' | '));
  ok('tanpa modul native baru (cukup eas update)',
    !berkas.some((s) => /from 'react-native-(?!reanimated|gesture-handler|safe-area-context|svg|webview)/.test(s)));
}

console.log('\n' + (gagal === 0
  ? "✅ LULUS — God's Story jadi timeline, jarak bar patok satu irama."
  : `❌ ${gagal} cek gagal.`));
process.exit(gagal === 0 ? 0 : 1);
