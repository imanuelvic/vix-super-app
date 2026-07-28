import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Morning Task 🌅 — rutinitas pagi tiap jam 04.00–08.00. Checklist harian
// (reset otomatis tiap ganti hari lewat id dokumen tanggal, seperti habitDays).
// Disimpan per hari: users/{uid}/morningDays/{YYYY-MM-DD} → { done: {} }.

export type MorningTask = { id: string; label: string };

// Urutan sesuai rutinitas pagi yang diinginkan.
export const MORNING_TASKS: MorningTask[] = [
  { id: 'worship', label: '🙏 Worship & Doa' },
  { id: 'coding-5', label: '💻 Programming (5 menit)' },
  { id: 'olahraga', label: '🏃 Olahraga' },
  { id: 'coding', label: '💻 Programming' },
  { id: 'baca-buku', label: '📚 Baca Buku' },
  { id: 'mandi', label: '🚿 Mandi' },
];

// Jendela wajib menyelesaikan morning task: 04.00–08.00.
export const MORNING_START_HOUR = 4;
export const MORNING_END_HOUR = 8;

/** True kalau sekarang di dalam jendela pagi (04.00–08.00). */
export function morningWindowActive(now: Date): boolean {
  const h = now.getHours();
  return h >= MORNING_START_HOUR && h < MORNING_END_HOUR;
}

export type MorningDayMap = Record<string, boolean>;

export function subscribeMorningDay(
  uid: string,
  dayId: string,
  onChange: (done: MorningDayMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'morningDays', dayId);
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.done as MorningDayMap) ?? {});
    },
    onError,
  );
}

export function setMorningDone(
  uid: string,
  dayId: string,
  taskId: string,
  done: boolean,
) {
  const ref = doc(db, 'users', uid, 'morningDays', dayId);
  // merge: hanya task ini yang berubah, centang lain tetap.
  return setDoc(ref, { done: { [taskId]: done } }, { merge: true });
}
