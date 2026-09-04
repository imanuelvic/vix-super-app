import {
  doc,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Fitur Book 📚 — daftar buku yang mau / lagi dibaca, dikelompokkan per tema.
//
// Daftar buku + daftar BAB tiap buku STATIK di sini (tidak masuk Firestore)
// supaya ringan & gratis. Yang disimpan ke Firestore hanya CENTANG per-bab,
// dalam SATU dokumen kecil biar sinkron antar perangkat:
//   users/{uid}/reading/books → { chapters: { [bookKey]: { [idxBab]: true } } }
// Sebuah buku dianggap "selesai" kalau semua babnya sudah dicentang.

export type BookCategory = { key: string; label: string };

export const BOOK_CATEGORIES: BookCategory[] = [
  { key: 'financial', label: '💵 Financial' },
  { key: 'mindset', label: '🧠 Mindset' },
  // Buku rujukan skill mingguan di fitur Learning 🎓 — lihat `bookKey`
  // pada daftar SKILLS di lib/learning.ts.
  { key: 'insight', label: '🌍 Wawasan' },
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
  chapters: string[]; // judul tiap bab — jadi checklist di halaman detail
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
    // Buku ini bercerita mengikuti Thomas Hoenig; jumlah bab estimasi (bagi
    // per bab baca). Sesuaikan kalau kamu tahu daftar bab persisnya.
    chapters: [
      'Bab 1 — Going Below Zero',
      'Bab 2',
      'Bab 3',
      'Bab 4',
      'Bab 5',
      'Bab 6',
      'Bab 7',
      'Bab 8 — The Fixer',
      'Bab 9',
      'Bab 10',
      'Bab 11',
      'Bab 12',
      'Bab 13',
      'Bab 14',
      'Bab 15',
      'Bab 16',
      'Bab 17',
      'Bab 18',
    ],
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
    chapters: [
      "No One's Crazy",
      'Luck & Risk',
      'Never Enough',
      'Confounding Compounding',
      'Getting Wealthy vs. Staying Wealthy',
      'Tails, You Win',
      'Freedom',
      'Man in the Car Paradox',
      "Wealth is What You Don't See",
      'Save Money',
      'Reasonable > Rational',
      'Surprise!',
      'Room for Error',
      "You'll Change",
      "Nothing's Free",
      'You & Me',
      'The Seduction of Pessimism',
      "When You'll Believe Anything",
      'All Together Now',
      'Confessions',
    ],
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
    chapters: [
      'Money',
      'Primitive Moneys',
      'Monetary Metals',
      'Government Money',
      'Money and Time Preference',
      "Capitalism's Information System",
      'Sound Money and Individual Freedom',
      'Digital Money',
      'What Is Bitcoin Good For?',
      'Bitcoin Questions',
    ],
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
    // 9 level warna, dikelompokkan dalam 3 prisma (Foundation, Enterprise, Alchemy).
    chapters: [
      'Infrared — Prisma Foundation',
      'Red — Prisma Foundation',
      'Orange — Prisma Foundation',
      'Yellow — Prisma Enterprise',
      'Green — Prisma Enterprise',
      'Blue — Prisma Enterprise',
      'Indigo — Prisma Alchemy',
      'Violet — Prisma Alchemy',
      'Ultraviolet — Prisma Alchemy',
    ],
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
    chapters: [
      'The Challenge of the Future',
      "Party Like It's 1999",
      'All Happy Companies Are Different',
      'The Ideology of Competition',
      'Last Mover Advantage',
      'You Are Not a Lottery Ticket',
      'Follow the Money',
      'Secrets',
      'Foundations',
      'The Mechanics of Mafia',
      'If You Build It, Will They Come?',
      'Man and Machine',
      'Seeing Green',
      "The Founder's Paradox",
    ],
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
    // 4 langkah DEAL: Definition, Elimination, Automation, Liberation.
    chapters: [
      'Cautions and Comparisons',
      'Rules That Change the Rules',
      'Dodging Bullets (Fear-Setting)',
      'System Reset',
      'The End of Time Management',
      'The Low-Information Diet',
      'Interrupting Interruption',
      'Outsourcing Life',
      'Income Autopilot I: Finding the Muse',
      'Income Autopilot II: Testing the Muse',
      'Income Autopilot III: Management by Absence',
      'Disappearing Act: Escape the Office',
      'Beyond Repair: Killing Your Job',
      'Mini-Retirements',
      'Filling the Void',
    ],
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
    chapters: [
      'Rich Dad, Poor Dad',
      "Pelajaran 1: The Rich Don't Work for Money",
      'Pelajaran 2: Why Teach Financial Literacy?',
      'Pelajaran 3: Mind Your Own Business',
      'Pelajaran 4: Taxes and Corporations',
      'Pelajaran 5: The Rich Invent Money',
      'Pelajaran 6: Work to Learn, Not for Money',
      'Overcoming Obstacles',
      'Getting Started',
      'Still Want More? (To-Do List)',
    ],
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
    chapters: [
      'The Man Who Desired Gold',
      'The Richest Man in Babylon',
      'Seven Cures for a Lean Purse',
      'Meet the Goddess of Good Luck',
      'The Five Laws of Gold',
      'The Gold Lender of Babylon',
      'The Walls of Babylon',
      'The Camel Trader of Babylon',
      'The Clay Tablets from Babylon',
      'The Luckiest Man in Babylon',
    ],
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
    // 31 pasal — 1 pasal per hari.
    chapters: Array.from({ length: 31 }, (_, i) => `Pasal ${i + 1}`),
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
    chapters: [
      'Deep Work Is Valuable',
      'Deep Work Is Rare',
      'Deep Work Is Meaningful',
      'Aturan 1: Work Deeply',
      'Aturan 2: Embrace Boredom',
      'Aturan 3: Quit Social Media',
      'Aturan 4: Drain the Shallows',
    ],
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
    chapters: [
      'The Surprising Power of Atomic Habits',
      'How Your Habits Shape Your Identity',
      'How to Build Better Habits in 4 Steps',
      'The Man Who Didn’t Look Right (Make It Obvious)',
      'The Best Way to Start a New Habit',
      'Motivation Is Overrated; Environment Matters',
      'The Secret to Self-Control',
      'How to Make a Habit Irresistible',
      'The Role of Family and Friends',
      'How to Find and Fix the Causes of Your Bad Habits',
      'Walk Slowly but Never Backward (Make It Easy)',
      'The Law of Least Effort',
      'How to Stop Procrastinating (Two-Minute Rule)',
      'How to Make Good Habits Inevitable',
      'The Cardinal Rule of Behavior Change (Make It Satisfying)',
      'How to Stick with Good Habits Every Day',
      'How an Accountability Partner Can Change Everything',
      'The Truth About Talent',
      'The Goldilocks Rule',
      'The Downside of Creating Good Habits',
    ],
  },
  // ---------- 🌍 Wawasan ----------
  // Dua buku ini persis yang tertulis di daftar Skills-mu, jadi sekalian
  // dimasukkan ke sini supaya bisa dicentang per bab dari fitur Learning.
  {
    key: 'sapiens',
    category: 'insight',
    title: 'Sapiens: A Brief History of Humankind',
    author: 'Yuval Noah Harari',
    year: 2011,
    info: 'Sejarah manusia dari kera biasa jadi penguasa bumi — lewat cerita bersama: uang, agama, negara, dan perusahaan. Modal dasar memahami cara kerja dunia hari ini.',
    url: 'https://www.ynharari.com/book/sapiens-2/',
    linkKind: 'info',
    chapters: [
      'Bagian 1 · 1. An Animal of No Significance',
      'Bagian 1 · 2. The Tree of Knowledge',
      'Bagian 1 · 3. A Day in the Life of Adam and Eve',
      'Bagian 1 · 4. The Flood',
      'Bagian 2 · 5. History’s Biggest Fraud',
      'Bagian 2 · 6. Building Pyramids',
      'Bagian 2 · 7. Memory Overload',
      'Bagian 2 · 8. There is No Justice in History',
      'Bagian 3 · 9. The Arrow of History',
      'Bagian 3 · 10. The Scent of Money',
      'Bagian 3 · 11. Imperial Visions',
      'Bagian 3 · 12. The Law of Religion',
      'Bagian 3 · 13. The Secret of Success',
      'Bagian 4 · 14. The Discovery of Ignorance',
      'Bagian 4 · 15. The Marriage of Science and Empire',
      'Bagian 4 · 16. The Capitalist Creed',
      'Bagian 4 · 17. The Wheels of Industry',
      'Bagian 4 · 18. A Permanent Revolution',
      'Bagian 4 · 19. And They Lived Happily Ever After',
      'Bagian 4 · 20. The End of Homo Sapiens',
    ],
  },
  {
    key: 'thinking-fast-and-slow',
    category: 'insight',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    year: 2011,
    info: 'Dua cara otak berpikir: cepat & otomatis vs lambat & teliti. Membongkar kenapa kita gampang termakan hoax, iklan, dan firasat yang keliru.',
    url: 'https://en.wikipedia.org/wiki/Thinking,_Fast_and_Slow',
    linkKind: 'info',
    chapters: [
      'I · 1. The Characters of the Story',
      'I · 2. Attention and Effort',
      'I · 3. The Lazy Controller',
      'I · 4. The Associative Machine',
      'I · 5. Cognitive Ease',
      'I · 6. Norms, Surprises, and Causes',
      'I · 7. A Machine for Jumping to Conclusions',
      'I · 8. How Judgments Happen',
      'I · 9. Answering an Easier Question',
      'II · 10. The Law of Small Numbers',
      'II · 11. Anchors',
      'II · 12. The Science of Availability',
      'II · 13. Availability, Emotion, and Risk',
      'II · 14. Tom W’s Specialty',
      'II · 15. Linda: Less is More',
      'II · 16. Causes Trump Statistics',
      'II · 17. Regression to the Mean',
      'II · 18. Taming Intuitive Predictions',
      'III · 19. The Illusion of Understanding',
      'III · 20. The Illusion of Validity',
      'III · 21. Intuitions vs. Formulas',
      'III · 22. Expert Intuition: When Can We Trust It?',
      'III · 23. The Outside View',
      'III · 24. The Engine of Capitalism',
      'IV · 25. Bernoulli’s Errors',
      'IV · 26. Prospect Theory',
      'IV · 27. The Endowment Effect',
      'IV · 28. Bad Events',
      'IV · 29. The Fourfold Pattern',
      'IV · 30. Rare Events',
      'IV · 31. Risk Policies',
      'IV · 32. Keeping Score',
      'IV · 33. Reversals',
      'IV · 34. Frames and Reality',
      'V · 35. Two Selves',
      'V · 36. Life as a Story',
      'V · 37. Experienced Well-Being',
      'V · 38. Thinking About Life',
    ],
  },
];

// ===================== Progres baca per-bab =====================
// SATU dokumen kecil users/{uid}/reading/books —
//   { chapters: { [bookKey]: { [idxBab]: true } } }
// idxBab = indeks bab (0-based) dijadikan string oleh Firestore.

// bookKey → { idxBab → sudah dibaca }
export type ChaptersReadMap = Record<string, Record<string, boolean>>;

export function subscribeReadingProgress(
  uid: string,
  onChange: (chapters: ChaptersReadMap) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'reading', 'books');
  return liveDoc(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.chapters as ChaptersReadMap) ?? {});
    },
    onError,
  );
}

/** Centang / hapus centang satu bab. Merge → bab lain tidak terganggu. */
export function setChapterRead(
  uid: string,
  bookKey: string,
  chapterIndex: number,
  read: boolean,
) {
  const ref = doc(db, 'users', uid, 'reading', 'books');
  return setDoc(
    ref,
    { chapters: { [bookKey]: { [chapterIndex]: read } } },
    { merge: true },
  );
}

/** Berapa bab buku ini yang sudah dicentang. */
export function chapterReadCount(
  chapters: ChaptersReadMap,
  book: Book,
): number {
  const map = chapters[book.key] ?? {};
  return book.chapters.reduce((n, _c, i) => (map[i] ? n + 1 : n), 0);
}

/** Buku dianggap selesai kalau SEMUA babnya sudah dicentang. */
export function isBookComplete(chapters: ChaptersReadMap, book: Book): boolean {
  return (
    book.chapters.length > 0 &&
    chapterReadCount(chapters, book) === book.chapters.length
  );
}
