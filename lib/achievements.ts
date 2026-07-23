import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayDocId } from './health';

// Daily login streak 🔥 (ala Duolingo) + achievements 🏆.
// Streak tercatat otomatis saat Home dibuka pertama kali tiap hari,
// disimpan sebagai SATU dokumen kecil: users/{uid}/app/login.
// Achievement dihitung dari data yang sudah ada — tanpa read tambahan besar.

export type LoginStreak = {
  count: number; // streak berjalan
  lastDayId: string; // "YYYY-MM-DD" login terakhir
  best: number; // streak terbaik sepanjang masa
  total: number; // total hari pernah login
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

function yesterdayId(): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dayDocId(y);
}

/**
 * Catat login hari ini — dipanggil dari Home, maksimal menulis 1×/hari
 * (kalau lastDayId sudah hari ini, JANGAN panggil lagi).
 */
export function recordDailyLogin(uid: string, current: LoginStreak | null) {
  const today = dayDocId(new Date());
  if (current?.lastDayId === today) return Promise.resolve();
  const continued = current !== null && current.lastDayId === yesterdayId();
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

export const ACHIEVEMENTS: {
  id: string;
  icon: string;
  title: string;
  desc: string;
  target: number;
  of: (s: AchievementStats) => number; // nilai saat ini untuk progress
}[] = [
  { id: 'first', icon: '🐣', title: 'Langkah Pertama', desc: 'Login pertama kali di vix', target: 1, of: (s) => s.loginTotal },
  { id: 'streak3', icon: '✨', title: 'Konsisten 3 Hari', desc: 'Login 3 hari beruntun', target: 3, of: (s) => s.loginBest },
  { id: 'streak7', icon: '🔥', title: 'Seminggu Penuh', desc: 'Login 7 hari beruntun', target: 7, of: (s) => s.loginBest },
  { id: 'streak14', icon: '⚡', title: 'Dua Minggu Membara', desc: 'Login 14 hari beruntun', target: 14, of: (s) => s.loginBest },
  { id: 'streak30', icon: '🏅', title: 'Sebulan Tanpa Putus', desc: 'Login 30 hari beruntun', target: 30, of: (s) => s.loginBest },
  { id: 'streak100', icon: '👑', title: 'Legenda 100 Hari', desc: 'Login 100 hari beruntun', target: 100, of: (s) => s.loginBest },
  { id: 'total30', icon: '📅', title: '30 Hari Bersama vix', desc: 'Total 30 hari pernah login', target: 30, of: (s) => s.loginTotal },
  { id: 'total100', icon: '💎', title: '100 Hari Bersama vix', desc: 'Total 100 hari pernah login', target: 100, of: (s) => s.loginTotal },
  { id: 'habit3', icon: '💪', title: 'Habit on Track', desc: 'Streak kebiasaan Health 3 hari', target: 3, of: (s) => s.habitStreak },
  { id: 'habit7', icon: '🧘', title: 'Gaya Hidup Sehat', desc: 'Streak kebiasaan Health 7 hari', target: 7, of: (s) => s.habitStreak },
  { id: 'revive1', icon: '📖', title: 'Revive Pertama', desc: 'Tulis jurnal Revive pertamamu', target: 1, of: (s) => s.reviveTotal },
  { id: 'revive7', icon: '🕊️', title: 'Seminggu Bersama Firman', desc: 'Jurnal Revive 7 hari beruntun', target: 7, of: (s) => s.reviveBest },
  { id: 'revive30', icon: '⛪', title: 'Sebulan Dalam Hadirat', desc: 'Jurnal Revive 30 hari beruntun', target: 30, of: (s) => s.reviveBest },
];

// ============================ Self-Reward 🏆 ============================
// Hadiah untuk diri sendiri — dananya dari pocket Budget Khusus "Self-Reward".

export const REWARDS: { icon: string; label: string; price: number }[] = [
  { icon: '☕', label: 'Kopi favorit', price: 50_000 },
  { icon: '🍔', label: 'Makan enak', price: 150_000 },
  { icon: '🎬', label: 'Nonton + jajan', price: 250_000 },
  { icon: '👕', label: 'Baju / jersey baru', price: 500_000 },
  { icon: '👟', label: 'Sepatu incaran', price: 1_500_000 },
  { icon: '🎮', label: 'Gadget / hobi', price: 3_000_000 },
];

/** Dengarkan saldo pocket Self-Reward (1 dokumen, bukan seluruh funds). */
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
