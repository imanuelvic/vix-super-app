import { prayerDeadlinePassed, prayerDoneToday, type LoginStreak } from './reward';
import { carAttentionList, type PartStatusMap } from './car';
import {
  deadlineDaysUntil,
  freelanceReminderWindow,
  roadmapDaysUntil,
  roadmapReminderWindow,
  type FreelanceProject,
  type RoadmapItem,
} from './career';
import {
  followupDue,
  isPrayerFollowupDay,
  meetingKindMeta,
  meetingLeaderNames,
  monthlyPointsFor,
  monthlyPrayerStartReminder,
  needsPdfShare,
  nextBirthday,
  prayerFollowupLeaders,
  visitDaysUntil,
  visitReminderWindow,
  type BirthdayGreets,
  type CoreLeader,
  type MainTeamMember,
  type MonthlyPrayers,
  type Visitation,
  type WeeklyFocus,
} from './core';
import { debtDaysUntil, debtRemaining, debtReminderWindow, type Debt } from './debts';
import { devicesNeedingTopUp, type DataPlan } from './device';
import {
  daysUntilEligible,
  donorReminderDue,
  donorScheduleReminders,
  nextEligibleDate,
  scheduleDaysUntil,
  type DonorData,
} from './donor';
import { type FamilyMember } from './family';
import {
  activeFasting,
  fastingCheckDue,
  fastingDay,
  fastingDayNumber,
  fastingProgress,
  type FastingPlan,
} from './fasting';
import { type PaceStatus } from './financeInsight';
import {
  fitPendingToday,
  fitSessionFor,
  fitSessionsOf,
  fitWindowLabel,
  type FitDay,
} from './fitness';
import { daysBetween, formatDayDate, formatMonthsDays, whenLabel } from './format';
import { billUnsettled, outstandingTotal, sortedBills, unpaidCount, type Bill } from './friends';
import { funReminderDue, type FunData } from './fun';
import { futsalReminders, type FutsalData } from './futsal';
import {
  countedHabits,
  currentOpenSlot,
  habitNoteDone,
  isNoteDrivenHabit,
  rhemaWindowNow,
  slotMeta,
  type ScheduledHabit,
} from './habits';
import {
  checkupDueReminders,
  needsWeighIn,
  type Checkup,
  type HabitDay,
  type HealthProfile,
} from './health';
import { type IntercessionTopic } from './intercession';
import {
  nightAllDone,
  nightPlan,
  nightSummary,
  nightWindow,
} from './nightPrayer';
import {
  dueStep,
  pendingTopicsOfWeek,
  skillOf,
  skillOfWeek,
  topicGroupMeta,
  type LearningWeek,
  type TopicsDone,
} from './learning';
import { populationDue, type PopulationSaved } from './news';
import { residenceAttentionList, type ChoreStatusMap } from './residence';
import { currentSundayId, sermonReminderActive, sermonShareDue, type SermonNote } from './sermon';
import {
  activeNudge,
  bibleSessionMeta,
  bibleSessionNow,
  type BibleReadingSessions,
  type MyReminder,
  type Nudge,
} from './spiritual';
import {
  effectiveOtherTask,
  otherTaskDaysUntil,
  TASK_CATEGORIES,
  type OtherTask,
  type Task,
  type TaskCategory,
} from './tasks';
import { readingDue, type MeterReading } from './token';
import { formatRupiah } from './transactions';
import {
  quarterLabel,
  quarterOf,
  wheelFocusReminderActive,
  wheelFocusReminders,
  wheelHasScores,
  type WheelData,
} from './wheel';

// ============================== Today Engine ==============================
//
// "The app should tell Vix what matters today, not show Vix everything he has."
//
// Mesin ini MURNI: menerima irisan data yang sudah dilanggan layar Today
// (hooks/useTodayData.ts) dan mengembalikan model yang siap digambar. Tidak
// menyentuh Firestore, tidak ada AI, tidak ada acak. Aturannya deterministik
// dan diuji dengan fixture (suite cek-today.js).
//
// Semua "apakah ini perlu perhatian" TETAP dihitung oleh fungsi masing-masing
// fitur di lib/ (needsPdfShare, followupDue, debtReminderWindow, …) — persis
// yang dipakai badge & layar fiturnya. Yang dilakukan di sini hanya:
//   1. mengubahnya jadi BARIS yang seragam (emoji · judul · tujuan click),
//   2. menaruhnya di BAGIAN yang tepat (With God · CORE · Work · Life),
//   3. memberi TINGKAT (today · next · later) dan MEMANGKAS "today" ke
//      TODAY_MAX baris terpenting. Sisanya turun ke Up Next / Later, dan
//      seluruh daftar lengkapnya tetap ada di layar Semua Pengingat.
//
// Urutan perhatian (dipakai saat memangkas): With God → yang bertenggat hari
// ini → CORE → Work → Life → jangka panjang. Bukan karena yang lain tidak
// penting, tapi supaya yang paling penting dilihat lebih dulu.

export type TodaySection = 'god' | 'core' | 'work' | 'life';
export type TodayTier = 'today' | 'next' | 'later';

/** Tujuan click — bentuk polos supaya mesin ini tidak bergantung expo-router. */
export type TodayHref = { pathname: string; params?: Record<string, string> };

export type TodayItem = {
  id: string;
  section: TodaySection;
  tier: TodayTier;
  /** 1 = With God … 6 = jangka panjang. Makin kecil makin dulu dipertahankan. */
  rank: number;
  emoji: string;
  title: string;
  /** Baris kedua yang lebih kecil (opsional). */
  detail?: string;
  href: TodayHref;
  /** Sudah beres / sudah ditutup hari ini → digambar tenang, bukan menagih. */
  done?: boolean;
};

/** Keadaan blok With God di puncak layar. */
export type GodState =
  /** Belum Morning Journey & jendela pagi masih terbuka → undangan besar. */
  | 'invite'
  /** Lewat 09.00 & belum → ajakan lembut, tetap bisa dijalani. */
  | 'late'
  /** Sudah dijalani hari ini → satu baris tenang. */
  | 'done'
  /** Data streak belum tiba → jangan menggambar undangan dulu (hindari kedip). */
  | 'loading';

export type TodayReflection = {
  /** Baris jurnal refleksi ada di daftar kebiasaan? */
  available: boolean;
  /** Tulisan hari ini ("" = belum). */
  text: string;
  written: boolean;
  /** Feed 4:5 hari ini belum dibuat → tombol Generate Feed tetap tampil. */
  showGenerate: boolean;
  /** Jam baca-ulang (12–13, 17–18, 21–22) → blok ditonjolkan. */
  emphasis: boolean;
};

export type TodayModel = {
  god: {
    state: GodState;
    /** Baris-baris kecil di bawah undangan: bacaan, syafaat, puasa, khotbah… */
    lines: TodayItem[];
    /** Streak Morning Journey — cuma untuk baris kecil, bukan hero. */
    streak: number;
    /** Kalimat penyegar 🕊️ giliran jam ini (kalau ada & belum dibaca). */
    nudge: Nudge | null;
  };
  /** ≤ TODAY_MAX baris, urut bagian lalu prioritas. */
  today: TodayItem[];
  /** 1–3 hari ke depan / minggu ini. */
  upNext: TodayItem[];
  /** Sisanya — cukup dihitung; isinya di layar Semua Pengingat. */
  later: TodayItem[];
  reflection: TodayReflection;
  /** 🌙 Night Prayer malam ini — dipakai kartu Today & pengingat 22.00. */
  night: TodayNight;
};

export type TodayNight = {
  /** "3 syukur · 2 pengakuan · 4 permohonan · 🇮🇩 Bangsa dan Negara Indonesia" */
  summary: string;
  /** Keempat bagiannya sudah didoakan malam ini? */
  done: boolean;
};

/** Batas baris tingkat "today" di seluruh layar (bukan per bagian). */
export const TODAY_MAX = 7;

/** Jam mulai "malam" untuk pengingat air & refleksi. */
export const EVENING_HOUR = 18;
/** Target gelas air sehari — sama dengan cincin WaterFloat. */
export const WATER_TARGET = 8;

export type FinanceStatusInput = {
  emoji: string;
  level: PaceStatus;
  lines: string[];
};

/**
 * Seluruh masukan mesin — irisan data yang MEMANG sudah dilanggan Home &
 * Dashboard lama (kini digabung di hooks/useTodayData.ts). `undefined` pada
 * nilai yang punya arti "belum termuat" dipertahankan supaya tidak ada baris
 * yang berkedip sebelum datanya sampai.
 */
export type TodayInput = {
  login: LoginStreak | null | undefined;
  bibleReading: BibleReadingSessions | null;
  habits: ScheduledHabit[];
  day: HabitDay | null;
  fitDay: FitDay;
  fastingPlans: FastingPlan[] | null;
  sermons: SermonNote[];
  myReminders: MyReminder[];
  intercession: IntercessionTopic;
  intercessionDismissed: boolean;
  feedGenerated: boolean;

  leaders: CoreLeader[];
  mainTeam: MainTeamMember[];
  greets: BirthdayGreets;
  weeklyFocus: WeeklyFocus;
  visitations: Visitation[];
  monthlyPrayers: MonthlyPrayers;

  tasks: Task[];
  otherTasks: OtherTask[];
  roadmap: RoadmapItem[];
  freelance: FreelanceProject[];

  family: FamilyMember[];
  debts: Debt[];
  checkups: Checkup[];
  profile: HealthProfile | null;
  donor: DonorData;
  learningWeek: LearningWeek;
  topicsDone: TopicsDone;
  bills: Bill[];
  futsal: FutsalData;
  dataPlans: DataPlan[];
  population: PopulationSaved;
  carParts: PartStatusMap;
  residenceChores: ChoreStatusMap;
  meterReadings: MeterReading[];
  wheel: WheelData | null;
  fun: FunData;
  /** null = data Finance belum termuat (kartunya belum bisa bicara). */
  finance: FinanceStatusInput | null;
};

const SECTION_ORDER: Record<TodaySection, number> = { god: 0, core: 1, work: 2, life: 3 };

/** Bagian tempat sebuah task mendarat, dari kategorinya. */
export function sectionOfTaskCategory(category: TaskCategory | undefined): TodaySection {
  if (category === 'ministry') return 'core';
  if (category === 'work') return 'work';
  return 'life';
}

function catIcon(key: string): string {
  return TASK_CATEGORIES.find((c) => c.key === key)?.icon ?? '';
}

/**
 * Bangun model Today dari data yang ada. `now` = jam berjalan (useNow),
 * `todayId` = "YYYY-MM-DD" hari ini — dioper, bukan dihitung ulang, supaya
 * sama persis dengan dokumen harian yang sedang dilanggan.
 */
export function buildToday(input: TodayInput, now: Date, todayId: string): TodayModel {
  const items: TodayItem[] = [];
  const push = (item: TodayItem) => items.push(item);

  // ============================ With God ============================
  const login = input.login;
  const godState: GodState =
    login === undefined
      ? 'loading'
      : prayerDoneToday(login, now)
        ? 'done'
        : prayerDeadlinePassed(now)
          ? 'late'
          : 'invite';
  const godLines: TodayItem[] = [];

  // 📖 Baca Alkitab — hanya di jendela sesinya & selama belum diisi.
  const bibleSession = bibleSessionNow(now);
  if (bibleSession !== null && input.bibleReading !== null) {
    const meta = bibleSessionMeta(bibleSession);
    godLines.push({
      id: `bible-${bibleSession}`,
      section: 'god',
      tier: 'today',
      rank: 1,
      emoji: meta.emoji,
      title: meta.title,
      done: !!input.bibleReading[bibleSession],
      href: { pathname: '/habits', params: { focus: `bible-${bibleSession}` } },
    });
  }

  // 🌙 Night Prayer & 🙏 Doa Syafaat — satu baris, bukan dua.
  //
  // Siang: baris syafaat seperti biasa, pokok doanya bisa dibuka di tempat.
  // Malam (mulai 19.00): syafaat sudah jadi bagian keempat Night Prayer, jadi
  // barisnya DIGANTI undangan berdoa sebelum tidur. Dua baris yang isinya
  // saling menumpuk cuma bikin blok With God terasa penuh padahal pekerjaannya
  // satu.
  const malam = nightPlan(todayId, now);
  if (nightWindow(now)) {
    godLines.push({
      id: 'night-prayer',
      section: 'god',
      tier: 'today',
      rank: 1,
      emoji: '🌙',
      title: 'Night Prayer',
      detail: nightSummary(malam),
      done: nightAllDone(input.day),
      href: { pathname: '/night-prayer' },
    });
  } else {
    godLines.push({
      id: 'intercession',
      section: 'god',
      tier: 'today',
      rank: 1,
      emoji: '🙏',
      title: `Syafaat: ${input.intercession.emoji} ${input.intercession.label}`,
      detail: `${input.intercession.points.length} pokok doa, didoakan di Night Prayer`,
      done: input.intercessionDismissed,
      href: { pathname: '/night-prayer' },
    });
  }

  // 🍽️ Puasa — sepanjang hari sebagai keterangan; malam jadi centang.
  const plans = input.fastingPlans ?? [];
  const fastingNow = activeFasting(plans, now);
  if (fastingNow) {
    const due = fastingCheckDue(plans, now, todayId);
    const hari = fastingDay(fastingNow, todayId);
    const pokok = hari?.prayer || fastingNow.prayer;
    godLines.push({
      id: 'fasting',
      section: 'god',
      tier: 'today',
      rank: 1,
      emoji: '🍽️',
      title: `${fastingNow.title} · hari ke-${fastingDayNumber(fastingNow, todayId)} dari ${fastingProgress(fastingNow).total}`,
      detail: due ? 'Sudah dijalani? Jawab sekarang' : pokok || undefined,
      done: !due && !!(hari?.done || hari?.failed),
      href: { pathname: '/fasting-days', params: { id: fastingNow.id, day: todayId } },
    });
  }

  // ⛪ Khotbah Minggu — Rabu/Jumat siang renungkan; Kamis siang kirim.
  const sermonRenung = sermonReminderActive(now)
    ? input.sermons.find((s) => s.id === currentSundayId(now))
    : undefined;
  if (sermonRenung) {
    godLines.push({
      id: 'sermon-reflect',
      section: 'god',
      tier: 'today',
      rank: 1,
      emoji: '⛪',
      title: `Renungkan khotbah: ${sermonRenung.title}`,
      detail: sermonRenung.quote || undefined,
      href: { pathname: '/walk', params: { tab: 'sermon' } },
    });
  }
  const sermonKirim = sermonShareDue(input.sermons, now);
  if (sermonKirim) {
    godLines.push({
      id: 'sermon-share',
      section: 'god',
      tier: 'today',
      rank: 1,
      emoji: '📤',
      title: `Kirim catatan khotbah: ${sermonKirim.title}`,
      detail: 'Bagikan ke CORE Leader lewat WhatsApp',
      href: { pathname: '/sermon', params: { id: sermonKirim.id } },
    });
  }

  // ============================ CORE ============================
  const leaders = input.leaders;
  const namaCl = (v: Visitation) =>
    meetingLeaderNames(v, leaders, { fallback: 'CORE', maxNames: 2 });

  // 📄 Kirim panduan acara — tenggatnya hari ini menurut aturan H-n acaranya.
  for (const v of [...input.visitations]
    .filter((v) => needsPdfShare(v, now, todayId))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())) {
    push({
      id: `pdf-${v.id}`,
      section: 'core',
      tier: 'today',
      rank: 2,
      emoji: '📄',
      title: `Kirim panduan ${meetingKindMeta(v.kind).label} ke ${namaCl(v)}`,
      detail: `H-${visitDaysUntil(v, now)}`,
      href: { pathname: '/core', params: { tab: 'visitation' } },
    });
  }

  // 📍 Pertemuan CORE — hari-H = today; H-1..H-3 = up next.
  for (const v of [...input.visitations]
    .filter((v) => visitReminderWindow(v, now))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())) {
    const days = visitDaysUntil(v, now);
    push({
      id: `visit-${v.id}`,
      section: 'core',
      tier: days <= 0 ? 'today' : 'next',
      rank: 2,
      emoji: meetingKindMeta(v.kind).icon,
      title: `${meetingKindMeta(v.kind).label} ${namaCl(v)}`,
      detail: `${days === 0 ? 'HARI INI' : `${days} hari lagi`} · ${formatDayDate(v.date.toDate())}`,
      href: { pathname: '/core', params: { tab: 'visitation', edit: v.id } },
    });
  }

  // 🎂 Ulang tahun CL & Main Team — hari ini = today; ≤ 7 hari = up next.
  const coreBirthdays = [
    ...leaders.map((l) => ({
      id: l.id,
      label: `${l.heart} ${l.name}`,
      sub: null as string | null,
      ...nextBirthday(l, now),
    })),
    ...input.mainTeam.map((m) => {
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
    .sort((a, b) => a.daysUntil - b.daysUntil);
  for (const b of coreBirthdays) {
    push({
      id: `bday-core-${b.id}`,
      section: 'core',
      tier: b.daysUntil === 0 ? 'today' : 'next',
      rank: 2,
      emoji: '🎂',
      title: `${b.label}${b.sub ? ` · ${b.sub}` : ''}`,
      detail:
        b.daysUntil === 0
          ? `Ulang tahun HARI INI (ke-${b.turningAge})`
          : `${b.daysUntil} hari lagi (${formatDayDate(b.date)}), ke-${b.turningAge}`,
      href: { pathname: '/core', params: { tab: 'followup' } },
    });
  }

  // 🎯 Follow up mingguan — CL giliran minggu ini yang belum disapa hari ini.
  const followup = followupDue(leaders, now, input.weeklyFocus, todayId);
  if (followup.length > 0) {
    push({
      id: 'followup',
      section: 'core',
      tier: 'today',
      rank: 3,
      emoji: '🎯',
      title: `Follow up ${followup.map((l) => `${l.heart} ${l.name}`).join(' & ')}`,
      detail: 'Giliran minggu ini, belum disapa hari ini',
      href: { pathname: '/core', params: { tab: 'followup' } },
    });
  }

  // 🔗 Doa Rantai — Selasa & Kamis, CL yang pokok doanya belum didoakan.
  const monthPoints = monthlyPointsFor(input.monthlyPrayers, now);
  const prayerUndone = isPrayerFollowupDay(now)
    ? prayerFollowupLeaders(leaders, monthPoints, now).filter(
        (l) => input.monthlyPrayers.followedDayId[l.id] !== todayId,
      ).length
    : 0;
  if (prayerUndone > 0) {
    push({
      id: 'prayer-chain',
      section: 'core',
      tier: 'today',
      rank: 3,
      emoji: '🔗',
      title: `Doa Rantai: ${prayerUndone} CORE Leader didoakan hari ini`,
      href: { pathname: '/core', params: { tab: 'followup' } },
    });
  }

  // 📅 Pokok doa bulanan — awal bulan, belum diperbarui.
  if (leaders.length > 0 && monthlyPrayerStartReminder(input.monthlyPrayers, now)) {
    push({
      id: 'monthly-prayers',
      section: 'core',
      tier: 'today',
      rank: 3,
      emoji: '📅',
      title: 'Perbarui pokok doa bulanan tiap CORE Leader',
      detail: 'Awal bulan: tanyakan pergumulan mereka bulan ini',
      href: { pathname: '/monthly-prayers' },
    });
  }

  // ============================ Task & prioritas ============================
  // Task harian yang belum selesai → bagian ikut kategorinya.
  for (const t of input.tasks.filter((t) => t.dayId === todayId && !t.done)) {
    push({
      id: `task-${t.id}`,
      section: sectionOfTaskCategory(t.category),
      tier: 'today',
      rank: 2,
      emoji: catIcon(t.category) || '✅',
      title: t.title,
      href: { pathname: '/tasks', params: { category: t.category } },
    });
  }
  // Reminder Prioritas P1 (termasuk yang naik P1 karena H-7): H-1/hari ini →
  // today, sisanya up next.
  for (const t of input.otherTasks
    .filter((t) => !t.done && effectiveOtherTask(t, now).priority === 1)
    .sort((a, b) => (a.deadline?.toMillis() ?? 0) - (b.deadline?.toMillis() ?? 0))) {
    const days = otherTaskDaysUntil(t, now);
    push({
      id: `prio-${t.id}`,
      section: sectionOfTaskCategory(t.category),
      tier: days === null || days <= 1 ? 'today' : 'next',
      rank: 2,
      emoji: '📌',
      title: t.title,
      detail: days === null ? 'P1' : `P1 · ${whenLabel(days)}`,
      href: { pathname: '/tasks', params: { tab: 'priority' } },
    });
  }

  // ============================ Work ============================
  // Deadline kerja (roadmap Fulltime & proyek Freelance, sudah H-7):
  // ≤ 3 hari (termasuk lewat) = today, 4–7 hari = up next.
  const kerja: { id: string; days: number; tab: string; docId: string; emoji: string; title: string }[] = [
    ...input.roadmap
      .filter((r) => roadmapReminderWindow(r, now))
      .map((r) => ({
        id: `ft-${r.id}`,
        days: roadmapDaysUntil(r.deadline!, now),
        tab: 'fulltime',
        docId: r.id,
        emoji: '💻',
        title: r.title,
      })),
    ...input.freelance
      .filter((p) => freelanceReminderWindow(p, now))
      .map((p) => ({
        id: `fl-${p.id}`,
        days: deadlineDaysUntil(p, now),
        tab: 'freelance',
        docId: p.id,
        emoji: '🌐',
        title: `${p.name}${p.client ? ` (${p.client})` : ''}`,
      })),
  ].sort((a, b) => a.days - b.days);
  for (const k of kerja) {
    push({
      id: k.id,
      section: 'work',
      tier: k.days <= 3 ? 'today' : 'next',
      rank: 4,
      emoji: k.emoji,
      title: k.title,
      detail: whenLabel(k.days),
      href: { pathname: '/work', params: { tab: k.tab, edit: k.docId } },
    });
  }

  // ============================ Life ============================
  // 🌅 Kebiasaan sesi yang sedang berjalan & belum dilakukan (✗ tidak dihitung).
  const slot = currentOpenSlot(now);
  if (slot && input.day) {
    const belum = countedHabits(input.habits, input.day.skipped).filter(
      (h) => h.slot === slot && !input.day!.done[h.id],
    );
    if (belum.length > 0) {
      const meta = slotMeta(slot);
      push({
        id: `habits-${slot}`,
        section: 'life',
        tier: 'today',
        rank: 5,
        emoji: meta.emoji,
        title: `Kebiasaan ${meta.label}: ${belum.length} belum`,
        detail: belum
          .slice(0, 3)
          .map((h) => h.label)
          .join(' · '),
        href: { pathname: '/habits' },
      });
    }
  }

  // 💪 Olahraga hari ini — belum memilih / masih ada gerakan / hari pemulihan.
  const fitLeft = fitPendingToday(input.fitDay, now);
  if (fitLeft > 0) {
    const picked = fitSessionsOf(input.fitDay, now);
    const saran = fitSessionFor(now);
    const walkOnly = picked.length > 0 && picked.every((s) => s.kind === 'walk');
    push({
      id: 'fitness',
      section: 'life',
      tier: 'today',
      rank: 5,
      emoji: picked.length === 0 ? '🤔' : picked[0].emoji,
      title:
        picked.length === 0
          ? 'Pilih olahraga hari ini'
          : `${picked[0].title}${picked.length > 1 ? ` +${picked.length - 1} lagi` : ''}`,
      detail:
        picked.length === 0
          ? `${fitWindowLabel(now)} · program menyarankan ${saran.emoji} ${saran.title}`
          : walkOnly
            ? 'Hari pemulihan, jalan santai'
            : `${fitWindowLabel(now)} · ${fitLeft} gerakan belum beres`,
      href: { pathname: '/fitness', params: { tab: 'exercise' } },
    });
  }

  // 💧 Air putih — baru ditagih malam hari kalau masih jauh dari 8 gelas.
  if (input.day && now.getHours() >= EVENING_HOUR && input.day.water < WATER_TARGET) {
    push({
      id: 'water',
      section: 'life',
      tier: 'today',
      rank: 5,
      emoji: '💧',
      title: `Air putih ${input.day.water}/${WATER_TARGET} gelas`,
      detail: 'Kejar sisanya sebelum tidur',
      href: { pathname: '/habits' },
    });
  }

  // 🩺 Health — cek tensi/gula, timbang mingguan, donor darah.
  const health: string[] = [];
  for (const c of checkupDueReminders(input.checkups, now)) {
    health.push(`${c.icon} ${c.label} waktunya cek lagi${c.days < 0 ? ` (lewat ${-c.days} hari)` : ''}`);
  }
  if (input.profile && needsWeighIn(input.profile, now)) {
    health.push('⚖️ Timbang berat minggu ini');
  }
  if (donorReminderDue(input.donor, now)) {
    const eligible = nextEligibleDate(input.donor);
    const overdue = -(daysUntilEligible(input.donor, now) ?? 0);
    health.push(
      `🩸 Sudah boleh donor darah${overdue > 0 && eligible ? ` (sejak ${formatMonthsDays(eligible, now)} lalu)` : ''}`,
    );
  }
  for (const s of donorScheduleReminders(input.donor, now)) {
    const d = scheduleDaysUntil(s, now);
    health.push(`📅 Donor${s.location ? ` di ${s.location}` : ''} ${d === 0 ? 'HARI INI' : `${d} hari lagi`}`);
  }
  if (health.length > 0) {
    push({
      id: 'health',
      section: 'life',
      tier: 'today',
      rank: 5,
      emoji: '🩺',
      title: health[0],
      detail: health.length > 1 ? health.slice(1).join(' · ') : undefined,
      href: { pathname: '/health', params: { tab: 'checkup' } },
    });
  }

  // 🎂 Ulang tahun keluarga inti — hari ini = today; ≤ 7 hari = up next.
  const famBirthdays = input.family
    .filter((m) => !m.deceased && m.circle === 'inti')
    .map((m) => ({ m, ...nextBirthday(m, now) }))
    .filter((b) => b.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  for (const b of famBirthdays) {
    push({
      id: `bday-fam-${b.m.id}`,
      section: 'life',
      tier: b.daysUntil === 0 ? 'today' : 'next',
      rank: 2,
      emoji: '🎂',
      title: b.m.name,
      detail:
        b.daysUntil === 0
          ? `Ulang tahun HARI INI (ke-${b.turningAge})`
          : `${b.daysUntil} hari lagi (${formatDayDate(b.date)}), ke-${b.turningAge}`,
      href: { pathname: '/family', params: { focus: b.m.id } },
    });
  }

  // 🤝 Pinjaman — jatuh tempo ≤ 3 hari (termasuk lewat): H-1/hari ini today.
  for (const d of [...input.debts]
    .filter((d) => debtReminderWindow(d, now))
    .sort((a, b) => a.dueDate.toMillis() - b.dueDate.toMillis())) {
    const days = debtDaysUntil(d, now);
    push({
      id: `debt-${d.id}`,
      section: 'life',
      tier: days <= 1 ? 'today' : 'next',
      rank: 2,
      emoji: d.direction === 'mine' ? '💸' : '💰',
      title: `${d.direction === 'mine' ? 'Bayar' : 'Tagih'} ${d.person} ${formatRupiah(debtRemaining(d))}`,
      detail: whenLabel(days),
      href: { pathname: '/debts', params: { tab: d.direction } },
    });
  }

  // 💰 Finance — hanya kalau statusnya perlu perhatian (watch/over) atau ada
  // catatan malam "belum ada transaksi tercatat". Sesuai rencana & belum
  // berbudget = diam (angkanya menunggu di dalam Finance).
  if (input.finance) {
    const perlu = input.finance.level === 'watch' || input.finance.level === 'over';
    const nudgeMalam = input.finance.lines.some((l) => l.startsWith('📝'));
    if (perlu || nudgeMalam) {
      push({
        id: 'finance',
        section: 'life',
        tier: 'today',
        rank: perlu ? 5 : 6,
        emoji: '💰',
        title: `Finance ${input.finance.emoji} ${input.finance.lines[0] ?? ''}`.trim(),
        detail: input.finance.lines.length > 1 ? input.finance.lines.slice(1).join(' · ') : undefined,
        href: { pathname: '/finance' },
      });
    }
  }

  // 🎓 Learning — langkah minggu ini yang harinya sudah tiba; topik diskusi
  // berlaku sepanjang minggu (up next).
  const step = dueStep(input.learningWeek.steps, now);
  if (step) {
    const skill =
      (input.learningWeek.skillKey ? skillOf(input.learningWeek.skillKey) : null) ?? skillOfWeek(now);
    push({
      id: 'learning-step',
      section: 'life',
      tier: 'today',
      rank: 5,
      emoji: '🎓',
      title: `${step.emoji} ${step.label}: ${skill.title}`,
      href: { pathname: '/learning', params: { tab: 'week' } },
    });
  }
  const topics = pendingTopicsOfWeek(input.topicsDone, now);
  if (topics.length > 0) {
    push({
      id: 'learning-topics',
      section: 'life',
      tier: 'next',
      rank: 5,
      emoji: '💬',
      title: `Diskusi minggu ini: ${topics.length} topik`,
      detail: topics.map((t) => `${topicGroupMeta(t.group).emoji} ${t.label}`).join(' · '),
      href: { pathname: '/learning', params: { tab: 'topics' } },
    });
  }

  // 🚗 Car & 🏠 Residence — hari-H/lewat = today; besok = up next.
  for (const p of carAttentionList(input.carParts, now)) {
    push({
      id: `car-${p.key}`,
      section: 'life',
      tier: p.tone === 'over' ? 'today' : 'next',
      rank: 5,
      emoji: '🚗',
      title: p.label,
      detail: whenLabel(daysBetween(now, p.dueDate)),
      href: { pathname: '/car', params: { tab: 'parts' } },
    });
  }
  for (const c of residenceAttentionList(input.residenceChores, now)) {
    push({
      id: `home-${c.key}`,
      section: 'life',
      tier: c.tone === 'over' ? 'today' : 'next',
      rank: 5,
      emoji: '🏠',
      title: c.label,
      detail: whenLabel(daysBetween(now, c.dueDate)),
      href: { pathname: '/residence', params: { tab: 'chores' } },
    });
  }
  // ⚡ Meteran listrik — catatan pagi & sore hari ini belum lengkap.
  if (readingDue(input.meterReadings, now)) {
    push({
      id: 'meter',
      section: 'life',
      tier: 'today',
      rank: 5,
      emoji: '⚡',
      title: 'Catat sisa kWh meteran',
      detail: 'Pagi sebelum berangkat & sore saat sampai rumah',
      href: { pathname: '/residence', params: { tab: 'token' } },
    });
  }

  // ⚽ Futsal — sesi mendesak (hari ini = today); 🧾 patungan belum lunas (up next).
  for (const r of futsalReminders(input.futsal, now)) {
    push({
      id: `futsal-${r.id}`,
      section: 'life',
      tier: /HARI INI|LEWAT|lewat/.test(r.text) ? 'today' : 'next',
      rank: 2,
      emoji: '⚽',
      title: r.text,
      href: { pathname: '/futsal/[id]', params: { id: r.id } },
    });
  }
  for (const b of sortedBills(input.bills).filter(billUnsettled)) {
    push({
      id: `bill-${b.id}`,
      section: 'life',
      tier: 'next',
      rank: 5,
      emoji: '🧾',
      title: `${b.title}: ${unpaidCount(b)} orang belum bayar`,
      detail: formatRupiah(outstandingTotal([b])),
      href: { pathname: '/bill/[id]', params: { id: b.id } },
    });
  }

  // 📱 Kuota habis besok/hari ini.
  const topUp = devicesNeedingTopUp(input.dataPlans, now);
  if (topUp > 0) {
    push({
      id: 'device',
      section: 'life',
      tier: 'today',
      rank: 5,
      emoji: '📱',
      title: `Isi ulang paket kuota (${topUp} paket)`,
      detail: 'Habis besok atau hari ini',
      href: { pathname: '/device', params: { tab: 'iphone' } },
    });
  }

  // 🌏 Catatan populasi awal bulan — tiga hari pertama ditagih, sesudahnya later.
  if (populationDue(input.population, now) > 0) {
    push({
      id: 'population',
      section: 'life',
      tier: now.getDate() <= 3 ? 'today' : 'later',
      rank: 6,
      emoji: '🌏',
      title: 'Catat populasi dunia bulan ini',
      detail: 'Salin angkanya dari worldometers',
      href: { pathname: '/news', params: { tab: 'population' } },
    });
  }

  // 🎡 Wheel of Life — kuartal baru belum diisi (7 hari pertama today); fokus
  // kuartal (Sen/Rab/Jum pagi) sebagai keterangan.
  const q = quarterOf(now);
  if (input.wheel !== null && !wheelHasScores(input.wheel)) {
    const hariKe = daysBetween(new Date(q.year, (q.q - 1) * 3, 1), now);
    push({
      id: 'wheel-fill',
      section: 'life',
      tier: hariKe < 7 ? 'today' : 'later',
      rank: 6,
      emoji: '🎡',
      title: `Isi Wheel of Life ${quarterLabel(q.year, q.q)}`,
      detail: 'Nilai 8 area hidupmu kuartal ini',
      href: { pathname: '/wheel' },
    });
  } else if (input.wheel !== null && input.wheel.focus.length > 0 && wheelFocusReminderActive(now)) {
    const rows = wheelFocusReminders(input.wheel, now);
    if (rows.length > 0) {
      push({
        id: 'wheel-focus',
        section: 'life',
        tier: 'next',
        rank: 6,
        emoji: '🎡',
        title: `Fokus ${quarterLabel(q.year, q.q)}: ${rows.map((r) => `${r.icon} ${r.label} ${r.current}→${r.target}`).join(' · ')}`,
        detail: rows[0]?.tip ? `💡 ${rows[0].tip}` : undefined,
        href: { pathname: '/wheel' },
      });
    }
  }

  // 🎉 Fun — sudah lama tidak refreshing: cukup jadi catatan "later".
  if (funReminderDue(input.fun, now)) {
    push({
      id: 'fun',
      section: 'life',
      tier: 'later',
      rank: 6,
      emoji: '🎉',
      title: 'Sudah lama tidak refreshing',
      href: { pathname: '/fun' },
    });
  }

  // ============================ Pangkas & urutkan ============================
  const byPriority = (a: TodayItem, b: TodayItem) =>
    a.rank - b.rank || SECTION_ORDER[a.section] - SECTION_ORDER[b.section];
  const bySection = (a: TodayItem, b: TodayItem) =>
    SECTION_ORDER[a.section] - SECTION_ORDER[b.section] || a.rank - b.rank;

  // Yang lolos "today" dipangkas ke TODAY_MAX berdasarkan prioritas; urutan
  // masuk (stabil) menjaga yang lebih dulu dihitung tetap di depan.
  const todayAll = items.filter((i) => i.tier === 'today');
  const dipertahankan = new Set(
    [...todayAll].sort(byPriority).slice(0, TODAY_MAX).map((i) => i.id),
  );
  for (const i of todayAll) if (!dipertahankan.has(i.id)) i.tier = 'next';

  const today = items.filter((i) => i.tier === 'today').sort(bySection);
  const upNext = items.filter((i) => i.tier === 'next').sort(bySection);
  const later = items.filter((i) => i.tier === 'later').sort(bySection);

  // ============================ Refleksi ============================
  const jurnal = input.habits.find(isNoteDrivenHabit);
  const teks = jurnal ? (input.day?.notes[jurnal.id] ?? '') : '';
  const written = habitNoteDone(teks);
  const reflection: TodayReflection = {
    available: jurnal !== undefined,
    text: teks,
    written,
    showGenerate: written && !input.feedGenerated,
    emphasis: rhemaWindowNow(now) || now.getHours() >= EVENING_HOUR,
  };

  return {
    god: {
      state: godState,
      lines: godLines,
      streak: login?.count ?? 0,
      nudge: activeNudge(now, todayId, input.myReminders),
    },
    today,
    upNext,
    later,
    reflection,
    // Dihitung SEPANJANG HARI, bukan cuma di jendela malamnya: penjadwal
    // pengingat (lib/notify.ts) menulis ulang jadwal kapan saja layar Today
    // digambar, dan pengingat 22.00 harus tetap benar walau app-nya cuma
    // dibuka pagi hari.
    night: { summary: nightSummary(malam), done: nightAllDone(input.day) },
  };
}

