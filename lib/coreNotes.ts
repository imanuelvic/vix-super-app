import { doc, getDoc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// ===================== Catatan rohani ⇄ acara CORE 🔗 =====================
//
// Menyambungkan satu catatan (📖 Revive atau ⛪ Khotbah) ke satu acara CORE
// (Visitasi atau Rapat Bulanan) yang BELUM lewat: bahan yang kamu dapat pagi
// ini jadi bahan yang kamu bawakan nanti, tanpa perlu menyalin apa pun.
//
// ── Kenapa disimpan di dokumen SENDIRI, bukan ditempel ke acaranya ──
// Visitasi tersimpan sebagai SATU array di dalam satu dokumen; menempelkan
// sambungan ke sana berarti layar Catatan Revive harus menulis ulang seluruh
// daftar visitasi — cuma untuk menambah satu tautan. Rapat bulanan dokumennya
// lain lagi, jadi jalur tulisnya jadi dua. Di sini semuanya satu dokumen kecil
// dengan satu jalur tulis, dan yang membacanya (kedua sub-tab CORE) cukup satu
// langganan tambahan.
//
// Isinya sengaja cuma PENUNJUK, bukan salinan catatannya: judul & tanggal ikut
// disimpan supaya daftarnya bisa tampil tanpa membaca dokumen catatannya, tapi
// isi lengkapnya selalu dibaca dari sumber aslinya — jadi catatan yang nanti
// kamu ubah tidak akan basi di sini.

export type NoteKind = 'revive' | 'sermon';

export type NoteLink = {
  kind: NoteKind;
  /** dayId catatannya ("YYYY-MM-DD") — sekaligus id dokumen aslinya. */
  noteId: string;
  /** Judul saat disambungkan, untuk ditampilkan sebelum isinya dibaca. */
  title: string;
};

/** Peta: id acara CORE → catatan-catatan yang disambungkan ke acara itu. */
export type CoreNoteLinks = Record<string, NoteLink[]>;

export const EMPTY_CORE_NOTE_LINKS: CoreNoteLinks = {};

export const NOTE_KIND_META: Record<
  NoteKind,
  { emoji: string; label: string }
> = {
  revive: { emoji: '📖', label: 'Revive' },
  sermon: { emoji: '⛪', label: 'Khotbah' },
};

function linksRef(uid: string) {
  return doc(db, 'users', uid, 'core', 'noteLinks');
}

export function subscribeCoreNoteLinks(
  uid: string,
  onChange: (links: CoreNoteLinks) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    linksRef(uid),
    (snap) => onChange((snap.data()?.links as CoreNoteLinks) ?? {}),
    onError,
  );
}

export function saveCoreNoteLinks(uid: string, links: CoreNoteLinks) {
  return setDoc(linksRef(uid), { links });
}

/** Catatan yang tersambung ke satu acara CORE (selalu array, boleh kosong). */
export function noteLinksOf(
  links: CoreNoteLinks,
  coreId: string,
): NoteLink[] {
  return links[coreId] ?? [];
}

/** Catatan ini sudah tersambung ke acara itu? */
export function isNoteLinked(
  links: CoreNoteLinks,
  coreId: string,
  kind: NoteKind,
  noteId: string,
): boolean {
  return noteLinksOf(links, coreId).some(
    (l) => l.kind === kind && l.noteId === noteId,
  );
}

/**
 * Sambung / lepas satu catatan dari satu acara — kembalikan peta BARU.
 *
 * Acara yang sambungannya habis dibuang dari peta sekalian (bukan disimpan
 * sebagai array kosong), supaya dokumennya tidak pelan-pelan penuh sisa acara
 * lama yang sudah tidak menunjuk apa pun.
 */
export function toggleNoteLink(
  links: CoreNoteLinks,
  coreId: string,
  link: NoteLink,
): CoreNoteLinks {
  const sekarang = noteLinksOf(links, coreId);
  const sudah = sekarang.some(
    (l) => l.kind === link.kind && l.noteId === link.noteId,
  );
  const berikutnya = sudah
    ? sekarang.filter((l) => !(l.kind === link.kind && l.noteId === link.noteId))
    : [...sekarang, link];

  const hasil = { ...links };
  if (berikutnya.length === 0) delete hasil[coreId];
  else hasil[coreId] = berikutnya;
  return hasil;
}

/**
 * Buang seluruh sambungan milik satu catatan — dipakai saat catatannya
 * dihapus, supaya tidak ada acara CORE yang menunjuk catatan yang sudah tiada.
 * Kembalikan `null` kalau memang tak ada yang berubah (jangan menulis
 * Firestore tanpa perlu).
 */
export async function purgeNoteLinks(
  uid: string,
  kind: NoteKind,
  noteId: string,
): Promise<void> {
  const snap = await getDoc(linksRef(uid));
  const berikutnya = dropNoteLinks(
    (snap.data()?.links as CoreNoteLinks) ?? {},
    kind,
    noteId,
  );
  if (berikutnya) await saveCoreNoteLinks(uid, berikutnya);
}

export function dropNoteLinks(
  links: CoreNoteLinks,
  kind: NoteKind,
  noteId: string,
): CoreNoteLinks | null {
  let berubah = false;
  const hasil: CoreNoteLinks = {};
  for (const [coreId, daftar] of Object.entries(links)) {
    const sisa = daftar.filter(
      (l) => !(l.kind === kind && l.noteId === noteId),
    );
    if (sisa.length !== daftar.length) berubah = true;
    if (sisa.length > 0) hasil[coreId] = sisa;
  }
  return berubah ? hasil : null;
}
