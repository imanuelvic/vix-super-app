import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import type { FinanceType } from './categories';
import { db } from './firebase';

/**
 * Budget bulanan disimpan SATU dokumen per bulan:
 *   users/{uid}/budgets/{YYYY-MM}
 * Isinya map `allocations`: "jenis:kategori" -> nominal alokasi.
 * Satu dokumen per bulan = cuma 1 read per tampilan (hemat kuota Firestore),
 * dan otomatis tercakup Security Rules users/{userId}/{document=**}.
 */
export type BudgetMap = Record<string, number>;

/** Key map alokasi, contoh: "expense:food-drink". */
export function budgetKey(type: FinanceType, categoryKey: string): string {
  return `${type}:${categoryKey}`;
}

/** "2026-07" — id dokumen budget per bulan. `month` 0–11 seperti Date JS. */
function monthDocId(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Dengarkan budget satu bulan secara real-time. */
export function subscribeBudget(
  uid: string,
  year: number,
  month: number,
  onChange: (budget: BudgetMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'budgets', monthDocId(year, month));
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.allocations as BudgetMap) ?? {});
    },
    onError,
  );
}

/** Set/ubah alokasi satu kategori. Nominal 0 = budget dihapus (dianggap kosong). */
export function setBudgetAllocation(
  uid: string,
  year: number,
  month: number,
  type: FinanceType,
  categoryKey: string,
  amount: number,
) {
  const ref = doc(db, 'users', uid, 'budgets', monthDocId(year, month));
  // merge: true supaya hanya key ini yang berubah, alokasi lain tetap.
  return setDoc(
    ref,
    { allocations: { [budgetKey(type, categoryKey)]: amount } },
    { merge: true },
  );
}
