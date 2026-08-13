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

/**
 * Sesi yang WAKTUNYA SUDAH TIBA hari ini — Pagi ≥06:00, Siang ≥12:00,
 * Malam ≥18:00 (kumulatif: siang tetap membawa sisa pagi). Dini hari (<06:00)
 * hanya Malam, mengikuti aturan `slotNow` di atas.
 */
function openSlots(now: Date): HabitSlot[] {
  const h = now.getHours();
  if (h < 6) return ['night'];
  if (h < 12) return ['morning'];
  if (h < 18) return ['morning', 'daytime'];
  return ['morning', 'daytime', 'night'];
}

/**
 * Kebiasaan yang sesinya sudah tiba tapi belum dicentang hari ini — dipakai
 * badge Health di Home supaya sesi yang belum waktunya tidak ikut dihitung.
 */
export function pendingHabits(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
  now: Date,
): ScheduledHabit[] {
  const open = openSlots(now);
  return habits.filter((h) => open.includes(h.slot) && !done[h.id]);
}

/** Semua kebiasaan (semua sesi) sudah dicentang hari ini? */
export function allHabitsDone(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
): boolean {
  return habits.length > 0 && habits.every((h) => done[h.id]);
}

/**
 * Sesi yang dibuka pertama kali di tab Habits: mengikuti jam sekarang —
 * KECUALI kalau semua kebiasaan hari ini sudah beres. Kalau sudah beres tidak
 * ada lagi yang perlu dikerjakan, jadi mulai dari Pagi biar enak dibaca dari
 * awal hari.
 */
export function defaultSlot(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
  now: Date,
): HabitSlot {
  return allHabitsDone(habits, done) ? 'morning' : slotNow(now);
}

/** ID unik untuk kebiasaan baru yang dibuat pengguna. */
export function newHabitId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function scheduleRef(uid: string) {
  return doc(db, 'users', uid, 'health', 'habitSchedule');
}

export function subscribeHabitSchedule(
  uid: string,
  onChange: (habits: ScheduledHabit[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    scheduleRef(uid),
    (snapshot) =>
      onChange((snapshot.data()?.habits as ScheduledHabit[]) ?? []),
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
