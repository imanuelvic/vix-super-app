import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type FirestoreError,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';

import { type LoginStreak as DayStreak } from './achievements';
import {
  isLastChapter,
  nextChapterRef,
  splitBibleRefs,
  usfmRef,
} from './bible';
import { hashString, pickOfDay } from './core';
import { DAYPART } from './daypart';
import { db } from './firebase';
import { dayIdToDate } from './format';
import { yesterdayId } from './health';
import { openExternalUrl } from './linking';
import { liveDoc, liveList } from './liveDoc';
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
  return liveList<ReviveEntry>(q, onChange, onError);
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
//   🌅 Pagi 05.00–09.59 · 🌤️ Siang 12.00–13.59 · 🌙 Malam 21.00–23.59
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
  { key: 'morning', label: 'Pagi', title: 'Morning Reading', emoji: DAYPART.morning, fromHour: 5, toHour: 10 },
  { key: 'daytime', label: 'Siang', title: 'Midday Reading', emoji: DAYPART.daytime, fromHour: 12, toHour: 15 },
  { key: 'night', label: 'Malam', title: 'Night Reading', emoji: DAYPART.night, fromHour: 21, toHour: 24 },
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
 * Jendela sesi ini sudah lewat? Dipakai baris cermin di Habits untuk memberi
 * tanda ✗ SENDIRI: sesi yang jamnya habis tanpa dibaca memang tidak dikerjakan,
 * jadi barisnya tidak boleh dibiarkan menggantung seolah masih bisa dikejar.
 *
 * Catatan sesi Malam: jendelanya tutup jam 24.00, dan pada jam itu juga id
 * harinya sudah berganti — jadi baris Malam tidak pernah sempat terlihat dalam
 * keadaan "lewat" di layar Habits. Itu memang benar, bukan kelalaian: selama
 * masih hari ini, malam masih bisa dikejar.
 */
export function bibleWindowPassed(session: BibleSession, now: Date): boolean {
  return bibleMinutesLeft(session, now) <= 0;
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

// ===================== Versi terjemahan =====================
// Acuan bacaan tanpa terjemahannya masih setengah keterangan: "Amsal 16" di
// TB dan di BIS bunyinya bisa jauh berbeda, dan enam bulan lagi kamu tidak
// akan ingat baca yang mana. Disimpan TERPISAH dari acuannya (bukan disambung
// jadi satu teks) supaya acuannya tetap bisa diurai — pemilih kitab, Story
// ayat, dan pencarian riwayat semuanya membaca acuan yang bersih.

/** Terjemahan bawaan kalau belum pernah diisi — Terjemahan Baru. */
export const BIBLE_VERSION_DEFAULT = 'TB';

/** Terjemahan tiap sesi dalam satu hari. */
export type BibleReadingVersions = Record<BibleSession, string>;

/** Acuan + terjemahannya, siap ditampilkan: "Amsal 16 (TB)". */
export function bibleRefWithVersion(passage: string, version: string): string {
  const acuan = passage.trim();
  // Dirapikan DULU, baru jatuh ke bawaannya — "   " itu truthy, jadi kalau
  // urutannya dibalik terjemahan yang isinya spasi lolos jadi kosong.
  const versi = version.trim() || BIBLE_VERSION_DEFAULT;
  if (!acuan || isBibleSkipped(acuan)) return acuan;
  return `${acuan} (${versi})`;
}

/**
 * Sesi ini benar-benar SUDAH DIBACA hari itu?
 *
 * Bukan sekadar "ada isinya": hari yang ditandai dilewati (`__skip__`) juga
 * tersimpan di kolom yang sama, dan itu jelas bukan membaca. Dipakai baris
 * cermin Baca Alkitab di Habits — aturannya harus SATU supaya centang di
 * Habits tak mungkin beda pendapat dengan catatan bacaannya.
 */
export function bibleSessionRead(
  sessions: BibleReadingSessions,
  session: BibleSession,
): boolean {
  const isi = sessions[session];
  return !!isi && !isBibleSkipped(isi);
}

/**
 * Keadaan yang SEHARUSNYA tampil di baris cermin Baca Alkitab di Habits.
 *
 * Bentuknya sama dengan `fitMirrorState` (lib/fitness.ts) supaya layar Habits
 * memperlakukan semua baris cermin dengan cara yang sama. Termasuk tanda
 * dilewati: sesi yang kamu tandai lewat di layar Baca Alkitab membuat barisnya
 * bertanda ✗ juga — kalau tidak, baris itu tak akan pernah bisa dilewati
 * (tombol ✗-nya memang tidak ada di baris cermin).
 */
export function bibleMirrorState(
  sessions: BibleReadingSessions,
  session: BibleSession,
  now: Date,
): { done: boolean; skipped: boolean } {
  const done = bibleSessionRead(sessions, session);
  return {
    done,
    skipped:
      // Ditandai lewat sendiri di layar Baca Alkitab…
      isBibleSkipped(sessions[session]) ||
      // …ATAU jamnya memang sudah habis tanpa dibaca. Yang kedua ini tidak
      // bisa dibatalkan lagi dari Habits — waktunya sudah lewat, dan angka
      // hariannya harus jujur.
      (!done && bibleWindowPassed(session, now)),
  };
}

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
  /** Terjemahan tiap sesi hari itu — kosong di Firestore berarti TB. */
  versions: BibleReadingVersions;
};

/** Sesi yang jendelanya sedang terbuka sekarang (null = di luar jam baca). */
export function bibleSessionNow(now: Date): BibleSession | null {
  const h = now.getHours();
  return (
    BIBLE_SESSIONS.find((s) => h >= s.fromHour && h < s.toHour)?.key ?? null
  );
}

/**
 * Jam mulai tiap sesi UNTUK MEMILIH TAB arsip — sengaja BEDA dari `fromHour`
 * jendela bacanya, dan bedanya penting.
 *
 * `fromHour` di BIBLE_SESSIONS itu jendela "terhitung tepat waktu": pagi baru
 * mulai jam 5, siang jam 12, malam jam 21, dan di antaranya TIDAK ADA sesi
 * yang berjalan. Itu benar untuk menagih, tapi tab arsip harus punya jawaban
 * SETIAP saat — jam 11, jam 17, jam 20 pun tetap harus membuka sesuatu.
 *
 * Jadi di sini garisnya dibuat bersambung: begitu satu sesi lewat, sesi
 * berikutnya yang terbuka sampai giliran sesudahnya tiba.
 */
export const BIBLE_TAB_HOURS: { key: BibleSession; fromHour: number }[] = [
  { key: 'morning', fromHour: 1 },
  { key: 'daytime', fromHour: 12 },
  { key: 'night', fromHour: 21 },
];

/**
 * Sesi yang jam sekarang termasuk di dalamnya — SELALU ada jawabannya.
 *
 * Dipakai memilih tab yang terbuka saat sub-tab Bible Reading dibuka. Dulu
 * yang dipakai `bibleSessionNow`, dan di luar ketiga jendela bacanya ia
 * mengembalikan null → tabnya jatuh ke Pagi. Akibatnya membuka arsip jam 17.00
 * menampilkan bacaan PAGI, padahal yang barusan dijalani sesi Siang.
 *
 * Jam 00.00–00.59 masih ikut Malam: tengah malam itu ekor hari kemarin, bukan
 * awal pagi berikutnya.
 */
export function bibleSessionOfClock(now: Date): BibleSession {
  const h = now.getHours();
  const cocok = [...BIBLE_TAB_HOURS].reverse().find((s) => h >= s.fromHour);
  return cocok?.key ?? 'night';
}

function readSessions(data?: Record<string, unknown>): BibleReadingSessions {
  return {
    morning: (data?.morning as string) ?? '',
    daytime: (data?.daytime as string) ?? '',
    night: (data?.night as string) ?? '',
  };
}

/**
 * Terjemahan tiap sesi. Disimpan sebagai field datar (`morningVersion`, …)
 * supaya `setDoc(..., { merge: true })` per sesi tetap sesederhana sebelumnya.
 *
 * Catatan yang dibuat SEBELUM kolom ini ada tidak punya field-nya sama sekali
 * → semuanya jatuh ke TB. Itu memang benar: seluruh catatan lama dibuat dari
 * Terjemahan Baru.
 */
function readVersions(data?: Record<string, unknown>): BibleReadingVersions {
  const ambil = (k: string) =>
    ((data?.[k] as string) || '').trim() || BIBLE_VERSION_DEFAULT;
  return {
    morning: ambil('morningVersion'),
    daytime: ambil('daytimeVersion'),
    night: ambil('nightVersion'),
  };
}

/** Satu dokumen hari → satu baris riwayat. Dipakai langganan & sekali-ambil. */
function bibleDayRow(d: QueryDocumentSnapshot): BibleReadingDay {
  return {
    id: d.id,
    ...readSessions(d.data()),
    date: d.data().date as Timestamp,
    versions: readVersions(d.data()),
  };
}

/** Kueri riwayat bacaan, terbaru → terlama. `n` = berapa HARI ke belakang. */
function bibleDaysQuery(uid: string, n: number) {
  // orderBy satu field saja → tidak butuh composite index.
  return query(
    collection(db, 'users', uid, 'bibleRead'),
    orderBy('date', 'desc'),
    limit(n),
  );
}

/** Riwayat 90 hari terakhir — untuk tab Bible Reading di Spiritual. */
export function subscribeBibleReadingDays(
  uid: string,
  onChange: (days: BibleReadingDay[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveList<BibleReadingDay>(
    bibleDaysQuery(uid, 90),
    onChange,
    onError,
    bibleDayRow,
  );
}

// =============== Rekomendasi bacaan berikutnya 💡 ===============
// Baca Alkitab itu berurutan: kemarin Amsal 2, hari ini Amsal 3. Jadi kolom
// "Bacaan 1" tidak perlu dimulai dari kosong — sambungan dari catatan
// terakhirlah yang hampir selalu benar, dan kalau meleset tinggal diganti.
//
// TIAP SESI punya rantainya SENDIRI (pagi Amsal, siang Yesaya, malam
// 1 Petrus itu tiga bacaan berbeda), jadi yang ditengok cuma kolom sesi itu.

/**
 * Berapa hari ke belakang yang ditengok saat mencari bacaan terakhir.
 *
 * Sebulan: cukup panjang untuk melewati minggu yang bolong, dan biayanya
 * jelas — sekali buka layar catat bacaan = sekali kueri, bukan langganan yang
 * hidup terus. Lebih lama dari itu, rekomendasinya sendiri sudah tidak
 * relevan (bacaan sebulan lalu biasanya sudah ditinggalkan).
 */
export const BIBLE_SUGGEST_DAYS = 30;

export type BibleSuggestion = {
  /** Acuan terakhir yang tercatat di sesi ini, mis. "Amsal 2". */
  last: string;
  /** Kapan itu dibaca ("YYYY-MM-DD") — supaya jelas menyambung dari kapan. */
  dayId: string;
  /** Pasal berikutnya — null kalau kitabnya tamat / namanya tak dikenali. */
  next: string | null;
  /** Kitabnya sudah tamat (pasal terakhir) → waktunya pilih kitab baru. */
  finished: boolean;
  /** Terjemahan yang dipakai terakhir kali di sesi ini. */
  version: string;
};

/**
 * Sambungan dari catatan TERAKHIR sesi ini. `days` harus urut terbaru →
 * terlama (seperti yang dikembalikan kueri di atas).
 *
 * Hari yang kosong & hari yang ditandai dilewati dilompati — keduanya bukan
 * bacaan. Kalau satu hari mencatat beberapa kitab ("Amsal 30, Amsal 31"),
 * yang jadi acuan yang TERAKHIR, karena itu yang paling jauh dibaca.
 */
export function bibleSuggestion(
  days: BibleReadingDay[],
  session: BibleSession,
): BibleSuggestion | null {
  for (const d of days) {
    const isi = d[session];
    if (!isi || isBibleSkipped(isi)) continue;
    const refs = splitBibleRefs(isi);
    const last = refs[refs.length - 1];
    if (!last) continue;
    return {
      last,
      dayId: d.id,
      next: nextChapterRef(last),
      finished: isLastChapter(last),
      version: d.versions[session] || BIBLE_VERSION_DEFAULT,
    };
  }
  return null;
}

/** Rekomendasi KETIGA sesi sekaligus (null = sesi itu belum punya riwayat). */
export type BibleSuggestions = Record<BibleSession, BibleSuggestion | null>;

/**
 * Ambil rekomendasi — SEKALI JALAN, bukan langganan: saran tidak perlu ikut
 * berubah selagi layarnya terbuka, dan sekali ambil jauh lebih murah daripada
 * listener yang hidup selama layar itu dibuka.
 *
 * Ketiga sesi dihitung dari SATU kueri yang sama. Riwayatnya toh sudah di
 * tangan, jadi memisahnya per sesi cuma akan jadi tiga kueri untuk dokumen
 * yang sama persis.
 */
export async function fetchBibleSuggestions(
  uid: string,
): Promise<BibleSuggestions> {
  const snapshot = await getDocs(bibleDaysQuery(uid, BIBLE_SUGGEST_DAYS));
  const days = snapshot.docs.map(bibleDayRow);
  return {
    morning: bibleSuggestion(days, 'morning'),
    daytime: bibleSuggestion(days, 'daytime'),
    night: bibleSuggestion(days, 'night'),
  };
}

/** HANYA hari ini — dipakai Dashboard (1 dokumen saja, hemat read). */
export function subscribeBibleReadingToday(
  uid: string,
  dayId: string,
  onChange: (
    sessions: BibleReadingSessions,
    versions: BibleReadingVersions,
  ) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'bibleRead', dayId),
    (snapshot) =>
      onChange(readSessions(snapshot.data()), readVersions(snapshot.data())),
    onError,
  );
}

/**
 * Simpan bacaan SATU sesi — merge, jadi sesi lain di hari itu tidak tersentuh.
 *
 * `version` boleh dikosongkan; yang tersimpan tetap TB. Ditulis walau sama
 * dengan bawaannya supaya catatannya jujur menyebut terjemahan yang dipakai,
 * bukan menebak dari kekosongan.
 */
export function saveBibleReading(
  uid: string,
  dayId: string,
  session: BibleSession,
  passage: string,
  version: string = BIBLE_VERSION_DEFAULT,
) {
  return setDoc(
    doc(db, 'users', uid, 'bibleRead', dayId),
    {
      [session]: passage,
      [`${session}Version`]: version.trim() || BIBLE_VERSION_DEFAULT,
      date: Timestamp.fromDate(dayIdToDate(dayId)),
    },
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
  // --- Ayat Alkitab ---
  // Dikutip apa adanya (Terjemahan Baru), dipendekkan seperlunya dengan "…"
  // dan SELALU disertai acuannya. Bukan supaya terlihat rohani: kalimat yang
  // dibagikan ke orang lain harus bisa dicek sendiri sumbernya. Firman yang
  // dikutip tanpa alamat pelan-pelan berubah jadi kutipan motivasi biasa.
  '🕊️ "Damai sejahtera Kutinggalkan bagimu… janganlah gelisah dan gentar hatimu." — Yoh 14:27',
  '🦅 "Orang yang menanti-nantikan TUHAN mendapat kekuatan baru… mereka berlari dan tidak menjadi lesu." — Yes 40:31',
  '🛡️ "Janganlah takut, sebab Aku menyertai engkau… Aku akan meneguhkan, bahkan akan menolong engkau." — Yes 41:10',
  '🧡 "Serahkanlah segala kekuatiranmu kepada-Nya, sebab Ia yang memelihara kamu." — 1 Ptr 5:7',
  '🌱 "Segala perkara dapat kutanggung di dalam Dia yang memberi kekuatan kepadaku." — Flp 4:13',
  '🙏 "Janganlah hendaknya kamu kuatir tentang apa pun juga, tetapi nyatakanlah… keinginanmu kepada Allah dalam doa." — Flp 4:6',
  '🌟 "Percayalah kepada TUHAN dengan segenap hatimu, dan janganlah bersandar pada pengertianmu sendiri." — Ams 3:5',
  '🕯️ "Firman-Mu itu pelita bagi kakiku dan terang bagi jalanku." — Mzm 119:105',
  '🌄 "Tak berkesudahan kasih setia TUHAN… selalu baru tiap pagi." — Rat 3:22-23',
  '🤲 "Marilah kepada-Ku, semua yang letih lesu dan berbeban berat, Aku akan memberi kelegaan kepadamu." — Mat 11:28',
  '🎯 "Carilah dahulu Kerajaan Allah dan kebenarannya, maka semuanya itu akan ditambahkan kepadamu." — Mat 6:33',
  '💪 "Kuatkan dan teguhkanlah hatimu… sebab TUHAN, Allahmu, menyertai engkau ke mana pun engkau pergi." — Yos 1:9',
  '🌊 "Apabila engkau menyeberang melalui air, Aku akan menyertai engkau." — Yes 43:2',
  '🍇 "Tinggallah di dalam Aku dan Aku di dalam kamu… di luar Aku kamu tidak dapat berbuat apa-apa." — Yoh 15:4-5',
  '🌈 "Kita tahu sekarang, bahwa Allah turut bekerja dalam segala sesuatu untuk mendatangkan kebaikan." — Rm 8:28',
  '🔥 "Janganlah kendor dalam kerajinan. Biarlah rohmu menyala-nyala dan layanilah Tuhan." — Rm 12:11',
  '🌾 "Janganlah kita jemu-jemu berbuat baik, karena… kita akan menuai, jika kita tidak menjadi lemah." — Gal 6:9',
  '🙌 "Segala sesuatu yang kamu perbuat, perbuatlah dengan segenap hatimu seperti untuk Tuhan." — Kol 3:23',
  '🌤️ "Berbahagialah orang yang sabar bertahan dalam pencobaan…" — Yak 1:12',
  '🫶 "Kasihilah TUHAN, Allahmu, dengan segenap hatimu… dan kasihilah sesamamu manusia seperti dirimu sendiri." — Mat 22:37,39',
  '📖 "Hendaklah perkataan Kristus diam dengan segala kekayaannya di antara kamu." — Kol 3:16',
  '🌙 "Dengan tenteram aku mau membaringkan diri, lalu segera tidur, sebab hanya Engkau, ya TUHAN, yang membiarkan aku diam dengan aman." — Mzm 4:9',
  '🧗 "Sebab kita hidup karena percaya, bukan karena melihat." — 2 Kor 5:7',
  '🪨 "TUHAN adalah gunung batuku, kubu pertahananku dan penyelamatku." — Mzm 18:3',
  '🌻 "Bersukacitalah senantiasa dalam Tuhan! Sekali lagi kukatakan: Bersukacitalah!" — Flp 4:4',
  '🧎 "Rendahkanlah dirimu di hadapan Tuhan, dan Ia akan meninggikan kamu." — Yak 4:10',
  '🍞 "Akulah roti hidup; barangsiapa datang kepada-Ku, ia tidak akan lapar lagi." — Yoh 6:35',
  '⏰ "Untuk segala sesuatu ada masanya, untuk apa pun di bawah langit ada waktunya." — Pkh 3:1',
  '💧 "Ia membaringkan aku di padang yang berumput hijau, Ia membimbing aku ke air yang tenang." — Mzm 23:2',
  '🕊️ "Berbahagialah orang yang membawa damai, karena mereka akan disebut anak-anak Allah." — Mat 5:9',
  '✨ "Hendaklah terangmu bercahaya di depan orang, supaya mereka melihat perbuatanmu yang baik." — Mat 5:16',
  '🔑 "Mintalah, maka akan diberikan kepadamu; carilah, maka kamu akan mendapat." — Mat 7:7',
];

/**
 * Reminder untuk satu hari — sama sepanjang hari, ganti otomatis tiap hari.
 * `salt` memisahkan undiannya supaya dua layar yang menampilkannya pada hari
 * yang sama tidak kebetulan menampilkan kalimat yang persis sama.
 */
export function dailyReminder(todayId: string, salt = 'revive'): string {
  return pickOfDay(REMINDERS, todayId, salt);
}

// ===================== Reminder tulisanmu sendiri 📌 =====================
// Rhema & Aplikasi yang kamu tulis di Revive bisa "dipasang" jadi salah satu
// penyegar harian di Home — jadi firman yang merhema hari Senin masih menegur
// kamu hari Kamis, bukan tenggelam di riwayat.
//
// SATU dokumen kecil untuk semuanya (users/{uid}/app/myReminders), pola yang
// sama dengan arsip Fun: 1 listener, 1 read, tak peduli sudah terkumpul berapa
// kalimat. Memasang & melepas menulis ulang array-nya.

export type MyReminderKind = 'rhema' | 'application';

export type MyReminder = {
  /** `${day}-${kind}` — satu Rhema & satu Aplikasi per hari, tak bisa dobel. */
  id: string;
  text: string;
  /** dayId Revive asalnya — dipakai Home untuk membuka catatannya kembali. */
  day: string;
  kind: MyReminderKind;
};

export type MyReminders = { items: MyReminder[] };

export const EMPTY_MY_REMINDERS: MyReminders = { items: [] };

/**
 * Batas panjang kalimat yang dipasang.
 *
 * Bukan selera: kartu di Home dibaca sekilas, dan tombol 📤-nya menggambar
 * kalimat itu ke kartu persegi 1080×1080 yang muat ±600 huruf (lihat
 * lib/reminderImage.ts). Rhema yang ditulis panjang lebar — dan memang sering
 * begitu, karena kolomnya besar — akan tumpah keluar gambarnya tanpa ada yang
 * memberi tahu. Dipotong di sini, sekali, bukan di tiga tempat penampil.
 */
export const MY_REMINDER_MAX = 400;

/** Potong kalimat yang kepanjangan di batas kata terdekat + "…". */
export function clampReminder(text: string): string {
  const isi = text.trim();
  if (isi.length <= MY_REMINDER_MAX) return isi;
  const potong = isi.slice(0, MY_REMINDER_MAX);
  const spasi = potong.lastIndexOf(' ');
  return `${(spasi > MY_REMINDER_MAX - 60 ? potong.slice(0, spasi) : potong).trimEnd()}…`;
}

export function myReminderId(day: string, kind: MyReminderKind): string {
  return `${day}-${kind}`;
}

/** Kalimat dari hari & bagian itu sudah dipasang jadi reminder? */
export function myReminderOn(
  items: MyReminder[],
  day: string,
  kind: MyReminderKind,
): boolean {
  const id = myReminderId(day, kind);
  return items.some((m) => m.id === id);
}

function myRemindersDoc(uid: string) {
  return doc(db, 'users', uid, 'app', 'myReminders');
}

/** Dengarkan seluruh reminder yang kamu pasang sendiri (1 dokumen). */
export function subscribeMyReminders(
  uid: string,
  onChange: (items: MyReminder[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    myRemindersDoc(uid),
    (snapshot) => {
      const data = snapshot.exists()
        ? (snapshot.data() as MyReminders)
        : EMPTY_MY_REMINDERS;
      onChange(data.items ?? []);
    },
    onError,
  );
}

/** Tulis ulang seluruh daftar (dipakai memasang, melepas, & menyegarkan). */
export function saveMyReminders(uid: string, items: MyReminder[]) {
  return setDoc(myRemindersDoc(uid), { items });
}

/**
 * Pasang kalimat ini jadi reminder — atau LEPAS lagi kalau memang sudah
 * terpasang. Melepasnya permanen: barisnya benar-benar hilang dari daftar,
 * bukan ditandai mati.
 */
export function toggleMyReminder(
  uid: string,
  items: MyReminder[],
  entry: { day: string; kind: MyReminderKind; text: string },
) {
  const id = myReminderId(entry.day, entry.kind);
  const sudah = items.some((m) => m.id === id);
  const next = sudah
    ? items.filter((m) => m.id !== id)
    : [
        ...items,
        { id, day: entry.day, kind: entry.kind, text: clampReminder(entry.text) },
      ];
  return saveMyReminders(uid, next);
}

/**
 * Segarkan kalimat reminder yang berasal dari Revive hari itu, supaya yang
 * muncul di Home tidak ketinggalan dari tulisan yang barusan disimpan.
 * TIDAK memasang apa pun yang belum pernah dipasang. `null` = tak ada yang
 * berubah, jadi pemanggilnya tidak perlu menulis ke Firestore sama sekali.
 */
export function refreshMyReminders(
  items: MyReminder[],
  day: string,
  text: { rhema: string; application: string },
): MyReminder[] | null {
  let berubah = false;
  const next = items.map((m) => {
    if (m.day !== day) return m;
    const isi = clampReminder(
      m.kind === 'rhema' ? text.rhema : text.application,
    );
    if (!isi || isi === m.text) return m;
    berubah = true;
    return { ...m, text: isi };
  });
  return berubah ? next : null;
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

/**
 * Satu kemunculan penyegar: `from`/`to` = menit sejak tengah malam.
 *
 * `day` cuma terisi kalau kalimatnya datang dari Revive-mu sendiri — itulah
 * yang membuat kartunya bisa di-klik balik ke catatan asalnya.
 */
export type Nudge = { from: number; to: number; text: string; day?: string };

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

// ===================== Ayat penyembahan 🎶 =====================
// Subjudul layar Spiritual. Dulu satu kalimat tetap ("Being with God, bukan
// sekadar doing for God"); sekarang ayat tentang memuji & menyembah yang
// berganti tiap hari.
//
// Diundi dari `dayId`, BUKAN acak tiap render — jadi sepanjang hari itu
// bunyinya sama persis: pindah-pindah sub-tab tidak menggantinya, dan tidak
// ada tulisan yang berkedip.
//
// PANJANGNYA PUNYA BATAS, dan batasnya bukan selera: subjudul ini satu baris
// selebar header (393 − 40 = 353pt di iPhone 15). Kalau ada satu ayat yang
// lebih panjang, hari itu saja ia pecah dua baris — headernya jadi lebih
// tinggi dan seluruh isi layarnya turun, persis keluhan yang mau dihilangkan.
// Yang terpanjang di daftar ini 346pt, diukur dari metrik font Inter-nya
// sendiri. Menambah ayat? Ukur dulu.
export const WORSHIP_VERSES: string[] = [
  'Menyembah dalam roh dan kebenaran — Yohanes 4:24',
  'Segala yang bernapas, pujilah TUHAN — Mazmur 150:6',
  'Bersyukurlah, pujilah nama-Nya — Mazmur 100:4',
  'Nyanyikanlah nyanyian baru — Mazmur 96:1',
  'Memuji TUHAN seumur hidupku — Mazmur 146:2',
  'Marilah kita sujud menyembah — Mazmur 95:6',
  'Tubuhmu, persembahan yang hidup — Roma 12:1',
  'Menyanyikan kasih setia-Mu pagi hari — Mazmur 59:17',
  'Muliakanlah TUHAN bersamaku — Mazmur 34:4',
  'Bersukacitalah senantiasa dalam Tuhan — Filipi 4:4',
  'Naikkan syukur sebagai korban — Mazmur 50:14',
  'Korban bibir yang memuji nama-Nya — Ibrani 13:15',
];

/** Ayat penyembahan untuk hari ini — sama sepanjang hari itu. */
export function worshipVerseOfDay(dayId: string): string {
  const i = Math.floor(seededUnit(dayId, 'worship') * WORSHIP_VERSES.length);
  // Pengaman kalau hasil undiannya persis 1 (secara teori bisa membulat ke
  // panjang daftarnya) — jangan sampai subjudulnya jadi `undefined`.
  return WORSHIP_VERSES[Math.min(i, WORSHIP_VERSES.length - 1)];
}

/**
 * Jadwal penyegar hari ini — 3 kemunculan, jamnya diundi tapi dijamin tidak
 * saling menempel: sisa waktu di dalam jendela dibagi acak ke celah-celahnya,
 * sedangkan durasi tampil & jeda minimalnya sudah dipesan lebih dulu.
 * Kalimat tiap kemunculan dijamin BERBEDA satu sama lain.
 *
 * `mine` = kalimat yang kamu pasang sendiri dari Revive. Kalau ada, SATU dari
 * ketiga giliran hari itu diganti dengan salah satunya (yang mana, diundi per
 * hari juga). Sengaja mengganti giliran, bukan ikut diadu di satu kantong
 * besar: tulisanmu sendiri jadi dijamin muncul tiap hari — kalau dicampur, satu
 * kalimatmu cuma punya peluang 1 : 65 melawan daftar bawaan. Daftar kosong →
 * hasilnya persis sama seperti sebelum fitur ini ada.
 */
export function nudgeSchedule(dayId: string, mine: MyReminder[] = []): Nudge[] {
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

  // Satu giliran diserahkan ke tulisanmu sendiri (kalau ada yang dipasang).
  if (mine.length > 0) {
    const giliran = Math.min(
      Math.floor(seededUnit(dayId, 'punyaku') * NUDGE_COUNT),
      NUDGE_COUNT - 1,
    );
    const pilih =
      mine[
        Math.min(
          Math.floor(seededUnit(dayId, 'punyakuIsi') * mine.length),
          mine.length - 1,
        )
      ];
    out[giliran] = { ...out[giliran], text: pilih.text, day: pilih.day };
  }
  return out;
}

/** Penyegar yang sedang tampil sekarang — null kalau bukan jamnya. */
export function activeNudge(
  now: Date,
  dayId: string,
  mine: MyReminder[] = [],
): Nudge | null {
  const menit = now.getHours() * 60 + now.getMinutes();
  return (
    nudgeSchedule(dayId, mine).find((n) => menit >= n.from && menit < n.to) ??
    null
  );
}

// ===================== Aplikasi luar 📱 =====================
// Dibuka lewat deep link resmi masing-masing. Kalau app-nya belum terpasang /
// skemanya tak dikenali, jatuh ke halaman App Store supaya bisa dipasang.
//
// Dua app, dua keperluan yang memang berbeda:
//   NDC Ministry → renungan harian NDC (dipakai layar Tulis Revive ✍️)
//   YouVersion   → Alkitabnya sendiri (dipakai layar Baca Alkitab 📖)

const NDC_DEEPLINK = 'ndc://';
const NDC_APP_STORE = 'https://apps.apple.com/id/app/ndc-ministry/id1452468715';

export function openNdcMinistry() {
  return openExternalUrl(NDC_DEEPLINK, { fallback: NDC_APP_STORE });
}

// YouVersion (nama resminya di App Store cuma "Bible", penerbitnya Life.Church).
const YOUVERSION_DEEPLINK = 'youversion://';
const YOUVERSION_APP_STORE = 'https://apps.apple.com/id/app/bible/id282935706';

/**
 * Nomor terjemahan di YouVersion, dipetakan dari singkatan yang KAMU tulis di
 * kolom "Terjemahan".
 *
 * ⚠️ Sengaja cuma diisi yang sudah dipastikan. Menebak nomornya berbahaya:
 * nomor yang salah tetap membuka Alkitab, tapi di TERJEMAHAN LAIN — dan itu
 * tidak kelihatan salah sampai kamu membaca ayatnya.
 *
 * Menambah sendiri gampang: buka bible.com, pilih terjemahannya, lihat
 * alamatnya — `bible.com/bible/306/PRO.29.TB` → angka 306 itulah nomornya.
 * Singkatan yang belum ada di sini tetap dibuka ke pasal yang benar, cuma
 * pakai terjemahan yang terakhir kamu buka di YouVersion.
 */
export const YOUVERSION_VERSION_ID: Record<string, number> = {
  TB: 306, // Alkitab Terjemahan Baru (LAI)
};

/** Nomor terjemahan untuk singkatan ini (null = belum terdaftar). */
export function youVersionVersionId(version: string): number | null {
  return YOUVERSION_VERSION_ID[version.trim().toUpperCase()] ?? null;
}

/**
 * Alamat YouVersion untuk satu acuan — dipakai tombol 📖 Buka YouVersion dan
 * tiap baris riwayat bacaan.
 *
 * `reference` memakai kode USFM (lihat lib/bible.ts): PRO.29, JHN.3.16 — kode
 * yang sama di semua bahasa, jadi tidak bergantung nama kitab bahasa Indonesia.
 * `version` ditempelkan HANYA kalau nomornya sudah dipastikan; kalau tidak,
 * YouVersion membuka pasal yang benar dengan terjemahan yang sedang aktif di
 * sana — lebih baik daripada salah terjemahan diam-diam.
 */
export function youVersionLink(
  refText: string,
  version?: string,
): { scheme: string; web: string } {
  const usfm = usfmRef(refText);
  if (!usfm) {
    // Kitabnya tak dikenali → buka YouVersion apa adanya, seperti dulu.
    return { scheme: YOUVERSION_DEEPLINK, web: 'https://www.bible.com/' };
  }
  const id = version ? youVersionVersionId(version) : null;
  return {
    scheme: `youversion://bible?reference=${usfm}${id ? `&version=${id}` : ''}`,
    web: id
      ? `https://www.bible.com/bible/${id}/${usfm}`
      : `https://www.bible.com/search/bible?q=${encodeURIComponent(refText)}`,
  };
}

/**
 * Buka YouVersion. Tanpa acuan → halaman depannya (seperti dulu); dengan
 * acuan → langsung ke pasalnya.
 *
 * Cadangannya bertingkat: skema app → alamat web bible.com → halaman App
 * Store (kalau app-nya memang belum terpasang & webnya pun gagal dibuka).
 */
export function openYouVersion(refText?: string, version?: string) {
  if (!refText?.trim()) {
    return openExternalUrl(YOUVERSION_DEEPLINK, {
      fallback: YOUVERSION_APP_STORE,
    });
  }
  const { scheme, web } = youVersionLink(refText, version);
  return openExternalUrl(scheme, {
    fallback: web,
    onError: () => void openExternalUrl(YOUVERSION_APP_STORE),
  });
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
