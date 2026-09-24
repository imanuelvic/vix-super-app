// Uji htmlParagraphs() — enter yang diketik user harus DIHORMATI.
const AKAR = require('./akar');
const fs = require('fs');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const src = fs.readFileSync(R + 'lib/pdfDoc.ts', 'utf8');

const a = src.indexOf('export function htmlParagraphs');
const b = src.indexOf('\n}', a) + 2;
const js = ts.transpileModule(
  'function escapeHtml(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}\n' +
    src.slice(a, b).replace('export function', 'function') +
    '\nexports.htmlParagraphs = htmlParagraphs;',
  { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } },
).outputText;
const mod = { exports: {} };
new Function('exports', 'module', js)(mod.exports, mod);
const { htmlParagraphs } = mod.exports;

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };
const P = (h) => (h.match(/<p>/g) || []).length;
const J = (h) => (h.match(/class="jeda"/g) || []).length;

console.log('=== Enter DIHORMATI (ini yang diminta) ===');
// Persis gaya catatan di foto: judul, enter, lalu butir-butirnya.
const nyata = `🎙️ MCL's Message

- Jadilah orang yang dapat di andalkan!
- Kalian harus aktif minta masukan ke siapa saja MCL CL MT CM

🧑 Ps. Ery Message`;
const h1 = htmlParagraphs(nyata);
c('4 baris isi jadi 4 paragraf', P(h1) === 4);
c('2 enter yang diketik jadi 2 jeda', J(h1) === 2);
c('urutan terjaga: judul → jeda → butir → jeda → penutup',
  /<p>🎙️[^<]*<\/p><div class="jeda"><\/div><p>- Jadilah/.test(h1));

console.log('\n=== Yang TIDAK boleh bikin PDF berlubang ===');
c('enter beruntun (3x) tetap SATU jeda', J(htmlParagraphs('a\n\n\n\nb')) === 1);
c('enter di AWAL catatan dibuang', J(htmlParagraphs('\n\n\nisi')) === 0);
c('enter di AKHIR catatan dibuang', J(htmlParagraphs('isi\n\n\n')) === 0);
c('enter di kedua ujung dibuang, tengah tetap',
  (() => { const h = htmlParagraphs('\n\na\n\nb\n\n'); return J(h) === 1 && P(h) === 2; })());
c('tidak pernah ada paragraf hampa <p></p>', !/<p>\s*<\/p>/.test(htmlParagraphs('\n\na\n\n\nb\n\n')));
c('spasi-saja dianggap baris kosong', J(htmlParagraphs('a\n   \nb')) === 1);

console.log('\n=== Perilaku lama yang harus tetap ===');
c('catatan kosong → "— belum diisi —"', htmlParagraphs('').includes('belum diisi'));
c('catatan spasi/enter saja → "— belum diisi —"', htmlParagraphs('\n \n\n').includes('belum diisi'));
c('tanpa enter → tidak ada jeda sama sekali', J(htmlParagraphs('a\nb\nc')) === 0);
c('tiap baris tetap jadi paragraf sendiri', P(htmlParagraphs('a\nb\nc')) === 3);
c('teks tetap di-escape', htmlParagraphs('<b>x</b> & y').includes('&lt;b&gt;x&lt;/b&gt; &amp; y'));
c('spasi di ujung tiap baris dipangkas', htmlParagraphs('  a  ').includes('<p>a</p>'));

console.log('\n=== Margin per halaman ===');
c('padding body DINOLKAN (dulu 36/40/44 — cuma berlaku sekali)',
  /body \{[\s\S]*?padding: 0;/.test(src));
c('PAGE_MARGINS memakai angka lama persis (halaman 1 tak bergeser)',
  /PAGE_MARGINS = \{ top: 36, right: 40, bottom: 44, left: 40 \}/.test(src));
c('margins diteruskan ke printToFileAsync', /printToFileAsync\(\{ html, margins: PAGE_MARGINS \}\)/.test(src));
c('gaya .jeda ada di CSS bersama', /\.jeda \{ height: 9px; \}/.test(src));

// Tombol share-nya sudah jadi emoji 📤 di kanan atas (lihat cek-foto.js);
// yang masih perlu dijaga di sini: kedua tab memakai tombol yang SAMA.
console.log('\n=== Tombol Pertemuan & Monthly tetap serupa ===');
const vt = fs.readFileSync(R + 'components/core/VisitationTab.tsx', 'utf8');
const mt = fs.readFileSync(R + 'components/core/MonthlyTab.tsx', 'utf8');
c('Pertemuan: tombol bundar berikon share', /<EmojiButton\s+icon="square\.and\.arrow\.up"/.test(vt));
c('Monthly: tombol yang sama', /icon="square\.and\.arrow\.up"/.test(mt));
c('penanda hari kirim pindah ke latar tombol (active), tidak hilang',
  /active=\{perluKirim\}/.test(vt));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
console.log('\nContoh keluaran (catatan gaya foto kamu):');
console.log('  ' + h1.replace(/></g, '>\n  <'));
process.exit(ok ? 0 : 1);
