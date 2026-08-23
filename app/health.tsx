import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { CheckupTab } from '@/components/health/CheckupTab';
import { DietTab } from '@/components/health/DietTab';
import { StepsTab } from '@/components/health/StepsTab';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { EMPTY_DIET_DAY, subscribeDietDay, type DietDay } from '@/lib/diet';
import {
  subscribeCheckups,
  subscribeHealthProfile,
  subscribeStepDays,
  subscribeWeekStats,
  subscribeWeightTarget,
  type Checkup,
  type HealthProfile,
  type StepDaysMap,
  type WeekStatsMap,
  type WeightTarget,
} from '@/lib/health';
import { LOAD_ERROR } from '@/lib/messages';

type HealthTab = 'steps' | 'diet' | 'checkup';

// Tab bar bawah di dalam layar Health.
// Kebiasaan harian TIDAK lagi di sini — pindah ke tab besar Habits ✅
// (app/(tabs)/habits.tsx). Yang tinggal di sini semuanya soal tubuh:
// langkah kaki, makan, dan pemeriksaan.
const TABS: BottomTab<HealthTab>[] = [
  { key: 'steps', label: 'Steps', icon: 'figure.walk' },
  { key: 'diet', label: 'Diet', icon: 'fork.knife' },
  { key: 'checkup', label: 'Check-up', icon: 'stethoscope' },
];

export default function HealthScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  // Default masuk ke tab Steps; reminder Dashboard bisa mengarahkan ke tab lain.
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  const { tab, scrollKey, onTabPress } = useTabScroll<HealthTab>(
    tabParam === 'checkup' || tabParam === 'diet' ? tabParam : 'steps',
  );

  // Semua data di-subscribe di sini (bukan per tab) supaya pindah tab
  // tidak memutus-sambung listener Firestore terus-menerus (hemat read).
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [checkups, setCheckups] = useState<Checkup[] | null>(null);
  const [stepDays, setStepDays] = useState<StepDaysMap>({});
  const [weeks, setWeeks] = useState<WeekStatsMap>({});
  const [diet, setDiet] = useState<DietDay>(EMPTY_DIET_DAY);
  // Target berat (dipasang di tab Habits) — dipakai Diet untuk menentukan
  // defisit/surplus kalorinya, biar satu tujuan dengan tab Habits.
  const [target, setTarget] = useState<WeightTarget | null>(null);
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
      subscribeWeightTarget(user.uid, setTarget, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  // Air putih 💧 tidak diurus dari layar ini lagi — pencatatannya cuma di
  // kartu sapaan Home (satu tombol, satu angka, satu streak).

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

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'steps' ? (
          <StepsTab profile={profile} stepDays={stepDays} weeks={weeks} />
        ) : tab === 'diet' ? (
          <DietTab day={diet} dayId={dayId} profile={profile} target={target} />
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
  content: { flex: 1 },
});
