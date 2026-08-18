import {
  doc,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Career 💼 — empat "topi" pekerjaan pemilik app:
// 1) Fulltime : Software Engineer / Mobile Developer di NDC → roadmap prioritas
// 2) Freelance : proyek website & aplikasi → client, deadline, requirement, fee
// 3) Insurance : agent Manulife → target pitching/closing/premi per bulan
// 4) Business  : es cendol & roa Manado (masih coming soon)
//
// Penyimpanan hemat: SATU dokumen per bidang di users/{uid}/career/*.

/** Id unik untuk item career baru. */
export function newCareerId(): string {
  return `cr${Date.now().toString(36)}`;
}

// ==================== 1. Fulltime: roadmap prioritas ====================

export type RoadmapStatus = 'todo' | 'progress' | 'done';

export const ROADMAP_STATUS: {
  key: RoadmapStatus;
  label: string;
  icon: string;
}[] = [
  { key: 'todo', label: 'Rencana', icon: '📋' },
  { key: 'progress', label: 'Dikerjakan', icon: '🔨' },
  { key: 'done', label: 'Selesai', icon: '✅' },
];

export type RoadmapItem = {
  id: string;
  title: string;
  pic?: string; // PIC / penanggung jawab (opsional utk data lama)
  note: string; // detail/konteks, boleh kosong
  priority: 1 | 2 | 3; // 1 = paling penting
  status: RoadmapStatus;
  deadline?: Timestamp | null; // tenggat pengerjaan (opsional utk data lama)
};

/** Selisih hari ke deadline roadmap (0 = hari ini, negatif = lewat). */
export function roadmapDaysUntil(deadline: Timestamp, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = deadline.toDate();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
}

// Reminder deadline mulai muncul di Home saat H-7 (termasuk yang sudah lewat).
export const CAREER_REMINDER_DAYS = 7;

/** Reminder Home: prioritas belum selesai & deadline ≤ 7 hari (H-7, termasuk lewat). */
export function roadmapReminderWindow(item: RoadmapItem, today: Date): boolean {
  return (
    item.status !== 'done' &&
    !!item.deadline &&
    roadmapDaysUntil(item.deadline, today) <= CAREER_REMINDER_DAYS
  );
}

/**
 * Item dengan prioritas & status EFEKTIF — dipakai untuk tampilan & pengurutan
 * supaya aturan H-7 langsung berlaku tanpa perlu membuka & menyimpan ulang.
 * Selama masuk H-7 (jendela reminder yang sama): prioritas dipaksa P1 & status
 * "Dikerjakan", keduanya tidak bisa diubah — memang sudah mendesak.
 */
export function effectiveRoadmap(item: RoadmapItem, today: Date): RoadmapItem {
  if (!roadmapReminderWindow(item, today)) return item;
  return {
    ...item,
    priority: 1,
    status: item.status === 'todo' ? 'progress' : item.status,
  };
}

export function subscribeRoadmap(
  uid: string,
  onChange: (items: RoadmapItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'career', 'fulltime');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.list as RoadmapItem[]) ?? []);
    },
    onError,
  );
}

export function saveRoadmap(uid: string, list: RoadmapItem[]) {
  return setDoc(doc(db, 'users', uid, 'career', 'fulltime'), { list });
}

// ==================== 2. Freelance: proyek client ====================

// Baris rincian biaya untuk invoice PDF (deskripsi × qty × harga satuan).
export type InvoiceItem = {
  desc: string; // deskripsi item, mis. "Jasa Pembuatan Website"
  qty: number; // kuantitas (mis. jumlah bulan)
  price: number; // harga satuan (Rp)
};

export type FreelanceProject = {
  id: string;
  name: string; // nama proyek, mis. "Website Toko Bunga"
  client: string; // siapa client-nya
  requirement: string; // catatan requirement
  fee: number; // Rp (0 = belum disepakati)
  deadline: Timestamp;
  done: boolean;
  invoiceItems?: InvoiceItem[]; // rincian biaya untuk invoice (opsional)
};

/** Total invoice = jumlah (qty × harga satuan) semua item. */
export function invoiceTotal(items: InvoiceItem[]): number {
  return items.reduce((sum, it) => sum + it.qty * it.price, 0);
}

export function subscribeFreelance(
  uid: string,
  onChange: (projects: FreelanceProject[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'career', 'freelance');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.list as FreelanceProject[]) ?? []);
    },
    onError,
  );
}

export function saveFreelance(uid: string, list: FreelanceProject[]) {
  return setDoc(doc(db, 'users', uid, 'career', 'freelance'), { list });
}

/** Selisih hari ke deadline (0 = hari ini, negatif = lewat). */
export function deadlineDaysUntil(p: FreelanceProject, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = p.deadline.toDate();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
}

/** Reminder Home: proyek freelance belum selesai & deadline ≤ 7 hari (H-7). */
export function freelanceReminderWindow(
  p: FreelanceProject,
  today: Date,
): boolean {
  return !p.done && deadlineDaysUntil(p, today) <= CAREER_REMINDER_DAYS;
}

/** Sisa target asuransi bulan ini (pitch/close/premi) yang belum tercapai. */
export function insuranceRemaining(m: InsuranceMonth): {
  pitch: number;
  close: number;
  premi: number;
} {
  return {
    pitch: Math.max(0, m.pitchTarget - m.pitchDone),
    close: Math.max(0, m.closeTarget - m.closeDone),
    premi: Math.max(0, m.premiTarget - m.premiDone),
  };
}

// ==================== 3. Insurance: target bulanan Allianz ====================

export type InsuranceMonth = {
  pitchTarget: number; // target berapa orang di-pitching bulan ini
  pitchDone: number;
  closeTarget: number; // target closing (polis jadi)
  closeDone: number;
  premiTarget: number; // target premi (Rp)
  premiDone: number;
};

export const EMPTY_INSURANCE: InsuranceMonth = {
  pitchTarget: 0,
  pitchDone: 0,
  closeTarget: 0,
  closeDone: 0,
  premiTarget: 0,
  premiDone: 0,
};

export type InsuranceMonths = Record<string, InsuranceMonth>;

/** "2026-07" — key bulan untuk map asuransi. */
export function insuranceMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function subscribeInsurance(
  uid: string,
  onChange: (months: InsuranceMonths) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'career', 'insurance');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.months as InsuranceMonths) ?? {});
    },
    onError,
  );
}

/** Simpan data satu bulan. merge: bulan lain tidak tersentuh. */
export function saveInsuranceMonth(
  uid: string,
  monthKey: string,
  data: InsuranceMonth,
) {
  return setDoc(
    doc(db, 'users', uid, 'career', 'insurance'),
    { months: { [monthKey]: data } },
    { merge: true },
  );
}
