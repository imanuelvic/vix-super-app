import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Fitur Book 📚 — daftar buku yang mau / lagi dibaca, dikelompokkan per tema.
//
// Daftar bukunya STATIK di sini (tidak masuk Firestore) supaya ringan & gratis.
// Yang disimpan ke Firestore hanya status "sudah dibaca", dalam SATU dokumen
// kecil biar sinkron antar perangkat: users/{uid}/reading/books → { read: {} }.
//
// Soal LINK: untuk buku yang masih berhak cipta, link mengarah ke sumber GRATIS
// yang LEGAL (esai/situs resmi penulis atau ringkasan) — bukan salinan bajakan.
// Dukung penulisnya dengan membeli / meminjam bukunya ya 🙏

export type BookCategory = { key: string; label: string };

export const BOOK_CATEGORIES: BookCategory[] = [
  { key: 'financial', label: '💵 Financial' },
  { key: 'mindset', label: '🧠 Mindset' },
];

// free = teks lengkap gratis & legal (domain publik / kitab / esai penulis)
// info = halaman info resmi / ringkasan (buku berbayar — beli/pinjam bukunya)
export type BookLinkKind = 'free' | 'info';

export type Book = {
  key: string;
  category: string;
  title: string;
  author: string;
  year: number;
  info: string; // tentang apa & kenapa penting (Bahasa Indonesia)
  url: string;
  linkKind: BookLinkKind;
};

// Urut per kategori: paling baru di atas (seperti daftar aslinya).
export const BOOKS: Book[] = [
  // ---------- 💵 Financial ----------
  {
    key: 'lords-easy-money',
    category: 'financial',
    title: 'The Lords of Easy Money',
    author: 'Christopher Leonard',
    year: 2022,
    info: 'Cara bank sentral (The Fed) mencetak uang murah dan dampaknya ke inflasi, aset, dan kesenjangan. Biar paham "kenapa harga naik terus".',
    url: 'https://www.google.com/search?q=The+Lords+of+Easy+Money+Christopher+Leonard+book',
    linkKind: 'info',
  },
  {
    key: 'psychology-of-money',
    category: 'financial',
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    year: 2020,
    info: 'Sukses finansial lebih soal perilaku daripada kepintaran. Sabar, rendah hati, dan hindari serakah lebih penting dari rumus investasi.',
    url: 'https://collabfund.com/blog/the-psychology-of-money/',
    linkKind: 'free',
  },
  {
    key: 'bitcoin-standard',
    category: 'financial',
    title: 'The Bitcoin Standard',
    author: 'Saifedean Ammous',
    year: 2018,
    info: 'Sejarah uang dari emas ke fiat, dan kenapa "uang keras" penting. Dasar untuk memahami Bitcoin secara ekonomi, bukan sekadar spekulasi.',
    url: 'https://en.wikipedia.org/wiki/The_Bitcoin_Standard',
    linkKind: 'info',
  },
  {
    key: 'millionaire-master-plan',
    category: 'financial',
    title: 'The Millionaire Master Plan',
    author: 'Roger James Hamilton',
    year: 2014,
    info: 'Peta 9 level kekayaan bertahap — kenali posisimu sekarang lalu naik selangkah demi selangkah sesuai bakat alamimu.',
    url: 'https://www.google.com/search?q=The+Millionaire+Master+Plan+Roger+James+Hamilton+book',
    linkKind: 'info',
  },
  {
    key: 'zero-to-one',
    category: 'financial',
    title: 'Zero to One',
    author: 'Peter Thiel',
    year: 2014,
    info: 'Bikin sesuatu yang benar-benar baru (0→1), bukan meniru (1→n). Cara berpikir membangun bisnis/startup yang monopoli sehat.',
    url: 'https://en.wikipedia.org/wiki/Zero_to_One',
    linkKind: 'info',
  },
  {
    key: '4-hour-workweek',
    category: 'financial',
    title: 'The 4-Hour Workweek',
    author: 'Timothy Ferriss',
    year: 2007,
    info: 'Bekerja lebih cerdas: fokus (aturan 80/20), otomatisasi, dan delegasi supaya waktu & kebebasan lebih banyak, bukan sekadar sibuk.',
    url: 'https://tim.blog/',
    linkKind: 'info',
  },
  {
    key: 'rich-dad-poor-dad',
    category: 'financial',
    title: 'Rich Dad Poor Dad',
    author: 'Robert Kiyosaki',
    year: 1997,
    info: 'Beda cara pikir soal uang: beli aset yang menghasilkan, pahami arus kas, dan melek finansial sejak dini.',
    url: 'https://en.wikipedia.org/wiki/Rich_Dad_Poor_Dad',
    linkKind: 'info',
  },
  {
    key: 'richest-man-babylon',
    category: 'financial',
    title: 'The Richest Man in Babylon',
    author: 'George S. Clason',
    year: 1926,
    info: 'Prinsip abadi lewat kisah Babilonia kuno: sisihkan minimal 10% penghasilan, kendalikan pengeluaran, dan uang bekerja untukmu.',
    url: 'https://archive.org/details/richestmaninbaby0000clas',
    linkKind: 'free',
  },
  // ---------- 🧠 Mindset ----------
  {
    key: 'book-of-proverbs',
    category: 'mindset',
    title: 'The Book of Proverbs (Amsal)',
    author: 'Vince Miller',
    year: 2023,
    info: 'Hikmat praktis untuk hidup, kerja, mulut, dan uang. Link menuju kitab Amsal (gratis) — 31 pasal, cocok dibaca 1 pasal per hari.',
    url: 'https://alkitab.sabda.org/passage.php?passage=Amsal+1',
    linkKind: 'free',
  },
  {
    key: 'deep-work',
    category: 'mindset',
    title: 'Deep Work',
    author: 'Cal Newport',
    year: 2016,
    info: 'Kemampuan fokus tanpa gangguan makin langka & bernilai. Cara melatih konsentrasi dalam untuk kerja bermutu tinggi.',
    url: 'https://www.calnewport.com/books/deep-work/',
    linkKind: 'info',
  },
  {
    key: 'atomic-habits',
    category: 'mindset',
    title: 'Atomic Habits',
    author: 'James Clear',
    year: 2018,
    info: 'Perubahan 1% tiap hari yang menumpuk jadi besar. Sistem membangun kebiasaan baik & membuang yang buruk lewat langkah-langkah kecil.',
    url: 'https://jamesclear.com/atomic-habits',
    linkKind: 'info',
  },
];

// ===================== Status "sudah dibaca" =====================
// SATU dokumen kecil users/{uid}/reading/books — { read: { [key]: true } }.

export type BooksReadMap = Record<string, boolean>;

export function subscribeBooksRead(
  uid: string,
  onChange: (read: BooksReadMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'reading', 'books');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.read as BooksReadMap) ?? {});
    },
    onError,
  );
}

export function setBookRead(uid: string, bookKey: string, read: boolean) {
  const ref = doc(db, 'users', uid, 'reading', 'books');
  // merge: hanya status buku ini yang berubah, buku lain tetap.
  return setDoc(ref, { read: { [bookKey]: read } }, { merge: true });
}
