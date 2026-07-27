import {
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Fitur Donor Darah 🩸 — jadwal & tempat donor, catatan pribadi, dan hitung
// mundur "boleh donor lagi" (donor darah lengkap: jeda minimal 3 bulan).
//
// Semua disimpan dalam SATU dokumen kecil: users/{uid}/donor/data —
// { lastDonation, notes, schedules[] }. Jadwal ditanam sebagai array (jumlah
// sedikit) sehingga cukup 1 listener & hemat baca Firestore.
// Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.

export const DONOR_INTERVAL_DAYS = 90; // jeda minimal donor darah lengkap

export type DonorSchedule = {
  id: string;
  date: Timestamp; // kapan
  location: string; // di mana (PMI, RS, event, dll.)
  note: string; // catatan (opsional)
  done: boolean; // sudah dilakukan?
};

export type DonorData = {
  lastDonation: Timestamp | null; // donor terakhir (untuk hitung kelayakan)
  notes: string; // catatan/info pribadi soal donor
  schedules: DonorSchedule[];
};

export const EMPTY_DONOR: DonorData = {
  lastDonation: null,
  notes: '',
  schedules: [],
};

export const newDonorScheduleId = () => `dnr${Date.now().toString(36)}`;

function donorDoc(uid: string) {
  return doc(db, 'users', uid, 'donor', 'data');
}

export function subscribeDonor(
  uid: string,
  onChange: (data: DonorData) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    donorDoc(uid),
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as DonorData) : EMPTY_DONOR);
    },
    onError,
  );
}

export function saveDonor(uid: string, data: DonorData) {
  return setDoc(donorDoc(uid), data);
}

// ---------- Perhitungan kelayakan ----------

/** Boleh donor lagi = donor terakhir + 90 hari. null kalau belum pernah. */
export function nextEligibleDate(data: DonorData): Date | null {
  if (!data.lastDonation) return null;
  const d = data.lastDonation.toDate();
  d.setDate(d.getDate() + DONOR_INTERVAL_DAYS);
  return d;
}

/** Sisa hari sampai boleh donor lagi (≤ 0 = sudah boleh). null = belum pernah. */
export function daysUntilEligible(data: DonorData, today: Date): number | null {
  const next = nextEligibleDate(data);
  if (!next) return null;
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round((startOfDay(next) - startOfDay(today)) / 86_400_000);
}

/**
 * Reminder Home: HANYA hari Minggu & sudah boleh donor lagi (biar tidak
 * menclok tiap hari — cukup sekali seminggu). Butuh riwayat donor terakhir;
 * kalau belum pernah donor tidak ada siklus yang perlu diingatkan.
 */
export function donorReminderDue(data: DonorData, today: Date): boolean {
  if (today.getDay() !== 0) return false; // 0 = Minggu
  const days = daysUntilEligible(data, today);
  return days !== null && days <= 0;
}

/** Selisih hari ke jadwal donor (negatif = sudah lewat). */
export function scheduleDaysUntil(schedule: DonorSchedule, today: Date): number {
  const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return Math.round(
    (startOfDay(schedule.date.toDate()) - startOfDay(today)) / 86_400_000,
  );
}

// ---------- Info statis (syarat & tips) ----------

export const DONOR_REQUIREMENTS: string[] = [
  'Usia 17–65 tahun (di bawah 17 boleh dengan izin tertulis)',
  'Berat badan minimal 45 kg',
  'Tekanan darah normal (sistol 100–170, diastol 70–100)',
  'Kadar hemoglobin (Hb) 12,5–17 g/dL',
  'Suhu tubuh normal, sedang sehat & tidak sedang minum antibiotik',
  'Jeda minimal 3 bulan (90 hari) dari donor darah terakhir',
];

export const DONOR_TIPS: string[] = [
  '💧 Minum air yang cukup sebelum & sesudah donor',
  '🍚 Makan dulu, jangan donor dalam keadaan perut kosong',
  '😴 Tidur cukup malam sebelumnya (min. 5 jam)',
  '🚭 Hindari rokok & alkohol 24 jam sebelum donor',
  '💪 Setelah donor: istirahat sebentar, hindari angkat berat 12 jam',
  '🩸 1 kantong darah bisa menolong sampai 3 nyawa — kamu pahlawan!',
];
