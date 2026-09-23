import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { useDailyDismiss } from '@/hooks/useDailyDismiss';
import { useFinanceStatus } from '@/hooks/useFinanceStatus';
import { useLiveAll } from '@/hooks/useLiveAll';
import { useNow } from '@/hooks/useNow';
import { useReadyGate } from '@/hooks/useReadyGate';
import {
  prayerDeadlinePassed,
  prayerDoneToday,
  resetPrayerStreak,
  subscribeLoginStreak,
  type LoginStreak,
} from '@/lib/achievements';
import { subscribePartStatus, type PartStatusMap } from '@/lib/car';
import {
  subscribeFreelance,
  subscribeRoadmap,
  type FreelanceProject,
  type RoadmapItem,
} from '@/lib/career';
import {
  EMPTY_MONTHLY_PRAYERS,
  EMPTY_WEEKLY_FOCUS,
  subscribeBirthdayGreets,
  subscribeCoreLeaders,
  subscribeMainTeam,
  subscribeMonthlyPrayers,
  subscribeVisitations,
  subscribeWeeklyFocus,
  type BirthdayGreets,
  type CoreLeader,
  type MainTeamMember,
  type MonthlyPrayers,
  type Visitation,
  type WeeklyFocus,
} from '@/lib/core';
import { subscribeDebts, type Debt } from '@/lib/debts';
import { subscribeDataPlans, type DataPlan } from '@/lib/device';
import { EMPTY_DONOR, subscribeDonor, type DonorData } from '@/lib/donor';
import { subscribeFamily, type FamilyMember } from '@/lib/family';
import { subscribeFastingPlans, type FastingPlan } from '@/lib/fasting';
import { EMPTY_FIT_DAY, subscribeFitDay, type FitDay } from '@/lib/fitness';
import { subscribeBills, type Bill } from '@/lib/friends';
import { EMPTY_FUN, subscribeFun, type FunData } from '@/lib/fun';
import { EMPTY_FUTSAL, subscribeFutsal, type FutsalData } from '@/lib/futsal';
import { subscribeHabitSchedule, type ScheduledHabit } from '@/lib/habits';
import {
  subscribeCheckups,
  subscribeHabitDay,
  subscribeHealthProfile,
  type Checkup,
  type HabitDay,
  type HealthProfile,
} from '@/lib/health';
import { intercessionToday, type IntercessionTopic } from '@/lib/intercession';
import {
  EMPTY_WEEK,
  subscribeLearningWeek,
  subscribeTopicsDone,
  weekDocId,
  type LearningWeek,
  type TopicsDone,
} from '@/lib/learning';
import { subscribePopulationLog, type PopulationSaved } from '@/lib/news';
import { syncNotifications } from '@/lib/notify';
import {
  refreshPrayerNews,
  subscribePrayerNews,
  withWeeklyNews,
  type PrayerNews,
} from '@/lib/prayerNews';
import { EMPTY_PRIORITY_DAY, subscribePriorityDay, type PriorityDay } from '@/lib/priority';
import { subscribeFeedGenerated } from '@/lib/reflectionFeed';
import { subscribeChoreStatus, type ChoreStatusMap } from '@/lib/residence';
import { subscribeSermons, type SermonNote } from '@/lib/sermon';
import {
  subscribeBibleReadingToday,
  subscribeMyReminders,
  type BibleReadingSessions,
  type MyReminder,
} from '@/lib/spiritual';
import { subscribeOtherTasks, subscribeTasks, type OtherTask, type Task } from '@/lib/tasks';
import { buildToday, type TodayModel } from '@/lib/today';
import { subscribeMeterReadings, type MeterReading } from '@/lib/token';
import { quarterDocId, quarterOf, subscribeWheel, type WheelData } from '@/lib/wheel';

// Berapa langganan yang isinya menentukan BARIS Today. Daftar barisnya baru
// digambar sesudah semuanya tiba (useReadyGate), supaya muncul serentak sebagai
// satu susunan — bukan menetes satu per satu selama beberapa detik. Menambah
// sumber baru = tambah di daftar `mark(...)` di bawah DAN naikkan angka ini.
const SOURCES = 37;

/**
 * Seluruh data yang dibutuhkan layar Today, di satu tempat.
 *
 * Ini gabungan langganan Home & Dashboard lama. Jumlah listener-nya TIDAK
 * bertambah: dokumen yang sama dilanggan bersama lewat ref-count lib/liveDoc,
 * dan yang dulu dilanggan dua layar sekaligus kini cukup sekali di sini.
 * Hitungannya sendiri (lib/today.ts) murni & dijalankan di useMemo.
 */
export function useTodayData(): {
  now: Date;
  todayId: string;
  model: TodayModel;
  /** Semua sumber baris sudah tiba → daftar boleh digambar. */
  ready: boolean;
  login: LoginStreak | null | undefined;
  priorities: PriorityDay;
  /** Pokok doa syafaat hari ini (+ kliping berita di Sabtu/Minggu). */
  intercession: IntercessionTopic;
  intercessionDismiss: ReturnType<typeof useDailyDismiss>;
} {
  const { user } = useAuth();
  const { now, todayId } = useNow();
  const weekId = weekDocId(now);
  const finance = useFinanceStatus(now);
  const intercessionDismiss = useDailyDismiss('home:intercession', todayId);

  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);
  const [bibleReading, setBibleReading] = useState<BibleReadingSessions | null>(null);
  const [habits, setHabits] = useState<ScheduledHabit[]>([]);
  const [day, setDay] = useState<HabitDay | null>(null);
  const [fitDay, setFitDay] = useState<FitDay>(EMPTY_FIT_DAY);
  const [fastingPlans, setFastingPlans] = useState<FastingPlan[] | null>(null);
  const [sermons, setSermons] = useState<SermonNote[]>([]);
  const [myReminders, setMyReminders] = useState<MyReminder[]>([]);
  const [prayerNews, setPrayerNews] = useState<PrayerNews | null | undefined>(undefined);
  const [feedGenerated, setFeedGenerated] = useState(false);
  const [priorities, setPriorities] = useState<PriorityDay>(EMPTY_PRIORITY_DAY);

  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[]>([]);
  const [greets, setGreets] = useState<BirthdayGreets>({});
  const [weeklyFocus, setWeeklyFocus] = useState<WeeklyFocus>(EMPTY_WEEKLY_FOCUS);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [monthlyPrayers, setMonthlyPrayers] = useState<MonthlyPrayers>(EMPTY_MONTHLY_PRAYERS);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [otherTasks, setOtherTasks] = useState<OtherTask[]>([]);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [freelance, setFreelance] = useState<FreelanceProject[]>([]);

  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [donor, setDonor] = useState<DonorData>(EMPTY_DONOR);
  const [learningWeek, setLearningWeek] = useState<LearningWeek>(EMPTY_WEEK);
  const [topicsDone, setTopicsDone] = useState<TopicsDone>({});
  const [bills, setBills] = useState<Bill[]>([]);
  const [futsal, setFutsal] = useState<FutsalData>(EMPTY_FUTSAL);
  const [dataPlans, setDataPlans] = useState<DataPlan[]>([]);
  const [population, setPopulation] = useState<PopulationSaved>({});
  const [carParts, setCarParts] = useState<PartStatusMap>({});
  const [residenceChores, setResidenceChores] = useState<ChoreStatusMap>({});
  const [meterReadings, setMeterReadings] = useState<MeterReading[]>([]);
  const [wheel, setWheel] = useState<WheelData | null>(null);
  const [fun, setFun] = useState<FunData>(EMPTY_FUN);

  const { ready, mark } = useReadyGate(SOURCES);

  useLiveAll(
    (uid) => {
      const q = quarterOf(new Date());
      return [
        subscribeLoginStreak(uid, mark('login', setLogin)),
        subscribeBibleReadingToday(uid, todayId, mark('bible', setBibleReading)),
        subscribeHabitSchedule(uid, mark('habits', setHabits)),
        subscribeHabitDay(uid, todayId, mark('day', setDay)),
        subscribeFitDay(uid, todayId, mark('fitDay', setFitDay)),
        subscribeFastingPlans(uid, mark('fasting', setFastingPlans)),
        subscribeSermons(uid, mark('sermons', setSermons)),
        subscribeMyReminders(uid, mark('myReminders', setMyReminders)),
        subscribePrayerNews(uid, mark('prayerNews', setPrayerNews)),
        subscribeFeedGenerated(uid, todayId, mark('feed', setFeedGenerated)),
        subscribePriorityDay(uid, todayId, mark('priorities', setPriorities)),
        subscribeCoreLeaders(uid, mark('leaders', setLeaders)),
        subscribeMainTeam(uid, mark('mainTeam', setMainTeam)),
        subscribeBirthdayGreets(uid, mark('greets', setGreets)),
        subscribeWeeklyFocus(uid, mark('weeklyFocus', setWeeklyFocus)),
        subscribeVisitations(uid, mark('visitations', setVisitations)),
        subscribeMonthlyPrayers(uid, mark('monthlyPrayers', setMonthlyPrayers)),
        subscribeTasks(uid, mark('tasks', setTasks)),
        subscribeOtherTasks(uid, mark('otherTasks', setOtherTasks)),
        subscribeRoadmap(uid, mark('roadmap', setRoadmap)),
        subscribeFreelance(uid, mark('freelance', setFreelance)),
        subscribeFamily(uid, mark('family', setFamily)),
        subscribeDebts(uid, mark('debts', setDebts)),
        subscribeCheckups(uid, mark('checkups', setCheckups)),
        subscribeHealthProfile(uid, mark('profile', setProfile)),
        subscribeDonor(uid, mark('donor', setDonor)),
        subscribeLearningWeek(uid, weekId, mark('learningWeek', setLearningWeek)),
        subscribeTopicsDone(uid, mark('topicsDone', setTopicsDone)),
        subscribeBills(uid, mark('bills', setBills)),
        subscribeFutsal(uid, mark('futsal', setFutsal)),
        subscribeDataPlans(uid, mark('dataPlans', setDataPlans)),
        subscribePopulationLog(uid, mark('population', setPopulation)),
        subscribePartStatus(uid, mark('carParts', setCarParts)),
        subscribeChoreStatus(uid, mark('chores', setResidenceChores)),
        subscribeMeterReadings(uid, mark('readings', setMeterReadings)),
        subscribeWheel(uid, quarterDocId(q.year, q.q), mark('wheel', setWheel)),
        subscribeFun(uid, mark('fun', setFun)),
      ];
    },
    { deps: [todayId, weekId, mark] },
  );

  // "Cron" kliping doa syafaat 📰🙏 — app ini tidak punya server maupun tugas
  // latar, jadi penjadwalnya ya layar Today: sekali seminggu, saat pertama
  // dibuka. `refreshPrayerNews` sendiri yang memutuskan perlu-tidaknya.
  const newsTried = useRef(false);
  useEffect(() => {
    if (!user || prayerNews === undefined || newsTried.current) return;
    newsTried.current = true;
    refreshPrayerNews(user.uid, prayerNews, new Date()).catch(() => {
      newsTried.current = false;
    });
  }, [user, prayerNews]);

  // Morning Journey TERLEWAT: lewat jam 09.00 & belum dijalani → streak
  // berjalan hangus (sekali). Undangannya tetap ada (gerbang lunak), hanya
  // streaknya yang mulai lagi dari awal — aturan lama, tidak diubah.
  const prayerMissed =
    login != null && !prayerDoneToday(login, now) && prayerDeadlinePassed(now);
  useEffect(() => {
    if (user && prayerMissed && login && login.count > 0) {
      resetPrayerStreak(user.uid, login).catch(() => {});
    }
  }, [user, prayerMissed, login]);

  const intercession = useMemo(
    () => withWeeklyNews(intercessionToday(now), prayerNews ?? null),
    [now, prayerNews],
  );
  const dismissed = intercessionDismiss.dismissed;

  const model = useMemo(
    () =>
      buildToday(
        {
          login,
          bibleReading,
          habits,
          day,
          fitDay,
          fastingPlans,
          sermons,
          myReminders,
          intercession,
          intercessionDismissed: dismissed,
          feedGenerated,
          leaders,
          mainTeam,
          greets,
          weeklyFocus,
          visitations,
          monthlyPrayers,
          tasks,
          otherTasks,
          roadmap,
          freelance,
          family,
          debts,
          checkups,
          profile,
          donor,
          learningWeek,
          topicsDone,
          bills,
          futsal,
          dataPlans,
          population,
          carParts,
          residenceChores,
          meterReadings,
          wheel,
          fun,
          finance,
        },
        now,
        todayId,
      ),
    [
      login, bibleReading, habits, day, fitDay, fastingPlans, sermons, myReminders,
      intercession, dismissed, feedGenerated, leaders, mainTeam, greets, weeklyFocus,
      visitations, monthlyPrayers, tasks, otherTasks, roadmap, freelance, family, debts,
      checkups, profile, donor, learningWeek, topicsDone, bills, futsal, dataPlans,
      population, carParts, residenceChores, meterReadings, wheel, fun, finance, now, todayId,
    ],
  );

  // 🔔 Pengingat di HP ditulis ulang tiap keadaan hari ini berubah — inilah
  // penjadwalnya (app ini tidak punya server maupun tugas latar). Menunggu
  // `ready` supaya yang dijadwalkan bukan keadaan setengah termuat.
  useEffect(() => {
    if (!user || !ready) return;
    syncNotifications(model, finance, todayId).catch(() => {});
  }, [user, ready, model, finance, todayId]);

  return { now, todayId, model, ready, login, priorities, intercession, intercessionDismiss };
}
