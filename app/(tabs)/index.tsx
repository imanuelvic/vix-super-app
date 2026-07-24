import { useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  recordDailyLogin,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';
import {
  FOLLOWUPS_MT_PER_DAY,
  FOLLOWUPS_PER_DAY,
  nextBirthday,
  subscribeCoreLeaders,
  subscribeMainTeam,
  subscribeVisitations,
  visitDaysUntil,
  visitReminderWindow,
  type CoreLeader,
  type MainTeamMember,
  type Visitation,
} from '@/lib/core';
import { subscribeFamily, type FamilyMember } from '@/lib/family';
import { formatDate, formatShortDayDate } from '@/lib/format';
import {
  dayDocId,
  subscribeHabitDay,
  subscribeHabits,
  type Habit,
  type HabitDay,
} from '@/lib/health';
import { subscribeReviveStreak } from '@/lib/spiritual';
import {
  setTaskDone,
  subscribeTasks,
  TASK_CATEGORIES,
  type Task,
} from '@/lib/tasks';

// Nama sapaan di Home — ganti di sini kalau mau ubah.
const OWNER_NAME = 'Imanuel Victory Rumayar';

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
    | 'briefcase.fill'
    | 'person.3.fill';
  route: Href;
  bg: string;
  fg: string;
}[] = [
  { key: 'tasks', label: 'Task', icon: 'checklist', route: '/tasks', bg: Color.MAIN_LIGHT, fg: Color.MAIN_DARK },
  { key: 'spiritual', label: 'Spiritual', icon: 'book.closed.fill', route: '/spiritual', bg: Color.SPIRITUAL, fg: Color.SPIRITUAL_DARK },
  { key: 'health', label: 'Health', icon: 'heart.fill', route: '/health', bg: Color.FINANCE_EXPENSE, fg: Color.DANGER },
  { key: 'core', label: 'CORE', icon: 'person.2.fill', route: '/core', bg: Color.FINANCE_INVESTMENT, fg: Color.TEXT_TITLE },
  { key: 'finance', label: 'Finance', icon: 'banknote', route: '/finance', bg: Color.FINANCE_INCOME, fg: Color.MAIN_DARK },
  { key: 'career', label: 'Career', icon: 'briefcase.fill', route: '/career', bg: Color.CAREER, fg: Color.ACCENT_DARK },
  { key: 'trading', label: 'Trading', icon: 'chart.line.uptrend.xyaxis', route: '/trading', bg: Color.CAREER_DARK, fg: Color.TEXT_LABEL },
  { key: 'family', label: 'Family', icon: 'person.3.fill', route: '/family', bg: Color.FINANCE_SAVING, fg: Color.ACCENT_DARK },
  { key: 'wheel', label: 'Wheel', icon: 'target', route: '/wheel', bg: Color.WHEEL, fg: Color.WHEEL_DARK },
  { key: 'car', label: 'Car', icon: 'car.fill', route: '/car', bg: Color.ACCENT, fg: Color.ACCENT_DARK },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Daily login streak 🔥 — undefined = belum termuat.
  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);

  // Data untuk badge tugas harian per fitur.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[]>([]);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [revive, setRevive] = useState<LoginStreak | null | undefined>(undefined);

  const todayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      subscribeLoginStreak(user.uid, setLogin),
      subscribeTasks(user.uid, setTasks),
      subscribeHabits(user.uid, setHabits),
      subscribeHabitDay(user.uid, todayId, setDay),
      subscribeCoreLeaders(user.uid, setLeaders),
      subscribeMainTeam(user.uid, setMainTeam),
      subscribeVisitations(user.uid, setVisitations),
      subscribeFamily(user.uid, setFamily),
      subscribeReviveStreak(user.uid, setRevive),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, todayId]);

  // Catat login hari ini sekali saja (recordDailyLogin sudah anti-dobel).
  useEffect(() => {
    if (!user || login === undefined) return;
    recordDailyLogin(user.uid, login).catch(() => {});
  }, [user, login]);

  // Badge merah per fitur: berapa hal harian yang BELUM selesai hari ini.
  // 0 = badge hilang — tanda hari ini beres 🎉
  const badges: Record<string, number> = {
    // Hanya task HARI INI — task tanggal depan tidak dihitung.
    tasks: tasks.filter((t) => !t.done && t.dayId === todayId).length,
    health: day ? habits.filter((h) => !day.done[h.id]).length : 0,
    core:
      Math.max(
        0,
        Math.min(FOLLOWUPS_PER_DAY, leaders.length) -
          leaders.filter((l) => l.lastFollowupDayId === todayId).length,
      ) +
      Math.max(
        0,
        Math.min(FOLLOWUPS_MT_PER_DAY, mainTeam.length) -
          mainTeam.filter((m) => m.lastFollowupDayId === todayId).length,
      ),
    // Revive belum ditulis hari ini = 1 (streak doc menyimpan hari terakhir).
    spiritual:
      revive === undefined ? 0 : revive?.lastDayId === todayId ? 0 : 1,
  };

  // Task hari ini — bisa dicentang langsung dari Home. Belum selesai di atas.
  const catIcon = (key: string) =>
    TASK_CATEGORIES.find((c) => c.key === key)?.icon ?? '';
  const todayTasks = tasks
    .filter((t) => t.dayId === todayId)
    .sort((a, b) => Number(a.done) - Number(b.done));
  const todayUndone = todayTasks.filter((t) => !t.done).length;

  async function toggleTask(t: Task) {
    if (!user) return;
    try {
      await setTaskDone(user.uid, t.id, !t.done);
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    }
  }

  // Reminder ulang tahun keluarga: hari ini + 7 hari ke depan
  // (yang sudah tiada ✝ tidak diikutkan).
  const now = new Date();
  const famBirthdays = family
    .filter((m) => !m.deceased)
    .map((m) => ({ m, ...nextBirthday(m, now) }))
    .filter((b) => b.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map((b) => ({
      id: b.m.id,
      text:
        b.daysUntil === 0
          ? `${b.m.name} — HARI INI 🎉 (ke-${b.turningAge})`
          : `${b.m.name} — ${b.daysUntil} hari lagi (ke-${b.turningAge})`,
    }));

  // Reminder visitasi CORE: H-3 sampai hari-H, yang belum divisit.
  const visitReminders = visitations
    .filter((v) => visitReminderWindow(v, now))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())
    .map((v) => {
      const cl = leaders.find((l) => l.id === v.leaderId);
      const days = visitDaysUntil(v, now);
      return {
        id: v.id,
        text: `${cl ? `${cl.heart} ${cl.name}` : 'CORE'} — ${
          days === 0 ? 'HARI INI' : `${days} hari lagi`
        } (${formatDate(v.date.toDate())})`,
      };
    });

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
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={styles.welcomeCard}>
          <View style={styles.welcomeTop}>
            <VixText heading="paragraph" additionalStyle={styles.welcomeSmall}>
              Selamat datang,
            </VixText>
            {/* Tanggal hari ini di ujung kanan atas card */}
            <VixText heading="label" additionalStyle={styles.welcomeDate}>
              📆 {formatShortDayDate(new Date())}
            </VixText>
          </View>
          <VixText heading="subheader" additionalStyle={styles.welcomeName}>
            {OWNER_NAME.toUpperCase()}
          </VixText>
          {/* Tombol spesial: timeline hidup pribadi */}
          <PressableScale
            style={styles.timelineButton}
            onPress={() => router.push('/timeline')}>
            <VixText heading="bold" additionalStyle={styles.timelineText}>
              📍 My Timeline
            </VixText>
            <IconSymbol name="chevron.right" size={18} color={Color.ACCENT_DARK} />
          </PressableScale>
        </Animated.View>

        {/* Reminder ulang tahun keluarga (hari ini s/d 7 hari) */}
        {famBirthdays.length > 0 && (
          <PressableScale
            style={styles.famCard}
            onPress={() => router.push('/family')}>
            <VixText heading="bold" additionalStyle={styles.famTitle}>
              🎂 Ulang Tahun Keluarga
            </VixText>
            {famBirthdays.map((b) => (
              <VixText
                key={b.id}
                heading="label"
                additionalStyle={styles.famText}>
                {b.text}
              </VixText>
            ))}
          </PressableScale>
        )}

        {/* Reminder visitasi CORE (H-3 s/d hari-H) */}
        {visitReminders.length > 0 && (
          <PressableScale
            style={styles.visitCard}
            onPress={() =>
              // Langsung mendarat di tab Visitasi, bukan tab default.
              router.push({ pathname: '/core', params: { tab: 'visitation' } })
            }>
            <VixText heading="bold" additionalStyle={styles.visitTitle}>
              📍 Reminder Visitasi CORE
            </VixText>
            {visitReminders.map((r) => (
              <VixText
                key={r.id}
                heading="label"
                additionalStyle={styles.visitText}>
                {r.text}
              </VixText>
            ))}
          </PressableScale>
        )}

        {/* Task hari ini — centang langsung tanpa buka fitur Task */}
        {todayTasks.length > 0 && (
          <View style={styles.taskCard}>
            <PressableScale
              style={styles.taskHeader}
              onPress={() => router.push('/tasks')}>
              <VixText heading="title">✅ Task Hari Ini</VixText>
              <View style={styles.taskHeaderRight}>
                <VixText heading="label">
                  {todayUndone > 0 ? `${todayUndone} belum` : 'beres semua 🎉'}
                </VixText>
                <IconSymbol
                  name="chevron.right"
                  size={18}
                  color={Color.TEXT_LABEL}
                />
              </View>
            </PressableScale>
            {todayTasks.slice(0, 5).map((t) => (
              <View key={t.id} style={styles.taskRow}>
                {/* Lingkaran ini yang dicentang */}
                <PressableScale onPress={() => toggleTask(t)} hitSlop={8}>
                  <CheckCircle checked={t.done} size={22} />
                </PressableScale>
                <VixText additionalStyle={styles.taskCat}>
                  {catIcon(t.category)}
                </VixText>
                <VixText
                  heading="label"
                  numberOfLines={1}
                  additionalStyle={[
                    styles.taskText,
                    t.done && styles.taskTextDone,
                  ]}>
                  {t.title}
                </VixText>
              </View>
            ))}
            {todayTasks.length > 5 && (
              <PressableScale onPress={() => router.push('/tasks')}>
                <VixText heading="label" additionalStyle={styles.taskMore}>
                  +{todayTasks.length - 5} task lagi →
                </VixText>
              </PressableScale>
            )}
          </View>
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
                  onPress={() => router.push(feature.route)}>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  brand: { color: Color.MAIN },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  welcomeCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
  },
  brandRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  visitCard: {
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
  visitTitle: { color: Color.ACCENT_DARK },
  visitText: { color: Color.ACCENT_DARK },
  famCard: {
    backgroundColor: Color.WHEEL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.WHEEL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
  famTitle: { color: Color.WHEEL_DARK },
  famText: { color: Color.WHEEL_DARK },
  taskCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 16,
    gap: 10,
    marginTop: -12,
    marginBottom: 24,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskCat: { fontSize: 15, lineHeight: 20 },
  taskText: { flex: 1, color: Color.TEXT_TITLE },
  taskTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  taskMore: { color: Color.MAIN, marginTop: 2 },
  streakPill: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: Color.ACCENT_DARK,
  },
  streakPillText: { color: Color.ACCENT_DARK },
  welcomeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  welcomeSmall: { color: Color.TEXT_ON_DARK_MUTED },
  welcomeDate: { color: Color.TEXT_ON_DARK_MUTED },
  welcomeName: {
    color: Color.TEXT_REVERSE,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  timelineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Color.ACCENT,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  timelineText: { color: Color.ACCENT_DARK },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
