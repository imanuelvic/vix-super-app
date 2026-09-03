import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Notes 📝 di Fitness — tempat menyimpan tautan yang berserakan: video gerakan
// di YouTube, program latihan, artikel gizi, playlist. Satu klik langsung
// membuka tautannya, jadi tidak perlu mencari-cari lagi di riwayat browser.
//
// SATU dokumen array kecil: users/{uid}/fitness/notes -> { list: FitNote[] }
// Isinya cuma teks & tautan, jumlahnya puluhan — jauh lebih hemat daripada
// koleksi berisi dokumen-dokumen kecil.

export type FitNote = {
  id: string;
  title: string;
  /** Tautannya. Boleh kosong — catatan tanpa tautan tetap sah. */
  url: string;
  note: string;
};

export const newFitNoteId = () =>
  `fn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function ref(uid: string) {
  return doc(db, 'users', uid, 'fitness', 'notes');
}

export function subscribeFitNotes(
  uid: string,
  onChange: (list: FitNote[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    ref(uid),
    (snapshot) => onChange((snapshot.data()?.list as FitNote[]) ?? []),
    onError,
  );
}

/** Tulis ulang seluruh daftar — tambah, ubah, & HAPUS permanen. */
export function saveFitNotes(uid: string, list: FitNote[]) {
  return setDoc(ref(uid), { list });
}

/**
 * Rapikan tautan yang ditempel: buang spasi, dan tambahkan https:// kalau
 * kelupaan. Tanpa ini "youtube.com/watch?v=…" gagal dibuka karena dianggap
 * bukan alamat web.
 */
export function tidyUrl(raw: string): string {
  const teks = raw.trim();
  if (!teks) return '';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(teks)) return teks;
  // mailto:, tel:, dan skema lain tanpa "//" dibiarkan apa adanya.
  if (/^[a-z][a-z0-9+.-]*:/i.test(teks)) return teks;
  return `https://${teks}`;
}

/** "youtu.be/abc" → "youtu.be" — ditampilkan kecil di bawah judulnya. */
export function urlHost(raw: string): string {
  const teks = tidyUrl(raw);
  const cocok = teks.match(/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i);
  return cocok ? cocok[1].replace(/^www\./i, '') : '';
}
