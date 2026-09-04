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
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { Badge } from '@/components/common/Badge';
import { CheckCircle } from '@/components/common/CheckCircle';
import { EmojiButton } from '@/components/common/EmojiButton';
import { Greeting } from '@/components/common/Greeting';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { ReminderCard } from '@/components/common/ReminderCard';
import { VixText } from '@/components/common/VixText';
import { IconGlyph } from '@/components/ui/icon-glyph';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { useNow } from '@/hooks/useNow';
import { useReadyGate } from '@/hooks/useReadyGate';
import { useScrollTop } from '@/hooks/useScrollTop';
import {
  prayerDeadlinePassed,
  prayerDoneToday,
  prayerGateDue,
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
  coreAttention,
  EMPTY_WEEKLY_FOCUS,
  followupCardWindow,
  followupDue,
  subscribeBirthdayGreets,
  subscribeCoreLeaders,
  subscribeMainTeam,
  subscribeVisitations,
  subscribeWeeklyFocus,
  type BirthdayGreets,
  type CoreLeader,
  type MainTeamMember,
  type Visitation,
  type WeeklyFocus,
} from '@/lib/core';
import { debtUrgentCount, subscribeDebts, type Debt } from '@/lib/debts';
import {
  devicesNeedingTopUp,
  subscribeDataPlans,
  type DataPlan,
} from '@/lib/device';
import { OWNER_NAME } from '@/lib/family';
import {
  EMPTY_FUTSAL,
  futsalAttention,
  subscribeFutsal,
  type FutsalData,
} from '@/lib/futsal';
import {
  fastingCheckDue,
  fastingDayNumber,
  subscribeFastingPlans,
  type FastingPlan,
} from '@/lib/fasting';
import {
  EMPTY_FIT_DAY,
  fitPendingToday,
  subscribeFitDay,
  type FitDay,
} from '@/lib/fitness';
import { formatShortDayDate } from '@/lib/format';
import {
  habitNoteDone,
  isNoteDrivenHabit,
  rhemaWindowNow,
  subscribeHabitSchedule,
  type ScheduledHabit,
} from '@/lib/habits';
import {
  bumpWaterStreak,
  setWater,
  subscribeHabitDay,
  subscribeWaterStreak,
  WATER_GOAL,
  type HabitDay,
} from '@/lib/health';
import { HOME_FEATURES } from '@/lib/homeGrid';
import {
  intercessionNightWindow,
  intercessionToday,
  isChainTopic,
} from '@/lib/intercession';
import {
  discussionWindowNow,
  EMPTY_WEEK,
  learningPending,
  pendingTopicsOfWeek,
  subscribeLearningWeek,
  subscribeTopicsDone,
  topicGroupMeta,
  weekDocId,
  type LearningWeek,
  type TopicsDone,
} from '@/lib/learning';
import { unsubscribeAll } from '@/lib/liveDoc';
import {
  refreshPrayerNews,
  subscribePrayerNews,
  withWeeklyNews,
  type PrayerNews,
} from '@/lib/prayerNews';
import {
  EMPTY_PRIORITY,
  priorityBadgeText,
  subscribePriorityDay,
  type PriorityItem,
} from '@/lib/priority';
import {
  populationDue,
  subscribePopulationLog,
  type PopulationSaved,
} from '@/lib/news';
import { subscribeFeedGenerated } from '@/lib/reflectionFeed';
import {
  countResidenceAttention,
  subscribeChoreStatus,
  type ChoreStatusMap,
} from '@/lib/residence';
import {
  sermonShareDue,
  subscribeSermons,
  type SermonNote,
} from '@/lib/sermon';
import { billUnsettled, subscribeBills, type Bill } from '@/lib/friends';
import {
  activeNudge,
  bibleSessionMeta,
  bibleSessionNow,
  reviveHandledToday,
  subscribeBibleReadingToday,
  subscribeMyReminders,
  subscribeReviveStreak,
  type BibleReadingSessions,
  type MyReminder,
  type ReviveStreak,
} from '@/lib/spiritual';
import {
  effectiveOtherTask,
  subscribeOtherTasks,
  subscribeTasks,
  type OtherTask,
  type Task,
} from '@/lib/tasks';
import { logFeatureUse } from '@/lib/usage';

// Berapa langganan Firestore yang isinya dipakai BADGE tile. Angkanya dipakai
// useReadyGate untuk menahan badge sampai semuanya tiba, jadi kalau nanti ada
// sumber badge baru, tambahkan juga di sini — kalau tidak, badge-nya tidak
// akan pernah muncul (gerbangnya menunggu sumber yang tak pernah datang).
const BADGE_SOURCES = 21;

// Nama sapaan di Home memakai OWNER_NAME bersama (lib/family) — dipakai juga
// untuk mengenali "saya" di pohon keluarga. Ganti di sana kalau mau ubah.
//
// Daftar fitur gridnya sendiri pindah ke lib/homeGrid.ts: layar Achievement
// ikut memakainya untuk mengurutkan kategori pencapaian, jadi urutannya harus
// punya SATU sumber. Tambah fitur baru = tambah 1 baris di sana.

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  // Tekan tombol Home lagi saat halamannya sedang dibuka → balik ke atas.
  const { ref: scrollRef } = useScrollTop();

  // Daily login streak 🔥 — undefined = belum termuat.
  const [login, setLogin] = useState<LoginStreak | null | undefined>(undefined);

  // Data untuk badge tugas harian per fitur + air putih di kartu sapaan.
  const [tasks, setTasks] = useState<Task[]>([]);
  const [day, setDay] = useState<HabitDay | null>(null);
  // Daftar kebiasaan — dipakai untuk menemukan baris Rhema & catatannya.
  const [habits, setHabits] = useState<ScheduledHabit[]>([]);
  const [leaders, setLeaders] = useState<CoreLeader[]>([]);
  const [mainTeam, setMainTeam] = useState<MainTeamMember[]>([]);
  const [greets, setGreets] = useState<BirthdayGreets>({});
  const [weeklyFocus, setWeeklyFocus] = useState<WeeklyFocus>(EMPTY_WEEKLY_FOCUS);
  const [visitations, setVisitations] = useState<Visitation[]>([]);
  const [revive, setRevive] = useState<ReviveStreak | null | undefined>(
    undefined,
  );
  const [carParts, setCarParts] = useState<PartStatusMap>({});
  const [residenceChores, setResidenceChores] = useState<ChoreStatusMap>({});
  // Centang gerakan gym hari ini (+ tanda ✕ kalau dilewati) — untuk badge
  // tile Fitness 💪.
  const [fitDay, setFitDay] = useState<FitDay>(EMPTY_FIT_DAY);
  // Langkah belajar minggu ini — untuk badge tile Learning 🎓.
  const [learningWeek, setLearningWeek] = useState<LearningWeek>(EMPTY_WEEK);
  // Topik diskusi yang sudah diobrolkan — ikut menghitung badge Learning.
  const [topicsDone, setTopicsDone] = useState<TopicsDone>({});
  // Patungan Split Bill — untuk badge tile Friends 🤝.
  const [bills, setBills] = useState<Bill[]>([]);
  // Pinjaman 🤝 — untuk badge tile Finance saat ada yang sudah H-1.
  const [debts, setDebts] = useState<Debt[]>([]);
  // Prioritas P1 — untuk badge Career (Fulltime + Freelance) & Reminder.
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>([]);
  const [freelance, setFreelance] = useState<FreelanceProject[]>([]);
  const [otherTasks, setOtherTasks] = useState<OtherTask[]>([]);
  // Bacaan Alkitab hari ini — null = belum termuat.
  const [bibleReading, setBibleReading] =
    useState<BibleReadingSessions | null>(null);
  // Streak hari "cukup 8 gelas" — dicatat saat gelas ke-8 hari ini tercapai.
  const [waterStreak, setWaterStreak] = useState<LoginStreak | null>(null);
  // Tiga prioritas hari ini 💡 — untuk angka di tombol header. Dokumennya per
  // tanggal, jadi ganti hari = daftar kosong lagi tanpa perlu direset.
  const [priorities, setPriorities] = useState<PriorityItem[]>(EMPTY_PRIORITY);
  // Feed refleksi hari ini sudah dibuat? Selama BELUM, tombol "Generate Feed"
  // bertahan di kartu refleksi — di luar jam baca-ulangnya sekalipun.
  const [feedGenerated, setFeedGenerated] = useState(false);
  // Kliping berita mingguan untuk syafaat Gereja & Negara.
  // undefined = dokumennya belum terbaca (jangan ambil berita dulu),
  // null = memang belum pernah ada catatannya.
  const [prayerNews, setPrayerNews] = useState<PrayerNews | null | undefined>(
    undefined,
  );
  // Kartu Doa Syafaat sedang dibuka (menampilkan seluruh pokok doanya)?
  const [intercessionOpen, setIntercessionOpen] = useState(false);
  // Kalimat penyegar yang barusan di-klik "sudah dibaca" (null = belum ada).
  const [nudgeSeen, setNudgeSeen] = useState<string | null>(null);
  // Rhema & Aplikasi yang kamu pasang sendiri dari Revive 📌 — salah satunya
  // menggantikan satu giliran penyegar hari ini (lihat nudgeSchedule).
  const [myReminders, setMyReminders] = useState<MyReminder[]>([]);
  // Periode puasa 🍽️ — untuk kartu centang malam. null = belum termuat, jadi
  // kartunya tidak sempat berkedip sebelum datanya sampai.
  const [fastingPlans, setFastingPlans] = useState<FastingPlan[] | null>(null);
  // Catatan khotbah — untuk kartu "Kirim Catatan Khotbah" tiap Kamis siang.
  const [sermons, setSermons] = useState<SermonNote[]>([]);
  // Paket kuota — untuk badge tile Device 📱 saat paketnya sudah H-1.
  const [dataPlans, setDataPlans] = useState<DataPlan[]>([]);
  // Futsal rutin — ikut menghitung badge tile Friends 🤝.
  const [futsal, setFutsal] = useState<FutsalData>(EMPTY_FUTSAL);
  // Catatan populasi — untuk badge tile News 📰 tiap awal bulan.
  const [population, setPopulation] = useState<PopulationSaved>({});

  // Jam berjalan (di-refresh tiap menit) + id hari ini — untuk gate doa jam 4,
  // badge yang bergantung waktu (mobil/rumah), dan reset harian lewat tengah
  // malam. Lihat catatan lengkapnya di hooks/useNow.ts.
  const { now, todayId } = useNow();
  // id minggu berjalan (tanggal Senin) — nilainya sama sepanjang minggu, jadi
  // langganan Learning di bawah tidak ikut dipasang ulang tiap menit.
  const weekId = weekDocId(now);

  // Badge tile baru digambar SETELAH keempat belas sumbernya tiba, supaya
  // angkanya muncul serentak — bukan menetes satu per satu selama beberapa
  // detik seperti sebelumnya. Grid & sapaan tetap tampil seketika.
  const { ready: badgesReady, mark } = useReadyGate(BADGE_SOURCES);

  useEffect(() => {
    if (!user) return;
    return unsubscribeAll([
      // --- Sumber badge (ikut ditunggu useReadyGate) ---
      subscribeLearningWeek(user.uid, weekId, mark('learningWeek', setLearningWeek)),
      subscribeTopicsDone(user.uid, mark('topicsDone', setTopicsDone)),
      subscribeBills(user.uid, mark('bills', setBills)),
      subscribeChoreStatus(user.uid, mark('chores', setResidenceChores)),
      subscribeTasks(user.uid, mark('tasks', setTasks)),
      subscribeCoreLeaders(user.uid, mark('leaders', setLeaders)),
      // Undian ulang 🎲 fokus minggu ini — ikut ditunggu supaya badge CORE
      // menghitung ORANG YANG SAMA dengan yang tampil di tab Follow Up.
      subscribeWeeklyFocus(user.uid, mark('weeklyFocus', setWeeklyFocus)),
      subscribeVisitations(user.uid, mark('visitations', setVisitations)),
      // Main Team & ucapan ulang tahun — bukan hiasan: ulang tahun hari ini
      // yang belum diucapkan ikut jadi tagihan CORE, persis seperti di badge
      // sub-tab Follow Up (lihat coreAttention di lib/core.ts).
      subscribeMainTeam(user.uid, mark('mainTeam', setMainTeam)),
      subscribeBirthdayGreets(user.uid, mark('greets', setGreets)),
      subscribeSermons(user.uid, mark('sermons', setSermons)),
      subscribePopulationLog(user.uid, mark('population', setPopulation)),
      subscribeReviveStreak(user.uid, mark('revive', setRevive)),
      subscribePartStatus(user.uid, mark('carParts', setCarParts)),
      subscribeRoadmap(user.uid, mark('roadmap', setRoadmap)),
      subscribeFreelance(user.uid, mark('freelance', setFreelance)),
      subscribeOtherTasks(user.uid, mark('otherTasks', setOtherTasks)),
      subscribeFitDay(user.uid, todayId, mark('fitDay', setFitDay)),
      subscribeDebts(user.uid, mark('debts', setDebts)),
      subscribeDataPlans(user.uid, mark('dataPlans', setDataPlans)),
      subscribeFutsal(user.uid, mark('futsal', setFutsal)),
      // --- Sisanya mengisi kartu & sapaan, bukan badge ---
      subscribeLoginStreak(user.uid, setLogin),
      subscribeHabitDay(user.uid, todayId, setDay),
      subscribeHabitSchedule(user.uid, setHabits),
      subscribeBibleReadingToday(user.uid, todayId, setBibleReading),
      subscribeMyReminders(user.uid, setMyReminders),
      subscribeWaterStreak(user.uid, setWaterStreak),
      subscribePrayerNews(user.uid, setPrayerNews),
      subscribePriorityDay(user.uid, todayId, setPriorities),
      subscribeFeedGenerated(user.uid, todayId, setFeedGenerated),
      subscribeFastingPlans(user.uid, setFastingPlans),
    ]);
  }, [user, todayId, weekId, mark]);

  // "Cron" kliping doa syafaat 📰🙏 — app ini tidak punya server maupun tugas
  // latar, jadi penjadwalnya ya Home: sekali seminggu, saat pertama dibuka.
  // `refreshPrayerNews` sendiri yang memutuskan perlu-tidaknya (bandingkan
  // weekId), jadi buka-tutup Home berkali-kali tidak menambah biaya apa pun.
  // Ref = pengaman supaya satu sesi app paling banyak sekali mencoba.
  const newsTried = useRef(false);
  useEffect(() => {
    if (!user || prayerNews === undefined || newsTried.current) return;
    newsTried.current = true;
    refreshPrayerNews(user.uid, prayerNews, new Date()).catch(() => {
      // Gagal ambil (offline / RSS bermasalah) → biarkan, dicoba lagi nanti.
      newsTried.current = false;
    });
  }, [user, prayerNews]);

  // Doa pagi TERLEWAT OTOMATIS: sudah lewat jam 09.00 & belum dikonfirmasi
  // hari ini. Saat itu terjadi streak doa dihanguskan (sekali saja), lalu Home
  // tidak lagi memaksa gerbang — langsung ke Home meski streak sudah 0.
  const prayerMissed =
    login != null && !prayerDoneToday(login, now) && prayerDeadlinePassed(now);
  useEffect(() => {
    if (user && prayerMissed && login && login.count > 0) {
      resetPrayerStreak(user.uid, login).catch(() => {});
    }
  }, [user, prayerMissed, login]);

  // Air putih 💧 — gelas terminum hari ini (0..). Tersimpan per hari (HabitDay
  // per dayId) → otomatis kembali 0 tiap ganti hari.
  const water = day?.water ?? 0;

  // Baca Alkitab 📖: kartu hanya muncul di dalam jendela jamnya & selama sesi
  // itu belum diisi. null = belum termuat (biar kartunya tidak berkedip).
  const bibleSession = bibleSessionNow(now);
  const bibleMeta = bibleSession ? bibleSessionMeta(bibleSession) : null;
  const bibleReadingDue =
    bibleSession !== null &&
    bibleReading !== null &&
    !bibleReading[bibleSession];

  // Doa Syafaat 🙏 — pokok doa tetap sesuai hari (lib/intercession.ts).
  // Pagi sudah jadi langkah wajib di Morning Gateway; kartu ini pengingatnya
  // sepanjang hari, dan mulai jam 18.00 berubah jadi ajakan mendoakan lagi.
  // Ditampilkan RINGKAS (1 baris) supaya grid fitur tetap muat sekali layar —
  // pokok doanya baru terbuka saat kartunya di-klik.
  // Hari Gereja ⛪ (Sabtu) & Negara 🇮🇩 (Minggu) pokok doanya ditambah kliping
  // berita sepekan terakhir — biar yang didoakan ikut yang sedang terjadi,
  // bukan cuma daftar tetap. Hari lain tidak berubah sama sekali.
  const intercession = withWeeklyNews(
    intercessionToday(now),
    prayerNews ?? null,
  );
  const intercessionChain = isChainTopic(intercession);
  const intercessionSummary = intercessionChain
    ? 'Doakan & follow up pokok doa CORE Leader giliran hari ini'
    : intercessionNightWindow(now)
      ? '🌙 Doakan sekali lagi sebelum tidur'
      : `${intercession.points.length} pokok doa`;
  const intercessionTexts =
    intercessionOpen && !intercessionChain
      ? intercession.points.map((p) => `• ${p}`)
      : [intercessionSummary];

  // Refleksi harian 📓 — yang kamu tulis di kebiasaan "Daily Reflection
  // Journal". Ditampilkan ULANG di sini pada jam 12–13, 17–18, & 21–22 supaya
  // tidak berhenti di kolom catatan; kalau belum ditulis, tidak muncul.
  const rhemaHabit = habits.find(isNoteDrivenHabit);
  const rhemaText = rhemaHabit ? (day?.notes[rhemaHabit.id] ?? '') : '';
  const reflectionWritten = habitNoteDone(rhemaText);
  // Tombol Generate Feed bertahan sampai feed hari itu benar-benar dibuat.
  const showGenerate = reflectionWritten && !feedGenerated;
  // Karena itu kartunya juga ikut bertahan di luar jam baca-ulang — kalau tidak,
  // tombolnya cuma bisa dijangkau tiga jendela sehari.
  const showRhema = reflectionWritten && (rhemaWindowNow(now) || showGenerate);

  // Diskusi Dalam Minggu Ini 💬 — tiga topik giliran minggu ini yang belum
  // diobrolkan. Tidak dipatok hari: ngobrol terjadi saat kebetulan ketemu
  // orangnya, jadi tagihannya bertahan SEPANJANG minggu itu lalu berganti
  // sendiri tiap Senin — persis aturan yang dipakai Dashboard & badge tile.
  //
  // Bedanya di sini cuma jam tayangnya (11.30–12.30, lihat lib/learning.ts):
  // Home itu launcher, bukan daftar tagihan. Di luar jam itu kartunya hilang
  // walau ketiganya belum dicentang — yang menagih sepanjang hari tetap
  // Dashboard.
  const discussionTopics = discussionWindowNow(now)
    ? pendingTopicsOfWeek(topicsDone, now)
    : [];
  // Menunggu langganan topicsDone tiba dulu (gerbang yang sama dengan badge
  // tile). Tanpa ini, dokumennya yang belum termuat terbaca "belum ada yang
  // dicentang" → kartunya berkedip lengkap 3 topik sekejap tiap Home dibuka.
  const showDiscussion = badgesReady && discussionTopics.length > 0;

  // Follow Up Mingguan 🎯 — CL giliran minggu ini yang belum di-follow up
  // hari ini. Menyala mulai jam 09.00 (percakapan tidak dimulai jam 00.05).
  const followupPending = followupDue(leaders, now, weeklyFocus, todayId);
  // Seluruh tagihan CORE (kiriman panduan + follow up + ulang tahun) —
  // perhitungan yang SAMA dengan badge sub-tab di dalam layar CORE.
  const perhatianCore = coreAttention({
    leaders,
    mainTeam,
    visitations,
    greets,
    focus: weeklyFocus,
    now,
    todayId,
  });
  // Kartunya sendiri cuma numpang SETENGAH JAM (09.00–09.30): Home itu
  // launcher, jadi tagihan yang menetap sepanjang hari tempatnya di Dashboard
  // — yang di sini cuma tepukan bahu di jam paling mungkin dikerjakan.
  const showFollowup =
    badgesReady && followupCardWindow(now) && followupPending.length > 0;

  // Puasa 🍽️ — kartu centang malam (20.00–24.00). Puasa dinilai SESUDAH
  // harinya dijalani, bukan di tengahnya, jadi tagihannya memang malam.
  // Hilang begitu hari itu dijawab — berhasil ✅ maupun ❌ gagal.
  const fastingDue = fastingCheckDue(fastingPlans ?? [], now, todayId);

  // Kirim catatan khotbah 📤 — Kamis 12.00–14.00, kalau catatannya memang ada.
  const sermonDue = badgesReady ? sermonShareDue(sermons, now) : null;

  // Penyegar acak 🕊️ — kalimatnya & jam munculnya sama-sama diundi per hari.
  // Kalau sudah di-klik, disembunyikan sampai giliran BERIKUTNYA (kalimatnya
  // beda, jadi cukup dibandingkan teksnya — tak perlu menyimpan jam).
  // Kalau kamu sudah memasang Rhema/Aplikasi sendiri dari Revive 📌, SATU dari
  // ketiga giliran hari ini jadi milik tulisanmu — dan giliran itu ingat asal
  // catatannya, jadi kartunya bisa di-klik balik ke Revive-nya.
  const nudge = activeNudge(now, todayId, myReminders);
  const showNudge = nudge !== null && nudge.text !== nudgeSeen;

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
    // Kebiasaan harian pindah ke tab Habits 📋 — badge-nya ikut ke sana,
    // jadi tile Health tidak lagi punya angka (isinya Steps & Check-up).
    // Tagihan CORE hari ini — dihitung SEKALI di lib/core.ts (coreAttention)
    // lalu dipakai bersama badge sub-tab Visitation & Follow Up di dalam
    // layarnya. Karena angkanya berasal dari sumber yang sama, tak akan ada
    // lagi badge "1" di Home yang begitu dibuka tidak menunjuk ke mana-mana.
    core: perhatianCore.total,
    // Revive belum ditulis DAN belum ditandai dilewati hari ini = 1 (dua-duanya
    // tersimpan di dokumen streak yang sama).
    spiritual:
      revive === undefined ? 0 : reviveHandledToday(revive, todayId) ? 0 : 1,
    // Jumlah part mobil yang perlu perhatian (segera/lewat jadwal).
    car: countCarAttention(carParts, now),
    // Jumlah perawatan/kebersihan rumah yang perlu perhatian.
    residence: countResidenceAttention(residenceChores, now),
    // Gerakan gym hari ini yang belum dicentang — menyala dari pagi jam 09.00,
    // bareng kartu reminder di Dashboard. Hari yang ditandai ✕ (dilewati)
    // tidak memunculkan badge sama sekali.
    fitness: fitPendingToday(fitDay, now),
    // Langkah belajar minggu ini yang harinya sudah tiba tapi belum
    // dikerjakan (Sen/Rab/Jum/Min) DITAMBAH topik diskusi dalam minggu ini yang
    // belum diobrolkan — aturan yang sama persis dengan kedua kartu reminder
    // Learning di Dashboard.
    learning: learningPending(learningWeek.steps, topicsDone, now),
    // Pinjaman yang jatuh temponya sudah H-1 (termasuk hari ini & yang
    // kelewat). Angkanya sama dengan badge tombol 🤝 di header Finance.
    finance: debtUrgentCount(debts, now),
    // Friends = JUMLAH kedua sub-tab berbadge di dalamnya:
    //   Split Bill → patungan yang masih ada orang belum setor
    //   Fun Futsal → futsal ≤ 2 hari lagi, atau yang sudah lewat tapi
    //                iurannya belum lunas
    friends: bills.filter(billUnsettled).length + futsalAttention(futsal, now),
    // Device = paket kuota yang sudah H-1 (habis besok atau hari ini).
    // Aturannya tinggal di lib/device.ts dan dipakai ulang oleh badge
    // sub-tabnya, jadi mustahil beda.
    device: devicesNeedingTopUp(dataPlans, now),
    // News = catatan populasi awal bulan yang belum diisi. Menyala tiap
    // tanggal 1 sampai angkanya kamu salin dari worldometers.
    news: populationDue(population, now),
  };

  // Air putih 💧 — tombol cepat harian di kartu sapaan (tersimpan di HabitDay).
  async function changeWater(delta: number) {
    if (!user || !day) return;
    const next = day.water + delta;
    try {
      await setWater(user.uid, todayId, next);
      // Streak naik SEKALI per hari, tepat saat target tercapai. Turun lagi
      // ke bawah target tidak membatalkan — harinya memang sudah tercapai.
      if (next >= WATER_GOAL) {
        await bumpWaterStreak(user.uid, waterStreak, todayId);
      }
    } catch {
      // Diamkan — snapshot akan mengoreksi tampilan otomatis.
    }
  }

  // Selagi status streak doa belum termuat → loading singkat, biar tidak
  // "berkedip" Home dulu baru muncul lock screen doa pagi.
  if (login === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <LoadingCenter size="large" />
      </SafeAreaView>
    );
  }

  // Doa pagi belum dikonfirmasi & MASIH di jendela pagi (sebelum jam 09.00) →
  // gerbang penuh (di luar tab supaya menutupi tab bar). Lewat jam 09.00 tanpa
  // doa → tidak dipaksa lagi; langsung Home (streak sudah dihanguskan).
  //
  // Layar lain diurus <MorningPrayerWatcher/> di app/_layout.tsx. Cek di sini
  // tetap ada supaya Home tidak sempat tergambar sekejap sebelum dialihkan.
  //
  // WAJIB memakai `prayerGateDue` — bukan `prayerDoneToday` langsung. Cek di
  // sini berjalan saat MENGGAMBAR, jadi ia pasti mendahului snapshot Firestore
  // yang baru saja ditulis; `prayerGateDue` ikut melihat penanda lokal
  // "barusan dikonfirmasi", sehingga Home tidak lagi melempar balik ke gerbang.
  if (prayerGateDue(login, now)) {
    return <Redirect href="/morning-prayer" />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.brandRow}>
        <VixText heading="header" additionalStyle={styles.brand}>
          vix <VixText heading="label">Super App</VixText>
        </VixText>
        <View style={styles.brandRight}>
          {/* Daily Priority 💡 — tiga hal terpenting hari ini.
              ⚠️ belum diisi · angka = sisa yang belum dicoret · ✅ beres.
              Angkanya sengaja TIDAK muncul selama belum diisi: "3" terbaca
              seolah sudah ada tiga hal yang menunggu, padahal yang menunggu
              justru keputusannya. Lihat priorityBadgeText di lib/priority.ts. */}
          <PressableScale
            style={styles.priorityPill}
            onPress={() => router.push('/daily-priority')}>
            <VixText heading="bold" additionalStyle={styles.priorityPillText}>
              {priorityBadgeText(priorities)}
            </VixText>
          </PressableScale>
          {/* Pintasan ke halaman Achievement 🏆 — lambang saja, tanpa angka.
              Dulu angkanya streak doa pagi, tapi tempatnya di pil bertrofi:
              seolah "sekian achievement", padahal di dalamnya ada banyak
              kategori (Revive, kebiasaan, gym, langkah, Learning, …). Satu
              angka dari satu kategori justru menyesatkan. */}
          <PressableScale
            style={styles.streakPill}
            onPress={() => router.push('/achievements')}>
            <VixText heading="bold" additionalStyle={styles.streakPillText}>
              🏆🔥
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

      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
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

          {/* Penyegar 🕊️ — muncul 3× sehari pada jam yang DIUNDI (lihat
              nudgeSchedule di lib/spiritual.ts), tiap kali dengan kalimat yang
              berbeda, lalu hilang sendiri sesudah satu jam. Sengaja di ATAS
              Doa Syafaat: syafaat wajib tiap hari, yang ini kejutan kecil.
              Di-klik = "sudah dibaca" → hilang sampai giliran berikutnya. */}
          {showNudge && (
            <Animated.View
              entering={FadeInDown.duration(350)}
              style={styles.nudgeCard}>
              <ReminderCard
                bg={Color.MAIN_LIGHT}
                fg={Color.MAIN_DARK}
                title={nudge.day ? '🕊️ Reminder dari Revive-mu' : '🕊️ Reminder'}
                texts={[nudge.text]}
                // Kalimat bawaan: klik = "sudah dibaca", kartunya pergi.
                // Kalimat TULISANMU sendiri: selain itu, ia juga membuka
                // catatan Revive asalnya — di situlah kalimatnya utuh, lengkap
                // dengan bacaan & judulnya.
                onPress={() => {
                  setNudgeSeen(nudge.text);
                  if (nudge.day) {
                    router.push({
                      pathname: '/revive',
                      params: { day: nudge.day },
                    });
                  }
                }}
                // Jadikan gambar persegi lalu kirim ke WhatsApp. Kalimatnya
                // DIOPER, bukan diundi ulang di layar sana — yang dibagikan
                // harus persis kalimat yang barusan kamu baca di sini.
                //
                // Ikon berbagi baku (square.and.arrow.up), bukan emoji 📤 —
                // rupanya sama dengan tombol kirim di fitur CORE, dan tombol
                // AKSI di app ini memang memakai ikon rata sewarna supaya tidak
                // ramai warna di dalam kartu. Emoji disimpan untuk pintasan
                // navigasi, yang lambangnya jadi penanda tujuan.
                action={
                  <EmojiButton
                    icon="square.and.arrow.up"
                    onPress={() =>
                      router.push({
                        pathname: '/reminder-share',
                        params: { text: nudge.text },
                      })
                    }
                  />
                }
              />
            </Animated.View>
          )}

          {/* Follow Up Mingguan 🎯 — cuma jam 09.00–09.30, dan cuma kalau
              masih ada yang belum di-follow up hari ini. Klik → CORE ›
              Follow Up, tempat tombol Chat WA-nya. Sepanjang sisa hari
              tagihannya tetap terlihat di badge & di Dashboard. */}
          {showFollowup && (
            <Animated.View
              entering={FadeInDown.delay(30).duration(350)}
              style={styles.followupCard}>
              {/* Warnanya ikut tile CORE di grid (biru) — sama seperti kartu
                  Doa Rantai & Pertemuan CORE di Dashboard. */}
              <ReminderCard
                bg={Color.FINANCE_INVESTMENT}
                fg={Color.FINANCE_INVESTMENT_DARK}
                title="🎯 Follow Up Mingguan"
                texts={followupPending.map((l) => ({
                  id: l.id,
                  text: `${l.heart} ${l.name}`,
                }))}
                onPress={() =>
                  router.push({ pathname: '/core', params: { tab: 'followup' } })
                }
              />
            </Animated.View>
          )}

          {/* Kirim Catatan Khotbah 📤 — cuma KAMIS jam 12.00–14.00, dan cuma
              kalau catatan Minggu kemarin memang sudah ditulis. Klik →
              halaman catatannya, tempat tombol "💬 Share ke WhatsApp"-nya
              berada. Catatannya sudah jadi arsip sejak Selasa, jadi yang
              dibagikan pasti versi finalnya. */}
          {sermonDue && (
            <Animated.View
              entering={FadeInDown.delay(40).duration(350)}
              style={styles.sermonCard}>
              <ReminderCard
                bg={Color.SPIRITUAL}
                fg={Color.SPIRITUAL_DARK}
                title="📤 Kirim Catatan Khotbah"
                texts={[
                  sermonDue.title,
                  'Bagikan ke CORE Leader lewat WhatsApp 💬',
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/sermon',
                    params: { id: sermonDue.id },
                  })
                }
              />
            </Animated.View>
          )}

          {/* Diskusi Dalam Minggu Ini 💬 — TEPAT di depan Doa Syafaat, dan
              cuma pada jam 11.30–12.30. Ketiga topiknya dicentang di sub-tab
              💬 Discussion, jadi kartunya menuju ke situ langsung. Hilang
              sendiri begitu ketiganya diobrolkan; kalau belum, ia kembali tiap
              siang sepanjang minggu itu. */}
          {showDiscussion && (
            <Animated.View
              entering={FadeInDown.delay(20).duration(350)}
              style={styles.discussionCard}>
              <ReminderCard
                bg={Color.LEARNING}
                fg={Color.LEARNING_DARK}
                title="💬 Diskusi Dalam Minggu Ini"
                texts={discussionTopics.map((t) => ({
                  id: t.key,
                  text: `${topicGroupMeta(t.group).emoji} ${t.label}`,
                }))}
                onPress={() =>
                  router.push({
                    pathname: '/learning',
                    params: { tab: 'topics' },
                  })
                }
              />
            </Animated.View>
          )}

          {/* Doa Syafaat 🙏 — pokok doa tetap sesuai hari dalam seminggu.
              Hari Doa Rantai CL (Selasa & Kamis) kartunya menuju CORE Follow
              Up; hari lain di-klik untuk membuka/menutup pokok doanya. */}
          <Animated.View
            entering={FadeInDown.delay(40).duration(350)}
            style={styles.intercessionCard}>
            <ReminderCard
              bg={Color.SPIRITUAL}
              fg={Color.SPIRITUAL_DARK}
              title={`🙏 Doa Syafaat — ${intercession.emoji} ${intercession.label} ${
                intercessionChain ? '→' : intercessionOpen ? '▴' : '▾'
              }`}
              texts={intercessionTexts}
              onPress={() =>
                intercessionChain
                  ? router.push({
                      pathname: '/core',
                      params: { tab: 'followup' },
                    })
                  : setIntercessionOpen((v) => !v)
              }
            />
          </Animated.View>

          {/* Refleksi Hari Ini 📓 — yang kamu tulis tadi pagi, dibaca ulang
              siang (12–13), sore (17–18), & malam (21–22). Klik tulisannya →
              tab Habits, langsung tergulung ke barisnya (?focus=rhema).

              Baris "🖼️ Generate Feed" TETAP ADA selama feed hari itu belum
              dibuat — termasuk di luar tiga jendela jam di atas, karena itulah
              satu-satunya pintunya. Begitu feed-nya jadi, barisnya hilang dan
              kartunya kembali cuma tampil di jendela baca-ulang. */}
          {showRhema && (
            <Animated.View
              entering={FadeInDown.delay(50).duration(350)}
              style={styles.rhemaCard}>
              <ReminderCard
                bg={Color.SPIRITUAL}
                fg={Color.SPIRITUAL_DARK}
                title="📓 Refleksi Hari Ini"
                texts={
                  showGenerate
                    ? [
                        { id: 'rhema', text: rhemaText },
                        { id: 'feed', text: '🖼️ Generate Feed' },
                      ]
                    : [{ id: 'rhema', text: rhemaText }]
                }
                onItemPress={(id) =>
                  id === 'feed'
                    ? router.push('/reflection-feed')
                    : router.push({
                        pathname: '/habits',
                        params: { focus: 'rhema' },
                      })
                }
              />
            </Animated.View>
          )}

          {/* Puasa 🍽️ — cuma malam (20.00–24.00) & cuma kalau hari ini belum
              dijawab. Klik → layar puasanya dengan modal HARI INI sudah
              terbuka, jadi tinggal centang & tulis jawaban doanya. */}
          {fastingDue && (
            <Animated.View
              entering={FadeInDown.delay(55).duration(350)}
              style={styles.fastingCard}>
              <ReminderCard
                bg={Color.SPIRITUAL}
                fg={Color.SPIRITUAL_DARK}
                title={`🍽️ ${fastingDue.title}`}
                texts={[
                  `Hari ke-${fastingDayNumber(fastingDue, todayId)} — sudah dijalani? Centang sekarang`,
                ]}
                onPress={() =>
                  router.push({
                    pathname: '/fasting-days',
                    params: { id: fastingDue.id, day: todayId },
                  })
                }
              />
            </Animated.View>
          )}

          {/* Baca Alkitab 📖 — 🌅 Pagi 05.00–10.00, 🌤️ Siang 12.00–15.00 &
              🌙 Malam 21.00–24.00. Hanya muncul di dalam jendela jamnya &
              selama sesi itu belum diisi.

              Klik → tab Habits, langsung tergulung ke baris Bible Reading sesi
              jam itu (?focus=bible-<sesi>) — bukan lompat ke layar catat
              bacaan. Alasannya: baris itulah yang menagih di daftar harian,
              jadi mendarat di sana membuat centangnya kelihatan dalam
              rangkaian hari ini, dan layar catat bacaannya tinggal sekali klik
              lagi dari barisnya. Pintu yang sama dipakai kartu Refleksi. */}
          {bibleReadingDue && bibleMeta && bibleSession && (
            <Animated.View entering={FadeInDown.delay(60).duration(350)}>
              <PressableScale
                style={styles.readingCard}
                onPress={() =>
                  router.push({
                    pathname: '/habits',
                    params: { focus: `bible-${bibleSession}` },
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
            {HOME_FEATURES.map((feature, index) => {
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
                    {/* IconGlyph hanya untuk tile yang lambangnya tidak ada di
                        SF Symbols (Friends — jabat tangan, Married — cincin).
                        Ukuran & pewarnaannya sama persis dengan IconSymbol di
                        bawahnya, jadi seluruh barisnya tetap rata. */}
                    {feature.glyph ? (
                      <IconGlyph name={feature.glyph} size={30} color={feature.fg} />
                    ) : feature.icon ? (
                      <IconSymbol name={feature.icon} size={30} color={feature.fg} />
                    ) : null}
                  </PressableScale>
                  {/* Badge merah: tugas harian fitur ini yang belum selesai.
                      Baru digambar setelah SEMUA sumbernya tiba (badgesReady),
                      lalu seluruh badge memudar masuk bersamaan — bukan
                      bermunculan satu per satu sambil data menetes. */}
                  {badgesReady && (
                    <Badge
                      count={badge}
                      ring={Color.BACKGROUND}
                      style={styles.badge}
                    />
                  )}
                  {/* Judul berlatar pil sewarna tile-nya: separuh atas menyatu
                      dengan tile, separuh bawah menggantung di latar krem —
                      warnanya otomatis ikut palet tiap fitur. */}
                  <View
                    style={[
                      styles.tileLabelPill,
                      { backgroundColor: feature.bg },
                    ]}>
                    {/* Nama tile SELALU satu baris. Kolomnya 21,5% dari lebar
                        konten → di iPhone 15 tinggal 61,9pt di dalam pil,
                        sedangkan "Residence" butuh 65pt: tanpa ini ia pecah
                        jadi dua baris. adjustsFontSizeToFit hanya MENGECILKAN
                        yang tak muat, jadi nama lain (terpanjang berikutnya
                        "Reminder", 59,4pt) tetap 13pt seperti sekarang —
                        cara yang sama dipakai tulisan sub-tab bawah. */}
                    <VixText
                      heading="label"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      additionalStyle={[styles.tileLabel, { color: feature.fg }]}>
                      {feature.label}
                    </VixText>
                  </View>
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
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    // Sejajar dengan kolom konten yang ditengahkan (iPad/layar lebar).
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  brand: { color: Color.MAIN },
  brandRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  content: { paddingBottom: 24, alignItems: 'center' },
  // Lebar konten dibatasi & otomatis di tengah (HP: penuh; iPad: ~680 di tengah).
  contentInner: { width: '100%', maxWidth: 680, paddingHorizontal: 20 },
  // Jarak ke kartu di bawahnya dirapatkan supaya reminder (Doa Syafaat & Baca
  // Alkitab) naik sedikit dan grid fitur tetap muat sekali layar.
  welcomeCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    marginBottom: 8,
  },
  // Kartu Doa Syafaat — tepat di bawah kartu sapaan, di atas Baca Alkitab.
  // Penyegar acak — jaraknya sama dengan kartu Doa Syafaat di bawahnya.
  nudgeCard: { marginBottom: 10 },
  // Follow Up pagi — jaraknya sama dengan kartu reminder lain di kolom ini.
  followupCard: { marginBottom: 10 },
  sermonCard: { marginBottom: 10 },
  // Diskusi siang — jaraknya sama dengan kartu reminder lain di kolom ini.
  discussionCard: { marginBottom: 10 },
  intercessionCard: { marginBottom: 10 },
  // Rhema pagi — jaraknya sama dengan kartu reminder lain di kolom ini.
  rhemaCard: { marginBottom: 10 },
  // Centang puasa malam — jaraknya sama dengan kartu reminder lain.
  fastingCard: { marginBottom: 10 },
  welcomeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
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
  // Daily Priority 💡 — bentuknya sama dengan pil 🏆, warnanya beda supaya
  // dua tombol bersebelahan itu tidak terbaca sebagai satu tombol panjang.
  priorityPill: {
    backgroundColor: Color.MAIN_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: Color.MAIN_DARK,
  },
  priorityPillText: { color: Color.MAIN_DARK },
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
    marginBottom: 10,
  },
  readingTitle: { color: Color.TEXT_TITLE, flexShrink: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    // Jarak antar-kolom tetap; jarak antar-BARIS dirapatkan supaya keempat
    // baris tile muat sekali layar di iPhone 15 (tak perlu scroll).
    columnGap: 16,
    rowGap: 10,
  },
  gridItem: { width: '21.5%', alignItems: 'center' },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Judul ditarik naik setengah baris → separuh atasnya menumpang di bagian
  // bawah tile (lineHeight label 19.5 ÷ 2 ≈ 10). Judul digambar SETELAH tile,
  // jadi otomatis berada di atasnya.
  tileLabelPill: {
    marginTop: -12,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 999,
  },
  tileLabel: { textAlign: 'center' },
  badge: { position: 'absolute', top: -6, right: -4 },
});
