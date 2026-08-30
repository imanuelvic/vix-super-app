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
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { daysBetween } from './format';

// Fitur Device 📱 — perangkat yang dipakai sehari-hari & biayanya.
//
// Dua hal yang dijawab fitur ini, dan keduanya tidak pernah punya tempat:
//   1) Paket kuota mana yang sedang aktif, sisa berapa GB, habis kapan, dan
//      berapa harganya. Selama ini cuma ada di app operator — yang artinya
//      tidak pernah masuk catatan keuangan sendiri.
//   2) Semua pengeluaran soal HP dikumpulkan di satu tempat (tab Log),
//      dibaca dari transaksi Finance kategori "Mobile, Data & Administration".
//
// Polanya sengaja sama dengan Car 🚗 & Residence 🏠: yang dicatat sendiri
// dicatat di sini, yang datang dari Finance BACA-SAJA di sini.

export type DeviceKey = 'iphone' | 'ipad';

export const DEVICES: {
  key: DeviceKey;
  label: string;
  icon: string;
  /** Keterangan singkat di bawah judul tab. */
  sub: string;
}[] = [
  { key: 'iphone', label: 'iPhone 15', icon: '📱', sub: 'HP harian' },
  { key: 'ipad', label: 'iPad 10th Gen', icon: '🖥️', sub: 'tablet' },
];

export function deviceMeta(key: DeviceKey) {
  return DEVICES.find((d) => d.key === key) ?? DEVICES[0];
}

/**
 * Kategori Finance yang dianggap "pengeluaran perangkat".
 *
 * Satu kategori saja untuk sekarang — Mobile, Data & Administration — karena
 * memang di situlah pulsa, paket data & biaya administrasi kartu tercatat.
 */
export const DEVICE_EXPENSE_CATEGORIES = ['mobile-data-admin'];

// ===================== Paket kuota / pulsa =====================

/**
 * Satu paket langganan pada satu perangkat.
 *
 * `quotaGb` & `usedGb` disimpan sebagai angka desimal GB — bukan MB — karena
 * itulah satuan yang tertulis di app operator; mengonversinya cuma menambah
 * satu tempat untuk salah.
 */
export type DataPlan = {
  id: string;
  device: DeviceKey;
  /** Nama paketnya, mis. "Super Seru Internet". */
  name: string;
  /** Operator + nomornya, mis. "Telkomsel SIMPATI · 0813-…". */
  provider: string;
  quotaGb: number;
  /** Kuota yang sudah terpakai — kamu isi sendiri saat mengecek app operator. */
  usedGb: number;
  /** Harga paketnya (Rp). 0 = gratis/bonus. */
  cost: number;
  startDate: Timestamp;
  /** Tanggal paketnya habis — dari "Until …" di app operator. */
  endDate: Timestamp;
  note: string;
};

function plansCollection(uid: string) {
  return collection(db, 'users', uid, 'dataPlans');
}

export function subscribeDataPlans(
  uid: string,
  onChange: (items: DataPlan[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field → tanpa composite index. Yang paling baru berakhir di
  // atas: paket aktif memang yang tanggal habisnya paling jauh ke depan.
  const q = query(plansCollection(uid), orderBy('endDate', 'desc'));
  return onSnapshot(
    q,
    (snapshot) =>
      onChange(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DataPlan, 'id'>),
        })),
      ),
    onError,
  );
}

type PlanInput = {
  device: DeviceKey;
  name: string;
  provider: string;
  quotaGb: number;
  usedGb: number;
  cost: number;
  startDate: Date;
  endDate: Date;
  note: string;
};

export function addDataPlan(uid: string, data: PlanInput) {
  return addDoc(plansCollection(uid), {
    ...data,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: Timestamp.fromDate(data.endDate),
  });
}

export function updateDataPlan(uid: string, id: string, data: PlanInput) {
  return updateDoc(doc(plansCollection(uid), id), {
    ...data,
    startDate: Timestamp.fromDate(data.startDate),
    endDate: Timestamp.fromDate(data.endDate),
  });
}

/** Hapus PERMANEN — tidak ada arsip, tidak ada tanda "sudah dihapus". */
export function deleteDataPlan(uid: string, id: string) {
  return deleteDoc(doc(plansCollection(uid), id));
}

// ===================== Hitungan paket =====================

/** Sisa kuota (GB) — tidak pernah negatif walau pemakaiannya kelewat. */
export function quotaLeft(plan: DataPlan): number {
  return Math.max(0, plan.quotaGb - plan.usedGb);
}

/** Bagian kuota yang sudah terpakai, 0–1 (untuk bar). */
export function quotaRatio(plan: DataPlan): number {
  if (plan.quotaGb <= 0) return 0;
  return Math.min(1, Math.max(0, plan.usedGb / plan.quotaGb));
}

/**
 * Sisa hari sampai paketnya habis. Negatif = sudah lewat.
 * Dihitung per HARI (bukan per jam) supaya angkanya tidak berubah di tengah
 * hari — sama seperti hitungan tenggat di fitur lain.
 */
export function daysLeft(plan: DataPlan, now: Date): number {
  return daysBetween(now, plan.endDate.toDate());
}

/** Paket ini masih berjalan hari ini? */
export function isActivePlan(plan: DataPlan, now: Date): boolean {
  return daysLeft(plan, now) >= 0;
}

/**
 * Paket yang sedang berjalan untuk satu perangkat — yang habisnya PALING
 * DEKAT, karena itulah yang sedang benar-benar dipakai. null = tidak ada.
 */
export function activePlanOf(
  plans: DataPlan[],
  device: DeviceKey,
  now: Date,
): DataPlan | null {
  const jalan = plans
    .filter((p) => p.device === device && isActivePlan(p, now))
    .sort((a, b) => a.endDate.toMillis() - b.endDate.toMillis());
  return jalan[0] ?? null;
}

/**
 * Rata-rata pemakaian per hari (GB) sejak paketnya mulai — dipakai menakar
 * "kira-kira cukup tidak sampai tanggal habisnya".
 * null = paketnya baru mulai hari ini (belum ada hari penuh untuk dibagi).
 */
export function usagePerDay(plan: DataPlan, now: Date): number | null {
  const berjalan = daysBetween(plan.startDate.toDate(), now);
  if (berjalan < 1) return null;
  return plan.usedGb / berjalan;
}
