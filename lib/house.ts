import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Fitur Home 🏠 — rumah kontrakan Casa Jardin. Mirip fitur Car:
// 1) Air-Listrik: catatan harian isi token listrik & bayar air PAM.
// 2) Log: pengeluaran rumah lain (iuran lingkungan, water heater, wifi,
//    cleaning/disinfektan, dll).
// 3) Info: identitas rumah + pengingat kontrak.

// ===================== Identitas rumah (tetap) =====================

export const HOUSE_INFO = {
  name: 'Casa Jardin — No. G5-6',
  owner: 'Dewi Sintia', // pemilik rumah
  address:
    'Jl. Casa Cluster Gladiola Blok G5 No.6, RT.1/RW.4, Kedaung Kali Angke, Cengkareng, Jakarta Barat, 11710',
  wide: '135 m²',
  electricity: '5.500 watt',
  water: 'PAM',
  rentalDate: '1 November 2025', // mulai sewa
  // Iuran lingkungan dibayar per tahun (Jan–Des 2026).
  managementFeePeriod: 'Jan–Des 2026',
  waterHeater: 'Rinnai REU-5CFM',
} as const;

// ===================== Log pengeluaran rumah =====================

export type HouseLogType =
  | 'water'
  | 'electric'
  | 'iuran'
  | 'water-heater'
  | 'wifi'
  | 'cleaning'
  | 'lainnya';

// group: 'utility' tampil di tab Air-Listrik, 'log' tampil di tab Log.
export const HOUSE_LOG_TYPES: {
  key: HouseLogType;
  label: string;
  icon: string;
  group: 'utility' | 'log';
}[] = [
  { key: 'water', label: 'Water PAM', icon: '💧', group: 'utility' },
  { key: 'electric', label: 'Electric Token', icon: '⚡', group: 'utility' },
  { key: 'iuran', label: 'Iuran Lingkungan', icon: '🏘️', group: 'log' },
  { key: 'water-heater', label: 'Water Heater', icon: '👨🏽‍🔧', group: 'log' },
  { key: 'wifi', label: 'Wifi', icon: '🛜', group: 'log' },
  { key: 'cleaning', label: 'Cleaning / Disinfektan', icon: '🪣', group: 'log' },
  { key: 'lainnya', label: 'Lainnya', icon: '🧾', group: 'log' },
];

export type HouseLog = {
  id: string;
  type: HouseLogType;
  title: string;
  note: string; // catatan tambahan, boleh kosong
  cost: number; // Rp
  date: Timestamp;
};

function houseLogsCollection(uid: string) {
  return collection(db, 'users', uid, 'houseLogs');
}

export function subscribeHouseLogs(
  uid: string,
  onChange: (items: HouseLog[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(houseLogsCollection(uid), orderBy('date', 'desc'), limit(300));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<HouseLog, 'id'>),
        })),
      );
    },
    onError,
  );
}

export type HouseLogInput = {
  type: HouseLogType;
  title: string;
  note: string;
  cost: number;
  date: Date;
};

export function addHouseLog(uid: string, data: HouseLogInput) {
  return addDoc(houseLogsCollection(uid), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function updateHouseLog(uid: string, id: string, data: HouseLogInput) {
  return updateDoc(doc(db, 'users', uid, 'houseLogs', id), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function deleteHouseLog(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'houseLogs', id));
}

/**
 * Hapus PERMANEN sekumpulan log rumah sekaligus (batch). Dipakai membersihkan
 * log air/listrik lama yang diinput manual — sekarang angka listrik & air
 * dibaca otomatis dari transaksi Finance, bukan lagi dicatat di sini.
 * Ini penghapusan permanen (hard delete), tidak bisa dibatalkan.
 */
export async function deleteHouseLogs(uid: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    for (const id of ids.slice(i, i + 400)) {
      batch.delete(doc(db, 'users', uid, 'houseLogs', id));
    }
    await batch.commit();
  }
}
