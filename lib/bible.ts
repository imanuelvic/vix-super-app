// Daftar 66 kitab Alkitab (Terjemahan Baru) + jumlah pasalnya.
// Dipakai pemilih kitab di Revive (bacaan Alkitab) & Morning/Night Bible
// Reading di Dashboard, supaya tidak perlu mengetik nama kitab manual.

export type BibleTestament = 'pl' | 'pb'; // Perjanjian Lama / Perjanjian Baru

export type BibleBook = {
  name: string;
  chapters: number;
  testament: BibleTestament;
};

export const BIBLE_BOOKS: BibleBook[] = [
  // ===== Perjanjian Lama (39) =====
  { name: 'Kejadian', chapters: 50, testament: 'pl' },
  { name: 'Keluaran', chapters: 40, testament: 'pl' },
  { name: 'Imamat', chapters: 27, testament: 'pl' },
  { name: 'Bilangan', chapters: 36, testament: 'pl' },
  { name: 'Ulangan', chapters: 34, testament: 'pl' },
  { name: 'Yosua', chapters: 24, testament: 'pl' },
  { name: 'Hakim-Hakim', chapters: 21, testament: 'pl' },
  { name: 'Rut', chapters: 4, testament: 'pl' },
  { name: '1 Samuel', chapters: 31, testament: 'pl' },
  { name: '2 Samuel', chapters: 24, testament: 'pl' },
  { name: '1 Raja-Raja', chapters: 22, testament: 'pl' },
  { name: '2 Raja-Raja', chapters: 25, testament: 'pl' },
  { name: '1 Tawarikh', chapters: 29, testament: 'pl' },
  { name: '2 Tawarikh', chapters: 36, testament: 'pl' },
  { name: 'Ezra', chapters: 10, testament: 'pl' },
  { name: 'Nehemia', chapters: 13, testament: 'pl' },
  { name: 'Ester', chapters: 10, testament: 'pl' },
  { name: 'Ayub', chapters: 42, testament: 'pl' },
  { name: 'Mazmur', chapters: 150, testament: 'pl' },
  { name: 'Amsal', chapters: 31, testament: 'pl' },
  { name: 'Pengkhotbah', chapters: 12, testament: 'pl' },
  { name: 'Kidung Agung', chapters: 8, testament: 'pl' },
  { name: 'Yesaya', chapters: 66, testament: 'pl' },
  { name: 'Yeremia', chapters: 52, testament: 'pl' },
  { name: 'Ratapan', chapters: 5, testament: 'pl' },
  { name: 'Yehezkiel', chapters: 48, testament: 'pl' },
  { name: 'Daniel', chapters: 12, testament: 'pl' },
  { name: 'Hosea', chapters: 14, testament: 'pl' },
  { name: 'Yoel', chapters: 3, testament: 'pl' },
  { name: 'Amos', chapters: 9, testament: 'pl' },
  { name: 'Obaja', chapters: 1, testament: 'pl' },
  { name: 'Yunus', chapters: 4, testament: 'pl' },
  { name: 'Mikha', chapters: 7, testament: 'pl' },
  { name: 'Nahum', chapters: 3, testament: 'pl' },
  { name: 'Habakuk', chapters: 3, testament: 'pl' },
  { name: 'Zefanya', chapters: 3, testament: 'pl' },
  { name: 'Hagai', chapters: 2, testament: 'pl' },
  { name: 'Zakharia', chapters: 14, testament: 'pl' },
  { name: 'Maleakhi', chapters: 4, testament: 'pl' },

  // ===== Perjanjian Baru (27) =====
  { name: 'Matius', chapters: 28, testament: 'pb' },
  { name: 'Markus', chapters: 16, testament: 'pb' },
  { name: 'Lukas', chapters: 24, testament: 'pb' },
  { name: 'Yohanes', chapters: 21, testament: 'pb' },
  { name: 'Kisah Para Rasul', chapters: 28, testament: 'pb' },
  { name: 'Roma', chapters: 16, testament: 'pb' },
  { name: '1 Korintus', chapters: 16, testament: 'pb' },
  { name: '2 Korintus', chapters: 13, testament: 'pb' },
  { name: 'Galatia', chapters: 6, testament: 'pb' },
  { name: 'Efesus', chapters: 6, testament: 'pb' },
  { name: 'Filipi', chapters: 4, testament: 'pb' },
  { name: 'Kolose', chapters: 4, testament: 'pb' },
  { name: '1 Tesalonika', chapters: 5, testament: 'pb' },
  { name: '2 Tesalonika', chapters: 3, testament: 'pb' },
  { name: '1 Timotius', chapters: 6, testament: 'pb' },
  { name: '2 Timotius', chapters: 4, testament: 'pb' },
  { name: 'Titus', chapters: 3, testament: 'pb' },
  { name: 'Filemon', chapters: 1, testament: 'pb' },
  { name: 'Ibrani', chapters: 13, testament: 'pb' },
  { name: 'Yakobus', chapters: 5, testament: 'pb' },
  { name: '1 Petrus', chapters: 5, testament: 'pb' },
  { name: '2 Petrus', chapters: 3, testament: 'pb' },
  { name: '1 Yohanes', chapters: 5, testament: 'pb' },
  { name: '2 Yohanes', chapters: 1, testament: 'pb' },
  { name: '3 Yohanes', chapters: 1, testament: 'pb' },
  { name: 'Yudas', chapters: 1, testament: 'pb' },
  { name: 'Wahyu', chapters: 22, testament: 'pb' },
];

export const TESTAMENT_LABEL: Record<BibleTestament, string> = {
  pl: 'Perjanjian Lama',
  pb: 'Perjanjian Baru',
};

export function bibleBook(name: string): BibleBook | undefined {
  return BIBLE_BOOKS.find((b) => b.name === name);
}

/**
 * Rangkai jadi teks acuan: "Galatia 4:4-7" · "Mazmur 23" · "Yakobus 2:1".
 * Bagian yang kosong dilewati, jadi minimal cukup pilih kitabnya saja.
 */
export function bibleRefText(
  book: string,
  chapter: string,
  verseFrom: string,
  verseTo: string,
): string {
  if (!book) return '';
  const ch = chapter.trim();
  if (!ch) return book;
  const from = verseFrom.trim();
  if (!from) return `${book} ${ch}`;
  const to = verseTo.trim();
  return to && to !== from
    ? `${book} ${ch}:${from}-${to}`
    : `${book} ${ch}:${from}`;
}

/**
 * Kebalikan `bibleRefText` — pecah teks acuan jadi bagian-bagiannya supaya
 * catatan lama bisa dibuka lagi di pemilih. Kalau nama kitabnya tidak dikenali,
 * `book` dikembalikan kosong (teksnya tetap aman, tinggal dipilih ulang).
 */
export function parseBibleRef(text: string): {
  book: string;
  chapter: string;
  verseFrom: string;
  verseTo: string;
} {
  const empty = { book: '', chapter: '', verseFrom: '', verseTo: '' };
  const raw = text.trim();
  if (!raw) return empty;

  // Cocokkan nama kitab TERPANJANG dulu ("1 Yohanes" sebelum "Yohanes").
  const book = [...BIBLE_BOOKS]
    .sort((a, b) => b.name.length - a.name.length)
    .find((b) => raw.toLowerCase().startsWith(b.name.toLowerCase()));
  if (!book) return empty;

  const rest = raw.slice(book.name.length).trim();
  const m = rest.match(/^(\d+)(?::\s*(\d+)(?:\s*[-–]\s*(\d+))?)?/);
  return {
    book: book.name,
    chapter: m?.[1] ?? '',
    verseFrom: m?.[2] ?? '',
    verseTo: m?.[3] ?? '',
  };
}
