// Helper format tampilan untuk fitur Finance (dipakai beberapa komponen).

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const DAY_NAMES = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu',
];

/** Rabu, 22 Juli 2026 */
export function formatFullDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${formatDate(d)}`;
}

/** "1234567" -> "1.234.567" untuk tampilan input nominal. */
export function groupDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 12);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Ambil angka dari teks input nominal ("1.234.567" -> 1234567). */
export function parseAmount(text: string): number {
  return Number(text.replace(/\D/g, '')) || 0;
}

/** 22 Juli 2026 */
export function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** Ganti tanggal tapi pertahankan jam-menit asli (agar urutan dalam 1 hari stabil). */
export function mergeDate(original: Date, picked: Date): Date {
  const d = new Date(picked);
  d.setHours(
    original.getHours(),
    original.getMinutes(),
    original.getSeconds(),
    original.getMilliseconds(),
  );
  return d;
}
