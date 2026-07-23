import {
  doc,
  getDoc,
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

export type BudgetDoc = {
  allocations: BudgetMap;
  copiedFromPrev: boolean; // pernah disamakan dengan bulan lalu (per bulan)
};

/** Dengarkan budget satu bulan secara real-time. */
export function subscribeBudget(
  uid: string,
  year: number,
  month: number,
  onChange: (data: BudgetDoc) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'budgets', monthDocId(year, month));
  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      onChange({
        allocations: (data?.allocations as BudgetMap) ?? {},
        copiedFromPrev: (data?.copiedFromPrev as boolean) ?? false,
      });
    },
    onError,
  );
}

/**
 * Samakan budget bulan ini dengan bulan sebelumnya (ditimpa seluruhnya,
 * biar benar-benar identik). Return false kalau bulan lalu belum punya
 * budget. Sekaligus menandai `copiedFromPrev` supaya tombolnya jadi abu-abu.
 */
export async function copyBudgetFromPreviousMonth(
  uid: string,
  year: number,
  month: number,
): Promise<boolean> {
  const prev = new Date(year, month - 1, 1);
  const prevRef = doc(
    db,
    'users',
    uid,
    'budgets',
    monthDocId(prev.getFullYear(), prev.getMonth()),
  );
  const snapshot = await getDoc(prevRef);
  const allocations = (snapshot.data()?.allocations as BudgetMap) ?? {};
  if (Object.keys(allocations).length === 0) return false;

  const ref = doc(db, 'users', uid, 'budgets', monthDocId(year, month));
  // TANPA merge: alokasi bulan ini diganti utuh dengan template bulan lalu.
  await setDoc(ref, { allocations, copiedFromPrev: true });
  return true;
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
