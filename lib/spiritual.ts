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
import { dayIdToDate } from './format';
import { yesterdayId } from './health';
import { hashString } from './core';
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
// users/{uid}/app/revive — bentuknya sama dengan streak login.

export function subscribeReviveStreak(
  uid: string,
  onChange: (streak: DayStreak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'app', 'revive');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as DayStreak) : null);
    },
    onError,
  );
}

/** Panggil saat Revive HARI INI pertama kali disimpan — naik maks 1×/hari. */
export function bumpReviveStreak(
  uid: string,
  current: DayStreak | null,
  todayId: string,
) {
  if (alreadyCounted(current, todayId)) return Promise.resolve();
  return setDoc(
    doc(db, 'users', uid, 'app', 'revive'),
    nextStreak(current, todayId, yesterdayId()),
  );
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
  return onSnapshot(
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
  return onSnapshot(
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
];

/** Reminder hari ini — sama sepanjang hari, ganti otomatis tiap hari. */
export function dailyReminder(todayId: string): string {
  return REMINDERS[hashString(todayId + 'revive') % REMINDERS.length];
}
