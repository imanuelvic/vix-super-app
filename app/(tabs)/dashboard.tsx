// ============================================================================
// LAYAR DASHBOARD (tab "Dashboard"). Isi = SEMUA kartu reminder harian yang
// dulu ada di Home: kebiasaan sesi, task hari ini, ulang tahun keluarga,
// pertemuan CORE, pokok doa, pinjaman, health, baca Alkitab, khotbah, Wheel,
// deadline kerja, produktivitas, dan Fun.
//
// Home (index.tsx) kini fokus jadi launcher: sapaan + grid fitur. Kartu-kartu
// reminder pindah ke sini supaya Home lebih ringkas.
// ============================================================================
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { ReminderCard } from '@/components/common/ReminderCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { subscribeLoginStreak, type LoginStreak } from '@/lib/achievements';
import {
  deadlineDaysUntil,
  freelanceReminderWindow,
  insuranceMonthKey,
  insuranceRemaining,
  roadmapDaysUntil,
  roadmapReminderWindow,
  subscribeFreelance,
  subscribeInsurance,
  subscribeRoadmap,
  type FreelanceProject,
  type InsuranceMonths,
  type RoadmapItem,
} from '@/lib/career';
import {
  EMPTY_CORE_IDEAS,
  EMPTY_MONTHLY_PRAYERS,
  IDEA_CADENCE_LABEL,
  ideaReminderDue,
  isPrayerFollowupDay,
  meetingKindMeta,
  monthlyPointsFor,
  monthlyPrayerStartReminder,
  nextBirthday,
  prayerFollowupLeaders,
  subscribeCoreIdeas,
  subscribeCoreLeaders,
  subscribeMonthlyPrayers,
  subscribeVisitations,
  visitDaysUntil,
  visitReminderWindow,
  type CoreIdeasData,
  type CoreLeader,
  type MonthlyPrayers,
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
  donorScheduleReminders,
  EMPTY_DONOR,
  nextEligibleDate,
  scheduleDaysUntil,
  subscribeDonor,
  type DonorData,
} from '@/lib/donor';
import { subscribeFamily, type FamilyMember } from '@/lib/family';
import {
  formatDate,
  formatMonthsDays,
  formatShortDayDate,
  MONTH_NAMES,
} from '@/lib/format';
import {
  daysSinceLastFun,
  EMPTY_FUN,
  funIdeasToday,
  funReminderDue,
  subscribeFun,
  type FunData,
} from '@/lib/fun';
import {
  slotMeta,
  slotNow,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  checkupDueReminders,
  dayDocId,
  needsWeighIn,
  subscribeCheckups,
  subscribeHabitDay,
  subscribeHealthProfile,
  type Checkup,
  type HabitDay,
  type HealthProfile,
} from '@/lib/health';
import {
  currentSundayId,
  sermonReminderActive,
  subscribeSermons,
  type SermonNote,
} from '@/lib/sermon';
import {
  setBibleReadingDone,
  subscribeBibleReading,
  subscribeReviveStreak,
} from '@/lib/spiritual';
import {
  setTaskDone,
  subscribeTasks,
  TASK_CATEGORIES,
  type Task,
} from '@/lib/tasks';
import { formatRupiah } from '@/lib/transactions';
import {
  quarterDocId,
  quarterLabel,
  quarterOf,
  subscribeWheel,
  wheelFocusReminderActive,
  wheelFocusReminders,
  wheelHasScores,
  type WheelData,
} from '@/lib/wheel';

export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // Streak doa pagi 🔥 & Revive 📖 — untuk strip "Streak & Semangat" di atas.
  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduledHabit[] | null>(null);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
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
  const [freelance, setFreelance] = useState<FreelanceProject[]>([]);
  const [insurance, setInsurance] = useState<InsuranceMonths>({});
  const [fun, setFun] = useState<FunData>(EMPTY_FUN);
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );
  // Checklist "sudah baca ≥1 pasal hari ini" — lastDayId dokumen bibleReading.
  const [bibleReadDayId, setBibleReadDayId] = useState<string | null>(null);
  // Modal Baca Alkitab: input kitab (ephemeral, TIDAK disimpan ke Firestore).
  const [bibleModalOpen, setBibleModalOpen] = useState(false);
  const [bibleBook, setBibleBook] = useState('');

  // Jam berjalan (di-refresh tiap menit) — untuk reminder yang bergantung waktu.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const todayId = dayDocId(new Date());

  useEffect(() => {
    if (!user) return;
    const nowQ = quarterOf(new Date());
    const wheelQid = quarterDocId(nowQ.year, nowQ.q);
    const unsubs = [
      subscribeWheel(user.uid, wheelQid, setWheel),
      subscribeMonthlyPrayers(user.uid, setMonthlyPrayers),
      subscribeBibleReading(user.uid, setBibleReadDayId),
      subscribeTasks(user.uid, setTasks),
      subscribeHabitSchedule(user.uid, setSchedule),
      subscribeHabitDay(user.uid, todayId, setDay),
      subscribeLoginStreak(user.uid, setLogin),
      subscribeCoreLeaders(user.uid, setLeaders),
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
      subscribeFreelance(user.uid, setFreelance),
      subscribeInsurance(user.uid, setInsurance),
      subscribeFun(user.uid, setFun),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [user, todayId]);

  // Kebiasaan harian (sama tiap hari) — untuk reminder sesi.
  const daySchedule = schedule ?? [];

  // Task hari ini — HANYA yang belum selesai.
  const catIcon = (key: string) =>
    TASK_CATEGORIES.find((c) => c.key === key)?.icon ?? '';
  const todayUndoneTasks = tasks.filter((t) => t.dayId === todayId && !t.done);
  const todayUndone = todayUndoneTasks.length;
  // Kartu menampilkan maksimal 3 task; sisanya lewat tombol "+N task lagi".
  const HOME_TASK_SHOWN = 3;
  const moreUndone = Math.max(0, todayUndone - HOME_TASK_SHOWN);

  async function toggleTask(t: Task) {
    if (!user) return;
    try {
      await setTaskDone(user.uid, t.id, !t.done);
    } catch {
      // Diamkan — snapshot Firestore akan mengoreksi tampilan otomatis.
    }
  }

  // Kebiasaan sesi saat ini (Pagi/Siang/Malam) yang belum dilakukan hari ini.
  const curSlot = slotNow(now);
  const slotUndone = day
    ? daySchedule.filter((h) => h.slot === curSlot && !day.done[h.id])
    : [];

  // Reminder ulang tahun keluarga: hari ini + 7 hari ke depan
  // (hanya keluarga inti; saudara & yang sudah tiada ✝ tidak diikutkan).
  const famBirthdays = family
    .filter((m) => !m.deceased && m.circle === 'inti')
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

  // Reminder pertemuan CORE: H-3 sampai hari-H, yang belum selesai.
  const visitReminders = visitations
    .filter((v) => visitReminderWindow(v, now))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())
    .map((v) => {
      const cl = leaders.find((l) => l.id === v.leaderId);
      const days = visitDaysUntil(v, now);
      return {
        id: v.id,
        text: `${meetingKindMeta(v.kind).icon} ${
          cl ? `${cl.heart} ${cl.name}` : 'CORE'
        } — ${days === 0 ? 'HARI INI' : `${days} hari lagi`} (${formatDate(
          v.date.toDate(),
        )})`,
      };
    });

  // Reminder Idea For CORE: waktunya kasih masukan ide baru (mingguan/bulanan).
  const coreIdeaDue = ideaReminderDue(coreIdeas, now);

  // Reminder bayar pinjaman: yang belum lunas & jatuh tempo ≤ 3 hari (termasuk
  // lewat). Fokus ke "Pinjaman Saya", tapi tagihan ke orang juga diingatkan.
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

  const whenLabel = (days: number) =>
    days === 0 ? 'HARI INI' : days > 0 ? `${days} hari lagi` : `lewat ${-days} hari`;

  // Reminder deadline KERJA: prioritas Fulltime + proyek Freelance yang sudah
  // H-7 (≤ 7 hari, termasuk yang lewat). Tiap baris menuju tab yang sesuai.
  const careerReminders: {
    id: string;
    docId: string;
    sort: number;
    tab: string;
    text: string;
  }[] = [
    ...roadmap
      .filter((r) => roadmapReminderWindow(r, now))
      .map((r) => ({
        id: `ft-${r.id}`,
        docId: r.id,
        sort: r.deadline!.toMillis(),
        tab: 'fulltime',
        text: `💻 ${r.title} · ${whenLabel(roadmapDaysUntil(r.deadline!, now))}`,
      })),
    ...freelance.filter((p) => freelanceReminderWindow(p, now)).map((p) => ({
      id: `fl-${p.id}`,
      docId: p.id,
      sort: p.deadline.toMillis(),
      tab: 'freelance',
      text: `🌐 ${p.name}${p.client ? ` (${p.client})` : ''} · ${whenLabel(
        deadlineDaysUntil(p, now),
      )}`,
    })),
  ].sort((a, b) => a.sort - b.sort);

  // Reminder timbang berat: tiap Minggu kalau belum update berat hari ini.
  const weighInDue = profile != null && needsWeighIn(profile, now);

  // ===== Reminder Health digabung jadi SATU kartu rapi: cek tensi & gula
  // darah (6 bulan), timbang berat mingguan, donor darah (sudah boleh lagi +
  // jadwal donor yang sudah dibuat). Tiap baris bisa ditekan ke tujuannya.
  const donorDue = donorReminderDue(donor, now);
  const healthRows: { id: string; text: string; onPress: () => void }[] = [];
  // Cek tekanan darah / gula darah.
  for (const c of checkupReminders) {
    healthRows.push({
      id: `chk-${c.id}`,
      text: c.text,
      onPress: () =>
        router.push({ pathname: '/health', params: { tab: 'checkup' } }),
    });
  }
  // Timbang berat mingguan.
  if (weighInDue) {
    healthRows.push({
      id: 'weigh',
      text: '⚖️ Timbang berat minggu ini — update berat (kg)',
      onPress: () =>
        router.push({
          pathname: '/health',
          params: { tab: 'summary', weighIn: '1' },
        }),
    });
  }
  // Donor darah — sudah boleh lagi (hari Minggu). "Sejak" dihitung bulan+hari.
  if (donorDue) {
    const eligibleDate = nextEligibleDate(donor);
    const overdue = -(daysUntilEligible(donor, now) ?? 0); // hari sejak boleh
    healthRows.push({
      id: 'donor-ok',
      text: `🩸 Sudah boleh donor darah${
        overdue > 0 && eligibleDate
          ? ` (sejak ${formatMonthsDays(eligibleDate, now)} lalu)`
          : ' (mulai hari ini)'
      }`,
      onPress: () => router.push('/donor'),
    });
  }
  // Jadwal donor yang sudah dibuat & sudah dekat (≤3 hari).
  for (const s of donorScheduleReminders(donor, now)) {
    const d = scheduleDaysUntil(s, now);
    healthRows.push({
      id: `donor-sch-${s.id}`,
      text: `📅 Donor${s.location ? ` di ${s.location}` : ''} — ${
        d === 0 ? 'HARI INI' : `${d} hari lagi`
      }`,
      onPress: () => router.push('/donor'),
    });
  }

  // Reminder renungan khotbah: Rabu/Jumat 12:30–17:30, kalau catatan khotbah
  // Minggu ini SUDAH ada. Ditekan → tab Khotbah (ringkasan singkatnya).
  const sundaySermon =
    sermonReminderActive(now) &&
    sermons.find((s) => s.id === currentSundayId(now));

  // ===== Reminder Wheel of Life 🎡 =====
  const nowQuarter = quarterOf(now);
  const wheelQLabel = quarterLabel(nowQuarter.year, nowQuarter.q);
  const wheelFocusDue =
    wheel != null && wheel.focus.length > 0 && wheelFocusReminderActive(now);
  const wheelFocusRows = wheelFocusDue ? wheelFocusReminders(wheel, now) : [];
  const wheelNeedsFill = wheel != null && !wheelHasScores(wheel);

  // ===== Reminder Pokok Doa Bulanan (CORE) 📅 =====
  const prayerMonthTitle = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const monthPoints = monthlyPointsFor(monthlyPrayers, now);
  const prayerNeedsFill =
    leaders.length > 0 && monthlyPrayerStartReminder(monthlyPrayers, now);
  const prayerLeadersToday = prayerFollowupLeaders(leaders, monthPoints, now);
  const prayerUndone = isPrayerFollowupDay(now)
    ? prayerLeadersToday.filter(
        (l) => monthlyPrayers.followedDayId[l.id] !== todayId,
      ).length
    : 0;
  const prayerFollowupDue = prayerUndone > 0;

  // ===== Reminder Baca Alkitab harian 📖 (tema spiritual) =====
  const bibleReadDone =
    bibleReadDayId === todayId ||
    (revive != null && revive.lastDayId === todayId);
  const bibleReadDue = revive !== undefined && !bibleReadDone;

  async function markBibleRead() {
    if (!user) return;
    try {
      await setBibleReadingDone(user.uid, todayId, true);
    } catch {
      // Diamkan — snapshot akan mengoreksi tampilan otomatis.
    }
  }

  function closeBibleModal() {
    setBibleModalOpen(false);
    setBibleBook('');
  }

  // Tombol "Sudah baca": hanya status yang disimpan; teks kitab tidak (ephemeral).
  function confirmBibleRead() {
    markBibleRead();
    closeBibleModal();
  }

  // Ada reminder "aksi" yang harus dikerjakan hari ini? (dipakai untuk
  // memutuskan apakah perlu memunculkan fallback produktivitas).
  const hasActionReminder =
    famBirthdays.length > 0 ||
    visitReminders.length > 0 ||
    coreIdeaDue ||
    debtReminders.length > 0 ||
    healthRows.length > 0 ||
    !!sundaySermon ||
    bibleReadDue ||
    wheelFocusDue ||
    wheelNeedsFill ||
    prayerNeedsFill ||
    prayerFollowupDue ||
    careerReminders.length > 0 ||
    slotUndone.length > 0 ||
    todayUndone > 0;

  // Fallback PRODUKTIVITAS: kalau tidak ada reminder aksi & bukan jam pagi,
  // munculkan "apa yang bisa dikerjakan biar menghasilkan uang" — dari
  // Freelance (proyek aktif) & Insurance (target bulan ini).
  const productivity: { id: string; tab: string; text: string }[] = [];
  for (const p of [...freelance]
    .filter((p) => !p.done)
    .sort((a, b) => a.deadline.toMillis() - b.deadline.toMillis())
    .slice(0, 3)) {
    productivity.push({
      id: `pf-${p.id}`,
      tab: 'freelance',
      text: `🌐 Lanjutkan "${p.name}"${p.client ? ` — ${p.client}` : ''} (${whenLabel(
        deadlineDaysUntil(p, now),
      )})`,
    });
  }
  const insM = insurance[insuranceMonthKey(now.getFullYear(), now.getMonth())];
  if (insM) {
    const rem = insuranceRemaining(insM);
    if (rem.pitch > 0)
      productivity.push({
        id: 'pi-pitch',
        tab: 'insurance',
        text: `☂️ Pitching ${rem.pitch} orang lagi bulan ini`,
      });
    if (rem.close > 0)
      productivity.push({
        id: 'pi-close',
        tab: 'insurance',
        text: `🤝 Closing ${rem.close} polis lagi bulan ini`,
      });
    if (rem.premi > 0)
      productivity.push({
        id: 'pi-premi',
        tab: 'insurance',
        text: `💰 Kejar premi ${formatRupiah(rem.premi)} lagi`,
      });
  }
  if (productivity.length === 0) {
    productivity.push(
      { id: 'pg-1', tab: 'freelance', text: '🌐 Cari / follow up 1 proyek freelance baru' },
      { id: 'pg-2', tab: 'insurance', text: '☂️ Prospek 1 calon nasabah asuransi' },
      { id: 'pg-3', tab: 'business', text: '🍧 Kembangkan ide bisnis (es cendol & roa)' },
    );
  }
  const showProductivity = !hasActionReminder;

  // Reminder FUN 🎉: sudah lama tidak refreshing (>30 hari) → ajak main +
  // beri ide biar tidak bingung. Warna mengikuti grid Fun (hijau muda).
  const funDue = funReminderDue(fun, now);
  const funGap = daysSinceLastFun(fun, now);
  const funIdeas = funDue ? funIdeasToday(now, 3) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <VixText heading="header" additionalStyle={styles.headerTitle}>
          🔔 Dashboard
        </VixText>
        <VixText heading="label" additionalStyle={styles.headerDate}>
          📆 {formatShortDayDate(new Date())}
        </VixText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.contentInner}>
          {/* Streak & Semangat 🔥 — konsistensi doa pagi & Revive. Tap → Achievements */}
          <PressableScale
            style={styles.streakCard}
            onPress={() => router.push('/achievements')}>
            <View style={styles.streakItem}>
              <VixText additionalStyle={styles.streakIcon}>🔥</VixText>
              <VixText heading="header" additionalStyle={styles.streakNum}>
                {login?.count ?? 0}
              </VixText>
              <VixText heading="label" additionalStyle={styles.streakLabel}>
                Doa Pagi
              </VixText>
              <VixText heading="label" additionalStyle={styles.streakBest}>
                rekor {login?.best ?? 0} hari
              </VixText>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakItem}>
              <VixText additionalStyle={styles.streakIcon}>📖</VixText>
              <VixText heading="header" additionalStyle={styles.streakNum}>
                {revive?.count ?? 0}
              </VixText>
              <VixText heading="label" additionalStyle={styles.streakLabel}>
                Revive
              </VixText>
              <VixText heading="label" additionalStyle={styles.streakBest}>
                rekor {revive?.best ?? 0} hari
              </VixText>
            </View>
          </PressableScale>

          {/* Reminder kebiasaan sesi saat ini (Pagi/Siang/Malam). */}
          {slotUndone.length > 0 && (
            <ReminderCard
              bg={Color.FINANCE_EXPENSE}
              fg={Color.FINANCE_EXPENSE_DARK}
              title={`${slotMeta(curSlot).emoji} Kebiasaan ${slotMeta(curSlot).label}`}
              onPress={() =>
                router.push({ pathname: '/health', params: { tab: 'todo' } })
              }>
              <VixText heading="label" additionalStyle={styles.habitReminderSub}>
                {slotUndone.length} kebiasaan belum dilakukan — ketuk untuk buka 💪
              </VixText>
              {slotUndone.slice(0, 4).map((h) => (
                <VixText
                  key={h.id}
                  heading="label"
                  numberOfLines={1}
                  additionalStyle={styles.habitReminderItem}>
                  • {h.label}
                </VixText>
              ))}
            </ReminderCard>
          )}

          {/* Task hari ini — centang langsung tanpa buka fitur Task */}
          {todayUndone > 0 && (
            <View style={styles.taskCard}>
              <PressableScale
                style={styles.taskHeader}
                onPress={() => router.push('/tasks')}>
                <VixText heading="bold" additionalStyle={styles.taskTitle}>
                  🔔 Reminder Hari Ini
                </VixText>
                <View style={styles.taskHeaderRight}>
                  <VixText heading="label">{todayUndone} belum</VixText>
                  <IconSymbol
                    name="chevron.right"
                    size={18}
                    color={Color.TEXT_LABEL}
                  />
                </View>
              </PressableScale>
              {todayUndoneTasks.slice(0, HOME_TASK_SHOWN).map((t) => (
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
                    +{moreUndone} reminder lagi →
                  </VixText>
                </PressableScale>
              )}
            </View>
          )}

          {/* Reminder ulang tahun keluarga (hari ini s/d 7 hari) */}
          {famBirthdays.length > 0 && (
            <ReminderCard
              bg={Color.FINANCE_SAVING}
              fg={Color.ACCENT_DARK}
              title="🎂 Ulang Tahun Keluarga"
              texts={famBirthdays}
              // Tap satu nama → buka Family & pusatkan pohon ke orang itu.
              onItemPress={(id) =>
                router.push({ pathname: '/family', params: { focus: id } })
              }
            />
          )}

          {/* Reminder CORE: visitasi (H-3 s/d hari-H) + Idea For CORE mingguan */}
          {(visitReminders.length > 0 || coreIdeaDue) && (
            <View style={styles.visitCard}>
              {visitReminders.length > 0 && (
                <PressableScale
                  onPress={() =>
                    router.push({ pathname: '/core', params: { tab: 'visitation' } })
                  }>
                  <VixText heading="bold" additionalStyle={styles.visitTitle}>
                    📍 Reminder Pertemuan CORE
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

          {/* Reminder Pokok Doa Bulanan — awal bulan belum diisi (tema spiritual) */}
          {prayerNeedsFill && (
            <ReminderCard
              bg={Color.SPIRITUAL}
              fg={Color.SPIRITUAL_DARK}
              title={`📅 Pokok Doa Bulanan — ${prayerMonthTitle}`}
              onPress={() => router.push('/monthly-prayers')}>
              <VixText heading="label" additionalStyle={styles.prayerText}>
                Awal bulan! Follow up tiap CORE Leader & tanyakan pokok doa mereka
                bulan ini 🙏
              </VixText>
            </ReminderCard>
          )}

          {/* Reminder follow up pokok doa (Sel/Kam/Sab, bergilir) */}
          {prayerFollowupDue && (
            <ReminderCard
              bg={Color.SPIRITUAL}
              fg={Color.SPIRITUAL_DARK}
              title="📅 Follow Up Pokok Doa"
              onPress={() =>
                router.push({ pathname: '/core', params: { tab: 'followup' } })
              }>
              <VixText heading="label" additionalStyle={styles.prayerText}>
                Hari ini {prayerUndone} CORE Leader untuk didoakan & ditanya
                perkembangan pergumulannya 🙏
              </VixText>
            </ReminderCard>
          )}

          {/* Reminder bayar pinjaman (jatuh tempo ≤ 3 hari / lewat) */}
          {debtReminders.length > 0 && (
            <ReminderCard
              bg={Color.FINANCE_EXPENSE}
              fg={Color.FINANCE_EXPENSE_DARK}
              title="🤝 Reminder Pinjaman"
              texts={debtReminders}
              onPress={() => router.push('/debts')}
            />
          )}

          {/* Reminder Health digabung: cek tensi/gula, timbang berat, donor. */}
          {healthRows.length > 0 && (
            <View style={styles.healthCard}>
              <VixText heading="bold" additionalStyle={styles.healthTitle}>
                🩺 Reminder Health
              </VixText>
              {healthRows.map((r) => (
                <PressableScale key={r.id} onPress={r.onPress}>
                  <VixText heading="label" additionalStyle={styles.healthText}>
                    {r.text}
                  </VixText>
                </PressableScale>
              ))}
            </View>
          )}

          {/* Reminder Baca Alkitab harian — checklist minimal 1 pasal (ungu) */}
          {bibleReadDue && (
            <PressableScale
              style={styles.readingCard}
              onPress={() => setBibleModalOpen(true)}>
              <CheckCircle checked={false} size={24} />
              <View style={styles.readingTextBox}>
                <VixText heading="bold" additionalStyle={styles.readingTitle}>
                  📖 Baca Alkitab hari ini
                </VixText>
                <VixText heading="label" additionalStyle={styles.readingSub}>
                  Minimal 1 pasal — ketuk untuk tandai selesai 🙏
                </VixText>
              </View>
            </PressableScale>
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

          {/* Reminder Wheel of Life 🎡 — kuartal baru belum diisi: ajak isi. */}
          {wheelNeedsFill && (
            <ReminderCard
              bg={Color.WHEEL}
              fg={Color.WHEEL_DARK}
              title={`🎡 Kuartal Baru — ${wheelQLabel}`}
              onPress={() => router.push('/wheel')}>
              <VixText heading="label" additionalStyle={styles.wheelText}>
                Yuk isi Wheel of Life kuartal ini — nilai 8 area hidupmu biar tahu
                progres & area yang perlu dikembangkan 🎯
              </VixText>
            </ReminderCard>
          )}

          {/* Reminder fokus Wheel (Sen/Rab/Jum, 09.00–12.30). */}
          {wheelFocusDue && (
            <View style={styles.wheelCard}>
              <VixText heading="bold" additionalStyle={styles.wheelTitle}>
                🎡 Fokus Wheel of Life · {wheelQLabel}
              </VixText>
              {wheelFocusRows.map((r) => (
                <PressableScale
                  key={r.key}
                  style={styles.wheelRow}
                  onPress={() => router.push('/wheel')}>
                  <VixText heading="label" additionalStyle={styles.wheelArea}>
                    {r.icon} {r.label} · {r.current} → {r.target}
                  </VixText>
                  <VixText heading="label" additionalStyle={styles.wheelTip}>
                    💡 {r.tip}
                  </VixText>
                </PressableScale>
              ))}
            </View>
          )}

          {/* Reminder deadline KERJA (Fulltime + Freelance, H-7). */}
          {careerReminders.length > 0 && (
            <View style={styles.careerCard}>
              <VixText heading="bold" additionalStyle={styles.careerTitle}>
                💼 Deadline Kerja
              </VixText>
              {careerReminders.map((r) => (
                <PressableScale
                  key={r.id}
                  onPress={() =>
                    router.push({
                      pathname: '/career',
                      params: { tab: r.tab, edit: r.docId },
                    })
                  }>
                  <VixText heading="label" additionalStyle={styles.careerText}>
                    {r.text}
                  </VixText>
                </PressableScale>
              ))}
            </View>
          )}

          {/* Fallback PRODUKTIVITAS: hari lagi senggang → apa yang bisa dikerjakan. */}
          {showProductivity && (
            <View style={styles.productivityCard}>
              <VixText heading="bold" additionalStyle={styles.productivityTitle}>
                💼 Produktif Hari Ini
              </VixText>
              <VixText heading="label" additionalStyle={styles.productivitySub}>
                Tidak ada agenda mendesak — ini yang bisa kamu kerjakan biar tetap
                cuan 💪
              </VixText>
              {productivity.map((p) => (
                <PressableScale
                  key={p.id}
                  onPress={() =>
                    router.push({ pathname: '/career', params: { tab: p.tab } })
                  }>
                  <VixText heading="label" additionalStyle={styles.productivityText}>
                    {p.text}
                  </VixText>
                </PressableScale>
              ))}
            </View>
          )}

          {/* Reminder FUN 🎉: sudah lama tidak refreshing → ajak main + kasih ide. */}
          {funDue && (
            <ReminderCard
              bg={Color.FUN}
              fg={Color.FUN_DARK}
              title="🎉 Waktunya Refreshing"
              onPress={() => router.push('/fun')}>
              <VixText heading="label" additionalStyle={styles.funSub}>
                {funGap === null
                  ? 'Belum ada kegiatan Fun yang tercatat — yuk mulai satu!'
                  : `Sudah ${funGap} hari tanpa kegiatan seru. Jangan lupa refreshing 🙌`}
              </VixText>
              {funIdeas.map((idea, i) => (
                <VixText key={i} heading="label" additionalStyle={styles.funText}>
                  {idea}
                </VixText>
              ))}
            </ReminderCard>
          )}
        </View>
      </ScrollView>

      {/* Modal Baca Alkitab: catat kitab (TIDAK disimpan) lalu tandai sudah baca */}
      <CenterDialog visible={bibleModalOpen} onClose={closeBibleModal}>
        <VixText heading="title" additionalStyle={styles.bibleModalTitle}>
          📖 Baca Alkitab hari ini
        </VixText>
        <VixText heading="label" additionalStyle={styles.bibleModalSub}>
          Kitab apa yang kamu baca hari ini?
        </VixText>
        <FormInput
          style={styles.bibleInput}
          placeholder="mis. Mazmur 23, Yohanes 3"
          value={bibleBook}
          onChangeText={setBibleBook}
        />
        <PressableScale style={styles.bibleDoneButton} onPress={confirmBibleRead}>
          <VixText heading="bold" additionalStyle={styles.bibleDoneText}>
            ✅ Sudah baca
          </VixText>
        </PressableScale>
        <PressableScale style={styles.bibleClose} onPress={closeBibleModal}>
          <VixText heading="label" additionalStyle={styles.bibleCloseText}>
            Tutup
          </VixText>
        </PressableScale>
      </CenterDialog>
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
  headerTitle: { color: Color.MAIN },
  headerDate: { color: Color.TEXT_LABEL },
  content: { paddingBottom: 40, paddingTop: 12, alignItems: 'center' },
  // Jarak antar-kartu diatur SATU tempat di sini (gap) → selalu seragam & rapi.
  contentInner: { width: '100%', maxWidth: 680, paddingHorizontal: 20, gap: 20 },
  // Strip "Streak & Semangat" 🔥 di atas Dashboard (tap → Achievements).
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.ACCENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    paddingVertical: 14,
  },
  streakItem: { flex: 1, alignItems: 'center', gap: 1 },
  streakDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 6,
    backgroundColor: Color.ACCENT_DARK,
    opacity: 0.4,
  },
  streakIcon: { fontSize: 22, lineHeight: 26 },
  streakNum: { color: Color.ACCENT_DARK },
  streakLabel: { color: Color.ACCENT_DARK, fontWeight: '600' },
  streakBest: { color: Color.ACCENT_DARK, opacity: 0.8 },
  // Reminder kebiasaan sesi (Pagi/Siang/Malam) — teks di dalam ReminderCard.
  habitReminderSub: { color: Color.FINANCE_EXPENSE_DARK, marginBottom: 2 },
  habitReminderItem: { color: Color.FINANCE_EXPENSE_DARK },
  // CORE (pertemuan + idea) → biru muda, senada tile CORE.
  visitCard: {
    backgroundColor: Color.FINANCE_INVESTMENT,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_INVESTMENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
  },
  visitTitle: { color: Color.TEXT_TITLE },
  visitText: { color: Color.FINANCE_INVESTMENT_DARK },
  ideaReminder: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Color.FINANCE_INVESTMENT_DARK,
    gap: 3,
  },
  onSpiritual: { color: Color.SPIRITUAL_DARK },
  healthCard: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_EXPENSE_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  healthTitle: { color: Color.TEXT_TITLE },
  healthText: { color: Color.FINANCE_EXPENSE_DARK },
  careerCard: {
    backgroundColor: Color.CAREER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  careerTitle: { color: Color.TEXT_TITLE },
  careerText: { color: Color.ACCENT_DARK },
  wheelCard: {
    backgroundColor: Color.WHEEL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.WHEEL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  wheelTitle: { color: Color.TEXT_TITLE },
  wheelRow: { gap: 1 },
  wheelArea: { color: Color.TEXT_TITLE, fontWeight: '600' },
  wheelTip: { color: Color.WHEEL_DARK },
  wheelText: { color: Color.WHEEL_DARK },
  prayerText: { color: Color.SPIRITUAL_DARK },
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
  },
  readingTextBox: { flex: 1, gap: 1 },
  readingTitle: { color: Color.SPIRITUAL_DARK },
  readingSub: { color: Color.SPIRITUAL_DARK },
  bibleModalTitle: { color: Color.TEXT_TITLE, marginBottom: 2 },
  bibleModalSub: { color: Color.TEXT_LABEL, marginBottom: 12 },
  bibleInput: { marginBottom: 14 },
  bibleDoneButton: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Color.SPIRITUAL_DARK,
  },
  bibleDoneText: { color: Color.TEXT_REVERSE },
  bibleClose: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
  bibleCloseText: { color: Color.TEXT_LABEL },
  productivityCard: {
    backgroundColor: Color.FINANCE_INCOME,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_INCOME_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  productivityTitle: { color: Color.TEXT_TITLE },
  productivitySub: { color: Color.FINANCE_INCOME_DARK, marginBottom: 2 },
  productivityText: { color: Color.FINANCE_INCOME_DARK },
  funSub: { color: Color.FUN_DARK, marginBottom: 2 },
  funText: { color: Color.FUN_DARK },
  taskCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.MAIN_DARK,
    padding: 16,
    gap: 10,
  },
  taskTitle: { color: Color.TEXT_TITLE },
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
  taskText: { flex: 1, color: Color.TEXT_TITLE, fontSize: 12, lineHeight: 16 },
  taskTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  taskMore: { color: Color.MAIN_DARK, marginTop: 2 },
});
