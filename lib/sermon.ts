import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate, formatFullDate } from './format';
import { dayDocId } from './health';
import { liveDoc, liveList } from './liveDoc';

// Catatan Khotbah ⛪ — catatan dari khotbah ibadah Minggu di NDC.
// SATU catatan per hari Minggu: id dokumen = dayId Minggunya, jadi tidak
// mungkin ada dua catatan untuk Minggu yang sama. Hanya bisa DITAMBAH pada
// hari Minggu (tombolnya muncul khusus hari itu).
// Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.

export type SermonNote = {
  id: string; // dayId Minggu "YYYY-MM-DD"
  title: string; // judul khotbah
  preacher: string; // pendeta yang khotbah
  serviceTime: string; // ibadah jam berapa
  quote: string; // hikmat / quote dari khotbah
  /**
   * Catatan khotbah utuh — poin-poin yang dicatat selama ibadah. Ini yang
   * paling panjang (bisa puluhan baris), makanya mengisinya di layar sendiri,
   * bukan modal.
   *
   * Opsional di tipe karena catatan LAMA (dibuat sebelum kolom ini ada) tidak
   * punya field-nya di Firestore — dibaca jadi undefined, bukan error.
   */
  note?: string;
  reflection: string; // aplikasi: apa yang mau diterapkan
  date: Timestamp;
};

export function subscribeSermons(
  uid: string,
  onChange: (notes: SermonNote[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(
    collection(db, 'users', uid, 'sermons'),
    orderBy('date', 'desc'),
    limit(90),
  );
  return liveList<SermonNote>(q, onChange, onError);
}

/** Dengarkan SATU catatan khotbah — untuk layar bacanya (1 dokumen kecil). */
export function subscribeSermon(
  uid: string,
  sundayId: string,
  onChange: (note: SermonNote | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'sermons', sundayId),
    (snapshot) => {
      const data = snapshot.data();
      onChange(
        data ? ({ id: sundayId, ...data } as SermonNote) : null,
      );
    },
    onError,
  );
}

export function saveSermon(
  uid: string,
  sundayId: string,
  data: {
    title: string;
    preacher: string;
    serviceTime: string;
    quote: string;
    note: string;
    reflection: string;
    date: Date;
  },
) {
  return setDoc(doc(db, 'users', uid, 'sermons', sundayId), {
    ...data,
    date: Timestamp.fromDate(data.date),
  });
}

export function deleteSermon(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'sermons', id));
}

/**
 * Teks siap kirim ke WhatsApp. Bagian yang kosong dilewati, jadi catatan yang
 * cuma diisi sebagian tidak terkirim dengan judul menggantung.
 *
 * Pindah ke sini (dulu di dalam SermonTab) karena layar bacanya juga memakai —
 * kalau disalin, dua tempat itu suatu saat pasti jadi berbeda isi.
 */
export function sermonShareText(s: SermonNote): string {
  const meta = [
    s.preacher ? `🎤 ${s.preacher}` : '',
    s.serviceTime ? `🕙 ${s.serviceTime}` : '',
  ]
    .filter(Boolean)
    .join('  ·  ');
  const lines = [
    'Catatan Khotbah 🙏',
    s.title,
    `🗓️ ${formatFullDate(dayIdToDate(s.id))}`,
  ];
  if (meta) lines.push(meta);
  if (s.quote) lines.push('', `💡 "${s.quote}"`);
  if (s.note) lines.push('', '📝 Catatan Khotbah:', s.note);
  if (s.reflection) lines.push('', `🏃 Aplikasi:`, s.reflection);
  return lines.join('\n');
}

// ===================== Helper hari & reminder =====================

/** Hari ini hari Minggu? (0 = Minggu di Date JS). */
export function isSunday(now: Date): boolean {
  return now.getDay() === 0;
}

/**
 * Masih boleh diedit? Catatan khotbah TERKUNCI mulai hari SELASA setelah ibadah
 * Minggu — jadi cuma bisa dirapikan pada Minggu & Senin, setelah itu jadi arsip
 * (view + share saja). id/date khotbah = hari Minggunya, jadi Selasa = +2 hari.
 */
export function sermonEditable(sundayId: string, now: Date): boolean {
  const lock = dayIdToDate(sundayId); // Minggu, 00:00 lokal
  lock.setDate(lock.getDate() + 2); // → Selasa, 00:00 (mulai terkunci)
  return now.getTime() < lock.getTime();
}

/** dayId hari Minggu terakhir (Minggu minggu ini — hari ini kalau Minggu). */
export function currentSundayId(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay()); // mundur ke Minggu minggu ini
  return dayDocId(d);
}

/**
 * Reminder khotbah aktif: setiap hari RABU & JUMAT, jam 12:30–17:30.
 * (Pengingat merenungkan lagi khotbah Minggu di tengah minggu.)
 */
export function sermonReminderActive(now: Date): boolean {
  const day = now.getDay();
  if (day !== 3 && day !== 5) return false; // 3 = Rabu, 5 = Jumat
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= 12 * 60 + 30 && mins <= 17 * 60 + 30;
}

// ===================== Kirim catatan khotbah 📤 =====================
//
// KAMIS jam 12.00–14.00: waktunya membagikan catatan khotbah Minggu kemarin
// ke CORE Leader lewat WhatsApp.
//
// Kenapa Kamis, dan bukan sesudah ibadah: catatannya baru terkunci jadi arsip
// hari Selasa (lihat sermonEditable), jadi sebelum itu isinya masih mungkin
// kamu rapikan. Kamis siang catatannya sudah final, dan masih cukup jauh dari
// ibadah berikutnya untuk sempat dibaca orang.
//
// Ini BEDA dari `sermonReminderActive` (Rabu & Jumat sore, di Dashboard): yang
// itu mengajak MERENUNGKAN lagi khotbahnya sendiri; yang ini mengajak
// MEMBAGIKANNYA.
export const SERMON_SHARE_DAY = 4; // 4 = Kamis
export const SERMON_SHARE_FROM_MINUTE = 12 * 60;
export const SERMON_SHARE_TO_MINUTE = 14 * 60;

/** Sekarang sedang di dalam jendela kirim (Kamis 12.00–14.00)? */
export function sermonShareWindow(now: Date): boolean {
  if (now.getDay() !== SERMON_SHARE_DAY) return false;
  const menit = now.getHours() * 60 + now.getMinutes();
  return menit >= SERMON_SHARE_FROM_MINUTE && menit < SERMON_SHARE_TO_MINUTE;
}

/**
 * Catatan khotbah yang perlu dikirim sekarang — null kalau bukan jamnya, atau
 * kalau catatan Minggu kemarin memang belum pernah ditulis.
 *
 * Sengaja TIDAK menagih catatan yang belum ada: mengajak membagikan sesuatu
 * yang belum ditulis cuma jadi tuduhan, bukan pengingat.
 */
export function sermonShareDue(
  sermons: SermonNote[],
  now: Date,
): SermonNote | null {
  if (!sermonShareWindow(now)) return null;
  // Hari Kamis, `currentSundayId` menunjuk Minggu 4 hari lalu — persis ibadah
  // yang catatannya mau dibagikan.
  const sundayId = currentSundayId(now);
  return sermons.find((s) => s.id === sundayId) ?? null;
}
