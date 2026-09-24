// Bentuk baku KARTU DAFTAR (assets/style/card.ts).
//
// Keenam angkanya dulu disalin utuh di 43 blok gaya pada 32 berkas. Yang
// dijaga di sini tiga hal:
//   1. angkanya masih persis sama seperti sebelum disatukan,
//   2. tak ada lagi berkas yang menuliskannya sendiri, dan
//   3. tak ada pemakai yang diam-diam menimpa salah satunya.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const R = AKAR + '/';
const baca = (f) => fs.readFileSync(R + f, 'utf8');

let ok = true;
const c = (n, s, extra) => {
  if (!s) ok = false;
  console.log((s ? '  ✓ ' : '  ✗ ') + n + (extra !== undefined ? `  → ${extra}` : ''));
};

const cari = (d, ext) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return cari(p, ext);
    return ext.some((x) => e.name.endsWith(x)) ? [p] : [];
  });
const rel = (p) => p.replace(/\\/g, '/').replace(R, '');

// Angka aslinya, dicatat dari sumber SEBELUM disatukan.
const INTI = {
  backgroundColor: 'Color.CONTAINER',
  borderRadius: '14',
  borderWidth: '1',
  borderColor: 'Color.BORDER',
  paddingHorizontal: '14',
  paddingVertical: '12',
};

console.log('\n== 1. Angkanya tidak bergeser ==');
const card = baca('assets/style/card.ts');
for (const [k, v] of Object.entries(INTI)) {
  c(`${k}: ${v}`, new RegExp(`^\\s*${k}: ${v.replace('.', '\\.')},$`, 'm').test(card));
}
c('bertipe ViewStyle, jadi salah ketik properti ketahuan tsc',
  /export const CARD: ViewStyle = \{/.test(card));

console.log('\n== 2. Tak ada lagi yang menuliskannya sendiri ==');
const berkas = [...cari(R + 'app', ['.tsx']), ...cari(R + 'components', ['.tsx'])];
const pemakai = [];
const penyalin = [];
const penimpa = [];

for (const p of berkas) {
  const src = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  for (const m of src.matchAll(/^ {2}(\w+): \{\n([\s\S]*?)^ {2}\},$/gm)) {
    const isi = m[2];
    const prop = {};
    for (const q of isi.matchAll(/^\s*([\w-]+):\s*(.+?),?\s*$/gm)) {
      prop[q[1]] = q[2].replace(/,$/, '').trim();
    }
    const sebar = /^\s*\.\.\.CARD,\s*$/m.test(isi);
    const semuaInti = Object.entries(INTI).every(([k, v]) => prop[k] === v);

    if (sebar) {
      pemakai.push(`${rel(p)}:${m[1]}`);
      // Menimpa salah satu angka intinya = kartu yang diam-diam beda sendiri.
      const ditimpa = Object.keys(INTI).filter((k) => k in prop);
      if (ditimpa.length) penimpa.push(`${rel(p)}:${m[1]} → ${ditimpa.join(', ')}`);
    } else if (semuaInti) {
      penyalin.push(`${rel(p)}:${m[1]}`);
    }
  }
  for (const m of src.matchAll(/^ {2}(\w+): CARD,$/gm)) pemakai.push(`${rel(p)}:${m[1]}`);
}

c('tak ada berkas yang menyalin keenamnya lagi',
  penyalin.length === 0, penyalin.join(' · '));
c('tak ada pemakai yang diam-diam menimpa angka intinya',
  penimpa.length === 0, penimpa.join(' · '));
c('dipakai di banyak tempat (bukan konstanta yang nganggur)',
  pemakai.length >= 40, `${pemakai.length} blok`);

console.log('\n== 3. Yang TIDAK boleh berubah ==');
// Yang khas tiap kartu memang TIDAK ikut ke bentuk bakunya — memaksakannya ke
// sana cuma membuat tiap pemakai harus menimpanya lagi.
for (const k of ['gap', 'marginBottom', 'flexDirection', 'alignItems', 'borderLeftWidth']) {
  c(`${k} tetap milik kartunya masing-masing`,
    !new RegExp(`^\\s*${k}:`, 'm').test(card));
}
// Garis tepi kiri berwarna (Timeline, Riwayat Syukur, Learning) tetap ada.
c('kartu bergaris tepi kiri tetap punya garisnya',
  /borderLeftColor: Color\.MAIN_LIGHT,/.test(baca('app/history.tsx')) &&
    /borderLeftColor: Color\.SPIRITUAL_DARK,/.test(baca('app/gratitude.tsx')));

console.log(ok ? '\nLULUS' : '\nGAGAL');
process.exit(ok ? 0 : 1);