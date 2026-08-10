// ============================================================================
// LAYAR HOME (rute "/"). Isi file ini = halaman Home aplikasi (sapaan, grid
// fitur, kartu reminder). Komponennya bernama HomeScreen.
//
// CATATAN: nama file WAJIB "index.tsx" — di expo-router, "index" berarti layar
// utama/default grup (tabs), sehingga file ini menjadi rute "/" dan tab Home.
// Kalau di-rename (mis. "home.tsx"), rutenya berubah jadi "/home" dan routing
// harus di-rewire. Jadi biarkan namanya "index.tsx"; anggap ini "Home".
// ============================================================================
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
import { CenterDialog } from '@/components/common/CenterDialog';
import { CheckCircle } from '@/components/common/CheckCircle';
import { FormInput } from '@/components/common/FormInput';
import { Greeting } from '@/components/common/Greeting';
import { PressableScale } from '@/components/common/PressableScale';
import { ReminderCard } from '@/components/common/ReminderCard';
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
  weekIndex,
  WEEKLY_FOCUS_COUNT,
  weeklyLeaders,
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
  setWater,
  subscribeCheckups,
  subscribeHabitDay,
  subscribeHealthProfile,
  WATER_GOAL,
  type Checkup,
  type HabitDay,
  type HealthProfile,
} from '@/lib/health';
import {
  countResidenceAttention,
  subscribeChoreStatus,
  type ChoreStatusMap,
} from '@/lib/residence';
import { logFeatureUse } from '@/lib/usage';
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
    | 'books.vertical.fill'
    | 'house.fill'
    | 'briefcase.fill'
    | 'person.3.fill'
    | 'mountain.2.fill'
    | 'dumbbell.fill';
  route: Href;
  bg: string;
  fg: string;
}[] = [
  { key: 'tasks', label: 'Reminder', icon: 'checklist', route: '/tasks', bg: Color.MAIN_LIGHT, fg: Color.MAIN_DARK },
  { key: 'spiritual', label: 'Spiritual', icon: 'book.closed.fill', route: '/spiritual', bg: Color.SPIRITUAL, fg: Color.SPIRITUAL_DARK },
  { key: 'health', label: 'Health', icon: 'heart.fill', route: '/health', bg: Color.FINANCE_EXPENSE, fg: Color.DANGER },
  { key: 'core', label: 'CORE', icon: 'person.2.fill', route: '/core', bg: Color.FINANCE_INVESTMENT, fg: Color.TEXT_TITLE },
  { key: 'career', label: 'Career', icon: 'briefcase.fill', route: '/career', bg: Color.CAREER, fg: Color.ACCENT_DARK },
  { key: 'investment', label: 'Investment', icon: 'chart.line.uptrend.xyaxis', route: '/investment', bg: Color.CAREER_DARK, fg: Color.TEXT_LABEL },
  { key: 'family', label: 'Family', icon: 'person.3.fill', route: '/family', bg: Color.FINANCE_SAVING, fg: Color.ACCENT_DARK },
  { key: 'wheel', label: 'Wheel', icon: 'target', route: '/wheel', bg: Color.WHEEL, fg: Color.WHEEL_DARK },
  { key: 'fitness', label: 'Fitness', icon: 'dumbbell.fill', route: '/fitness', bg: Color.FITNESS, fg: Color.FITNESS_DARK },
  { key: 'book', label: 'Book', icon: 'books.vertical.fill', route: '/book', bg: Color.BOOK, fg: Color.BOOK_DARK },
  { key: 'fun', label: 'Fun', icon: 'mountain.2.fill', route: '/fun', bg: Color.FUN, fg: Color.FUN_DARK },
  { key: 'residence', label: 'Residence', icon: 'house.fill', route: '/residence', bg: Color.HOUSE, fg: Color.HOUSE_DARK },
  { key: 'car', label: 'Car', icon: 'car.fill', route: '/car', bg: Color.ACCENT, fg: Color.ACCENT_DARK },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Daily login streak 🔥 — undefined = belum termuat.
  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);

  // Data untuk badge tugas harian per fitur.
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
  const [carParts, setCarParts] = useState<PartStatusMap>({});
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
  // Status perawatan/kebersihan rumah — untuk badge tile Residence.
  const [residenceChores, setResidenceChores] = useState<ChoreStatusMap>({});

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
    // Wheel of Life kuartal yang sedang berjalan (untuk reminder Home).
    const nowQ = quarterOf(new Date());
    const wheelQid = quarterDocId(nowQ.year, nowQ.q);
    const unsubs = [
      subscribeLoginStreak(user.uid, setLogin),
      subscribeWheel(user.uid, wheelQid, setWheel),
      subscribeMonthlyPrayers(user.uid, setMonthlyPrayers),
      subscribeBibleReading(user.uid, setBibleReadDayId),
      subscribeChoreStatus(user.uid, setResidenceChores),
      subscribeTasks(user.uid, setTasks),
      subscribeHabitSchedule(user.uid, setSchedule),
      subscribeHabitDay(user.uid, todayId, setDay),
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
      subscribePartStatus(user.uid, setCarParts),
      subscribeFreelance(user.uid, setFreelance),
      subscribeInsurance(user.uid, setInsurance),
      subscribeFun(user.uid, setFun),
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

  // Kebiasaan harian (sama tiap hari) — untuk badge Health & reminder sesi.
  const daySchedule = schedule ?? [];

  // Badge merah per fitur: berapa hal harian yang BELUM selesai hari ini.
  // 0 = badge hilang — tanda hari ini beres 🎉
  const badges: Record<string, number> = {
    // Hanya task HARI INI — task tanggal depan tidak dihitung.
    tasks: tasks.filter((t) => !t.done && t.dayId === todayId).length,
    health: day ? daySchedule.filter((h) => !day.done[h.id]).length : 0,
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

  // Task hari ini di Home — HANYA yang belum selesai. Task yang sudah dicentang
  // langsung hilang dari Home; kalau semua beres, kartunya ikut hilang.
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
  // Fokus kuartal ini: muncul Senin/Rabu/Jumat jam 09.00–12.30 — tampilkan
  // angka skor sekarang → target + tips membangun kebiasaan. Kalau kuartal
  // berjalan belum diisi sama sekali, munculkan ajakan segera mengisi.
  const nowQuarter = quarterOf(now);
  const wheelQLabel = quarterLabel(nowQuarter.year, nowQuarter.q);
  const wheelFocusDue =
    wheel != null && wheel.focus.length > 0 && wheelFocusReminderActive(now);
  const wheelFocusRows = wheelFocusDue ? wheelFocusReminders(wheel, now) : [];
  const wheelNeedsFill = wheel != null && !wheelHasScores(wheel);

  // ===== Reminder Pokok Doa Bulanan (CORE) 📅 =====
  // Awal bulan (tgl 1–2) → ajak follow up & tanya pokok doa. Sel/Kam/Sab →
  // follow up bergilir.
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
  // Sudah baca kalau checklist dicentang ATAU sudah Revive hari ini (Revive
  // termasuk baca firman). Menunggu data streak Revive termuat dulu.
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

  // Air putih 💧 — tombol cepat harian di kartu sapaan (tersimpan di HabitDay).
  async function changeWater(delta: number) {
    if (!user || !day) return;
    try {
      await setWater(user.uid, todayId, day.water + delta);
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
  // Freelance (proyek aktif) & Insurance (target bulan ini). Business masih
  // coming soon, jadi cukup dorongan umum.
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
              💧 Air putih {day?.water ?? 0}/{WATER_GOAL} gelas
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
        </Animated.View>

        {/* Reminder kebiasaan sesi saat ini (Pagi/Siang/Malam). Selalu tampil
            selama masih ada yang belum dilakukan; ketuk → tab Habit. Warna
            senada Health. */}
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
                // Langsung mendarat di tab Visitasi, bukan tab default.
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

        {/* Reminder Health digabung: cek tensi/gula, timbang berat, donor.
            Tiap baris bisa ditekan menuju halaman terkait. */}
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

        {/* Reminder Wheel of Life 🎡 — kuartal baru belum diisi: ajak isi.
            Warna senada grid/tile Wheel. */}
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

        {/* Reminder fokus Wheel (Sen/Rab/Jum, 09.00–12.30): angka skor
            sekarang → target + tips membangun kebiasaan. */}
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


        {/* Reminder deadline KERJA (Fulltime + Freelance, H-7) — TIAP BARIS
            ditekan menuju tab yang sesuai (bukan seluruh kartu). */}
        {careerReminders.length > 0 && (
          <View style={styles.careerCard}>
            <VixText heading="bold" additionalStyle={styles.careerTitle}>
              💼 Deadline Kerja
            </VixText>
            {careerReminders.map((r) => (
              <PressableScale
                key={r.id}
                // Tap → buka Career di tab yang sesuai & langsung buka modal
                // edit item ini (lewat param ?edit=<id>).
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

        {/* Fallback PRODUKTIVITAS: hari lagi senggang → apa yang bisa dikerjakan
            biar menghasilkan uang (Freelance/Insurance/Business). */}
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

        {/* Reminder FUN 🎉: sudah lama tidak refreshing → ajak main + kasih ide.
            Warna mengikuti grid Fun (hijau muda). */}
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
  content: { paddingBottom: 40, alignItems: 'center' },
  // Lebar konten dibatasi & otomatis di tengah (HP: penuh; iPad: ~680 di tengah).
  contentInner: { width: '100%', maxWidth: 680, paddingHorizontal: 20 },
  welcomeCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
  },
  // Reminder kebiasaan sesi (Pagi/Siang/Malam) — teks di dalam ReminderCard.
  habitReminderSub: { color: Color.FINANCE_EXPENSE_DARK, marginBottom: 2 },
  habitReminderItem: { color: Color.FINANCE_EXPENSE_DARK },
  brandRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // CORE (pertemuan + idea) → kuning, senada identitas CORE.
  visitCard: {
    // Warna senada tile CORE (biru muda) — samakan dengan grid.
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
  visitTitle: { color: Color.TEXT_TITLE },
  visitText: { color: Color.FINANCE_INVESTMENT_DARK },
  // Pemisah antara reminder visitasi & idea di dalam kartu CORE yang sama.
  ideaReminder: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Color.FINANCE_INVESTMENT_DARK,
    gap: 3,
  },
  // Baris teks di dalam ReminderCard khotbah (kutipan di-clamp 2 baris).
  onSpiritual: { color: Color.SPIRITUAL_DARK },
  // Kartu Health gabungan (cek tensi/gula + timbang berat + donor) → pink,
  // senada tile Health.
  healthCard: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_EXPENSE_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    marginTop: -12,
    marginBottom: 24,
  },
  healthTitle: { color: Color.TEXT_TITLE },
  healthText: { color: Color.FINANCE_EXPENSE_DARK },
  // Kartu Career: tiap baris prioritas bisa ditekan sendiri (menuju Career).
  careerCard: {
    backgroundColor: Color.CAREER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.ACCENT_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    marginTop: -12,
    marginBottom: 24,
  },
  careerTitle: { color: Color.TEXT_TITLE },
  careerText: { color: Color.ACCENT_DARK },
  // Kartu Wheel of Life: warna senada tile/grid Wheel. Tiap baris fokus
  // bisa ditekan menuju halaman Wheel.
  wheelCard: {
    backgroundColor: Color.WHEEL,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.WHEEL_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    marginTop: -12,
    marginBottom: 24,
  },
  wheelTitle: { color: Color.TEXT_TITLE },
  wheelRow: { gap: 1 },
  wheelArea: { color: Color.TEXT_TITLE, fontWeight: '600' },
  wheelTip: { color: Color.WHEEL_DARK },
  wheelText: { color: Color.WHEEL_DARK },
  // Reminder Pokok Doa Bulanan (CORE) — tema spiritual (ungu).
  prayerText: { color: Color.SPIRITUAL_DARK },
  // Reminder Baca Alkitab harian — checklist, warna grid spiritual (ungu).
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
    marginTop: -12,
    marginBottom: 24,
  },
  readingTextBox: { flex: 1, gap: 1 },
  readingTitle: { color: Color.SPIRITUAL_DARK },
  readingSub: { color: Color.SPIRITUAL_DARK },
  // Modal Baca Alkitab
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
  // Kartu fallback produktivitas (income) → hijau, tiap baris bisa ditekan.
  productivityCard: {
    backgroundColor: Color.FINANCE_INCOME,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.FINANCE_INCOME_DARK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
    marginTop: -12,
    marginBottom: 24,
  },
  productivityTitle: { color: Color.TEXT_TITLE },
  productivitySub: { color: Color.FINANCE_INCOME_DARK, marginBottom: 2 },
  productivityText: { color: Color.FINANCE_INCOME_DARK },
  // Teks di dalam ReminderCard Fun (warna gelap senada grid Fun).
  funSub: { color: Color.FUN_DARK, marginBottom: 2 },
  funText: { color: Color.FUN_DARK },
  // Task Hari Ini → putih dengan aksen hijau (border). Latar SENGAJA bukan
  // mint: CheckCircle warnanya mint, jadi kalau latarnya mint pun ceklisnya
  // tak terlihat. Judul hitam biar jelas.
  taskCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Color.MAIN_DARK,
    padding: 16,
    gap: 10,
    marginTop: -12,
    marginBottom: 24,
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
  // Font sengaja lebih kecil dari label (kartu ringkas sekilas-lihat).
  taskText: { flex: 1, color: Color.TEXT_TITLE, fontSize: 12, lineHeight: 16 },
  taskTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  taskMore: { color: Color.MAIN_DARK, marginTop: 2 },
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
  // Air putih 💧 — baris ringkas di dalam kartu sapaan (latar gelap).
  waterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
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
