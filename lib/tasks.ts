import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveList } from './liveDoc';
import { daysBetween, formatHourMinute } from './format';
import { dayDocId } from './health';

// Kategori task yang sudah pasti — ganti kategori = ganti to-do list.
export type TaskCategory =
  | 'personal'
  | 'work'
  | 'ministry'
  | 'learning'
  | 'fun';

export const TASK_CATEGORIES: {
  key: TaskCategory;
  label: string;
  icon: string;
}[] = [
  { key: 'personal', label: 'PERSONAL', icon: '👤' },
  { key: 'work', label: 'WORK', icon: '💼' },
  { key: 'ministry', label: 'MINISTRY', icon: '🙏' },
  // Emoji sama dengan fitur Fun & Recreation 🎉 biar gampang dikenali.
  { key: 'fun', label: 'FUN', icon: '🎉' },
  { key: 'learning', label: 'LEARNING', icon: '📚' },
];

// Set key kategori yang masih berlaku — untuk membersihkan task "yatim".
const VALID_CATEGORY_KEYS = new Set<string>(TASK_CATEGORIES.map((c) => c.key));

export type Task = {
  id: string;
  title: string;
  done: boolean;
  category: TaskCategory;
  dayId: string; // "YYYY-MM-DD" — task milik hari apa
  /** Catatan/detail di bawah judul (2 Okt 2026). Data lama tidak punya. */
  note?: string;
  /**
   * ⏰ Jam pengingat "HH:MM" (24 jam), opsional (2 Okt 2026). Ada jamnya =
   * HP berbunyi tepat di jam itu pada tanggal `dayId` (lib/notify.ts).
   * null / tidak ada = tanpa jam, ikut pengingat kelompok seperti dulu.
   */
  time?: string | null;
  /**
   * Berapa kali task ini sudah ikut rollover (dipindah dari hari yang lewat
   * ke hari ini). Belum ditampilkan; dicatat dulu supaya kebiasaan menunda
   * bisa dibaca dari datanya nanti. Data lama tidak punya = 0.
   */
  carried?: number;
  createdAt: Timestamp | null;
};

/** "07:05" → { hour: 7, minute: 5 }. Apa pun yang bukan jam sah → null. */
export function parseTaskTime(
  time: string | null | undefined,
): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time ?? '');
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour < 24 && minute < 60 ? { hour, minute } : null;
}

/** Jam dari roda TimeField → "HH:MM", bentuk yang disimpan. */
export function taskTimeOf(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** "07:05" → "07.05", gaya jam Indonesia seperti formatTime. '' kalau tanpa jam. */
export function taskTimeLabel(time: string | null | undefined): string {
  const t = parseTaskTime(time);
  return t ? formatHourMinute(t.hour, t.minute) : '';
}

/**
 * Urutan dalam satu hari: yang BERJAM dulu, urut jamnya; sesudahnya yang
 * tanpa jam, urut dibuat (yang dibuat duluan di atas). `list` datang dari
 * langganan yang terurut terbaru-dulu, jadi dibalik dulu, lalu diurut stabil.
 */
export function orderDayTasks(list: Task[]): Task[] {
  const kunci = (t: Task) => {
    const j = parseTaskTime(t.time);
    return j ? j.hour * 60 + j.minute : 24 * 60;
  };
  return [...list].reverse().sort((a, b) => kunci(a) - kunci(b));
}

// Semua task milik satu user disimpan di: users/{uid}/tasks
// Struktur ini bikin security rules gampang: kunci data ke pemiliknya.
function tasksCollection(uid: string) {
  return collection(db, 'users', uid, 'tasks');
}

// Batas baca daftar task (27 Sep 2026). Koleksi ini SUDAH membersihkan dirinya
// sendiri: tiap kali layar Task dibuka, task hari lewat yang belum selesai
// dipindah ke hari ini dan yang sudah selesai DIHAPUS permanen (rolloverTasks),
// dan hari yang sudah lewat tidak digambar sama sekali. Jadi isinya cuma hari
// ini + hari depan, puluhan dokumen. 500 = jauh di atas itu, termasuk kalau
// pengingat berulang dibuat untuk setahun ke depan sekaligus. Gunanya bukan
// memotong riwayat (tak ada riwayat di sini), tapi supaya biaya bacanya punya
// langit-langit — `liveList` tidak punya cache disk, jadi daftar ini dibaca
// ulang dari server tiap app dibuka dari mati.
const TASK_MAKS = 500;

/**
 * Dengarkan perubahan task secara real-time. Setiap kali data berubah
 * (dari HP ini atau HP lain), callback dipanggil dengan daftar terbaru.
 * Kalau listener gagal (offline, ditolak rules), `onError` dipanggil —
 * tanpa ini kegagalan diam-diam dan UI menunggu selamanya.
 * Mengembalikan fungsi untuk berhenti mendengarkan.
 */
export function subscribeTasks(
  uid: string,
  onChange: (tasks: Task[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(tasksCollection(uid), orderBy('createdAt', 'desc'), limit(TASK_MAKS));
  const today = dayDocId(new Date());
  return liveList<Task>(q, onChange, onError, (d) => {
    const data = d.data() as Omit<Task, 'id'>;
    // Task lama: tanpa kategori → Personal; tanpa tanggal → hari ini.
    return {
      id: d.id,
      ...data,
      category: data.category ?? 'personal',
      dayId: data.dayId ?? today,
    };
  });
}

export function addTask(
  uid: string,
  data: {
    title: string;
    category: TaskCategory;
    dayId: string;
    note: string;
    time: string | null;
  },
) {
  return addDoc(tasksCollection(uid), {
    title: data.title.trim(),
    note: data.note.trim(),
    time: data.time,
    done: false,
    category: data.category,
    dayId: data.dayId,
    createdAt: serverTimestamp(),
  });
}

/** Ubah judul/catatan/jam, pindahkan ke hari lain, dan/atau ganti kategori. */
export function updateTask(
  uid: string,
  id: string,
  data: {
    title?: string;
    dayId?: string;
    category?: TaskCategory;
    note?: string;
    time?: string | null;
  },
) {
  return updateDoc(doc(db, 'users', uid, 'tasks', id), data);
}

/** Batas aman jumlah task yang dibuat sekali jalan oleh task berulang. */
export const MAX_RECURRING = 60;

/**
 * Daftar tanggal untuk task berulang: mingguan (tiap 7 hari) atau bulanan
 * (tanggal yang sama tiap bulan, menyesuaikan bulan pendek), dari `start`
 * sampai `end`. Dibatasi MAX_RECURRING+1 supaya rentang kebablasan ketahuan.
 */
export function generateRecurringDays(
  start: Date,
  end: Date,
  freq: 'weekly' | 'monthly',
): string[] {
  const days: string[] = [];
  if (freq === 'weekly') {
    const d = new Date(start);
    while (d <= end && days.length <= MAX_RECURRING) {
      days.push(dayDocId(d));
      d.setDate(d.getDate() + 7);
    }
  } else {
    const dayOfMonth = start.getDate();
    let y = start.getFullYear();
    let m = start.getMonth();
    while (days.length <= MAX_RECURRING) {
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const d = new Date(y, m, Math.min(dayOfMonth, daysInMonth));
      if (d > end) break;
      if (d >= start) days.push(dayDocId(d));
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  }
  return days;
}

/** Buat task berulang sekaligus (satu batch write). */
export function addRecurringTasks(
  uid: string,
  title: string,
  category: TaskCategory,
  days: string[],
  time: string | null,
) {
  const batch = writeBatch(db);
  for (const dayId of days) {
    batch.set(doc(tasksCollection(uid)), {
      title: title.trim(),
      note: '',
      time,
      done: false,
      category,
      dayId,
      createdAt: serverTimestamp(),
    });
  }
  return batch.commit();
}

/**
 * Beres-beres harian (satu batch):
 * - task lama yang BELUM selesai → pindah ke hari ini, dan hitungan
 *   `carried`-nya naik satu (increment di server, jadi tidak perlu dibaca dulu),
 * - task lama yang SUDAH selesai → dihapus otomatis (biar bersih & hemat).
 */
export function rolloverTasks(
  uid: string,
  moveTasks: Task[],
  deleteTasks: Task[],
  todayId: string,
) {
  const batch = writeBatch(db);
  for (const t of moveTasks) {
    batch.update(doc(db, 'users', uid, 'tasks', t.id), {
      dayId: todayId,
      carried: increment(1),
    });
  }
  for (const t of deleteTasks) {
    batch.delete(doc(db, 'users', uid, 'tasks', t.id));
  }
  return batch.commit();
}

export function setTaskDone(uid: string, id: string, done: boolean) {
  return updateDoc(doc(db, 'users', uid, 'tasks', id), { done });
}

export function deleteTask(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'tasks', id));
}

/**
 * Hapus PERMANEN task yang kategorinya sudah tidak ada lagi (mis. kategori
 * lama yang pernah dihapus dari TASK_CATEGORIES seperti 'relax') — supaya
 * Firestore tetap bersih & hemat. Return jumlah yang terhapus.
 */
export async function pruneOrphanTasks(
  uid: string,
  tasks: Task[],
): Promise<number> {
  const orphans = tasks.filter((t) => !VALID_CATEGORY_KEYS.has(t.category));
  if (orphans.length === 0) return 0;
  const batch = writeBatch(db);
  for (const t of orphans) {
    batch.delete(doc(db, 'users', uid, 'tasks', t.id));
  }
  await batch.commit();
  return orphans.length;
}

// ===================== Other Task 📌 =====================
// Bukan task harian — ini catatan prioritas/reminder penting yang bisa
// dikerjakan kapan saja (mirip "Prioritas" di fitur Career). Disimpan di
// koleksi terpisah users/{uid}/otherTasks supaya tidak ikut rollover harian.

export type OtherTask = {
  id: string;
  title: string;
  note: string;
  priority: 1 | 2 | 3; // 1 = paling penting
  done: boolean;
  // Kategori sama persis dengan sub-tab Reminder Harian (TASK_CATEGORIES),
  // jadi emoji & urutannya seragam. Opsional — data lama dianggap 'personal'.
  category?: TaskCategory;
  deadline?: Timestamp | null; // tenggat (opsional — data lama belum punya)
  createdAt: Timestamp | null;
};

// Sama seperti Career: reminder deadline mulai muncul saat H-7 (termasuk lewat).
export const OTHER_REMINDER_DAYS = 7;

/** Selisih hari ke deadline (0 = hari ini, negatif = lewat). null = tanpa deadline. */
export function otherTaskDaysUntil(
  item: OtherTask,
  today: Date,
): number | null {
  return item.deadline ? daysBetween(today, item.deadline.toDate()) : null;
}

/**
 * Sudah masuk H-7? (deadline ≤ 7 hari lagi termasuk lewat & belum selesai).
 * Selama benar: prioritas dipaksa P1 dan tidak bisa diubah — sudah mendesak.
 */
export function otherTaskUrgent(item: OtherTask, today: Date): boolean {
  const days = otherTaskDaysUntil(item, today);
  return !item.done && days !== null && days <= OTHER_REMINDER_DAYS;
}

/**
 * Item dengan prioritas EFEKTIF — dipakai untuk tampilan & pengurutan supaya
 * aturan H-7 langsung berlaku tanpa perlu membuka & menyimpan ulang.
 */
export function effectiveOtherTask(item: OtherTask, today: Date): OtherTask {
  return otherTaskUrgent(item, today) ? { ...item, priority: 1 } : item;
}

function otherTasksCollection(uid: string) {
  return collection(db, 'users', uid, 'otherTasks');
}

export function subscribeOtherTasks(
  uid: string,
  onChange: (items: OtherTask[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // 200 catatan terbaru. Catatan lain (`otherTasks`) tidak punya pembersih
  // harian seperti task, tapi isinya hitungan per bulan — angka ini penahan
  // biaya, sama seperti Promise & Car yang juga dipatok 200.
  const q = query(otherTasksCollection(uid), orderBy('createdAt', 'desc'), limit(200));
  return liveList<OtherTask>(q, onChange, onError, (d) => {
    const data = d.data() as Omit<OtherTask, 'id'>;
    return {
      id: d.id,
      ...data,
      priority: data.priority ?? 2,
      note: data.note ?? '',
      category: data.category ?? 'personal',
    };
  });
}

export function addOtherTask(
  uid: string,
  data: {
    title: string;
    note: string;
    priority: 1 | 2 | 3;
    category: TaskCategory;
    deadline: Date;
  },
) {
  return addDoc(otherTasksCollection(uid), {
    title: data.title.trim(),
    note: data.note.trim(),
    priority: data.priority,
    category: data.category,
    deadline: Timestamp.fromDate(data.deadline),
    done: false,
    createdAt: serverTimestamp(),
  });
}

export function updateOtherTask(
  uid: string,
  id: string,
  data: {
    title?: string;
    note?: string;
    priority?: 1 | 2 | 3;
    category?: TaskCategory;
    deadline?: Date;
  },
) {
  const { deadline, ...rest } = data;
  return updateDoc(doc(db, 'users', uid, 'otherTasks', id), {
    ...rest,
    ...(deadline ? { deadline: Timestamp.fromDate(deadline) } : {}),
  });
}

export function setOtherTaskDone(uid: string, id: string, done: boolean) {
  return updateDoc(doc(db, 'users', uid, 'otherTasks', id), { done });
}

export function deleteOtherTask(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'otherTasks', id));
}
