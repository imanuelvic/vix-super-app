// Cari entri StyleSheet yang tidak pernah dipakai — dead code yang tak
// dilaporkan tsc maupun lint (styles.x dibaca lewat properti, jadi tak ada
// yang mengeluh kalau entrinya nganggur).
//
// Tiga hal yang dulu bikin pemindai ini melapor palsu, dan sekarang diurus:
//   1. Satu berkas boleh punya BEBERAPA StyleSheet, dan namanya belum tentu
//      `styles` (Deadline.tsx punya `borders` & `tags`). Dulu cuma blok pertama
//      yang dibaca, lalu isinya dicari dengan awalan `styles.` yang tak pernah
//      cocok → seluruh entrinya terlihat mati.
//   2. Entri yang dibaca DINAMIS (`tags[tone]`) tidak pernah muncul sebagai
//      `tags.over`, jadi mustahil terdeteksi terpakai. StyleSheet yang pernah
//      di-index begitu dilewati seluruhnya.
//   3. StyleSheet yang DIEKSPOR dipakai berkas lain (`summaryText.label` di 19
//      layar). Pemakaiannya ada di luar berkas ini, jadi juga dilewati.
const AKAR = require('./akar');
const fs = require('fs');
const path = require('path');

const R = AKAR + '/';

const cari = (d, ext) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return cari(p, ext);
    return ext.some((x) => e.name.endsWith(x)) ? [p] : [];
  });
const rel = (p) => p.replace(/\\/g, '/').replace(R, '');

const berkas = [...cari(R + 'app', ['.tsx']), ...cari(R + 'components', ['.tsx'])];

let total = 0;
let dilewati = 0;
const laporan = [];

for (const p of berkas) {
  const src = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
  const nganggur = [];

  // Tiap `const <nama> = StyleSheet.create({` di berkas ini, bukan cuma yang
  // pertama, dan namanya diambil apa adanya.
  for (const m of src.matchAll(/(export\s+)?const (\w+) = StyleSheet\.create\(\{/g)) {
    const diekspor = !!m[1];
    const nama = m[2];
    const sisa = src.slice(m.index + m[0].length);
    // Sampai `});` di kolom 0 — kalau seluruh sisa berkas ikut, prop komponen &
    // anggota tipe yang ditulis di bawahnya ikut terhitung sebagai nama gaya.
    const tutup = sisa.search(/^\}\);$/m);
    const blok = tutup === -1 ? sisa : sisa.slice(0, tutup);
    const luar = src.slice(0, m.index) + (tutup === -1 ? '' : sisa.slice(tutup));

    // Dibaca dinamis (`tags[tone]`) atau dipakai berkas lain (diekspor) →
    // pemakaian per-entri tak bisa dibuktikan dari sini. Lewati, jangan tebak.
    if (diekspor || new RegExp(`\\b${nama}\\[`).test(luar)) {
      dilewati++;
      continue;
    }

    for (const k of blok.matchAll(/^ {2}(\w+): /gm)) {
      const entri = k[1];
      const dipakai = new RegExp(`${nama}\\.${entri}\\b|${nama}\\['${entri}'\\]`);
      if (!dipakai.test(luar) && !dipakai.test(blok)) nganggur.push(entri);
    }
  }

  if (nganggur.length) {
    total += nganggur.length;
    laporan.push(`${rel(p)}  →  ${nganggur.join(', ')}`);
  }
}

console.log(`ENTRI GAYA NGANGGUR: ${total} di ${laporan.length} berkas`);
console.log(`(${dilewati} StyleSheet dilewati: diekspor / dibaca dinamis)\n`);
laporan.forEach((l) => console.log('  ' + l));
