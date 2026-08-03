import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Investment 📈 — pantau & pelajari harga aset. Fokus awal: EMAS (harga 1 gram
// tiap ~tanggal 3), untuk mempelajari tren & membuat perkiraan sendiri. Crypto
// & Saham menyusul. Disimpan: users/{uid}/investment/gold → { entries }.

export type GoldEntry = { date: string; price: number }; // date "YYYY-MM-DD"

export const LOGAM_MULIA_URL =
  'https://www.logammulia.com/id/harga-emas-hari-ini';

// Data awal harga emas 1 gr (Logam Mulia, tiap ~tanggal 3). Jadi patokan tren;
// entri baru yang kamu tambahkan tersimpan di Firestore & menimpa bulan yang
// sama bila ada.
export const GOLD_SEED: GoldEntry[] = [
  { date: '2024-09-03', price: 1404000 },
  { date: '2024-10-03', price: 1469000 },
  { date: '2024-11-03', price: 1539000 },
  { date: '2024-12-03', price: 1514000 },
  { date: '2025-01-03', price: 1546858 },
  { date: '2025-02-03', price: 1621000 },
  { date: '2025-03-03', price: 1683198 },
  { date: '2025-04-03', price: 1836000 },
  { date: '2025-05-03', price: 1902000 },
  { date: '2025-06-04', price: 1924000 },
  { date: '2025-07-03', price: 1900740 },
  { date: '2025-08-03', price: 1948000 },
  { date: '2025-09-03', price: 2035000 },
  { date: '2025-10-03', price: 2235000 },
  { date: '2025-11-03', price: 2278000 },
  { date: '2025-12-03', price: 2412000 },
  { date: '2026-01-03', price: 2488000 },
  { date: '2026-02-03', price: 2844000 },
  { date: '2026-03-03', price: 3122000 },
  { date: '2026-04-02', price: 2922000 },
  { date: '2026-05-06', price: 2790000 },
  { date: '2026-06-05', price: 2770000 },
  { date: '2026-07-06', price: 2670000 },
  { date: '2026-08-03', price: 2610000 },
];

export function subscribeGold(
  uid: string,
  onChange: (entries: GoldEntry[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'investment', 'gold');
  return onSnapshot(
    ref,
    (snapshot) => onChange((snapshot.data()?.entries as GoldEntry[]) ?? []),
    onError,
  );
}

export function saveGold(uid: string, entries: GoldEntry[]) {
  return setDoc(doc(db, 'users', uid, 'investment', 'gold'), { entries });
}

export type GoldPoint = { date: string; price: number; seeded: boolean };

/**
 * Gabung data awal + entri user, satu harga per BULAN (entri user menimpa data
 * awal bulan yang sama), urut tanggal menaik.
 */
export function mergedGold(userEntries: GoldEntry[]): GoldPoint[] {
  const byMonth = new Map<string, GoldPoint>();
  for (const e of GOLD_SEED) byMonth.set(e.date.slice(0, 7), { ...e, seeded: true });
  for (const e of userEntries) byMonth.set(e.date.slice(0, 7), { ...e, seeded: false });
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Statistik ringkas untuk dipelajari (harga terakhir, tertinggi/terendah, dll). */
export function goldStats(series: GoldPoint[]) {
  if (series.length === 0) return null;
  const prices = series.map((s) => s.price);
  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const high = Math.max(...prices);
  const low = Math.min(...prices);
  const changeAbs = prev ? latest.price - prev.price : 0;
  const changePct = prev && prev.price ? (changeAbs / prev.price) * 100 : 0;
  const avgChange =
    series.length > 1
      ? (latest.price - series[0].price) / (series.length - 1)
      : 0;
  return { latest, prev, high, low, changeAbs, changePct, avgChange };
}

/** "2026-09" — bulan berjalan. */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Reminder Home: sudah tanggal ≥3 & harga emas bulan ini belum dicatat. */
export function goldReminderDue(userEntries: GoldEntry[], now: Date): boolean {
  if (now.getDate() < 3) return false;
  const mk = monthKey(now);
  return !mergedGold(userEntries).some((e) => e.date.slice(0, 7) === mk);
}

/** Tanggal default entri baru: tanggal 3 bulan berjalan. */
export function defaultGoldDate(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), 3);
}
