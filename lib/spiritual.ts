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
import { pickOfDay } from './core';
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
 * Rentetan 🔥 tidak diubah di sini — dan memang tidak perlu: hari yang
 * dilewati tidak pernah tercatat, jadi rentetannya putus dengan sendirinya
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

// ===================== Bacaan Alkitab 📖 (Pagi & Malam) =====================
// DUA sesi baca per hari, masing-masing punya jendela jam sendiri:
//   🌅 Pagi  05.00–09.59   ·   🌙 Malam 21.00–23.59
// Kartu reminder di Home hanya muncul di dalam jendela itu & selama sesi hari
// itu belum diisi. Isinya string bebas: kitab/pasal yang dibaca.
//
// Satu dokumen kecil per hari: users/{uid}/bibleRead/{YYYY-MM-DD}
//   { morning: string, night: string, date: Timestamp }
// Sesi bernilai "" = belum diisi hari itu.
// CATATAN: nama koleksi tetap `bibleRead` (bukan `bibleReading`) — mengubahnya
// akan memutus semua catatan bacaan yang sudah tersimpan di Firestore.

export type BibleSession = 'morning' | 'night';

export const BIBLE_SESSIONS: {
  key: BibleSession;
  label: string; // "Pagi" / "Malam" — untuk tab riwayat
  title: string; // judul kartu di Home & layar catat bacaan
  emoji: string;
  fromHour: number; // jendela mulai (inklusif)
  toHour: number; // jendela selesai (eksklusif)
}[] = [
  { key: 'morning', label: 'Pagi', title: 'Morning Bible Reading', emoji: '🌅', fromHour: 5, toHour: 10 },
  { key: 'night', label: 'Malam', title: 'Night Bible Reading', emoji: '🌙', fromHour: 21, toHour: 24 },
];

export function bibleSessionMeta(session: BibleSession) {
  return BIBLE_SESSIONS.find((s) => s.key === session)!;
}

/**
 * Penanda "hari ini dilewati" — disimpan di kolom yang sama dengan bacaannya.
 * Gunanya: kartu reminder di Home berhenti menagih untuk hari itu, TAPI
 * rentetan 🔥 sengaja TIDAK naik — dilewati ya dilewati, tidak dihitung baca.
 */
export const BIBLE_SKIPPED = '__skip__';

export function isBibleSkipped(passage: string): boolean {
  return passage === BIBLE_SKIPPED;
}

/** Isi kedua sesi dalam satu hari ("" = belum diisi). */
export type BibleReadingSessions = { morning: string; night: string };

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
// Tiga rentetan sekaligus supaya cukup 1 read: pagi, malam, dan "lengkap"
// (hari yang pagi & malamnya sama-sama terisi). Bentuk tiap rentetan sama
// dengan streak doa/Revive: { count, lastDayId, best, total }.

export type BibleStreaks = {
  morning: DayStreak;
  night: DayStreak;
  both: DayStreak;
};

export const EMPTY_BIBLE_STREAKS: BibleStreaks = {
  morning: EMPTY_DAY_STREAK,
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
        night: (d?.night as DayStreak) ?? EMPTY_DAY_STREAK,
        both: (d?.both as DayStreak) ?? EMPTY_DAY_STREAK,
      });
    },
    onError,
  );
}

/** Naikkan satu rentetan — maks 1×/hari, putus kalau kemarin bolong. */
function bumpDayStreak(current: DayStreak, todayId: string): DayStreak {
  if (alreadyCounted(current, todayId)) return current;
  return nextStreak(current, todayId, yesterdayId());
}

/**
 * Catat streak SESUDAH bacaan tersimpan. `bothFilled` = pagi & malam hari ini
 * dua-duanya sudah terisi → rentetan "lengkap" ikut naik.
 */
export function bumpBibleStreaks(
  uid: string,
  current: BibleStreaks,
  todayId: string,
  session: BibleSession,
  bothFilled: boolean,
) {
  const next: BibleStreaks = {
    morning:
      session === 'morning'
        ? bumpDayStreak(current.morning, todayId)
        : current.morning,
    night:
      session === 'night' ? bumpDayStreak(current.night, todayId) : current.night,
    both: bothFilled ? bumpDayStreak(current.both, todayId) : current.both,
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
];

/** Reminder hari ini — sama sepanjang hari, ganti otomatis tiap hari. */
export function dailyReminder(todayId: string): string {
  return pickOfDay(REMINDERS, todayId, 'revive');
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
