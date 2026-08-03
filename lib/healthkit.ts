import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// Wrapper Apple HealthKit (@kingstinct/react-native-healthkit).
//
// Modulnya NATIVE dan tidak ada di Expo Go — kalau di-import langsung,
// app crash saat development. Karena itu modul di-require secara lazy
// di dalam try/catch, dan HANYA type-nya yang di-import (terhapus saat
// compile). Semua fungsi di file ini aman dipanggil di platform mana pun.

type HealthKitModule = typeof import('@kingstinct/react-native-healthkit');

let cached: HealthKitModule | null | undefined;

function getModule(): HealthKitModule | null {
  if (cached !== undefined) return cached;
  const inExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  if (Platform.OS !== 'ios' || inExpoGo) {
    cached = null;
    return cached;
  }
  try {
    cached = require('@kingstinct/react-native-healthkit') as HealthKitModule;
  } catch {
    cached = null;
  }
  return cached;
}

export type HealthKitStatus = 'ok' | 'needs-build' | 'unsupported-platform';

/** Apakah Apple Health bisa dipakai di perangkat/build ini? */
export function healthKitStatus(): HealthKitStatus {
  if (Platform.OS !== 'ios') return 'unsupported-platform';
  const mod = getModule();
  if (!mod) return 'needs-build';
  return mod.isHealthDataAvailable() ? 'ok' : 'unsupported-platform';
}

// Data yang dibaca dari Apple Health (read-only — app ini tidak menulis).
const READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
] as const;

/**
 * Minta izin baca. Catatan: Apple sengaja TIDAK memberi tahu apakah izin
 * baca dikabulkan (privasi) — kalau ditolak, query hanya mengembalikan
 * data kosong, bukan error.
 */
export async function requestHealthAccess(): Promise<boolean> {
  const mod = getModule();
  if (!mod) return false;
  try {
    return await mod.requestAuthorization({ toRead: [...READ_TYPES] });
  } catch {
    return false;
  }
}

export type DailyHealthSummary = {
  steps: number | null; // langkah hari ini
  activeKcal: number | null; // kalori aktif hari ini
};

/** Baca ringkasan hari ini. null = HealthKit tidak tersedia. */
export async function readTodaySummary(): Promise<DailyHealthSummary | null> {
  const mod = getModule();
  if (!mod) return null;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [steps, activeKcal] = await Promise.all([
    readSteps(mod, startOfDay, now),
    readActiveKcal(mod, startOfDay, now),
  ]);
  return { steps, activeKcal };
}

async function readSteps(
  mod: HealthKitModule,
  startDate: Date,
  endDate: Date,
): Promise<number | null> {
  try {
    // Statistics query men-dedup sumber ganda (iPhone + Apple Watch).
    const stats = await mod.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      { filter: { date: { startDate, endDate } }, unit: 'count' },
    );
    return Math.round(stats.sumQuantity?.quantity ?? 0);
  } catch {
    return null;
  }
}

async function readActiveKcal(
  mod: HealthKitModule,
  startDate: Date,
  endDate: Date,
): Promise<number | null> {
  try {
    const stats = await mod.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierActiveEnergyBurned',
      ['cumulativeSum'],
      { filter: { date: { startDate, endDate } }, unit: 'kcal' },
    );
    return Math.round(stats.sumQuantity?.quantity ?? 0);
  } catch {
    return null;
  }
}

/** "YYYY-MM-DD" tanggal lokal (samakan format dengan dayDocId di lib/health). */
function localDayId(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Total langkah PER HARI untuk `days` hari terakhir yang SUDAH SELESAI (tidak
 * termasuk hari ini — hari ini belum final). Dipakai untuk mengisi rekor
 * langkah harian dari riwayat Apple Health. null = HealthKit tidak tersedia.
 */
export async function readRecentDailySteps(
  days: number,
): Promise<{ dayId: string; steps: number }[] | null> {
  const mod = getModule();
  if (!mod) return null;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: { dayId: string; steps: number }[] = [];
  for (let i = 1; i <= days; i++) {
    const dayStart = new Date(startOfToday);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const steps = await readSteps(mod, dayStart, dayEnd);
    if (steps != null) out.push({ dayId: localDayId(dayStart), steps });
  }
  return out;
}

