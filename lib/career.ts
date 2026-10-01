import {
    doc,
    setDoc,
    Timestamp,
    type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Career 💼 — "topi" pekerjaan pemilik app:
// 1) Fulltime : Software Engineer / Mobile Developer di NDC → roadmap prioritas
// 2) Freelance : proyek website & aplikasi → client, deadline, requirement, fee
// 3) Business  : es cendol & roa Manado (masih coming soon)
//
// Affiliate (ide konten & endorse) DIHAPUS TOTAL 1 Okt 2026 atas permintaan
// pemilik app, bersama sub-tab Focus. Dokumen lamanya di
// users/{uid}/career/affiliate tidak ikut terhapus dari Firestore (app ini
// tidak punya tugas latar belakang), jadi ia tinggal di sana tanpa bisa
// dibuka dari layar mana pun.
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
  /**
   * ⏸️ Ditahan client (28 Sep 2026) — proyeknya ada, tapi belum bisa jalan:
   * menunggu bahan, menunggu keputusan, menunggu pembayaran.
   *
   * Sama artinya dengan "Backlog (tanpa deadline)" di roadmap Fulltime:
   * tenggatnya tidak berlaku, jadi TIDAK pernah menagih — tidak di badge, tidak
   * di daftar Today, tidak di notifikasi. Tanggalnya sendiri sengaja tetap
   * disimpan apa adanya, jadi begitu penahanannya dilepas, tenggat yang dulu
   * disepakati kembali seperti semula tanpa perlu diketik ulang.
   *
   * Opsional: proyek lama tidak punya kolom ini (dibaca undefined = jalan).
   */
  onHold?: boolean;
};

/** Proyek ini sedang ditahan client (tanpa tenggat yang berlaku)? */
export function freelanceOnHold(p: FreelanceProject): boolean {
  return p.onHold === true;
}

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
  // Ditahan client = tidak punya tenggat sama sekali → tidak pernah menagih.
  if (freelanceOnHold(p)) return false;
  return !p.done && deadlineDaysUntil(p, today) <= CAREER_REMINDER_DAYS;
}

// ==================== Angka badge Work 💼 (28 Sep 2026) ====================
//
// Dulu angkanya dihitung DUA KALI: sekali di app/(tabs)/_layout.tsx untuk
// badge tab Work di kaki app, sekali lagi di app/(tabs)/work.tsx untuk badge
// tiap sub-tab. Dua hitungan dari dua daftar bahan yang tidak sama persis,
// jadi hasilnya memang berbeda, dan di layar tidak ada cara membaca selisihnya.
//
// Sekarang satu fungsi, satu jawaban. Aturannya: **angka di kaki app = jumlah
// angka yang kelihatan rinciannya di layar Work**, tanpa kecuali. Task WORK
// hari ini tidak punya sub-tab (layarnya dibuka lewat tombol 🔔 di pojok
// kanan), jadi tombol itulah yang memakai badge `tasks` — dengan begitu
// ketiga pecahannya benar-benar terlihat dan bisa dijumlah sendiri.

export type WorkAttention = {
  /** P1 roadmap yang belum selesai. */
  fulltime: number;
  /** Proyek freelance yang tenggatnya ≤ H-7 (yang ditahan client tidak ikut). */
  freelance: number;
  /** Task kategori WORK hari ini yang belum dicentang (tombol 🔔). */
  tasks: number;
  /** Jumlah ketiganya — inilah badge tab Work di kaki app. */
  total: number;
};

export function workAttention({
  roadmap,
  freelance,
  tasks,
  now,
  todayId,
}: {
  roadmap: RoadmapItem[];
  freelance: FreelanceProject[];
  /** Task harian — cukup ketiga kolom ini, jadi lib ini tak perlu impor. */
  tasks: { done: boolean; dayId: string; category: string }[];
  now: Date;
  todayId: string;
}): WorkAttention {
  const fulltime = roadmap.filter(
    (r) => r.status !== 'done' && effectiveRoadmap(r, now).priority === 1,
  ).length;
  const freelanceCount = freelance.filter((p) =>
    freelanceReminderWindow(p, now),
  ).length;
  const tasksCount = tasks.filter(
    (t) => !t.done && t.dayId === todayId && t.category === 'work',
  ).length;
  return {
    fulltime,
    freelance: freelanceCount,
    tasks: tasksCount,
    total: fulltime + freelanceCount + tasksCount,
  };
}
