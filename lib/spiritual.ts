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
import { dayDocId } from './health';
import { hashString } from './core';

// Spiritual ✝️ — jurnal REVIVE harian (mengikuti struktur renungan NDC:
// judul, bacaan Alkitab, ayat hafalan, rhema, refleksi) + reminder acak
// untuk fokus pada hubungan pribadi dengan Tuhan + streak ala Duolingo.
//
// "Doing for God without being with God" — fitur ini ruang untuk BERHENTI.

export type ReviveEntry = {
  id: string; // "YYYY-MM-DD" — satu jurnal per hari
  title: string; // judul renungan, mis. "ARE YOU TOO BUSY TO BE WITH GOD?"
  passage: string; // bacaan Alkitab, mis. "Lukas 5:15-16"
  verse: string; // ayat hafalan, mis. "Lukas 5:16"
  rhema: string; // firman yang merhema di hati (inti journaling)
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

function yesterdayId(): string {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return dayDocId(y);
}

/** Panggil saat jurnal HARI INI pertama kali disimpan — naik maks 1×/hari. */
export function bumpReviveStreak(
  uid: string,
  current: DayStreak | null,
  todayId: string,
) {
  if (current?.lastDayId === todayId) return Promise.resolve();
  const continued = current !== null && current.lastDayId === yesterdayId();
  const count = continued ? current.count + 1 : 1;
  return setDoc(doc(db, 'users', uid, 'app', 'revive'), {
    count,
    lastDayId: todayId,
    best: Math.max(count, current?.best ?? 0),
    total: (current?.total ?? 0) + 1,
  });
}

// ===================== Bacaan Alkitab harian 📖 =====================
// Checklist ringan "sudah baca minimal 1 pasal hari ini". Satu dokumen kecil:
// users/{uid}/app/bibleReading → { lastDayId }. Sudah baca hari ini kalau
// lastDayId === hari ini. Catatan: kalau sudah Revive hari ini juga dianggap
// sudah baca (Revive termasuk baca firman) — penggabungan itu dicek di layar.

export function subscribeBibleReading(
  uid: string,
  onChange: (lastDayId: string | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'app', 'bibleReading');
  return onSnapshot(
    ref,
    (snapshot) => onChange((snapshot.data()?.lastDayId as string) ?? null),
    onError,
  );
}

/** Tandai (atau batalkan) sudah baca ≥1 pasal hari ini. */
export function setBibleReadingDone(
  uid: string,
  todayId: string,
  done: boolean,
) {
  return setDoc(doc(db, 'users', uid, 'app', 'bibleReading'), {
    lastDayId: done ? todayId : '',
  });
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
