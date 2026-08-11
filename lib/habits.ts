import { doc, onSnapshot, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';

// Kebiasaan (habit) harian dibagi 3 sesi waktu (Pagi/Siang/Malam). SATU daftar
// kebiasaan dipakai untuk SEMUA hari (sama tiap hari — biar simple). Disimpan di
// dokumen users/{uid}/health/habitSchedule (field `habits`). Centang harian
// tetap memakai health habitDays/{YYYY-MM-DD}.done (keyed by id kebiasaan).

export type HabitSlot = 'morning' | 'daytime' | 'night';

export const HABIT_SLOTS: { key: HabitSlot; label: string; emoji: string }[] = [
  { key: 'morning', label: 'Pagi', emoji: '🌅' },
  { key: 'daytime', label: 'Siang', emoji: '🌤️' },
  { key: 'night', label: 'Malam', emoji: '🌙' },
];

export function slotMeta(slot: HabitSlot) {
  return HABIT_SLOTS.find((s) => s.key === slot)!;
}

export type ScheduledHabit = { id: string; label: string; slot: HabitSlot };

/**
 * Sesi waktu sekarang (untuk reminder Dashboard & tab default Habits).
 * Pagi 06:00–11:59 · Siang 12:00–17:59 · Malam ≥18:00.
 * Dini hari (<06:00) masih dihitung Malam — lanjutan malam sebelumnya.
 */
export function slotNow(now: Date): HabitSlot {
  const h = now.getHours();
  if (h < 6) return 'night';
  if (h < 12) return 'morning';
  if (h < 18) return 'daytime';
  return 'night';
}

/** ID unik untuk kebiasaan baru yang dibuat pengguna. */
export function newHabitId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Seed rutinitas (dari to-do list HTML Imanuel) — dipakai sebagai isi awal.
// SATU daftar untuk semua hari; pengguna bisa menambah/ubah/urutkan/hapus.
// ============================================================================

let _seedCount = 0;
function mk(slot: HabitSlot, labels: string[]): ScheduledHabit[] {
  return labels.map((label) => ({ id: `seed${_seedCount++}`, label, slot }));
}

const morningLabels = [
  '⏰ Wake Up 6:00 AM',
  '🫖 Drink Warm Water',
  '🍞 Holy Communion',
  '✝️ Revive + IG Story',
  '🛏️ Make Your Bed',
  '🏃 Jogging + News',
  '🥚 Eat Eggs + Whey',
  '💊 Take Vitamin C',
];

const daytimeLabels = [
  '📲 Check-In Platform',
  '🦉 Play Duolingo',
  '🍽️ Eat Mindfully',
  '🐟 Take Fish Oil',
  '⚡ Drink Creatine',
  '☕ Caffè Americano',
  '🤗 Encourage Someone',
  '💪🏻 Dumbbell',
];

const nightLabels = [
  '🧴 Scrub + Lotion',
  '🫖 Fill Warm Water',
  '📝 Prepare Tomorrow',
  '📖 Bible Reading',
  '📖 Memorize Verse',
  '🙏 Ask Forgiveness',
  '😴 Sleep 23:00 PM',
];

/**
 * Daftar bawaan — HANYA dipakai sekali sebagai bootstrap untuk akun yang belum
 * punya data kebiasaan sendiri. Begitu dipakai, daftarnya langsung DITULIS ke
 * Firestore (lihat `subscribeHabitSchedule`) sehingga menjadi milik pengguna
 * dan bisa diubah/dihapus manual. Setelah tersimpan, konstanta ini tidak pernah
 * dipakai lagi dan aman dihapus dari kode.
 */
export const HABIT_SEED: ScheduledHabit[] = [
  ...mk('morning', morningLabels),
  ...mk('daytime', daytimeLabels),
  ...mk('night', nightLabels),
];

// ===== Firestore: satu dokumen daftar kebiasaan per user =====
function scheduleRef(uid: string) {
  return doc(db, 'users', uid, 'health', 'habitSchedule');
}

// Penanda agar bootstrap daftar bawaan hanya ditulis SEKALI per sesi aplikasi
// (beberapa layar berlangganan daftar yang sama).
const bootstrapped = new Set<string>();

export function subscribeHabitSchedule(
  uid: string,
  onChange: (habits: ScheduledHabit[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    scheduleRef(uid),
    (snapshot) => {
      const saved = snapshot.data()?.habits as ScheduledHabit[] | undefined;
      if (saved && saved.length > 0) {
        onChange(saved);
        return;
      }
      // Belum punya data sendiri → pakai daftar bawaan SEKALI, lalu simpan ke
      // Firestore supaya jadi milik pengguna (bisa diubah/dihapus manual).
      onChange(HABIT_SEED);
      if (!bootstrapped.has(uid)) {
        bootstrapped.add(uid);
        saveHabits(uid, HABIT_SEED).catch(() => bootstrapped.delete(uid));
      }
    },
    onError,
  );
}

/** Simpan seluruh daftar kebiasaan (berlaku untuk semua hari). */
export function saveHabits(uid: string, habits: ScheduledHabit[]) {
  return setDoc(scheduleRef(uid), { habits }, { merge: true });
}

/** Kebiasaan dikelompokkan per sesi (urutan Pagi→Siang→Malam). */
export function habitsBySlot(
  habits: ScheduledHabit[],
): Record<HabitSlot, ScheduledHabit[]> {
  return {
    morning: habits.filter((h) => h.slot === 'morning'),
    daytime: habits.filter((h) => h.slot === 'daytime'),
    night: habits.filter((h) => h.slot === 'night'),
  };
}
