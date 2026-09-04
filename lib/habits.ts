import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { Color } from '@/assets/style/color';

import { DAYPART } from './daypart';
import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Kebiasaan harian, 3 sesi (Pagi/Siang/Malam). Satu daftar untuk semua hari:
// users/{uid}/health/habitSchedule.habits — centang harian di habitDays.

export type HabitSlot = 'morning' | 'daytime' | 'night';

export const HABIT_SLOTS: { key: HabitSlot; label: string; emoji: string }[] = [
  { key: 'morning', label: 'Pagi', emoji: DAYPART.morning },
  { key: 'daytime', label: 'Siang', emoji: DAYPART.daytime },
  { key: 'night', label: 'Malam', emoji: DAYPART.night },
];

export function slotMeta(slot: HabitSlot) {
  return HABIT_SLOTS.find((s) => s.key === slot)!;
}

// ===================== Area & tingkat kepentingan =====================
// Tiap kebiasaan menjaga satu AREA hidup, jadi ukuran hariannya "5 area
// terjaga?", bukan "berapa dari 39 tercentang?".

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
 * Tingkat kebiasaan: `core` penentu streak & score, sisanya bonus.
 *
 * `support`/`optional` tetap dikenali karena masih ada di data tersimpan —
 * keduanya dibaca "bukan inti".
 */
export type HabitTier = 'core' | 'support' | 'optional';

/** Kebiasaan ini INTI? Inti = penentu streak 🔥, score harian, & area hidup. */
export function isCoreHabit(h: ScheduledHabit): boolean {
  return habitTier(h) === 'core';
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

// ===================== Ganti nama kebiasaan =====================
// Daftar kebiasaan tersimpan di Firestore & namanya sengaja TIDAK bisa diubah
// dari dalam app (sheet-nya cuma menampilkan). Jadi penggantian nama dilakukan
// di sini, saat daftarnya DIBACA — datanya sendiri tidak ditulis ulang, dan
// centang harian tetap aman karena kuncinya id, bukan nama.

type HabitRename = {
  match: RegExp;
  /** Ganti SELURUH namanya. */
  label?: string;
  /**
     * …atau buang POTONGANNYA saja (mis. jam di ekor nama) — emoji & tulisan
     * pilihanmu tetap apa adanya.
     */
  drop?: RegExp;
};

const HABIT_RENAMES: HabitRename[] = [
  // Jurnal refleksi harian — namanya sengaja tidak mengunci isinya ke satu
  // kalimat ayat.
  { match: /1 kalimat rhema|rhema before activities/i, label: '📓 Daily Reflection Journal' },
  // 💡 = lambang yang sama dengan tombol & layar Daily Priority.
  { match: /top 3 priorit/i, label: '💡 Top 3 Priorities' },
  // Tanpa jam di nama: sesinya (🌤️ Siang) sudah menyebut waktunya.
  { match: /drink creatine/i, label: '⚡ Drink Creatine' },
  // Kata "IG" WAJIB tetap ada: pintasan ke Instagram dicari dari kata itu
  // (lihat HABIT_LINKS di bawah).
  { match: /revive \+ ig story/i, label: '📱 Share Revive ke IG Story' },
  // Tanpa jam di nama, alasan yang sama dengan Drink Creatine di atas.
  {
    match: /eat mindfully|take fish oil/i,
    // "- Pk. 12.00" & "- 12.30" — "Pk." opsional, titik/titik dua sama saja.
    drop: /\s*[-–]\s*(pk\.?\s*)?\d{1,2}[.:]\d{2}\s*$/i,
  },
];

function renamedHabit(h: ScheduledHabit): ScheduledHabit {
  const ganti = HABIT_RENAMES.find((r) => r.match.test(h.label));
  if (!ganti) return h;
  if (ganti.label) return { ...h, label: ganti.label };
  return { ...h, label: h.label.replace(ganti.drop!, '').trim() };
}

// ============ Kebiasaan yang centangnya dari catatan ============
// Buktinya tulisan, bukan klik: mencentang tanpa menulis bikin angkanya
// bohong. Jadi centangnya dikunci & ditentukan isi catatannya.

/** Panjang minimal catatan supaya kebiasaan bercatatan dianggap selesai. */
export const HABIT_NOTE_MIN = 10;

export function habitNoteDone(text: string): boolean {
  return text.trim().length >= HABIT_NOTE_MIN;
}

/**
 * Catatan ini sudah cukup untuk dihitung selesai?
 *   • poin (🙏 Bersyukur 3 Hal) → SEMUA poin harus terisi.
 *   • satu paragraf (📓 Jurnal) → cukup panjangnya (HABIT_NOTE_MIN).
 */
export function habitNoteFilled(h: ScheduledHabit, text: string): boolean {
  const poin = habitNoteLines(h);
  if (poin > 0) return filledNoteLines(text).length >= poin;
  return habitNoteDone(text);
}

/**
 * Centangnya ditentukan catatan, bukan klik (Daily Reflection Journal).
 *
 * "rhema" tetap dikenali — itu nama tersimpannya di Firestore, dan beberapa
 * layar mencari baris ini lewat fungsi ini.
 */
export function isNoteDrivenHabit(h: ScheduledHabit): boolean {
  return /rhema|reflection journal|bersyukur/i.test(h.label);
}

// ===================== Catatan yang isinya POIN =====================
// Daftar pendek berjumlah tetap (mis. "🙏 Bersyukur 3 Hal"). Tersimpan tetap
// SATU teks di habitDays/{hari}.notes[id], dipisah baris — tanpa bentuk data
// baru & tanpa migrasi.

/** Berapa poin yang diminta baris "Bersyukur 3 Hal". */
export const GRATITUDE_LINES = 3;

/**
 * Baris "🙏 Bersyukur 3 Hal" — satu regex, satu tempat.
 *
 * Dipakai dua hal: bentuk kolomnya (3 poin) & arsipnya (lib/gratitude.ts).
 */
export function isGratitudeHabit(h: ScheduledHabit): boolean {
  return /bersyukur/i.test(h.label);
}

/** Baris yang catatannya daftar poin — 0 = satu kotak biasa. */
export function habitNoteLines(h: ScheduledHabit): number {
  return isGratitudeHabit(h) ? GRATITUDE_LINES : 0;
}

/** Pecah catatan jadi tepat `lines` poin (kurang → dikosongkan). */
export function splitNoteLines(text: string, lines: number): string[] {
  const isi = text.split('\n');
  return Array.from({ length: lines }, (_, i) => isi[i]?.trim() ?? '');
}

/**
 * Gabung poin jadi satu teks. Poin kosong DI TENGAH tetap jadi baris kosong —
 * kalau tidak, poin ke-3 naik ke tempat ke-2 saat ke-2 dikosongkan. Baris
 * kosong di EKOR dibuang.
 */
export function joinNoteLines(lines: string[]): string {
  const bersih = lines.map((l) => l.trim());
  while (bersih.length > 0 && bersih[bersih.length - 1] === '') bersih.pop();
  return bersih.join('\n');
}

/** Poin yang benar-benar terisi — untuk pratinjau & daftar riwayat. */
export function filledNoteLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// Refleksi pagi ditayangkan ulang di Home pada jam-jam ini, biar tulisannya
// tidak berhenti di kolom catatan.
const REFLECTION_WINDOWS: [number, number][] = [
  [12, 13],
  [17, 18],
  [21, 22],
];

/** Sekarang jam tayang kartu refleksi di Home? */
export function rhemaWindowNow(now: Date): boolean {
  const h = now.getHours();
  return REFLECTION_WINDOWS.some(([dari, sampai]) => h >= dari && h < sampai);
}

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
 * Sesi yang waktunya SUDAH tiba hari ini — kumulatif (siang membawa sisa pagi).
 *
 * Jam 00.00–05.59 sengaja kosong: ceklis sudah kereset ke hari baru sementara
 * sesi Pagi baru mulai jam 6 — badge & kartu reminder ikut hilang.
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
 * Kebiasaan yang BERLAKU hari ini — yang ditandai ✗ dibuang.
 *
 * Satu pintu masuk untuk semua penghitung harian. Daftar yang DITAMPILKAN
 * tetap lengkap; barisnya cuma bertanda ⏭️.
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
      // Olahraga tidak ikut menagih di sini — sudah dipegang fitur Fitness.
      // Kalau ikut, satu olahraga ditagih dari dua tempat.
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

// ===================== Score & streak =====================
// Yang menentukan streak cuma kebiasaan INTI; sisanya bonus.
//
// ⚠️ Semuanya di bawah menerima daftar LENGKAP + peta `skipped`, BUKAN hasil
// `countedHabits`. Kalau baris ✗ dikeluarkan, hari yang semua intinya
// dilewati terbaca "beres semua" — streak naik & skor 10/10 tanpa satu pun
// dikerjakan.

function coreHabits(habits: ScheduledHabit[]): ScheduledHabit[] {
  return habits.filter(isCoreHabit);
}

/**
 * Semua kebiasaan Inti hari ini beres? → penentu naiknya streak 🔥
 * Yang ditandai ✗ dihitung BELUM beres, bukan dikeluarkan dari hitungan.
 */
export function coreDone(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
  skipped: Record<string, boolean> = {},
): boolean {
  const core = coreHabits(habits);
  return core.length > 0 && core.every((h) => done[h.id] && !skipped[h.id]);
}

/**
 * Score harian 0–10, HANYA dari kebiasaan Inti — jadi 10/10 selalu berarti
 * sama dengan naiknya streak. Yang ditandai ✗ dihitung belum beres.
 */
export function dailyScore(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
  skipped: Record<string, boolean> = {},
): number {
  const core = coreHabits(habits);
  if (core.length === 0) return 0;
  const ratio =
    core.filter((h) => done[h.id] && !skipped[h.id]).length / core.length;
  // Angka 10 disimpan khusus untuk yang benar-benar beres semua — tanpa ini
  // pembulatan bisa menampilkan "10/10" padahal masih ada satu yang bolong.
  return ratio === 1 ? 10 : Math.min(9, Math.round(ratio * 10));
}

export type AreaProgress = {
  area: HabitArea;
  coreDone: number;
  coreTotal: number;
  done: number;
  total: number;
  kept: boolean; // semua kebiasaan Inti area ini beres
  /**
     * Ada kebiasaan area ini yang ditandai ✗ hari ini.
     *
     * Dipisah dari `kept`: "belum dikerjakan" masih bisa berubah, "dilewati"
     * sudah jadi keputusan — yang kedua ditandai MERAH.
     */
  skipped: boolean;
};

/**
 * Rekap per area hari ini. Area tanpa kebiasaan Inti terjaga begitu minimal
 * satu kebiasaannya dilakukan. Satu baris ✗ membuat areanya TIDAK terjaga.
 */
export function areaProgress(
  habits: ScheduledHabit[],
  done: Record<string, boolean>,
  skipped: Record<string, boolean> = {},
): AreaProgress[] {
  return HABIT_AREAS.map(({ key }) => {
    const inArea = habits.filter((h) => habitArea(h) === key);
    const core = inArea.filter(isCoreHabit);
    const beres = (h: ScheduledHabit) => !!done[h.id] && !skipped[h.id];
    const coreDoneCount = core.filter(beres).length;
    const doneCount = inArea.filter(beres).length;
    const adaDilewati = inArea.some((h) => skipped[h.id]);
    return {
      area: key,
      coreDone: coreDoneCount,
      coreTotal: core.length,
      done: doneCount,
      total: inArea.length,
      kept:
        !adaDilewati &&
        (core.length > 0
          ? coreDoneCount === core.length
          : inArea.length > 0 && doneCount > 0),
      skipped: adaDilewati,
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

/**
 * Id TETAP baris olahraga gabungan "🏋️ Morning Exercise" — satu baris yang
 * menggantikan lari/jalan/gym yang dulu terpisah-pisah, karena fitur Fitness
 * sudah punya jadwal mingguannya sendiri.
 *
 * Sengaja bukan id acak: fitur Fitness bisa menulis centangnya tanpa perlu
 * membaca daftar kebiasaan lebih dulu (lihat `syncFitnessHabit` di
 * lib/fitness.ts). Kalau baris ini dihapus lalu dibuat ulang dari layar
 * Tambah Kebiasaan, id-nya jadi acak → cerminnya berhenti bekerja.
 */
export const FITNESS_HABIT_ID = 'fitness-link';

// ===================== Pintasan kebiasaan =====================
// Sebagian kebiasaan sebenarnya DIKERJAKAN di layar lain (atau di aplikasi
// lain). Daripada mengingat sendiri harus buka apa, baris-baris itu diberi
// keterangan kecil + klik yang langsung membawa ke tempatnya.
//
// Warnanya sengaja mengikuti warna ubin fitur tujuannya di Home (atau warna
// merek aplikasi luar), jadi tujuannya sudah kebaca sebelum teksnya dibaca.

/**
 * Sumber centang OTOMATIS sebuah baris kebiasaan.
 *
 * Baris begini tidak bisa dicentang manual di Habits — buktinya ada di layar
 * lain, dan mencentangnya sendiri di sini cuma bikin angka hariannya bohong.
 * Lingkarannya dikunci abu-abu, dan klik-nya membuka layar tujuannya.
 *
 * Aturan "sudah"-nya masing-masing:
 *   fitness       → semua gerakan sesi hari ini beres (lib/fitness.ts)
 *   priority      → ketiga Daily Priority sudah diisi
 *   bible-*       → bacaan sesi itu sudah dicatat lewat "✅ Sudah baca"
 */
export type HabitMirror =
  | 'fitness'
  | 'priority'
  | 'bible-morning'
  | 'bible-daytime'
  | 'bible-night';

/**
 * Baris yang dituju saat layar Habits dibuka DARI kartu di Home (`?focus=…`):
 * sesinya dibuka, lalu daftarnya digulung tepat ke baris itu.
 *
 * Kartu di Home menagih satu hal tertentu, jadi mendarat di puncak daftar 39
 * baris berarti pekerjaan mencarinya dilempar balik ke kamu. Dua kartu memakai
 * ini: "📓 Refleksi Hari Ini" (→ 'rhema') & "🌅/🌤️/🌙 … Reading" (→ 'bible-*').
 *
 * Selain 'rhema', nilainya = `HabitMirror` — barisnya dicari lewat
 * `habitMirror`, bukan lewat id yang ditulis tangan.
 */
export type HabitFocus = 'rhema' | HabitMirror;

export type HabitLink = {
  /** Cocokkan lewat id tetap — dipakai baris olahraga gabungan. */
  id?: string;
  /** Atau lewat kata kunci di nama kebiasaan. */
  match?: RegExp;
  /** Keterangan kecil di bawah nama kebiasaan. */
  note: string;
  /** Warna keterangan. */
  color: string;
  /**
   * Tujuan di DALAM app. Ditulis sebagai literal (bukan `string`) supaya
   * typed routes expo-router ikut memeriksa rutenya memang ada.
   */
  route?: {
    pathname:
      | '/fitness'
      | '/spiritual'
      | '/health'
      | '/bible-reading'
      | '/daily-priority'
      | '/news'
      | '/reflection-feed'
      | '/gratitude';
    params?: Record<string, string>;
  };
  /** Tujuan aplikasi LUAR: skema app + alamat cadangan kalau belum terpasang. */
  external?: { scheme: string; web: string };
  /**
   * Ada = centangnya TIDAK di-klik di Habits, melainkan ikut layar tujuan.
   * Baris begini dikunci: lingkarannya abu-abu & klik-nya membuka tujuan.
   */
  mirrorOf?: HabitMirror;
  /**
   * true = membuka pintasannya SEKALIGUS mencentang kebiasaannya.
   *
   * Bedanya dengan `mirrorOf`: di sana centangnya menunggu bukti di layar
   * tujuan (bacaan tercatat, latihan beres). Di sini tidak ada yang bisa
   * dijadikan bukti — membaca berita tak meninggalkan jejak — jadi yang
   * dihitung adalah keputusannya: klik = "sekarang saya baca", dan app
   * langsung membawanya ke sana. Lingkarannya tetap bisa di-klik sendiri,
   * jadi centangnya masih bisa dibatalkan kalau ternyata batal membaca.
   */
  doneOnOpen?: boolean;
  /**
   * true = pintasannya baru muncul SESUDAH barisnya tercentang.
   *
   * Untuk kebiasaan yang hasilnya baru ada setelah dikerjakan: 📓 Daily
   * Reflection Journal baru bisa dibuatkan feed-nya kalau refleksinya memang
   * sudah ditulis. Sebelum itu tombolnya sengaja tidak ada — membukanya cuma
   * menghadapkan layar kosong.
   *
   * Pintasan begini sendiri tidak membuat barisnya wajib — yang membuat
   * kedua baris bercatatan wajib adalah `isNoteDrivenHabit`.
   */
  whenDone?: boolean;
};

// Urutan penting: yang lebih spesifik diperiksa duluan. "Share Revive ke
// Instastory" & "Share Revive ke WAG" sama-sama memuat kata "revive" — yang
// pertama harus tertangkap aturan Instagram DULU, sebelum sampai ke aturan
// Revive di bawahnya.
export const HABIT_LINKS: HabitLink[] = [
  {
    id: FITNESS_HABIT_ID,
    note: 'Buka fitur Fitness',
    color: Color.FITNESS_DARK,
    route: { pathname: '/fitness' },
    mirrorOf: 'fitness',
  },
  // 🙏 Bersyukur 3 Hal → Riwayat Syukur 🙏, pola yang sama persis dengan
  // 📓 Jurnal → Generate Feed: pintunya baru muncul SESUDAH ketiga halnya
  // ditulis, karena sebelum itu riwayatnya memang belum bertambah apa-apa.
  {
    match: /bersyukur/i,
    note: 'Buka Riwayat Syukur 🙏',
    color: Color.SPIRITUAL_DARK,
    route: { pathname: '/gratitude' },
    whenDone: true,
  },
  // 📓 Daily Reflection Journal → layar Generate Feed 🖼️.
  //
  // Diperiksa DULUAN karena namanya memuat kata "journal", bukan "ig" —
  // tapi urutannya tetap ditulis di sini supaya jelas ia mendahului aturan
  // Instagram di bawah kalau nanti namanya diubah jadi memuat keduanya.
  //
  // `whenDone`: pintunya baru muncul sesudah refleksinya benar-benar ditulis
  // (baris ini centangnya memang ditentukan tulisannya — lihat
  // `isNoteDrivenHabit`), karena feed-nya dibuat DARI tulisan itu. Ini juga
  // satu-satunya pintu yang menetap: kartu di Home hilang begitu feed-nya
  // jadi, sedangkan baris ini tetap ada sepanjang hari.
  {
    match: /reflection journal|rhema/i,
    note: 'Buka Instagram Feed 🖼️',
    color: Color.INSTAGRAM,
    route: { pathname: '/reflection-feed' },
    whenDone: true,
  },
  {
    // "instastory" & "insta story" ikut dikenali — nama barisnya boleh
    // berbunyi "Share Revive ke Instastory" tanpa kehilangan pintasannya.
    match: /\b(ig|instagram|instastory|insta story)\b/i,
    note: 'Buka Instagram',
    color: Color.INSTAGRAM,
    external: { scheme: 'instagram://app', web: 'https://www.instagram.com/' },
  },
  // 🦉 Play Duolingo → aplikasi Duolingo. Sama seperti Instagram: pintunya
  // aplikasi luar, jadi centangnya TETAP di-klik sendiri — membuka Duolingo
  // belum tentu menyelesaikan pelajarannya, dan angka harian yang dicentang
  // sendiri lebih jujur daripada yang tercentang cuma karena app terbuka.
  //
  // Punya pintasan = baris ini otomatis WAJIB (lihat `isFixedHabit`): boleh
  // diurutkan & dilewati sehari (✗), tapi tombol hapusnya tidak ada.
  {
    match: /duolingo/i,
    note: 'Buka Duolingo',
    color: Color.DUOLINGO,
    external: { scheme: 'duolingo://', web: 'https://www.duolingo.com/learn' },
  },
  {
    // `wag?` = "WA" maupun "WAG" — nama barisnya boleh berbunyi "Share Revive
    // ke WAG" tanpa kehilangan pintasannya. Tanpa `g`-nya, `\bwa\b` tidak
    // mengenali "WAG" sama sekali (batas katanya jatuh di tempat lain), dan
    // barisnya diam-diam berubah jadi kebiasaan biasa tanpa pintu.
    match: /revive.*(\bwag?\b|whatsapp|core)/i,
    note: 'Buka Spiritual › Revive',
    color: Color.SPIRITUAL_DARK,
    route: { pathname: '/spiritual', params: { tab: 'revive' } },
  },
  // Baris sarapan (protein + fiber + mikronutrien) dulu berpintasan ke
  // Health › Diet. Tabnya sudah dihapus, jadi pintasannya ikut dibuang —
  // pintu yang mendarat di tempat yang tidak ada lebih buruk daripada tidak
  // ada pintu. Barisnya sendiri tetap ada di daftar kebiasaan, cuma sekarang
  // dicentang sendiri seperti kebiasaan biasa.
  // Baca berita — langsung mendarat di tab Berita fitur News 📰, dan barisnya
  // ikut tercentang saat itu juga (lihat `doneOnOpen`).
  {
    match: /reading the news|baca berita/i,
    note: 'Buka News',
    color: Color.NEWS_DARK,
    route: { pathname: '/news', params: { tab: 'news' } },
    doneOnOpen: true,
  },
  // Top 3 Priorities — punya layarnya sendiri (Daily Priority 💡), dan
  // centangnya ikut layar itu: tercentang begitu ketiga prioritas hari ini
  // terisi. Mencentangnya di sini tanpa menuliskan apa-apa cuma bikin bohong.
  {
    match: /top 3 priorit/i,
    note: 'Buka Daily Priority 💡',
    color: Color.MAIN_DARK,
    route: { pathname: '/daily-priority' },
    mirrorOf: 'priority',
  },
  // Baca Alkitab pagi, siang & malam — tujuannya layar yang sama dengan kartu
  // di Home, jadi klik dari mana pun mendarat di tempat yang sama. Ketiganya
  // ikut catatan bacaannya: tercentang sesudah "✅ Sudah baca" di sana.
  {
    match: /morning bible reading/i,
    note: 'Buka Baca Alkitab › Pagi',
    color: Color.SPIRITUAL_DARK,
    route: { pathname: '/bible-reading', params: { session: 'morning' } },
    mirrorOf: 'bible-morning',
  },
  {
    match: /midday bible reading/i,
    note: 'Buka Baca Alkitab › Siang',
    color: Color.SPIRITUAL_DARK,
    route: { pathname: '/bible-reading', params: { session: 'daytime' } },
    mirrorOf: 'bible-daytime',
  },
  {
    match: /night bible reading/i,
    note: 'Buka Baca Alkitab › Malam',
    color: Color.SPIRITUAL_DARK,
    route: { pathname: '/bible-reading', params: { session: 'night' } },
    mirrorOf: 'bible-night',
  },
];

/** Sumber centang otomatis baris ini (null = dicentang sendiri seperti biasa). */
export function habitMirror(h: ScheduledHabit): HabitMirror | null {
  return habitLink(h)?.mirrorOf ?? null;
}

// ---- Baris "📖 Midday Bible Reading" ----
// Baca Alkitab punya TIGA sesi (lib/spiritual.ts) tapi daftar kebiasaan cuma
// punya baris Pagi & Malam — sesi Siang tidak pernah tertagih di Habits.
// Barisnya disisipkan sekali saat layar Habits dibuka.
export const BIBLE_DAYTIME_HABIT_ID = 'bible-daytime-link';

const MIDDAY_BIBLE: ScheduledHabit = {
  id: BIBLE_DAYTIME_HABIT_ID,
  label: '📖 Midday Bible Reading',
  slot: 'daytime',
  area: 'spirit',
  tier: 'core',
};

/**
 * Daftar kebiasaan + baris Siang-nya kalau memang belum ada.
 * null = sudah ada → JANGAN menulis apa pun ke Firestore.
 */
export function withMiddayBible(
  habits: ScheduledHabit[],
): ScheduledHabit[] | null {
  const sudahAda = habits.some(
    (h) => h.id === BIBLE_DAYTIME_HABIT_ID || /midday bible reading/i.test(h.label),
  );
  return sudahAda ? null : [...habits, MIDDAY_BIBLE];
}

/**
 * Kebiasaan berpintasan itu WAJIB: ia mencerminkan sesuatu yang dikerjakan di
 * layar lain (Fitness, Revive, Baca Alkitab), jadi menghapusnya cuma bikin
 * daftarnya tidak lagi cocok dengan isi app. Boleh diurutkan naik/turun, boleh
 * dilewati sehari (✗), tapi tombol hapusnya sengaja tidak ada.
 */
export function isFixedHabit(h: ScheduledHabit): boolean {
  // Kebiasaan yang centangnya datang dari TULISANNYA (📓 Jurnal, 🙏 Bersyukur
  // 3 Hal) ikut wajib. Tulisannya punya layar pembaca sendiri — Generate Feed
  // & Riwayat Syukur 🙏 — dan keduanya mencari barisnya di daftar ini. Hilang
  // barisnya, layar itu jadi kosong selamanya tanpa ada yang memberi tahu
  // kenapa; catatan lamanya sendiri tetap ada tapi tak bisa dijangkau lagi.
  if (isNoteDrivenHabit(h)) return true;
  const link = habitLink(h);
  // `whenDone` dikecualikan: pintasannya cuma pintu tambahan sesudah barisnya
  // beres, bukan cermin pekerjaan di layar lain.
  return link !== null && !link.whenDone;
}

/** Pintasan untuk satu kebiasaan (null = kebiasaan biasa). */
export function habitLink(h: ScheduledHabit): HabitLink | null {
  return (
    HABIT_LINKS.find((l) => (l.id ? h.id === l.id : l.match!.test(h.label))) ??
    null
  );
}

/** Kebiasaan dari paket yang BELUM ada di daftar (dicocokkan dari namanya). */

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
      onChange(
        ((snapshot.data()?.habits as ScheduledHabit[]) ?? []).map(renamedHabit),
      ),
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
