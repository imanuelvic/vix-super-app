import { dayId, dayIdToDate } from './format';
import { type LoginStreak as DayStreak } from './reward';

// Streak harian 🔥 — aturannya SAMA untuk semua fitur yang punya streak
// (doa pagi, Revive, baca Alkitab pagi/malam, sesi gym):
//   { count, lastDayId, best, total }
// Yang berbeda cuma "hari sebelumnya yang dianggap menyambung":
//   - streak harian biasa → kemarin
//   - Fitness             → hari LATIHAN terakhir (Rabu & Minggu dilewati)
//   - Doa pagi            → kemarin (batasnya jam 00.00, sama seperti hari biasa)
// Karena itu perhitungannya dikumpulkan di sini sebagai fungsi murni, dan tiap
// fitur cukup menentukan `prevDayId`-nya sendiri lalu menulis ke dokumennya.

export const EMPTY_DAY_STREAK: DayStreak = {
  count: 0,
  lastDayId: '',
  best: 0,
  total: 0,
};

/** Sudah dicatat hari ini? Semua streak naik maksimal 1×/hari. */
export function alreadyCounted(
  current: DayStreak | null,
  todayId: string,
): boolean {
  return current?.lastDayId === todayId;
}

/**
 * dayId sehari SEBELUM `id`. Murni: tidak melihat jam sistem sama sekali.
 *
 * Merangkainya lewat `dayId()` milik lib/format, bukan menyusun "YYYY-MM-DD"
 * sendiri: cuma satu tempat di seluruh app yang boleh tahu bentuk id harian,
 * dan itu bukan di sini (lihat cek-id-kunci.js).
 */
export function prevDayId(id: string): string {
  const hari = dayIdToDate(id);
  hari.setDate(hari.getDate() - 1);
  return dayId(hari);
}

/**
 * Streak yang MASIH hidup hari ini — 0 kalau hari terakhirnya bukan hari ini
 * atau kemarin.
 *
 * Kenapa ini perlu ada sendiri: `count` di Firestore itu angka TERAKHIR KALI
 * dicatat, dan ia tidak turun sendiri. Bolos tiga hari lalu buka app, angkanya
 * masih memamerkan "3 hari streak" sampai kamu membaca lagi — baru saat itu ia
 * diam-diam jatuh ke 1. Jadi yang boleh ditampilkan bukan `count` mentah,
 * melainkan angka ini.
 *
 * Bentuknya sengaja sama persis dengan `activeStreak` milik kebiasaan Health
 * (lib/health.ts), cuma yang ini murni: hari kemarinnya dihitung dari
 * `todayId` yang dioper, bukan dari jam sistem.
 */
export function activeDayStreak(
  current: DayStreak | null,
  todayId: string,
): number {
  if (!current) return 0;
  if (current.lastDayId === todayId || current.lastDayId === prevDayId(todayId)) {
    return current.count;
  }
  return 0;
}

/**
 * Nilai streak SESUDAH hari ini dicatat. `prevDayId` = id hari sebelumnya;
 * kalau sama dengan `lastDayId` berarti streak bersambung, kalau tidak
 * streak mulai lagi dari 1. `best` & `total` tidak pernah turun.
 *
 * Pemanggil wajib mengecek `alreadyCounted` dulu supaya tidak dobel hitung.
 */
export function nextStreak(
  current: DayStreak | null,
  todayId: string,
  prevDayId: string,
): DayStreak {
  const continued = current !== null && current.lastDayId === prevDayId;
  const count = continued ? current.count + 1 : 1;
  return {
    count,
    lastDayId: todayId,
    best: Math.max(count, current?.best ?? 0),
    total: (current?.total ?? 0) + 1,
  };
}
