import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Kebiasaan (habit) harian dibagi 3 sesi waktu (Pagi/Siang/Malam). SATU daftar
// kebiasaan dipakai untuk SEMUA hari (sama tiap hari — biar simple). Disimpan di
// dokumen users/{uid}/health/habitSchedule (field `habits`). Centang harian
// tetap memakai health habitDays/{YYYY-MM-DD}.done (keyed by id kebiasaan).

export type HabitSlot = 'morning' | 'daytime' | 'night';

export const HABIT_SLOTS: { key: HabitSlot; label: string; emoji: string }[] = [
  { key: 'morning', label: 'Pagi', emoji: '🌅' },
  { key: 'daytime', label: 'Siang', emoji: '🌤️' },
  { key: 'night', label: 'Malam', emoji: '🌙' },
];

export function slotMeta(slot: HabitSlot) {
  return HABIT_SLOTS.find((s) => s.key === slot)!;
}

// ===================== Area & tingkat kepentingan =====================
// Kesehatan bukan cuma badan. Tiap kebiasaan ditandai AREA hidup yang ia jaga
// dan TINGKAT dampaknya, supaya ukuran keberhasilan harian bukan lagi
// "berapa dari 39 yang tercentang", melainkan "apakah 5 area ini terjaga".

export type HabitArea = 'body' | 'mind' | 'spirit' | 'social' | 'recovery';

export const HABIT_AREAS: {
  key: HabitArea;
  label: string;
  emoji: string;
}[] = [
  { key: 'body', label: 'Body', emoji: '🏃' },
  { key: 'mind', label: 'Mind', emoji: '🧠' },
  { key: 'spirit', label: 'Spirit', emoji: '🙏' },
  { key: 'social', label: 'Relationship', emoji: '❤️' },
  { key: 'recovery', label: 'Recovery', emoji: '😴' },
];

export function areaMeta(area: HabitArea) {
  return HABIT_AREAS.find((a) => a.key === area)!;
}

/**
 * 🟢 core     — penentu streak & skor. Kalau cuma sempat sedikit, ini dulu.
 * 🟡 support  — menambah skor, tapi tidak menghanguskan streak.
 * ⚪ optional — bonus murni: tidak masuk hitungan skor sama sekali.
 */
export type HabitTier = 'core' | 'support' | 'optional';

export const HABIT_TIERS: {
  key: HabitTier;
  label: string;
  emoji: string;
}[] = [
  { key: 'core', label: 'Inti', emoji: '🟢' },
  { key: 'support', label: 'Pendukung', emoji: '🟡' },
  { key: 'optional', label: 'Opsional', emoji: '⚪' },
];

export function tierMeta(tier: HabitTier) {
  return HABIT_TIERS.find((t) => t.key === tier)!;
}

export type ScheduledHabit = {
  id: string;
  label: string;
  slot: HabitSlot;
  /** Kebiasaan lama belum punya ini — dianggap Body/Pendukung. */
  area?: HabitArea;
  tier?: HabitTier;
  /** true = selain dicentang, kebiasaan ini minta catatan singkat. */
  note?: boolean;
  /** Petunjuk isian saat `note` aktif, mis. "Win / Learn / Tomorrow". */
  notePrompt?: string;
};

export function habitArea(h: ScheduledHabit): HabitArea {
  return h.area ?? 'body';
}

export function habitTier(h: ScheduledHabit): HabitTier {
  return h.tier ?? 'support';
}

/**
 * Sesi waktu sekarang (untuk reminder Dashboard & tab default Habits).
 * Pagi 06:00–11:59 · Siang 12:00–17:59 · Malam ≥18:00.
 * Dini hari (<06:00) masih dihitung Malam — lanjutan malam sebelumnya.
 */
function slotNow(now: Date): HabitSlot {
  const h = now.getHours();
  if (h < 1) return 'night';
  if (h < 10) return 'morning';
  if (h < 18) return 'daytime';
  return 'night';
}

/**
 * Sesi yang WAKTUNYA SUDAH TIBA hari ini — Pagi ≥06:00, Siang ≥12:00,
 * Malam ≥18:00 (kumulatif: siang tetap membawa sisa pagi).
 *
 * Jam 00.00–05.59 sengaja KOSONG: lewat tengah malam ceklis sudah kereset ke
 * hari baru (sisa kebiasaan malam kemarin hangus), sementara sesi Pagi baru
 * mulai jam 6. Jadi di jam-jam itu memang belum ada yang perlu dikerjakan —
 * badge & kartu reminder ikut hilang.
 */
function openSlots(now: Date): HabitSlot[] {
  const h = now.getHours();
  if (h < 6) return [];
  if (h < 12) return ['morning'];
  if (h < 18) return ['morning', 'daytime'];
  return ['morning', 'daytime', 'night'];
}

/**
 * Sesi yang SEDANG berjalan sekarang — dasar kartu reminder di Dashboard.
 * null = belum ada sesi yang dibuka (jam 00.00–05.59).
 */
export function currentOpenSlot(now: Date): HabitSlot | null {
  const open = openSlots(now);
  return open.length > 0 ? open[open.length - 1] : null;
}

/**
 * Kebiasaan yang BERLAKU hari ini — yang ditandai ✗ (dilewati) dibuang.
 *
 * Satu-satunya pintu masuk untuk semua penghitung harian (skor, area, badge
 * tab Habits, kartu reminder Dashboard, hitungan tiap sesi). Yang sudah
 * sengaja dilewati bukan lagi "bolong": ia dianggap tidak berlaku hari ini,
 * jadi tidak lagi menagih dan tidak menahan skor.
 *
 * Daftar yang DITAMPILKAN di layar tetap memakai daftar lengkap — barisnya
 * masih kelihatan, cuma bertanda ⏭️.
 */
export function countedHabits(
  habits: ScheduledHabit[],
  skipped: Record<string, boolean>,
): ScheduledHabit[] {
  return habits.filter((h) => !skipped[h.id]);
}

/**
 * Kebiasaan yang sesinya sudah tiba tapi belum dicentang hari ini — dipakai
 * badge Health di Home supaya sesi yang belum waktunya tidak ikut dihitung.
 */
export function pendingHabits(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
  now: Date,
): ScheduledHabit[] {
  const open = openSlots(now);
  return habits.filter(
    (h) =>
      open.includes(h.slot) &&
      !done[h.id] &&
      // Olahraga sengaja TIDAK ikut menagih di sini — penagihannya sudah
      // dipegang fitur Fitness (badge & kartu reminder-nya sendiri). Kalau
      // ikut, satu olahraga ditagih dua kali dari dua tempat berbeda.
      h.id !== FITNESS_HABIT_ID,
  );
}

/** Semua kebiasaan (semua sesi) sudah dicentang hari ini? */
function allHabitsDone(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
): boolean {
  return habits.length > 0 && habits.every((h) => done[h.id]);
}

// ===================== Skor & streak =====================
// Streak TIDAK lagi menuntut seluruh kebiasaan tercentang (dengan 39 kebiasaan
// itu praktis mustahil, dan rentetannya jadi selalu 0). Yang menentukan cuma
// kebiasaan 🟢 Inti; pendukung & opsional murni bonus.

function coreHabits(habits: ScheduledHabit[]): ScheduledHabit[] {
  return habits.filter((h) => habitTier(h) === 'core');
}

/** Semua kebiasaan Inti hari ini sudah beres? → penentu naiknya streak 🔥 */
export function coreDone(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
): boolean {
  const core = coreHabits(habits);
  return core.length > 0 && core.every((h) => done[h.id]);
}

/**
 * Skor harian 0–10 — HANYA dari kebiasaan 🟢 Inti.
 * 🟡 Pendukung & ⚪ Opsional sengaja tidak ikut dihitung supaya skor ini
 * menjawab satu pertanyaan saja: "yang wajib hari ini sudah beres belum?"
 * Efeknya 10/10 selalu sama artinya dengan naiknya streak 🔥 (`coreDone`).
 */
export function dailyScore(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
): number {
  const core = coreHabits(habits);
  if (core.length === 0) return 0;
  const ratio = core.filter((h) => done[h.id]).length / core.length;
  // Angka 10 disimpan khusus untuk yang benar-benar beres semua — tanpa ini
  // pembulatan bisa menampilkan "10/10" padahal masih ada satu yang bolong.
  return ratio === 1 ? 10 : Math.min(9, Math.round(ratio * 10));
}

export type AreaProgress = {
  area: HabitArea;
  coreDone: number;
  coreTotal: number;
  done: number; // termasuk pendukung (opsional tidak dihitung)
  total: number;
  kept: boolean; // semua kebiasaan Inti area ini beres
};

/**
 * Rekap per area untuk hari ini. Area tanpa kebiasaan Inti dianggap terjaga
 * begitu minimal satu kebiasaannya dilakukan.
 */
export function areaProgress(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
): AreaProgress[] {
  return HABIT_AREAS.map(({ key }) => {
    const inArea = habits.filter(
      (h) => habitArea(h) === key && habitTier(h) !== 'optional',
    );
    const core = inArea.filter((h) => habitTier(h) === 'core');
    const coreDoneCount = core.filter((h) => done[h.id]).length;
    const doneCount = inArea.filter((h) => done[h.id]).length;
    return {
      area: key,
      coreDone: coreDoneCount,
      coreTotal: core.length,
      done: doneCount,
      total: inArea.length,
      kept:
        core.length > 0
          ? coreDoneCount === core.length
          : inArea.length > 0 && doneCount > 0,
    };
  });
}

/**
 * Sesi yang dibuka pertama kali di tab Habits: mengikuti jam sekarang —
 * KECUALI kalau semua kebiasaan hari ini sudah beres. Kalau sudah beres tidak
 * ada lagi yang perlu dikerjakan, jadi mulai dari Pagi biar enak dibaca dari
 * awal hari.
 *
 * Beda dengan `slotNow`: jam 00.00–00.59 di sini dihitung PAGI hari baru, bukan
 * lanjutan malam kemarin. Alasannya lewat tengah malam ceklis harian memang
 * sudah kereset ke hari berikutnya, jadi tab pembukanya harus ikut balik ke
 * Pagi. (`slotNow` tetap apa adanya — dipakai kartu reminder Dashboard.)
 */
export function defaultSlot(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
  now: Date,
): HabitSlot {
  if (allHabitsDone(habits, done)) return 'morning';
  return now.getHours() < 1 ? 'morning' : slotNow(now);
}

/** ID unik untuk kebiasaan baru yang dibuat pengguna. */
export function newHabitId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ===================== Penata otomatis =====================
// Menebak area & tingkat dari NAMA kebiasaan, supaya 39 kebiasaan yang sudah
// ada tidak perlu ditandai satu-satu. Urutan aturan penting: yang paling
// spesifik (dan yang Opsional) diperiksa duluan.
//
// Hasil tebakan boleh salah — tinggal dibetulkan lewat modal ubah kebiasaan.

const CLASSIFY_RULES: {
  match: RegExp;
  area: HabitArea;
  tier: HabitTier;
}[] = [
  // ⚪ Opsional — enak dilakukan, tapi bukan penentu kesehatan.
  { match: /cotton|korek kuping/i, area: 'body', tier: 'optional' },
  { match: /castor/i, area: 'body', tier: 'optional' },
  { match: /cider|cuka apel|\bacv\b/i, area: 'body', tier: 'optional' },
  { match: /honey|madu/i, area: 'body', tier: 'optional' },
  { match: /(cold|dingin).*(face|wajah|muka)|soak face/i, area: 'body', tier: 'optional' },
  { match: /warm water|air hangat/i, area: 'body', tier: 'optional' },
  // 😴 Recovery
  { match: /wake ?up|bangun/i, area: 'recovery', tier: 'core' },
  { match: /sleep|tidur|phone away|wind ?down|jauhkan hp|matikan hp/i, area: 'recovery', tier: 'core' },
  { match: /prepare|persiap|siapkan|besok|tomorrow/i, area: 'recovery', tier: 'support' },
  // 🙏 Spirit
  { match: /communion|perjamuan/i, area: 'spirit', tier: 'core' },
  { match: /bible|alkitab|revive|renungan|khotbah|sermon|\bdoa\b|pray|firman|rhema|syukur|gratitude/i, area: 'spirit', tier: 'core' },
  { match: /share|ig story|instagram|whatsapp|\bwa\b/i, area: 'spirit', tier: 'support' },
  // ❤️ Relationship
  { match: /encourage|semangati|bless|memberkati|follow ?up|kabari|hubungi/i, area: 'social', tier: 'core' },
  // 🧠 Mind
  { match: /plan|prioritas|priorit/i, area: 'mind', tier: 'core' },
  { match: /reflect|refleksi|journal|jurnal/i, area: 'mind', tier: 'core' },
  { match: /news|berita|duolingo|belajar|learn|reading the|baca buku/i, area: 'mind', tier: 'support' },
  { match: /\bbed\b|rapikan/i, area: 'mind', tier: 'support' },
  // 🏃 Body — inti
  { match: /run|lari|walk|jalan|fitness|gym|strength|workout|olahraga|latihan|angkat beban/i, area: 'body', tier: 'core' },
  { match: /sunscreen|\bspf\b|tabir surya/i, area: 'body', tier: 'core' },
  { match: /protein|telur|\begg|whey|sayur|buah|makan|breakfast|sarapan|lunch|dinner|minum air|air putih/i, area: 'body', tier: 'core' },
  // 🏃 Body — pendukung
  { match: /stretch|mobility|peregangan/i, area: 'body', tier: 'support' },
  { match: /vitamin|fish oil|creatine|suplemen|supplement|omega/i, area: 'body', tier: 'support' },
  { match: /shower|mandi|scrub|lotion|skincare|serum|gigi|cukur/i, area: 'body', tier: 'support' },
  { match: /kopi|coffee|americano|caffeine|kafein/i, area: 'body', tier: 'support' },
];

/** Tebak area & tingkat satu kebiasaan dari namanya. */
function classifyHabit(label: string): {
  area: HabitArea;
  tier: HabitTier;
} {
  for (const rule of CLASSIFY_RULES) {
    if (rule.match.test(label)) return { area: rule.area, tier: rule.tier };
  }
  return { area: 'body', tier: 'support' };
}

/** Isi area & tingkat untuk kebiasaan yang BELUM ditandai (yang sudah, dibiarkan). */
export function classifyAll(habits: ScheduledHabit[]): ScheduledHabit[] {
  return habits.map((h) =>
    h.area && h.tier ? h : { ...h, ...classifyHabit(h.label) },
  );
}

/** Ada kebiasaan yang belum punya area/tingkat? → tawarkan penataan otomatis. */
export function needsClassify(habits: ScheduledHabit[]): number {
  return habits.filter((h) => !h.area || !h.tier).length;
}

// ===================== Paket kebiasaan malam =====================
// Bagian paling lemah dari rutinitas: tidur & pemulihan. Empat kebiasaan ini
// (plus satu di pagi) ditambahkan sekali ketuk — bukan dipaksa masuk, supaya
// daftar tetap milikmu.

const RECOVERY_PACK: Omit<ScheduledHabit, 'id'>[] = [
  {
    label: '📱 Phone Away — 21.30',
    slot: 'night',
    area: 'recovery',
    tier: 'core',
  },
  {
    label: '🧠 Refleksi Hari Ini',
    slot: 'night',
    area: 'mind',
    tier: 'core',
    note: true,
    notePrompt: 'Win hari ini… / Pelajaran… / Besok…',
  },
  {
    label: '🙏 Bersyukur 3 Hal',
    slot: 'night',
    area: 'spirit',
    tier: 'core',
    note: true,
    notePrompt: 'Terima kasih Tuhan untuk… (3 hal)',
  },
  {
    label: '😴 Tidur 22.00–22.30',
    slot: 'night',
    area: 'recovery',
    tier: 'core',
  },
  {
    label: '✍️ 1 Kalimat Rhema',
    slot: 'morning',
    area: 'spirit',
    tier: 'support',
    note: true,
    notePrompt: 'Hari ini Tuhan mengingatkanku bahwa…',
  },
];

// ===================== Olahraga: satu baris, disetir fitur Fitness ==========
// Dulu olahraga tersebar jadi beberapa kebiasaan terpisah (Easy Run Sen/Rab/Jum,
// Brisk Walk Sel/Kam, Long Walk akhir pekan, Fitness pk. 17.00) — padahal fitur
// Fitness sudah punya jadwal mingguannya sendiri. Isinya jadi dobel: dicentang
// di Habits, dicentang lagi di Fitness.
//
// Sekarang cukup SATU baris. Centangnya tidak diketuk di sini, melainkan ikut
// hasil sesi Fitness hari ini (lihat `syncFitnessHabit` di lib/fitness.ts).

/**
 * Id TETAP kebiasaan olahraga gabungan. Sengaja bukan id acak: fitur Fitness
 * bisa menulis centangnya tanpa perlu membaca daftar kebiasaan lebih dulu.
 */
export const FITNESS_HABIT_ID = 'fitness-link';

/** Baris tunggal pengganti semua kebiasaan olahraga yang terpisah-pisah. */
export const FITNESS_HABIT: ScheduledHabit = {
  id: FITNESS_HABIT_ID,
  label: '🏋️ Morning Exercise',
  slot: 'morning',
  area: 'body',
  tier: 'core',
};

// Kata kunci kebiasaan olahraga yang layak dilebur. Sengaja TIDAK memuat
// "stretch/mobility" & "peregangan": itu pemulihan, bukan sesi olahraga.
const EXERCISE_MATCH =
  /\b(run|jog|lari|walk|jalan|fitness|gym|workout|olahraga|latihan|angkat beban|strength|cardio)\b/i;

function isMergeableExercise(h: ScheduledHabit): boolean {
  return h.id === FITNESS_HABIT_ID || EXERCISE_MATCH.test(h.label);
}

/**
 * Kebiasaan olahraga terpisah yang masih ada di daftar. Dipakai untuk
 * menawarkan peleburan — sekaligus ditampilkan namanya supaya kelihatan dulu
 * apa saja yang akan hilang sebelum tombolnya ditekan.
 */
export function separateExercise(habits: ScheduledHabit[]): ScheduledHabit[] {
  return habits.filter((h) => h.id !== FITNESS_HABIT_ID && EXERCISE_MATCH.test(h.label));
}

/**
 * Ganti semua kebiasaan olahraga terpisah dengan SATU baris gabungan, di
 * posisi olahraga pagi yang pertama (bukan dilempar ke bawah daftar).
 * Aman dijalankan berulang: hasilnya selalu tepat satu baris gabungan.
 */
export function mergeExerciseHabits(habits: ScheduledHabit[]): ScheduledHabit[] {
  const g = habitsBySlot(habits);
  const at = g.morning.findIndex(isMergeableExercise);
  const morning = g.morning.filter((h) => !isMergeableExercise(h));
  morning.splice(at < 0 ? morning.length : at, 0, FITNESS_HABIT);
  return [
    ...morning,
    ...g.daytime.filter((h) => !isMergeableExercise(h)),
    ...g.night.filter((h) => !isMergeableExercise(h)),
  ];
}

/** Kebiasaan dari paket yang BELUM ada di daftar (dicocokkan dari namanya). */
export function missingFromPack(habits: ScheduledHabit[]): Omit<ScheduledHabit, 'id'>[] {
  const owned = habits.map((h) => h.label.toLowerCase());
  return RECOVERY_PACK.filter((p) => {
    // Bandingkan tanpa emoji & jam, cukup kata kuncinya.
    const key = p.label.toLowerCase().replace(/[^a-z]/g, '').slice(0, 8);
    return !owned.some((o) => o.replace(/[^a-z]/g, '').includes(key));
  });
}

function scheduleRef(uid: string) {
  return doc(db, 'users', uid, 'health', 'habitSchedule');
}

export function subscribeHabitSchedule(
  uid: string,
  onChange: (habits: ScheduledHabit[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    scheduleRef(uid),
    (snapshot) =>
      onChange((snapshot.data()?.habits as ScheduledHabit[]) ?? []),
    onError,
  );
}

/** Simpan seluruh daftar kebiasaan (berlaku untuk semua hari). */
export function saveHabits(uid: string, habits: ScheduledHabit[]) {
  return setDoc(scheduleRef(uid), { habits }, { merge: true });
}

/** Kebiasaan dikelompokkan per sesi (urutan Pagi→Siang→Malam). */
export function habitsBySlot(
  habits: ScheduledHabit[],
): Record<HabitSlot, ScheduledHabit[]> {
  return {
    morning: habits.filter((h) => h.slot === 'morning'),
    daytime: habits.filter((h) => h.slot === 'daytime'),
    night: habits.filter((h) => h.slot === 'night'),
  };
}
