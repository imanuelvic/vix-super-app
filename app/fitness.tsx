import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { VixText } from '@/components/common/VixText';
import { ProgramTab } from '@/components/fitness/ProgramTab';
import { ProgressTab } from '@/components/fitness/ProgressTab';
import { SessionTab } from '@/components/fitness/SessionTab';
import { useAuth } from '@/contexts/auth';
import { type LoginStreak } from '@/lib/achievements';
import {
  subscribeFitDay,
  subscribeFitStreak,
  subscribeFitWeights,
  type FitDayDone,
  type FitWeights,
} from '@/lib/fitness';
import { dayDocId } from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type Tab = 'session' | 'program' | 'progress';

const TABS: BottomTab<Tab>[] = [
  { key: 'session', label: 'Latihan', icon: 'dumbbell.fill' },
  { key: 'program', label: 'Program', icon: 'calendar' },
  { key: 'progress', label: 'Progres', icon: 'chart.line.uptrend.xyaxis' },
];

// Fitness 💪 — program strength 5 hari/minggu (Sen, Sel, Kam, Jum, Sab).
// Semua data di-subscribe di sini (bukan per tab) supaya pindah tab tidak
// memutus-sambung listener Firestore terus-menerus. Total 3 dokumen kecil.
export default function FitnessScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('session');

  const [weights, setWeights] = useState<FitWeights>({});
  const [done, setDone] = useState<FitDayDone>({});
  const [streak, setStreak] = useState<LoginStreak | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    const unsubs = [
      subscribeFitWeights(user.uid, setWeights, fail),
      subscribeFitDay(user.uid, dayId, setDone, fail),
      subscribeFitStreak(user.uid, setStreak, fail),
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

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.body} key={scrollKey}>
        {tab === 'session' ? (
          <SessionTab
            weights={weights}
            done={done}
            dayId={dayId}
            streak={streak}
          />
        ) : tab === 'program' ? (
          <ProgramTab weights={weights} />
        ) : (
          <ProgressTab streak={streak} />
        )}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  body: { flex: 1 },
});
