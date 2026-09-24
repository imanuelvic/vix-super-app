import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { useLiveAll } from '@/hooks/useLiveAll';
import {
  subscribeLoginStreak,
  type RewardStats,
  type LoginStreak,
} from '@/lib/reward';
import { settleFitDays, subscribeFitStreak } from '@/lib/fitness';
import {
  activeStreak,
  dayDocId,
  runRecords,
  stepRecords,
  stepTierLastDates,
  subscribeHealthProfile,
  subscribeStepDays,
  subscribeStreak,
  subscribeWaterStreak,
  subscribeWeekStats,
  weekGoalStats,
  type HealthProfile,
  type StepDaysMap,
  type Streak,
  type WeekStatsMap,
} from '@/lib/health';
import { subscribeLearningStreak, type WeekStreak } from '@/lib/learning';
import {
  EMPTY_BIBLE_STREAKS,
  subscribeBibleStreaks,
  type BibleStreaks,
} from '@/lib/spiritual';
import { EMPTY_DAY_STREAK as EMPTY_WEEK_STREAK } from '@/lib/streak';

// Angka mentah SELURUH reward, dirakit di satu tempat.
//
// Dulu perakitan ini tinggal di app/reward.tsx — sembilan langganan kecil
// plus satu objek besar. Begitu rincian kategori pindah ke halamannya sendiri,
// dua layar membutuhkan angka yang SAMA PERSIS, dan menyalinnya berarti dua
// daftar yang harus diingat untuk diubah bersamaan. Yang pertama meleset
// bukanlah tampilannya, melainkan artinya: satu layar bilang "streak 5", yang
// lain "streak 4", dan tak ada cara menebak mana yang benar.
//
// Semua sumbernya dokumen kecil (satu streak = satu dokumen), jadi memasangnya
// dua kali saat kedua layar terbuka tetap murah — dan Firestore sendiri
// memakai satu langganan bersama untuk dokumen yang sama.
export function useRewardStats(): {
  stats: RewardStats;
  error: string | null;
} {
  const { user } = useAuth();

  const [login, setLogin] = useState<LoginStreak | null>(null);
  const [habit, setHabit] = useState<Streak | null>(null);
  const [bible, setBible] = useState<BibleStreaks>(EMPTY_BIBLE_STREAKS);
  const [fit, setFit] = useState<LoginStreak | null>(null);
  const [water, setWater] = useState<LoginStreak | null>(null);
  const [stepDays, setStepDays] = useState<StepDaysMap>({});
  // Tinggi badan dipakai mengubah langkah → kilometer (patokan pelari).
  const [body, setBody] = useState<HealthProfile | null>(null);
  const [weeks, setWeeks] = useState<WeekStatsMap>({});
  // Streak MINGGUAN Learning 🎓 — satu dokumen kecil, sama seperti yang lain.
  const [learning, setLearning] = useState<WeekStreak>(EMPTY_WEEK_STREAK);
  const [error, setError] = useState<string | null>(null);

  useLiveAll(
    (uid, fail) => [
      subscribeLoginStreak(uid, setLogin, fail),
      subscribeStreak(uid, setHabit, fail),
      subscribeBibleStreaks(uid, setBible, fail),
      subscribeFitStreak(uid, setFit, fail),
      subscribeWaterStreak(uid, setWater, fail),
      subscribeStepDays(uid, setStepDays, fail),
      subscribeHealthProfile(uid, setBody, fail),
      subscribeWeekStats(uid, setWeeks, fail),
      subscribeLearningStreak(uid, setLearning, fail),
    ],
    { onError: setError },
  );

  // Tutup buku sesi gym yang harinya sudah habis 🔥 — sama seperti yang
  // dijalankan layar Fitness. Diulang di sini karena layar INI yang menampilkan
  // angkanya: kalau Reward dibuka lebih dulu, sesi kemarin harus sudah
  // ikut terhitung, bukan menunggu Fitness dibuka.
  //
  // Murah: kalau tidak ada hari yang perlu ditutup, cuma 1 baca dokumen kecil
  // lalu berhenti. Aman diulang — `lastDayId` yang menjaga tidak dobel hitung.
  useEffect(() => {
    if (!user) return;
    settleFitDays(user.uid, new Date()).catch(() => {});
  }, [user]);

  const stepAch = stepRecords(stepDays);
  const runs = runRecords(stepDays, body?.heightCm ?? 170);
  const wk = weekGoalStats(weeks);
  const stats: RewardStats = {
    loginCount: login?.count ?? 0,
    loginBest: login?.best ?? 0,
    habitStreak: activeStreak(habit, dayDocId(new Date())),
    bibleMorningBest: bible.morning.best,
    bibleDaytimeBest: bible.daytime.best,
    bibleNightBest: bible.night.best,
    learningWeekBest: learning.best,
    fitTotal: fit?.total ?? 0,
    fitBest: fit?.best ?? 0,
    bestSteps: stepAch.best?.steps ?? 0,
    stepTierLastDate: stepTierLastDates(stepDays),
    weekStepHits: wk.stepHits,
    weekGymHits: wk.gymHits,
    weekBothHits: wk.bothHits,
    bestDayKm: runs.bestDayKm,
    bestWeekKm: runs.bestWeekKm,
    bestMonthKm: runs.bestMonthKm,
    waterCount: water?.count ?? 0,
    waterBest: water?.best ?? 0,
    waterTotal: water?.total ?? 0,
  };

  return { stats, error };
}
