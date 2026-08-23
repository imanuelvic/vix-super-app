import {
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { type LoginStreak as DayStreak } from './achievements';
import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { dayIdToDate } from './format';
import { yesterdayId } from './health';
import { hashString, pickOfDay } from './core';
import { openExternalUrl } from './linking';
import { alreadyCounted, EMPTY_DAY_STREAK, nextStreak } from './streak';

// Spiritual ✝️ — Revive harian (mengikuti struktur renungan NDC:
// judul, bacaan Alkitab, ayat hafalan, rhema, refleksi) + reminder acak
// untuk fokus pada hubungan pribadi dengan Tuhan + streak ala Duolingo.
//
// "Doing for God without being with God" — fitur ini ruang untuk BERHENTI.

export type ReviveEntry = {
  id: string; // "YYYY-MM-DD" — satu Revive per hari
  title: string; // judul renungan, mis. "ARE YOU TOO BUSY TO BE WITH GOD?"
  passage: string; // bacaan Alkitab, mis. "Lukas 5:15-16"
  verse: string; // ayat hafalan, mis. "Lukas 5:16"
  rhema: string; // firman yang merhema di hati
  reflection: string; // refleksi diri & komitmen
  date: Timestamp;
};

export function subscribeReviveEntries(
  uid: string,
  onChange: (entries: ReviveEntry[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(
    collection(db, 'users', uid, 'revive'),
    orderBy('date', 'desc'),
    limit(90),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ReviveEntry, 'id'>),
        })),
      );
    },
    onError,
  );
}

export function saveReviveEntry(
  uid: string,
  dayId: string,
  data: {
    title: string;
    passage: string;
    verse: string;
    rhema: string;
    reflection: string;
    date: Date;
  },
) {
  return setDoc(doc(db, 'users', uid, 'revive', dayId), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function deleteReviveEntry(uid: string, dayId: string) {
  return deleteDoc(doc(db, 'users', uid, 'revive', dayId));
}

// ===================== Streak Revive 🔥 =====================
// users/{uid}/app/revive — bentuknya sama dengan streak login, plus penanda
// hari yang sengaja dilewati. Ditumpangkan di dokumen yang SAMA supaya tidak
// menambah satu pun pembacaan Firestore.

export type ReviveStreak = DayStreak & {
  /**
   * dayId yang ditandai "dilewati". Hanya berlaku untuk hari itu saja — besok
   * nilainya sudah tidak cocok lagi dengan todayId, jadi tandanya hilang
   * sendiri tanpa perlu dibersihkan.
   */
  skippedDayId?: string;
};

export function subscribeReviveStreak(
  uid: string,
  onChange: (streak: ReviveStreak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'app', 'revive');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as ReviveStreak) : null);
    },
    onError,
  );
}

/**
 * Revive hari ini sudah "selesai diurus"? Yaitu SUDAH DITULIS atau sengaja
 * DILEWATI. Inilah satu-satunya penentu badge Revive — dipakai bareng oleh
 * tile Spiritual di Home, sub-tab Revive, dan langkah 1 di gerbang doa pagi,
 * jadi ketiganya tidak mungkin berbeda pendapat.
 */
export function reviveHandledToday(
  streak: ReviveStreak | null,
  todayId: string,
): boolean {
  if (!streak) return false;
  return streak.lastDayId === todayId || streak.skippedDayId === todayId;
}

/**
 * Tandai Revive hari ini DILEWATI (atau batalkan lagi).
 *
 * Streak 🔥 tidak diubah di sini — dan memang tidak perlu: hari yang
 * dilewati tidak pernah tercatat, jadi streaknya putus dengan sendirinya
 * saat kamu menulis Revive lagi nanti.
 */
export function setReviveSkipped(
  uid: string,
  current: ReviveStreak | null,
  todayId: string,
  skipped: boolean,
) {
  return setDoc(doc(db, 'users', uid, 'app', 'revive'), {
    ...(current ?? EMPTY_DAY_STREAK),
    skippedDayId: skipped ? todayId : '',
  });
}

/** Panggil saat Revive HARI INI pertama kali disimpan — naik maks 1×/hari. */
export function bumpReviveStreak(
  uid: string,
  current: ReviveStreak | null,
  todayId: string,
) {
  if (alreadyCounted(current, todayId)) return Promise.resolve();
  return setDoc(doc(db, 'users', uid, 'app', 'revive'), {
    ...nextStreak(current, todayId, yesterdayId()),
    // Ditulis beneran → tanda "dilewati" hari ini otomatis dicabut.
    skippedDayId: '',
  });
}

// ================ Bacaan Alkitab 📖 (Pagi, Siang & Malam) ================
// TIGA sesi baca per hari, masing-masing punya jendela jam sendiri:
//   🌅 Pagi 05.00–09.59 · ☀️ Siang 12.00–13.59 · 🌙 Malam 21.00–23.59
// Kartu reminder di Home hanya muncul di dalam jendela itu & selama sesi hari
// itu belum diisi. Isinya string bebas: kitab/pasal yang dibaca.
//
// Satu dokumen kecil per hari: users/{uid}/bibleRead/{YYYY-MM-DD}
//   { morning: string, daytime: string, night: string, date: Timestamp }
// Sesi bernilai "" = belum diisi hari itu.
// CATATAN: nama koleksi tetap `bibleRead` (bukan `bibleReading`) — mengubahnya
// akan memutus semua catatan bacaan yang sudah tersimpan di Firestore. Nama
// kolom `daytime` mengikuti sesi Siang di Habits (lib/habits.ts) supaya satu
// istilah dipakai di seluruh app.

export type BibleSession = 'morning' | 'daytime' | 'night';

export const BIBLE_SESSIONS: {
  key: BibleSession;
  label: string; // "Pagi" / "Siang" / "Malam" — untuk tab riwayat
  title: string; // judul kartu di Home & layar catat bacaan
  emoji: string;
  fromHour: number; // jendela mulai (inklusif)
  toHour: number; // jendela selesai (eksklusif)
}[] = [
  { key: 'morning', label: 'Pagi', title: 'Morning Bible Reading', emoji: '🌅', fromHour: 5, toHour: 10 },
  // Siang sengaja SEMPIT (2 jam, jam makan siang) — jendela lebar bikin
  // "nanti saja" berulang sampai jamnya habis sendiri.
  { key: 'daytime', label: 'Siang', title: 'Midday Bible Reading', emoji: '☀️', fromHour: 12, toHour: 14 },
  { key: 'night', label: 'Malam', title: 'Night Bible Reading', emoji: '🌙', fromHour: 21, toHour: 24 },
];

export function bibleSessionMeta(session: BibleSession) {
  return BIBLE_SESSIONS.find((s) => s.key === session)!;
}

/** Sesi dari parameter URL — apa pun selain nama sesi yang sah jatuh ke Pagi. */
export function bibleSessionOf(raw: string | undefined): BibleSession {
  return BIBLE_SESSIONS.find((s) => s.key === raw)?.key ?? 'morning';
}

/**
 * Sisa MENIT sampai jendela sesi ini tutup. ≤ 0 = jendelanya sudah lewat.
 * Bentuknya sama dengan `prayerMinutesLeft` (lib/achievements.ts) — sama-sama
 * hitung mundur "sampai jam berapa ini masih dianggap tepat waktu".
 */
export function bibleMinutesLeft(session: BibleSession, now: Date): number {
  const meta = bibleSessionMeta(session);
  return meta.toHour * 60 - (now.getHours() * 60 + now.getMinutes());
}

/**
 * Penanda "hari ini dilewati" — disimpan di kolom yang sama dengan bacaannya.
 * Gunanya: kartu reminder di Home berhenti menagih untuk hari itu, TAPI
 * streak 🔥 sengaja TIDAK naik — dilewati ya dilewati, tidak dihitung baca.
 */
export const BIBLE_SKIPPED = '__skip__';

export function isBibleSkipped(passage: string): boolean {
  return passage === BIBLE_SKIPPED;
}

/** Isi ketiga sesi dalam satu hari ("" = belum diisi). */
export type BibleReadingSessions = Record<BibleSession, string>;

/** Berapa sesi LAIN di hari itu yang sudah terisi. */
function otherFilled(
  sessions: BibleReadingSessions,
  session: BibleSession,
): number {
  return BIBLE_SESSIONS.filter((s) => s.key !== session && !!sessions[s.key])
    .length;
}

/**
 * Hari itu jadi LENGKAP kalau `session` ikut terisi? (dasar streak "lengkap")
 * Dulu cukup pagi + malam; sekarang ketiga sesi.
 */
export function bibleDayComplete(
  sessions: BibleReadingSessions,
  session: BibleSession,
): boolean {
  return otherFilled(sessions, session) === BIBLE_SESSIONS.length - 1;
}

/**
 * Masih ada catatan sesi lain di hari itu? Dipakai saat menghapus: kalau tidak
 * ada, dokumen harinya ikut dihapus supaya tak menyisakan data kosong.
 */
export function bibleHasOther(
  sessions: BibleReadingSessions,
  session: BibleSession,
): boolean {
  return otherFilled(sessions, session) > 0;
}

export type BibleReadingDay = BibleReadingSessions & {
  id: string; // "YYYY-MM-DD"
  date: Timestamp;
};

/** Sesi yang jendelanya sedang terbuka sekarang (null = di luar jam baca). */
export function bibleSessionNow(now: Date): BibleSession | null {
  const h = now.getHours();
  return (
    BIBLE_SESSIONS.find((s) => h >= s.fromHour && h < s.toHour)?.key ?? null
  );
}

function readSessions(data?: Record<string, unknown>): BibleReadingSessions {
  return {
    morning: (data?.morning as string) ?? '',
    daytime: (data?.daytime as string) ?? '',
    night: (data?.night as string) ?? '',
  };
}

/** Riwayat 90 hari terakhir — untuk tab Bible Reading di Spiritual. */
export function subscribeBibleReadingDays(
  uid: string,
  onChange: (days: BibleReadingDay[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(
    collection(db, 'users', uid, 'bibleRead'),
    orderBy('date', 'desc'),
    limit(90),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...readSessions(d.data()),
          date: d.data().date as Timestamp,
        })),
      );
    },
    onError,
  );
}

/** HANYA hari ini — dipakai Dashboard (1 dokumen saja, hemat read). */
export function subscribeBibleReadingToday(
  uid: string,
  dayId: string,
  onChange: (sessions: BibleReadingSessions) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'bibleRead', dayId),
    (snapshot) => onChange(readSessions(snapshot.data())),
    onError,
  );
}

/** Simpan bacaan SATU sesi — merge, jadi sesi lain di hari itu tidak tersentuh. */
export function saveBibleReading(
  uid: string,
  dayId: string,
  session: BibleSession,
  passage: string,
) {
  return setDoc(
    doc(db, 'users', uid, 'bibleRead', dayId),
    { [session]: passage, date: Timestamp.fromDate(dayIdToDate(dayId)) },
    { merge: true },
  );
}

/**
 * Hapus catatan bacaan SATU sesi — PERMANEN. Kalau sesi satunya di hari itu
 * juga kosong, dokumen harinya ikut dihapus supaya tidak menyisakan data
 * kosong di Firestore.
 */
export function deleteBibleReading(
  uid: string,
  dayId: string,
  session: BibleSession,
  otherFilled: boolean,
) {
  const ref = doc(db, 'users', uid, 'bibleRead', dayId);
  return otherFilled ? setDoc(ref, { [session]: '' }, { merge: true }) : deleteDoc(ref);
}

// ===== Streak baca Alkitab 🔥 — SATU dokumen: users/{uid}/app/bibleStreak =====
// Empat streak sekaligus supaya cukup 1 read: pagi, siang, malam, dan
// "lengkap" (hari yang KETIGA sesinya terisi). Bentuk tiap streak sama
// dengan streak doa/Revive: { count, lastDayId, best, total }.

export type BibleStreaks = Record<BibleSession | 'both', DayStreak>;

export const EMPTY_BIBLE_STREAKS: BibleStreaks = {
  morning: EMPTY_DAY_STREAK,
  daytime: EMPTY_DAY_STREAK,
  night: EMPTY_DAY_STREAK,
  both: EMPTY_DAY_STREAK,
};

export function subscribeBibleStreaks(
  uid: string,
  onChange: (streaks: BibleStreaks) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'app', 'bibleStreak'),
    (snapshot) => {
      const d = snapshot.data();
      onChange({
        morning: (d?.morning as DayStreak) ?? EMPTY_DAY_STREAK,
        daytime: (d?.daytime as DayStreak) ?? EMPTY_DAY_STREAK,
        night: (d?.night as DayStreak) ?? EMPTY_DAY_STREAK,
        both: (d?.both as DayStreak) ?? EMPTY_DAY_STREAK,
      });
    },
    onError,
  );
}

/** Naikkan satu streak — maks 1×/hari, putus kalau kemarin bolong. */
function bumpDayStreak(current: DayStreak, todayId: string): DayStreak {
  if (alreadyCounted(current, todayId)) return current;
  return nextStreak(current, todayId, yesterdayId());
}

/**
 * Catat streak SESUDAH bacaan tersimpan. `allFilled` = ketiga sesi hari ini
 * sudah terisi → streak "lengkap" ikut naik.
 */
export function bumpBibleStreaks(
  uid: string,
  current: BibleStreaks,
  todayId: string,
  session: BibleSession,
  allFilled: boolean,
) {
  const next: BibleStreaks = {
    ...current,
    [session]: bumpDayStreak(current[session], todayId),
    both: allFilled ? bumpDayStreak(current.both, todayId) : current.both,
  };
  return setDoc(doc(db, 'users', uid, 'app', 'bibleStreak'), next);
}

// ===================== Reminder harian 🕊️ =====================
// Acak tapi deterministik per hari — fokus: hubungan pribadi dengan Tuhan.

const REMINDERS: string[] = [
  '🎵 Putar satu lagu penyembahan dan NYANYIKAN untuk Tuhan — bukan sekadar didengar.',
  '🤫 Ambil 5 menit hening tanpa HP. Biarkan Tuhan berbicara dalam kesunyian.',
  '📖 Baca perlahan satu perikop hari ini — tanyakan: “Tuhan mau bilang apa ke aku?”',
  '🎧 Dengarkan satu khotbah di perjalanan — ganti scrolling dengan firman.',
  '🙏 Doa bukan laporan. Hari ini, ceritakan perasaanmu yang paling jujur ke Bapa.',
  '✋ Berhenti sejenak: “doing for God” atau “being with God”? Pilih yang kedua dulu.',
  '📝 Catat satu firman yang merhema hari ini — jangan biarkan lewat begitu saja.',
  '🌅 Beri Tuhan menit-menit pertamamu, sebelum notifikasi mengambilnya.',
  '💛 Sembah Tuhan bukan karena jawaban doa, tapi karena Dia layak.',
  '🛑 Merasa bersalah saat istirahat? Sabat itu perintah, bukan kemalasan.',
  '🌿 Yesus pun mengundurkan diri ke tempat sunyi untuk berdoa (Luk 5:16). Ikuti ritme-Nya.',
  '❤️‍🩹 Pelayanan tanpa doa itu kekeringan yang tertunda. Isi dulu, baru tuang.',
  '⏳ Sabar itu kunci — proses jauh lebih berharga daripada bukti instan.',
  '🧠 Kurang hikmat? Minta ke Tuhan. Dia memberi dengan murah hati, asal minta tanpa bimbang.',
  '📵 Stop scrolling, start building. Pray hard, work hard.',
  '🌱 Yang tumbuh cepat gampang tumbang. Biarkan Tuhan membangun akarmu dulu.',
  '🔨 Tuhan lebih peduli siapa kamu jadinya daripada seberapa cepat kamu sampai.',
  // --- Kata-kata yang menyegarkan: bukan menyuruh, tapi menenangkan ---
  '🫂 Kamu tidak sedang tertinggal. Tuhan tidak pernah telat, cuma jarang buru-buru.',
  '☕ Tarik napas. Hari ini tidak harus sempurna — cukup dijalani bersama Tuhan.',
  '🌤️ Badai tidak dikirim untuk menenggelamkanmu, tapi untuk mengajarmu berlayar.',
  '🪶 Letakkan yang tidak bisa kamu kendalikan. Itu memang bukan bagianmu.',
  '🌊 Damai sejahtera bukan berarti tidak ada masalah — tapi Tuhan ada di dalamnya.',
  '🕯️ Lelah itu manusiawi. Datang pada-Nya, Dia yang memberi kelegaan (Mat 11:28).',
  '🌻 Kamu berharga bukan karena pencapaianmu, tapi karena Dia menebusmu.',
  '🍞 Cukup untuk hari ini saja. Besok punya anugerahnya sendiri.',
  '🎈 Berhenti membandingkan. Tuhan menulis ceritamu dengan kecepatan yang berbeda.',
  '🌈 Yang kamu doakan diam-diam, Tuhan kerjakan diam-diam juga.',
  '🛶 Kalau hari ini cuma bisa bertahan, itu pun sudah kemenangan. Lanjut besok.',
  '💐 Syukuri satu hal kecil sekarang juga — hati yang bersyukur susah jadi pahit.',
  '🌙 Tidurlah tenang. Dunia tetap berputar tanpa kamu yang menahannya.',
  '🔥 Semangatmu boleh naik-turun; kesetiaan Tuhan tidak pernah.',
  '🧭 Tidak tahu arah? Itu bukan gagal — itu undangan untuk bertanya pada-Nya.',
];

/**
 * Reminder untuk satu hari — sama sepanjang hari, ganti otomatis tiap hari.
 * `salt` memisahkan undiannya supaya dua layar yang menampilkannya pada hari
 * yang sama tidak kebetulan menampilkan kalimat yang persis sama.
 */
export function dailyReminder(todayId: string, salt = 'revive'): string {
  return pickOfDay(REMINDERS, todayId, salt);
}

// ===================== Penyegar acak di Home 🌤️ =====================
// Kalimat yang sama juga muncul SENDIRI di Home beberapa kali sehari, di atas
// kartu Doa Syafaat.
//
// Bedanya dengan Doa Syafaat: syafaat WAJIB muncul tiap hari sepanjang hari,
// sedangkan penyegar ini datang tak terduga — jam munculnya & kalimatnya
// sama-sama diundi.
//
// Undiannya deterministik per hari, BUKAN Math.random: jadwal & kalimat hari
// ini sudah "ditentukan" sejak lewat tengah malam, jadi kartunya tidak
// berkedip muncul-hilang tiap layar digambar ulang, dan tidak berubah walau
// app ditutup lalu dibuka lagi. Besok undiannya beda sendiri karena benihnya
// ikut tanggal.

/** Berapa kali penyegar muncul dalam sehari. */
const NUDGE_COUNT = 3;
/** Jendela jamnya: paling pagi & paling malam. */
const NUDGE_FROM_HOUR = 6;
const NUDGE_TO_HOUR = 22;
/** Sekali muncul, kartunya bertahan selama ini lalu hilang sendiri. */
const NUDGE_SHOW_MINUTES = 60;
/** Jeda minimal sesudah satu kartu hilang sebelum yang berikutnya muncul. */
const NUDGE_GAP_MINUTES = 60;

/** Satu kemunculan penyegar: `from`/`to` = menit sejak tengah malam. */
export type Nudge = { from: number; to: number; text: string };

/**
 * Angka 0–1 yang terasa acak, tapi selalu sama untuk kombinasi hari + kunci
 * yang sama.
 *
 * Hasil `hashString` HARUS diaduk dulu, tidak boleh dipakai mentah: rumusnya
 * `h * 31 + kode-karakter`, jadi dua benih yang cuma beda karakter TERAKHIR
 * ("…|jam0" vs "…|jam1") menghasilkan angka yang selisihnya persis 1. Tanpa
 * pengadukan, keempat bobot celah jadi nyaris kembar → pembagiannya selalu
 * rata → jam munculnya sama persis tiap hari (sempat terbukti begitu: setahun
 * cuma memakai 3 jam yang itu-itu saja).
 *
 * Pengaduknya fmix32 milik MurmurHash3 — beda 1 bit di masukan membalik
 * kira-kira separuh bit keluaran, jadi "…jam0" dan "…jam1" jatuh ke angka yang
 * benar-benar berjauhan.
 */
function seededUnit(dayId: string, key: string): number {
  let x = (hashString(`${dayId}|${key}`) + 0x9e3779b9) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4_294_967_296;
}

/**
 * Jadwal penyegar hari ini — 3 kemunculan, jamnya diundi tapi dijamin tidak
 * saling menempel: sisa waktu di dalam jendela dibagi acak ke celah-celahnya,
 * sedangkan durasi tampil & jeda minimalnya sudah dipesan lebih dulu.
 * Kalimat tiap kemunculan dijamin BERBEDA satu sama lain.
 */
export function nudgeSchedule(dayId: string): Nudge[] {
  const windowStart = NUDGE_FROM_HOUR * 60;
  const windowEnd = NUDGE_TO_HOUR * 60;
  const dipesan =
    NUDGE_COUNT * NUDGE_SHOW_MINUTES + (NUDGE_COUNT - 1) * NUDGE_GAP_MINUTES;
  const sisa = Math.max(0, windowEnd - windowStart - dipesan);

  // Sisa waktu dibagi ke (NUDGE_COUNT + 1) celah: sebelum yang pertama, di
  // antara tiap kemunculan, dan sesudah yang terakhir. Ditambah 0.05 supaya
  // tidak ada celah yang bobotnya nol persis.
  const bobot = Array.from(
    { length: NUDGE_COUNT + 1 },
    (_, i) => seededUnit(dayId, `jam${i}`) + 0.05,
  );
  const totalBobot = bobot.reduce((s, x) => s + x, 0);

  const terpakai = new Set<number>();
  const out: Nudge[] = [];
  let cursor = windowStart;
  for (let i = 0; i < NUDGE_COUNT; i++) {
    cursor += Math.round((bobot[i] / totalBobot) * sisa);
    // Kalau undiannya kebetulan jatuh ke kalimat yang sudah dipakai hari ini,
    // geser ke kalimat berikutnya — sehari tidak pernah mengulang kata.
    let idx = Math.floor(seededUnit(dayId, `kata${i}`) * REMINDERS.length);
    while (terpakai.has(idx)) idx = (idx + 1) % REMINDERS.length;
    terpakai.add(idx);
    out.push({
      from: cursor,
      to: cursor + NUDGE_SHOW_MINUTES,
      text: REMINDERS[idx],
    });
    cursor += NUDGE_SHOW_MINUTES + NUDGE_GAP_MINUTES;
  }
  return out;
}

/** Penyegar yang sedang tampil sekarang — null kalau bukan jamnya. */
export function activeNudge(now: Date, dayId: string): string | null {
  const menit = now.getHours() * 60 + now.getMinutes();
  return (
    nudgeSchedule(dayId).find((n) => menit >= n.from && menit < n.to)?.text ??
    null
  );
}

// ===================== Aplikasi NDC Ministry 📱 =====================
// Dibuka lewat deep link resmi app NDC Ministry. Kalau app-nya belum terpasang
// / skemanya tak dikenali, jatuh ke halaman App Store supaya bisa dipasang.

const NDC_DEEPLINK = 'ndc://';
const NDC_APP_STORE = 'https://apps.apple.com/id/app/ndc-ministry/id1452468715';

export function openNdcMinistry() {
  return openExternalUrl(NDC_DEEPLINK, { fallback: NDC_APP_STORE });
}

// ===================== Pertanyaan pemantik ✨ =====================
// Placeholder kolom Rhema & Aplikasi berganti tiap hari. Satu pertanyaan tetap
// ("renungan hari ini bicara apa ke kamu?") lama-lama cuma jadi hiasan dan
// tidak lagi dibaca — pertanyaan yang berganti memaksa berhenti sebentar dan
// benar-benar berpikir.
//
// Dikunci ke dayId Revive-nya (bukan hari ini), jadi membuka lagi renungan
// tanggal lama akan menampilkan pertanyaan yang sama seperti saat ditulis.

const RHEMA_PROMPTS: string[] = [
  'Bagian mana yang tiba-tiba terasa ditujukan buat kamu?',
  'Kalau ayat ini bicara, Dia sedang bilang apa ke kamu?',
  'Satu kalimat yang paling nempel hari ini — kenapa itu?',
  'Apa yang bikin kamu berhenti sejenak saat membacanya?',
  'Ada bagian yang bikin nggak nyaman? Tulis jujur saja.',
  'Kalau harus diringkas satu kalimat, isinya apa?',
  'Hal apa yang baru kamu sadari hari ini?',
  'Bacaan ini menegur, menghibur, atau menguatkan?',
  'Apa yang Tuhan tunjukkan tentang diri-Nya di sini?',
  'Apa yang Tuhan tunjukkan tentang dirimu di sini?',
  'Kata mana yang paling berat kamu terima? Kenapa?',
  'Kalau ini surat pribadi buat kamu, isinya apa?',
  'Apa yang berubah dari caramu melihat sesuatu?',
  'Ada janji yang justru kamu butuhkan hari ini?',
  'Bagian ini menjawab pergumulanmu yang mana?',
  'Apa yang kamu lihat sekarang, yang kemarin terlewat?',
  'Kalau cerita ke teman, bagian apa yang kamu ceritakan?',
  'Ada yang bikin lega? Tulis pelan-pelan.',
  'Firman ini menyentuh bagian hatimu yang mana?',
  'Satu hal yang tidak mau kamu lupakan dari sini?',
];

const APPLICATION_PROMPTS: string[] = [
  'Satu langkah kecil hari ini — sekecil apa pun.',
  'Apa yang mau kamu lakukan sebelum tidur nanti?',
  'Siapa orang pertama yang perlu merasakan ini?',
  'Apa yang mau kamu berhentikan mulai hari ini?',
  'Kalau ini benar, apa yang harus berubah besok pagi?',
  'Satu hal yang bisa kamu kerjakan dalam 10 menit.',
  'Apa yang mau kamu doakan setelah menutup app ini?',
  'Siapa yang perlu kamu maafkan atau hubungi hari ini?',
  'Kebiasaan mana yang mau kamu ubah minggu ini?',
  'Apa yang mau kamu lakukan walau tidak ada yang lihat?',
  'Bagaimana ini mengubah caramu memperlakukan orang?',
  'Satu keputusan kecil yang bisa kamu ambil sekarang.',
  'Apa yang mau kamu lepaskan hari ini?',
  'Kalau besok kamu lupa semuanya, apa yang tetap kamu bawa?',
  'Apa yang mau kamu kerjakan beda dari kemarin?',
  'Siapa yang bisa kamu kuatkan dengan ini?',
  'Apa yang mau kamu syukuri hari ini?',
  'Hal apa yang mau kamu mulai, walau kecil?',
  'Bagaimana kamu menanggapinya — bukan cuma menyetujuinya?',
  'Apa langkahmu kalau ini benar-benar kamu percaya?',
];

/** Pertanyaan pemantik kolom ✨ Rhema untuk satu hari. */
export function rhemaPrompt(dayId: string): string {
  return pickOfDay(RHEMA_PROMPTS, dayId, 'rhema');
}

/** Pertanyaan pemantik kolom 🏃🏻‍➡️ Aplikasi untuk satu hari. */
export function applicationPrompt(dayId: string): string {
  // Garam berbeda dari rhemaPrompt supaya pasangannya ikut berganti-ganti,
  // bukan selalu kombinasi yang itu-itu juga.
  return pickOfDay(APPLICATION_PROMPTS, dayId, 'aplikasi');
}
