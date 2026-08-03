import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Fitur Pinjaman 🤝 — dua arah:
//   'mine'   = Pinjaman Saya (saya meminjam, HARUS bayar ke orang lain)
//   'theirs' = Pinjaman Orang (orang lain meminjam, mereka harus bayar ke saya)
//
// Satu dokumen per pinjaman: users/{uid}/debts/{id}, dengan daftar pembayaran
// (cicilan) DITANAM di dalam dokumennya sebagai array — jumlah cicilan per
// pinjaman sedikit, jadi hemat & cukup 1 listener untuk semua pinjaman.
// Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.

export type DebtDirection = 'mine' | 'theirs';

export type DebtPeriod = 'once' | 'weekly' | 'monthly';

export const PERIOD_META: Record<DebtPeriod, { label: string; short: string }> = {
  once: { label: 'Sekali bayar', short: 'sekali' },
  weekly: { label: 'Mingguan', short: '/minggu' },
  monthly: { label: 'Bulanan', short: '/bulan' },
};

export type DebtPayment = {
  id: string;
  amount: number;
  date: Timestamp;
  note: string;
};

export type Debt = {
  id: string;
  direction: DebtDirection;
  person: string; // pihak lain (yang saya pinjami / yang meminjam ke saya)
  note: string; // untuk apa pinjamannya
  total: number; // total pinjaman (rupiah)
  startDate: Timestamp; // kapan mulai meminjam
  dueDate: Timestamp; // jatuh tempo pembayaran BERIKUTNYA (dipakai reminder)
  finalDate: Timestamp | null; // target lunas (opsional, tampilan saja)
  period: DebtPeriod;
  installment: number; // nominal cicilan (0 = bayar sekaligus)
  payments: DebtPayment[];
  done: boolean; // lunas
};

export const newDebtId = () => `dbt${Date.now().toString(36)}`;
export const newPaymentId = () => `pay${Date.now().toString(36)}`;

function debtsCollection(uid: string) {
  return collection(db, 'users', uid, 'debts');
}

/** Dengarkan SEMUA pinjaman milik user (dua arah). */
export function subscribeDebts(
  uid: string,
  onChange: (debts: Debt[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    debtsCollection(uid),
    (snapshot) => {
      const debts = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Debt, 'id'>),
      }));
      onChange(debts);
    },
    onError,
  );
}

/** Tambah / ubah pinjaman (dokumen ditulis penuh, termasuk daftar cicilan). */
export function saveDebt(uid: string, debt: Debt) {
  const { id, ...data } = debt;
  return setDoc(doc(debtsCollection(uid), id), data);
}

/** Hapus PERMANEN satu pinjaman (beserta seluruh cicilannya). */
export function deleteDebt(uid: string, id: string) {
  return deleteDoc(doc(debtsCollection(uid), id));
}

// ---------- Perhitungan ----------

/** Total yang sudah dibayar (jumlah semua cicilan). */
export function debtPaid(debt: Debt): number {
  return debt.payments.reduce((sum, p) => sum + p.amount, 0);
}

/** Sisa yang belum dibayar. */
export function debtRemaining(debt: Debt): number {
  return Math.max(0, debt.total - debtPaid(debt));
}

/** Selisih hari ke jatuh tempo berikutnya (negatif = sudah lewat). */
export function debtDaysUntil(debt: Debt, today: Date): number {
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = startOfDay(debt.dueDate.toDate()) - startOfDay(today);
  return Math.round(diff / 86_400_000);
}

/** Reminder Home: belum lunas & jatuh tempo ≤ 3 hari lagi (termasuk lewat). */
export function debtReminderWindow(debt: Debt, today: Date): boolean {
  return !debt.done && debtDaysUntil(debt, today) <= 3;
}

/** Majukan tanggal satu periode (untuk jatuh tempo cicilan berikutnya). */
function addPeriod(date: Date, period: DebtPeriod): Date {
  const d = new Date(date);
  if (period === 'weekly') d.setDate(d.getDate() + 7);
  else if (period === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Catat satu pembayaran cicilan. Kalau cicilan (mingguan/bulanan) dan belum
 * lunas, jatuh tempo otomatis maju satu periode. Kalau total sudah tercapai,
 * pinjaman ditandai lunas.
 */
export function addDebtPayment(uid: string, debt: Debt, payment: DebtPayment) {
  const payments = [...debt.payments, payment];
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const done = paid >= debt.total;
  // Maju satu periode kalau masih nyicil & belum lunas.
  const nextDue =
    !done && debt.period !== 'once'
      ? Timestamp.fromDate(addPeriod(debt.dueDate.toDate(), debt.period))
      : debt.dueDate;
  return saveDebt(uid, { ...debt, payments, done, dueDate: nextDue });
}

/** Hapus satu pembayaran (misal salah catat) — hitung ulang status lunas. */
export function deleteDebtPayment(uid: string, debt: Debt, paymentId: string) {
  const payments = debt.payments.filter((p) => p.id !== paymentId);
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  return saveDebt(uid, { ...debt, payments, done: paid >= debt.total });
}
