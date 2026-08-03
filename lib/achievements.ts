import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayDocId } from './health';

// Streak DOA HARIAN 🔥 (ala Duolingo) + achievements 🏆.
// Dulu "login streak"; sekarang tercatat saat konfirmasi doa pagi (Bapa Kami
// + Revive) di lock screen Home. Disimpan di SATU dokumen kecil:
// users/{uid}/app/login (nama doc dipertahankan agar streak lama tidak hilang).
// Achievement dihitung dari data yang sudah ada — tanpa read tambahan besar.

export type LoginStreak = {
  count: number; // streak berjalan
  lastDayId: string; // "YYYY-MM-DD" doa terakhir
  best: number; // streak terbaik sepanjang masa
  total: number; // total hari pernah berdoa
};

export function subscribeLoginStreak(
  uid: string,
  onChange: (streak: LoginStreak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'app', 'login');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as LoginStreak) : null);
    },
    onError,
  );
}

/**
 * "Hari doa" pakai batas jam 04:00 pagi — sebelum jam 4 masih dihitung hari
 * sebelumnya (biar doa subuh tetap masuk hari kemarin bila diinginkan).
 */
export function prayerDayId(now: Date): string {
  return dayDocId(new Date(now.getTime() - 4 * 3_600_000));
}

/** Apakah doa hari ini (batas jam 4) sudah dikonfirmasi? */
export function prayerDoneToday(
  streak: LoginStreak | null,
  now: Date,
): boolean {
  return streak?.lastDayId === prayerDayId(now);
}

// Batas waktu menyelesaikan doa pagi (Bapa Kami + Revive). Lewat jam ini &
// belum selesai → streak hangus dan lock screen tidak lagi dipaksakan.
export const PRAYER_DEADLINE_HOUR = 11;

/** Sudah lewat jam 11.00 setempat? (jendela doa pagi habis) */
export function prayerDeadlinePassed(now: Date): boolean {
  return now.getHours() >= PRAYER_DEADLINE_HOUR;
}

/**
 * Hanguskan streak doa (count → 0) karena melewatkan jendela pagi. Rekor
 * (best) & total hari tetap disimpan — yang hilang hanya rentetan berjalan.
 */
export function resetPrayerStreak(uid: string, current: LoginStreak) {
  if (current.count === 0) return Promise.resolve(); // sudah 0, tak perlu tulis
  return setDoc(doc(db, 'users', uid, 'app', 'login'), {
    ...current,
    count: 0,
  });
}

/**
 * Catat doa pagi hari ini — dipanggil saat konfirmasi di lock screen,
 * maksimal menulis 1×/hari (kalau lastDayId sudah hari ini, no-op).
 */
export function recordDailyPrayer(
  uid: string,
  current: LoginStreak | null,
  now: Date,
) {
  const today = prayerDayId(now);
  if (current?.lastDayId === today) return Promise.resolve();
  const yesterday = prayerDayId(new Date(now.getTime() - 86_400_000));
  const continued = current !== null && current.lastDayId === yesterday;
  const count = continued ? current.count + 1 : 1;
  return setDoc(doc(db, 'users', uid, 'app', 'login'), {
    count,
    lastDayId: today,
    best: Math.max(count, current?.best ?? 0),
    total: (current?.total ?? 0) + 1,
  });
}

// ============================ Achievements ============================

export type AchievementStats = {
  loginCount: number; // streak login berjalan
  loginBest: number;
  loginTotal: number;
  habitStreak: number; // streak kebiasaan Health 🔥
  reviveBest: number; // streak terbaik jurnal Revive ✝️
  reviveTotal: number; // total jurnal Revive
};

// Kategori pencapaian (ala Duolingo) — tiap kategori punya daftar
// pencapaian bertingkat yang tampil di modal saat ditekan.
export type AchievementCategoryKey = 'login' | 'health' | 'revive';

export const ACHIEVEMENT_CATEGORIES: {
  key: AchievementCategoryKey;
  icon: string;
  label: string;
  desc: string;
}[] = [
  { key: 'login', icon: '🙏', label: 'Doa Harian', desc: 'Konsisten doa pagi & Revive tiap hari' },
  { key: 'health', icon: '🍎', label: 'Kebiasaan Sehat', desc: 'Streak habit di fitur Health' },
  { key: 'revive', icon: '📖', label: 'Revive Rohani', desc: 'Konsisten menulis jurnal Revive' },
];

export const ACHIEVEMENTS: {
  id: string;
  category: AchievementCategoryKey;
  icon: string;
  title: string;
  desc: string;
  target: number;
  of: (s: AchievementStats) => number; // nilai saat ini untuk progress
}[] = [
  { id: 'first', category: 'login', icon: '🐣', title: 'Langkah Pertama', desc: 'Doa pagi pertamamu', target: 1, of: (s) => s.loginTotal },
  { id: 'streak3', category: 'login', icon: '✨', title: 'Konsisten 3 Hari', desc: 'Berdoa 3 hari beruntun', target: 3, of: (s) => s.loginBest },
  { id: 'streak7', category: 'login', icon: '🔥', title: 'Seminggu Penuh', desc: 'Berdoa 7 hari beruntun', target: 7, of: (s) => s.loginBest },
  { id: 'streak14', category: 'login', icon: '⚡', title: 'Dua Minggu Membara', desc: 'Berdoa 14 hari beruntun', target: 14, of: (s) => s.loginBest },
  { id: 'streak30', category: 'login', icon: '🏅', title: 'Sebulan Tanpa Putus', desc: 'Berdoa 30 hari beruntun', target: 30, of: (s) => s.loginBest },
  { id: 'streak100', category: 'login', icon: '👑', title: 'Legenda 100 Hari', desc: 'Berdoa 100 hari beruntun', target: 100, of: (s) => s.loginBest },
  { id: 'total30', category: 'login', icon: '📅', title: '30 Hari Bersama Tuhan', desc: 'Total 30 hari berdoa pagi', target: 30, of: (s) => s.loginTotal },
  { id: 'total100', category: 'login', icon: '💎', title: '100 Hari Bersama Tuhan', desc: 'Total 100 hari berdoa pagi', target: 100, of: (s) => s.loginTotal },
  { id: 'habit3', category: 'health', icon: '💪', title: 'Habit on Track', desc: 'Streak kebiasaan Health 3 hari', target: 3, of: (s) => s.habitStreak },
  { id: 'habit7', category: 'health', icon: '🧘', title: 'Gaya Hidup Sehat', desc: 'Streak kebiasaan Health 7 hari', target: 7, of: (s) => s.habitStreak },
  { id: 'revive1', category: 'revive', icon: '📖', title: 'Revive Pertama', desc: 'Tulis jurnal Revive pertamamu', target: 1, of: (s) => s.reviveTotal },
  { id: 'revive7', category: 'revive', icon: '🕊️', title: 'Seminggu Bersama Firman', desc: 'Jurnal Revive 7 hari beruntun', target: 7, of: (s) => s.reviveBest },
  { id: 'revive30', category: 'revive', icon: '⛪', title: 'Sebulan Dalam Hadirat', desc: 'Jurnal Revive 30 hari beruntun', target: 30, of: (s) => s.reviveBest },
];

// ============================ Self-Reward 🏆 ============================
// Hadiah untuk diri sendiri — dananya dari Saku "Self-Reward".

export const REWARDS: { icon: string; label: string; price: number }[] = [
  { icon: '☕', label: 'Kopi favorit', price: 50_000 },
  { icon: '🍔', label: 'Makan enak', price: 150_000 },
  { icon: '🎬', label: 'Nonton + jajan', price: 250_000 },
  { icon: '👕', label: 'Baju / jersey baru', price: 500_000 },
  { icon: '👟', label: 'Sepatu incaran', price: 1_500_000 },
  { icon: '🎮', label: 'Gadget / hobi', price: 3_000_000 },
];

/** Dengarkan saldo Saku Self-Reward (1 dokumen, bukan seluruh funds). */
export function subscribeSelfRewardBalance(
  uid: string,
  onChange: (balance: number) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'funds', 'self-reward');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.balance as number) ?? 0);
    },
    onError,
  );
}
