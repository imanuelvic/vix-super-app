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
import { ReminderCard } from '@/components/common/ReminderCard';
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
  EMPTY_CORE_IDEAS,
  FOLLOWUPS_MT_PER_DAY,
  FOLLOWUPS_PER_DAY,
  IDEA_CADENCE_LABEL,
  ideaReminderDue,
  nextBirthday,
  subscribeCoreIdeas,
  subscribeCoreLeaders,
  subscribeMainTeam,
  subscribeVisitations,
  visitDaysUntil,
  visitReminderWindow,
  type CoreIdeasData,
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
import {
  daysUntilEligible,
  donorReminderDue,
  EMPTY_DONOR,
  nextEligibleDate,
  subscribeDonor,
  type DonorData,
} from '@/lib/donor';
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
  const [coreIdeas, setCoreIdeas] = useState<CoreIdeasData>(EMPTY_CORE_IDEAS);
  const [donor, setDonor] = useState<DonorData>(EMPTY_DONOR);

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
      subscribeCoreIdeas(user.uid, setCoreIdeas),
      subscribeDonor(user.uid, setDonor),
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
  // Kartu hanya menampilkan 3 task teratas (urut: belum selesai dulu). Tombol
  // "+N task lagi" hanya menghitung task BELUM SELESAI yang tidak ikut tampil —
  // jadi kalau sisanya sudah selesai, tombolnya tidak muncul.
  const HOME_TASK_SHOWN = 3;
  const moreUndone = todayTasks
    .slice(HOME_TASK_SHOWN)
    .filter((t) => !t.done).length;

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

  // Reminder Idea For CORE: waktunya kasih masukan ide baru (mingguan/bulanan).
  const coreIdeaDue = ideaReminderDue(coreIdeas, now);

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

  // Reminder donor darah: HANYA hari Minggu & sudah boleh donor lagi (biar
  // tidak muncul tiap hari). Teksnya: kapan terakhir donor + sejak kapan boleh.
  const donorDue = donorReminderDue(donor, now);
  const donorTexts: string[] = [];
  if (donorDue && donor.lastDonation) {
    const eligible = nextEligibleDate(donor);
    const since = -(daysUntilEligible(donor, now) ?? 0);
    donorTexts.push(`Terakhir donor: ${formatDate(donor.lastDonation.toDate())}`);
    if (eligible) {
      donorTexts.push(
        `Sudah boleh sejak ${formatDate(eligible)}${
          since > 0 ? ` · ${since} hari lalu` : ' · hari ini'
        }`,
      );
    }
  }

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
          <ReminderCard
            bg={Color.WHEEL}
            fg={Color.WHEEL_DARK}
            title="🎂 Ulang Tahun Keluarga"
            texts={famBirthdays}
            onPress={() => router.push('/family')}
          />
        )}

        {/* Reminder CORE: visitasi (H-3 s/d hari-H) + Idea For CORE mingguan */}
        {(visitReminders.length > 0 || coreIdeaDue) && (
          <View style={styles.visitCard}>
            {visitReminders.length > 0 && (
              <PressableScale
                // Langsung mendarat di tab Visitasi, bukan tab default.
                onPress={() =>
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
            {coreIdeaDue && (
              <PressableScale
                style={visitReminders.length > 0 ? styles.ideaReminder : undefined}
                // Idea For CORE ada di tab Follow Up.
                onPress={() =>
                  router.push({ pathname: '/core', params: { tab: 'followup' } })
                }>
                <VixText heading="bold" additionalStyle={styles.visitTitle}>
                  💡 Idea untuk CORE
                </VixText>
                <VixText heading="label" additionalStyle={styles.visitText}>
                  Waktunya kasih masukan ide baru (
                  {IDEA_CADENCE_LABEL[coreIdeas.cadence].toLowerCase()}) — share
                  juga ke grup MT 🙌
                </VixText>
              </PressableScale>
            )}
          </View>
        )}

        {/* Reminder bayar hutang (jatuh tempo ≤ 3 hari / lewat) */}
        {debtReminders.length > 0 && (
          <ReminderCard
            bg={Color.FINANCE_EXPENSE}
            fg={Color.FINANCE_EXPENSE_DARK}
            title="🤝 Reminder Hutang"
            texts={debtReminders}
            onPress={() => router.push('/debts')}
          />
        )}

        {/* Reminder cek tensi & gula darah (6 bulan sekali) */}
        {checkupReminders.length > 0 && (
          <ReminderCard
            bg={Color.MAIN_LIGHT}
            fg={Color.MAIN_DARK}
            title="🩺 Waktunya Cek Kesehatan"
            texts={checkupReminders}
            onPress={() => router.push('/health')}
          />
        )}

        {/* Reminder timbang berat tiap Minggu → langsung buka editor Data Tubuh */}
        {weighInDue && (
          <ReminderCard
            bg={Color.FINANCE_INVESTMENT}
            fg={Color.FINANCE_INVESTMENT_DARK}
            title="⚖️ Timbang Berat Minggu Ini"
            texts={[
              'Ukur & update berat (kg) — biar progres target beratmu kelihatan.',
            ]}
            onPress={() =>
              router.push({
                pathname: '/health',
                params: { tab: 'summary', weighIn: '1' },
              })
            }
          />
        )}

        {/* Reminder donor darah (Minggu saja) — warna Health (merah) */}
        {donorDue && (
          <ReminderCard
            bg={Color.FINANCE_EXPENSE}
            fg={Color.DANGER}
            title="🩸 Sudah Bisa Donor Darah!"
            texts={donorTexts}
            onPress={() => router.push('/donor')}
          />
        )}

        {/* Reminder renungkan khotbah Minggu (Rabu/Jumat siang) — ungu */}
        {sundaySermon && (
          <ReminderCard
            bg={Color.SPIRITUAL}
            fg={Color.SPIRITUAL_DARK}
            title="🙏 Renungkan Khotbah Minggu"
            onPress={() =>
              router.push({ pathname: '/spiritual', params: { tab: 'khotbah' } })
            }>
            <VixText heading="label" additionalStyle={styles.onSpiritual}>
              ⛪ {sundaySermon.title}
            </VixText>
            {sundaySermon.quote ? (
              <VixText
                heading="label"
                numberOfLines={2}
                additionalStyle={styles.onSpiritual}>
                “{sundaySermon.quote}”
              </VixText>
            ) : null}
          </ReminderCard>
        )}

        {/* Reminder deadline prioritas kerja — warna coklat seperti Career */}
        {careerReminders.length > 0 && (
          <ReminderCard
            bg={Color.CAREER}
            fg={Color.ACCENT_DARK}
            title="💼 Deadline Prioritas Kerja"
            texts={careerReminders}
            onPress={() => router.push('/career')}
          />
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
            {todayTasks.slice(0, HOME_TASK_SHOWN).map((t) => (
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
            {moreUndone > 0 && (
              <PressableScale onPress={() => router.push('/tasks')}>
                <VixText heading="label" additionalStyle={styles.taskMore}>
                  +{moreUndone} task lagi →
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
  // Pemisah antara reminder visitasi & idea di dalam kartu CORE yang sama.
  ideaReminder: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Color.ACCENT_DARK,
    gap: 3,
  },
  // Baris teks di dalam ReminderCard khotbah (kutipan di-clamp 2 baris).
  onSpiritual: { color: Color.SPIRITUAL_DARK },
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
