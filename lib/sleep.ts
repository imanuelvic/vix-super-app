import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate } from './format';

// Tidur 😴 — target 6–8 jam per malam.
// SATU dokumen per malam, id = tanggal BANGUN: users/{uid}/sleep/{YYYY-MM-DD}
//   { bedMinutes, wakeMinutes, minutes, note, date }
//
// Jam disimpan sebagai MENIT DARI TENGAH MALAM (23.30 → 1410) supaya gampang
// dihitung & tidak tergantung zona waktu. Tidur yang melewati tengah malam
// (tidur 23.30, bangun 06.30) otomatis dihitung benar.

// CDC: orang dewasa butuh MINIMAL 7 jam per malam, dan konsistensi jam
// tidur/bangun sama pentingnya dengan lamanya.
export const SLEEP_MIN_HOURS = 7;
export const SLEEP_MAX_HOURS = 9;

export type SleepNight = {
  id: string; // dayId tanggal BANGUN
  bedMinutes: number; // jam tidur, menit dari 00.00
  wakeMinutes: number; // jam bangun, menit dari 00.00
  minutes: number; // lama tidur (menit)
  note: string;
};

/** Lama tidur dari jam tidur → jam bangun; lewat tengah malam ikut dihitung. */
export function sleepMinutes(bedMinutes: number, wakeMinutes: number): number {
  const raw = wakeMinutes - bedMinutes;
  return raw > 0 ? raw : raw + 24 * 60;
}

/** 1410 → "23.30" (pemisah titik seperti format jam lain di app ini). */
export function formatClock(minutesOfDay: number): string {
  const h = Math.floor(minutesOfDay / 60) % 24;
  const m = minutesOfDay % 60;
  return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

/** 445 menit → "7j 25m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}j` : `${h}j ${m}m`;
}

/** Menit dari sebuah Date (untuk hasil time picker). */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Date hari ini dengan jam tertentu — untuk mengisi nilai awal time picker. */
export function dateAtMinutes(minutesOfDay: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
  return d;
}

export type SleepTone = 'kurang' | 'pas' | 'lebih';

export function sleepTone(minutes: number): SleepTone {
  if (minutes < SLEEP_MIN_HOURS * 60) return 'kurang';
  if (minutes > SLEEP_MAX_HOURS * 60) return 'lebih';
  return 'pas';
}

export const SLEEP_TONE_LABEL: Record<SleepTone, string> = {
  kurang: '😵 Kurang tidur',
  pas: '✅ Pas 6–8 jam',
  lebih: '😪 Kelebihan',
};

/** Rata-rata lama tidur dari `count` malam terakhir (0 kalau belum ada data). */
export function sleepAverage(nights: SleepNight[], count: number): number {
  const list = nights.slice(0, count);
  if (list.length === 0) return 0;
  return Math.round(
    list.reduce((sum, n) => sum + n.minutes, 0) / list.length,
  );
}

/** Berapa malam terakhir yang lamanya masuk rentang 6–8 jam. */
export function sleepGoodNights(nights: SleepNight[], count: number): number {
  return nights.slice(0, count).filter((n) => sleepTone(n.minutes) === 'pas')
    .length;
}

// ===================== Firestore =====================

function sleepCollection(uid: string) {
  return collection(db, 'users', uid, 'sleep');
}

export function subscribeSleepNights(
  uid: string,
  onChange: (nights: SleepNight[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(sleepCollection(uid), orderBy('date', 'desc'), limit(60));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            bedMinutes: (data.bedMinutes as number) ?? 0,
            wakeMinutes: (data.wakeMinutes as number) ?? 0,
            minutes: (data.minutes as number) ?? 0,
            note: (data.note as string) ?? '',
          };
        }),
      );
    },
    onError,
  );
}

export function saveSleepNight(
  uid: string,
  dayId: string,
  data: { bedMinutes: number; wakeMinutes: number; note: string },
) {
  return setDoc(doc(db, 'users', uid, 'sleep', dayId), {
    ...data,
    minutes: sleepMinutes(data.bedMinutes, data.wakeMinutes),
    date: Timestamp.fromDate(dayIdToDate(dayId)),
  });
}

/** Hapus catatan tidur satu malam — PERMANEN. */
export function deleteSleepNight(uid: string, dayId: string) {
  return deleteDoc(doc(db, 'users', uid, 'sleep', dayId));
}
