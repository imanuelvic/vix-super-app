import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { StreakPill } from '@/components/common/StreakPill';
import { VixText } from '@/components/common/VixText';
import { CheckupTab } from '@/components/health/CheckupTab';
import { StepsTab } from '@/components/health/StepsTab';
import { HabitsTab } from '@/components/health/HabitsTab';
import { useAuth } from '@/contexts/auth';
import {
  pendingHabits,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  activeStreak,
  dayDocId,
  subscribeCheckups,
  subscribeHabitDay,
  subscribeHealthProfile,
  subscribeStepDays,
  subscribeStreak,
  subscribeWeekStats,
  subscribeWeightTarget,
  type Checkup,
  type HabitDay,
  type HealthProfile,
  type StepDaysMap,
  type Streak,
  type WeekStatsMap,
  type WeightTarget,
} from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type HealthTab = 'steps' | 'habits' | 'checkup';

// Tab bar bawah di dalam layar Health.
const TABS: BottomTab<HealthTab>[] = [
  { key: 'steps', label: 'Steps', icon: 'figure.walk' },
  { key: 'habits', label: 'Habits', icon: 'checklist' },
  { key: 'checkup', label: 'Check-up', icon: 'stethoscope' },
];

export default function HealthScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  // Default masuk ke tab Habits; reminder Home bisa mengarahkan ke tab lain.
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, scrollKey, onTabPress } = useTabScroll<HealthTab>(
    // 'summary' masih diterima demi tautan lama yang mungkin tersimpan.
    tabParam === 'steps' || tabParam === 'summary'
      ? 'steps'
      : tabParam === 'checkup'
        ? 'checkup'
        : 'habits',
  );

  // Semua data di-subscribe di sini (bukan per tab) supaya pindah tab
  // tidak memutus-sambung listener Firestore terus-menerus (hemat read).
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [schedule, setSchedule] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [checkups, setCheckups] = useState<Checkup[] | null>(null);
  // undefined = belum termuat; null = memang belum ada datanya.
  const [target, setTarget] = useState<WeightTarget | null | undefined>(undefined);
  const [streak, setStreak] = useState<Streak | null | undefined>(undefined);
  const [stepDays, setStepDays] = useState<StepDaysMap>({});
  const [weeks, setWeeks] = useState<WeekStatsMap>({});
  const [error, setError] = useState<string | null>(null);

  const dayId = dayDocId(new Date());

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
      subscribeCheckups(user.uid, setCheckups, fail),
      subscribeWeightTarget(user.uid, setTarget, fail),
      subscribeStreak(user.uid, setStreak, fail),
      subscribeStepDays(user.uid, setStepDays, fail),
      subscribeWeekStats(user.uid, setWeeks, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  const loading =
    !profile ||
    !schedule ||
    !day ||
    !checkups ||
    target === undefined ||
    streak === undefined;

  // Kebiasaan (sama tiap hari) — semua sesi Pagi/Siang/Malam.
  const dayHabits = schedule ?? [];

  // Streak 🔥 untuk tombol kanan atas sub-tab Habits.
  const streakDays = activeStreak(streak ?? null, dayId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Tombol kanan atas menyesuaikan sub-tab yang sedang dibuka:
          Habits → streak 🔥 · Steps → rekor langkah · Check-up → info kesehatan. */}
      <ScreenHeader
        backLabel="Home"
        title="Health 🍎"
        subtitle="Jaga tubuh, kelola energi"
        right={
          tab === 'habits' ? (
            <StreakPill streak={streakDays} />
          ) : tab === 'steps' ? (
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
        ) : tab === 'habits' ? (
          <HabitsTab
            habits={dayHabits}
            day={day}
            dayId={dayId}
            profile={profile}
            target={target ?? null}
            streak={streak ?? null}
          />
        ) : (
          <CheckupTab checkups={checkups} />
        )}
      </View>

      {/* Badge Habits = kebiasaan yang sesinya sudah tiba tapi belum dicentang
          — angka yang sama dengan badge tile Health di Home. */}
      <BottomTabs
        tabs={withBadge(TABS, {
          habits: pendingHabits(dayHabits, day?.done ?? {}, new Date()).length,
        })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
});
