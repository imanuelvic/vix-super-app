// Uji pdfFileName() & brand di kop, diambil dari kode SUNGGUHAN lib/pdfDoc.ts.
// (Dulu keduanya tinggal di monthlyPdf.ts; sudah pindah ke kerangka bersama.)
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';

let src = fs.readFileSync(R + 'lib/pdfDoc.ts', 'utf8');
// Kop & merek dirakit di pdfShellHtml, ikut dibaca untuk pemeriksaan tata letak.
const html = src;

// Pastikan tak ada byte kendali mentah yang tersisa di source.
const mentah = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(src);

// Ambil hanya pdfFileName + konstanta pendukung, jalankan di Node.
const konst = /const MAX_FILE_NAME = \d+;/.exec(src)[0];
const fn = /function pdfFileName\(title: string, fallback = '[^']*'\): string \{[\s\S]*?\n\}/
  .exec(src)[0]
  .replace(/\(title: string, fallback = '[^']*'\): string/, "(title, fallback = 'Notulen Rapat')");
const pdfFileName = new Function(konst + '\n' + fn + '\nreturn pdfFileName;')();

const PDF_BRAND = /const PDF_BRAND = '([^']+)';/.exec(src)[1];

let ok = !mentah;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  \u2713 ' : '  \u2717 ') + n); };

console.log('=== Kebersihan source ===');
c('tidak ada karakter kendali mentah di lib/monthlyPdf.ts', !mentah);

console.log('\n=== Nama berkas dari judul rapat ===');
const kasus = [
  ['44. Meeting MCL CL - Juli 2026', '44. Meeting MCL CL - Juli 2026.pdf', 'contoh dari user \u2014 titik, spasi, tanda hubung UTUH'],
  ['Mentoring Agustus 2026',          'Mentoring Agustus 2026.pdf',        'judul biasa'],
  ['Rapat 19/08 : sesi "A"',          'Rapat 19 08 sesi A.pdf',            'garis miring, titik dua, kutip \u2014 terlarang di iOS'],
  ['  Rapat   ganda   spasi  ',       'Rapat ganda spasi.pdf',             'spasi berlebih dirapikan'],
  ['...',                             'Notulen Rapat.pdf',                 'judul cuma titik \u2192 nama cadangan'],
  ['',                                'Notulen Rapat.pdf',                 'judul kosong \u2192 nama cadangan'],
  ['.rahasia',                        'rahasia.pdf',                       'titik di depan = berkas tersembunyi di Unix'],
  ['Rapat CORE \uD83D\uDE4F Agustus',  'Rapat CORE \uD83D\uDE4F Agustus.pdf', 'emoji boleh \u2014 sah di APFS'],
];
for (const [judul, harap, kenapa] of kasus) {
  const dapat = pdfFileName(judul);
  const cocok = dapat === harap;
  if (!cocok) ok = false;
  console.log('  ' + (cocok ? '\u2713' : '\u2717') + ' ' + JSON.stringify(judul));
  console.log('      \u2192 ' + JSON.stringify(dapat) + (cocok ? '' : '   HARAP: ' + JSON.stringify(harap)));
  console.log('      ' + kenapa);
}

console.log('\n=== Batas & keamanan nama ===');
const panjang = pdfFileName('A'.repeat(300));
c('judul 300 huruf dipotong (<= 84 karakter total)', panjang.length <= 84);
const ILEGAL = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
let adaIlegal = false;
for (const [judul] of kasus) {
  const n = pdfFileName(judul);
  for (const ch of ILEGAL) if (n.includes(ch)) adaIlegal = true;
}
c('tak ada karakter terlarang tersisa di semua kasus', !adaIlegal);
c('nama tak pernah kosong / cuma ".pdf"', kasus.every(([j]) => pdfFileName(j).length > 4));
c('selalu berakhiran .pdf', kasus.every(([j]) => pdfFileName(j).endsWith('.pdf')));
c('rename() dipanggil dengan nama POLOS (tanpa "/")', !pdfFileName('a/b').includes('/'));

console.log('\n=== Brand di PDF ===');
c('teks brand tepat "CORE MCL Imanuel Victory"', PDF_BRAND === 'CORE MCL Imanuel Victory');
c('brand ditaruh di baris atas kop (.kop-atas)', /<div class="kop-atas">/.test(src));
c('brand di-escape, bukan disisipkan mentah', /\$\{escapeHtml\(PDF_BRAND\)\}/.test(src));
c('brand didorong ke KANAN (justify-content: space-between)',
  /\.kop-atas \{[\s\S]*?justify-content: space-between/.test(src));
c('brand tidak terpotong / turun baris (white-space: nowrap)',
  /\.merek \{[\s\S]*?white-space: nowrap/.test(src));
c('brand tidak menyusut saat judul panjang (flex: none)',
  /\.merek \{[\s\S]*?flex: none/.test(src));

console.log('\n=== Urutan operasi saat share ===');
// sharePdf() sekarang tinggal di kerangka bersama lib/pdfDoc.ts.
const share = /export async function sharePdf[\s\S]*$/.exec(src)[0];
c('berkas bentrok dihapus SEBELUM rename', share.indexOf('bentrok.delete()') < share.indexOf('pdf.rename('));
c('rename dibungkus try/catch \u2014 gagal namai tidak membatalkan kirim', /try \{[\s\S]*?pdf\.rename\([\s\S]*?\} catch/.test(share));
c('yang dibagikan pdf.uri (sesudah rename), bukan uri lama', /shareAsync\(pdf\.uri/.test(share));
c('tanpa nama berkas \u2014 rename DILEWATI (perilaku Invoice tak berubah)',
  /if \(fileName\) \{[\s\S]*?pdf\.rename\(/.test(share));

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
process.exit(ok ? 0 : 1);
