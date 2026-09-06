import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate } from './format';
import { dayDocId } from './health';
import { liveList } from './liveDoc';

// His Promise 🚩 — janji Tuhan yang kamu pegang.
//
// Satu dokumen per janji: users/{uid}/promises/{id}
//
// Bedanya dengan Revive (renungan harian) dan Catatan Khotbah (satu per
// Minggu): janji TIDAK terikat hari. Ia ditulis sekali, lalu ditengok berkali
// -kali — kadang bertahun-tahun — sampai suatu hari benar-benar digenapi. Itu
// sebabnya yang disimpan bukan "tanggalnya kapan" melainkan TIGA tanggal yang
// menceritakan perjalanannya: kapan ditulis, kapan terakhir diperbarui, dan
// kapan doanya terjawab.
//
// Ketiganya disimpan sebagai dayId ("YYYY-MM-DD"), bukan Timestamp: yang
// dicari kalau membacanya lagi memang HARINYA, bukan jam berapa — dan dayId
// bisa langsung diurutkan sebagai teks biasa.

export type Promise = {
  id: string;
  /** Janji Tuhan apa. Ini judulnya — satu-satunya yang wajib diisi. */
  promise: string;
  /** Fakta ayatnya di mana, mis. "Yeremia 29:11". */
  verse: string;
  /** Pergumulan yang relate dengan janji ini (opsional). */
  struggle: string;
  /** Keterangan/ceritanya — bagaimana janji ini kamu terima & pegang. */
  story: string;
  /** Ada doa khusus perihal janji ini? */
  prayed: boolean;
  /** Kapan doanya terjawab (dayId). Kosong = belum, atau memang tak didoakan. */
  answeredId: string;
  /** Kapan ditulis pertama kali (dayId). */
  createdId: string;
  /** Kapan terakhir diperbarui (dayId). */
  updatedId: string;
};

/** Isian kosong untuk janji baru. */
export const EMPTY_PROMISE: Omit<Promise, 'id' | 'createdId' | 'updatedId'> = {
  promise: '',
  verse: '',
  struggle: '',
  story: '',
  prayed: false,
  answeredId: '',
};

/** ID unik untuk janji baru. Bentuknya sama dengan periode puasa & sesi futsal. */
export function newPromiseId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Sudah digenapi? Yaitu tanggal terjawabnya sudah diisi.
 *
 * Sengaja TIDAK memakai `prayed`: janji bisa saja digenapi tanpa pernah kamu
 * doakan secara khusus — dan itu justru cerita yang paling layak dicatat.
 */
export function promiseAnswered(p: Promise): boolean {
  return p.answeredId.length > 0;
}

/** Berapa hari dari ditulis sampai terjawab (null = belum terjawab). */
export function promiseWaitDays(p: Promise): number | null {
  if (!promiseAnswered(p) || !p.createdId) return null;
  const dari = dayIdToDate(p.createdId).getTime();
  const sampai = dayIdToDate(p.answeredId).getTime();
  return Math.max(0, Math.round((sampai - dari) / 86_400_000));
}

/** Berapa janji yang sudah digenapi, dari totalnya. */
export function promiseProgress(list: Promise[]): {
  done: number;
  total: number;
} {
  return { done: list.filter(promiseAnswered).length, total: list.length };
}

function promisesRef(uid: string) {
  return collection(db, 'users', uid, 'promises');
}

/**
 * Semua janji, yang paling baru DITULIS lebih dulu.
 *
 * Sengaja diurutkan dari `createdId`, bukan `updatedId`: kalau memakai yang
 * terakhir diperbarui, membetulkan satu huruf pada janji lama melemparnya ke
 * puncak daftar — dan urutan yang berubah tiap kali disunting membuat daftar
 * ini mustahil dihafal letaknya.
 */
export function subscribePromises(
  uid: string,
  onChange: (list: Promise[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(promisesRef(uid), orderBy('createdId', 'desc'), limit(200));
  return liveList<Promise>(q, onChange, onError, (d) => {
    const data = d.data();
    return {
      id: d.id,
      promise: (data.promise as string) ?? '',
      verse: (data.verse as string) ?? '',
      struggle: (data.struggle as string) ?? '',
      story: (data.story as string) ?? '',
      prayed: data.prayed === true,
      answeredId: (data.answeredId as string) ?? '',
      createdId: (data.createdId as string) ?? '',
      updatedId: (data.updatedId as string) ?? '',
    };
  });
}

/**
 * Simpan janji (baru atau yang diubah).
 *
 * `createdId` hanya ditulis saat janji itu BARU — kalau ikut diperbarui tiap
 * kali disimpan, "kapan aku menerima janji ini" berubah jadi "kapan terakhir
 * aku menyuntingnya", dan justru tanggal itulah yang paling ingin diingat.
 */
export function savePromise(
  uid: string,
  id: string,
  isi: Omit<Promise, 'id' | 'createdId' | 'updatedId'>,
  { baru, now = new Date() }: { baru: boolean; now?: Date },
) {
  const hariIni = dayDocId(now);
  return setDoc(
    doc(promisesRef(uid), id),
    {
      ...isi,
      // Tanggal terjawab cuma berarti kalau memang ada doanya.
      answeredId: isi.prayed ? isi.answeredId : '',
      ...(baru ? { createdId: hariIni } : {}),
      updatedId: hariIni,
    },
    { merge: true },
  );
}

/** Hapus satu janji — PERMANEN, tak ada arsip. */
export function deletePromise(uid: string, id: string) {
  return deleteDoc(doc(promisesRef(uid), id));
}
