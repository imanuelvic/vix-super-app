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

/** "14.05" — jam:menit gaya Indonesia (pemisah titik), selalu 2 digit. */
export function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}.${m}`;
}

/** Rabu, 22 Juli 2026 · 14.05 */
export function formatFullDateTime(d: Date): string {
  return `${formatFullDate(d)} · ${formatTime(d)}`;
}

/** Jum, 24 Jul 2026 — nama hari & bulan sama-sama 3 huruf. */
export function formatShortDayDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

/** Rabu, 12 Agu 26 — "dddd, dd mmm yy" untuk baris sapaan (<GreetingHeader/>). */
export function formatGreetingDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()].slice(0, 3);
  const year = String(d.getFullYear()).slice(-2);
  return `${DAY_NAMES[d.getDay()]}, ${day} ${month} ${year}`;
}

/** "Sel" — nama hari 3 huruf. */
export function dayShort(d: Date): string {
  return DAY_NAMES[d.getDay()].slice(0, 3);
}

/**
 * Durasi antara dua tanggal dalam "X tahun Y bulan Z hari" (akurat kalender,
 * bukan sekadar bagi 30). Bagian bernilai 0 dihilangkan; kalau kurang dari 1
 * hari hasilnya "0 hari". `from` dianggap ≤ `to` (urutan otomatis dibetulkan).
 * Contoh: 233 hari → "7 bulan 21 hari".
 */
export function formatMonthsDays(from: Date, to: Date): string {
  let a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  if (a > b) [a, b] = [b, a];
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate();
  if (days < 0) {
    months -= 1;
    // Jumlah hari di bulan sebelum bulan `b` (hari ke-0 = hari terakhir bulan lalu).
    days += new Date(b.getFullYear(), b.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} tahun`);
  if (months > 0) parts.push(`${months} bulan`);
  if (days > 0 || parts.length === 0) parts.push(`${days} hari`);
  return parts.join(' ');
}

/** Tengah malam (00:00) dari sebuah tanggal — buang jam/menitnya. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Selisih HARI KALENDER antara dua tanggal (`to` − `from`), mengabaikan jam.
 * Positif = `to` di masa depan, 0 = hari yang sama, negatif = sudah lewat.
 * Dipakai untuk semua hitungan "x hari lagi" / "lewat x hari".
 */
export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

/** dayId "2026-07-24" → Date lokal (parse manual biar tidak geser zona waktu). */
export function dayIdToDate(dayId: string): Date {
  const [y, m, d] = dayId.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Kamis, 6 Agustus (tanpa tahun — untuk daftar harian). */
export function formatDayMonth(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
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

/** 22 Jul 2026 — tanggal ringkas (bulan 3 huruf, tanpa nama hari). */
export function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
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
