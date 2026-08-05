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
import { dayDocId } from './health';

// Catatan Khotbah ⛪ — catatan dari khotbah ibadah Minggu di NDC.
// SATU catatan per hari Minggu: id dokumen = dayId Minggunya, jadi tidak
// mungkin ada dua catatan untuk Minggu yang sama. Hanya bisa DITAMBAH pada
// hari Minggu (tombolnya muncul khusus hari itu).
// Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.

export type SermonNote = {
  id: string; // dayId Minggu "YYYY-MM-DD"
  title: string; // judul khotbah
  preacher: string; // pendeta yang khotbah
  serviceTime: string; // ibadah jam berapa
  quote: string; // hikmat / quote dari khotbah
  reflection: string; // perenungan yang saya dapat
  date: Timestamp;
};

export function subscribeSermons(
  uid: string,
  onChange: (notes: SermonNote[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(
    collection(db, 'users', uid, 'sermons'),
    orderBy('date', 'desc'),
    limit(90),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<SermonNote, 'id'>),
        })),
      );
    },
    onError,
  );
}

export function saveSermon(
  uid: string,
  sundayId: string,
  data: {
    title: string;
    preacher: string;
    serviceTime: string;
    quote: string;
    reflection: string;
    date: Date;
  },
) {
  return setDoc(doc(db, 'users', uid, 'sermons', sundayId), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function deleteSermon(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'sermons', id));
}

// ===================== Helper hari & reminder =====================

/** Hari ini hari Minggu? (0 = Minggu di Date JS). */
export function isSunday(now: Date): boolean {
  return now.getDay() === 0;
}

/**
 * Masih boleh diedit? Catatan khotbah TERKUNCI mulai hari SELASA setelah ibadah
 * Minggu — jadi cuma bisa dirapikan pada Minggu & Senin, setelah itu jadi arsip
 * (view + share saja). id/date khotbah = hari Minggunya, jadi Selasa = +2 hari.
 */
export function sermonEditable(sundayId: string, now: Date): boolean {
  const lock = dayIdToDate(sundayId); // Minggu, 00:00 lokal
  lock.setDate(lock.getDate() + 2); // → Selasa, 00:00 (mulai terkunci)
  return now.getTime() < lock.getTime();
}

/** dayId hari Minggu terakhir (Minggu minggu ini — hari ini kalau Minggu). */
export function currentSundayId(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay()); // mundur ke Minggu minggu ini
  return dayDocId(d);
}

/**
 * Reminder khotbah aktif: setiap hari RABU & JUMAT, jam 12:30–17:30.
 * (Pengingat merenungkan lagi khotbah Minggu di tengah minggu.)
 */
export function sermonReminderActive(now: Date): boolean {
  const day = now.getDay();
  if (day !== 3 && day !== 5) return false; // 3 = Rabu, 5 = Jumat
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 12 * 60 + 30 && mins <= 17 * 60 + 30;
}
