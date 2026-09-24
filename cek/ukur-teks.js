// Pengukur lebar teks SUNGGUHAN — membaca metrik dari berkas font Inter yang
// benar-benar dipaketkan app ini (node_modules/@expo-google-fonts/inter),
// bukan menebak "rata-rata sekian piksel per huruf".
//
// Dipakai uji tata letak iPhone 15 / iPad: kalau sebuah judul atau tulisan tab
// tidak muat, kita mau TAHU angkanya, bukan menduga.
//
// Emoji TIDAK ada di Inter — di iOS ia jatuh ke Apple Color Emoji. Lebarnya
// diperkirakan 1,20 em (nilai yang lazim untuk Apple Color Emoji) dan setiap
// pengukuran melaporkan berapa emoji yang ikut, supaya jelas mana angka pasti
// dan mana yang mengandung perkiraan.
const fs = require('fs');

const EMOJI_EM = 1.2;

function bacaFont(path) {
  const b = fs.readFileSync(path);
  const jumlahTabel = b.readUInt16BE(4);
  const tabel = {};
  for (let i = 0; i < jumlahTabel; i++) {
    const p = 12 + i * 16;
    tabel[b.toString('latin1', p, p + 4)] = {
      offset: b.readUInt32BE(p + 8),
      length: b.readUInt32BE(p + 12),
    };
  }
  const unitsPerEm = b.readUInt16BE(tabel.head.offset + 18);
  const numberOfHMetrics = b.readUInt16BE(tabel.hhea.offset + 34);

  // hmtx: numberOfHMetrics pasang (advance, lsb); sisa glyph memakai advance
  // terakhir.
  const advance = [];
  for (let i = 0; i < numberOfHMetrics; i++) {
    advance.push(b.readUInt16BE(tabel.hmtx.offset + i * 4));
  }

  // cmap format 4 (BMP) — cukup untuk seluruh teks Latin app ini.
  const cmapOff = tabel.cmap.offset;
  const nSub = b.readUInt16BE(cmapOff + 2);
  let subOff = null;
  for (let i = 0; i < nSub; i++) {
    const p = cmapOff + 4 + i * 8;
    const platform = b.readUInt16BE(p);
    const encoding = b.readUInt16BE(p + 2);
    const off = cmapOff + b.readUInt32BE(p + 4);
    if (b.readUInt16BE(off) !== 4) continue;
    if (platform === 3 && encoding === 1) subOff = off;
    else if (subOff === null) subOff = off;
  }
  if (subOff === null) throw new Error('cmap format 4 tidak ketemu');

  const segCount = b.readUInt16BE(subOff + 6) / 2;
  const endOff = subOff + 14;
  const startOff = endOff + segCount * 2 + 2;
  const deltaOff = startOff + segCount * 2;
  const rangeOff = deltaOff + segCount * 2;

  function glyphOf(kode) {
    for (let i = 0; i < segCount; i++) {
      const end = b.readUInt16BE(endOff + i * 2);
      if (kode > end) continue;
      const start = b.readUInt16BE(startOff + i * 2);
      if (kode < start) return 0;
      const delta = b.readInt16BE(deltaOff + i * 2);
      const ro = b.readUInt16BE(rangeOff + i * 2);
      if (ro === 0) return (kode + delta) & 0xffff;
      const p = rangeOff + i * 2 + ro + (kode - start) * 2;
      const g = b.readUInt16BE(p);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  }

  const lebarGlyph = (g) =>
    advance[g < advance.length ? g : advance.length - 1] / unitsPerEm;

  return { glyphOf, lebarGlyph, unitsPerEm };
}

const FONT_DIR = require('./akar') + '/node_modules/@expo-google-fonts/inter/';
const BERKAS = {
  '400': '400Regular/Inter_400Regular.ttf',
  '500': '500Medium/Inter_500Medium.ttf',
  '600': '600SemiBold/Inter_600SemiBold.ttf',
  '700': '700Bold/Inter_700Bold.ttf',
  '800': '800ExtraBold/Inter_800ExtraBold.ttf',
};
const cache = {};
function font(berat) {
  if (!cache[berat]) cache[berat] = bacaFont(FONT_DIR + BERKAS[berat]);
  return cache[berat];
}

/**
 * Lebar satu baris teks dalam pt.
 * @returns {{ lebar: number, emoji: number }} emoji = berapa aksara yang
 *   lebarnya diperkirakan (tidak ada di Inter), 0 = angkanya pasti.
 */
function ukur(teks, fontSize, berat = '400') {
  const f = font(berat);
  let em = 0;
  let emoji = 0;
  for (const ch of teks) {
    const kode = ch.codePointAt(0);
    // Penanda gaya emoji (VS16) & zero-width joiner tak menambah lebar.
    if (kode === 0xfe0f || kode === 0x200d) continue;
    const g = kode <= 0xffff ? f.glyphOf(kode) : 0;
    if (g === 0) {
      em += EMOJI_EM;
      emoji++;
    } else {
      em += f.lebarGlyph(g);
    }
  }
  return { lebar: em * fontSize, emoji };
}

// Gaya teks app ini (assets/… lewat components/common/VixText.tsx).
const HEADING = {
  header: { size: 30, berat: '800' },
  subheader: { size: 22, berat: '700' },
  title: { size: 17, berat: '700' },
  bold: { size: 15, berat: '700' },
  paragraph: { size: 15, berat: '400' },
  label: { size: 13, berat: '500' },
};

function ukurHeading(teks, heading) {
  const h = HEADING[heading];
  return ukur(teks, h.size, h.berat);
}

module.exports = { ukur, ukurHeading, HEADING };
