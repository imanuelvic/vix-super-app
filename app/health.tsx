import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { CheckupTab } from '@/components/health/CheckupTab';
import { DietTab } from '@/components/health/DietTab';
import { SleepTab } from '@/components/health/SleepTab';
import { StepsTab } from '@/components/health/StepsTab';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { type LoginStreak } from '@/lib/achievements';
import { EMPTY_DIET_DAY, subscribeDietDay, type DietDay } from '@/lib/diet';
import {
  bumpWaterStreak,
  setWater,
  subscribeCheckups,
  subscribeHabitDay,
  subscribeHealthProfile,
  subscribeStepDays,
  subscribeWaterStreak,
  subscribeWeekStats,
  subscribeWeightTarget,
  WATER_GOAL,
  type Checkup,
  type HabitDay,
  type HealthProfile,
  type StepDaysMap,
  type WeekStatsMap,
  type WeightTarget,
} from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';
import { subscribeSleepNights, type SleepNight } from '@/lib/sleep';

type HealthTab = 'steps' | 'diet' | 'sleep' | 'checkup';

// Tab bar bawah di dalam layar Health.
// Kebiasaan harian TIDAK lagi di sini — pindah ke tab besar Habits ✅
// (app/(tabs)/habits.tsx). Yang tinggal di sini semuanya soal tubuh:
// langkah kaki, makan, tidur, dan pemeriksaan.
const TABS: BottomTab<HealthTab>[] = [
  { key: 'steps', label: 'Steps', icon: 'figure.walk' },
  { key: 'diet', label: 'Diet', icon: 'fork.knife' },
  { key: 'sleep', label: 'Sleep', icon: 'bed.double.fill' },
  { key: 'checkup', label: 'Check-up', icon: 'stethoscope' },
];

export default function HealthScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  // Default masuk ke tab Steps; reminder Dashboard bisa mengarahkan ke tab lain.
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, scrollKey, onTabPress } = useTabScroll<HealthTab>(
    tabParam === 'checkup' || tabParam === 'diet' || tabParam === 'sleep'
      ? tabParam
      : 'steps',
  );

  // Semua data di-subscribe di sini (bukan per tab) supaya pindah tab
  // tidak memutus-sambung listener Firestore terus-menerus (hemat read).
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [checkups, setCheckups] = useState<Checkup[] | null>(null);
  const [stepDays, setStepDays] = useState<StepDaysMap>({});
  const [weeks, setWeeks] = useState<WeekStatsMap>({});
  const [diet, setDiet] = useState<DietDay>(EMPTY_DIET_DAY);
  const [nights, setNights] = useState<SleepNight[]>([]);
  // Target berat (dipasang di tab Habits) — dipakai Diet untuk menentukan
  // defisit/surplus kalorinya, biar satu tujuan dengan tab Habits.
  const [target, setTarget] = useState<WeightTarget | null>(null);
  // Air putih hari ini — dokumen yang SAMA dengan kartu sapaan di Home,
  // jadi angkanya tidak mungkin beda antara dua layar.
  const [day, setDay] = useState<HabitDay | null>(null);
  const [waterStreak, setWaterStreak] = useState<LoginStreak | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lewat tengah malam id harinya ikut berganti sendiri — catatan makan hari
  // ini kembali kosong tanpa restart (lihat hooks/useNow.ts).
  const { todayId: dayId } = useNow();

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeHealthProfile(
        user.uid,
        (p) => {
          setProfile(p);
          setError(null);
        },
        fail,
      ),
      subscribeCheckups(user.uid, setCheckups, fail),
      subscribeStepDays(user.uid, setStepDays, fail),
      subscribeWeekStats(user.uid, setWeeks, fail),
      subscribeDietDay(user.uid, dayId, setDiet, fail),
      subscribeSleepNights(user.uid, setNights, fail),
      subscribeWeightTarget(user.uid, setTarget, fail),
      subscribeHabitDay(user.uid, dayId, setDay, fail),
      subscribeWaterStreak(user.uid, setWaterStreak, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  // Air putih 💧 — logikanya persis seperti di Home supaya rentetan "cukup 8
  // gelas" tetap satu hitungan, dari layar mana pun ditambahnya.
  async function changeWater(delta: number) {
    if (!user || !day) return;
    const next = day.water + delta;
    try {
      await setWater(user.uid, dayId, next);
      if (next >= WATER_GOAL) {
        await bumpWaterStreak(user.uid, waterStreak, dayId);
      }
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    }
  }

  const loading = !profile || !checkups;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Tombol kanan atas menyesuaikan sub-tab yang sedang dibuka:
          Steps → rekor langkah · Check-up → info kesehatan. */}
      <ScreenHeader
        backLabel="Home"
        title="Health 🍎"
        subtitle="Jaga tubuh, kelola energi"
        right={
          tab === 'steps' ? (
            <EmojiButton emoji="👣" onPress={() => router.push('/steps')} />
          ) : (
            <EmojiButton
              emoji="💪🏻"
              onPress={() => router.push('/health-info')}
            />
          )
        }
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'steps' ? (
          <StepsTab profile={profile} stepDays={stepDays} weeks={weeks} />
        ) : tab === 'diet' ? (
          <DietTab
            day={diet}
            dayId={dayId}
            profile={profile}
            target={target}
            water={day?.water ?? 0}
            onChangeWater={changeWater}
          />
        ) : tab === 'sleep' ? (
          <SleepTab nights={nights} dayId={dayId} />
        ) : (
          <CheckupTab checkups={checkups} />
        )}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
});
