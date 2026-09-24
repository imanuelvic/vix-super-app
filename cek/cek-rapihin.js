// Buktikan hasil rapihin: tampilan tombol IDENTIK & tak ada duplikasi tersisa.
const AKAR = require('./akar');
const fs = require('fs');
const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

// Nilai ASLI tiap tombol, dicatat dari sumber SEBELUM penyuntingan.
// (Monthly & Pertemuan kemudian DIMINTA pindah ke tombol emoji di kanan atas —
// baris keduanya disimpan di sini sekadar sebagai catatan sejarah.)
const SEBELUM = {
  'core-rules · Ubah panduan':   { pv: 8, br: 12, bw: 1, gap: 6, gaya: 'dashed', tepi: 'MAIN_LIGHT', latar: '—',    teks: 'MAIN' },
  'core-rules · Share PDF':      { pv: 8, br: 12, bw: 0, gap: 6, gaya: '—',      tepi: '—',          latar: 'MAIN', teks: 'TEXT_REVERSE' },
};

console.log('=== Komponen bersama ===');
const cab = baca('components/common/CardActionButton.tsx');
const nilai = (k) => new RegExp(k + ':\\s*([^,\\n]+)').exec(cab)?.[1]?.trim();
c('paddingVertical 8  (sama)', nilai('paddingVertical') === '8');
c('borderRadius 12    (sama)', nilai('borderRadius') === '12');
c('gap 6              (sama)', nilai('gap') === '6');
c('flexDirection row · center · center',
  /flexDirection: 'row'/.test(cab) && /alignItems: 'center'/.test(cab) && /justifyContent: 'center'/.test(cab));
c('rupa outline: dashed + MAIN_LIGHT',
  /outline: \{ borderStyle: 'dashed', borderColor: Color\.MAIN_LIGHT \}/.test(cab));
c('rupa filled: latar MAIN + tepi MAIN (tepinya tak terlihat)',
  /filled: \{[\s\S]*?backgroundColor: Color\.MAIN,[\s\S]*?borderColor: Color\.MAIN,/.test(cab));
c('teks outline MAIN · filled TEXT_REVERSE',
  /textOutline: \{ color: Color\.MAIN \}/.test(cab) && /textFilled: \{ color: Color\.TEXT_REVERSE \}/.test(cab));
c('ikon berukuran 16 (sama seperti semula)', /size=\{16\}/.test(cab));
c('spinner mewarisi warna rupanya', /ActivityIndicator color=\{tint\}/.test(cab));

console.log('\n=== Kenapa borderWidth 1 di rupa filled AMAN ===');
// Dulu tombol filled TIDAK bertepi (2px lebih pendek). Tapi ia selalu berada
// dalam baris ber-alignItems default = 'stretch', jadi tingginya sudah
// disamakan dengan tombol Ubah yang bertepi. Menambah tepi = tak terlihat.
{
  const src = baca('app/core-rules.tsx');
  const row = /actionRow: \{([^}]*)\}/.exec(src)[1];
  c(`core-rules: actionRow TANPA alignItems → default 'stretch' (tinggi disamakan)`,
    !/alignItems/.test(row));
  c('core-rules: kedua tombol tetap flex 1', /actionButton: \{ flex: 1 \}/.test(src));
}
console.log('\n=== Rupa tiap pemanggil sesudah refactor ===');
// Monthly & Pertemuan sudah pindah ke tombol emoji di kanan atas (diuji di
// cek-foto.js), jadi CardActionButton kini tinggal dipakai Rules & Suggestions.
const pakai = [
  ['core-rules · Ubah panduan',  'app/core-rules.tsx',             'Ubah panduan',  'outline'],
  ['core-rules · Share PDF',     'app/core-rules.tsx',             'Share PDF',     'filled'],
];
for (const [nama, f, label, rupa] of pakai) {
  const src = baca(f);
  const blok = new RegExp('<CardActionButton[\\s\\S]*?label="' + label + '"[\\s\\S]*?/>').exec(src);
  const punyaFilled = blok ? /variant="filled"/.test(blok[0]) : false;
  const benar = blok && (rupa === 'filled' ? punyaFilled : !punyaFilled);
  c(`${nama.padEnd(28)} → ${rupa}`, !!benar);
}
c('CardActionButton masih terpakai (belum jadi kode mati)',
  /CardActionButton/.test(baca('app/core-rules.tsx')));

console.log('\n=== Duplikasi yang dibuang ===');
c('esc() lokal di invoice.ts sudah tidak ada', !/function esc\(/.test(baca('lib/invoice.ts')));
c('invoice.ts memakai escapeHtml bersama', /escapeHtml/.test(baca('lib/invoice.ts')));
// Dicek pada baris IMPORT saja — nama modulnya masih wajar disebut di komentar.
c('invoice.ts tak lagi impor expo-print / expo-sharing sendiri',
  !/^import[^\n]*expo-(print|sharing)/m.test(baca('lib/invoice.ts')));
c('paragraphs() lokal di monthlyPdf.ts sudah tidak ada',
  !/function paragraphs\(/.test(baca('lib/monthlyPdf.ts')));
c('paragraphs() lokal di visitationPdf.ts sudah tidak ada',
  !/function paragraphs\(/.test(baca('lib/visitationPdf.ts')));
c('htmlParagraphs() ada satu-satunya di pdfDoc.ts',
  /export function htmlParagraphs/.test(baca('lib/pdfDoc.ts')));
let sisa = [];
for (const f of ['components/core/MonthlyTab.tsx', 'app/core-rules.tsx', 'components/core/VisitationTab.tsx']) {
  for (const k of ['editRow', 'editText', 'shareText', 'shareRowDue', 'shareTextDue']) {
    if (new RegExp('^  ' + k + ':', 'm').test(baca(f))) sisa.push(f + ' :: ' + k);
  }
}
c('tak ada style tombol tulis-tangan yang tersisa', sisa.length === 0);
if (sisa.length) console.log('      ' + sisa.join('\n      '));
c('hanya SATU tempat print+share PDF (pdfDoc.sharePdf)',
  (baca('lib/pdfDoc.ts').match(/printToFileAsync/g) || []).length === 1 &&
  !/printToFileAsync/.test(baca('lib/invoice.ts')));

console.log('\n=== Perilaku share TIDAK berubah ===');
const pd = baca('lib/pdfDoc.ts');
c('nama berkas tetap opsional di sharePdf (dokumen lain boleh tanpa nama)',
  /fileName\?: string/.test(pd) && /if \(fileName\) \{/.test(pd));
// Dulu invoice sengaja TANPA nama (pakai nama acak expo-print). Sekarang
// pemiliknya minta namanya jelas: "Victory Technology - <nomor>.pdf".
// Rinciannya diuji di cek-pdf-nama.js; di sini cukup dipastikan namanya ikut.
c('invoice dikirim DENGAN nama berkas',
  /invoiceFileName\(p, now\)/.test(baca('lib/invoice.ts')));
c('dialog invoice tetap "Bagikan Invoice"', /'Bagikan Invoice'/.test(baca('lib/invoice.ts')));
for (const [f, dialog] of [
  ['lib/monthlyPdf.ts', 'Kirim notulen ke WhatsApp'],
  ['lib/visitationPdf.ts', 'Kirim notulen ke WhatsApp'],
  ['lib/coreRulesPdf.ts', 'Kirim panduan ke WhatsApp'],
]) {
  c(`${f.replace('lib/', '').padEnd(20)} judul dialog & nama berkas tetap`,
    baca(f).includes(`'${dialog}'`) && /pdfFileName|visitationPdfName/.test(baca(f)));
}

console.log('\n' + (ok ? 'LULUS' : 'GAGAL'));
console.log('\nsebelum → sesudah (nilai tampilan):');
for (const [k, v] of Object.entries(SEBELUM)) {
  console.log('  ' + k.padEnd(28) + ` pv ${v.pv} · radius ${v.br} · gap ${v.gap} · ${v.gaya} ${v.tepi} · latar ${v.latar} · teks ${v.teks}`);
}
process.exit(ok ? 0 : 1);
