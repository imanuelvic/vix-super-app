// Helper format tampilan (dipakai fitur Finance, Health, dan lainnya).

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

/**
 * Nama bulan dari sebuah tanggal, mis. "Agustus". Dipakai judul yang menyebut
 * bulan berjalan ("Pemakaian bulan Agustus") — supaya angka bulanan jelas
 * bulan apa, bukan cuma "bulan ini".
 */
export function monthLabel(d = new Date()): string {
  return MONTH_NAMES[d.getMonth()];
}

/**
 * Nama bulan 3 huruf, mis. "Agu". Untuk tempat sempit yang nama panjangnya
 * membuat kalimatnya membungkus — kartu setengah lebar di tab System, rentang
 * tanggal, & seluruh tanggal ringkas di bawah.
 */
export function monthShort(d: Date): string {
  return MONTH_NAMES[d.getMonth()].slice(0, 3);
}

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
  return `${formatFullDate(d)} · 🕒 ${formatTime(d)}`;
}

/** Jum, 24 Jul 2026 — nama hari & bulan sama-sama 3 huruf. */
export function formatShortDayDate(d: Date): string {
  return `${dayShort(d)}, ${d.getDate()} ${monthShort(d)} ${d.getFullYear()}`;
}

/**
 * Senin, 31 Agu 2026 — nama hari UTUH, bulan 3 huruf, tahun 4 angka.
 *
 * Inilah bentuk baku tanggal di DAFTAR (kartu reminder Dashboard, baris jadwal
 * Fun Futsal): "dddd, d mmm yyyy". Tanggalnya 1 digit kalau memang 1 digit —
 * "06 Feb" itu bahasa mesin, bukan bahasa orang.
 *
 * Tiga tetangganya cuma beda satu bagian, jadi gampang salah ambil:
 *   formatFullDate      → Senin, 31 Agustus 2026  (bulannya utuh)
 *   formatShortDayDate  → Sen, 31 Agu 2026        (harinya disingkat)
 *   formatGreetingDate  → Senin, 31 Agu 26        (tahunnya 2 angka)
 */
export function formatDayDate(d: Date): string {
  return `${DAY_NAMES[d.getDay()]}, ${formatShortDate(d)}`;
}

/**
 * Sab, 6 Agu 26 — "ddd, d mmm yy". Tanggal paling ringkas: hari & bulan
 * 3 huruf, tahun 2 digit. Untuk kartu sempit yang tanggalnya tidak boleh
 * sampai membungkus ke baris berikutnya.
 */
export function formatCompactDate(d: Date): string {
  const day = d.getDate();
  const month = monthShort(d);
  const year = String(d.getFullYear()).slice(-2);
  return `${dayShort(d)}, ${day} ${month} ${year}`;
}

/**
 * Sab, 16 Agu 26, Pk. 02.15 — "ddd, dd mmm yy, Pk. jj.mm".
 * Cap waktu paling ringkas, mis. "Update terakhir" di tab System.
 */
export function formatShortDayDateTime(d: Date): string {
  return `${formatCompactDate(d)}, 🕒 ${formatTime(d)}`;
}

/**
 * Sel, 3 Mar 26 · 🕒 19.30 — tanggal ringkas + jam, berikut lambang jamnya.
 *
 * SATU bentuk untuk semua kartu jadwal: rapat bulanan CORE (sub-tab Monthly)
 * DAN jadwal visitasi (sub-tab Visitation + layar Riwayat Visitasi). Dulu
 * keduanya menyusun sendiri-sendiri dengan lambang & letak koma yang berbeda,
 * jadi dua daftar sejenis terlihat tidak sekeluarga.
 *
 * Lambang 🕒 sengaja ikut di dalam sini, bukan ditulis di layarnya: itulah yang
 * membuat kedua kartu mustahil berbeda.
 */
export function formatCompactDateTime(d: Date): string {
  return `${formatCompactDate(d)} · 🕒 ${formatTime(d)}`;
}

/** Rabu, 12 Agu 26 — "dddd, d mmm yy" untuk baris sapaan (<GreetingHeader/>). */
export function formatGreetingDate(d: Date): string {
  const day = d.getDate();
  const month = monthShort(d);
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
 * Dua tanggal jatuh di BULAN yang sama? Tahunnya ikut dibandingkan, jadi
 * Agustus tahun lalu TIDAK sama dengan Agustus tahun ini.
 *
 * Itulah jebakannya, dan itu sebabnya pemeriksaan ini pantas jadi satu fungsi:
 * penyaring "bulan ini" tersebar di Car, Device (×2), Residence (×2), & Token,
 * semuanya ditulis ulang dari nol — cukup satu yang lupa membandingkan tahun,
 * dan total "bulan ini" diam-diam ikut menjumlah bulan yang sama tahun lalu.
 */
export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Dua tanggal jatuh di HARI yang sama (jam & menitnya diabaikan). */
export function sameDay(a: Date, b: Date): boolean {
  return sameMonth(a, b) && a.getDate() === b.getDate();
}

/**
 * Selisih HARI KALENDER antara dua tanggal (`to` − `from`), mengabaikan jam.
 * Positif = `to` di masa depan, 0 = hari yang sama, negatif = sudah lewat.
 * Dipakai untuk semua hitungan "x hari lagi" / "lewat x hari".
 */
/**
 * "HARI INI" / "5 hari lagi" / "lewat 3 hari" — teks tenggat yang dipakai
 * seragam di Dashboard, Career, perawatan mobil & rumah. Pemakainya tinggal
 * menambahkan emoji/awalannya sendiri.
 */
export function whenLabel(days: number): string {
  if (days === 0) return 'HARI INI';
  return days > 0 ? `${days} hari lagi` : `lewat ${-days} hari`;
}

/**
 * Sisa waktu yang enak dibaca: 95 → "1 jam 35 menit", 120 → "2 jam",
 * 40 → "40 menit". Angka negatif dianggap habis ("0 menit").
 * Dipakai hitung mundur jendela baca Alkitab 📖.
 */
export function formatMinutesLeft(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} menit`;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} menit`;
}

export function daysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000,
  );
}

/**
 * Kebalikan `formatDate`: "1 Januari 1998" → Date. null kalau tak terbaca.
 *
 * Dipakai kolom yang MENYIMPAN tanggalnya sebagai teks tampilan (mis. tanggal
 * lahir di Profil) tapi sekarang diisi lewat date picker: teks tersimpannya
 * dibaca balik jadi tanggal untuk menyetel rodanya. Formatnya tidak diubah,
 * jadi data yang sudah ada tidak perlu dipindahkan ke mana-mana.
 *
 * Tanggal yang tidak ada (mis. "31 Februari 2026") ditolak, bukan digeser
 * diam-diam ke 3 Maret seperti kelakuan bawaan `new Date`.
 */
export function parseLongDate(text: string): Date | null {
  const m = text.trim().match(/^(\d{1,2})\s+(\S+)\s+(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTH_NAMES.findIndex(
    (n) => n.toLowerCase() === m[2].toLowerCase(),
  );
  const year = Number(m[3]);
  if (month === -1) return null;
  const d = new Date(year, month, day);
  return d.getDate() === day && d.getMonth() === month ? d : null;
}

// ── Id tanggal & bulan ───────────────────────────────────────────────────
// Dua bentuk yang dipakai sebagai KUNCI di seluruh app: id dokumen harian
// ("2026-07-24") & kunci bulanan ("2026-07").
//
// Dulu keduanya ditulis ulang di enam tempat (health, healthkit, budgets,
// career, core, multiplication) — dan bentuknya HARUS sama persis, karena
// inilah yang jadi nama dokumen Firestore. Satu saja yang lupa `padStart`,
// "2026-7-4" tak akan pernah bertemu "2026-07-04": datanya masih ada, tapi
// tak terbaca lagi. Karena itu tempatnya jadi satu.
//
// SELALU waktu lokal, bukan UTC — `toISOString()` menggeser tanggal untuk
// siapa pun di timur Greenwich, termasuk WIB.

/** "2026-07-24" — id harian. Dikenal juga sebagai `dayDocId` di lib/health. */
export function dayId(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "2026-07" — kunci bulanan. `month` 0–11, sama seperti `Date.getMonth()`. */
export function monthId(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** "2026-07" dari sebuah tanggal. */
export function monthIdOf(d: Date): string {
  return monthId(d.getFullYear(), d.getMonth());
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
  return `${d.getDate()} ${monthShort(d)} ${d.getFullYear()}`;
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
