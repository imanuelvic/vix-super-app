import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_SAFE } from '@/assets/style/layout';
import { EmojiButton } from '@/components/common/EmojiButton';
import { RewardButton } from '@/components/common/RewardButton';
import {
  BottomTabs,
  withBadge,
  type BottomTab,
} from '@/components/common/BottomTabs';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ExerciseTab } from '@/components/fitness/ExerciseTab';
import { NotesTab } from '@/components/fitness/NotesTab';
import { ProgramTab } from '@/components/fitness/ProgramTab';
import { ProgressTab } from '@/components/fitness/ProgressTab';
import { RecordTab } from '@/components/fitness/RecordTab';
import { useAuth } from '@/contexts/auth';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import { useStopwatch } from '@/hooks/useStopwatch';
import { type LoginStreak } from '@/lib/reward';
import { subscribeFitNotes, type FitNote } from '@/lib/fitNotes';
import {
  EMPTY_FIT_DAY,
  fitPendingToday,
  settleFitDays,
  subscribeFitDay,
  subscribeFitStreak,
  subscribeFitWeights,
  type FitDay,
  type FitWeights,
} from '@/lib/fitness';
import {
  subscribeHealthProfile,
  subscribeWeightTarget,
  type HealthProfile,
  type WeightTarget,
} from '@/lib/health';

type Tab = 'program' | 'exercise' | 'record' | 'progress' | 'notes';

// Record ⏱️ sengaja DI TENGAH, seperti tombol rekam di app lari: ia satu-
// satunya sub-tab yang dipakai sambil berdiri bersiap, bukan sambil duduk
// membaca, jadi ia harus jatuh tepat di bawah ibu jari.
const TABS: BottomTab<Tab>[] = [
  { key: 'program', label: 'Program', icon: 'calendar' },
  { key: 'exercise', label: 'Exercise', icon: 'dumbbell.fill' },
  { key: 'record', label: 'Record', icon: 'stopwatch.fill' },
  { key: 'progress', label: 'Progress', icon: 'chart.line.uptrend.xyaxis' },
  { key: 'notes', label: 'Notes', icon: 'note.text' },
];

// Fitness 💪 — olahraga harian yang KAMU pilih sendiri.
//
// Tab Program memajang program lean-atletis lengkap (3 hari beban, 2 lari, 2
// jalan) sebagai SARAN yang bisa diambil; yang menentukan isi hari ini tetap
// kamu, di tab Exercise. Jamnya bebas pagi atau sore; pengingatnya menyala di
// dua jendela (05.00 & 16.00).
// Semua data di-subscribe di sini (bukan per tab) supaya pindah tab tidak
// memutus-sambung listener Firestore terus-menerus. Semuanya dokumen kecil.
//
// Data tubuh & target berat TIDAK disimpan ulang di sini — dibaca dari fitur
// Health (profile + target) supaya cuma ada satu sumber kebenaran.
export default function FitnessScreen() {
  const { user } = useAuth();
  const router = useRouter();
  // Stopwatch ⏱️ dipegang DI SINI, bukan di dalam sub-tab Record: kalau ia
  // lahir bersama tab-nya, berpindah sub-tab sejenak akan mematikan detaknya,
  // dan badge "sedang berjalan" di kaki layar tak punya sumber angka.
  const watch = useStopwatch();
  // `tabs` dioper supaya reminder sesi latihan di Dashboard bisa menuju
  // sub-tab Exercise lewat ?tab=.
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('exercise', {
    tabs: TABS,
  });

  const [weights, setWeights] = useState<FitWeights>({});
  const [day, setDay] = useState<FitDay>(EMPTY_FIT_DAY);
  const [streak, setStreak] = useState<LoginStreak | null>(null);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [target, setTarget] = useState<WeightTarget | null>(null);
  // Catatan & tautan latihan — isi sub-tab Notes 📝.
  const [notes, setNotes] = useState<FitNote[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Jam berjalan — badge Exercise baru menyala jam 16.00 dan ikut kereset
  // sendiri lewat tengah malam (lihat hooks/useNow.ts).
  const { now, todayId: dayId } = useNow();

  useLiveAll(
    (uid, fail) => [
      subscribeFitWeights(uid, setWeights, fail),
      subscribeFitDay(uid, dayId, setDay, fail),
      subscribeFitStreak(uid, setStreak, fail),
      subscribeHealthProfile(uid, setProfile, fail),
      subscribeWeightTarget(uid, setTarget, fail),
      subscribeFitNotes(uid, setNotes, fail),
    ],
    { onError: setError, deps: [dayId] },
  );

  // Tutup buku hari-hari yang sudah lewat 🔥 — streak & reward baru
  // dihitung SETELAH harinya habis (jam 00.00), bukan saat gerakan terakhir
  // dicentang: sepanjang hari centangnya masih bisa dilepas lagi.
  //
  // Dijalankan sekali tiap hari, di sini (bukan di dalam tab) supaya pindah
  // tab tidak memicunya berulang kali.
  const settledDay = useRef<string | null>(null);
  useEffect(() => {
    if (!user || settledDay.current === dayId) return;
    settledDay.current = dayId;
    // Gagal diam-diam: pembukuan bisa dicoba lagi besok, dan kegagalannya tidak
    // boleh menutupi layar latihan dengan pesan error.
    settleFitDays(user.uid, new Date()).catch(() => {});
  }, [user, dayId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Fitness 💪"
        subtitle="Pilih sendiri olahraganya tiap hari · pagi atau sore"
        // 📜 Riwayat sesi yang direkam stopwatch, lalu 🔥 Reward. Keduanya
        // berdiri di SEMUA sub-tab (header ini dipakai bersama), jadi riwayat
        // larimu bisa dibuka dari mana pun di dalam Fitness.
        //
        // Sesi latihan di layar inilah yang menghidupkan kategori
        // "🏋️ Fitness Konsisten" — jadi pintunya ditaruh di sini juga.
        right={
          <>
            <EmojiButton
              emoji="📜"
              onPress={() => router.push('/fitness-history')}
            />
            <RewardButton category="fitness" />
          </>
        }
      />

      <ScreenError message={error} />

      <View style={styles.body} key={scrollKey}>
        {tab === 'program' ? (
          <ProgramTab weights={weights} day={day} dayId={dayId} />
        ) : tab === 'exercise' ? (
          <ExerciseTab
            weights={weights}
            day={day}
            dayId={dayId}
            streak={streak}
            bodyWeightKg={profile?.weightKg ?? null}
          />
        ) : tab === 'record' ? (
          <RecordTab watch={watch} day={day} dayId={dayId} />
        ) : tab === 'progress' ? (
          <ProgressTab streak={streak} profile={profile} target={target} />
        ) : (
          <NotesTab notes={notes} />
        )}
      </View>

      {/* Badge Exercise = gerakan hari ini yang belum dicentang, angkanya
          SAMA dengan badge tile Fitness di Home & kartu reminder Dashboard.
          Hari yang ditandai ✕ (dilewati) tidak lagi menampilkan badge. */}
      {/* Badge Record = 1 selagi stopwatch-nya JALAN. Bukan hitungan, tapi
          pengingat: stopwatch yang lupa dihentikan diam-diam mencatat sesi
          tiga jam, dan satu-satunya petunjuknya ada di sub-tab yang sedang
          tidak kamu buka. */}
      <BottomTabs
        tabs={withBadge(TABS, {
          exercise: fitPendingToday(day, now),
          record: watch.running ? 1 : 0,
        })}
        value={tab}
        onChange={onTabPress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { ...SCREEN_SAFE },
  body: { flex: 1 },
});
