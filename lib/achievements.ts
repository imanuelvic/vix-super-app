import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate, formatShortDayDate } from './format';
import { dayDocId } from './health';
import { alreadyCounted, nextStreak } from './streak';

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
  if (alreadyCounted(current, today)) return Promise.resolve();
  // "Kemarin" versi doa — ikut batas jam 04.00, bukan tengah malam.
  const yesterday = prayerDayId(new Date(now.getTime() - 86_400_000));
  return setDoc(
    doc(db, 'users', uid, 'app', 'login'),
    nextStreak(current, today, yesterday),
  );
}

/**
 * Lewati doa pagi (keadaan mendesak): streak berjalan HANGUS (count → 0), tapi
 * hari ini ditandai "sudah ditangani" (lastDayId = hari ini) supaya lock screen
 * tidak muncul lagi hari ini. best & total tidak berubah (tidak dihitung berdoa).
 */
export function skipDailyPrayer(
  uid: string,
  current: LoginStreak | null,
  now: Date,
) {
  return setDoc(doc(db, 'users', uid, 'app', 'login'), {
    count: 0,
    lastDayId: prayerDayId(now),
    best: current?.best ?? 0,
    total: current?.total ?? 0,
  });
}

// ============================ Achievements ============================

export type AchievementStats = {
  loginCount: number; // streak login berjalan
  loginBest: number;
  loginTotal: number;
  habitStreak: number; // streak kebiasaan Health 🔥
  reviveBest: number; // streak terbaik Revive ✝️
  reviveTotal: number; // total Revive
  bibleTotal: number; // total sesi baca Alkitab tercatat (pagi + malam)
  bibleMorningBest: number; // streak terbaik baca pagi 🌅
  bibleNightBest: number; // streak terbaik baca malam 🌙
  bibleBothBest: number; // streak terbaik hari LENGKAP (pagi + malam)
  bibleBothTotal: number; // total hari lengkap pagi + malam
  fitTotal: number; // total sesi gym selesai
  fitBest: number; // rekor sesi gym beruntun (5 sesi = 1 minggu penuh)
  bestSteps: number; // rekor langkah terbanyak dalam sehari
  stepTierLastDate: Record<number, string | null>; // tier → dayId terakhir tercapai
};

// Kategori pencapaian (ala Duolingo) — tiap kategori punya daftar
// pencapaian bertingkat yang tampil di modal saat ditekan.
export type AchievementCategoryKey =
  | 'login'
  | 'health'
  | 'revive'
  | 'bible'
  | 'fitness'
  | 'steps';

export const ACHIEVEMENT_CATEGORIES: {
  key: AchievementCategoryKey;
  icon: string;
  label: string;
  desc: string;
}[] = [
  { key: 'login', icon: '🙏', label: 'Doa Harian', desc: 'Konsisten doa pagi & Revive tiap hari' },
  { key: 'health', icon: '🍎', label: 'Kebiasaan Sehat', desc: 'Streak habit di fitur Health' },
  { key: 'revive', icon: '📖', label: 'Revive Rohani', desc: 'Konsisten menulis Revive' },
  { key: 'bible', icon: '📚', label: 'Baca Alkitab', desc: 'Rutin baca Alkitab pagi 🌅 & malam 🌙' },
  { key: 'fitness', icon: '🏋️', label: 'Gym Konsisten', desc: 'Sesi latihan beres 5×/minggu' },
  { key: 'steps', icon: '👣', label: 'Langkah Harian', desc: 'Rekor jumlah langkah dalam sehari' },
];

/** Detail "terakhir tercapai kapan" untuk achievement langkah (null bila belum). */
function stepDetail(s: AchievementStats, tier: number): string | null {
  const d = s.stepTierLastDate[tier];
  return d ? `📅 Terakhir tercapai ${formatShortDayDate(dayIdToDate(d))}` : null;
}

export const ACHIEVEMENTS: {
  id: string;
  category: AchievementCategoryKey;
  icon: string;
  title: string;
  desc: string;
  target: number;
  of: (s: AchievementStats) => number; // nilai saat ini untuk progress
  detail?: (s: AchievementStats) => string | null; // baris ekstra (mis. tanggal)
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
  { id: 'revive1', category: 'revive', icon: '📖', title: 'Revive Pertama', desc: 'Tulis Revive pertamamu', target: 1, of: (s) => s.reviveTotal },
  { id: 'revive7', category: 'revive', icon: '🕊️', title: 'Seminggu Bersama Firman', desc: 'Revive 7 hari beruntun', target: 7, of: (s) => s.reviveBest },
  { id: 'revive30', category: 'revive', icon: '⛪', title: 'Sebulan Dalam Hadirat', desc: 'Revive 30 hari beruntun', target: 30, of: (s) => s.reviveBest },
  { id: 'bible1', category: 'bible', icon: '📖', title: 'Bacaan Pertama', desc: 'Catat bacaan Alkitab pertamamu', target: 1, of: (s) => s.bibleTotal },
  { id: 'bibleMorning7', category: 'bible', icon: '🌅', title: 'Pagi Bersama Firman', desc: 'Baca Alkitab pagi 7 hari beruntun', target: 7, of: (s) => s.bibleMorningBest },
  { id: 'bibleNight7', category: 'bible', icon: '🌙', title: 'Malam Bersama Firman', desc: 'Baca Alkitab malam 7 hari beruntun', target: 7, of: (s) => s.bibleNightBest },
  { id: 'bibleBoth3', category: 'bible', icon: '✨', title: 'Pagi & Malam 3 Hari', desc: 'Lengkap pagi + malam 3 hari beruntun', target: 3, of: (s) => s.bibleBothBest },
  { id: 'bibleBoth7', category: 'bible', icon: '🔥', title: 'Seminggu Lengkap', desc: 'Lengkap pagi + malam 7 hari beruntun', target: 7, of: (s) => s.bibleBothBest },
  { id: 'bibleBoth30', category: 'bible', icon: '👑', title: 'Sebulan Lengkap', desc: 'Lengkap pagi + malam 30 hari beruntun', target: 30, of: (s) => s.bibleBothBest },
  { id: 'bibleBothTotal50', category: 'bible', icon: '💎', title: '50 Hari Lengkap', desc: 'Total 50 hari baca pagi & malam', target: 50, of: (s) => s.bibleBothTotal },
  { id: 'fit1', category: 'fitness', icon: '🐣', title: 'Sesi Pertama', desc: 'Selesaikan satu sesi gym penuh', target: 1, of: (s) => s.fitTotal },
  { id: 'fitWeek1', category: 'fitness', icon: '✨', title: 'Seminggu Penuh', desc: '5 sesi beruntun tanpa bolos', target: 5, of: (s) => s.fitBest },
  { id: 'fit10', category: 'fitness', icon: '💪', title: '10 Sesi', desc: 'Total 10 sesi gym selesai', target: 10, of: (s) => s.fitTotal },
  { id: 'fitWeek2', category: 'fitness', icon: '🔥', title: 'Dua Minggu Membara', desc: '10 sesi beruntun tanpa bolos', target: 10, of: (s) => s.fitBest },
  { id: 'fitMonth', category: 'fitness', icon: '👑', title: 'Sebulan Tanpa Bolos', desc: '20 sesi beruntun tanpa bolos', target: 20, of: (s) => s.fitBest },
  { id: 'fit50', category: 'fitness', icon: '🏅', title: '50 Sesi', desc: 'Total 50 sesi gym selesai', target: 50, of: (s) => s.fitTotal },
  { id: 'fit100', category: 'fitness', icon: '💎', title: '100 Sesi', desc: 'Total 100 sesi gym selesai', target: 100, of: (s) => s.fitTotal },
  { id: 'steps20k', category: 'steps', icon: '👟', title: '20 Ribu Langkah', desc: 'Pernah jalan ≥ 20.000 langkah dalam sehari', target: 20000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 20000) },
  { id: 'steps30k', category: 'steps', icon: '🎖️', title: '30 Ribu Langkah', desc: 'Pernah jalan ≥ 30.000 langkah dalam sehari', target: 30000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 30000) },
  { id: 'steps40k', category: 'steps', icon: '🏅', title: '40 Ribu Langkah', desc: 'Pernah jalan ≥ 40.000 langkah dalam sehari', target: 40000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 40000) },
  { id: 'steps50k', category: 'steps', icon: '🥇', title: '50 Ribu Langkah', desc: 'Pernah jalan ≥ 50.000 langkah dalam sehari', target: 50000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 50000) },
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
