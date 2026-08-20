import {
  deleteField,
  doc,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { dayDocId } from './health';
import { weekStart } from './usage';

// Learning 🎓 — SATU ilmu baru tiap minggu, supaya tidak ketinggalan soal
// teknologi, dunia, dan skill umum.
//
// Kenapa dibuat "per minggu", bukan "per hari":
// jadwal harianmu sudah padat (39 kebiasaan, doa pagi & malam, Alkitab, olahraga).
// Menambah satu beban harian lagi hampir pasti gagal. Satu topik per minggu yang
// dicicil 4 kali @ 5–15 menit itu total cuma ±45 menit seminggu — kecil, tapi
// dalam setahun jadi 52 ilmu baru.
//
// Daftar skill & topik diskusi STATIK di sini (tidak masuk Firestore) supaya
// ringan & gratis. Yang disimpan hanya kemajuanmu:
//   users/{uid}/learning/{weekId}  → { skillKey, steps, note }   (per minggu)
//   users/{uid}/learning/skills    → { done: { [skillKey]: weekId } }
//   users/{uid}/learning/topics    → { done: { [topicKey]: true } }
// weekId = dayId hari SENIN minggu itu, mis. "2026-08-10".

// ===================== Bidang & skill =====================

export type SkillArea = {
  key: string;
  label: string;
  emoji: string;
};

export const SKILL_AREAS: SkillArea[] = [
  { key: 'productivity', label: 'Productivity & Creativity', emoji: '💡' },
  { key: 'life', label: 'Basic Life Skills', emoji: '🧰' },
  { key: 'science', label: 'Science & Environment', emoji: '🌱' },
  { key: 'tech', label: 'Technology & Digital', emoji: '💻' },
  { key: 'politics', label: 'Politics & Social', emoji: '⚖️' },
  { key: 'business', label: 'Economics & Business', emoji: '💼' },
];

export function skillAreaMeta(key: string): SkillArea {
  return SKILL_AREAS.find((a) => a.key === key) ?? SKILL_AREAS[0];
}

export type Skill = {
  key: string;
  area: string;
  title: string;
  /** "What I Learn" — apa yang didapat dari topik ini. */
  what: string;
  /** Judul buku rujukan (apa adanya dari daftarmu). */
  book?: string;
  /** Diisi kalau bukunya SUDAH ada di fitur Book → bisa dibuka langsung. */
  bookKey?: string;
  /** Catatan tambahan dari kolom Extra. */
  extra?: string;
};

// 22 skill, urut sesuai daftarmu. URUTAN JANGAN DIACAK: topik minggu ini
// dipilih dari urutan ini, dan `key`-nya dipakai sebagai id di Firestore.
export const SKILLS: Skill[] = [
  // ---------- 💡 Productivity & Creativity ----------
  {
    key: 'critical-thinking',
    area: 'productivity',
    title: 'Critical Thinking & Problem Solving',
    what: 'Kemampuan berpikir logis dan menyelesaikan masalah.',
    book: 'Critical Thinking — Richard Paul (2006)',
  },
  {
    key: 'soft-skills',
    area: 'productivity',
    title: 'Soft Skills & Leadership',
    what: 'Cara berkomunikasi, negosiasi, dan bekerja dalam tim.',
    book: 'How to Win Friends and Influence People — Dale Carnegie (1981)',
  },
  {
    key: 'creativity',
    area: 'productivity',
    title: 'Creativity & Innovation',
    what: 'Cara berpikir "out of the box", desain, seni, storytelling.',
    book: 'The Creative Habit — Twyla Tharp',
  },
  // ---------- 🧰 Basic Life Skills ----------
  {
    key: 'first-aid',
    area: 'life',
    title: 'Health & First Aid',
    what: 'Cara menjaga kesehatan, pertolongan pertama (CPR, luka, cedera), pola makan sehat.',
    book: 'Buku P3K',
  },
  {
    key: 'survival',
    area: 'life',
    title: 'Survival Skills',
    what: 'Cara menghadapi bencana alam, survival di alam liar atau situasi darurat.',
    book: 'Buku Survival',
  },
  {
    key: 'eq',
    area: 'life',
    title: 'Emotional Intelligence (EQ)',
    what: 'Kemampuan mengelola emosi, empati, komunikasi yang baik.',
    book: 'Emotional Intelligence — Daniel Goleman',
  },
  // ---------- 🌱 Science & Environment ----------
  {
    key: 'climate',
    area: 'science',
    title: 'Climate Change & Renewable Energy',
    what: 'Cara menghemat energi, solusi masa depan (solar, angin, dll.).',
    book: 'This Changes Everything — Naomi Klein (2014)',
    extra: 'Plastik & gas rumah kaca',
  },
  {
    key: 'biotech',
    area: 'science',
    title: 'Biotechnology & Health',
    what: 'Pemahaman tentang vaksin, terapi gen, dan kemajuan medis.',
    book: 'The Gene — Siddhartha Mukherjee',
  },
  {
    key: 'urban-farming',
    area: 'science',
    title: 'Food Security & Urban Farming',
    what: 'Menanam makanan sendiri, memahami pertanian modern.',
    book: 'The Urban Farmer',
  },
  // ---------- 💻 Technology & Digital ----------
  {
    key: 'computer-basics',
    area: 'tech',
    title: 'Computer & Internet Basics',
    what: 'Cara kerja komputer, keamanan siber, AI, teknologi blockchain.',
    extra: 'Password manager',
  },
  {
    key: 'ai',
    area: 'tech',
    title: 'Data Science & AI',
    what: 'Pemahaman dasar tentang kecerdasan buatan dan data yang mengubah dunia.',
  },
  {
    key: 'cybersecurity',
    area: 'tech',
    title: 'Cybersecurity & Digital Privacy',
    what: 'Cara melindungi data pribadi dari peretasan.',
  },
  {
    key: 'digital-marketing',
    area: 'tech',
    title: 'Digital Marketing & E-commerce',
    what: 'Penting untuk bisnis dan karier masa depan.',
    book: 'Digital Marketing for Dummies',
  },
  // ---------- ⚖️ Politics & Social ----------
  {
    key: 'geopolitics',
    area: 'politics',
    title: 'Geopolitics & International Relations',
    what: 'Cara kerja negara, konflik global, ekonomi dunia.',
    book: 'Sapiens — Yuval Noah Harari',
    bookKey: 'sapiens',
  },
  {
    key: 'law',
    area: 'politics',
    title: 'Basic Law & Human Rights',
    what: 'Hak kita sebagai warga negara, hukum global.',
    book: 'The Rule of Law — Tom Bingham',
  },
  {
    key: 'media-literacy',
    area: 'politics',
    title: 'Social Psychology & Media Manipulation',
    what: 'Cara memahami propaganda, hoax, dan bias informasi.',
    book: 'Thinking, Fast and Slow — Daniel Kahneman',
    bookKey: 'thinking-fast-and-slow',
  },
  {
    key: 'ethics',
    area: 'politics',
    title: 'Ethics & Philosophy',
    what: 'Cara berpikir kritis, membuat keputusan moral yang tepat.',
    book: 'The Ethics of Ambiguity — Simone de Beauvoir',
  },
  // ---------- 💼 Economics & Business ----------
  // Empat baris di bawah kolom "What I Learn"-nya masih kosong di daftarmu —
  // isian di sini tebakan awal, tinggal kamu betulkan kalau maksudnya beda.
  {
    key: 'storytelling',
    area: 'business',
    title: 'How To Become A Master Storyteller',
    what: 'Menyusun cerita yang bikin orang mau mendengar — kepakai untuk jualan, presentasi, sampai kesaksian.',
  },
  {
    key: 'personal-finance',
    area: 'business',
    title: 'Personal Finance',
    what: 'Manajemen keuangan, investasi, cara mengelola utang, inflasi.',
    book: 'Rich Dad Poor Dad — Robert T. Kiyosaki (1997)',
    bookKey: 'rich-dad-poor-dad',
  },
  {
    key: 'marketing',
    area: 'business',
    title: '30 Years of Marketing Knowledge',
    what: 'Inti pemasaran yang tidak pernah berubah: siapa pembelinya, apa masalahnya, kenapa harus kamu.',
  },
  {
    key: 'selling',
    area: 'business',
    title: 'How to Sell Better than 99% of People',
    what: 'Menjual tanpa memaksa: dengar dulu masalahnya, tawarkan solusi, tutup dengan jelas.',
  },
  {
    key: 'sales-funnel',
    area: 'business',
    title: 'Sales Funnel Strategy',
    what: 'Alur calon pembeli: kenal → percaya → beli → beli lagi, dan apa yang harus disiapkan di tiap tahap.',
  },
];

export function skillOf(key: string): Skill | null {
  return SKILLS.find((s) => s.key === key) ?? null;
}

// ===================== Topik diskusi =====================
// Bahan ngobrol supaya ilmunya keluar jadi percakapan, bukan cuma tersimpan di
// kepala. Dipakai di langkah ke-4 tiap minggu ("Ceritakan").

export type TopicGroup = {
  key: string;
  label: string;
  emoji: string;
  hint: string; // enaknya dibahas dengan siapa
};

export const TOPIC_GROUPS: TopicGroup[] = [
  {
    key: 'marriage',
    label: 'Marriage & Parenting',
    emoji: '💍',
    hint: 'Bahan diskusi serius dengan calon/pasangan',
  },
  {
    key: 'entertainment',
    label: 'Entertainment',
    emoji: '🎢',
    hint: 'Diskusi ringan biar akrab dengan siapa saja',
  },
  {
    key: 'job',
    label: 'Job & Study',
    emoji: '🏢',
    hint: 'Bidang kerja & keilmuan — bagus untuk networking',
  },
  {
    key: 'faith',
    label: 'Faith & Church',
    emoji: '✝️',
    hint: 'Bahan diskusi CORE, komsel, & pelayanan',
  },
  {
    key: 'world',
    label: 'Indonesia & World',
    emoji: '🌎',
    hint: 'Biar tidak buta soal negeri sendiri & dunia',
  },
  {
    key: 'wellness',
    label: 'Wellness & Fitness',
    emoji: '🏋️',
    hint: 'Nyambung dengan fitur Health & Habits',
  },
];

export function topicGroupMeta(key: string): TopicGroup {
  return TOPIC_GROUPS.find((g) => g.key === key) ?? TOPIC_GROUPS[0];
}

export type Topic = { key: string; group: string; label: string };

// 62 topik. `key` dipakai sebagai id di Firestore → JANGAN diubah namanya.
export const TOPICS: Topic[] = [
  // 💍 Marriage & Parenting
  { key: 'marriage-expectation', group: 'marriage', label: 'Expectation about Marriage' },
  { key: 'marriage-communication', group: 'marriage', label: 'Communication & Conflict Resolution' },
  { key: 'marriage-finance', group: 'marriage', label: 'Financial Planning' },
  { key: 'marriage-child', group: 'marriage', label: 'Plan Family & Child' },
  { key: 'marriage-career', group: 'marriage', label: 'Career & Professional Ambition' },
  { key: 'marriage-residence', group: 'marriage', label: 'Residence' },
  { key: 'marriage-lifestyle', group: 'marriage', label: 'Health, Lifestyle & Hobbies' },
  { key: 'marriage-relatives', group: 'marriage', label: 'Relationships with Parents & Friends' },
  { key: 'marriage-sexual', group: 'marriage', label: 'Sexual Life' },
  { key: 'marriage-household', group: 'marriage', label: 'Household Responsibilities' },
  { key: 'marriage-future', group: 'marriage', label: 'Future Plan' },
  { key: 'marriage-assets', group: 'marriage', label: 'Ownership & Assets' },
  { key: 'marriage-time', group: 'marriage', label: 'Time Management' },
  { key: 'marriage-love', group: 'marriage', label: 'Expression of Love & Appreciation' },
  { key: 'marriage-holiday', group: 'marriage', label: 'Honeymoon & Holiday' },
  // 🎢 Entertainment
  { key: 'ent-music', group: 'entertainment', label: 'Music & Concerts' },
  { key: 'ent-movies', group: 'entertainment', label: 'Movies & Cinema' },
  { key: 'ent-tv', group: 'entertainment', label: 'Television & Series' },
  { key: 'ent-theater', group: 'entertainment', label: 'Theater' },
  { key: 'ent-books', group: 'entertainment', label: 'Books & Literature' },
  { key: 'ent-games', group: 'entertainment', label: 'Games & Arcades' },
  { key: 'ent-sports', group: 'entertainment', label: 'Sports Events' },
  { key: 'ent-comic', group: 'entertainment', label: 'Comic & Animation' },
  { key: 'ent-festival', group: 'entertainment', label: 'Festivals & Exhibitions' },
  { key: 'ent-club', group: 'entertainment', label: 'Club & Bar' },
  { key: 'ent-tourism', group: 'entertainment', label: 'Tourism & Tours' },
  // 🏢 Job & Study
  { key: 'job-technology', group: 'job', label: 'Technology' },
  { key: 'job-education', group: 'job', label: 'Education' },
  { key: 'job-law', group: 'job', label: 'Law' },
  { key: 'job-health', group: 'job', label: 'Health & Medicine' },
  { key: 'job-business', group: 'job', label: 'Business & Economics' },
  { key: 'job-natural-science', group: 'job', label: 'Natural Science' },
  { key: 'job-humanities', group: 'job', label: 'Humanities' },
  { key: 'job-social-science', group: 'job', label: 'Social Science' },
  { key: 'job-art', group: 'job', label: 'Art & Design' },
  { key: 'job-engineering', group: 'job', label: 'Engineering' },
  { key: 'job-oceanography', group: 'job', label: 'Oceanography' },
  { key: 'job-agriculture', group: 'job', label: 'Agriculture & Environment' },
  { key: 'job-journalism', group: 'job', label: 'Communication & Journalism' },
  { key: 'job-architecture', group: 'job', label: 'Architecture & Planning' },
  // ✝️ Faith & Church
  { key: 'faith-theology', group: 'faith', label: 'Christian Theology' },
  { key: 'faith-sacrament', group: 'faith', label: 'Sacrament' },
  { key: 'faith-biblical', group: 'faith', label: 'Biblical Studies' },
  { key: 'faith-ecumenism', group: 'faith', label: 'Ecumenism & Interreligious Dialogue' },
  { key: 'faith-mission', group: 'faith', label: 'Mission & Evangelization' },
  { key: 'faith-other-religions', group: 'faith', label: 'Other Religions' },
  { key: 'faith-society', group: 'faith', label: 'Christianity & Society' },
  { key: 'faith-antichrist', group: 'faith', label: 'Antichrist & Tribulation' },
  { key: 'faith-lgbtqia', group: 'faith', label: 'LGBTQIA+' },
  { key: 'faith-volunteering', group: 'faith', label: 'Social Issues & Volunteering' },
  // 🌎 Indonesia & World
  { key: 'world-islands', group: 'world', label: 'Islands' },
  { key: 'world-culture', group: 'world', label: 'Culture & Tradition' },
  { key: 'world-culinary', group: 'world', label: 'Culinary' },
  { key: 'world-language', group: 'world', label: 'Language' },
  { key: 'world-future', group: 'world', label: 'Future Challenges & Opportunities' },
  { key: 'world-travel', group: 'world', label: 'Travel & Adventure' },
  { key: 'world-politics', group: 'world', label: 'Political Issue' },
  // 🏋️ Wellness & Fitness
  { key: 'well-nutrition', group: 'wellness', label: 'Nutrition & Diet' },
  { key: 'well-sports', group: 'wellness', label: 'Sports & Physical Activities' },
  { key: 'well-mental', group: 'wellness', label: 'Mental Health' },
  { key: 'well-selfcare', group: 'wellness', label: 'Self Care' },
  { key: 'well-hygiene', group: 'wellness', label: 'Hygiene' },
];

// ===================== Jadwal mingguan =====================
// Empat langkah kecil, ditaruh di hari yang JADWALMU MEMANG LOWONG:
//   Senin  — Selasa & Kamis sudah kepakai Doa Rantai CL, jadi mulai Senin.
//   Rabu   — jeda 2 hari dari Senin. Jeda itu bukan malas: otak justru lebih
//            kuat mengingat kalau diulang berjarak (spaced repetition).
//   Jumat  — menutup minggu kerja dengan merangkum.
//   Minggu — Sabtu sudah penuh (gereja), jadi "ceritakan" ditaruh Minggu.
// Waktu terbaik mengerjakannya: JAM MAKAN SIANG. Paginya sudah 20 kebiasaan,
// malamnya sudah ada Phone Away 21.30 + tidur 22.00 — dua-duanya jangan diganggu.

export type LearningStep = 'discover' | 'dig' | 'summarize' | 'share';

export const LEARNING_STEPS: {
  key: LearningStep;
  /** Posisi hari dalam minggu Senin-dulu: Sen=0 … Min=6. */
  pos: number;
  day: string;
  emoji: string;
  label: string;
  minutes: number;
  how: string;
}[] = [
  {
    key: 'discover',
    pos: 0,
    day: 'Senin',
    emoji: '🎯',
    label: 'Kenali',
    minutes: 15,
    how: 'Cari gambaran besarnya dulu. Cukup sampai bisa menjawab "ini apa, dan kenapa penting buatku?"',
  },
  {
    key: 'dig',
    pos: 2,
    day: 'Rabu',
    emoji: '📖',
    label: 'Gali',
    minutes: 15,
    how: 'SATU sumber saja: 1 bab buku, 1 artikel, atau 1 video. Banyak sumber malah bikin tidak ada yang masuk.',
  },
  {
    key: 'summarize',
    pos: 4,
    day: 'Jumat',
    emoji: '✍️',
    label: 'Rangkum',
    minutes: 10,
    how: 'Tulis 3 poin pakai bahasamu sendiri di kotak bawah. Inilah langkah yang bikin ilmunya benar-benar nempel.',
  },
  {
    key: 'share',
    pos: 6,
    day: 'Minggu',
    emoji: '💬',
    label: 'Ceritakan',
    minutes: 5,
    how: 'Ceritakan ke 1 orang, pakai topik diskusi di bawah. Kalau bisa menjelaskan, berarti kamu memang paham.',
  },
];

/** Posisi hari dalam minggu Senin-dulu: Sen=0 … Min=6. */
function dayPos(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** id minggu = dayId hari Senin minggu itu, mis. "2026-08-10". */
export function weekDocId(now = new Date()): string {
  return dayDocId(weekStart(now));
}

/**
 * Nomor minggu berjalan sejak epoch — angka yang naik 1 tiap Senin.
 * Dipakai untuk memutar topik supaya kamu tidak perlu memilih sendiri.
 * (Indonesia tanpa DST, jadi jarak antar-Senin selalu tepat 7 hari.)
 */
function weekNumber(now: Date): number {
  return Math.floor(weekStart(now).getTime() / 604_800_000);
}

/** Skill giliran minggu ini (rotasi otomatis, ±5 bulan sekali putaran). */
export function skillOfWeek(now = new Date()): Skill {
  return SKILLS[weekNumber(now) % SKILLS.length];
}

/** Berapa topik diskusi yang digilirkan tiap minggu. */
export const TOPICS_PER_WEEK = 3;

/**
 * Topik diskusi giliran minggu ini — tiga sekaligus, diambil berurutan lalu
 * digeser 3 tiap minggu. Tiga selalu berbeda (daftarnya jauh lebih panjang),
 * dan karena 3 tidak habis membagi jumlah topik, putarannya tetap kebagian
 * semua sebelum mengulang.
 */
export function topicsOfWeek(now = new Date()): Topic[] {
  const start = (weekNumber(now) * TOPICS_PER_WEEK) % TOPICS.length;
  return Array.from(
    { length: TOPICS_PER_WEEK },
    (_, i) => TOPICS[(start + i) % TOPICS.length],
  );
}

/**
 * Langkah yang HARINYA SUDAH TIBA tapi belum dikerjakan.
 *
 * Satu-satunya aturan penagihan Learning — kartu reminder Dashboard & badge
 * tile Home sama-sama berangkat dari sini, jadi keduanya mustahil berbeda
 * pendapat. Langkah yang harinya belum tiba sengaja tidak ditagih, dan yang
 * kelewat tetap muncul sampai dikerjakan (tidak hangus di tengah minggu).
 */
function overdueSteps(
  steps: Record<string, boolean>,
  now: Date,
): typeof LEARNING_STEPS {
  const today = dayPos(now);
  return LEARNING_STEPS.filter((s) => s.pos <= today && !steps[s.key]);
}

/**
 * Langkah TERDEKAT yang perlu dikerjakan — isi kartu reminder di Dashboard.
 * null = tidak ada yang perlu ditagih hari ini.
 */
export function dueStep(
  steps: Record<string, boolean>,
  now = new Date(),
): (typeof LEARNING_STEPS)[number] | null {
  return overdueSteps(steps, now)[0] ?? null;
}

/**
 * BERAPA langkah yang tertagih — angka badge tile Learning di Home.
 * 0 = badge hilang: belum ada yang jatuh tempo, atau minggu ini memang sudah
 * beres 🎉 (mis. hari Minggu & semuanya kosong → 4).
 */
export function pendingSteps(
  steps: Record<string, boolean>,
  now = new Date(),
): number {
  return overdueSteps(steps, now).length;
}

/** Berapa dari 4 target minggu ini yang sudah beres. */
export function stepsDone(steps: Record<string, boolean>): number {
  return LEARNING_STEPS.filter((s) => steps[s.key]).length;
}

/** Semua target minggu ini beres? → skill-nya boleh ditandai selesai. */
export function weekComplete(steps: Record<string, boolean>): boolean {
  return stepsDone(steps) === LEARNING_STEPS.length;
}

// ===================== Firestore =====================

export type LearningWeek = {
  /** null = ikut rotasi otomatis (belum pernah diganti manual). */
  skillKey: string | null;
  steps: Record<string, boolean>;
  note: string;
};

export const EMPTY_WEEK: LearningWeek = { skillKey: null, steps: {}, note: '' };

function weekRef(uid: string, weekId: string) {
  return doc(db, 'users', uid, 'learning', weekId);
}

export function subscribeLearningWeek(
  uid: string,
  weekId: string,
  onChange: (week: LearningWeek) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    weekRef(uid, weekId),
    (snapshot) => {
      const d = snapshot.data();
      onChange({
        skillKey: (d?.skillKey as string) ?? null,
        steps: (d?.steps as Record<string, boolean>) ?? {},
        note: (d?.note as string) ?? '',
      });
    },
    onError,
  );
}

/** Centang / lepas satu target minggu ini. */
export function setLearningStep(
  uid: string,
  weekId: string,
  step: LearningStep,
  done: boolean,
) {
  return setDoc(weekRef(uid, weekId), { steps: { [step]: done } }, { merge: true });
}

/** Simpan rangkuman 3 poin minggu ini. */
export function setLearningNote(uid: string, weekId: string, note: string) {
  return setDoc(weekRef(uid, weekId), { note }, { merge: true });
}

/** Ganti topik minggu ini secara manual (menimpa rotasi otomatis). */
export function setWeekSkill(uid: string, weekId: string, skillKey: string) {
  return setDoc(weekRef(uid, weekId), { skillKey }, { merge: true });
}

// ---- Skill yang sudah dituntaskan: { done: { [skillKey]: weekId } } ----

export type SkillsDone = Record<string, string>;

function skillsRef(uid: string) {
  return doc(db, 'users', uid, 'learning', 'skills');
}

export function subscribeSkillsDone(
  uid: string,
  onChange: (done: SkillsDone) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    skillsRef(uid),
    (snapshot) => onChange((snapshot.data()?.done as SkillsDone) ?? {}),
    onError,
  );
}

/**
 * Tandai skill selesai (nilai = weekId saat menuntaskannya) atau BATALKAN.
 * Membatalkan memakai deleteField → datanya benar-benar hilang, bukan disimpan
 * sebagai penanda "pernah ada".
 */
export function setSkillDone(uid: string, skillKey: string, weekId: string | null) {
  return setDoc(
    skillsRef(uid),
    { done: { [skillKey]: weekId ?? deleteField() } },
    { merge: true },
  );
}

// ---- Topik diskusi yang sudah dibahas: { done: { [topicKey]: true } } ----

export type TopicsDone = Record<string, boolean>;

function topicsRef(uid: string) {
  return doc(db, 'users', uid, 'learning', 'topics');
}

export function subscribeTopicsDone(
  uid: string,
  onChange: (done: TopicsDone) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    topicsRef(uid),
    (snapshot) => onChange((snapshot.data()?.done as TopicsDone) ?? {}),
    onError,
  );
}

export function setTopicDone(uid: string, topicKey: string, done: boolean) {
  return setDoc(
    topicsRef(uid),
    { done: { [topicKey]: done ? true : deleteField() } },
    { merge: true },
  );
}
