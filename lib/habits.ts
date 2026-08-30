import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { Color } from '@/assets/style/color';

import { DAYPART } from './daypart';
import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Kebiasaan (habit) harian dibagi 3 sesi waktu (Pagi/Siang/Malam). SATU daftar
// kebiasaan dipakai untuk SEMUA hari (sama tiap hari — biar simple). Disimpan di
// dokumen users/{uid}/health/habitSchedule (field `habits`). Centang harian
// tetap memakai health habitDays/{YYYY-MM-DD}.done (keyed by id kebiasaan).

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

// ===================== Ganti nama kebiasaan =====================
// Daftar kebiasaan tersimpan di Firestore & namanya sengaja TIDAK bisa diubah
// dari dalam app (sheet-nya cuma menampilkan). Jadi penggantian nama dilakukan
// di sini, saat daftarnya DIBACA — datanya sendiri tidak ditulis ulang, dan
// centang harian tetap aman karena kuncinya id, bukan nama.

const HABIT_RENAMES: { match: RegExp; label: string }[] = [
  // Dulu "1 kalimat rhema", lalu "✍️ 1 Rhema before Activities". Sekarang jadi
  // jurnal refleksi harian — tulisannya yang sama, tapi namanya tidak lagi
  // mengunci isinya ke satu kalimat ayat saja.
  { match: /1 kalimat rhema|rhema before activities/i, label: '📓 Daily Reflection Journal' },
  // 📝 → 💡 supaya emojinya sama dengan tombol & layar Daily Priority 💡.
  { match: /top 3 priorit/i, label: '💡 Top 3 Priorities' },
];

function renamedHabit(h: ScheduledHabit): ScheduledHabit {
  const ganti = HABIT_RENAMES.find((r) => r.match.test(h.label));
  return ganti ? { ...h, label: ganti.label } : h;
}

// ===================== Kebiasaan yang centangnya dari catatan =====================
// Sebagian kebiasaan buktinya BUKAN click, melainkan tulisannya. Daily
// Reflection Journal contohnya: mencentang tanpa menulis apa pun cuma bikin
// angkanya bohong. Jadi centangnya dikunci & ditentukan panjang catatannya.

/** Panjang minimal catatan supaya kebiasaan bercatatan dianggap selesai. */
export const HABIT_NOTE_MIN = 10;

/** Catatan ini sudah cukup panjang untuk dihitung selesai? */
export function habitNoteDone(text: string): boolean {
  return text.trim().length >= HABIT_NOTE_MIN;
}

/**
 * Centangnya ditentukan catatan, bukan click (sekarang: Daily Reflection
 * Journal).
 *
 * "rhema" TETAP dikenali: nama tersimpannya di Firestore masih yang lama, dan
 * beberapa layar mencari baris ini lewat fungsi inilah — bukan lewat id yang
 * ditulis tangan. Melepas kata itu berarti baris jurnalnya "hilang" bagi Home,
 * layar Generate Feed, dan penguncian centangnya sekaligus.
 */
export function isNoteDrivenHabit(h: ScheduledHabit): boolean {
  return /rhema|reflection journal/i.test(h.label);
}

// ===================== Catatan yang isinya BUTIRAN =====================
// Sebagian catatan harian bukan satu paragraf, tapi daftar pendek dengan
// jumlah yang sudah tertentu. "🙏 Bersyukur 3 Hal" contohnya: namanya sendiri
// sudah menyebut TIGA, tapi kolomnya cuma satu kotak besar — jadi yang
// tertulis di situ sering cuma satu kalimat panjang, dan "3 hal"-nya tak
// pernah benar-benar tiga.
//
// Yang disimpan TETAP satu teks di `habitDays/{hari}.notes[id]`, dipisah
// baris. Tidak ada bentuk data baru, tidak ada migrasi: catatan lama yang
// terlanjur satu kalimat terbaca sebagai butir pertama, dua sisanya kosong.

/** Berapa butir yang diminta baris "Bersyukur 3 Hal". */
export const GRATITUDE_LINES = 3;

/** Baris yang catatannya daftar berbutir — 0 = satu kotak biasa. */
export function habitNoteLines(h: ScheduledHabit): number {
  return /bersyukur/i.test(h.label) ? GRATITUDE_LINES : 0;
}

/** Pecah catatan jadi tepat `lines` butir (kurang → dikosongkan). */
export function splitNoteLines(text: string, lines: number): string[] {
  const isi = text.split('\n');
  return Array.from({ length: lines }, (_, i) => isi[i]?.trim() ?? '');
}

/**
 * Gabung butiran jadi satu teks simpanan. Butir kosong DI TENGAH tetap
 * disimpan sebagai baris kosong — kalau tidak, mengosongkan butir ke-2 akan
 * membuat butir ke-3 naik ke tempatnya, dan apa yang kamu tulis pindah baris
 * sendiri. Baris kosong di EKOR dibuang supaya catatan yang benar-benar
 * kosong tetap terbaca kosong.
 */
export function joinNoteLines(lines: string[]): string {
  const bersih = lines.map((l) => l.trim());
  while (bersih.length > 0 && bersih[bersih.length - 1] === '') bersih.pop();
  return bersih.join('\n');
}

/** Butir yang benar-benar terisi — untuk pratinjau & daftar riwayat. */
export function filledNoteLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

// Refleksi pagi ditampilkan ULANG di Home pada jam-jam ini, biar tulisan
// paginya tidak berhenti di kolom catatan — dibaca lagi saat siang, sore, &
// malam.
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
// itu praktis mustahil, dan streaknya jadi selalu 0). Yang menentukan cuma
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
// keterangan kecil + click yang langsung membawa ke tempatnya.
//
// Warnanya sengaja mengikuti warna ubin fitur tujuannya di Home (atau warna
// merek aplikasi luar), jadi tujuannya sudah kebaca sebelum teksnya dibaca.

/**
 * Sumber centang OTOMATIS sebuah baris kebiasaan.
 *
 * Baris begini tidak bisa dicentang manual di Habits — buktinya ada di layar
 * lain, dan mencentangnya sendiri di sini cuma bikin angka hariannya bohong.
 * Lingkarannya dikunci abu-abu, dan click-nya membuka layar tujuannya.
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
      | '/reflection-feed';
    params?: Record<string, string>;
  };
  /** Tujuan aplikasi LUAR: skema app + alamat cadangan kalau belum terpasang. */
  external?: { scheme: string; web: string };
  /**
   * Ada = centangnya TIDAK di-click di Habits, melainkan ikut layar tujuan.
   * Baris begini dikunci: lingkarannya abu-abu & click-nya membuka tujuan.
   */
  mirrorOf?: HabitMirror;
  /**
   * true = membuka pintasannya SEKALIGUS mencentang kebiasaannya.
   *
   * Bedanya dengan `mirrorOf`: di sana centangnya menunggu bukti di layar
   * tujuan (bacaan tercatat, latihan beres). Di sini tidak ada yang bisa
   * dijadikan bukti — membaca berita tak meninggalkan jejak — jadi yang
   * dihitung adalah keputusannya: click = "sekarang saya baca", dan app
   * langsung membawanya ke sana. Lingkarannya tetap bisa di-click sendiri,
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
   * Baris begini TIDAK dianggap `isFixedHabit`: pintasannya cuma pintu
   * tambahan, bukan cermin pekerjaan di layar lain, jadi barisnya tetap boleh
   * dihapus seperti kebiasaan biasa.
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
    note: 'Buka aplikasi Instagram',
    color: Color.INSTAGRAM,
    external: { scheme: 'instagram://app', web: 'https://www.instagram.com/' },
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
  {
    match: /(protein.*fiber)|micronutrien/i,
    note: 'Buka Health › Diet',
    color: Color.DANGER,
    route: { pathname: '/health', params: { tab: 'diet' } },
  },
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
  // di Home, jadi click dari mana pun mendarat di tempat yang sama. Ketiganya
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
 * layar lain (Fitness, Diet, Baca Alkitab), jadi menghapusnya cuma bikin
 * daftarnya tidak lagi cocok dengan isi app. Boleh diurutkan naik/turun, boleh
 * dilewati sehari (✗), tapi tombol hapusnya sengaja tidak ada.
 */
export function isFixedHabit(h: ScheduledHabit): boolean {
  const link = habitLink(h);
  // `whenDone` dikecualikan: pintasannya cuma pintu tambahan sesudah barisnya
  // beres (📓 Jurnal → Instagram Feed), bukan cermin pekerjaan di layar lain.
  // Tanpa pengecualian ini baris jurnalnya mendadak kehilangan tombol hapus.
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
