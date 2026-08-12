import { type LoginStreak as DayStreak } from './achievements';

// Rentetan harian 🔥 — aturannya SAMA untuk semua fitur yang punya streak
// (doa pagi, Revive, baca Alkitab pagi/malam, sesi gym):
//   { count, lastDayId, best, total }
// Yang berbeda cuma "hari sebelumnya yang dianggap menyambung":
//   - streak harian biasa → kemarin
//   - Fitness             → hari LATIHAN terakhir (Rabu & Minggu dilewati)
//   - Doa pagi            → kemarin versi batas jam 04.00
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
 * Nilai rentetan SESUDAH hari ini dicatat. `prevDayId` = id hari sebelumnya;
 * kalau sama dengan `lastDayId` berarti rentetan bersambung, kalau tidak
 * rentetan mulai lagi dari 1. `best` & `total` tidak pernah turun.
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
