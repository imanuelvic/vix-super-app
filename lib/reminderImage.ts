import {
  ARCHIVE_NAME,
  layoutText,
  type TextLayout,
  type TextStep,
} from './shareImage';

// Reminder 🕊️ → gambar PERSEGI (1:1) untuk dibagikan.
//
// Bedanya dengan Feed 4:5 & Story 9:16 yang sudah ada: keduanya dibuat untuk
// Instagram, jadi tata letaknya menghindari pita tombol Instagram. Yang ini
// dibuat untuk CHAT — WhatsApp menampilkan gambar sebagai pratinjau kecil di
// dalam gelembung pesan, dan gambar tinggi (9:16) terpotong di situ. Persegi
// tampil utuh di pratinjaunya.
//
// Isinya juga sengaja seminim mungkin: satu kalimat, satu tanggal, satu tanda
// arsip. Ini kartu yang dilempar ke grup untuk dibaca sekilas — bukan poster.

/** Kanvas persegi. 1080 = ukuran yang sama dengan gambar lain di app ini. */
export const REMINDER_W = 1080;
export const REMINDER_H = 1080;

/** Tepi kiri-kanan tulisan (px). Lebar tulisan = 1080 − 2×110 = 860. */
export const REMINDER_MARGIN = 110;

/** Garis alas tiap bagian tetap (px dari atas kanvas). */
export const REMINDER_HEAD_Y = 190;
export const REMINDER_RULE_TOP_Y = 240;
export const REMINDER_RULE_BOTTOM_Y = 860;
export const REMINDER_FOOT_Y = 925;

/** Batas atas & bawah badan kalimat — di antara kedua garis. */
const BODY_TOP = 300;
const BODY_BOTTOM = 800;

// `maxChars` dihitung dari lebar 860 px dibagi lebar rata-rata huruf Inter
// (±0,52 × ukuran huruf). Kalimat pendek jadi besar; kalimat panjang mengecil
// sendiri sampai muat — tidak pernah terpotong di tengah jalan.
const REMINDER_STEPS: TextStep[] = [
  { maxChars: 24, fontSize: 68, perLine: 96 },
  { maxChars: 28, fontSize: 58, perLine: 82 },
  { maxChars: 33, fontSize: 50, perLine: 72 },
  { maxChars: 40, fontSize: 42, perLine: 60 },
  { maxChars: 48, fontSize: 34, perLine: 50 },
  { maxChars: 58, fontSize: 28, perLine: 42 },
];

/** Tata kalimatnya jadi baris + ukuran huruf yang pas di kartu persegi. */
export function layoutReminder(text: string): TextLayout {
  return layoutText(text, REMINDER_STEPS, BODY_TOP, BODY_BOTTOM);
}

/**
 * Emoji di awal kalimat dipisahkan supaya bisa dipajang besar sendiri di
 * atas — dan yang lebih penting, supaya TIDAK ikut masuk ke badan teks.
 *
 * Alasannya bukan selera: pemenggal barisnya menghitung per KARAKTER, sedangkan
 * emoji jauh lebih lebar dari huruf. Satu emoji di tengah baris membuat
 * barisnya melar keluar kartu tanpa ada yang bisa mendeteksinya.
 */
export function splitLeadingEmoji(text: string): {
  emoji: string;
  body: string;
} {
  const m = /^(\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*)\s*/u.exec(
    text.trim(),
  );
  return m
    ? { emoji: m[1], body: text.trim().slice(m[0].length) }
    : { emoji: '', body: text.trim() };
}

/** Nama berkas yang enak dibaca di lembar berbagi & Files. */
export function reminderFileName(dayId: string): string {
  return `${ARCHIVE_NAME} ${dayId} reminder.png`;
}
