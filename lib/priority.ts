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
//   { items: [{ text, done }, …], skipped }
// Resetnya GRATIS & mustahil salah: hari baru = dokumen baru yang belum ada,
// jadi tidak perlu tugas latar / cron apa pun untuk mengosongkannya.

/** Selalu tiga — itulah yang bikin "prioritas" berarti sesuatu. */
export const PRIORITY_COUNT = 3;

export type PriorityItem = { text: string; done: boolean };

/**
 * Satu hari: ketiga barisnya + tanda "hari ini sengaja dilewati".
 *
 * `skipped` menumpang di dokumen yang SAMA, bukan koleksi sendiri — ia
 * melekat pada tanggalnya persis seperti isinya, jadi hari baru = dokumen baru
 * yang belum ada, dan tandanya ikut hilang sendiri tanpa perlu dibersihkan.
 */
export type PriorityDay = { items: PriorityItem[]; skipped: boolean };

export const EMPTY_PRIORITY: PriorityItem[] = Array.from(
  { length: PRIORITY_COUNT },
  () => ({ text: '', done: false }),
);

export const EMPTY_PRIORITY_DAY: PriorityDay = {
  items: EMPTY_PRIORITY,
  skipped: false,
};

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

/** Dokumen hari itu apa adanya — isi + tandanya, dibaca satu aturan. */
function readDay(data: Record<string, unknown> | undefined): PriorityDay {
  return { items: readItems(data?.items), skipped: data?.skipped === true };
}

function dayRef(uid: string, dayId: string) {
  return doc(db, 'users', uid, 'priority', dayId);
}

export function subscribePriorityDay(
  uid: string,
  dayId: string,
  onChange: (day: PriorityDay) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    dayRef(uid, dayId),
    (snapshot) => onChange(readDay(snapshot.data())),
    onError,
  );
}

/**
 * Timpa seluruh isi hari itu (selalu 3 baris — tidak ada tambah/hapus baris).
 *
 * `merge` WAJIB sejak ada tanda dilewati: tanpa itu, tiap kali kolomnya
 * kehilangan fokus dokumennya ditulis ulang utuh dan tandanya ikut terhapus
 * diam-diam. Isinya sendiri tetap ditimpa penuh — `items` sebuah array, dan
 * merge mengganti array sebagai satu kesatuan, bukan menggabungkan isinya.
 */
export function savePriorityDay(
  uid: string,
  dayId: string,
  items: PriorityItem[],
) {
  return setDoc(dayRef(uid, dayId), { items }, { merge: true });
}

/**
 * Tandai / batalkan "hari ini dilewati".
 *
 * Yang sudah terlanjur ditulis TIDAK dihapus: melewati hari itu keputusan
 * tentang harinya, bukan perintah membuang catatannya — kalau tandanya
 * dibatalkan lagi, ketiga barisnya masih utuh seperti semula.
 */
export function setPrioritySkipped(
  uid: string,
  dayId: string,
  skipped: boolean,
) {
  return setDoc(dayRef(uid, dayId), { skipped }, { merge: true });
}

/**
 * Keadaan baris cermin "💡 Top 3 Priorities" di Habits — bentuknya sama
 * dengan `fitMirrorState` & `bibleMirrorState`, jadi Habits memperlakukan
 * ketiga baris cerminnya dengan cara yang persis sama.
 */
export function priorityMirrorState(day: PriorityDay): {
  done: boolean;
  skipped: boolean;
} {
  return {
    done: priorityFilled(day.items) === PRIORITY_COUNT,
    skipped: day.skipped,
  };
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
 * Isi pil 💡 di Home. Empat keadaan, empat bunyi yang berbeda:
 *
 *   'lewat'   → hari ini sengaja dilewati → ⏭️. Menagih hari yang sudah kamu
 *               putuskan untuk lewati itu bukan mengingatkan, cuma berisik.
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
export type PriorityState = 'lewat' | 'kurang' | 'sisa' | 'beres';

export function priorityState(day: PriorityDay): PriorityState {
  // Tanda dilewati menang atas apa pun isinya — termasuk hari yang barisnya
  // sudah terisi lalu tetap kamu lewati.
  if (day.skipped) return 'lewat';
  const filled = priorityFilled(day.items);
  if (filled < PRIORITY_COUNT) return 'kurang';
  return filled - priorityDone(day.items) === 0 ? 'beres' : 'sisa';
}

/** Tulisan di pil 💡 Home: "💡 ⏭️" · "💡 ⚠️" · "💡 2" · "💡 ✅". */
export function priorityBadgeText(day: PriorityDay): string {
  const keadaan = priorityState(day);
  if (keadaan === 'lewat') return '💡 ⏭️';
  if (keadaan === 'kurang') return '💡 ⚠️';
  if (keadaan === 'beres') return '💡 ✅';
  return `💡 ${priorityPending(day.items)}`;
}
