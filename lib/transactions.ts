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
  /**
   * Key sub-kategori buatan sendiri (lib/budgets.ts) — opsional. Kosong /
   * tidak ada = transaksi lama atau kategori yang memang belum punya sub.
   */
  sub?: string;
  amount: number; // rupiah, bilangan bulat positif
  /**
   * Khusus transaksi bensin (Transportation › Bensin) — dipakai menghitung
   * Rp/liter di fitur Car. 0 / tidak ada = bukan pengisian bensin.
   */
  liters?: number;
  note: string;
  date: Timestamp;
};

// Kategori pengeluaran yang direkap di fitur Residence (tab Air-Listrik).
//
// Ada DUA bentuk yang sama-sama sah, dan keduanya harus ikut terbaca:
//   • lama — kategori berdiri sendiri: `electricity` / `water`
//   • baru — sesudah kelimanya melebur ke Residence (lihat lib/categories.ts):
//            kategori `residence` dengan sub `electric` / `water`
// Transaksi lama TIDAK ditulis ulang, jadi rekapnya harus mengerti keduanya.
// Kalau tidak, catatan sebelum peleburan seolah hilang dari tab Air-Listrik —
// padahal datanya masih utuh.
const UTILITY_CATEGORIES = ['electricity', 'water', 'residence'] as const;

/** Jenis utilitas rumah dari sebuah transaksi — null = bukan air/listrik. */
export function utilityKindOf(t: Transaction): 'water' | 'electric' | null {
  if (t.category === 'water') return 'water';
  if (t.category === 'electricity') return 'electric';
  if (t.category !== 'residence') return null;
  if (t.sub === 'water') return 'water';
  if (t.sub === 'electric') return 'electric';
  return null;
}

// Semua transaksi milik satu user: users/{uid}/transactions
// Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.
function transactionsCollection(uid: string) {
  return collection(db, 'users', uid, 'transactions');
}

/**
 * Dengarkan SEMUA transaksi listrik & air (lintas bulan) untuk rekap read-only
 * di fitur Home. Filter `in` satu-field memakai index otomatis Firestore
 * (TIDAK butuh composite index); urutan terbaru-dulu dihitung di klien supaya
 * tetap tanpa index. Jumlah transaksi jenis ini sedikit → biaya baca ringan.
 */
export function subscribeUtilityTransactions(
  uid: string,
  onChange: (items: Transaction[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return subscribeCategoryTransactions(
    uid,
    [...UTILITY_CATEGORIES],
    // Kategori `residence` ikut terbawa oleh query di atas, tapi yang masuk
    // rekap air-listrik hanya sub air & listriknya — iuran, wifi & kawan-kawan
    // tempatnya di tab Log.
    (items) => onChange(items.filter((t) => utilityKindOf(t) !== null)),
    onError,
  );
}

/**
 * Dengarkan transaksi dari sekumpulan kategori, LINTAS BULAN — terbaru dulu.
 *
 * Filter `in` satu-field memakai index otomatis Firestore (TIDAK butuh
 * composite index); urutannya dihitung di klien supaya tetap tanpa index.
 * Dipakai rekap read-only yang memang harus melihat seluruh riwayat satu
 * jenis pengeluaran: Air-Listrik di Residence 🏠 & Log di Device 📱.
 *
 * ⚠️ `in` dibatasi 30 nilai oleh Firestore — jauh lebih dari cukup di sini,
 * tapi jangan dipakai untuk daftar kategori yang bisa tumbuh bebas.
 */
export function subscribeCategoryTransactions(
  uid: string,
  categories: string[],
  onChange: (items: Transaction[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(
    transactionsCollection(uid),
    where('category', 'in', categories),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) }))
        .sort((a, b) => b.date.toMillis() - a.date.toMillis());
      onChange(items);
    },
    onError,
  );
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
  data: {
    type: FinanceType;
    category: string;
    sub?: string;
    liters?: number;
    amount: number;
    note: string;
  },
) {
  // Pakai Timestamp.now() (bukan serverTimestamp) supaya transaksi langsung
  // lolos filter bulan di listener tanpa menunggu balasan server.
  // `sub`/`liters` ditulis "" & 0 kalau kosong — Firestore menolak undefined.
  return addDoc(transactionsCollection(uid), {
    ...data,
    sub: data.sub ?? '',
    liters: data.liters ?? 0,
    date: Timestamp.now(),
  });
}

/**
 * Perbarui sebagian data transaksi (nominal, catatan, sub-kategori, dan/atau
 * tanggal). Kalau tanggal pindah bulan, transaksi otomatis pindah ke tampilan
 * bulan itu.
 */
export function updateTransaction(
  uid: string,
  id: string,
  data: {
    amount?: number;
    note?: string;
    sub?: string;
    liters?: number;
    date?: Date;
  },
) {
  const payload: Record<string, unknown> = {};
  if (data.amount !== undefined) payload.amount = data.amount;
  if (data.note !== undefined) payload.note = data.note;
  if (data.sub !== undefined) payload.sub = data.sub;
  if (data.liters !== undefined) payload.liters = data.liters;
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
