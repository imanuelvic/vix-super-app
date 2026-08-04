import { doc, onSnapshot, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';

// Kebiasaan (habit) TERJADWAL: beda tiap jenis hari, dibagi 3 sesi waktu
// (Pagi/Siang/Malam). Definisi kebiasaan per jenis-hari disimpan di satu
// dokumen (users/{uid}/health/habitSchedule). Centang harian tetap memakai
// health habitDays/{YYYY-MM-DD}.done (keyed by id kebiasaan).

export type HabitSlot = 'morning' | 'daytime' | 'night';

export const HABIT_SLOTS: { key: HabitSlot; label: string; emoji: string }[] = [
  { key: 'morning', label: 'Pagi', emoji: '🌅' },
  { key: 'daytime', label: 'Siang', emoji: '🌤️' },
  { key: 'night', label: 'Malam', emoji: '🌙' },
];

export function slotMeta(slot: HabitSlot) {
  return HABIT_SLOTS.find((s) => s.key === slot)!;
}

// Jenis hari sesuai rutinitas: tiap hari kerja bisa beda, akhir pekan sendiri.
export type DayType =
  | 'monday'
  | 'tueThu'
  | 'wed'
  | 'fri'
  | 'satHoliday'
  | 'sunday';

export const DAY_TYPES: { key: DayType; label: string }[] = [
  { key: 'monday', label: 'Senin' },
  { key: 'tueThu', label: 'Selasa & Kamis' },
  { key: 'wed', label: 'Rabu' },
  { key: 'fri', label: 'Jumat' },
  { key: 'satHoliday', label: 'Sabtu & Libur' },
  { key: 'sunday', label: 'Minggu' },
];

export function dayTypeLabel(dt: DayType): string {
  return DAY_TYPES.find((d) => d.key === dt)!.label;
}

export type ScheduledHabit = { id: string; label: string; slot: HabitSlot };
export type HabitSchedule = Record<DayType, ScheduledHabit[]>;

/** Jenis hari untuk sebuah tanggal (getDay: 0=Minggu .. 6=Sabtu). */
export function dayTypeOf(date: Date): DayType {
  switch (date.getDay()) {
    case 0:
      return 'sunday';
    case 1:
      return 'monday';
    case 3:
      return 'wed';
    case 5:
      return 'fri';
    case 6:
      return 'satHoliday';
    default:
      return 'tueThu'; // Selasa (2) & Kamis (4)
  }
}

/** Sesi waktu sekarang (untuk reminder Home). Pagi <11, Siang 11–18, Malam ≥18. */
export function slotNow(now: Date): HabitSlot {
  const h = now.getHours();
  if (h < 11) return 'morning';
  if (h < 18) return 'daytime';
  return 'night';
}

/** ID unik untuk kebiasaan baru yang dibuat pengguna. */
export function newHabitId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================================
// Seed rutinitas (dari to-do list HTML Imanuel). Dipakai sebagai isi awal;
// begitu pengguna mengedit sebuah jenis-hari, versinya disimpan & menggantikan
// seed untuk hari itu.
// ============================================================================

let _seedCount = 0;
function mk(slot: HabitSlot, labels: string[]): ScheduledHabit[] {
  return labels.map((label) => ({ id: `seed${_seedCount++}`, label, slot }));
}

// Blok pembuka pagi (rohani) — sama di semua hari, hanya jam bangun beda.
const morningOpen = (wake: string) => [
  wake,
  '📵 No Phone 30 Min',
  '🫖 Drink Warm Water',
  '🍞 Holy Communion',
  '✝️ Revive + IG Story',
  '🙏 5 Min Gratitude',
  '🙏 5 Min Prayer',
  '🗣️ Declare Intention',
  '🛏️ Make Your Bed',
];
const morningClose = ['🥚 Eat Eggs + Whey', '💊 Take Vitamin C', '🚿 Take a Shower'];

const daytimeWeekday = [
  '💧 Drink 1L Water',
  '📖 Share Bible Verse',
  '📲 Check-In Platform',
  '🦉 Play Duolingo',
  '🎧 Listen to Podcast',
  '🍽️ Eat Mindfully',
  '🐟 Take Fish Oil',
  '🚶 > 5.000 Steps',
  '📚 Reading / Learning',
  '💪 Drink Creatine',
  '🧘 Stretching + News',
  '☕ Caffè Americano',
  '🤗 Encourage Someone',
  '🤔 5 Min Reflection',
  '🏃 Treadmill High Incline',
];
const daytimeWeekend = [
  '💧 Drink 1L Water',
  '📖 Share Bible Verse',
  '📲 Check-In Platform',
  '🦉 Play Duolingo',
  '🎧 Listen to Podcast',
  '🍽️ Eat Mindfully',
  '🐟 Take Fish Oil',
  '🚶 Day Walk',
  '📚 Reading / Learning',
  '🧘 Stretching + News',
  '☕ Caffè Americano',
  '🤗 Encourage Someone',
  '🤔 5 Min Reflection',
];

const nightWeekday = [
  '🍽️ No Eat After 20:00',
  '🚿 Take a Shower',
  '🧴 Scrub + Lotion',
  '🫖 Fill Warm Water',
  '📝 Prepare Tomorrow',
  '📵 No Phone 30 Min',
  '📖 Bible Reading',
  '📖 Memorize Verse',
  '🎶 Worship Song',
  '🧘 Stretching',
  '📓 Daily Reflection',
  '🙏 Ask Forgiveness',
  '😴 Sleep 23:00 PM',
];
const nightWeekend = [
  '🍽️ No Eat After 20:00',
  '🚿 Take a Shower',
  '📝 Prepare Tomorrow',
  '🫖 Fill Warm Water',
  '👨‍👩‍👧 Family Prayer Time',
  '📵 No Phone 30 Min',
  '📖 Bible Reading',
  '📖 Memorize Verse',
  '🎶 Worship Song',
  '🧘 Stretching',
  '📓 Daily Reflection',
  '🙏 Ask Forgiveness',
  '😴 Sleep 8 Hours',
];

export const HABIT_SEED: HabitSchedule = {
  // Senin — pagi tanpa olahraga (jurnal refleksi).
  monday: [
    ...mk('morning', [
      ...morningOpen('⏰ Wake Up 6:30 AM'),
      '✍️ Reflection Journal',
      ...morningClose,
    ]),
    ...mk('daytime', daytimeWeekday),
    ...mk('night', nightWeekday),
  ],
  // Selasa & Kamis — pagi olahraga.
  tueThu: [
    ...mk('morning', [
      ...morningOpen('⏰ Wake Up 6:30 AM'),
      '🏃 Jogging + News',
      '🏋️ Strength Training',
      ...morningClose,
    ]),
    ...mk('daytime', daytimeWeekday),
    ...mk('night', nightWeekday),
  ],
  // Rabu — mirip Selasa/Kamis (bisa dikustom sendiri).
  wed: [
    ...mk('morning', [
      ...morningOpen('⏰ Wake Up 6:30 AM'),
      '🏃 Jogging + News',
      '🏋️ Strength Training',
      ...morningClose,
    ]),
    ...mk('daytime', daytimeWeekday),
    ...mk('night', nightWeekday),
  ],
  // Jumat — pagi olahraga.
  fri: [
    ...mk('morning', [
      ...morningOpen('⏰ Wake Up 6:30 AM'),
      '🏃 Jogging + News',
      '🏋️ Strength Training',
      ...morningClose,
    ]),
    ...mk('daytime', daytimeWeekday),
    ...mk('night', nightWeekday),
  ],
  // Sabtu & Libur — bangun lebih siang, santai.
  satHoliday: [
    ...mk('morning', [
      ...morningOpen('⏰ Wake Up 8:30 AM'),
      '🫖 Fill Warm Water',
      '📰 News',
      ...morningClose,
    ]),
    ...mk('daytime', daytimeWeekend),
    ...mk('night', nightWeekend),
  ],
  // Minggu — bangun siang + timbang berat.
  sunday: [
    ...mk('morning', [
      ...morningOpen('⏰ Wake Up 8:30 AM'),
      '⚖️ Weigh Yourself',
      '🫖 Fill Warm Water',
      '📰 News',
      ...morningClose,
    ]),
    ...mk('daytime', daytimeWeekend),
    ...mk('night', nightWeekend),
  ],
};

/** Lengkapi jadwal tersimpan dengan seed untuk jenis-hari yang belum diedit. */
function mergeSchedule(saved?: Partial<HabitSchedule> | null): HabitSchedule {
  const out = {} as HabitSchedule;
  for (const { key } of DAY_TYPES) {
    out[key] = saved?.[key] ?? HABIT_SEED[key];
  }
  return out;
}

/** Jadwal default (semua seed) — dipakai sebagai state awal sebelum Firestore. */
export const DEFAULT_SCHEDULE: HabitSchedule = mergeSchedule();

// ===== Firestore: satu dokumen jadwal per user =====
function scheduleRef(uid: string) {
  return doc(db, 'users', uid, 'health', 'habitSchedule');
}

export function subscribeHabitSchedule(
  uid: string,
  onChange: (schedule: HabitSchedule) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    scheduleRef(uid),
    (snapshot) => {
      const saved = snapshot.data()?.schedule as
        | Partial<HabitSchedule>
        | undefined;
      onChange(mergeSchedule(saved));
    },
    onError,
  );
}

/** Simpan daftar kebiasaan SATU jenis-hari (ganti seluruhnya untuk hari itu). */
export function saveDayHabits(
  uid: string,
  dayType: DayType,
  habits: ScheduledHabit[],
) {
  return setDoc(
    scheduleRef(uid),
    { schedule: { [dayType]: habits } },
    { merge: true },
  );
}

/** Kebiasaan satu jenis-hari, dikelompokkan per sesi (urutan Pagi→Siang→Malam). */
export function habitsBySlot(
  habits: ScheduledHabit[],
): Record<HabitSlot, ScheduledHabit[]> {
  return {
    morning: habits.filter((h) => h.slot === 'morning'),
    daytime: habits.filter((h) => h.slot === 'daytime'),
    night: habits.filter((h) => h.slot === 'night'),
  };
}
