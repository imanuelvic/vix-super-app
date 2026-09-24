// Bangun HTML notulen bulanan dari kode SUNGGUHAN (pdfDoc.ts + monthlyPdf.ts)
// dengan data contoh, lalu periksa: escaping aman, semua bagian ada, logo
// tertanam, tak ada placeholder bocor. Membuktikan refactor ke kerangka
// bersama TIDAK mengubah hasilnya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');
const ts = require(AKAR + '/node_modules/typescript');
const R = AKAR + '/';
const OUT = path.join(__dirname, 'notulen-contoh.html');

function muat(kode, luar = {}) {
  const mod = { exports: {} };
  const nama = Object.keys(luar);
  const js = ts.transpileModule(kode, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('exports', 'module', ...nama, js)(
    mod.exports, mod, ...nama.map((n) => luar[n]),
  );
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
const formatTime = (d) =>
  `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`;

// Logo asli dari modul aset (bukan tiruan) — supaya yang diuji benar gambarnya.
const logoSrc = fs.readFileSync(R + 'assets/logoCoreGwu.ts', 'utf8');
const LOGO_CORE_GWU_DATA_URI = /'(data:image\/png;base64,[^']+)'/.exec(logoSrc)[1];

// --- Kerangka bersama (tanpa bagian expo) ---
const pdfDoc = muat(
  fs.readFileSync(R + 'lib/pdfDoc.ts', 'utf8')
    .replace(/^import[\s\S]*?from '[^']+';\r?\n/gm, '')
    .replace(/export async function sharePdf[\s\S]*$/, '') +
    '\nexport { escapeHtml, htmlParagraphs, pdfFileName, pdfShellHtml };',
  { LOGO_CORE_GWU_DATA_URI },
);

// --- Penyusun notulen ---
const monthly = muat(
  'type MonthlyMeeting = any;\n' +
    fs.readFileSync(R + 'lib/monthlyPdf.ts', 'utf8')
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
  },
);

// Data contoh — termasuk yang jahat & yang kosong.
const meeting = {
  title: '44. Meeting MCL CL - Juli 2026 <script>alert(1)</script>',
  date: { toDate: () => new Date(2026, 7, 19, 19, 30) },
  place: 'Gereja NDC lt. 3 & "Zoom"',
  points: {
    mentorship: 'Pembekalan mentor angkatan baru.\nFokus: mendengar sebelum menasihati.\n\nPR: baca 1 bab buku.',
    leadersMessage: 'Pesan Gembala: jangan lelah berbuat baik.',
    ndcInfo: '',
    core: 'CORE bertambah 2 member baru.\nDoakan Riky & Sarah.',
    events: 'Retreat 12–14 September.',
  },
  photos: [], // notulen tanpa dokumentasi — diuji terpisah di cek-foto.js
};

const html = monthly.buildHtml(meeting);
fs.writeFileSync(OUT, html, 'utf8');

let ok = true;
const c = (n, s) => { if (!s) ok = false; console.log((s ? '  ✓ ' : '  ✗ ') + n); };

console.log('=== Keamanan & isi ===');
c('tag <script> dari judul TIDAK ikut hidup (di-escape)',
  !/<script>alert/.test(html) && html.includes('&lt;script&gt;'));
c('judul tampil', html.includes('44. Meeting MCL CL - Juli 2026'));
c('tanggal lengkap tampil', html.includes('Rabu, 19 Agustus 2026'));
c('jam mulai tampil', html.includes('19.30'));
c('tempat tampil', html.includes('Gereja NDC lt. 3'));
for (const p of MONTHLY_AGENDA_POINTS) {
  c('poin "' + p.label + '" ada', html.includes(p.label));
}
c('poin kosong ditandai jelas, bukan blank', html.includes('belum diisi'));
c('baris ganda jadi paragraf terpisah',
  html.includes('<p>Doakan Riky &amp; Sarah.</p>'));
c('baris kosong di tengah catatan tidak jadi paragraf hampa',
  !/<p>\s*<\/p>/.test(html));
// Kaki dokumen dipendekkan di commit 7300d5b: dulu "N dari 5 poin agenda
// terisi · M foto dokumentasi · dicetak <tgl>", sekarang cuma "Dikirim <tgl>".
c('kaki dokumen = "Dikirim <tanggal lengkap>"',
  html.includes('Dikirim ' + formatFullDate(new Date())));
c('hitungan poin agenda TIDAK lagi ditulis di kaki',
  !/poin agenda terisi/.test(html));
c('tidak ada placeholder bocor', !/undefined|NaN|\[object/.test(html));

console.log('\n=== Logo & merek (dari kerangka bersama) ===');
const imgs = [...html.matchAll(/<img[^>]*src="data:image\/png;base64,([^"]+)"/g)];
c('ada 2 gambar tertanam (kop + kaki)', imgs.length === 2);
c('keduanya PNG base64 yang sah', imgs.every((m) => {
  try { return Buffer.from(m[1], 'base64').subarray(1, 4).toString() === 'PNG'; }
  catch { return false; }
}));
c('logo dialasi PUTIH (logonya gelap, kalau tidak ia hilang di kop hijau)',
  /\.logo \{[\s\S]*?background: #fff/.test(html));
c('merek "CORE MCL Imanuel Victory" tampil', html.includes('CORE MCL Imanuel Victory'));
c('merek ada di kolom kanan kop (.kop-kanan)', /<div class="kop-kanan">/.test(html));
c('kop-atas memakai space-between → kanan benar-benar di kanan',
  /\.kop-atas \{[\s\S]*?justify-content: space-between/.test(html));
c('warna latar dipaksa ikut tercetak (print-color-adjust)',
  /-webkit-print-color-adjust: exact/.test(html) && /[^-]print-color-adjust: exact/.test(html));
c('CSS khusus notulen ikut terpasang (nomor bulat)', /\.nomor \{/.test(html));

console.log('\n=== Nama berkas ===');
const nama = pdfDoc.pdfFileName(meeting.title.replace(/ <script.*/, ''), 'Notulen Rapat');
console.log('  ' + JSON.stringify(nama));
c('sama seperti sebelum refactor', nama === '44. Meeting MCL CL - Juli 2026.pdf');

console.log('\n=== Ukuran ===');
console.log('  ' + html.length.toLocaleString('id-ID') + ' karakter HTML');
console.log('  tersimpan: ' + OUT);
console.log('\n' + (ok ? 'LULUS: PDF siap dibagikan.' : 'GAGAL.'));
process.exit(ok ? 0 : 1);
