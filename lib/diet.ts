import {
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate } from './format';
import { bmrMale, type HealthProfile, type WeightTarget } from './health';

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
  proteinG: number; // protein (gram) — yang dikejar, bukan dibatasi
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

// Protein bukan batas, tapi TARGET MINIMUM: 1,6–2,0 g per kg berat badan per
// hari — rentang yang lazim dipakai untuk mempertahankan/menambah otot sambil
// menurunkan lemak (body recomposition).
export const PROTEIN_PER_KG_MIN = 1.6;
export const PROTEIN_PER_KG_MAX = 2.0;

export function proteinTargetG(weightKg: number): { min: number; max: number } {
  return {
    min: Math.round(weightKg * PROTEIN_PER_KG_MIN),
    max: Math.round(weightKg * PROTEIN_PER_KG_MAX),
  };
}

// Penyesuaian kalori saat mengejar target berat. Sengaja TIDAK agresif:
// defisit terlalu dalam bikin otot ikut hilang & progres malah mandek.
export const DEFICIT_KCAL = 400;
export const SURPLUS_KCAL = 300;

export type KcalMode = 'defisit' | 'surplus' | 'jaga';

export const KCAL_MODE_LABEL: Record<KcalMode, string> = {
  defisit: '📉 Defisit ringan',
  surplus: '📈 Surplus ringan',
  jaga: '⚖️ Jaga berat',
};

/**
 * Kebutuhan kalori harian: BMR × 1,4 (aktivitas ringan) — angka yang sama
 * dipakai kartu saran di Data Tubuh, biar tidak beda-beda antar layar.
 */
export function kcalTargetOf(profile: HealthProfile, age: number): number {
  return Math.round(bmrMale(profile.weightKg, profile.heightCm, age) * 1.4);
}

/**
 * Target kalori hari ini SETELAH disesuaikan dengan target berat yang dipasang
 * di tab Habits: mau turun → defisit ringan, mau naik → surplus ringan.
 */
export function kcalGoal(
  profile: HealthProfile,
  age: number,
  target: WeightTarget | null,
): { kcal: number; mode: KcalMode; maintenance: number } {
  const maintenance = kcalTargetOf(profile, age);
  if (!target || target.targetWeightKg === profile.weightKg) {
    return { kcal: maintenance, mode: 'jaga', maintenance };
  }
  const cut = target.targetWeightKg < profile.weightKg;
  return {
    kcal: maintenance + (cut ? -DEFICIT_KCAL : SURPLUS_KCAL),
    mode: cut ? 'defisit' : 'surplus',
    maintenance,
  };
}

export type DietTotals = {
  kcal: number;
  proteinG: number;
  sugarG: number;
  fatG: number;
};

export function dietTotals(day: DietDay): DietTotals {
  return day.meals.reduce<DietTotals>(
    (sum, m) => ({
      kcal: sum.kcal + m.kcal,
      proteinG: sum.proteinG + m.proteinG,
      sugarG: sum.sugarG + m.sugarG,
      fatG: sum.fatG + m.fatG,
    }),
    { kcal: 0, proteinG: 0, sugarG: 0, fatG: 0 },
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

// ===================== Daftar makanan siap pilih =====================
// Supaya tidak perlu mengetik angka tiap kali makan. Angkanya PERKIRAAN untuk
// porsi yang tertulis (sumber umum tabel gizi) — cukup untuk melihat pola,
// bukan untuk hitungan medis. Semua tetap bisa diedit setelah dipilih.

export type FoodGroup = 'protein' | 'karbo' | 'sayurbuah' | 'lemak' | 'minum';

export const FOOD_GROUP_LABEL: Record<FoodGroup, string> = {
  protein: '🥩 Protein',
  karbo: '🌾 Karbo & Whole Grain',
  sayurbuah: '🥦 Sayur & Buah',
  lemak: '🥑 Lemak Sehat',
  minum: '🥤 Minuman',
};

export type FoodPreset = {
  key: string;
  group: FoodGroup;
  emoji: string;
  name: string;
  portion: string; // porsi yang jadi patokan angkanya
  kcal: number;
  proteinG: number;
  sugarG: number;
  fatG: number;
};

export const FOOD_PRESETS: FoodPreset[] = [
  // 🥩 Protein
  { key: 'telur', group: 'protein', emoji: '🥚', name: 'Telur', portion: '1 butir', kcal: 78, proteinG: 6, sugarG: 0, fatG: 5 },
  { key: 'ayam-dada', group: 'protein', emoji: '🍗', name: 'Dada Ayam (tanpa kulit)', portion: '100 g', kcal: 165, proteinG: 31, sugarG: 0, fatG: 4 },
  { key: 'ikan', group: 'protein', emoji: '🐟', name: 'Ikan', portion: '100 g', kcal: 130, proteinG: 22, sugarG: 0, fatG: 4 },
  { key: 'daging', group: 'protein', emoji: '🥩', name: 'Daging Sapi (lean)', portion: '100 g', kcal: 217, proteinG: 26, sugarG: 0, fatG: 12 },
  { key: 'susu', group: 'protein', emoji: '🥛', name: 'Susu', portion: '1 gelas (250 ml)', kcal: 150, proteinG: 8, sugarG: 12, fatG: 8 },
  { key: 'greek-yogurt', group: 'protein', emoji: '🥣', name: 'Greek Yogurt (plain)', portion: '170 g', kcal: 100, proteinG: 17, sugarG: 6, fatG: 1 },
  { key: 'tahu', group: 'protein', emoji: '🍥', name: 'Tahu', portion: '100 g', kcal: 76, proteinG: 8, sugarG: 1, fatG: 5 },
  { key: 'tempe', group: 'protein', emoji: '🍢', name: 'Tempe', portion: '100 g', kcal: 193, proteinG: 19, sugarG: 0, fatG: 11 },
  { key: 'whey', group: 'protein', emoji: '🥤', name: 'Whey Protein', portion: '1 scoop (30 g)', kcal: 120, proteinG: 24, sugarG: 2, fatG: 2 },
  // 🌾 Karbo & whole grain
  { key: 'oats', group: 'karbo', emoji: '🌾', name: 'Oats', portion: '40 g kering', kcal: 150, proteinG: 5, sugarG: 1, fatG: 3 },
  { key: 'roti-gandum', group: 'karbo', emoji: '🍞', name: 'Roti Gandum Utuh', portion: '1 lembar', kcal: 80, proteinG: 4, sugarG: 2, fatG: 1 },
  { key: 'nasi-putih', group: 'karbo', emoji: '🍚', name: 'Nasi Putih', portion: '1 centong (100 g)', kcal: 130, proteinG: 3, sugarG: 0, fatG: 0 },
  { key: 'nasi-merah', group: 'karbo', emoji: '🍙', name: 'Nasi Merah', portion: '1 centong (100 g)', kcal: 111, proteinG: 3, sugarG: 0, fatG: 1 },
  { key: 'kentang', group: 'karbo', emoji: '🥔', name: 'Kentang Rebus', portion: '150 g', kcal: 130, proteinG: 3, sugarG: 1, fatG: 0 },
  // 🥦 Sayur & buah
  { key: 'sayur', group: 'sayurbuah', emoji: '🥦', name: 'Sayuran (campur)', portion: '100 g', kcal: 35, proteinG: 2, sugarG: 2, fatG: 0 },
  { key: 'pisang', group: 'sayurbuah', emoji: '🍌', name: 'Pisang', portion: '1 buah', kcal: 105, proteinG: 1, sugarG: 14, fatG: 0 },
  { key: 'berries', group: 'sayurbuah', emoji: '🫐', name: 'Berries', portion: '100 g', kcal: 57, proteinG: 1, sugarG: 10, fatG: 0 },
  { key: 'apel', group: 'sayurbuah', emoji: '🍎', name: 'Apel', portion: '1 buah', kcal: 95, proteinG: 0, sugarG: 19, fatG: 0 },
  { key: 'pepaya', group: 'sayurbuah', emoji: '🥭', name: 'Pepaya', portion: '150 g', kcal: 60, proteinG: 1, sugarG: 12, fatG: 0 },
  // 🥑 Lemak sehat
  { key: 'alpukat', group: 'lemak', emoji: '🥑', name: 'Alpukat', portion: '½ buah', kcal: 120, proteinG: 2, sugarG: 0, fatG: 11 },
  { key: 'chia', group: 'lemak', emoji: '🌱', name: 'Chia Seeds', portion: '1 sdm (12 g)', kcal: 60, proteinG: 2, sugarG: 0, fatG: 4 },
  { key: 'almond', group: 'lemak', emoji: '🥜', name: 'Almond', portion: '28 g (±23 butir)', kcal: 164, proteinG: 6, sugarG: 1, fatG: 14 },
  { key: 'minyak-zaitun', group: 'lemak', emoji: '🫒', name: 'Minyak Zaitun', portion: '1 sdm', kcal: 119, proteinG: 0, sugarG: 0, fatG: 14 },
  // 🥤 Minuman
  { key: 'air-putih', group: 'minum', emoji: '💧', name: 'Air Putih', portion: '1 gelas', kcal: 0, proteinG: 0, sugarG: 0, fatG: 0 },
  { key: 'kopi-hitam', group: 'minum', emoji: '☕', name: 'Kopi Hitam (tanpa gula)', portion: '1 cangkir', kcal: 2, proteinG: 0, sugarG: 0, fatG: 0 },
  { key: 'teh-tawar', group: 'minum', emoji: '🍵', name: 'Teh Tawar', portion: '1 cangkir', kcal: 2, proteinG: 0, sugarG: 0, fatG: 0 },
  { key: 'kopi-susu', group: 'minum', emoji: '🥤', name: 'Kopi Susu Kekinian', portion: '1 cup', kcal: 250, proteinG: 4, sugarG: 30, fatG: 8 },
];

export function foodPreset(key: string): FoodPreset | null {
  return FOOD_PRESETS.find((f) => f.key === key) ?? null;
}

/** Ubah satu pilihan makanan (× porsi) jadi baris makan siap simpan. */
export function mealFromPreset(
  preset: FoodPreset,
  slot: MealSlot,
  qty: number,
): Omit<Meal, 'id'> {
  const n = qty > 0 ? qty : 1;
  return {
    slot,
    name: n === 1 ? preset.name : `${preset.name} ×${n}`,
    kcal: Math.round(preset.kcal * n),
    proteinG: Math.round(preset.proteinG * n),
    sugarG: Math.round(preset.sugarG * n),
    fatG: Math.round(preset.fatG * n),
  };
}

// ===================== Paket sarapan siap pakai =====================
// Sarapan tinggi gula (roti manis + kopi susu) diganti kombinasi
// PROTEIN + SERAT + MIKRONUTRIEN. Sekali ketuk, semua isinya masuk.

export type MealCombo = {
  key: string;
  title: string;
  emoji: string;
  slot: MealSlot;
  items: { presetKey: string; qty: number }[];
};

export const BREAKFAST_COMBOS: MealCombo[] = [
  {
    key: 'a',
    title: 'Option A · Telur + Sayur + Buah',
    emoji: '🍳',
    slot: 'sarapan',
    items: [
      { presetKey: 'telur', qty: 3 },
      { presetKey: 'sayur', qty: 1 },
      { presetKey: 'pepaya', qty: 1 },
    ],
  },
  {
    key: 'b',
    title: 'Option B · Whey + Oats + Buah',
    emoji: '🥣',
    slot: 'sarapan',
    items: [
      { presetKey: 'whey', qty: 1 },
      { presetKey: 'oats', qty: 1 },
      { presetKey: 'pisang', qty: 1 },
      { presetKey: 'chia', qty: 1 },
    ],
  },
  {
    key: 'c',
    title: 'Option C · Telur + Roti Gandum + Buah',
    emoji: '🥪',
    slot: 'sarapan',
    items: [
      { presetKey: 'telur', qty: 2 },
      { presetKey: 'roti-gandum', qty: 2 },
      { presetKey: 'apel', qty: 1 },
    ],
  },
];

/** Semua baris makan dari satu paket (siap ditambahkan sekaligus). */
export function comboMeals(combo: MealCombo): Omit<Meal, 'id'>[] {
  const out: Omit<Meal, 'id'>[] = [];
  for (const item of combo.items) {
    const preset = foodPreset(item.presetKey);
    if (preset) out.push(mealFromPreset(preset, combo.slot, item.qty));
  }
  return out;
}

/** Ringkasan gizi satu paket — untuk ditampilkan di tombolnya. */
export function comboTotals(combo: MealCombo): DietTotals {
  return dietTotals({
    meals: comboMeals(combo).map((m, i) => ({ ...m, id: String(i) })),
  });
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
    (snapshot) =>
      onChange({
        // `proteinG` menyusul belakangan — catatan lama dianggap 0 protein.
        meals: ((snapshot.data()?.meals as Meal[]) ?? []).map((m) => ({
          ...m,
          proteinG: m.proteinG ?? 0,
        })),
      }),
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
