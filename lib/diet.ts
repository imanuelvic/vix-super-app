import {
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate } from './format';
import { bmrMale, type HealthProfile } from './health';

// Diet 🥗 — catatan makan harian: KALORI, GULA, dan LEMAK.
// Fokusnya bukan diet ekstrem, tapi "less sugar, less fat": tahu berapa yang
// masuk hari ini supaya sadar, bukan menghitung sampai stres.
//
// SATU dokumen per hari: users/{uid}/diet/{YYYY-MM-DD} → { meals, date }
// Semua makanan hari itu ada di satu array → 1 read per hari, murah.

export type MealSlot = 'sarapan' | 'siang' | 'malam' | 'cemilan';

export const MEAL_SLOTS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: 'sarapan', label: 'Sarapan', emoji: '🌅' },
  { key: 'siang', label: 'Makan Siang', emoji: '🌤️' },
  { key: 'malam', label: 'Makan Malam', emoji: '🌙' },
  { key: 'cemilan', label: 'Cemilan', emoji: '🍪' },
];

export function mealSlotMeta(slot: MealSlot) {
  return MEAL_SLOTS.find((s) => s.key === slot) ?? MEAL_SLOTS[0];
}

export type Meal = {
  id: string;
  slot: MealSlot;
  name: string;
  kcal: number;
  sugarG: number; // gula tambahan (gram)
  fatG: number; // lemak total (gram)
};

export type DietDay = { meals: Meal[] };

export const EMPTY_DIET_DAY: DietDay = { meals: [] };

export function newMealId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ===================== Batas harian =====================
// Gula: WHO menyarankan gula tambahan < 10% energi (±50 g), idealnya < 5%
// (±25 g). Lemak: ±30% dari kebutuhan kalori, dan 1 g lemak = 9 kkal.

export const SUGAR_LIMIT_G = 50;
export const SUGAR_IDEAL_G = 25;

/** Batas lemak harian (gram) dari target kalori. */
export function fatLimitG(kcalTarget: number): number {
  return Math.round((kcalTarget * 0.3) / 9);
}

/**
 * Kebutuhan kalori harian: BMR × 1,4 (aktivitas ringan) — angka yang sama
 * dipakai kartu saran di Data Tubuh, biar tidak beda-beda antar layar.
 */
export function kcalTargetOf(profile: HealthProfile, age: number): number {
  return Math.round(bmrMale(profile.weightKg, profile.heightCm, age) * 1.4);
}

export type DietTotals = { kcal: number; sugarG: number; fatG: number };

export function dietTotals(day: DietDay): DietTotals {
  return day.meals.reduce<DietTotals>(
    (sum, m) => ({
      kcal: sum.kcal + m.kcal,
      sugarG: sum.sugarG + m.sugarG,
      fatG: sum.fatG + m.fatG,
    }),
    { kcal: 0, sugarG: 0, fatG: 0 },
  );
}

/** Makanan hari itu dikelompokkan per waktu makan (urut Sarapan→Cemilan). */
export function mealsBySlot(day: DietDay): Record<MealSlot, Meal[]> {
  return {
    sarapan: day.meals.filter((m) => m.slot === 'sarapan'),
    siang: day.meals.filter((m) => m.slot === 'siang'),
    malam: day.meals.filter((m) => m.slot === 'malam'),
    cemilan: day.meals.filter((m) => m.slot === 'cemilan'),
  };
}

export type DietTone = 'ok' | 'warn' | 'over';

/** Warna status satu takaran: aman / mendekati batas (≥80%) / kelewatan. */
export function dietTone(value: number, limit: number): DietTone {
  if (limit <= 0) return 'ok';
  if (value > limit) return 'over';
  return value >= limit * 0.8 ? 'warn' : 'ok';
}

// ===================== Firestore =====================

function dietRef(uid: string, dayId: string) {
  return doc(db, 'users', uid, 'diet', dayId);
}

export function subscribeDietDay(
  uid: string,
  dayId: string,
  onChange: (day: DietDay) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    dietRef(uid, dayId),
    (snapshot) => onChange({ meals: (snapshot.data()?.meals as Meal[]) ?? [] }),
    onError,
  );
}

/**
 * Tulis ulang seluruh daftar makanan hari itu. Menghapus satu makanan =
 * menyimpan daftar tanpa item itu → benar-benar hilang (hard delete).
 */
export function saveDietDay(uid: string, dayId: string, meals: Meal[]) {
  return setDoc(
    dietRef(uid, dayId),
    { meals, date: Timestamp.fromDate(dayIdToDate(dayId)) },
    { merge: true },
  );
}
