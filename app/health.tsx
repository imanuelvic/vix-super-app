import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { AchievementButton } from '@/components/common/AchievementButton';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { useTabScroll } from '@/components/common/useTabScroll';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { CheckupTab } from '@/components/health/CheckupTab';
import { FunArchive } from '@/components/fun/FunArchive';
import { StepsTab } from '@/components/health/StepsTab';
import { useAuth } from '@/contexts/auth';
import {
  subscribeCheckups,
  subscribeHealthProfile,
  subscribeStepDays,
  subscribeWeekStats,
  type Checkup,
  type HealthProfile,
  type StepDaysMap,
  type WeekStatsMap,
} from '@/lib/health';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR } from '@/lib/messages';

type HealthTab = 'steps' | 'race' | 'checkup';

// Tab bar bawah di dalam layar Health.
// Kebiasaan harian TIDAK lagi di sini — pindah ke tab besar Habits 📋
// (app/(tabs)/habits.tsx). Yang tinggal di sini semuanya soal tubuh:
// langkah kaki, lomba, dan pemeriksaan.
//
// Diet 🥗 DIHAPUS (2 Sep 2026) — beserta layarnya, daftar makanannya, dan
// seluruh hitungan kalori/protein/gulanya. Mencatat tiap makanan tiap hari
// menuntut ketelitian yang tak pernah benar-benar dijalani, dan angka yang
// setengah terisi lebih menyesatkan daripada tidak ada angka sama sekali.
// Yang menjaga tubuh sekarang: langkah kaki, latihan di Fitness, berat badan
// di Check-up, dan air putih di kartu sapaan Home.
//
// Race pindah ke sini dari Fun (30 Agu 2026) & ditaruh TEPAT di kanan Steps:
// keduanya soal kaki yang sama — Steps mencatat latihannya sehari-hari, Race
// mencatat hasilnya. Entrinya tidak berpindah dokumen; yang berubah cuma
// tempat membacanya (lihat FunArchive).
const TABS: BottomTab<HealthTab>[] = [
  { key: 'steps', label: 'Steps', icon: 'figure.walk' },
  { key: 'race', label: 'Race', icon: 'figure.run' },
  { key: 'checkup', label: 'Check-up', icon: 'stethoscope' },
];

export default function HealthScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();

  // Default masuk ke tab Steps; reminder Dashboard bisa mengarahkan ke tab lain.
  // Hook bersama: ganti tab + scroll ke atas tiap tab ditekan.
  // `?tab=diet` sengaja TIDAK dikenali lagi — tabnya sudah tidak ada, dan
  // pintasan lama yang mengarah ke sana mendarat di Steps, bukan di layar
  // kosong.
  const { tab, scrollKey, onTabPress } = useTabScroll<HealthTab>(
    tabParam === 'checkup' || tabParam === 'race' ? tabParam : 'steps',
  );

  // Semua data di-subscribe di sini (bukan per tab) supaya pindah tab
  // tidak memutus-sambung listener Firestore terus-menerus (hemat read).
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [checkups, setCheckups] = useState<Checkup[] | null>(null);
  const [stepDays, setStepDays] = useState<StepDaysMap>({});
  const [weeks, setWeeks] = useState<WeekStatsMap>({});
  const [error, setError] = useState<string | null>(null);

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
      subscribeCheckups(user.uid, setCheckups, fail),
      subscribeStepDays(user.uid, setStepDays, fail),
      subscribeWeekStats(user.uid, setWeeks, fail),
    ]);
  }, [user]);

  // Air putih 💧 tidak diurus dari layar ini lagi — pencatatannya cuma di
  // kartu sapaan Home (satu tombol, satu angka, satu streak).

  const loading = !profile || !checkups;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Tombol kanan atas menyesuaikan sub-tab yang sedang dibuka:
          Steps → rekor langkah · sisanya → info kesehatan.
          Di sebelahnya 🔥 achievement milik sub-tab itu:
            Steps → 📅 Target Mingguan (aerobik + strength) — angkanya tak
                    tampil di mana pun selain di modal itu, beda dengan
                    patokan jarak yang sudah ✅/❌ satu per satu di tab ini.
            Race & Check-up belum punya pencapaian → tak ada tombol 🔥.
          💧 Air Putih dulu digantung di sub-tab Diet; sesudah Diet dihapus
          pencapaiannya tetap utuh & terbuka dari layar Achievement 🏆. */}
      <ScreenHeader
        backLabel="Home"
        title="Health 🍎"
        subtitle="Jaga tubuh, kelola energi"
        right={
          <>
            {tab === 'steps' ? (
              <EmojiButton emoji="👣" onPress={() => router.push('/steps')} />
            ) : (
              <EmojiButton
                emoji="💪🏻"
                onPress={() => router.push('/health-info')}
              />
            )}
            {tab === 'steps' ? <AchievementButton category="week" /> : null}
          </>
        }
      />

      <ScreenError message={error} />

      <View style={styles.content} key={scrollKey}>
        {loading ? (
          <LoadingCenter />
        ) : tab === 'steps' ? (
          <StepsTab profile={profile} stepDays={stepDays} weeks={weeks} />
        ) : tab === 'race' ? (
          /* Warnanya ikut layar ini, bukan warna kategori Fun: di dalam Health
             tombol & kartu Race sewarna Steps/Check-up (hijau MAIN). */
          <FunArchive category="race" accent={Color.MAIN} />
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
