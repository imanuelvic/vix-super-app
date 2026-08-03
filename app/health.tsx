import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { CheckupTab } from '@/components/health/CheckupTab';
import { SummaryTab } from '@/components/health/SummaryTab';
import { TodoTab } from '@/components/health/TodoTab';
import { useAuth } from '@/contexts/auth';
import {
  dayDocId,
  subscribeCheckups,
  subscribeHabitDay,
  subscribeHabits,
  subscribeHealthProfile,
  subscribeStreak,
  subscribeWeightTarget,
  type Checkup,
  type Habit,
  type HabitDay,
  type HealthProfile,
  type Streak,
  type WeightTarget,
} from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type HealthTab = 'summary' | 'todo' | 'checkup';

// Tab bar bawah di dalam layar Health.
const TABS: BottomTab<HealthTab>[] = [
  { key: 'summary', label: 'Summary', icon: 'heart.fill' },
  { key: 'todo', label: 'To-do', icon: 'checklist' },
  { key: 'checkup', label: 'Check-up', icon: 'stethoscope' },
];

export default function HealthScreen() {
  const { user } = useAuth();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  // Default masuk ke tab To-do; reminder Home bisa mengarahkan ke tab lain.
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, scrollKey, onTabPress } = useTabScroll<HealthTab>(
    tabParam === 'summary' || tabParam === 'checkup' ? tabParam : 'todo',
  );

  // Semua data di-subscribe di sini (bukan per tab) supaya pindah tab
  // tidak memutus-sambung listener Firestore terus-menerus (hemat read).
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [checkups, setCheckups] = useState<Checkup[] | null>(null);
  // undefined = belum termuat; null = memang belum ada datanya.
  const [target, setTarget] = useState<WeightTarget | null | undefined>(undefined);
  const [streak, setStreak] = useState<Streak | null | undefined>(undefined);
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
      subscribeHabits(user.uid, setHabits, fail),
      subscribeHabitDay(user.uid, dayId, setDay, fail),
      subscribeCheckups(user.uid, setCheckups, fail),
      subscribeWeightTarget(user.uid, setTarget, fail),
      subscribeStreak(user.uid, setStreak, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  const loading =
    !profile ||
    !habits ||
    !day ||
    !checkups ||
    target === undefined ||
    streak === undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Health 🍎"
        subtitle="Jaga tubuh, kelola energi"
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'summary' ? (
          <SummaryTab profile={profile} streak={streak ?? null} dayId={dayId} />
        ) : tab === 'todo' ? (
          <TodoTab
            habits={habits}
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

      {/* Tab bar bawah khusus layar Health */}
      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  content: { flex: 1 },
});
