import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { BIRTH_YEAR } from './timeline';
import { WHEEL_AREAS, type WheelAreaKey } from './wheel';

// My History 📜 — perjalanan hidup yang SUDAH terjadi, versi app dari sheet
// "MY LIFE JOURNEY". Pasangannya adalah My Timeline 📍 (rencana ke depan):
//   📜 History  = masa lalu, biar tidak lupa dari mana kamu datang
//   📍 Timeline = masa depan, biar tahu mau ke mana
//
// Penyimpanan: SATU dokumen kecil users/{uid}/app/history berisi array item.
// Isinya cuma teks pendek (±8 KB untuk 66 entri), jadi 1 read sekali buka.
//
// Semua entri BISA DIUBAH & DIHAPUS — daftar bawaan di bawah hanyalah "benih"
// yang ditulis sekali saat kamu menekan tombol isi otomatis.

export type HistoryCategoryKey = WheelAreaKey | 'education';

/**
 * Kategori kejadian = KEDELAPAN area Wheel of Life, ditambah "Education".
 *
 * Diambil langsung dari WHEEL_AREAS supaya satu daftar area hidup dipakai di
 * seluruh app (Wheel, Timeline, History) — dulu Health tidak ada di sini,
 * padahal sakit & pemulihan itu bagian besar perjalanan hidup.
 *
 * "Education" TETAP ada di ekornya: ia bukan area Wheel of Life, tapi
 * kejadian lama sudah memakainya — dan sekolah memang tonggak sendiri di
 * riwayat hidup, bukan bagian dari karier.
 */
export const HISTORY_CATEGORIES: {
  key: HistoryCategoryKey;
  label: string;
  icon: string;
}[] = [
  ...WHEEL_AREAS.map(({ key, label, icon }) => ({ key, label, icon })),
  { key: 'education', label: 'Education', icon: '🏫' },
];

export function historyCategoryMeta(key: HistoryCategoryKey) {
  return HISTORY_CATEGORIES.find((c) => c.key === key) ?? HISTORY_CATEGORIES[0];
}

export type HistoryItem = {
  id: string;
  year: number; // tahun mulai
  endYear: number | null; // null = kejadian satu tahun saja
  category: HistoryCategoryKey;
  milestone: string; // baris di sheet, mis. "Main Job", "Pertobatan"
  title: string; // isinya
  detail: string; // keterangan tambahan (pendeta, kampus, jam, dll)
};

/** Umur pada tahun tertentu (ulang tahun 1 Januari → pas per tahun). */
export function ageAtYear(year: number): number {
  return year - BIRTH_YEAR;
}

/** "2015" atau "2015–2018" — label rentang tahun satu entri. */
export function yearLabel(item: HistoryItem): string {
  return item.endYear && item.endYear !== item.year
    ? `${item.year}–${item.endYear}`
    : String(item.year);
}

/** Tahun-tahun yang ada isinya, urut sesuai pilihan. Dipakai judul kelompok. */
export function historyYears(items: HistoryItem[], newestFirst: boolean): number[] {
  const years = [...new Set(items.map((i) => i.year))];
  years.sort((a, b) => (newestFirst ? b - a : a - b));
  return years;
}

export function newHistoryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ===================== Firestore =====================

function historyRef(uid: string) {
  return doc(db, 'users', uid, 'app', 'history');
}

export function subscribeHistory(
  uid: string,
  onChange: (items: HistoryItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    historyRef(uid),
    (snapshot) => onChange((snapshot.data()?.items as HistoryItem[]) ?? []),
    onError,
  );
}

/**
 * Tulis ulang SELURUH daftar. Menghapus entri = kirim array tanpa entri itu →
 * datanya benar-benar hilang dari Firestore, bukan ditandai terhapus.
 */
export function saveHistory(uid: string, items: HistoryItem[]) {
  return setDoc(historyRef(uid), { items }, { merge: true });
}

// ===================== Benih dari sheet "MY LIFE JOURNEY" =====================
// Tahun tiap entri dihitung dari posisi kolomnya di sheet (kolom pertama
// "<1995", lalu 1996 … 2030). PERIKSA LAGI kalau ada yang meleset — semuanya
// bisa diubah lewat tombol ✏️ di layar History.

function seed(
  year: number,
  endYear: number | null,
  category: HistoryCategoryKey,
  milestone: string,
  title: string,
  detail = '',
): Omit<HistoryItem, 'id'> {
  return { year, endYear, category, milestone, title, detail };
}

export const SEED_HISTORY: Omit<HistoryItem, 'id'>[] = [
  // ---------- 🏫 Education ----------
  seed(2001, 2002, 'education', 'Sekolah', 'TK Mitra', 'Nursery school'),
  seed(2003, 2008, 'education', 'Sekolah', 'Eben Haezar', 'Elementary School'),
  seed(2009, 2011, 'education', 'Sekolah', 'Eben Haezar', 'Junior High School'),
  seed(2012, 2014, 'education', 'Sekolah', 'Eben Haezar', 'Senior High School'),
  seed(2015, 2018, 'education', 'Kuliah', 'S1 Game Application & Technology', 'Bina Nusantara University'),
  seed(2019, null, 'education', 'Kuliah', 'Wisuda S.Kom.', ''),
  seed(2021, 2024, 'education', 'Kuliah', 'S2 Teologi', 'STT Sunergeo, Banten'),
  seed(2025, null, 'education', 'Kuliah', 'Wisuda M.Th.', ''),

  // ---------- ✝️ Spirituality: gereja orang tua ----------
  seed(1995, 1997, 'spirituality', 'Gereja Orang Tua', 'Gereja Bethany', 'Pdt. Ade Karouw · sejak sebelum 1995'),
  seed(1998, 2002, 'spirituality', 'Gereja Orang Tua', 'GISI', 'Pdt. Hannie Doodo'),
  seed(2003, 2007, 'spirituality', 'Gereja Orang Tua', 'GISI', 'Pdt. Abraham Yuwono'),
  seed(2008, 2011, 'spirituality', 'Gereja Orang Tua', 'GBI Transformasi', 'Pdt. Roy Mondong'),
  seed(2012, 2017, 'spirituality', 'Gereja Orang Tua', 'GBI Laroka', 'Pdt. Arthur'),
  seed(2018, null, 'spirituality', 'Gereja Orang Tua', 'GBI Malang', ''),
  seed(2023, 2025, 'spirituality', 'Gereja Orang Tua', 'GBI Bethany Pomurouw', 'Pdt. Ade Karouw'),

  // ---------- ✝️ Spirituality: gerejaku ----------
  seed(2012, 2014, 'spirituality', 'Gerejaku', 'GBI Laroka', 'Pdt. Arthur'),
  seed(2015, 2025, 'spirituality', 'Gerejaku', 'Nafiri Discipleship Church', 'Ps. Josia Abdisaputera'),

  // ---------- ✝️ Spirituality: pertobatan ----------
  seed(2015, null, 'spirituality', 'Pertobatan', '19 April', ''),
  seed(2016, null, 'spirituality', 'Pertobatan', 'Tahun 2016', 'Tanggalnya tidak tercatat di sheet'),
  seed(2017, null, 'spirituality', 'Pertobatan', '20 Desember', ''),
  seed(2018, null, 'spirituality', 'Pertobatan', '20 Desember', ''),
  seed(2019, null, 'spirituality', 'Pertobatan', '1 Januari', ''),
  seed(2020, null, 'spirituality', 'Pertobatan', '31 Januari & 12 Desember', ''),
  seed(2021, null, 'spirituality', 'Pertobatan', '11 Desember', ''),
  seed(2022, null, 'spirituality', 'Pertobatan', '14 September', ''),
  seed(2023, null, 'spirituality', 'Pertobatan', '20 Februari', ''),
  seed(2024, null, 'spirituality', 'Pertobatan', '12 Agustus', ''),
  seed(2025, null, 'spirituality', 'Pertobatan', '27 Januari', ''),

  // ---------- ✝️ Spirituality: khatam Alkitab ----------
  seed(2020, null, 'spirituality', 'Selesai Baca Alkitab', 'Khatam pertama 📖', '1st Finish'),

  // ---------- 👨‍👩‍👧‍👦 Family ----------
  seed(2006, null, 'family', 'Pernikahan', 'Rendie & Inne', ''),
  seed(2007, null, 'family', 'Pernikahan', 'Natalie & Glend', ''),
  seed(2024, null, 'family', 'Pernikahan', 'Angely & Kevin', ''),
  seed(2027, null, 'family', 'Pernikahan', 'Imanuel & Resita', 'Rencana di sheet — belum terjadi'),

  // ---------- 🙏 Ministry: ibadah minggu ----------
  seed(2015, 2019, 'ministry', 'Ibadah Minggu', 'Usher', 'NDC Central Park (Pk. 11.00)'),
  seed(2021, null, 'ministry', 'Ibadah Minggu', 'Usher', 'NCH 2'),
  seed(2022, null, 'ministry', 'Ibadah Minggu', 'PHT', 'NCH 6'),
  seed(2023, 2024, 'ministry', 'Ibadah Minggu', 'SSM 1', 'NCH 7 (Pk. 19.00)'),
  seed(2025, 2026, 'ministry', 'Ibadah Minggu', 'PIC Multimedia', 'NCH 6 & 7'),

  // ---------- 🙏 Ministry: komunitas ----------
  seed(2015, null, 'ministry', 'Komunitas', 'WL', ''),
  seed(2016, null, 'ministry', 'Komunitas', 'Sharing FT', ''),
  seed(2017, 2020, 'ministry', 'Komunitas', 'Main Team CORE', ''),
  seed(2021, null, 'ministry', 'Komunitas', 'CORE Leader', ''),
  seed(2022, 2024, 'ministry', 'Komunitas', 'CORE Leader & Mentor CORE Leader', ''),
  seed(2025, null, 'ministry', 'Komunitas', 'Mentor CORE Leader', ''),

  // ---------- 🙏 Ministry: pembicara ----------
  seed(2026, null, 'ministry', 'Pembicara', 'NDC Youth', ''),

  // ---------- 💼 Career: organisasi ----------
  seed(2016, 2017, 'career', 'Organisasi', 'Treasurer — BASIC', 'PIC Syahdan - PO'),
  seed(2018, 2019, 'career', 'Organisasi', 'Treasurer', 'PO BINUS'),
  seed(2020, 2022, 'career', 'Organisasi', 'Badan Pengurus Umum', 'Tim Dana Sekretariat'),

  // ---------- 💼 Career: pekerjaan utama ----------
  seed(2019, 2020, 'career', 'Pekerjaan Utama', 'Parttime', 'NDC'),
  seed(2021, null, 'career', 'Pekerjaan Utama', 'ROYAL R1CH', ''),
  seed(2022, 2025, 'career', 'Pekerjaan Utama', 'Fulltimer — Digital Works', 'Nafiri Discipleship Church'),

  // ---------- 💵 Finance ----------
  seed(2023, 2024, 'finance', 'Side Job', 'Versatility in Scents (ViS)', ''),

  // ---------- 🤝 Relationship: interest ----------
  seed(2007, null, 'relationship', 'Interest', 'Luana', ''),
  seed(2008, null, 'relationship', 'Interest', 'Valerie', ''),
  seed(2010, null, 'relationship', 'Interest', 'Maria', ''),
  seed(2012, null, 'relationship', 'Interest', 'Trista', ''),
  seed(2013, null, 'relationship', 'Interest', 'Cynthia', ''),
  seed(2014, 2015, 'relationship', 'Interest', 'Jesica', ''),
  seed(2017, null, 'relationship', 'Interest', 'Monika', ''),
  seed(2021, null, 'relationship', 'Interest', 'Grace', ''),
  seed(2022, null, 'relationship', 'Interest', 'Shanice', ''),

  // ---------- 🤝 Relationship: pacaran ----------
  seed(2009, null, 'relationship', 'Pacaran', 'Regina Pailah', ''),
  seed(2018, 2019, 'relationship', 'Pacaran', 'Agnes Nielita Caroline Suryanto', ''),
  seed(2023, 2025, 'relationship', 'Pacaran', 'Maria Resita Octavia', ''),

  // ---------- 🎢 Fun & Recreation ----------
  seed(2007, 2011, 'fun', 'Game', 'Dota', ''),
  seed(2012, 2023, 'fun', 'Game', 'Dota 2', ''),
];

/** Benih + id — dipakai tombol "isi dari catatan lama" (sekali jalan). */
export function seededHistory(): HistoryItem[] {
  return SEED_HISTORY.map((item) => ({ ...item, id: newHistoryId() }));
}
