import {
  doc,
  setDoc,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { DAYPART } from './daypart';
import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { dayIdToDate, formatShortDayDate } from './format';
import { dayDocId } from './health';
import { homeFeatureIndex } from './homeGrid';
import { alreadyCounted, nextStreak } from './streak';

// Streak DOA HARIAN 🔥 (ala Duolingo) + achievements 🏆.
// Dulu "login streak"; sekarang tercatat saat konfirmasi doa pagi (Bapa Kami
// + Revive) di lock screen Home. Disimpan di SATU dokumen kecil:
// users/{uid}/app/login (nama doc dipertahankan agar streak lama tidak hilang).
// Achievement dihitung dari data yang sudah ada — tanpa read tambahan besar.

export type LoginStreak = {
  count: number; // streak berjalan
  lastDayId: string; // "YYYY-MM-DD" doa terakhir
  best: number; // streak terbaik sepanjang masa
  total: number; // total hari pernah berdoa
};

export function subscribeLoginStreak(
  uid: string,
  onChange: (streak: LoginStreak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'app', 'login');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as LoginStreak) : null);
    },
    onError,
  );
}

/**
 * "Hari doa" berganti TEPAT jam 00.00 — sama dengan hari di seluruh app.
 *
 * Dulu batasnya jam 04.00: sebelum jam 4 masih dihitung hari kemarin, supaya
 * doa subuh bisa dianggap menutup hari sebelumnya. Tapi akibatnya gerbang doa
 * pagi TIDAK muncul antara 00.00–04.00 — hari kemarin masih terbaca "sudah
 * berdoa", jadi lewat tengah malam app terbuka seperti biasa seolah harinya
 * belum berganti. Padahal jam 00.00 memang hari baru: ceklis kebiasaan, tab
 * sesi, dan seluruh dokumen harian sudah ikut berganti di jam itu.
 *
 * Sekarang batasnya disamakan. Konsekuensinya disengaja: berdoa jam 01.00
 * terhitung untuk hari yang BARU, bukan menambal hari kemarin — dan yang
 * kemarin memang sudah lewat.
 */
function prayerDayId(now: Date): string {
  return dayDocId(now);
}

/** Apakah doa hari ini sudah dikonfirmasi? */
export function prayerDoneToday(
  streak: LoginStreak | null,
  now: Date,
): boolean {
  return streak?.lastDayId === prayerDayId(now);
}

// Batas waktu menyelesaikan doa pagi (Bapa Kami + Revive). Lewat jam ini &
// belum selesai → streak hangus dan gerbang pagi tidak lagi dipaksakan.
export const PRAYER_DEADLINE_HOUR = 9;

/** Sisa menit sampai jendela doa pagi tutup. ≤ 0 = sudah lewat. */
export function prayerMinutesLeft(now: Date): number {
  return PRAYER_DEADLINE_HOUR * 60 - (now.getHours() * 60 + now.getMinutes());
}

/** Sudah lewat jam 09.00 setempat? (jendela doa pagi habis) */
export function prayerDeadlinePassed(now: Date): boolean {
  return prayerMinutesLeft(now) <= 0;
}

// Ingatan sesaat DI HP INI: hari doa yang barusan dikonfirmasi/dilewati.
//
// Menulis ke Firestore perlu sepersekian detik sebelum kembali sebagai
// snapshot. Tanpa ingatan ini, Home & pengawal sempat membaca data LAMA lalu
// menarik balik ke gerbang — itulah sebabnya dulu harus konfirmasi dua kali.
// Cukup di memori: sesudah app dimulai ulang, dokumen Firestore-nya sudah
// menjadi sumber yang benar.
let handledDayId: string | null = null;

/** Panggil TEPAT SEBELUM pindah halaman sesudah konfirmasi / lewati. */
export function markPrayerHandled(now: Date) {
  handledDayId = prayerDayId(now);
}

/**
 * Gerbang doa pagi masih perlu ditampilkan sekarang? Ini SATU-SATUNYA
 * penentunya — dipakai pengawal, layar Home, dan layar gerbangnya sendiri,
 * supaya ketiganya mustahil berbeda pendapat.
 *
 * Tidak perlu ditampilkan kalau salah satu benar:
 *   • sudah lewat jam 09.00 (hari ini dianggap terlewat),
 *   • barusan dikonfirmasi di HP ini (belum sempat balik dari server),
 *   • sudah dikonfirmasi — dari HP mana pun (dibaca langsung dari Firestore).
 */
export function prayerGateDue(streak: LoginStreak | null, now: Date): boolean {
  if (prayerDeadlinePassed(now)) return false;
  if (handledDayId === prayerDayId(now)) return false;
  return !prayerDoneToday(streak, now);
}

/**
 * Hanguskan streak doa (count → 0) karena melewatkan jendela pagi. Rekor
 * (best) & total hari tetap disimpan — yang hilang hanya streak berjalan.
 */
export function resetPrayerStreak(uid: string, current: LoginStreak) {
  if (current.count === 0) return Promise.resolve(); // sudah 0, tak perlu tulis
  return setDoc(doc(db, 'users', uid, 'app', 'login'), {
    ...current,
    count: 0,
  });
}

/**
 * Catat doa pagi hari ini — dipanggil saat konfirmasi di lock screen,
 * maksimal menulis 1×/hari (kalau lastDayId sudah hari ini, no-op).
 */
export function recordDailyPrayer(
  uid: string,
  current: LoginStreak | null,
  now: Date,
) {
  const today = prayerDayId(now);
  if (alreadyCounted(current, today)) return Promise.resolve();
  const yesterday = prayerDayId(new Date(now.getTime() - 86_400_000));
  return setDoc(
    doc(db, 'users', uid, 'app', 'login'),
    nextStreak(current, today, yesterday),
  );
}

/**
 * Lewati doa pagi (keadaan mendesak): streak berjalan HANGUS (count → 0), tapi
 * hari ini ditandai "sudah ditangani" (lastDayId = hari ini) supaya lock screen
 * tidak muncul lagi hari ini. best & total tidak berubah (tidak dihitung berdoa).
 */
export function skipDailyPrayer(
  uid: string,
  current: LoginStreak | null,
  now: Date,
) {
  return setDoc(doc(db, 'users', uid, 'app', 'login'), {
    count: 0,
    lastDayId: prayerDayId(now),
    best: current?.best ?? 0,
    total: current?.total ?? 0,
  });
}

// ============================ Achievements ============================

// Sengaja TIDAK menyimpan "total seumur hidup" untuk doa & baca Alkitab —
// yang memotivasi adalah streaknya, bukan angka berapa kali pernah berdoa.
export type AchievementStats = {
  loginCount: number; // streak doa pagi berjalan
  loginBest: number; // rekor streak doa pagi
  habitStreak: number; // streak kebiasaan Health 🔥
  bibleMorningBest: number; // streak terbaik baca pagi 🌅
  bibleDaytimeBest: number; // streak terbaik baca siang 🌤️
  bibleNightBest: number; // streak terbaik baca malam 🌙
  learningWeekBest: number; // rekor MINGGU beruntun target Learning tuntas 🎓
  fitTotal: number; // total sesi gym selesai
  fitBest: number; // rekor sesi gym beruntun (5 sesi = 1 minggu penuh)
  bestSteps: number; // rekor langkah terbanyak dalam sehari
  stepTierLastDate: Record<number, string | null>; // tier → dayId terakhir tercapai
  weekStepHits: number; // minggu yang langkahnya tembus target aerobik
  weekGymHits: number; // minggu dengan strength training ≥ 2 hari
  weekBothHits: number; // minggu SEMPURNA (aerobik + strength dua-duanya)
  bestDayKm: number; // rekor jarak dalam SEHARI (km)
  bestWeekKm: number; // rekor jarak satu MINGGU (Senin–Minggu)
  bestMonthKm: number; // rekor jarak satu BULAN
  waterCount: number; // streak air putih 💧 yang sedang berjalan
  waterBest: number; // rekor hari beruntun cukup 8 gelas
  waterTotal: number; // total hari pernah cukup 8 gelas
};

// Kategori pencapaian (ala Duolingo) — tiap kategori punya daftar
// pencapaian bertingkat yang tampil di modal saat ditekan.
export type AchievementCategoryKey =
  | 'login'
  | 'health'
  | 'bibleMorning'
  | 'bibleDaytime'
  | 'bibleNight'
  | 'fitness'
  | 'steps'
  | 'run'
  | 'week'
  | 'water'
  | 'learning';

/** Angka km untuk tampilan achievement: 21.1 → "21,1". */
function km(n: number): string {
  const s = n.toFixed(1);
  return (s.endsWith('.0') ? s.slice(0, -2) : s).replace('.', ',');
}

// URUTANNYA MENGIKUTI GRID HOME (lihat `sorted` di bawah): kategori milik
// fitur yang tile-nya lebih atas di Home tampil lebih dulu. Jadi Spiritual
// (tile ke-2) selalu di atas Fitness (tile ke-7), tanpa perlu diurutkan
// tangan tiap ada kategori baru. `feature` = kunci tile-nya di lib/homeGrid.
const CATEGORIES: {
  key: AchievementCategoryKey;
  /** Kunci fitur di grid Home — penentu urutan tampilnya. */
  feature: string;
  icon: string;
  label: string;
  desc: string;
  /**
   * Angka SEKARANG kategori ini — yang dipampang di pojok kanan atas modalnya.
   *
   * Ditulis satu per satu, BUKAN ditebak dari daftar lencananya, karena satu
   * kategori bisa memuat beberapa ukuran berbeda: Fitness punya total sesi DAN
   * rekor beruntun; Jarak Tempuh punya rekor harian, mingguan & bulanan.
   * Menebak "ukuran utamanya" berarti memilih diam-diam salah satu — dan angka
   * besar di pojok atas yang ternyata mengukur hal lain lebih menyesatkan
   * daripada tidak ada angka sama sekali.
   */
  now: (s: AchievementStats) => number;
  /** Satuan di belakang angkanya, mis. "hari beruntun". */
  unit: string;
  /** Angkanya perlu bentuk khusus? (mis. km 1 desimal) */
  fmt?: (n: number) => string;
}[] = [
  { key: 'login', feature: 'spiritual', icon: '🙏', label: 'Doa Pagi', desc: 'Streak doa pagi di gerbang pagi', now: (s) => s.loginCount, unit: 'hari beruntun' },
  { key: 'bibleMorning', feature: 'spiritual', icon: DAYPART.morning, label: 'Alkitab Pagi', desc: 'Streak baca Alkitab pagi', now: (s) => s.bibleMorningBest, unit: 'hari beruntun' },
  { key: 'bibleDaytime', feature: 'spiritual', icon: DAYPART.daytime, label: 'Alkitab Siang', desc: 'Streak baca Alkitab siang', now: (s) => s.bibleDaytimeBest, unit: 'hari beruntun' },
  { key: 'bibleNight', feature: 'spiritual', icon: DAYPART.night, label: 'Alkitab Malam', desc: 'Streak baca Alkitab malam', now: (s) => s.bibleNightBest, unit: 'hari beruntun' },
  { key: 'health', feature: 'health', icon: '🍎', label: 'Kebiasaan Sehat', desc: 'Streak habit setiap hari', now: (s) => s.habitStreak, unit: 'hari beruntun' },
  { key: 'steps', feature: 'health', icon: '👣', label: 'Langkah Harian', desc: 'Rekor jumlah langkah dalam sehari', now: (s) => s.bestSteps, unit: 'langkah (rekor sehari)' },
  { key: 'run', feature: 'health', icon: '🏃', label: 'Jarak Tempuh', desc: 'Patokan pelari — harian, mingguan & bulanan', now: (s) => s.bestDayKm, unit: 'km (rekor sehari)', fmt: km },
  // Dulu SATU kategori "Target Mingguan" berisi langkah & angkat beban
  // sekaligus — dan itu membuat daftarnya sulit dibaca: dua ladder yang
  // kemajuannya sama sekali tidak berhubungan berselang-seling di satu kolom.
  // Sekarang dipisah supaya tiap ladder punya kolomnya sendiri.
  //
  // "Minggu Sempurna" (aerobik & strength dua-duanya) tetap di kolom LANGKAH:
  // ia diukur atas MINGGU-nya sebagai satu satuan, dan menaruhnya di kolom
  // strength akan membuat kolom itu tidak lagi murni soal angkat beban.
  { key: 'week', feature: 'health', icon: '👣', label: 'Target Langkah Mingguan', desc: 'Tembus target langkah tiap pekan', now: (s) => s.weekStepHits, unit: 'pekan tembus target' },
  { key: 'water', feature: 'health', icon: '💧', label: 'Air Putih', desc: 'Cukup 8 gelas air setiap hari', now: (s) => s.waterCount, unit: 'hari beruntun' },
  { key: 'learning', feature: 'learning', icon: '🎓', label: 'Learning', desc: 'Minggu beruntun 4 langkah belajar tuntas', now: (s) => s.learningWeekBest, unit: 'pekan beruntun' },
  // Dulu DUA baris terpisah dengan lambang 🏋️ yang sama: "Strength Training"
  // (minggu dengan angkat beban ≥2 hari) & "Fitness Konsisten" (jumlah sesi
  // latihan). Ukurannya memang beda, tapi keduanya menghitung hal yang sama —
  // latihan di fitur Fitness — dan berdiri berdampingan keduanya cuma bikin
  // bingung "bedanya apa". Digabung jadi satu kolom; TIDAK ADA lencana yang
  // hilang, ketiga lencana mingguannya cuma pindah ke sini.
  { key: 'fitness', feature: 'fitness', icon: '🏋️', label: 'Fitness', desc: 'Sesi latihan & angkat beban 2 hari/minggu', now: (s) => s.fitTotal, unit: 'sesi selesai' },
];

/**
 * Sesi baca Alkitab → kategori pencapaiannya. Dipakai tombol 🔥 di layar
 * Bacaan Alkitab & tab Bible Reading, supaya modal yang terbuka adalah sesi
 * yang sedang dilihat — bukan daftar semua kategori.
 *
 * Kuncinya sengaja ditulis apa adanya (bukan `import type { BibleSession }`)
 * agar lib/achievements tidak perlu bergantung pada lib/spiritual.
 */
export const BIBLE_CATEGORY: Record<
  'morning' | 'daytime' | 'night',
  AchievementCategoryKey
> = {
  morning: 'bibleMorning',
  daytime: 'bibleDaytime',
  night: 'bibleNight',
};

/**
 * Kategori siap tampil — sudah diurutkan mengikuti grid Home. Kategori dengan
 * fitur yang sama tetap berurutan seperti ditulis di atas (Array.sort di JS
 * stabil), jadi Alkitab Pagi → Siang → Malam tidak pernah tertukar.
 */
/**
 * Angka SEKARANG satu kategori, siap tampil: mis. "12 hari beruntun".
 *
 * Dipakai pojok kanan atas modal kategori — supaya "sudah sampai berapa
 * sekarang?" terjawab tanpa harus menghitung sendiri dari deretan lencana yang
 * setengah terbuka.
 */
export function categoryNow(
  key: AchievementCategoryKey,
  stats: AchievementStats,
): { value: number; text: string } | null {
  const cat = CATEGORIES.find((c) => c.key === key);
  if (!cat) return null;
  const value = cat.now(stats);
  return { value, text: `${cat.fmt ? cat.fmt(value) : value} ${cat.unit}` };
}

export const ACHIEVEMENT_CATEGORIES = [...CATEGORIES].sort(
  (a, b) => homeFeatureIndex(a.feature) - homeFeatureIndex(b.feature),
);

/**
 * Kunci kategori dari parameter URL — dipakai layar Achievement untuk langsung
 * membuka modal yang dimaksud (mis. pil 🔥 di Habits → Kebiasaan Sehat).
 *
 * Apa pun yang tidak dikenal (kosong, salah tulis, kategori yang sudah dihapus)
 * jatuh ke null = layarnya terbuka biasa tanpa modal. Jadi tautan lama tidak
 * pernah membuat layarnya gagal.
 */
export function achievementCategoryOf(
  key: string | undefined,
): AchievementCategoryKey | null {
  return CATEGORIES.some((c) => c.key === key)
    ? (key as AchievementCategoryKey)
    : null;
}

/** Detail "terakhir tercapai kapan" untuk achievement langkah (null bila belum). */
function stepDetail(s: AchievementStats, tier: number): string | null {
  const d = s.stepTierLastDate[tier];
  return d ? `📅 Terakhir tercapai ${formatShortDayDate(dayIdToDate(d))}` : null;
}

type Achievement = {
  id: string;
  category: AchievementCategoryKey;
  icon: string;
  title: string;
  desc: string;
  target: number;
  of: (s: AchievementStats) => number; // nilai saat ini untuk progress
  detail?: (s: AchievementStats) => string | null; // baris ekstra (mis. tanggal)
  fmt?: (n: number) => string; // tampilan angka (mis. km pakai 1 desimal)
};

// Tangga level streak harian — dipakai bersama oleh doa pagi 🙏, Alkitab
// pagi 🌅 & Alkitab malam 🌙 supaya perayaannya seragam sampai SETAHUN penuh.
const STREAK_LEVELS: { days: number; icon: string; title: string }[] = [
  { days: 1, icon: '🐣', title: 'Langkah Pertama' },
  { days: 3, icon: '✨', title: 'Konsisten 3 Hari' },
  { days: 7, icon: '🔥', title: 'Seminggu Penuh' },
  { days: 14, icon: '⚡', title: 'Dua Minggu Membara' },
  { days: 30, icon: '🏅', title: 'Sebulan Tanpa Putus' },
  { days: 60, icon: '🌟', title: 'Dua Bulan Setia' },
  { days: 100, icon: '👑', title: 'Legenda 100 Hari' },
  { days: 180, icon: '💎', title: 'Setengah Tahun' },
  { days: 365, icon: '🏆', title: 'Setahun Penuh' },
];

// Tangga level streak MINGGUAN — khusus Learning 🎓, yang targetnya memang
// per minggu. Berhenti di 52 = setahun penuh tanpa satu minggu pun bolong.
const LEARNING_WEEK_LEVELS: { weeks: number; icon: string; title: string }[] = [
  { weeks: 1, icon: '🐣', title: 'Minggu Pertama' },
  { weeks: 2, icon: '✨', title: 'Dua Minggu Beruntun' },
  { weeks: 4, icon: '🔥', title: 'Sebulan Beruntun' },
  { weeks: 8, icon: '⚡', title: 'Dua Bulan Beruntun' },
  { weeks: 12, icon: '🏅', title: 'Sekuartal Beruntun' },
  { weeks: 26, icon: '💎', title: 'Setengah Tahun' },
  { weeks: 52, icon: '🏆', title: 'Setahun Penuh' },
];

/** Bangun satu tangga level lengkap untuk sebuah streak harian. */
function streakLadder(
  category: AchievementCategoryKey,
  prefix: string,
  action: string, // mis. "Berdoa pagi" / "Baca Alkitab pagi"
  of: (s: AchievementStats) => number,
): Achievement[] {
  return STREAK_LEVELS.map((l) => ({
    id: `${prefix}${l.days}`,
    category,
    icon: l.icon,
    title: l.title,
    desc:
      l.days === 1
        ? `${action} untuk pertama kali`
        : `${action} ${l.days} hari beruntun`,
    target: l.days,
    of,
  }));
}

export const ACHIEVEMENTS: Achievement[] = [
  ...streakLadder('login', 'login', 'Berdoa pagi', (s) => s.loginBest),
  { id: 'habit3', category: 'health', icon: '💪', title: 'Habit on Track', desc: 'Streak kebiasaan baik 3 hari', target: 3, of: (s) => s.habitStreak },
  { id: 'habit7', category: 'health', icon: '🧘', title: 'Gaya Hidup Sehat', desc: 'Streak kebiasaan baik 7 hari', target: 7, of: (s) => s.habitStreak },
  { id: 'habit21', category: 'health', icon: '🔥', title: 'Sudah sehat', desc: 'Streak kebiasaan baik 21 hari', target: 21, of: (s) => s.habitStreak },
  // Kategori "Revive Rohani" DIHAPUS — pemicunya sama saja dengan Doa Pagi
  // (Revive memang langkah 1 di gerbang pagi), jadi dulu satu perbuatan
  // menghasilkan dua pencapaian. Streak Revive 🔥 sendiri tetap ada & tetap
  // tampil di fitur Revive; yang dibuang cuma lencananya.
  ...streakLadder('bibleMorning', 'bibleMorning', 'Baca Alkitab pagi', (s) => s.bibleMorningBest),
  ...streakLadder('bibleDaytime', 'bibleDaytime', 'Baca Alkitab siang', (s) => s.bibleDaytimeBest),
  ...streakLadder('bibleNight', 'bibleNight', 'Baca Alkitab malam', (s) => s.bibleNightBest),
  // Learning 🎓 dihitung per MINGGU, bukan per hari — targetnya sendiri memang
  // mingguan (4 langkah kecil Senin/Rabu/Jumat/Minggu). Angkanya = berapa
  // minggu BERTURUT-TURUT keempat langkah itu tuntas.
  ...LEARNING_WEEK_LEVELS.map((l) => ({
    id: `learn${l.weeks}`,
    category: 'learning' as const,
    icon: l.icon,
    title: l.title,
    desc:
      l.weeks === 1
        ? 'Tuntaskan 4 langkah dalam satu minggu'
        : `${l.weeks} minggu beruntun target Learning tuntas`,
    target: l.weeks,
    of: (s: AchievementStats) => s.learningWeekBest,
  })),
  { id: 'fit1', category: 'fitness', icon: '🐣', title: 'Sesi Pertama', desc: 'Selesaikan satu sesi gym penuh', target: 1, of: (s) => s.fitTotal },
  { id: 'fitWeek1', category: 'fitness', icon: '✨', title: 'Seminggu Penuh', desc: '5 sesi beruntun tanpa bolos', target: 5, of: (s) => s.fitBest },
  { id: 'fit10', category: 'fitness', icon: '💪', title: '10 Sesi', desc: 'Total 10 sesi gym selesai', target: 10, of: (s) => s.fitTotal },
  { id: 'fitWeek2', category: 'fitness', icon: '🔥', title: 'Dua Minggu Membara', desc: '10 sesi beruntun tanpa bolos', target: 10, of: (s) => s.fitBest },
  { id: 'fitMonth', category: 'fitness', icon: '👑', title: 'Sebulan Tanpa Bolos', desc: '20 sesi beruntun tanpa bolos', target: 20, of: (s) => s.fitBest },
  { id: 'fit50', category: 'fitness', icon: '🏅', title: '50 Sesi', desc: 'Total 50 sesi gym selesai', target: 50, of: (s) => s.fitTotal },
  { id: 'fit100', category: 'fitness', icon: '💎', title: '100 Sesi', desc: 'Total 100 sesi gym selesai', target: 100, of: (s) => s.fitTotal },
  { id: 'steps20k', category: 'steps', icon: '👟', title: '20 Ribu Langkah', desc: 'Pernah jalan ≥ 20.000 langkah dalam sehari', target: 20000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 20000) },
  { id: 'steps30k', category: 'steps', icon: '🎖️', title: '30 Ribu Langkah', desc: 'Pernah jalan ≥ 30.000 langkah dalam sehari', target: 30000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 30000) },
  { id: 'steps40k', category: 'steps', icon: '🏅', title: '40 Ribu Langkah', desc: 'Pernah jalan ≥ 40.000 langkah dalam sehari', target: 40000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 40000) },
  { id: 'steps50k', category: 'steps', icon: '🥇', title: '50 Ribu Langkah', desc: 'Pernah jalan ≥ 50.000 langkah dalam sehari', target: 50000, of: (s) => s.bestSteps, detail: (s) => stepDetail(s, 50000) },
  // Jarak tempuh 🏃 — istilah yang dipakai pelari, dihitung dari langkah
  // Apple Health × panjang langkah (lihat lib/health → RUN_*_MILESTONES).
  { id: 'runShakeout', category: 'run', icon: '🚶', title: 'Shakeout', desc: 'Tempuh 3 km dalam sehari', target: 3, of: (s) => s.bestDayKm, fmt: km },
  { id: 'run5k', category: 'run', icon: '🏃', title: 'Easy Run · 5K', desc: 'Tempuh 5 km dalam sehari', target: 5, of: (s) => s.bestDayKm, fmt: km },
  { id: 'run10k', category: 'run', icon: '⚡', title: 'Tempo Run · 10K', desc: 'Tempuh 10 km dalam sehari', target: 10, of: (s) => s.bestDayKm, fmt: km },
  { id: 'run15k', category: 'run', icon: '🔥', title: 'Long Run · 15K', desc: 'Tempuh 15 km dalam sehari', target: 15, of: (s) => s.bestDayKm, fmt: km },
  { id: 'runHalf', category: 'run', icon: '🏅', title: 'Half Marathon', desc: 'Tempuh 21,1 km dalam sehari', target: 21.1, of: (s) => s.bestDayKm, fmt: km },
  { id: 'runFull', category: 'run', icon: '👑', title: 'Full Marathon', desc: 'Tempuh 42,2 km dalam sehari', target: 42.2, of: (s) => s.bestDayKm, fmt: km },
  { id: 'runWeekBase', category: 'run', icon: '✨', title: 'Base Week', desc: 'Total 21,1 km dalam sepekan (Sen–Min)', target: 21.1, of: (s) => s.bestWeekKm, fmt: km },
  { id: 'runWeekMarathon', category: 'run', icon: '🔥', title: 'Marathon Week', desc: 'Total 42,2 km dalam sepekan', target: 42.2, of: (s) => s.bestWeekKm, fmt: km },
  { id: 'runWeekPeak', category: 'run', icon: '🏅', title: 'Peak Week', desc: 'Total 70 km dalam sepekan', target: 70, of: (s) => s.bestWeekKm, fmt: km },
  { id: 'runWeek100', category: 'run', icon: '👑', title: 'Century Week', desc: 'Total 100 km dalam sepekan', target: 100, of: (s) => s.bestWeekKm, fmt: km },
  { id: 'runMonth100', category: 'run', icon: '🎽', title: '100K Bulanan', desc: 'Total 100 km dalam sebulan', target: 100, of: (s) => s.bestMonthKm, fmt: km },
  { id: 'runMonth200', category: 'run', icon: '🏆', title: '200K Bulanan', desc: 'Total 200 km dalam sebulan', target: 200, of: (s) => s.bestMonthKm, fmt: km },
  { id: 'runMonth300', category: 'run', icon: '💎', title: '300K Bulanan', desc: 'Total 300 km dalam sebulan', target: 300, of: (s) => s.bestMonthKm, fmt: km },
  // Target mingguan 📅 — mengikuti anjuran kesehatan dewasa: ±150 menit
  // aerobik sedang (≈70.000 langkah) + strength training minimal 2 hari.
  { id: 'weekStep1', category: 'week', icon: '🚶', title: 'Minggu Aktif', desc: 'Tembus target langkah dalam sepekan', target: 1, of: (s) => s.weekStepHits },
  { id: 'weekStep4', category: 'week', icon: '✨', title: 'Sebulan Aktif', desc: '4 minggu tembus target langkah', target: 4, of: (s) => s.weekStepHits },
  { id: 'weekStep12', category: 'week', icon: '🏅', title: 'Sekuartal Aktif', desc: '12 minggu tembus target langkah', target: 12, of: (s) => s.weekStepHits },
  { id: 'weekGym1', category: 'fitness', icon: '🏋️', title: 'Strength 2×', desc: 'Strength training 2 hari dalam sepekan', target: 1, of: (s) => s.weekGymHits },
  { id: 'weekGym4', category: 'fitness', icon: '💪', title: 'Sebulan Kuat', desc: '4 minggu strength training 2 hari', target: 4, of: (s) => s.weekGymHits },
  { id: 'weekGym12', category: 'fitness', icon: '🔥', title: 'Sekuartal Kuat', desc: '12 minggu strength training 2 hari', target: 12, of: (s) => s.weekGymHits },
  { id: 'weekBoth1', category: 'week', icon: '⭐', title: 'Minggu Sempurna', desc: 'Aerobik & strength tercapai dalam sepekan', target: 1, of: (s) => s.weekBothHits },
  { id: 'weekBoth4', category: 'week', icon: '👑', title: 'Sebulan Sempurna', desc: '4 minggu sempurna', target: 4, of: (s) => s.weekBothHits },
  { id: 'weekBoth12', category: 'week', icon: '💎', title: 'Sekuartal Sempurna', desc: '12 minggu sempurna', target: 12, of: (s) => s.weekBothHits },
  { id: 'water1', category: 'water', icon: '💧', title: 'Gelas ke-8 Pertama', desc: 'Cukup 8 gelas air dalam sehari', target: 1, of: (s) => s.waterTotal },
  { id: 'water3', category: 'water', icon: '✨', title: 'Tiga Hari Segar', desc: 'Cukup 8 gelas 3 hari beruntun', target: 3, of: (s) => s.waterBest },
  { id: 'water7', category: 'water', icon: '🌊', title: 'Seminggu Terhidrasi', desc: 'Cukup 8 gelas 7 hari beruntun', target: 7, of: (s) => s.waterBest },
  { id: 'water14', category: 'water', icon: '⚡', title: 'Dua Minggu Lancar', desc: 'Cukup 8 gelas 14 hari beruntun', target: 14, of: (s) => s.waterBest },
  { id: 'water30', category: 'water', icon: '👑', title: 'Sebulan Tanpa Bolong', desc: 'Cukup 8 gelas 30 hari beruntun', target: 30, of: (s) => s.waterBest },
  { id: 'water100', category: 'water', icon: '💎', title: '100 Hari Cukup Air', desc: 'Total 100 hari cukup 8 gelas', target: 100, of: (s) => s.waterTotal },
];

// ============================ Self-Reward 🏆 ============================
// Hadiah untuk diri sendiri — dananya dari Saku "Self-Reward".
//
// Daftar hadiahnya sendiri sekarang milikmu & tersimpan di Firestore, lihat
// lib/selfReward.ts. Yang tinggal di sini cuma saldo sakunya.

/** Dengarkan saldo Saku Self-Reward (1 dokumen, bukan seluruh funds). */
export function subscribeSelfRewardBalance(
  uid: string,
  onChange: (balance: number) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'funds', 'self-reward');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.balance as number) ?? 0);
    },
    onError,
  );
}

// ===================== Reset semua progres achievement =====================
// Semua achievement dihitung dari dokumen streak/rekor di bawah ini. Menghapus
// dokumennya = semua pencapaian kembali 0 (hard delete, tak ada arsip).
//
// SENGAJA TIDAK ikut dihapus:
// - funds/self-reward → itu saldo uang beneran di Finance, bukan pencapaian.
// - Catatan harian (Revive, bacaan Alkitab, habit, sesi gym) → yang direset
//   hitungan streak-nya saja, isinya tetap aman.
//
// app/revive TETAP ikut dihapus walau kategori "Revive Rohani" sudah dibuang:
// streak Revive 🔥 masih tampil di fitur Revive, dan tombol ini menjanjikan
// "semua streak kembali ke 0" — jadi ia harus benar-benar ikut nol.
const ACHIEVEMENT_DOCS: [collection: string, id: string][] = [
  ['app', 'login'], // streak doa pagi 🙏
  ['app', 'revive'], // streak Revive 📖 (bukan achievement lagi, tetap direset)
  ['app', 'bibleStreak'], // streak baca Alkitab 📚
  ['app', 'learningStreak'], // streak MINGGUAN Learning 🎓
  ['app', 'fitnessStreak'], // streak gym 🏋️
  ['app', 'waterStreak'], // streak air putih 💧
  ['health', 'streak'], // streak kebiasaan harian ✅
  ['health', 'steps'], // rekor langkah 👣 (lihat catatan di bawah)
  ['health', 'weeks'], // rekap mingguan 📅 (langkah + strength training)
];

/**
 * Kembalikan SEMUA achievement ke 0 — permanen, tidak bisa dibatalkan.
 *
 * Catatan langkah 👣: dokumen `health/steps` diisi ulang otomatis dari riwayat
 * Apple Health tiap layar Steps dibuka, jadi rekor langkah bisa muncul lagi
 * setelah reset. Itu memang datanya ada di iPhone, bukan dibuat app ini.
 */
export function resetAchievements(uid: string) {
  const batch = writeBatch(db);
  for (const [col, id] of ACHIEVEMENT_DOCS) {
    batch.delete(doc(db, 'users', uid, col, id));
  }
  return batch.commit();
}
