import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Daily Priority 💡 — TIGA hal terpenting yang harus beres hari ini.
//
// Bedanya dengan Reminder → Prioritas (lib/tasks.ts): yang di sana adalah
// daftar panjang bertenggat (P1/P2/P3) yang hidup berhari-hari. Yang di sini
// umurnya SEHARI: diisi pagi, dicoret sepanjang hari, dan hilang sendiri lewat
// tengah malam. Itu memang inti "top 3" — memaksa memilih, bukan menumpuk.
//
// Satu dokumen kecil per hari: users/{uid}/priority/{YYYY-MM-DD}
//   { items: [{ text, done }, …] }
// Resetnya GRATIS & mustahil salah: hari baru = dokumen baru yang belum ada,
// jadi tidak perlu tugas latar / cron apa pun untuk mengosongkannya.

/** Selalu tiga — itulah yang bikin "prioritas" berarti sesuatu. */
export const PRIORITY_COUNT = 3;

export type PriorityItem = { text: string; done: boolean };

export const EMPTY_PRIORITY: PriorityItem[] = Array.from(
  { length: PRIORITY_COUNT },
  () => ({ text: '', done: false }),
);

/** Rapikan apa pun yang terbaca jadi tepat 3 baris (isi kosong kalau kurang). */
function readItems(raw: unknown): PriorityItem[] {
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PRIORITY_COUNT }, (_, i) => {
    const item = list[i] as Partial<PriorityItem> | undefined;
    return {
      text: typeof item?.text === 'string' ? item.text : '',
      done: item?.done === true,
    };
  });
}

function dayRef(uid: string, dayId: string) {
  return doc(db, 'users', uid, 'priority', dayId);
}

export function subscribePriorityDay(
  uid: string,
  dayId: string,
  onChange: (items: PriorityItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    dayRef(uid, dayId),
    (snapshot) => onChange(readItems(snapshot.data()?.items)),
    onError,
  );
}

/** Timpa seluruh isi hari itu (selalu 3 baris — tidak ada tambah/hapus baris). */
export function savePriorityDay(
  uid: string,
  dayId: string,
  items: PriorityItem[],
) {
  return setDoc(dayRef(uid, dayId), { items });
}

/** Berapa baris yang sudah diisi teksnya. */
export function priorityFilled(items: PriorityItem[]): number {
  return items.filter((i) => i.text.trim().length > 0).length;
}

/** Berapa yang sudah dicoret. */
export function priorityDone(items: PriorityItem[]): number {
  return items.filter((i) => i.text.trim().length > 0 && i.done).length;
}

/**
 * Berapa prioritas hari ini yang belum beres — yang belum DICORET, entah
 * karena belum dikerjakan atau karena barisnya memang belum diisi. Baris
 * kosong ikut dihitung: mengisinya itu sendiri yang ditagih (inilah gunanya —
 * dipilih di pagi hari, bukan diingat-ingat).
 */
export function priorityPending(items: PriorityItem[]): number {
  return PRIORITY_COUNT - priorityDone(items);
}

/**
 * Isi pil 💡 di Home. Tiga keadaan, tiga bunyi yang berbeda:
 *
 *   'kurang'  → belum genap TIGA. Angkanya SENGAJA tidak ditampilkan —
 *               diganti ⚠️ — karena angka di situ terbaca sebagai "sekian
 *               yang tersisa dikerjakan", padahal yang tersisa justru
 *               KEPUTUSANNYA: masih ada baris yang belum kamu isi.
 *   'sisa'    → ketiganya sudah terisi, tinggal sekian yang belum dicoret:
 *               3 → 2 → 1.
 *   'beres'   → ketiganya dicoret → ✅.
 *
 * Kenapa 1 atau 2 baris terisi TETAP ⚠️, bukan angka: mengisinya wajib tiga,
 * sesuai namanya di daftar kebiasaan — Top 3 Priorities. Kalau baru dua yang
 * terisi lalu pilnya sudah menampilkan "2", pil itu berbohong dua kali: ia
 * terlihat seperti sudah beres memilih, dan angkanya kebetulan sama dengan
 * "tinggal 2 yang belum dicoret". ⚠️ menagih hal yang benar — isi dulu
 * ketiganya.
 */
export type PriorityState = 'kurang' | 'sisa' | 'beres';

export function priorityState(items: PriorityItem[]): PriorityState {
  const filled = priorityFilled(items);
  if (filled < PRIORITY_COUNT) return 'kurang';
  return filled - priorityDone(items) === 0 ? 'beres' : 'sisa';
}

/** Tulisan di pil 💡 Home: "💡 ⚠️" · "💡 2" · "💡 ✅". */
export function priorityBadgeText(items: PriorityItem[]): string {
  const keadaan = priorityState(items);
  if (keadaan === 'kurang') return '💡 ⚠️';
  if (keadaan === 'beres') return '💡 ✅';
  return `💡 ${priorityPending(items)}`;
}
