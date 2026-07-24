import {
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Career 💼 — empat "topi" pekerjaan pemilik app:
// 1) Fulltime : Software Engineer / Mobile Developer di NDC → roadmap prioritas
// 2) Freelance : proyek website & aplikasi → client, deadline, requirement, fee
// 3) Insurance : agent Allianz → target pitching/closing/premi per bulan
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
  note: string; // detail/konteks, boleh kosong
  priority: 1 | 2 | 3; // 1 = paling penting
  status: RoadmapStatus;
};

export function subscribeRoadmap(
  uid: string,
  onChange: (items: RoadmapItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'career', 'fulltime');
  return onSnapshot(
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

export type FreelanceProject = {
  id: string;
  name: string; // nama proyek, mis. "Website Toko Bunga"
  client: string; // siapa client-nya
  requirement: string; // catatan requirement
  fee: number; // Rp (0 = belum disepakati)
  deadline: Timestamp;
  done: boolean;
};

export function subscribeFreelance(
  uid: string,
  onChange: (projects: FreelanceProject[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'career', 'freelance');
  return onSnapshot(
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
  return onSnapshot(
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
