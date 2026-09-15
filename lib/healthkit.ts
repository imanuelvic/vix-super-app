import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { dayId, startOfDay } from './format';

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
    // WAJIB require(): modul native ini tidak ada di Expo Go & build lama.
    // `import` statis dievaluasi saat berkas ini dimuat → app gagal start,
    // bukan cuma fitur HealthKit-nya yang mati.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
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
 * Minta izin baca — SEKALI per sesi app, tepat sebelum bacaan pertama.
 * Dipanggil sendiri oleh readTodaySummary & readRecentDailySteps, jadi
 * layar mana pun yang membaca Apple Health otomatis memunculkan dialognya.
 *
 * iOS hanya menampilkan dialog izin saat requestAuthorization BENAR-BENAR
 * dipanggil. Sejak tombol "Hubungkan Apple Health" dibuang (v1.2.0) tidak ada
 * lagi yang memanggilnya → install baru tak pernah ditanya, dan setiap bacaan
 * diam-diam mengembalikan 0. Panggilan berikutnya (izin sudah diputuskan)
 * selesai seketika tanpa dialog, jadi aman diulang tiap sesi.
 *
 * Catatan: Apple sengaja TIDAK memberi tahu apakah izin baca dikabulkan
 * (privasi) — kalau ditolak, query hanya mengembalikan data kosong, bukan
 * error. Karena itu hasilnya tidak dipakai untuk menggagalkan bacaan; kalau
 * permintaannya sendiri gagal, sesi berikutnya dicoba lagi.
 */
let izinDiminta: Promise<void> | null = null;
function pastikanIzin(mod: HealthKitModule): Promise<void> {
  if (!izinDiminta) {
    izinDiminta = mod
      .requestAuthorization({ toRead: [...READ_TYPES] })
      .then(
        () => undefined,
        () => {
          izinDiminta = null;
        },
      );
  }
  return izinDiminta;
}

export type DailyHealthSummary = {
  steps: number | null; // langkah hari ini
  activeKcal: number | null; // kalori aktif hari ini
};

/** Baca ringkasan hari ini. null = HealthKit tidak tersedia. */
export async function readTodaySummary(): Promise<DailyHealthSummary | null> {
  const mod = getModule();
  if (!mod) return null;
  await pastikanIzin(mod);

  const now = new Date();
  const dayStart = startOfDay(now);

  const [steps, activeKcal] = await Promise.all([
    readSteps(mod, dayStart, now),
    readActiveKcal(mod, dayStart, now),
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
  await pastikanIzin(mod);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: { dayId: string; steps: number }[] = [];
  for (let i = 1; i <= days; i++) {
    const dayStart = new Date(startOfToday);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const steps = await readSteps(mod, dayStart, dayEnd);
    if (steps != null) out.push({ dayId: dayId(dayStart), steps });
  }
  return out;
}

