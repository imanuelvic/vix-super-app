import {
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate } from './format';
import { liveList } from './liveDoc';

// Riwayat Syukur 🙏 — penyimpanan SENDIRI: users/{uid}/gratitude/{YYYY-MM-DD}.
//
// ===== Kenapa pindah dari catatan kebiasaan =====
//
// Dulu tidak ada penyimpanan sendiri: riwayatnya cuma "dibaca ulang" dari
// catatan harian kebiasaan, `habitDays/{hari}.notes[<id baris>]`. Kelihatan
// hemat, dan di situlah rapuhnya — kuncinya adalah **id baris kebiasaan**, dan
// baris itu dicari dari NAMANYA (/bersyukur/i). Artinya seluruh arsip
// bertahun-tahun bergantung pada dua hal yang memang boleh kamu ubah kapan
// saja:
//   • nama barisnya — diganti jadi nama lain, arsipnya tak ketemu lagi;
//   • baris itu sendiri — dihapus lalu dibuat ulang, id-nya lahir BARU dan
//     seluruh catatan lama tertinggal di bawah kunci yang tak dipakai siapa
//     pun lagi.
// Dua-duanya memutus arsip tanpa satu pun peringatan, dan tanpa menghapus apa
// pun: teksnya masih ada di Firestore, cuma tak ada lagi yang tahu kuncinya.
//
// Sekarang bentuknya sama persis dengan Bible Reading (users/{uid}/bibleRead):
// satu dokumen per TANGGAL, berdiri sendiri, tidak bergantung pada daftar
// kebiasaan sama sekali. Ganti nama barisnya, hapus barisnya, ganti perangkat —
// arsipnya tetap terbaca.
//
// Catatan kebiasaannya TETAP ditulis seperti biasa (itu yang menentukan centang
// & pratinjau di baris Habits); yang ditambah cuma salinan tahan lama di sini.
// Satu tulis ekstra per hari — dokumen kecil, sekali sehari.

export type GratitudeDay = {
  /** "YYYY-MM-DD" — sekaligus id dokumennya. */
  dayId: string;
  /**
   * Isinya PERSIS seperti yang tersimpan di catatan kebiasaan: poin dipisah
   * baris baru. Sengaja bukan array — supaya tidak ada aturan penulisan kedua
   * yang bisa menyimpang dari `joinNoteLines`/`filledNoteLines` di lib/habits.
   */
  text: string;
};

/**
 * Berapa hari ditarik sekali angkat. Bukan batas penyimpanan — semuanya
 * tersimpan selamanya, satu dokumen per hari; ini cuma sejauh apa yang dibaca
 * dalam satu tarikan (pola yang sama dengan HABIT_NOTES_PAGE).
 */
export const GRATITUDE_PAGE = 120;

const gratitudeRef = (uid: string, dayId: string) =>
  doc(db, 'users', uid, 'gratitude', dayId);

/**
 * Simpan (atau hapus) catatan syukur satu hari.
 *
 * Teks kosong = HAPUS dokumennya, bukan menyimpan baris kosong. Hard delete
 * seperti aturan hapus di app ini; hari tanpa catatan memang tidak perlu punya
 * dokumen sendiri, dan menyisakannya membuat hitungan "berapa hari" bohong.
 */
export function saveGratitude(uid: string, dayId: string, text: string) {
  const isi = text.trim();
  if (!isi) return deleteDoc(gratitudeRef(uid, dayId));
  return setDoc(gratitudeRef(uid, dayId), {
    text,
    // Diurut lewat field `date`, bukan documentId(), supaya bentuknya sama
    // dengan riwayat Bible Reading — satu field, tanpa composite index.
    date: Timestamp.fromDate(dayIdToDate(dayId)),
  });
}

/** Riwayat syukur, hari terbaru dulu. */
export function subscribeGratitudeDays(
  uid: string,
  onChange: (days: GratitudeDay[]) => void,
  onError?: (error: FirestoreError) => void,
  max = GRATITUDE_PAGE,
) {
  return liveList<GratitudeDay>(
    query(
      collection(db, 'users', uid, 'gratitude'),
      orderBy('date', 'desc'),
      limit(max),
    ),
    onChange,
    onError,
    (d) => ({ dayId: d.id, text: (d.data().text as string) ?? '' }),
  );
}

/**
 * Pindahkan catatan syukur LAMA (yang masih menumpang di catatan kebiasaan) ke
 * penyimpanan sendiri. Sekali jalan, lalu tidak ada lagi yang perlu dipindah.
 *
 * Yang dioper HANYA hari yang belum ada di sini — jadi memanggilnya berulang
 * kali tidak menulis apa-apa, dan tidak pernah menimpa yang sudah tersimpan.
 * Batch, bukan tulis satu-satu: kalau gagal, gagal seluruhnya — tidak ada
 * separuh arsip yang pindah.
 */
export function rescueGratitude(
  uid: string,
  days: { dayId: string; text: string }[],
) {
  const batch = writeBatch(db);
  for (const d of days) {
    batch.set(gratitudeRef(uid, d.dayId), {
      text: d.text,
      date: Timestamp.fromDate(dayIdToDate(d.dayId)),
    });
  }
  return batch.commit();
}
