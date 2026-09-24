// Judul dropdown "🫶 CORE Leader" & "👥 Main Team" dipatok di atas saat
// daftarnya digulung, supaya tombol tutupnya selalu terjangkau.
//
// Yang paling rawan di sini BUKAN gayanya, tapi NOMOR patokannya:
// `stickyHeaderIndices` menunjuk anak ke-berapa dari ScrollView. Kalau ada
// anak yang kadang muncul kadang hilang, nomornya meleset dan yang terpatok
// jadi elemen lain. Jadi jumlah & urutan anaknya ikut dihitung di sini.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ROOT = AKAR;
const baca = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let gagal = 0;
function ok(nama, syarat, info = '') {
  if (syarat) console.log(`  ✅ ${nama}`);
  else { gagal++; console.log(`  ❌ ${nama}${info ? ` — ${info}` : ''}`); }
}

const src = baca('components/core/LeadersTab.tsx');

// Potong isi ScrollView-nya saja.
const mulai = src.indexOf('<ScrollView\n        contentContainerStyle={styles.content}');
const isi = src.slice(
  src.indexOf('>', src.indexOf('stickyHeaderIndices={STICKY_HEADERS}')) + 1,
  src.indexOf('</ScrollView>'),
);

console.log('\n=== Dipatoknya menyala ===');
ok('ScrollView-nya memang memakai stickyHeaderIndices',
  mulai > -1 && /stickyHeaderIndices=\{STICKY_HEADERS\}/.test(src));
ok('daftar nomornya konstanta di luar komponen (bukan array baru tiap render)',
  /^const STICKY_HEADERS = \[1, 3\];$/m.test(src) &&
  src.indexOf('const STICKY_HEADERS') < src.indexOf('export function LeadersTab'));

console.log('\n=== Nomor patokannya menunjuk judul yang benar ===');
// Anak ScrollView dihitung dari POHON JSX-nya sungguhan (di-parse Babel),
// bukan ditebak dari indentasi — indentasi tidak membuktikan kedalaman.
// Penyaringannya meniru React.Children.toArray: teks kosong, komentar JSX,
// null/undefined/boolean tidak dihitung sebagai anak.
const { parse } = require(path.join(ROOT, 'node_modules/@babel/parser'));
const pohon = parse(src, {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
});

let scrollView = null;
(function cari(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach(cari);
  if (
    node.type === 'JSXElement' &&
    node.openingElement.name.name === 'ScrollView' &&
    node.openingElement.attributes.some(
      (a) => a.name && a.name.name === 'stickyHeaderIndices',
    )
  ) {
    scrollView = node;
    return;
  }
  for (const k of Object.keys(node)) {
    if (k !== 'loc' && k !== 'range') cari(node[k]);
  }
})(pohon.program.body);

ok('ScrollView berpatok ketemu di pohon JSX', scrollView !== null);

const anak = (scrollView ? scrollView.children : [])
  .filter((c) => {
    if (c.type === 'JSXText') return c.value.trim() !== '';
    // `{/* komentar */}` → JSXExpressionContainer berisi JSXEmptyExpression.
    if (c.type === 'JSXExpressionContainer') {
      return c.expression.type !== 'JSXEmptyExpression';
    }
    return true;
  })
  .map((c) =>
    c.type === 'JSXElement' ? c.openingElement.name.name : c.type,
  );

ok('anaknya tepat 5 & urutannya seperti yang diasumsikan',
  anak.length === 5 &&
  anak.join(',') === 'FormError,PressableScale,View,PressableScale,View',
  anak.join(','));
ok('yang dipatok (nomor 1 & 3) memang dua judul dropdown-nya',
  anak[1] === 'PressableScale' && anak[3] === 'PressableScale');

/** Kode sumber isi anak ke-n ScrollView — untuk memeriksa apa yang dibungkusnya. */
function anakDalam(n) {
  const nyata = (scrollView ? scrollView.children : []).filter((c) => {
    if (c.type === 'JSXText') return c.value.trim() !== '';
    if (c.type === 'JSXExpressionContainer') {
      return c.expression.type !== 'JSXEmptyExpression';
    }
    return true;
  });
  const c = nyata[n];
  return c ? src.slice(c.start, c.end) : '';
}
ok('tidak ada anak yang bentuknya `{sesuatu && …}` — itulah yang bisa hilang',
  (scrollView ? scrollView.children : []).every(
    (c) =>
      c.type !== 'JSXExpressionContainer' ||
      c.expression.type === 'JSXEmptyExpression' ||
      c.expression.type !== 'LogicalExpression',
  ));

// Isi judulnya benar-benar CORE Leader & Main Team, bukan tombol lain.
// Judulnya kini punya prop tambahan (numberOfLines & gaya menyusut) supaya
// "10 orang ⌄" tak pernah jatuh ke baris bawah — jadi tag-nya multi-baris.
const judul = [...isi.matchAll(/<VixText\s+heading="title"[^>]*>\s*([^<]+?)\s*<\/VixText>/g)]
  .map((m) => m[1].trim());
ok('judul pertama 🫶 CORE Leader, kedua 👥 Main Team',
  judul[0] === '🫶 CORE Leader' && judul[1] === '👥 Main Team', judul.join(' | '));

console.log('\n=== Jumlah anaknya tidak berubah-ubah ===');
// Inilah bug yang paling gampang terjadi: `{clOpen && …}` telanjang jadi
// `false` saat tertutup, lalu dibuang React → nomor patokan bergeser.
ok('daftar CL dibungkus <View> yang selalu ada',
  /<View>\s*\n\s*\{clOpen && leaders\.map/.test(isi));
ok('daftar Main Team dibungkus <View> yang selalu ada',
  /<View>\s*\n\s*\{mtOpen && \(/.test(isi));
// Bungkusnya benar-benar MEMUAT syaratnya (bukan cuma kebetulan berdekatan).
const isiBungkusCL = anakDalam(2);
const isiBungkusMT = anakDalam(4);
ok('syarat clOpen ada DI DALAM bungkusnya, bukan sejajar dengannya',
  isiBungkusCL.includes('clOpen'), isiBungkusCL);
ok('syarat mtOpen ada DI DALAM bungkusnya, bukan sejajar dengannya',
  isiBungkusMT.includes('mtOpen'), isiBungkusMT);

console.log('\n=== Judulnya menutupi kartu yang lewat di belakangnya ===');
const gaya = src.slice(src.indexOf('toggleHeader: {'), src.indexOf('toggleRight:'));
ok('judul dipatok punya LATAR (kalau tembus, kartunya kelihatan menyelinap)',
  /backgroundColor: Color\.BACKGROUND/.test(gaya));
ok('jaraknya pindah dari margin ke padding — celahnya ikut kena latar',
  /paddingTop: 4/.test(gaya) && /paddingBottom: 10/.test(gaya) &&
  !/marginTop/.test(gaya) && !/marginBottom/.test(gaya));
ok('angka jaraknya sama persis seperti sebelumnya (4 & 10) → tampilan tak bergeser',
  /paddingTop: 4,/.test(gaya) && /paddingBottom: 10,/.test(gaya));

console.log('\n=== Fungsinya tidak berubah ===');
ok('menekan judulnya tetap buka/tutup daftarnya',
  /onPress=\{\(\) => toggleSeksi\('cl'\)\}/.test(isi) &&
  /onPress=\{\(\) => toggleSeksi\('mt'\)\}/.test(isi) &&
  /useAccordion<'cl' \| 'mt'>\(\)/.test(src));
// Bawaan "tidak ada yang terbuka" = useAccordion dipanggil TANPA argumen
// (bawaan hook-nya null). Begitu suatu saat diisi, cek ini yang merah duluan.
ok('keduanya tetap TERTUTUP saat layar dibuka',
  /useAccordion<'cl' \| 'mt'>\(\)/.test(src));
// BARU: membuka satu daftar menutup yang lain. Dipegang SATU state, bukan dua
// boolean — dengan dua boolean, "keduanya terbuka" tetap keadaan yang mungkin
// dan harus dijaga tangan di tiap tombolnya.
ok('membuka satu daftar otomatis menutup yang lain',
  /const clOpen = isOpen\('cl'\);/.test(src) &&
  /const mtOpen = isOpen\('mt'\);/.test(src) &&
  !/const \[clOpen, setClOpen\]/.test(src) &&
  !/const \[mtOpen, setMtOpen\]/.test(src));
ok('tulisan Tutup / "N orang" tetap ikut keadaannya',
  /\{clOpen \? 'Tutup' : `\$\{leaders\.length\} orang`\}/.test(isi) &&
  /\{mtOpen \? 'Tutup' : `\$\{mainTeam\.length\} orang`\}/.test(isi));
ok('panah atas/bawah tetap ikut keadaannya',
  /name=\{clOpen \? 'chevron\.up' : 'chevron\.down'\}/.test(isi) &&
  /name=\{mtOpen \? 'chevron\.up' : 'chevron\.down'\}/.test(isi));
ok('tombol tambah di atas tetap dipatok seperti semula (StickyTop)',
  /<StickyTop>/.test(src) && /label="CORE Leader"/.test(src) &&
  /label="Main Team"/.test(src));
ok('kartu & tombol 🎡 ✏️ di dalamnya tidak tersentuh',
  /<EmojiButton\s*\n\s*emoji="🎡"/.test(src) &&
  /<EditButton onPress=\{\(\) => openEdit\(l\)\} \/>/.test(src) &&
  /<EditButton onPress=\{\(\) => openEditMT\(m\)\} \/>/.test(src));

console.log(gagal === 0
  ? '\n✅ LULUS — dua judul dropdown dipatok, nomor & fungsinya benar.'
  : `\n❌ ${gagal} cek gagal.`);
process.exit(gagal === 0 ? 0 : 1);
