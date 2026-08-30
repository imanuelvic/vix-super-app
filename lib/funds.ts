import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveList } from './liveDoc';

/**
 * Saku = "dompet" dana per tujuan (seperti Pocket di bank Jago).
 * Tiap dompet punya mutasi sendiri:
 *   users/{uid}/funds/{fundKey}            -> { balance } (saldo berjalan)
 *   users/{uid}/funds/{fundKey}/entries/.. -> mutasi
 * debit = uang masuk (top up), credit = uang keluar (dipakai).
 * Saldo disimpan di dokumen dompet & di-update atomik (batch + increment)
 * supaya daftar dompet bisa menampilkan saldo TANPA membaca semua mutasi.
 * Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.
 */
export type FundDirection = 'debit' | 'credit';

export type Fund = {
  key: string; // id dokumen di Firestore — JANGAN diubah setelah dipakai
  label: string;
  icon: string;
};

// Daftar Saku. Tambah dompet baru = tambah 1 baris di sini.
//
// CATATAN: membuang baris di sini hanya menyembunyikan dompetnya dari daftar —
// dokumen `users/{uid}/funds/{key}` beserta mutasinya TETAP ada di Firestore.
// Kalau dompet yang dibuang masih ada saldonya, uang itu jadi tak terlihat.
// Bersihkan datanya sendiri di Firebase Console kalau memang mau hilang total.
// (Home 🏘️ & Car 🚗 dibuang atas permintaan — 24 Agustus 2026.)
export const FUNDS: Fund[] = [
  { key: 'vacation', label: 'Vacation', icon: '🛩️' },
  { key: 'self-reward', label: 'Self-Reward', icon: '🏆' },
  { key: 'impulsive', label: 'Impulsive', icon: '🤑' },
  { key: 'learning', label: 'Learning', icon: '📚' },
  { key: 'health', label: 'Health', icon: '🩺' },
  { key: 'giving', label: 'Giving', icon: '💌' },
  { key: 'core', label: 'CORE', icon: '🏡' },
  { key: 'birthday', label: 'Birthday', icon: '🎁' },
  { key: 'unexpected', label: 'Unexpected', icon: '⚠️' },
];

/** Cari info dompet dari key — fallback kalau key tidak dikenal. */
export function fundOf(key: string): Fund {
  return FUNDS.find((f) => f.key === key) ?? { key, label: key, icon: '❓' };
}

export type FundEntry = {
  id: string;
  title: string; // nama transaksi, mis. "March Top Up" / "Blackmores ..."
  cause: string; // catatan/alasan — wajib diisi
  direction: FundDirection;
  amount: number; // rupiah, bilangan bulat positif
  date: Timestamp;
};

/** Saldo per dompet: { fundKey: saldo }. */
export type FundBalances = Record<string, number>;

function fundDoc(uid: string, fundKey: string) {
  return doc(db, 'users', uid, 'funds', fundKey);
}

function entriesCollection(uid: string, fundKey: string) {
  return collection(db, 'users', uid, 'funds', fundKey, 'entries');
}

/** Nilai bertanda: debit menambah saldo, credit mengurangi. */
function signed(direction: FundDirection, amount: number): number {
  return direction === 'debit' ? amount : -amount;
}

/**
 * Dengarkan saldo SEMUA dompet sekaligus — 1 listener, dokumen kecil saja
 * (bukan seluruh mutasi). Dipakai halaman daftar Saku.
 */
export function subscribeFundBalances(
  uid: string,
  onChange: (balances: FundBalances) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    collection(db, 'users', uid, 'funds'),
    (snapshot) => {
      const balances: FundBalances = {};
      for (const d of snapshot.docs) {
        balances[d.id] = (d.data().balance as number) ?? 0;
      }
      onChange(balances);
    },
    onError,
  );
}

/**
 * Dengarkan SELURUH mutasi satu dompet (terbaru di atas).
 * Riwayat dompet dimuat penuh karena saldo dihitung dari semua entri —
 * jumlah entri per dompet kecil (puluhan per tahun), jadi tetap hemat.
 */
export function subscribeFundEntries(
  uid: string,
  fundKey: string,
  onChange: (entries: FundEntry[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(entriesCollection(uid, fundKey), orderBy('date', 'desc'));
  return liveList<FundEntry>(q, onChange, onError);
}

export function addFundEntry(
  uid: string,
  fundKey: string,
  data: {
    title: string;
    cause: string;
    direction: FundDirection;
    amount: number;
  },
) {
  // Batch: entri baru + update saldo dompet dalam satu operasi atomik.
  const batch = writeBatch(db);
  batch.set(doc(entriesCollection(uid, fundKey)), {
    ...data,
    date: Timestamp.now(),
  });
  batch.set(
    fundDoc(uid, fundKey),
    { balance: increment(signed(data.direction, data.amount)) },
    { merge: true },
  );
  return batch.commit();
}

/** Perbarui entri mutasi. `entry` lama diperlukan untuk koreksi saldo. */
export function updateFundEntry(
  uid: string,
  fundKey: string,
  entry: Pick<FundEntry, 'id' | 'direction' | 'amount'>,
  data: { title: string; cause: string; amount: number; date: Date },
) {
  const batch = writeBatch(db);
  batch.update(doc(entriesCollection(uid, fundKey), entry.id), {
    title: data.title,
    cause: data.cause,
    amount: data.amount,
    date: Timestamp.fromDate(data.date),
  });
  const delta =
    signed(entry.direction, data.amount) - signed(entry.direction, entry.amount);
  if (delta !== 0) {
    batch.set(fundDoc(uid, fundKey), { balance: increment(delta) }, { merge: true });
  }
  return batch.commit();
}

/** Hapus entri mutasi sekaligus mengembalikan pengaruhnya ke saldo. */
export function deleteFundEntry(
  uid: string,
  fundKey: string,
  entry: Pick<FundEntry, 'id' | 'direction' | 'amount'>,
) {
  const batch = writeBatch(db);
  batch.delete(doc(entriesCollection(uid, fundKey), entry.id));
  batch.set(
    fundDoc(uid, fundKey),
    { balance: increment(-signed(entry.direction, entry.amount)) },
    { merge: true },
  );
  return batch.commit();
}

/**
 * Selaraskan saldo tersimpan dengan saldo hasil hitung dari mutasi.
 * Dipanggil dari halaman mutasi (yang memang memuat semua entri) —
 * menulis HANYA kalau berbeda, jadi data lama otomatis terkoreksi.
 */
export async function reconcileFundBalance(
  uid: string,
  fundKey: string,
  balance: number,
) {
  const ref = fundDoc(uid, fundKey);
  const snapshot = await getDoc(ref);
  const stored = (snapshot.data()?.balance as number) ?? 0;
  if (stored !== balance) {
    await setDoc(ref, { balance }, { merge: true });
  }
}
