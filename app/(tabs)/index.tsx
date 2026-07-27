import { Redirect, useRouter, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
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
  prayerDoneToday,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';
import {
  roadmapDaysUntil,
  roadmapReminderWindow,
  subscribeRoadmap,
  type RoadmapItem,
} from '@/lib/career';
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
import {
  debtDaysUntil,
  debtRemaining,
  debtReminderWindow,
  subscribeDebts,
  type Debt,
} from '@/lib/debts';
import { subscribeFamily, type FamilyMember } from '@/lib/family';
import { formatDate, formatShortDayDate } from '@/lib/format';
import {
  checkupDueReminders,
  dayDocId,
  needsWeighIn,
  subscribeCheckups,
  subscribeHabitDay,
  subscribeHabits,
  subscribeHealthProfile,
  type Checkup,
  type Habit,
  type HabitDay,
  type HealthProfile,
} from '@/lib/health';
import {
  currentSundayId,
  sermonReminderActive,
  subscribeSermons,
  type SermonNote,
} from '@/lib/sermon';
import { subscribeReviveStreak } from '@/lib/spiritual';
import {
  setTaskDone,
  subscribeTasks,
  TASK_CATEGORIES,
  type Task,
} from '@/lib/tasks';
import { formatRupiah } from '@/lib/transactions';

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
    | 'person.3.fill'
    | 'mountain.2.fill'
    | 'dumbbell.fill';
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
  { key: 'fun', label: 'Fun', icon: 'mountain.2.fill', route: '/fun', bg: Color.FUN, fg: Color.FUN_DARK },
  { key: 'fitness', label: 'Fitness', icon: 'dumbbell.fill', route: '/fitness', bg: Color.FITNESS, fg: Color.FITNESS_DARK },
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
  const [debts, setDebts] = useState<Debt[]>([]);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [sermons, setSermons] = useState<SermonNote[]>([]);
  const [revive, setRevive] = useState<LoginStreak | null | undefined>(undefined);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);

  // Jam berjalan (di-refresh tiap menit) — untuk gate doa jam 4 & reminder
  // khotbah yang bergantung waktu.
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
      subscribeTasks(user.uid, setTasks),
      subscribeHabits(user.uid, setHabits),
      subscribeHabitDay(user.uid, todayId, setDay),
      subscribeCoreLeaders(user.uid, setLeaders),
      subscribeMainTeam(user.uid, setMainTeam),
      subscribeVisitations(user.uid, setVisitations),
      subscribeFamily(user.uid, setFamily),
      subscribeDebts(user.uid, setDebts),
      subscribeCheckups(user.uid, setCheckups),
      subscribeHealthProfile(user.uid, setProfile),
      subscribeSermons(user.uid, setSermons),
      subscribeReviveStreak(user.uid, setRevive),
      subscribeRoadmap(user.uid, setRoadmap),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, todayId]);

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

  // Reminder bayar hutang: yang belum lunas & jatuh tempo ≤ 3 hari (termasuk
  // lewat). Fokus ke "Hutang Saya", tapi tagihan ke orang juga diingatkan.
  const debtReminders = debts
    .filter((d) => debtReminderWindow(d, now))
    .sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis())
    .map((d) => {
      const days = debtDaysUntil(d, now);
      const when =
        days === 0 ? 'HARI INI' : days > 0 ? `${days} hari lagi` : `lewat ${-days} hari`;
      const arrow = d.direction === 'mine' ? '💸 Bayar' : '💰 Tagih';
      return {
        id: d.id,
        text: `${arrow} ${d.person} — ${formatRupiah(debtRemaining(d))} · ${when}`,
      };
    });

  // Reminder cek kesehatan: 6 bulan sejak tensi / gula darah terakhir.
  const checkupReminders = checkupDueReminders(checkups, now).map((c) => ({
    id: c.type,
    text: `${c.icon} ${c.label} — waktunya cek lagi${
      c.days < 0 ? ` (lewat ${-c.days} hari)` : ''
    }`,
  }));

  // Reminder deadline prioritas kerja fulltime: belum selesai & ≤ 3 hari lagi
  // (termasuk yang sudah lewat).
  const careerReminders = roadmap
    .filter((r) => roadmapReminderWindow(r, now))
    .sort((a, b) => a.deadline!.toMillis() - b.deadline!.toMillis())
    .map((r) => {
      const days = roadmapDaysUntil(r.deadline!, now);
      const when =
        days === 0 ? 'HARI INI' : days > 0 ? `${days} hari lagi` : `lewat ${-days} hari`;
      return { id: r.id, text: `💻 ${r.title} · ${when}` };
    });

  // Reminder timbang berat: tiap Minggu kalau belum update berat hari ini.
  const weighInDue = profile != null && needsWeighIn(profile, now);

  // Reminder renungan khotbah: Rabu/Jumat 12:30–17:30, kalau catatan khotbah
  // Minggu ini SUDAH ada. Ditekan → tab Khotbah (ringkasan singkatnya).
  const sundaySermon =
    sermonReminderActive(now) &&
    sermons.find((s) => s.id === currentSundayId(now));

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

  // Doa pagi hari ini (batas jam 4) belum dikonfirmasi → lock screen penuh.
  // Diarahkan ke halaman terpisah (di luar tab) supaya menutupi tab bar.
  if (!prayerDoneToday(login, now)) {
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
        <Animated.View
          entering={FadeInDown.duration(350)}
          style={styles.welcomeCard}>
          <View style={styles.welcomeTop}>
            {/* Sapaan sesuai jam menggantikan "Selamat datang," */}
            <Greeting heading="paragraph" color={Color.TEXT_ON_DARK_MUTED} />
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

        {/* Reminder bayar hutang (jatuh tempo ≤ 7 hari / lewat) */}
        {debtReminders.length > 0 && (
          <PressableScale
            style={styles.debtCard}
            onPress={() => router.push('/debts')}>
            <VixText heading="bold" additionalStyle={styles.debtTitle}>
              🤝 Reminder Hutang
            </VixText>
            {debtReminders.map((r) => (
              <VixText
                key={r.id}
                heading="label"
                additionalStyle={styles.debtText}>
                {r.text}
              </VixText>
            ))}
          </PressableScale>
        )}

        {/* Reminder cek tensi & gula darah (6 bulan sekali) */}
        {checkupReminders.length > 0 && (
          <PressableScale
            style={styles.checkupCard}
            onPress={() => router.push('/health')}>
            <VixText heading="bold" additionalStyle={styles.checkupTitle}>
              🩺 Waktunya Cek Kesehatan
            </VixText>
            {checkupReminders.map((r) => (
              <VixText
                key={r.id}
                heading="label"
                additionalStyle={styles.checkupText}>
                {r.text}
              </VixText>
            ))}
          </PressableScale>
        )}

        {/* Reminder timbang berat tiap Minggu → langsung buka editor Data Tubuh */}
        {weighInDue && (
          <PressableScale
            style={styles.weighCard}
            onPress={() =>
              router.push({
                pathname: '/health',
                params: { tab: 'summary', weighIn: '1' },
              })
            }>
            <VixText heading="bold" additionalStyle={styles.weighTitle}>
              ⚖️ Timbang Berat Minggu Ini
            </VixText>
            <VixText heading="label" additionalStyle={styles.weighText}>
              Ukur & update berat (kg) — biar progres target beratmu kelihatan.
            </VixText>
          </PressableScale>
        )}

        {/* Reminder renungkan khotbah Minggu (Rabu/Jumat siang) — ungu */}
        {sundaySermon && (
          <PressableScale
            style={styles.sermonCard}
            onPress={() =>
              router.push({ pathname: '/spiritual', params: { tab: 'khotbah' } })
            }>
            <VixText heading="bold" additionalStyle={styles.sermonTitle}>
              🙏 Renungkan Khotbah Minggu
            </VixText>
            <VixText heading="label" additionalStyle={styles.sermonText}>
              ⛪ {sundaySermon.title}
            </VixText>
            {sundaySermon.quote ? (
              <VixText
                heading="label"
                numberOfLines={2}
                additionalStyle={styles.sermonText}>
                “{sundaySermon.quote}”
              </VixText>
            ) : null}
          </PressableScale>
        )}

        {/* Reminder deadline prioritas kerja — warna coklat seperti Career */}
        {careerReminders.length > 0 && (
          <PressableScale
            style={styles.careerCard}
            onPress={() => router.push('/career')}>
            <VixText heading="bold" additionalStyle={styles.careerTitle}>
              💼 Deadline Prioritas Kerja
            </VixText>
            {careerReminders.map((r) => (
              <VixText
                key={r.id}
                heading="label"
                additionalStyle={styles.careerText}>
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
            {todayTasks.slice(0, 3).map((t) => (
              <View key={t.id} style={styles.taskRow}>
                {/* Lingkaran ini yang dicentang */}
                <PressableScale onPress={() => toggleTask(t)} hitSlop={8}>
                  <CheckCircle checked={t.done} size={22} />
                </PressableScale>
                {/* Tekan isinya → buka Task di kategori task ini */}
                <PressableScale
                  style={styles.taskRowMain}
                  onPress={() =>
                    router.push({
                      pathname: '/tasks',
                      params: { category: t.category },
                    })
                  }>
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
                </PressableScale>
              </View>
            ))}
            {todayTasks.length > 3 && (
              <PressableScale onPress={() => router.push('/tasks')}>
                <VixText heading="label" additionalStyle={styles.taskMore}>
                  +{todayTasks.length - 3} task lagi →
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
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  debtCard: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_EXPENSE_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
  debtTitle: { color: Color.FINANCE_EXPENSE_DARK },
  debtText: { color: Color.FINANCE_EXPENSE_DARK },
  checkupCard: {
    backgroundColor: Color.MAIN_LIGHT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.MAIN_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
  checkupTitle: { color: Color.MAIN_DARK },
  checkupText: { color: Color.MAIN_DARK },
  weighCard: {
    backgroundColor: Color.FINANCE_INVESTMENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_INVESTMENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
  weighTitle: { color: Color.FINANCE_INVESTMENT_DARK },
  weighText: { color: Color.FINANCE_INVESTMENT_DARK },
  sermonCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.SPIRITUAL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
  sermonTitle: { color: Color.SPIRITUAL_DARK },
  sermonText: { color: Color.SPIRITUAL_DARK },
  careerCard: {
    backgroundColor: Color.CAREER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
  careerTitle: { color: Color.ACCENT_DARK },
  careerText: { color: Color.ACCENT_DARK },
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
  taskRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  taskCat: { fontSize: 13, lineHeight: 18 },
  // Font sengaja lebih kecil dari label (kartu ringkas sekilas-lihat).
  taskText: { flex: 1, color: Color.TEXT_TITLE, fontSize: 12, lineHeight: 16 },
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
