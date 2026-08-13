// ============================================================================
// LAYAR HOME (rute "/"). Isi file ini = launcher aplikasi: sapaan (greeting,
// air putih, streak) + grid fitur. Kartu-kartu reminder harian sekarang ada di
// tab DASHBOARD (app/(tabs)/dashboard.tsx), bukan di sini lagi.
//
// CATATAN: nama file WAJIB "index.tsx" — di expo-router, "index" berarti layar
// utama/default grup (tabs), sehingga file ini menjadi rute "/" dan tab Home.
// Kalau di-rename (mis. "home.tsx"), rutenya berubah jadi "/home" dan routing
// harus di-rewire. Jadi biarkan namanya "index.tsx"; anggap ini "Home".
// ============================================================================
import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Greeting } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  prayerDeadlinePassed,
  prayerDoneToday,
  resetPrayerStreak,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';
import {
  countCarAttention,
  subscribePartStatus,
  type PartStatusMap,
} from '@/lib/car';
import {
  effectiveRoadmap,
  freelanceReminderWindow,
  subscribeFreelance,
  subscribeRoadmap,
  type FreelanceProject,
  type RoadmapItem,
} from '@/lib/career';
import {
  subscribeCoreLeaders,
  weekIndex,
  WEEKLY_FOCUS_COUNT,
  weeklyLeaders,
  type CoreLeader,
} from '@/lib/core';
import { OWNER_NAME } from '@/lib/family';
import { formatShortDayDate } from '@/lib/format';
import {
  pendingHabits,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  dayDocId,
  setWater,
  subscribeHabitDay,
  WATER_GOAL,
  type HabitDay,
} from '@/lib/health';
import {
  countResidenceAttention,
  subscribeChoreStatus,
  type ChoreStatusMap,
} from '@/lib/residence';
import {
  bibleSessionMeta,
  bibleSessionNow,
  subscribeBibleReadToday,
  subscribeReviveStreak,
  type BibleReadSessions,
} from '@/lib/spiritual';
import {
  effectiveOtherTask,
  subscribeOtherTasks,
  subscribeTasks,
  type OtherTask,
  type Task,
} from '@/lib/tasks';
import { logFeatureUse } from '@/lib/usage';

// Nama sapaan di Home memakai OWNER_NAME bersama (lib/family) — dipakai juga
// untuk mengenali "saya" di pohon keluarga. Ganti di sana kalau mau ubah.

// Daftar fitur di Home. Tambah fitur baru = tambah 1 baris di sini.
// Tiap fitur punya warna sendiri (bg + fg) biar gampang dikenali sekilas.
const FEATURES: {
  key: string;
  label: string;
  icon:
    | 'checklist'
    | 'banknote'
    | 'heart.fill'
    | 'person.2.fill'
    | 'chart.line.uptrend.xyaxis'
    | 'car.fill'
    | 'target'
    | 'book.closed.fill'
    | 'books.vertical.fill'
    | 'house.fill'
    | 'briefcase.fill'
    | 'person.3.fill'
    | 'mountain.2.fill'
    | 'dumbbell.fill'
    | 'globe';
  route: Href;
  bg: string;
  fg: string;
}[] = [
  { key: 'tasks', label: 'Reminder', icon: 'checklist', route: '/tasks', bg: Color.MAIN_LIGHT, fg: Color.MAIN_DARK },
  { key: 'spiritual', label: 'Spiritual', icon: 'book.closed.fill', route: '/spiritual', bg: Color.SPIRITUAL, fg: Color.SPIRITUAL_DARK },
  { key: 'health', label: 'Health', icon: 'heart.fill', route: '/health', bg: Color.FINANCE_EXPENSE, fg: Color.DANGER },
  { key: 'core', label: 'CORE', icon: 'person.2.fill', route: '/core', bg: Color.FINANCE_INVESTMENT, fg: Color.TEXT_TITLE },

  { key: 'finance', label: 'Finance', icon: 'banknote', route: '/finance', bg: Color.FINANCE_INCOME, fg: Color.FINANCE_INCOME_DARK },
  { key: 'book', label: 'Book', icon: 'books.vertical.fill', route: '/book', bg: Color.BOOK, fg: Color.BOOK_DARK },
  { key: 'fitness', label: 'Fitness', icon: 'dumbbell.fill', route: '/fitness', bg: Color.FITNESS, fg: Color.FITNESS_DARK },
  { key: 'family', label: 'Family', icon: 'person.3.fill', route: '/family', bg: Color.FINANCE_SAVING, fg: Color.ACCENT_DARK },

  { key: 'investment', label: 'Investment', icon: 'chart.line.uptrend.xyaxis', route: '/investment', bg: Color.CAREER_DARK, fg: Color.TEXT_LABEL },
  { key: 'career', label: 'Career', icon: 'briefcase.fill', route: '/career', bg: Color.CAREER, fg: Color.ACCENT_DARK },
  { key: 'fun', label: 'Fun', icon: 'mountain.2.fill', route: '/fun', bg: Color.FUN, fg: Color.FUN_DARK },
  { key: 'wheel', label: 'Wheel', icon: 'target', route: '/wheel', bg: Color.WHEEL, fg: Color.WHEEL_DARK },

  { key: 'car', label: 'Car', icon: 'car.fill', route: '/car', bg: Color.ACCENT, fg: Color.ACCENT_DARK },
  { key: 'residence', label: 'Residence', icon: 'house.fill', route: '/residence', bg: Color.HOUSE, fg: Color.HOUSE_DARK },
  { key: 'world', label: 'World', icon: 'globe', route: '/world', bg: Color.WORLD, fg: Color.WORLD_DARK },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Daily login streak 🔥 — undefined = belum termuat.
  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);

  // Data untuk badge tugas harian per fitur + air putih di kartu sapaan.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [revive, setRevive] = useState<LoginStreak | null | undefined>(undefined);
  const [carParts, setCarParts] = useState<PartStatusMap>({});
  const [residenceChores, setResidenceChores] = useState<ChoreStatusMap>({});
  // Prioritas P1 — untuk badge Career (Fulltime + Freelance) & Reminder.
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [freelance, setFreelance] = useState<FreelanceProject[]>([]);
  const [otherTasks, setOtherTasks] = useState<OtherTask[]>([]);
  // Bacaan Alkitab hari ini — null = belum termuat.
  const [bibleRead, setBibleRead] = useState<BibleReadSessions | null>(null);

  // Jam berjalan (di-refresh tiap menit) — untuk gate doa jam 4 & badge yang
  // bergantung waktu (mobil/rumah).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeLoginStreak(user.uid, setLogin),
      subscribeChoreStatus(user.uid, setResidenceChores),
      subscribeTasks(user.uid, setTasks),
      subscribeHabitSchedule(user.uid, setSchedule),
      subscribeHabitDay(user.uid, todayId, setDay),
      subscribeCoreLeaders(user.uid, setLeaders),
      subscribeReviveStreak(user.uid, setRevive),
      subscribePartStatus(user.uid, setCarParts),
      subscribeRoadmap(user.uid, setRoadmap),
      subscribeFreelance(user.uid, setFreelance),
      subscribeOtherTasks(user.uid, setOtherTasks),
      subscribeBibleReadToday(user.uid, todayId, setBibleRead),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, todayId]);

  // Doa pagi terlewat: sudah lewat jam 11 & belum dikonfirmasi hari ini.
  // Saat ini terjadi, streak doa dihanguskan (sekali) lalu Home tidak lagi
  // memaksa lock screen — langsung ke Home meski streak sudah 0.
  const prayerMissed =
    login != null && !prayerDoneToday(login, now) && prayerDeadlinePassed(now);
  useEffect(() => {
    if (user && prayerMissed && login && login.count > 0) {
      resetPrayerStreak(user.uid, login).catch(() => {});
    }
  }, [user, prayerMissed, login]);

  // Kebiasaan harian (sama tiap hari) — untuk badge Health.
  const daySchedule = schedule ?? [];

  // Air putih 💧 — gelas terminum hari ini (0..). Tersimpan per hari (HabitDay
  // per dayId) → otomatis kembali 0 tiap ganti hari.
  const water = day?.water ?? 0;

  // Baca Alkitab 📖: kartu hanya muncul di dalam jendela jamnya & selama sesi
  // itu belum diisi. null = belum termuat (biar kartunya tidak berkedip).
  const bibleSession = bibleSessionNow(now);
  const bibleMeta = bibleSession ? bibleSessionMeta(bibleSession) : null;
  const bibleReadDue =
    bibleSession !== null && bibleRead !== null && !bibleRead[bibleSession];

  // Badge merah per fitur: berapa hal harian yang BELUM selesai hari ini.
  // 0 = badge hilang — tanda hari ini beres 🎉
  const badges: Record<string, number> = {
    // Task HARI INI yang belum selesai + Reminder Prioritas yang sudah P1
    // (termasuk yang otomatis naik P1 karena deadline sudah H-7).
    tasks:
      tasks.filter((t) => !t.done && t.dayId === todayId).length +
      otherTasks.filter(
        (t) => !t.done && effectiveOtherTask(t, now).priority === 1,
      ).length,
    // Career: prioritas P1 Fulltime yang belum selesai + proyek Freelance
    // yang deadline-nya sudah H-7 (Freelance tidak punya kolom prioritas).
    career:
      roadmap.filter(
        (r) => r.status !== 'done' && effectiveRoadmap(r, now).priority === 1,
      ).length +
      freelance.filter((p) => freelanceReminderWindow(p, now)).length,
    // Hanya sesi yang waktunya sudah tiba (Pagi ≥06:00 · Siang ≥12:00 ·
    // Malam ≥18:00) — sesi yang belum waktunya tidak ikut dihitung.
    health: day ? pendingHabits(daySchedule, day.done, now).length : 0,
    // 2 CORE Leader fokus minggu ini yang belum di-follow up hari ini.
    core: weeklyLeaders(leaders, weekIndex(now), WEEKLY_FOCUS_COUNT).filter(
      (l) => l.lastFollowupDayId !== todayId,
    ).length,
    // Revive belum ditulis hari ini = 1 (streak doc menyimpan hari terakhir).
    spiritual:
      revive === undefined ? 0 : revive?.lastDayId === todayId ? 0 : 1,
    // Jumlah part mobil yang perlu perhatian (segera/lewat jadwal).
    car: countCarAttention(carParts, now),
    // Jumlah perawatan/kebersihan rumah yang perlu perhatian.
    residence: countResidenceAttention(residenceChores, now),
  };

  // Air putih 💧 — tombol cepat harian di kartu sapaan (tersimpan di HabitDay).
  async function changeWater(delta: number) {
    if (!user || !day) return;
    try {
      await setWater(user.uid, todayId, day.water + delta);
    } catch {
      // Diamkan — snapshot akan mengoreksi tampilan otomatis.
    }
  }

  // Selagi status streak doa belum termuat → loading singkat, biar tidak
  // "berkedip" Home dulu baru muncul lock screen doa pagi.
  if (login === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={Color.MAIN} />
        </View>
      </SafeAreaView>
    );
  }

  // Doa pagi belum dikonfirmasi & MASIH di jendela pagi (sebelum jam 11) →
  // lock screen penuh (di luar tab supaya menutupi tab bar). Lewat jam 11
  // tanpa doa → tidak dipaksa lagi; langsung Home (streak sudah dihanguskan).
  //
  // Layar lain diurus <MorningPrayerWatcher/> di app/_layout.tsx. Cek di sini
  // tetap ada supaya Home tidak sempat tergambar sekejap sebelum dialihkan.
  if (!prayerDoneToday(login, now) && !prayerDeadlinePassed(now)) {
    return <Redirect href="/morning-prayer" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.brandRow}>
        <VixText heading="header" additionalStyle={styles.brand}>
          vix <VixText heading="label">Super App</VixText>
        </VixText>
        <View style={styles.brandRight}>
          {/* Tombol streak login 🔥 → halaman achievement */}
          <PressableScale
            style={styles.streakPill}
            onPress={() => router.push('/achievements')}>
            <VixText heading="bold" additionalStyle={styles.streakPillText}>
              🏆🔥 {login?.count ?? 0}
            </VixText>
          </PressableScale>
          <PressableScale onPress={logout} hitSlop={10}>
            <IconSymbol
              name="rectangle.portrait.and.arrow.right"
              size={22}
              color={Color.MAIN}
            />
          </PressableScale>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Kolom dibatasi lebarnya & ditengahkan — di iPad/layar lebar tidak
            melebar penuh, tetap rapi di tengah seperti di HP. */}
        <View style={styles.contentInner}>
          <Animated.View
            entering={FadeInDown.duration(350)}
            style={styles.welcomeCard}>
            <View style={styles.welcomeTop}>
              <Greeting heading="paragraph" color={Color.TEXT_ON_DARK_MUTED} />
              <VixText heading="label" additionalStyle={styles.welcomeDate}>
                📆 {formatShortDayDate(new Date())}
              </VixText>
            </View>
            <VixText heading="subheader" additionalStyle={styles.welcomeName}>
              {OWNER_NAME.toUpperCase()}
            </VixText>
            {/* Air putih 💧 — tombol harian yang sering dipencet, dibuat ringkas */}
            <View style={styles.waterRow}>
              <VixText heading="bold" additionalStyle={styles.waterLabel}>
                💧 Air putih {water}/{WATER_GOAL} gelas
              </VixText>
              <View style={styles.waterButtons}>
                <PressableScale
                  style={styles.waterButton}
                  onPress={() => changeWater(-1)}
                  hitSlop={6}>
                  <VixText heading="bold" additionalStyle={styles.waterButtonText}>
                    −
                  </VixText>
                </PressableScale>
                <PressableScale
                  style={[styles.waterButton, styles.waterButtonPlus]}
                  onPress={() => changeWater(1)}
                  hitSlop={6}>
                  <IconSymbol name="plus" size={16} color={Color.MAIN_DARK} />
                </PressableScale>
              </View>
            </View>
            {water >= WATER_GOAL && (
              <VixText heading="label" additionalStyle={styles.waterDone}>
                ✅ Telah mencukupi air seharian 🎉
              </VixText>
            )}
          </Animated.View>

          {/* Baca Alkitab 📖 — 🌅 Pagi 05.00–10.00 & 🌙 Malam 21.00–24.00.
              Hanya muncul di dalam jendela jamnya & selama sesi itu belum
              diisi. Ketuk → layar catat bacaan (pilih kitab + pasal & ayat). */}
          {bibleReadDue && bibleMeta && bibleSession && (
            <Animated.View entering={FadeInDown.delay(60).duration(350)}>
              <PressableScale
                style={styles.readingCard}
                onPress={() =>
                  router.push({
                    pathname: '/bible-read',
                    params: { session: bibleSession },
                  })
                }>
                <CheckCircle checked={false} size={24} />
                <VixText heading="bold" additionalStyle={styles.readingTitle}>
                  {bibleMeta.emoji} {bibleMeta.title}
                </VixText>
              </PressableScale>
            </Animated.View>
          )}

          <View style={styles.grid}>
            {FEATURES.map((feature, index) => {
              const badge = badges[feature.key] ?? 0;
              return (
                // Tiap tile muncul berurutan (stagger) saat Home dibuka.
                <Animated.View
                  key={feature.key}
                  entering={FadeInDown.delay(index * 40).duration(300)}
                  style={styles.gridItem}>
                  <PressableScale
                    style={[styles.tile, { backgroundColor: feature.bg }]}
                    onPress={() => {
                      // Catat pemakaian fitur (throttled) untuk laporan di tab System.
                      if (user) logFeatureUse(user.uid, feature.key, feature.label);
                      router.push(feature.route);
                    }}>
                    <IconSymbol name={feature.icon} size={30} color={feature.fg} />
                  </PressableScale>
                  {/* Badge merah: tugas harian fitur ini yang belum selesai */}
                  {badge > 0 && (
                    <View style={styles.badge}>
                      <VixText heading="label" additionalStyle={styles.badgeText}>
                        {badge > 9 ? '9+' : badge}
                      </VixText>
                    </View>
                  )}
                  <VixText heading="label" additionalStyle={styles.tileLabel}>
                    {feature.label}
                  </VixText>
                </Animated.View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    // Sejajar dengan kolom konten yang ditengahkan (iPad/layar lebar).
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  brand: { color: Color.MAIN },
  brandRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  content: { paddingBottom: 40, alignItems: 'center' },
  // Lebar konten dibatasi & otomatis di tengah (HP: penuh; iPad: ~680 di tengah).
  contentInner: { width: '100%', maxWidth: 680, paddingHorizontal: 20 },
  welcomeCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
  },
  welcomeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  welcomeDate: { color: Color.TEXT_ON_DARK_MUTED },
  welcomeName: {
    color: Color.TEXT_REVERSE,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  waterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  waterLabel: { color: Color.MAIN_LIGHT, flexShrink: 1 },
  waterButtons: { flexDirection: 'row', gap: 8 },
  waterButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.MAIN_LIGHT,
  },
  waterButtonPlus: { backgroundColor: Color.ACCENT },
  waterButtonText: { color: Color.MAIN_DARK, fontSize: 18, lineHeight: 22 },
  waterDone: { color: Color.MAIN_LIGHT, marginTop: 2 },
  streakPill: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: Color.ACCENT_DARK,
  },
  streakPillText: { color: Color.ACCENT_DARK },
  // Kartu Baca Alkitab di bawah kartu sapaan (tema spiritual/ungu).
  readingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  readingTitle: { color: Color.TEXT_TITLE, flexShrink: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  gridItem: { width: '21.5%', alignItems: 'center' },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: { textAlign: 'center', marginTop: 8 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -4,
    minWidth: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: Color.DANGER,
    borderWidth: 2,
    borderColor: Color.BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Color.TEXT_REVERSE },
});
