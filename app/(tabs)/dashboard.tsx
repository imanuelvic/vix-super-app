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
import { CheckCircle } from '@/components/common/CheckCircle';
import { PressableScale } from '@/components/common/PressableScale';
import { ReminderCard } from '@/components/common/ReminderCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { subscribeLoginStreak, type LoginStreak } from '@/lib/achievements';
import {
  carAttentionList,
  subscribePartStatus,
  type PartStatusMap,
} from '@/lib/car';
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
  subscribeMainTeam,
  subscribeMonthlyPrayers,
  subscribeVisitations,
  visitDaysUntil,
  visitReminderWindow,
  type CoreIdeasData,
  type CoreLeader,
  type MainTeamMember,
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
  FIT_HOUR_LABEL,
  FIT_RECOVERY,
  fitQuote,
  fitReminderWindow,
  fitSessionFor,
  subscribeFitDay,
  type FitDayDone,
} from '@/lib/fitness';
import {
  daysBetween,
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
  residenceAttentionList,
  subscribeChoreStatus,
  type ChoreStatusMap,
} from '@/lib/residence';
import {
  currentSundayId,
  sermonReminderActive,
  subscribeSermons,
  type SermonNote,
} from '@/lib/sermon';
import { subscribeReviveStreak } from '@/lib/spiritual';
import {
  activeFasting,
  fastingDay,
  fastingDayNumber,
  fastingProgress,
  subscribeFastingPlans,
  type FastingPlan,
} from '@/lib/fasting';
import {
  otherTaskDaysUntil,
  otherTaskUrgent,
  setTaskDone,
  subscribeOtherTasks,
  subscribeTasks,
  TASK_CATEGORIES,
  type OtherTask,
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

  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [otherTasks, setOtherTasks] = useState<OtherTask[]>([]);
  const [schedule, setSchedule] = useState<ScheduledHabit[] | null>(null);
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
  const [freelance, setFreelance] = useState<FreelanceProject[]>([]);
  const [insurance, setInsurance] = useState<InsuranceMonths>({});
  const [fun, setFun] = useState<FunData>(EMPTY_FUN);
  // Perawatan mobil 🚗 & rumah 🏠 — sumber badge di tile Home, ditampilkan juga
  // sebagai kartu reminder di sini.
  const [carParts, setCarParts] = useState<PartStatusMap>({});
  const [residenceChores, setResidenceChores] = useState<ChoreStatusMap>({});
  // Centang gerakan gym hari ini — untuk kartu "Gym Day" (1 dokumen).
  const [fitDone, setFitDone] = useState<FitDayDone>({});
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(
    EMPTY_MONTHLY_PRAYERS,
  );
  // Periode puasa 🍽️ — untuk kartu "sedang berpuasa" + pokok doa hari ini.
  const [fastingPlans, setFastingPlans] = useState<FastingPlan[]>([]);

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
      subscribeFitDay(user.uid, todayId, setFitDone),
      subscribeTasks(user.uid, setTasks),
      subscribeOtherTasks(user.uid, setOtherTasks),
      subscribeHabitSchedule(user.uid, setSchedule),
      subscribeHabitDay(user.uid, todayId, setDay),
      subscribeLoginStreak(user.uid, setLogin),
      subscribeCoreLeaders(user.uid, setLeaders),
      subscribeMainTeam(user.uid, setMainTeam),
      subscribeVisitations(user.uid, setVisitations),
      subscribeFamily(user.uid, setFamily),
      subscribeDebts(user.uid, setDebts),
      subscribeCheckups(user.uid, setCheckups),
      subscribeHealthProfile(user.uid, setProfile),
      subscribeSermons(user.uid, setSermons),
      subscribeReviveStreak(user.uid, setRevive),
      subscribeFastingPlans(user.uid, setFastingPlans),
      subscribeRoadmap(user.uid, setRoadmap),
      subscribeCoreIdeas(user.uid, setCoreIdeas),
      subscribeDonor(user.uid, setDonor),
      subscribeFreelance(user.uid, setFreelance),
      subscribeInsurance(user.uid, setInsurance),
      subscribeFun(user.uid, setFun),
      subscribePartStatus(user.uid, setCarParts),
      subscribeChoreStatus(user.uid, setResidenceChores),
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

  // Reminder Prioritas yang sudah masuk H-7 (otomatis P1) — tampil di kartu
  // yang sama, tapi dipisah garis section supaya jelas ini bukan task harian.
  const urgentPriority = otherTasks
    .filter((t) => otherTaskUrgent(t, now))
    .sort(
      (a, b) => (a.deadline?.toMillis() ?? 0) - (b.deadline?.toMillis() ?? 0),
    );

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

  // Ulang tahun CORE Leader & Main Team: hari ini + 7 hari ke depan.
  // Sumber & jendelanya sama dengan daftar di CORE → tab Follow Up.
  const coreBirthdays = [
    ...leaders.map((l) => ({
      id: l.id,
      label: `${l.heart} ${l.name}`,
      sub: null as string | null,
      ...nextBirthday(l, now),
    })),
    ...mainTeam.map((m) => {
      const cl = leaders.find((l) => l.id === m.leaderId);
      return {
        id: m.id,
        label: `👤 ${m.name}`,
        sub: cl ? `Main Team ${cl.heart} ${cl.name}` : 'Main Team',
        ...nextBirthday(m, now),
      };
    }),
  ]
    .filter((b) => b.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map((b) => ({
      id: b.id,
      text: `${b.label}${b.sub ? ` · ${b.sub}` : ''} — ${
        b.daysUntil === 0
          ? `HARI INI 🎉 (ke-${b.turningAge})`
          : `${b.daysUntil} hari lagi (ke-${b.turningAge})`
      }`,
    }));

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
  // Minggu ini SUDAH ada. Ditekan → tab Sermon (ringkasan singkatnya).
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

  // ===== Reminder Puasa 🍽️ =====
  // Kartu muncul selama hari ini masih di dalam rentang puasa yang tersimpan.
  const fastingNow = activeFasting(fastingPlans, now);
  const fastingToday = fastingNow ? fastingDay(fastingNow, todayId) : null;
  // Pokok doa khusus hari ini; kalau belum diisi, pakai pokok doa utamanya.
  const fastingPrayer = fastingNow
    ? fastingToday?.prayer || fastingNow.prayer
    : '';

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

  // ===== Reminder Fitness 💪 — jam 16.00–20.59 saja =====
  // Hari latihan (Sen/Sel/Kam/Jum/Sab) → kartu "Gym Day" sampai semua gerakan
  // dicentang. Rabu & Minggu → kartu "Rest Day" berisi pengingat pemulihan.
  const fitSession = fitSessionFor(now);
  const fitWindow = fitReminderWindow(now);
  const fitLeft = fitSession
    ? fitSession.exercises.filter((e) => !fitDone[e.id]).length
    : 0;
  const gymDayDue = fitWindow && fitSession !== null && fitLeft > 0;
  const restDayDue = fitWindow && fitSession === null;

  // ===== Reminder Residence 🏠 & Car 🚗 =====
  // Sumbernya SAMA dengan badge merah di tile Home: perawatan yang sudah dekat
  // jadwalnya atau sudah lewat. Jadi badge muncul = kartunya muncul juga.
  const residenceReminders = residenceAttentionList(residenceChores, now).map(
    (c) => ({
      id: c.key,
      text: `${c.label} — ${whenLabel(daysBetween(now, c.dueDate))}`,
    }),
  );
  const carReminders = carAttentionList(carParts, now).map((p) => ({
    id: p.key,
    text: `${p.label} — ${whenLabel(daysBetween(now, p.dueDate))}`,
  }));

  // Ada reminder "aksi" yang harus dikerjakan hari ini? (dipakai untuk
  // memutuskan apakah perlu memunculkan fallback produktivitas).
  const hasActionReminder =
    famBirthdays.length > 0 ||
    visitReminders.length > 0 ||
    coreBirthdays.length > 0 ||
    coreIdeaDue ||
    debtReminders.length > 0 ||
    healthRows.length > 0 ||
    !!sundaySermon ||
    wheelFocusDue ||
    wheelNeedsFill ||
    prayerNeedsFill ||
    prayerFollowupDue ||
    careerReminders.length > 0 ||
    residenceReminders.length > 0 ||
    carReminders.length > 0 ||
    gymDayDue ||
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
          Dashboard 📊
        </VixText>
        <VixText heading="label" additionalStyle={styles.headerDate}>
          📆 {formatShortDayDate(new Date())}
        </VixText>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.contentInner}>
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
                router.push({ pathname: '/health', params: { tab: 'habits' } })
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
          {(todayUndone > 0 || urgentPriority.length > 0) && (
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

              {/* Section Prioritas — dipisah garis, isinya reminder P1 yang
                  deadline-nya sudah H-7 (bukan task harian). */}
              {urgentPriority.length > 0 && (
                <View style={styles.prioritySection}>
                  <VixText heading="bold" additionalStyle={styles.priorityHead}>
                    📌 Prioritas
                  </VixText>
                  {urgentPriority.map((t) => {
                    const days = otherTaskDaysUntil(t, now)!;
                    return (
                      <PressableScale
                        key={t.id}
                        style={styles.priorityRow}
                        onPress={() =>
                          router.push({
                            pathname: '/tasks',
                            params: { tab: 'priority' },
                          })
                        }>
                        <View style={styles.priorityBadge}>
                          <VixText
                            heading="label"
                            additionalStyle={styles.priorityBadgeText}>
                            P1
                          </VixText>
                        </View>
                        <VixText
                          heading="label"
                          numberOfLines={1}
                          additionalStyle={styles.priorityText}>
                          {t.title}
                        </VixText>
                        <VixText
                          heading="label"
                          additionalStyle={
                            days < 0 ? styles.priorityLate : styles.priorityDue
                          }>
                          {days === 0
                            ? 'HARI INI'
                            : days < 0
                              ? `lewat ${-days}h`
                              : `${days}h lagi`}
                        </VixText>
                      </PressableScale>
                    );
                  })}
                </View>
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

          {/* Reminder CORE: visitasi (H-3 s/d hari-H) + ulang tahun CL & Main
              Team (≤7 hari) + Idea For CORE mingguan */}
          {(visitReminders.length > 0 ||
            coreBirthdays.length > 0 ||
            coreIdeaDue) && (
            <View style={styles.visitCard}>
              {visitReminders.length > 0 && (
                <View>
                  <VixText heading="bold" additionalStyle={styles.visitTitle}>
                    📍 Reminder Pertemuan CORE
                  </VixText>
                  {/* TIAP BARIS ditekan → buka CORE tab Pertemuan & langsung
                      buka modal edit pertemuan itu (lewat param ?edit=<id>). */}
                  {visitReminders.map((r) => (
                    <PressableScale
                      key={r.id}
                      onPress={() =>
                        router.push({
                          pathname: '/core',
                          params: { tab: 'visitation', edit: r.id },
                        })
                      }>
                      <VixText
                        heading="label"
                        additionalStyle={styles.visitText}>
                        {r.text}
                      </VixText>
                    </PressableScale>
                  ))}
                </View>
              )}
              {/* Ulang tahun CL & Main Team → CORE tab Follow Up */}
              {coreBirthdays.length > 0 && (
                <PressableScale
                  style={visitReminders.length > 0 ? styles.ideaReminder : undefined}
                  onPress={() =>
                    router.push({ pathname: '/core', params: { tab: 'followup' } })
                  }>
                  <VixText heading="bold" additionalStyle={styles.visitTitle}>
                    🎂 Ulang Tahun CL & Main Team
                  </VixText>
                  {coreBirthdays.map((b) => (
                    <VixText
                      key={b.id}
                      heading="label"
                      additionalStyle={styles.visitText}>
                      {b.text}
                    </VixText>
                  ))}
                </PressableScale>
              )}
              {coreIdeaDue && (
                <PressableScale
                  style={
                    visitReminders.length > 0 || coreBirthdays.length > 0
                      ? styles.ideaReminder
                      : undefined
                  }
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

          {/* Sedang berpuasa 🍽️ — hari ke berapa + pokok doa hari ini.
              Ditekan → layar puasa itu (checklist harian). */}
          {fastingNow && (
            <ReminderCard
              bg={Color.SPIRITUAL}
              fg={Color.SPIRITUAL_DARK}
              title={`🍽️ Sedang Puasa — hari ke-${fastingDayNumber(
                fastingNow,
                todayId,
              )} dari ${fastingProgress(fastingNow).total}`}
              onPress={() =>
                router.push({
                  pathname: '/fasting',
                  params: { id: fastingNow.id },
                })
              }>
              <VixText heading="label" additionalStyle={styles.prayerText}>
                {fastingNow.title}
              </VixText>
              {fastingPrayer ? (
                <VixText heading="label" additionalStyle={styles.prayerText}>
                  🙏 {fastingPrayer}
                </VixText>
              ) : null}
              {fastingNow.rules ? (
                <VixText heading="label" additionalStyle={styles.prayerText}>
                  📜 {fastingNow.rules}
                </VixText>
              ) : null}
            </ReminderCard>
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

          {/* Doa Rantai — follow up pokok doa bergilir (Sel/Kam/Sab).
              Warnanya ikut grid CORE (biru), sama seperti kartu Pertemuan CORE. */}
          {prayerFollowupDue && (
            <ReminderCard
              bg={Color.FINANCE_INVESTMENT}
              fg={Color.FINANCE_INVESTMENT_DARK}
              title="🔗 Doa Rantai"
              onPress={() =>
                router.push({ pathname: '/core', params: { tab: 'followup' } })
              }>
              <VixText heading="label" additionalStyle={styles.coreText}>
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

          {/* Gym Day 💪 — hari latihan, jam 16.00–20.59 (oranye Fitness) */}
          {gymDayDue && fitSession && (
            <ReminderCard
              bg={Color.FITNESS}
              fg={Color.FITNESS_DARK}
              title={`🏋️ Gym Day — ${fitSession.emoji} ${fitSession.title}`}
              texts={[
                `⏰ Mulai ${FIT_HOUR_LABEL} · ${fitLeft} dari ${fitSession.exercises.length} gerakan belum beres`,
                fitQuote(todayId),
              ]}
              onPress={() => router.push('/fitness')}
            />
          )}

          {/* Rest Day 😴 — Rabu & Minggu, pengingat pemulihan */}
          {restDayDue && (
            <ReminderCard
              bg={Color.FITNESS}
              fg={Color.FITNESS_DARK}
              title="😴 Rest Day — jatah pemulihan"
              texts={FIT_RECOVERY}
              onPress={() => router.push('/fitness')}
            />
          )}

          {/* Reminder renungkan khotbah Minggu (Rabu/Jumat siang) — ungu */}
          {sundaySermon && (
            <ReminderCard
              bg={Color.SPIRITUAL}
              fg={Color.SPIRITUAL_DARK}
              title="🙏 Renungkan Khotbah Minggu"
              onPress={() =>
                router.push({ pathname: '/spiritual', params: { tab: 'sermon' } })
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

          {/* Reminder Residence 🏠 — perawatan/kebersihan rumah yang perlu
              perhatian (warna senada tile Residence di Home). */}
          {residenceReminders.length > 0 && (
            <ReminderCard
              bg={Color.HOUSE}
              fg={Color.HOUSE_DARK}
              title="🏠 Reminder Residence"
              texts={residenceReminders}
              onPress={() => router.push('/residence')}
            />
          )}

          {/* Reminder Car 🚗 — servis/part mobil yang perlu perhatian (warna
              senada tile Car di Home). */}
          {carReminders.length > 0 && (
            <ReminderCard
              bg={Color.ACCENT}
              fg={Color.ACCENT_DARK}
              title="🚗 Reminder Car"
              texts={carReminders}
              onPress={() => router.push('/car')}
            />
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
  contentInner: { width: '100%', maxWidth: 680, paddingHorizontal: 20, gap: 20 },
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
  // Teks isi kartu bertema CORE (biru) — mis. Doa Rantai.
  coreText: { color: Color.FINANCE_INVESTMENT_DARK },
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
  readingTitle: { color: Color.TEXT_TITLE },
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
  // Section Prioritas di dalam kartu Reminder — dipisah garis di atasnya.
  prioritySection: {
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    marginTop: 8,
    paddingTop: 8,
    gap: 6,
  },
  priorityHead: { color: Color.TEXT_TITLE },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priorityBadge: {
    backgroundColor: Color.DANGER,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  priorityBadgeText: { color: Color.TEXT_REVERSE },
  priorityText: { flex: 1, color: Color.TEXT_TITLE },
  priorityDue: { color: Color.WARNING },
  priorityLate: { color: Color.DANGER },
});
