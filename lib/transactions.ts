import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type FirestoreError,
} from 'firebase/firestore';

import type { FinanceType } from './categories';
import { db } from './firebase';

export type Transaction = {
  id: string;
  type: FinanceType;
  category: string; // key kategori dari lib/categories.ts
  amount: number; // rupiah, bilangan bulat positif
  note: string;
  date: Timestamp;
};

// Semua transaksi milik satu user: users/{uid}/transactions
// Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.
function transactionsCollection(uid: string) {
  return collection(db, 'users', uid, 'transactions');
}

/**
 * Dengarkan transaksi SATU bulan saja (hemat biaya baca Firestore —
 * data bulan lain tidak ikut diunduh). `month` 0–11 seperti Date JS.
 * Range filter + orderBy di field yang sama tidak butuh composite index.
 */
export function subscribeTransactionsByMonth(
  uid: string,
  year: number,
  month: number,
  onChange: (items: Transaction[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const start = Timestamp.fromDate(new Date(year, month, 1));
  const end = Timestamp.fromDate(new Date(year, month + 1, 1));
  const q = query(
    transactionsCollection(uid),
    where('date', '>=', start),
    where('date', '<', end),
    orderBy('date', 'desc'),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Transaction, 'id'>),
      }));
      onChange(items);
    },
    onError,
  );
}

export function addTransaction(
  uid: string,
  data: { type: FinanceType; category: string; amount: number; note: string },
) {
  // Pakai Timestamp.now() (bukan serverTimestamp) supaya transaksi langsung
  // lolos filter bulan di listener tanpa menunggu balasan server.
  return addDoc(transactionsCollection(uid), { ...data, date: Timestamp.now() });
}

/**
 * Perbarui sebagian data transaksi (nominal, catatan, dan/atau tanggal).
 * Kalau tanggal pindah bulan, transaksi otomatis pindah ke tampilan bulan itu.
 */
export function updateTransaction(
  uid: string,
  id: string,
  data: { amount?: number; note?: string; date?: Date },
) {
  const payload: Record<string, unknown> = {};
  if (data.amount !== undefined) payload.amount = data.amount;
  if (data.note !== undefined) payload.note = data.note;
  if (data.date !== undefined) payload.date = Timestamp.fromDate(data.date);
  return updateDoc(doc(db, 'users', uid, 'transactions', id), payload);
}

export function deleteTransaction(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'transactions', id));
}

/** Format 1234567 -> "Rp 1.234.567" (tanpa Intl agar aman di semua engine). */
export function formatRupiah(n: number): string {
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(Math.round(n)).toString();
  return `${sign}Rp ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
