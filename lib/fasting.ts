import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate } from './format';
import { dayDocId } from './health';

// Puasa 🍽️ — satu dokumen per PERIODE puasa: users/{uid}/fasting/{id}
//   { title, prayer, rules, answer, startId, endId, days: { dayId: {...} } }
//
// Hari-harinya tidak disimpan satu per satu sebagai dokumen: cukup satu map
// `days` di dalam dokumen periode itu (puasa paling lama pun cuma puluhan
// hari), jadi buka layar Puasa = 1 read, bukan puluhan.

/** Catatan satu hari puasa. */
export type FastingDay = {
  prayer: string; // pokok doa khusus hari itu
  done: boolean; // ✅ dicentang = puasa hari itu berhasil
  answer: string; // jawaban doa / catatan hari itu
};

export type FastingPlan = {
  id: string;
  title: string; // nama puasanya, mis. "Puasa Daniel 7 Hari"
  prayer: string; // pokok doa utama sepanjang puasa
  rules: string; // peraturan puasa saya (jam, jenis makanan, dll)
  answer: string; // hasil / jawaban doa keseluruhan
  startId: string; // "YYYY-MM-DD" mulai
  endId: string; // "YYYY-MM-DD" selesai (inklusif)
  days: Record<string, FastingDay>;
};

export const EMPTY_FASTING_DAY: FastingDay = {
  prayer: '',
  done: false,
  answer: '',
};

/** ID unik untuk periode puasa baru. */
export function newFastingId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// Batas wajar sebuah periode puasa — menjaga daftar hari tidak meledak kalau
// tanggal selesai salah ketik jauh sekali.
const MAX_FASTING_DAYS = 400;

/** Semua dayId dari mulai sampai selesai (inklusif, urut maju). */
export function fastingDayIds(startId: string, endId: string): string[] {
  const ids: string[] = [];
  if (!startId || !endId) return ids;
  const end = dayIdToDate(endId);
  const cursor = dayIdToDate(startId);
  while (cursor <= end && ids.length < MAX_FASTING_DAYS) {
    ids.push(dayDocId(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return ids;
}

/** Catatan satu hari (kosong kalau belum pernah diisi). */
export function fastingDay(plan: FastingPlan, dayId: string): FastingDay {
  return plan.days?.[dayId] ?? EMPTY_FASTING_DAY;
}

/** Berapa hari sudah dicentang berhasil, dari total hari puasanya. */
export function fastingProgress(plan: FastingPlan): {
  done: number;
  total: number;
} {
  const ids = fastingDayIds(plan.startId, plan.endId);
  return {
    done: ids.filter((id) => plan.days?.[id]?.done).length,
    total: ids.length,
  };
}

/** Hari ini masih di dalam rentang puasa ini? */
export function fastingActive(plan: FastingPlan, now: Date): boolean {
  const today = dayDocId(now);
  return today >= plan.startId && today <= plan.endId;
}

/**
 * Puasa yang SEDANG berjalan hari ini (null kalau tidak ada). Kalau kebetulan
 * ada lebih dari satu, ambil yang paling baru dimulai.
 */
export function activeFasting(
  plans: FastingPlan[],
  now: Date,
): FastingPlan | null {
  return plans.find((p) => fastingActive(p, now)) ?? null;
}

/** Hari ke berapa (1-based); 0 kalau tanggalnya di luar rentang. */
export function fastingDayNumber(plan: FastingPlan, dayId: string): number {
  return fastingDayIds(plan.startId, plan.endId).indexOf(dayId) + 1;
}

function plansRef(uid: string) {
  return collection(db, 'users', uid, 'fasting');
}

/** Semua periode puasa, terbaru dulu. */
export function subscribeFastingPlans(
  uid: string,
  onChange: (plans: FastingPlan[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(plansRef(uid), orderBy('startId', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            prayer: (data.prayer as string) ?? '',
            rules: (data.rules as string) ?? '',
            answer: (data.answer as string) ?? '',
            startId: (data.startId as string) ?? '',
            endId: (data.endId as string) ?? '',
            days: (data.days as Record<string, FastingDay>) ?? {},
          };
        }),
      );
    },
    onError,
  );
}

/** Simpan/ubah keterangan periode puasa (tanpa menyentuh catatan harian). */
export function saveFastingPlan(
  uid: string,
  id: string,
  info: Pick<
    FastingPlan,
    'title' | 'prayer' | 'rules' | 'startId' | 'endId' | 'answer'
  >,
) {
  return setDoc(doc(plansRef(uid), id), info, { merge: true });
}

/** Simpan catatan SATU hari puasa (merge — hari lain tidak tersentuh). */
export function saveFastingDay(
  uid: string,
  id: string,
  dayId: string,
  day: FastingDay,
) {
  return setDoc(doc(plansRef(uid), id), { days: { [dayId]: day } }, { merge: true });
}

/** Hapus satu periode puasa — PERMANEN, beserta semua catatan hariannya. */
export function deleteFastingPlan(uid: string, id: string) {
  return deleteDoc(doc(plansRef(uid), id));
}
