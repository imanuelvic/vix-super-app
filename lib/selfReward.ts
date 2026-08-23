import {
  collection,
  doc,
  increment,
  Timestamp,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Self-Reward 🏆 — hadiah untuk diri sendiri, dananya dari Saku "Self-Reward".
//
// Daftarnya SEPENUHNYA milikmu (dulu 6 hadiah tetap yang ditulis di kode).
// Dua dokumen array kecil, seperti pola daftar lain di app ini:
//   users/{uid}/rewards/list    -> { list: SelfReward[] }    daftar incaran
//   users/{uid}/rewards/archive -> { list: ClaimedReward[] } riwayat klaim
//
// Yang diklaim TETAP tinggal di daftar — hadiah seperti "kopi favorit" memang
// untuk diklaim berkali-kali. Archive adalah RIWAYAT: satu baris tiap kali
// diklaim, lengkap dengan tanggalnya. Kalau ada hadiah yang memang sekali
// seumur hidup, tinggal dihapus sendiri dari daftar sesudah diklaim.

/** Kunci Saku tempat dana hadiah ini diambil (lihat FUNDS di lib/funds.ts). */
export const SELF_REWARD_FUND = 'self-reward';

export type SelfReward = {
  id: string;
  icon: string; // emoji, boleh kosong
  label: string;
  price: number; // rupiah, bilangan bulat
};

/** Satu baris riwayat: hadiah apa adanya + kapan diklaim. */
export type ClaimedReward = SelfReward & { claimedAt: Timestamp };

function listRef(uid: string) {
  return doc(db, 'users', uid, 'rewards', 'list');
}

function archiveRef(uid: string) {
  return doc(db, 'users', uid, 'rewards', 'archive');
}

export function newRewardId(): string {
  return `rw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function subscribeSelfRewards(
  uid: string,
  onChange: (list: SelfReward[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    listRef(uid),
    (snapshot) => onChange((snapshot.data()?.list as SelfReward[]) ?? []),
    onError,
  );
}

export function subscribeClaimedRewards(
  uid: string,
  onChange: (list: ClaimedReward[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    archiveRef(uid),
    (snapshot) => onChange((snapshot.data()?.list as ClaimedReward[]) ?? []),
    onError,
  );
}

/** Tulis ulang seluruh daftar incaran — tambah, ubah, & HAPUS permanen. */
export function saveSelfRewards(uid: string, list: SelfReward[]) {
  return writeBatch(db).set(listRef(uid), { list }).commit();
}

/** Tulis ulang seluruh riwayat — dipakai menghapus satu baris, permanen. */
export function saveClaimedRewards(uid: string, list: ClaimedReward[]) {
  return writeBatch(db).set(archiveRef(uid), { list }).commit();
}

/**
 * Klaim satu hadiah. SATU batch atomik yang mengerjakan tiga hal sekaligus:
 *   1. mutasi keluar (credit) di Saku Self-Reward,
 *   2. saldo Saku dikurangi sebesar harganya,
 *   3. satu baris baru di riwayat klaim (paling atas).
 *
 * Mutasinya sengaja dicatat sebagai entri Saku betulan, bukan cuma mengurangi
 * angka saldo: halaman Saku menghitung ulang saldonya dari daftar mutasi
 * (`reconcileFundBalance` di lib/funds.ts). Kalau uangnya dipotong tanpa
 * mutasi, hitung-ulang itu akan mengembalikannya seolah tidak pernah terpakai.
 *
 * ⚠️ Karena klaim SUDAH mengurangi Saku, jangan mencatat pengeluarannya sekali
 * lagi sebagai mutasi keluar manual di Saku yang sama — nanti terpotong dua
 * kali. (Mencatatnya di Transaksi Finance sebagai belanja biasa tidak masalah:
 * itu buku yang berbeda.)
 */
export function claimSelfReward(
  uid: string,
  archive: ClaimedReward[],
  reward: SelfReward,
  now = new Date(),
) {
  const at = Timestamp.fromDate(now);
  const batch = writeBatch(db);

  // Mutasi keluar + saldo, mengikuti bentuk `addFundEntry` di lib/funds.ts.
  const entries = collection(db, 'users', uid, 'funds', SELF_REWARD_FUND, 'entries');
  batch.set(doc(entries), {
    title: `${reward.icon} ${reward.label}`.trim(),
    cause: 'Klaim self-reward 🏆',
    direction: 'credit',
    amount: reward.price,
    date: at,
  });
  batch.set(
    doc(db, 'users', uid, 'funds', SELF_REWARD_FUND),
    { balance: increment(-reward.price) },
    { merge: true },
  );

  batch.set(archiveRef(uid), {
    list: [{ ...reward, claimedAt: at }, ...archive],
  });
  return batch.commit();
}
