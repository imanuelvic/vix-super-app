import {
  deleteField,
  doc,
  getDoc,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import type { FinanceType } from './categories';
import { db } from './firebase';
import { liveDoc } from './liveDoc';

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

/**
 * Key alokasi SUB-budget, contoh: "expense:groceries:telur-a1b2".
 * Tersimpan di map `allocations` yang sama — jadi tetap 1 dokumen per bulan
 * dan `copyBudgetFromPreviousMonth` otomatis ikut menyalin sub-budget-nya.
 * Key kategori & sub dijamin tanpa ":" (lihat `newSubKey`), jadi tidak bentrok.
 */
export function subBudgetKey(
  type: FinanceType,
  categoryKey: string,
  subKey: string,
): string {
  return `${type}:${categoryKey}:${subKey}`;
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
  return liveDoc(
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

/**
 * Simpan budget SATU kategori sekaligus sub-budget-nya dalam 1 tulisan.
 * - `amount` 0 = budget kategori dihapus (dianggap kosong).
 * - `subAmounts` = subKey -> nominal untuk sub yang masih ada.
 * - `removedSubKeys` = sub yang dihapus → alokasinya dibuang PERMANEN dari
 *   dokumen (deleteField), tidak disimpan sebagai sisa data kosong.
 */
export function saveCategoryBudget(
  uid: string,
  year: number,
  month: number,
  type: FinanceType,
  categoryKey: string,
  amount: number,
  subAmounts: Record<string, number> = {},
  removedSubKeys: string[] = [],
) {
  const allocations: Record<string, unknown> = {
    [budgetKey(type, categoryKey)]: amount,
  };
  for (const [subKey, value] of Object.entries(subAmounts)) {
    allocations[subBudgetKey(type, categoryKey, subKey)] = value;
  }
  for (const subKey of removedSubKeys) {
    allocations[subBudgetKey(type, categoryKey, subKey)] = deleteField();
  }
  const ref = doc(db, 'users', uid, 'budgets', monthDocId(year, month));
  // merge: true supaya hanya key kategori ini yang berubah, alokasi lain tetap.
  return setDoc(ref, { allocations }, { merge: true });
}

// ==================== Sub-kategori (sub-budget) ====================
// Contoh: Groceries → "Telur", "Beras", "Sabun". Dipakai dua tempat:
//   • Budgeting  → tiap sub punya nominal budget sendiri per bulan
//   • Transaksi  → saat kategorinya punya sub, muncul pilihan sub-nya
//
// DAFTAR sub disimpan terpisah dari nominalnya, di SATU dokumen tetap:
//   users/{uid}/app/subcategories  →  { map: { "expense:groceries": [...] } }
// Alasannya: daftar sub berlaku lintas bulan (tidak perlu dibuat ulang tiap
// ganti bulan), sedangkan nominalnya memang beda-beda tiap bulan.

export type Subcategory = {
  key: string;
  label: string;
  /** true = sub bawaan aplikasi: selalu ada & tidak bisa dihapus. */
  builtin?: boolean;
};

/** "expense:groceries" -> daftar sub-kategori buatan sendiri. */
export type SubcategoryMap = Record<string, Subcategory[]>;

// ---- Sub BAWAAN: Bensin ⛽ ----
// Satu-satunya sub yang tidak dibuat sendiri. Dipakai sebagai jembatan ke
// fitur Car 🚗: transaksi Expense › Transportation › Bensin otomatis jadi
// catatan di Car → Log, jadi pengeluaran bensin cukup dicatat SEKALI di
// Finance. Karena itu key-nya tidak boleh diubah.
const FUEL_CATEGORY_KEY = 'transportation';
const FUEL_SUB_KEY = 'bensin';

const BUILTIN_SUBS: SubcategoryMap = {
  [budgetKey('expense', FUEL_CATEGORY_KEY)]: [
    { key: FUEL_SUB_KEY, label: '⛽ Bensin', builtin: true },
  ],
};

/** Transaksi ini pengisian bensin? (Expense › Transportation › Bensin) */
export function isFuelTransaction(
  type: FinanceType,
  categoryKey: string,
  subKey: string | undefined,
): boolean {
  return (
    type === 'expense' &&
    categoryKey === FUEL_CATEGORY_KEY &&
    subKey === FUEL_SUB_KEY
  );
}

/** Sub-kategori milik satu kategori: bawaan dulu, lalu buatan sendiri. */
export function subsOf(
  map: SubcategoryMap,
  type: FinanceType,
  categoryKey: string,
): Subcategory[] {
  const key = budgetKey(type, categoryKey);
  return [...(BUILTIN_SUBS[key] ?? []), ...(map[key] ?? [])];
}

/** HANYA sub buatan sendiri — yang benar-benar tersimpan di Firestore. */
export function customSubsOf(
  map: SubcategoryMap,
  type: FinanceType,
  categoryKey: string,
): Subcategory[] {
  return map[budgetKey(type, categoryKey)] ?? [];
}

/** Nama sub dari key-nya ("" kalau sub sudah dihapus / tidak dipilih). */
export function subLabelOf(
  map: SubcategoryMap,
  type: FinanceType,
  categoryKey: string,
  subKey: string | undefined,
): string {
  if (!subKey) return '';
  return subsOf(map, type, categoryKey).find((s) => s.key === subKey)?.label ?? '';
}

/**
 * Key stabil untuk sub baru: slug dari namanya + akhiran acak. Dijamin tanpa
 * ":" supaya `subBudgetKey` tidak ambigu, dan tetap unik walau namanya sama.
 */
export function newSubKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return `${slug || 'sub'}-${Math.random().toString(36).slice(2, 6)}`;
}

export function subscribeSubcategories(
  uid: string,
  onChange: (map: SubcategoryMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'app', 'subcategories'),
    (snapshot) => onChange((snapshot.data()?.map as SubcategoryMap) ?? {}),
    onError,
  );
}

/**
 * Ganti daftar sub SATU kategori. Sub yang dihapus benar-benar hilang dari
 * array (hard delete) — bukan ditandai nonaktif.
 */
export function saveSubcategories(
  uid: string,
  type: FinanceType,
  categoryKey: string,
  list: Subcategory[],
) {
  return setDoc(
    doc(db, 'users', uid, 'app', 'subcategories'),
    { map: { [budgetKey(type, categoryKey)]: list } },
    { merge: true },
  );
}
