import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ExerciseTab } from '@/components/fitness/ExerciseTab';
import { ProgramTab } from '@/components/fitness/ProgramTab';
import { ProgressTab } from '@/components/fitness/ProgressTab';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { type LoginStreak } from '@/lib/achievements';
import {
  fitPendingToday,
  subscribeFitDay,
  subscribeFitStreak,
  subscribeFitWeights,
  type FitDayDone,
  type FitWeights,
} from '@/lib/fitness';
import {
  subscribeHealthProfile,
  subscribeWeightTarget,
  type HealthProfile,
  type WeightTarget,
} from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type Tab = 'program' | 'exercise' | 'progress';

const TABS: BottomTab<Tab>[] = [
  { key: 'program', label: 'Program', icon: 'calendar' },
  { key: 'exercise', label: 'Exercise', icon: 'dumbbell.fill' },
  { key: 'progress', label: 'Progress', icon: 'chart.line.uptrend.xyaxis' },
];

// Fitness 💪 — program strength 5 hari/minggu (Sen, Sel, Kam, Jum, Sab).
// Semua data di-subscribe di sini (bukan per tab) supaya pindah tab tidak
// memutus-sambung listener Firestore terus-menerus. Semuanya dokumen kecil.
//
// Data tubuh & target berat TIDAK disimpan ulang di sini — dibaca dari fitur
// Health (profile + target) supaya cuma ada satu sumber kebenaran.
export default function FitnessScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('exercise');

  const [weights, setWeights] = useState<FitWeights>({});
  const [done, setDone] = useState<FitDayDone>({});
  const [streak, setStreak] = useState<LoginStreak | null>(null);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [target, setTarget] = useState<WeightTarget | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Jam berjalan — badge Exercise baru menyala jam 16.00 dan ikut kereset
  // sendiri lewat tengah malam (lihat hooks/useNow.ts).
  const { now, todayId: dayId } = useNow();

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeFitWeights(user.uid, setWeights, fail),
      subscribeFitDay(user.uid, dayId, setDone, fail),
      subscribeFitStreak(user.uid, setStreak, fail),
      subscribeHealthProfile(user.uid, setProfile, fail),
      subscribeWeightTarget(user.uid, setTarget, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Fitness 💪"
        subtitle="Strength · 5 hari/minggu · target sixpack"
      />

      <ScreenError message={error} />

      <View style={styles.body} key={scrollKey}>
        {tab === 'program' ? (
          <ProgramTab weights={weights} />
        ) : tab === 'exercise' ? (
          <ExerciseTab
            weights={weights}
            done={done}
            dayId={dayId}
            streak={streak}
            bodyWeightKg={profile?.weightKg ?? null}
          />
        ) : (
          <ProgressTab streak={streak} profile={profile} target={target} />
        )}
      </View>

      {/* Badge Exercise = gerakan hari ini yang belum dicentang, angkanya
          SAMA dengan badge tile Fitness di Home & kartu reminder Dashboard. */}
      <BottomTabs
        tabs={withBadge(TABS, { exercise: fitPendingToday(done, now) })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  body: { flex: 1 },
});
