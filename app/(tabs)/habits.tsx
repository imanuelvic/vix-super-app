// ============================================================================
// TAB HABITS ✅ — menggantikan tab Tournament (yang kini jadi tile di grid Home).
// Isinya tiga sub-menu harian yang saling menyambung:
//   ✅ Habits — kebiasaan Pagi/Siang/Malam (pindahan dari fitur Health)
//   🥗 Diet   — kalori, gula & lemak hari ini ("less sugar, less fat")
//   😴 Sleep  — jam tidur 6–8 jam per malam
// ============================================================================
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { StreakPill } from '@/components/common/StreakPill';
import { useTabScroll } from '@/components/common/useTabScroll';
import { VixText } from '@/components/common/VixText';
import { DietTab } from '@/components/habits/DietTab';
import { HabitsTab } from '@/components/habits/HabitsTab';
import { SleepTab } from '@/components/habits/SleepTab';
import { useAuth } from '@/contexts/auth';
import { EMPTY_DIET_DAY, subscribeDietDay, type DietDay } from '@/lib/diet';
import {
  pendingHabits,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  activeStreak,
  dayDocId,
  subscribeHabitDay,
  subscribeHealthProfile,
  subscribeStreak,
  subscribeWeightTarget,
  type HabitDay,
  type HealthProfile,
  type Streak,
  type WeightTarget,
} from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';
import { subscribeSleepNights, type SleepNight } from '@/lib/sleep';

type Tab = 'habits' | 'diet' | 'sleep';

const TABS: BottomTab<Tab>[] = [
  { key: 'habits', label: 'Habits', icon: 'checklist' },
  { key: 'diet', label: 'Diet', icon: 'fork.knife' },
  { key: 'sleep', label: 'Sleep', icon: 'bed.double.fill' },
];

export default function HabitsScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('habits');

  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [schedule, setSchedule] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  // undefined = belum termuat; null = memang belum ada datanya.
  const [target, setTarget] = useState<WeightTarget | null | undefined>(undefined);
  const [streak, setStreak] = useState<Streak | null | undefined>(undefined);
  const [diet, setDiet] = useState<DietDay>(EMPTY_DIET_DAY);
  const [nights, setNights] = useState<SleepNight[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Jam berjalan (per menit) supaya lewat tengah malam dokumen harinya ikut
  // berganti sendiri — ceklis & catatan makan kembali kosong tanpa restart.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const dayId = dayDocId(now);

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
      subscribeHabitSchedule(user.uid, setSchedule, fail),
      subscribeHabitDay(user.uid, dayId, setDay, fail),
      subscribeWeightTarget(user.uid, setTarget, fail),
      subscribeStreak(user.uid, setStreak, fail),
      subscribeDietDay(user.uid, dayId, setDiet, fail),
      subscribeSleepNights(user.uid, setNights, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  const loading =
    !profile || !schedule || !day || target === undefined || streak === undefined;

  const dayHabits = schedule ?? [];
  const streakDays = activeStreak(streak ?? null, dayId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <VixText heading="header" additionalStyle={styles.title}>
          Habits ✅
        </VixText>
        <StreakPill streak={streakDays} />
      </View>

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {/* key=scrollKey → konten re-mount tiap sub-menu ditekan (scroll ke atas) */}
      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'habits' ? (
          <HabitsTab
            habits={dayHabits}
            day={day}
            dayId={dayId}
            profile={profile}
            target={target ?? null}
            streak={streak ?? null}
          />
        ) : tab === 'diet' ? (
          <DietTab day={diet} dayId={dayId} profile={profile} />
        ) : (
          <SleepTab nights={nights} dayId={dayId} />
        )}
      </View>

      {/* Badge Habits = kebiasaan yang sesinya sudah tiba tapi belum dicentang */}
      <BottomTabs
        tabs={withBadge(TABS, {
          habits: pendingHabits(dayHabits, day?.done ?? {}, now).length,
        })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  title: { color: Color.MAIN },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
});
