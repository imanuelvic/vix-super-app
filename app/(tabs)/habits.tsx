// ============================================================================
// TAB HABITS ✅ — menggantikan tab Tournament (yang kini jadi tile di grid Home).
// Isinya kebiasaan harian Pagi/Siang/Malam, pindahan dari fitur Health.
//
// Diet 🥗 TIDAK di sini — itu soal tubuh, jadi tinggal di fitur Health
// bersama Steps & Check-up (app/health.tsx).
// ============================================================================
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { StreakPill } from '@/components/common/StreakPill';
import { VixText } from '@/components/common/VixText';
import { HabitsTab } from '@/components/habits/HabitsTab';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { subscribeHabitSchedule, type ScheduledHabit } from '@/lib/habits';
import {
  activeStreak,
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

export default function HabitsScreen() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [schedule, setSchedule] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  // undefined = belum termuat; null = memang belum ada datanya.
  const [target, setTarget] = useState<WeightTarget | null | undefined>(undefined);
  const [streak, setStreak] = useState<Streak | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Lewat tengah malam id harinya ikut berganti sendiri — ceklis kembali
  // kosong tanpa perlu restart app (lihat hooks/useNow.ts).
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
      subscribeHabitSchedule(user.uid, setSchedule, fail),
      subscribeHabitDay(user.uid, dayId, setDay, fail),
      subscribeWeightTarget(user.uid, setTarget, fail),
      subscribeStreak(user.uid, setStreak, fail),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, dayId]);

  const loading =
    !profile || !schedule || !day || target === undefined || streak === undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <VixText heading="header" additionalStyle={styles.title}>
          Habits ✅
        </VixText>
        <StreakPill streak={activeStreak(streak ?? null, dayId)} />
      </View>

      <ScreenError message={error} />

      <View style={styles.content}>
        {loading ? (
          <LoadingCenter />
        ) : (
          <HabitsTab
            habits={schedule}
            day={day}
            dayId={dayId}
            profile={profile}
            target={target ?? null}
            streak={streak ?? null}
          />
        )}
      </View>
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
  content: { flex: 1 },
});
