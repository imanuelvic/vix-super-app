import { ARCHIVE_NAME, layoutText, type TextLayout, type TextStep } from './shareImage';

// Ayat Alkitab 📖 → gambar Instagram STORY (9:16)
//
// Dibuka dari layar catat bacaan: pilih salah satu acuan yang kamu baca hari
// itu, ketik ayatnya kalau mau, lalu simpan/bagikan. Semuanya OPSIONAL —
// mencatat bacaan tetap bisa tanpa menyentuh bagian ini sama sekali.
//
// Rupa, nomor arsip, pemenggal baris, & cara membagikannya dipakai bersama
// dengan Feed refleksi (lihat lib/shareImage.ts), jadi kedua gambar itu
// terbaca sebagai satu arsip yang sama: `vixtory.archive`.
//
// ── Kenapa ayatnya diketik sendiri, bukan diambil otomatis ────────────────
// App ini tidak menyimpan teks Alkitab (lib/bible.ts cuma daftar 66 nama
// kitab + jumlah pasalnya), dan menariknya dari internet berarti menambah
// layanan luar beserta risikonya. Jadi acuannya (mis. "Mazmur 23:1-6") diambil
// dari yang sudah kamu isi, sedangkan bunyi ayatnya kamu salin sendiri —
// dengan begitu tidak ada satu huruf pun yang app ini karang.

/** Ukuran Story Instagram — 9:16. */
export const STORY_W = 1080;
export const STORY_H = 1920;

/**
 * Bingkai kartunya sengaja tidak memenuhi kanvas: Instagram menaruh tombol &
 * nama akun di pita atas (±250px) dan pita bawah (±250px). Kartu ditaruh di
 * antaranya supaya tidak ada tulisanmu yang tertutup UI Instagram.
 */
export const STORY_FRAME = { x: 64, y: 240, w: 952, h: 1440 };

/** Tepi kiri-kanan tulisan (px). Lebar tulisan = 1080 − 2×128 = 824. */
export const STORY_MARGIN = 128;

/** Garis alas tiap bagian tetap (px dari atas kanvas). */
export const STORY_HEAD_Y = 360;
export const STORY_RULE_TOP_Y = 420;
export const STORY_REF_Y = 1470;
export const STORY_RULE_BOTTOM_Y = 1560;
export const STORY_FOOT_Y = 1625;

/** Batas atas & bawah badan ayat — di antara kedua garis. */
const BODY_TOP = 520;
const BODY_BOTTOM = 1380;

// `maxChars` dihitung dari lebar 824 px dibagi lebar rata-rata huruf Inter
// (±0,52 × ukuran huruf). Ayat pendek jadi besar; ayat panjang mengecil
// sendiri sampai muat — tidak pernah terpotong di tengah jalan.
const STORY_STEPS: TextStep[] = [
  { maxChars: 22, fontSize: 72, perLine: 102 },
  { maxChars: 26, fontSize: 60, perLine: 86 },
  { maxChars: 31, fontSize: 50, perLine: 72 },
  { maxChars: 37, fontSize: 42, perLine: 60 },
  { maxChars: 46, fontSize: 34, perLine: 48 },
  { maxChars: 56, fontSize: 28, perLine: 40 },
];

/** Tata bunyi ayat jadi baris + ukuran huruf yang pas di badan kartu 9:16. */
export function layoutStory(text: string): TextLayout {
  return layoutText(text, STORY_STEPS, BODY_TOP, BODY_BOTTOM);
}

/**
 * Acuan bacaan yang tersimpan sebagai satu baris ("Mazmur 23, Yohanes 3:16")
 * dipecah jadi pilihan-pilihan terpisah — inilah yang jadi chip "pilih ayat".
 * Yang kosong dibuang; kalau tak ada satu pun, hasilnya array kosong dan
 * layarnya menampilkan pesan, bukan chip hampa.
 */
export function storyRefs(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Nama berkas yang enak dibaca di Foto/Files. */
export function storyFileName(dayId: string, ref: string): string {
  // Nama kitab boleh mengandung "/" (mis. tidak ada, tapi jaga-jaga) & titik
  // dua — keduanya tidak sah di nama berkas iOS.
  const aman = ref.replace(/[/:\\?%*|"<>]/g, '-').trim();
  return `${ARCHIVE_NAME} ${dayId} ${aman}.png`;
}
