// ============================================================================
// TAB HABITS ✅ — menggantikan tab Tournament (yang kini jadi tile di grid Home).
// Isinya kebiasaan harian Pagi/Siang/Malam, pindahan dari fitur Health.
//
// Diet 🥗 TIDAK di sini — itu soal tubuh, jadi tinggal di fitur Health
// bersama Steps & Check-up (app/health.tsx).
// ============================================================================
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import {
  fitMirrorState,
  subscribeFitDay,
  syncFitnessHabit,
  syncFitnessHabitSkipped,
  type FitDay,
} from '@/lib/fitness';
import {
  FITNESS_HABIT_ID,
  habitMirror,
  saveHabits,
  subscribeHabitSchedule,
  withMiddayBible,
  type HabitMirror,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  activeStreak,
  setHabitDone,
  setHabitSkipped,
  subscribeHabitDay,
  subscribeHealthProfile,
  subscribeStreak,
  subscribeWeightTarget,
  type HabitDay,
  type HealthProfile,
  type Streak,
  type WeightTarget,
} from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';
import {
  PRIORITY_COUNT,
  priorityFilled,
  subscribePriorityDay,
  type PriorityItem,
} from '@/lib/priority';
import {
  bibleMirrorState,
  subscribeBibleReadingToday,
  type BibleReadingSessions,
  type BibleSession,
} from '@/lib/spiritual';

// Baris cermin Baca Alkitab → sesi mana yang jadi acuannya.
const MIRROR_SESSION: Record<string, BibleSession> = {
  'bible-morning': 'morning',
  'bible-daytime': 'daytime',
  'bible-night': 'night',
};

/**
 * Keadaan yang SEHARUSNYA tampil di baris cermin ini hari ini.
 *
 * Daily Priority tidak punya "dilewati" — tiga prioritas itu memang diisi atau
 * tidak. Jadi skipped-nya selalu false; kalau barisnya pernah ditandai ✗ dulu,
 * tanda itu dilepas sekali (tombol ✗-nya sudah tidak ada di baris cermin, jadi
 * membiarkannya berarti tandanya tak akan pernah bisa dibatalkan).
 */
function mirrorState(
  kind: HabitMirror,
  priorities: PriorityItem[],
  bible: BibleReadingSessions,
  now: Date,
): { done: boolean; skipped: boolean } {
  if (kind === 'priority') {
    return {
      done: priorityFilled(priorities) === PRIORITY_COUNT,
      skipped: false,
    };
  }
  return bibleMirrorState(bible, MIRROR_SESSION[kind], now);
}

export default function HabitsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // Kartu "✍️ Rhema Pagi Ini" di Home mengarah ke sini dengan ?focus=rhema —
  // artinya: buka sesi baris Rhema lalu gulung tepat ke barisnya.
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  // Param dibersihkan SESUDAH lompatannya jalan. Habits ini layar tab: tanpa
  // dibersihkan, param-nya menempel dan tiap balik ke tab ini layarnya
  // melompat sendiri lagi.
  const clearFocus = useCallback(() => {
    if (focus) router.setParams({ focus: '' });
  }, [focus, router]);

  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [schedule, setSchedule] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  // undefined = belum termuat; null = memang belum ada datanya.
  const [target, setTarget] = useState<WeightTarget | null | undefined>(undefined);
  const [streak, setStreak] = useState<Streak | null | undefined>(undefined);
  const [fitDay, setFitDay] = useState<FitDay | null>(null);
  // Dua sumber centang otomatis lain (Daily Priority & catatan Baca Alkitab).
  // Bukan untuk ditampilkan — hanya untuk menyelaraskan baris cerminnya.
  // Dokumen yang sama sudah didengarkan Home untuk badge, dan liveDoc memakai
  // listener bersama, jadi tidak menambah pembacaan Firestore.
  const [priorities, setPriorities] = useState<PriorityItem[] | null>(null);
  const [bible, setBible] = useState<BibleReadingSessions | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Lewat tengah malam id harinya ikut berganti sendiri — ceklis kembali
  // kosong tanpa perlu restart app (lihat hooks/useNow.ts). `now` juga dipakai
  // baris cermin Baca Alkitab: begitu jendela sesinya habis, tandanya berubah
  // jadi ✗ sendiri tanpa perlu layarnya dibuka ulang.
  const { now, todayId: dayId } = useNow();

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
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
      // Bukan untuk ditampilkan — hanya untuk menyelaraskan baris olahraga
      // (lihat efek di bawah). Listener-nya dipakai bersama lewat liveDoc,
      // jadi tidak menambah pembacaan Firestore.
      subscribeFitDay(user.uid, dayId, setFitDay),
      subscribePriorityDay(user.uid, dayId, setPriorities),
      subscribeBibleReadingToday(user.uid, dayId, setBible),
    ]);
  }, [user, dayId]);

  // Baris "📖 Midday Bible Reading" disisipkan sekali kalau belum ada — Baca
  // Alkitab punya tiga sesi, jadi Siang pun harus tertagih di Habits. Menulis
  // HANYA kalau memang belum ada; sesudah itu tidak pernah menulis lagi.
  useEffect(() => {
    if (!user || !schedule) return;
    const next = withMiddayBible(schedule);
    if (next) saveHabits(user.uid, next).catch(() => undefined);
  }, [user, schedule]);

  // Baris "🏋️ Morning Exercise" dicerminkan dari fitur Fitness saat gerakan
  // dicentang di sana. Sesi yang beres SEBELUM cermin ini ada — atau tulis yang
  // gagal — tidak akan pernah tercermin sendiri, jadi di sini keduanya
  // dicocokkan ulang tiap kali layar Habits dibuka. Menulis HANYA kalau memang
  // berbeda, jadi normalnya tidak ada tulis sama sekali.
  useEffect(() => {
    if (!user || !day || !fitDay) return;
    const want = fitMirrorState(fitDay, new Date());
    const isSkipped = !!day.skipped[FITNESS_HABIT_ID];
    const isDone = !!day.done[FITNESS_HABIT_ID];
    if (isSkipped !== want.skipped) {
      syncFitnessHabitSkipped(user.uid, dayId, want.skipped);
    } else if (isDone !== want.done) {
      syncFitnessHabit(user.uid, dayId, want.done);
    }
  }, [user, dayId, day, fitDay]);

  // Baris cermin lainnya: "💡 Top 3 Priorities" & ketiga "Bible Reading".
  // Centangnya ikut layar tempat pekerjaannya benar-benar dilakukan, jadi
  // angka harian di Habits tak mungkin beda dengan isi layar itu.
  //
  // Caranya sama persis dengan baris olahraga di atas: tanda ✗ diurus lebih
  // dulu (setHabitSkipped sekalian melepas centangnya, jadi tak perlu tulis
  // kedua), dan menulis HANYA kalau memang berbeda — normalnya nol tulis.
  useEffect(() => {
    if (!user || !day || !schedule || !priorities || !bible) return;
    for (const habit of schedule) {
      const kind = habitMirror(habit);
      // 'fitness' punya efeknya sendiri di atas.
      if (kind === null || kind === 'fitness') continue;
      const want = mirrorState(kind, priorities, bible, now);
      if (!!day.skipped[habit.id] !== want.skipped) {
        setHabitSkipped(user.uid, dayId, habit.id, want.skipped).catch(
          () => undefined,
        );
      } else if (!!day.done[habit.id] !== want.done) {
        setHabitDone(user.uid, dayId, habit.id, want.done).catch(
          () => undefined,
        );
      }
    }
    // `now` ikut jadi dependency: jam berjalan (useNow) menyegarkannya tiap
    // menit, jadi ✗ otomatis untuk sesi yang jendelanya baru saja habis
    // tertulis sendiri tanpa menunggu layar ini dibuka ulang.
  }, [user, dayId, day, schedule, priorities, bible, now]);

  const loading =
    !profile || !schedule || !day || target === undefined || streak === undefined;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <VixText heading="header" additionalStyle={styles.title}>
          Habits ✅
        </VixText>
        {/* Angka di pil ini = streak kebiasaan, jadi yang dibuka pun kategori
            "🍎 Kebiasaan Sehat" — bukan daftar semua kategori. */}
        <StreakPill
          streak={activeStreak(streak ?? null, dayId)}
          category="health"
        />
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
            focusRhema={focus === 'rhema'}
            onFocusDone={clearFocus}
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
