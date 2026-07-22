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
  type Timestamp,
} from 'firebase/firestore';

import { db } from './firebase';

export type Task = {
  id: string;
  title: string;
  done: boolean;
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
 * Mengembalikan fungsi untuk berhenti mendengarkan.
 */
export function subscribeTasks(uid: string, onChange: (tasks: Task[]) => void) {
  const q = query(tasksCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Task, 'id'>),
    }));
    onChange(tasks);
  });
}

export function addTask(uid: string, title: string) {
  return addDoc(tasksCollection(uid), {
    title: title.trim(),
    done: false,
    createdAt: serverTimestamp(),
  });
}

export function setTaskDone(uid: string, id: string, done: boolean) {
  return updateDoc(doc(db, 'users', uid, 'tasks', id), { done });
}

export function deleteTask(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'tasks', id));
}
