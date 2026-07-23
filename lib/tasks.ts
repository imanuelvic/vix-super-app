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
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';

import { db } from './firebase';

// Kategori task yang sudah pasti — ganti kategori = ganti to-do list.
export type TaskCategory =
  | 'personal'
  | 'work'
  | 'fun'
  | 'learning'
  | 'relax'
  | 'ministry';

export const TASK_CATEGORIES: {
  key: TaskCategory;
  label: string;
  icon: string;
}[] = [
  { key: 'personal', label: 'Personal', icon: '👤' },
  { key: 'work', label: 'Work', icon: '💼' },
  { key: 'fun', label: 'Fun Recreation', icon: '🎢' },
  { key: 'learning', label: 'Learning', icon: '📚' },
  { key: 'relax', label: 'Relax', icon: '🧘🏻' },
  { key: 'ministry', label: 'Ministry', icon: '🙏' },
];

export type Task = {
  id: string;
  title: string;
  done: boolean;
  category: TaskCategory;
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
      const tasks = snapshot.docs.map((d) => {
        const data = d.data() as Omit<Task, 'id'>;
        // Task lama (sebelum ada kategori) dianggap Personal.
        return { id: d.id, ...data, category: data.category ?? 'personal' };
      });
      onChange(tasks);
    },
    onError,
  );
}

export function addTask(uid: string, title: string, category: TaskCategory) {
  return addDoc(tasksCollection(uid), {
    title: title.trim(),
    done: false,
    category,
    createdAt: serverTimestamp(),
  });
}

export function setTaskDone(uid: string, id: string, done: boolean) {
  return updateDoc(doc(db, 'users', uid, 'tasks', id), { done });
}

export function deleteTask(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'tasks', id));
}
