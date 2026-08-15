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
import { StepsTab } from '@/components/health/StepsTab';
import { useAuth } from '@/contexts/auth';
import {
  dayDocId,
  subscribeCheckups,
  subscribeHealthProfile,
  subscribeStepDays,
  subscribeWeekStats,
  type Checkup,
  type HealthProfile,
  type StepDaysMap,
  type WeekStatsMap,
} from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type HealthTab = 'steps' | 'checkup';

// Tab bar bawah di dalam layar Health.
// Kebiasaan harian TIDAK lagi di sini — pindah ke tab besar Habits ✅
// (app/(tabs)/habits.tsx) bersama Diet & Sleep.
const TABS: BottomTab<HealthTab>[] = [
  { key: 'steps', label: 'Steps', icon: 'figure.walk' },
  { key: 'checkup', label: 'Check-up', icon: 'stethoscope' },
];

export default function HealthScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  // Default masuk ke tab Steps; reminder Dashboard bisa mengarahkan ke Check-up.
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, scrollKey, onTabPress } = useTabScroll<HealthTab>(
    tabParam === 'checkup' ? 'checkup' : 'steps',
  );

  // Semua data di-subscribe di sini (bukan per tab) supaya pindah tab
  // tidak memutus-sambung listener Firestore terus-menerus (hemat read).
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [checkups, setCheckups] = useState<Checkup[] | null>(null);
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
      subscribeCheckups(user.uid, setCheckups, fail),
      subscribeStepDays(user.uid, setStepDays, fail),
      subscribeWeekStats(user.uid, setWeeks, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

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
