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
  'HKCategoryTypeIdentifierSleepAnalysis',
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
  sleepHours: number | null; // durasi tidur semalam (jam)
};

/** Baca ringkasan hari ini. null = HealthKit tidak tersedia. */
export async function readTodaySummary(): Promise<DailyHealthSummary | null> {
  const mod = getModule();
  if (!mod) return null;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [steps, activeKcal, sleepHours] = await Promise.all([
    readSteps(mod, startOfDay, now),
    readActiveKcal(mod, startOfDay, now),
    readSleepHours(mod, now),
  ]);
  return { steps, activeKcal, sleepHours };
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

async function readSleepHours(
  mod: HealthKitModule,
  now: Date,
): Promise<number | null> {
  try {
    // Jendela tidur semalam: kemarin 18:00 → sekarang.
    const start = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 1,
      18,
    );
    const samples = await mod.queryCategorySamples(
      'HKCategoryTypeIdentifierSleepAnalysis',
      { filter: { date: { startDate: start, endDate: now } }, limit: 0 },
    );
    // Nilai 0 = "di tempat tidur", 2 = terbangun — keduanya bukan tidur.
    // Interval yang tumpang tindih digabung dulu supaya data ganda dari
    // iPhone + Apple Watch tidak terhitung dua kali.
    const intervals = samples
      .filter((s) => s.value !== 0 && s.value !== 2)
      .map((s) => ({ start: s.startDate.getTime(), end: s.endDate.getTime() }))
      .sort((a, b) => a.start - b.start);

    let total = 0;
    let curStart = 0;
    let curEnd = 0;
    for (const iv of intervals) {
      if (iv.start > curEnd) {
        total += curEnd - curStart;
        curStart = iv.start;
        curEnd = iv.end;
      } else {
        curEnd = Math.max(curEnd, iv.end);
      }
    }
    total += curEnd - curStart;
    return total / 3_600_000; // ms → jam
  } catch {
    return null;
  }
}
