import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveList } from './liveDoc';
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

/**
 * Perangkat yang PUNYA sub-tab paket sendiri.
 *
 * iPad 10 sudah dikeluarkan dari daftar ini — tabletnya tak lagi berpaket data
 * sendiri, jadi tabnya cuma menampilkan "Rp 0". Tapi `DeviceKey` sengaja tetap
 * memuat 'ipad': paket iPad yang pernah tercatat masih tersimpan di Firestore,
 * dan menyempitkan tipenya akan membuat catatan lama itu tak terbaca lagi.
 *
 * Ini juga yang membuat badge H-1 ikut menyempit sendiri (devicesNeedingTopUp
 * di bawah menyapu daftar ini) — badge untuk perangkat yang tak punya tab
 * adalah tagihan yang tak bisa dikerjakan dari mana pun.
 */
export const DEVICES: {
  key: DeviceKey;
  label: string;
  icon: string;
  /** Keterangan singkat di bawah judul tab. */
  sub: string;
}[] = [{ key: 'iphone', label: 'iPhone 15', icon: '📱', sub: 'HP harian' }];

export function deviceMeta(key: DeviceKey) {
  return DEVICES.find((d) => d.key === key) ?? DEVICES[0];
}

/**
 * Kategori Finance yang dianggap "pengeluaran perangkat".
 *
 * Satu kategori saja — Mobile, Data & Administration — karena memang di situlah
 * pulsa, paket data & biaya administrasi kartu tercatat.
 */
export const DEVICE_EXPENSE_CATEGORY = 'mobile-data-admin';
export const DEVICE_EXPENSE_CATEGORIES = [DEVICE_EXPENSE_CATEGORY];

/**
 * Sub-kategori mana di dalam kategori itu yang benar-benar soal PERANGKAT.
 *
 * Kategorinya menampung lebih dari urusan HP: Admin Bank, Cost/Taxes,
 * Subscriptions & Lainnya juga tinggal di situ, dan tak satu pun dari mereka
 * pengeluaran perangkat. Kalau semuanya ikut, angka "pengeluaran perangkat
 * bulan ini" jadi mengaku-aku biaya transfer bank sebagai biaya HP.
 *
 * ⚠️ Dicocokkan lewat NAMANYA, bukan key tetap, dan itu memang satu-satunya
 * jalan: sub-kategori di app ini kamu buat sendiri, jadi key-nya acak
 * (mis. "mobile-a4f2") dan berbeda di tiap perangkat. Ganti nama sub "Mobile"
 * jadi nama lain → tab Log ikut kosong; itu sebabnya kotak kosongnya
 * menyebutkan nama yang dicarinya.
 */
export const DEVICE_SUB_MATCH = /^\s*(?:\p{Extended_Pictographic}|\s)*mobile\b/iu;

/** Key sub-kategori "Mobile" dari daftar sub Finance ([] = belum ada). */
export function deviceSubKeys(subs: { key: string; label: string }[]): string[] {
  return subs.filter((s) => DEVICE_SUB_MATCH.test(s.label)).map((s) => s.key);
}

/** Transaksi ini pengeluaran perangkat? (kategorinya benar DAN subnya Mobile) */
export function isDeviceExpense(
  t: { category: string; sub?: string },
  subKeys: string[],
): boolean {
  return (
    t.category === DEVICE_EXPENSE_CATEGORY && !!t.sub && subKeys.includes(t.sub)
  );
}

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
  return liveList<DataPlan>(q, onChange, onError);
}

export type PlanInput = {
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
 * Salinan paket ini untuk periode BERIKUTNYA — dipakai tombol 📋 saat paket
 * yang sama diperpanjang bulan depan (dan itu yang paling sering terjadi:
 * nama, operator, kuota & harganya sama persis, cuma tanggalnya bergeser).
 *
 * Dua hal sengaja TIDAK ikut disalin apa adanya:
 *   • `usedGb` kembali 0 — paket baru belum terpakai. Menyalin "28 GB
 *     terpakai" akan membuat paket barunya lahir dalam keadaan habis.
 *   • tanggalnya digeser: mulai HARI INI, berdurasi sama panjang dengan yang
 *     lama. Menyalin tanggal lama akan melahirkan paket yang sudah kedaluwarsa.
 */
export function renewedPlan(data: PlanInput, now: Date): PlanInput {
  const durasi = Math.max(0, daysBetween(data.startDate, data.endDate));
  const habis = new Date(now);
  habis.setDate(habis.getDate() + durasi);
  return { ...data, usedGb: 0, startDate: new Date(now), endDate: habis };
}

/**
 * Berapa perangkat yang paketnya sudah H-1 — angka badge sub-tab Device &
 * tile Device di Home.
 *
 * H-1 berarti sisa 1 hari ATAU habis hari ini (0). Paket yang tanggalnya sudah
 * LEWAT sengaja tidak ikut dihitung: badge-nya akan menyala selamanya sampai
 * paket baru dicatat, dan badge yang tidak pernah bisa dipadamkan pelan-pelan
 * berhenti dibaca. Jendela tagihannya memang dua hari itu — cukup untuk
 * mengisi ulang sebelum benar-benar putus.
 */
export const PLAN_ALERT_DAYS = 1;

export function devicesNeedingTopUp(plans: DataPlan[], now: Date): number {
  return DEVICES.filter((d) => {
    const aktif = activePlanOf(plans, d.key, now);
    return aktif !== null && daysLeft(aktif, now) <= PLAN_ALERT_DAYS;
  }).length;
}

/** Paket perangkat ini sudah H-1? — badge satu sub-tab. */
export function deviceNeedsTopUp(
  plans: DataPlan[],
  device: DeviceKey,
  now: Date,
): boolean {
  const aktif = activePlanOf(plans, device, now);
  return aktif !== null && daysLeft(aktif, now) <= PLAN_ALERT_DAYS;
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
