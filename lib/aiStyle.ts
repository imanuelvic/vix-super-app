import { TANDA_PISAH } from './gemini';

// 🎨 Satu GAYA untuk semua jawaban Gemini di app ini (refleksi harian, Vix
// Financial Coach, notulen CORE, Wheel of Life).
//
// Dulu tiap prompt mengarang aturannya sendiri, jadi jawabannya berbeda-beda:
// yang satu panjang seperti khotbah, yang lain kaku seperti laporan, emojinya
// kadang berhamburan di awal kalimat. Di sini aturannya ditulis SEKALI:
//
//   GAYA_BAHASA    kalimat pendek, hangat, gaya anak muda yang menulis untuk
//                  dirinya sendiri (bukan khotbah, bukan motivasi, bukan
//                  laporan).
//   aturanEmoji(n) emoji rapi: maksimal n, hanya di ujung baris, paling
//                  banyak dua berdampingan, dipilih dari EMOJI_PILIHAN.
//   TANPA_EMOJI    untuk tulisan yang dicetak jadi dokumen/PDF (notulen,
//                  Wheel): emoji tidak boleh sama sekali.
//
// Prompt cuma MEMINTA; yang benar-benar menjaga bentuknya adalah dua penyaring
// di bawah (`rapikanEmoji`, `tanpaEmoji`) yang dipakai di langkah finalisasi
// tiap fitur. Jadi walau model sedang "kreatif", yang sampai ke layar tetap
// rapi.

/**
 * Emoji yang boleh dipakai AI. Sengaja sedikit dan netral supaya terasa
 * dipilih, bukan ditempel: kalau daftarnya panjang, jawabannya malah jadi
 * seperti stiker.
 */
export const EMOJI_PILIHAN = ['🙏', '✨', '🔥', '🌱', '💛', '☀️', '🌙', '💭', '🕊️', '💪'];

// Dua aturan yang berlaku di mana pun, termasuk saat AI cuma merapikan
// tulisan orang lain.
const DASAR = `- Kalimat PENDEK. Satu kalimat, satu pikiran. Kalimat panjang dipecah jadi dua.
- Tanpa markdown: tanpa tanda bintang, tanpa judul, tanpa tanda kutip pembungkus.
- Jangan memakai tanda pisah panjang "${TANDA_PISAH}" sama sekali. Pakai koma atau titik.`;

/** Gaya untuk jawaban yang KALIMATNYA ditulis AI sendiri (refleksi, Coach, notulen). */
export const GAYA_BAHASA = `Gaya bahasa:
${DASAR}
- Bahasa Indonesia sehari-hari yang rapi dan hangat, gaya anak muda (Gen Z): natural seperti catatan pribadi atau pesan ke teman dekat. Bukan bahasa khotbah, bukan bahasa motivasi, bukan bahasa laporan.
- Jangan memakai singkatan chat ("yg", "bgt", "sm") dan jangan memakai bahasa gaul yang berlebihan.
- Jangan menggurui, jangan menghakimi, jangan menjanjikan hasil.`;

/**
 * Gaya untuk tugas yang cuma MERAPIKAN BENTUK tulisan orang lain (Wheel of
 * Life): suara penulisnya tidak boleh ikut dirapikan.
 */
export const GAYA_SETIA = `Gaya bahasa:
${DASAR}
- Suara penulisnya tetap miliknya: jangan diformalkan, jangan diperhalus, jangan diganti kata-katanya.`;

/** Aturan emoji untuk jawaban yang tampil di layar. `maks` = jatah seluruh jawaban. */
export function aturanEmoji(maks: number): string {
  return `Aturan emoji (ini yang membuatnya terlihat rapi):
- Maksimal ${maks} emoji untuk SELURUH jawaban. Lebih sedikit lebih baik; tanpa emoji juga boleh kalau memang tidak pas.
- Emoji hanya di UJUNG baris. Jangan di awal baris, jangan di tengah kalimat, jangan menggantikan kata.
- Paling banyak dua emoji berdampingan, contoh: "🙏✨".
- Pilih hanya dari daftar ini: ${EMOJI_PILIHAN.join(' ')}
- Emojinya harus cocok dengan kalimatnya. Jangan emoji acak, jangan emoji yang sama diulang di tiap baris.`;
}

/** Aturan untuk tulisan yang dicetak jadi dokumen (notulen, Wheel of Life). */
export const TANPA_EMOJI = `Aturan emoji: JANGAN memakai emoji sama sekali. Tulisan ini dicetak menjadi dokumen PDF, dan judul tiap bagiannya sudah ditulis oleh aplikasi.`;

// ---------- Penyaring (pagar yang sebenarnya) ----------

// Emoji dikenali dari nomor karakternya, bukan dari \p{...} di regex: Hermes
// (mesin JS React Native) tidak menjamin dukungan properti Unicode itu.
const PENGUBAH = new Set([0xfe0f, 0xfe0e, 0x200d, 0x20e3]);

function warnaKulit(cp: number): boolean {
  return cp >= 0x1f3fb && cp <= 0x1f3ff;
}

function emojiDasar(cp: number): boolean {
  return (
    (cp >= 0x231a && cp <= 0x23ff) || // jam & pasir (⌚ ⏰ ⏳)
    (cp >= 0x1f000 && cp <= 0x1faff) || // gambar, wajah, bendera, benda
    (cp >= 0x2600 && cp <= 0x27bf) || // simbol & dingbats (☀️ ✨ ❤️)
    (cp >= 0x2b00 && cp <= 0x2bff) // bintang & panah tebal (⭐)
  );
}

type Potongan = { emoji: boolean; teks: string };

/** Pecah teks jadi potongan emoji (beserta pengubahnya) dan potongan biasa. */
function potong(teks: string): Potongan[] {
  const huruf = Array.from(teks);
  const hasil: Potongan[] = [];
  let i = 0;
  while (i < huruf.length) {
    const cp = huruf[i].codePointAt(0) ?? 0;
    if (emojiDasar(cp)) {
      let j = i + 1;
      for (;;) {
        const n = j < huruf.length ? (huruf[j].codePointAt(0) ?? 0) : -1;
        // Rangkaian gabungan (👨‍👩‍👧) ikut satu potongan.
        if (n === 0x200d && j + 1 < huruf.length && emojiDasar(huruf[j + 1].codePointAt(0) ?? 0)) {
          j += 2;
          continue;
        }
        if (n >= 0 && (PENGUBAH.has(n) || warnaKulit(n))) {
          j += 1;
          continue;
        }
        break;
      }
      hasil.push({ emoji: true, teks: huruf.slice(i, j).join('') });
      i = j;
    } else {
      let j = i;
      while (j < huruf.length && !emojiDasar(huruf[j].codePointAt(0) ?? 0)) j += 1;
      hasil.push({ emoji: false, teks: huruf.slice(i, j).join('') });
      i = j;
    }
  }
  return hasil;
}

/** Buang semua emoji, rapikan spasi yang ditinggalkannya. */
export function tanpaEmoji(teks: string): string {
  return potong(teks)
    .filter((p) => !p.emoji)
    .map((p) => p.teks)
    .join('')
    .split('\n')
    .map((baris) => baris.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n')
    .trim();
}

/**
 * Bentuk emoji seperti yang dijanjikan prompt: hanya di ujung baris, paling
 * banyak dua berdampingan, dan total tidak melebihi `maks` untuk seluruh teks.
 * Emoji di awal atau tengah kalimat dibuang.
 */
export function rapikanEmoji(teks: string, maks: number): string {
  let sisa = Math.max(0, maks);
  return teks
    .split('\n')
    .map((baris) => {
      const bagian = potong(baris);
      // Ekor baris = emoji (boleh diselingi spasi) sampai bertemu kata.
      const ekor: string[] = [];
      let i = bagian.length - 1;
      while (i >= 0 && (bagian[i].emoji || bagian[i].teks.trim() === '')) {
        if (bagian[i].emoji) ekor.unshift(bagian[i].teks);
        i -= 1;
      }
      const badan = bagian
        .slice(0, i + 1)
        .filter((p) => !p.emoji)
        .map((p) => p.teks)
        .join('')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();
      const dipakai = ekor.slice(0, Math.min(2, sisa));
      sisa -= dipakai.length;
      if (!dipakai.length) return badan;
      return badan ? `${badan} ${dipakai.join('')}` : dipakai.join('');
    })
    .join('\n')
    .trim();
}
