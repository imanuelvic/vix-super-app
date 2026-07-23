// Helper format tampilan (dipakai fitur Finance, Health, dan lainnya).

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

/** "71,5" / "71.5" → 71.5 — input angka desimal ala Indonesia. */
export function parseDecimal(text: string): number {
  const n = Number(text.replace(',', '.').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/** Desimal untuk tampilan: 7.53 → "7,5"; 8 → "8". */
export function formatDecimal(n: number): string {
  const s = n.toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s).replace('.', ',');
}

/** Rupiah ringkas untuk kartu kecil: 1.234.567 → "Rp1,2 jt". */
export function formatShortRupiah(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}Rp${formatDecimal(abs / 1_000_000_000)} M`;
  if (abs >= 1_000_000) return `${sign}Rp${formatDecimal(abs / 1_000_000)} jt`;
  if (abs >= 1_000) return `${sign}Rp${formatDecimal(abs / 1_000)} rb`;
  return `${sign}Rp${abs}`;
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
