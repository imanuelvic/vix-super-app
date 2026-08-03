import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayDocId } from './health';

// Kategori task yang sudah pasti — ganti kategori = ganti to-do list.
export type TaskCategory = 'personal' | 'work' | 'ministry' | 'learning';

export const TASK_CATEGORIES: {
  key: TaskCategory;
  label: string;
  icon: string;
}[] = [
  { key: 'personal', label: 'PERSONAL', icon: '👤' },
  { key: 'work', label: 'WORK', icon: '💼' },
  { key: 'ministry', label: 'MINISTRY', icon: '🙏' },
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
  createdAt: Timestamp | null;
};

// Semua task milik satu user disimpan di: users/{uid}/tasks
// Struktur ini bikin security rules gampang: kunci data ke pemiliknya.
function tasksCollection(uid: string) {
  return collection(db, 'users', uid, 'tasks');
}

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
  const q = query(tasksCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const today = dayDocId(new Date());
      const tasks = snapshot.docs.map((d) => {
        const data = d.data() as Omit<Task, 'id'>;
        // Task lama: tanpa kategori → Personal; tanpa tanggal → hari ini.
        return {
          id: d.id,
          ...data,
          category: data.category ?? 'personal',
          dayId: data.dayId ?? today,
        };
      });
      onChange(tasks);
    },
    onError,
  );
}

export function addTask(
  uid: string,
  title: string,
  category: TaskCategory,
  dayId: string,
) {
  return addDoc(tasksCollection(uid), {
    title: title.trim(),
    done: false,
    category,
    dayId,
    createdAt: serverTimestamp(),
  });
}

/** Ubah judul, pindahkan ke hari lain, dan/atau ganti kategori. */
export function updateTask(
  uid: string,
  id: string,
  data: { title?: string; dayId?: string; category?: TaskCategory },
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
) {
  const batch = writeBatch(db);
  for (const dayId of days) {
    batch.set(doc(tasksCollection(uid)), {
      title: title.trim(),
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
 * - task lama yang BELUM selesai → pindah ke hari ini,
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
    batch.update(doc(db, 'users', uid, 'tasks', t.id), { dayId: todayId });
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
 * yang dihapus dari TASK_CATEGORIES seperti 'fun' & 'relax') — supaya
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
  createdAt: Timestamp | null;
};

function otherTasksCollection(uid: string) {
  return collection(db, 'users', uid, 'otherTasks');
}

export function subscribeOtherTasks(
  uid: string,
  onChange: (items: OtherTask[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(otherTasksCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
          const data = d.data() as Omit<OtherTask, 'id'>;
          return {
            id: d.id,
            ...data,
            priority: data.priority ?? 2,
            note: data.note ?? '',
          };
        }),
      );
    },
    onError,
  );
}

export function addOtherTask(
  uid: string,
  data: { title: string; note: string; priority: 1 | 2 | 3 },
) {
  return addDoc(otherTasksCollection(uid), {
    title: data.title.trim(),
    note: data.note.trim(),
    priority: data.priority,
    done: false,
    createdAt: serverTimestamp(),
  });
}

export function updateOtherTask(
  uid: string,
  id: string,
  data: { title?: string; note?: string; priority?: 1 | 2 | 3 },
) {
  return updateDoc(doc(db, 'users', uid, 'otherTasks', id), data);
}

export function setOtherTaskDone(uid: string, id: string, done: boolean) {
  return updateDoc(doc(db, 'users', uid, 'otherTasks', id), { done });
}

export function deleteOtherTask(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'otherTasks', id));
}
