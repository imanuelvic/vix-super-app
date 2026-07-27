import {
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// CORE — komunitas sel gereja. Pemilik app adalah MCL (Mentor CORE Leader)
// yang menggembalakan beberapa CORE Leader (CL). Fitur ini membantu:
// 1) menyimpan data CL (nama, warna hati CORE, tanggal lahir),
// 2) tugas follow up harian yang dibagi merata + ide topik chat.
//
// Penyimpanan: SATU dokumen (users/{uid}/core/leaders) berisi array CL —
// daftarnya kecil, jadi 1 read per buka dan tulis utuh saat berubah.

export type CoreLeader = {
  id: string;
  name: string;
  heart: string; // emoji hati = warna CORE mereka
  birthYear: number;
  birthMonth: number; // 0–11 seperti Date JS
  birthDay: number;
  phone: string | null; // digit SETELAH +62 (semua CL orang Indonesia)
  lastFollowupDayId: string | null; // "YYYY-MM-DD" terakhir di follow up
  // Kepribadian (opsional) — bantu cara pendekatan & ide chat.
  disc?: string | null; // 'D' | 'I' | 'S' | 'C'
  mbti?: string | null; // mis. 'INFJ'
  loveLanguage?: string | null; // key dari LOVE_LANG_OPTIONS
};

// Data awal para CL — tampil sebelum dokumen pernah disimpan.
export const DEFAULT_LEADERS: CoreLeader[] = [
  { id: 'febryna', name: 'Febryna', heart: '💛', birthYear: 1999, birthMonth: 1, birthDay: 4, phone: null, lastFollowupDayId: null },
  { id: 'novia', name: 'Novia', heart: '💜', birthYear: 1998, birthMonth: 10, birthDay: 4, phone: null, lastFollowupDayId: null },
  { id: 'lanemey', name: 'Lanemey', heart: '💚', birthYear: 2002, birthMonth: 4, birthDay: 9, phone: null, lastFollowupDayId: null },
  { id: 'elvina', name: 'Elvina', heart: '🤍', birthYear: 1996, birthMonth: 7, birthDay: 1, phone: null, lastFollowupDayId: null },
  { id: 'david', name: 'David', heart: '💙', birthYear: 1998, birthMonth: 2, birthDay: 21, phone: null, lastFollowupDayId: null },
  { id: 'sarah', name: 'Sarah', heart: '🧡', birthYear: 1998, birthMonth: 10, birthDay: 10, phone: null, lastFollowupDayId: null },
  { id: 'theofilus', name: 'Theofilus', heart: '🩵', birthYear: 1997, birthMonth: 0, birthDay: 25, phone: null, lastFollowupDayId: null },
  { id: 'reyki', name: 'Reyki', heart: '🖤', birthYear: 2001, birthMonth: 10, birthDay: 22, phone: null, lastFollowupDayId: null },
  { id: 'riky', name: 'Riky', heart: '🤎', birthYear: 2001, birthMonth: 1, birthDay: 3, phone: null, lastFollowupDayId: null },
];

/** Pilihan warna hati untuk CL baru. */
export const HEARTS = ['🩷', '❤️', '🧡', '💛', '💚', '🩵', '💙', '💜', '🖤', '🩶', '🤍', '🤎'];

/** Berapa CL yang di follow up per hari (9 CL ≈ semua kebagian tiap ±5 hari). */
export const FOLLOWUPS_PER_DAY = 2;

/** Berapa Main Team yang di follow up per hari. */
export const FOLLOWUPS_MT_PER_DAY = 2;

// Main Team: 2–4 orang yang membantu tiap CORE Leader. Disimpan di dokumen
// terpisah (users/{uid}/core/mainTeam) supaya dokumen leaders tetap kecil.
export type MainTeamMember = {
  id: string;
  name: string;
  leaderId: string; // id CORE Leader yang dibantu
  birthYear: number;
  birthMonth: number; // 0–11 seperti Date JS
  birthDay: number;
  phone: string | null; // digit setelah +62
  lastFollowupDayId: string | null;
  // Kepribadian (opsional).
  disc?: string | null;
  mbti?: string | null;
  loveLanguage?: string | null;
};

export function subscribeMainTeam(
  uid: string,
  onChange: (members: MainTeamMember[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'mainTeam');
  return onSnapshot(
    ref,
    (snapshot) => {
      const list = snapshot.data()?.list as MainTeamMember[] | undefined;
      onChange((list ?? []).map((m) => ({ ...m, ...normalizePersonality(m) })));
    },
    onError,
  );
}

/** Simpan seluruh daftar Main Team (array kecil, ditulis utuh). */
export function saveMainTeam(uid: string, list: MainTeamMember[]) {
  const ref = doc(db, 'users', uid, 'core', 'mainTeam');
  return setDoc(ref, { list });
}

/** Id unik untuk anggota Main Team baru. */
export function newMainTeamId(): string {
  return `m${Date.now().toString(36)}`;
}

export function subscribeCoreLeaders(
  uid: string,
  onChange: (leaders: CoreLeader[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'leaders');
  return onSnapshot(
    ref,
    (snapshot) => {
      const list = snapshot.data()?.list as CoreLeader[] | undefined;
      // Data lama mungkin belum punya field baru — lengkapi dengan null.
      onChange(
        (list ?? DEFAULT_LEADERS).map((l) => ({ ...l, ...normalizePersonality(l) })),
      );
    },
    onError,
  );
}

/** Normalisasi input nomor HP Indonesia → digit setelah +62 (atau null). */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('62')) d = d.slice(2);
  while (d.startsWith('0')) d = d.slice(1);
  return d.length >= 8 ? d : null; // terlalu pendek = anggap belum diisi
}

/** Link chat WhatsApp (wa.me), dengan pesan awal opsional. */
export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/62${phone}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// ==================== Kepribadian 🧠 (DISC · MBTI · Love Language) ====================
// Dipakai untuk memahami tiap orang & memberi ide cara chat / pendekatan yang
// pas dengan kepribadiannya saat menggembalakan.

type HasPersonality = {
  phone?: string | null;
  disc?: string | null;
  mbti?: string | null;
  loveLanguage?: string | null;
};

/** Pastikan field opsional bernilai null (bukan undefined) — aman disimpan. */
function normalizePersonality(p: HasPersonality) {
  return {
    phone: p.phone ?? null,
    disc: p.disc ?? null,
    mbti: p.mbti ?? null,
    loveLanguage: p.loveLanguage ?? null,
  };
}

/** DISC — gaya dominan + cara chat/pendekatan yang cocok. */
export const DISC_OPTIONS: { key: string; label: string; chat: string }[] = [
  { key: 'D', label: 'D · Dominance', chat: 'Langsung ke inti & singkat. Hargai ketegasan, beri target/tantangan, jangan bertele-tele.' },
  { key: 'I', label: 'I · Influence', chat: 'Ceria & antusias, apresiasi idenya, ajak ngobrol seru atau ketemu rame-rame.' },
  { key: 'S', label: 'S · Steadiness', chat: 'Lembut, sabar, tanya kabar tulus. Beri rasa aman & konsisten, jangan mendesak.' },
  { key: 'C', label: 'C · Conscientiousness', chat: 'Jelas, rapi, beri alasan & data. Hargai ketelitian, hindari basa-basi berlebih.' },
];

/** 5 Love Language + ide tindakan yang bikin dia merasa dikasihi. */
export const LOVE_LANG_OPTIONS: { key: string; label: string; idea: string }[] = [
  { key: 'words', label: '💬 Kata Afirmasi', idea: 'Kirim pujian tulus / ayat penguatan — sebut hal spesifik yang kamu hargai darinya.' },
  { key: 'time', label: '⏳ Waktu Berkualitas', idea: 'Ajak ngopi / video call fokus tanpa main HP — hadir penuh untuk dia.' },
  { key: 'gifts', label: '🎁 Hadiah', idea: 'Kasih kejutan kecil bermakna (jajan favorit, buku, stiker) — tanda kamu ingat dia.' },
  { key: 'service', label: '🤝 Melayani', idea: 'Tawarkan bantuan konkret: antar-jemput, doakan hal spesifik, bantu tugas yang berat.' },
  { key: 'touch', label: '🤗 Sentuhan Fisik', idea: 'Salaman hangat / side-hug / tepuk pundak saat ketemu — kehadiran fisik yang menguatkan.' },
];

/** 16 tipe MBTI. */
export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

/** Ide singkat cara terhubung tiap tipe MBTI. */
export const MBTI_TIP: Record<string, string> = {
  INTJ: 'Suka visi & strategi. Ajak diskusi ide besar & tujuan jangka panjang, hargai kemandiriannya.',
  INTP: 'Pemikir logis. Ajak eksplorasi konsep, beri ruang berpikir, jangan paksa basa-basi.',
  ENTJ: 'Pemimpin natural. Bicara target & solusi, libatkan dalam mengambil keputusan.',
  ENTP: 'Suka ide baru & debat sehat. Ajak brainstorming seru, tantang dengan pertanyaan.',
  INFJ: 'Idealis & dalam. Obrolan makna & hati, dengarkan sungguh, jaga privasinya.',
  INFP: 'Lembut & bernilai. Hargai perasaannya, beri afirmasi, ciptakan ruang aman untuk terbuka.',
  ENFJ: 'Peduli orang. Ajak melayani bareng, apresiasi kepeduliannya, ngobrol dari hati.',
  ENFP: 'Ceria & penuh ide. Ajak kegiatan seru & spontan, dukung mimpi-mimpinya.',
  ISTJ: 'Setia & teratur. Komunikasi jelas & konsisten, hargai tanggung jawabnya, tepati janji.',
  ISFJ: 'Penuh perhatian. Balas kebaikannya, tanya kabar tulus, buat dia merasa dihargai.',
  ESTJ: 'Tegas & praktis. To the point, hargai kerja kerasnya, beri arahan yang jelas.',
  ESFJ: 'Hangat & sosial. Ajak kumpul, apresiasi di depan orang, rawat hubungan.',
  ISTP: 'Praktis & tenang. Ajak aktivitas nyata, beri ruang, jangan banyak drama.',
  ISFP: 'Peka & artistik. Hargai keunikannya, ajak hal santai & indah, bersikap tulus.',
  ESTP: 'Aktif & spontan. Ajak seru-seruan & tantangan, komunikasi langsung & energik.',
  ESFP: 'Ramai & fun. Ajak hangout & rayakan momen, bawa energi positif.',
};

/** Ringkasan ide pendekatan sesuai kepribadian yang sudah diisi. */
export function personalityTips(p: {
  disc?: string | null;
  mbti?: string | null;
  loveLanguage?: string | null;
}): { label: string; text: string }[] {
  const tips: { label: string; text: string }[] = [];
  // DISC bisa 1–2 huruf urut prioritas (mis. "CS"). Pakai huruf PERTAMA
  // (dominan) untuk saran pendekatan, tapi tampilkan gabungannya di label.
  if (p.disc) {
    const primary = DISC_OPTIONS.find((x) => x.key === p.disc![0]);
    if (primary) tips.push({ label: `🎨 DISC ${p.disc}`, text: primary.chat });
  }
  if (p.mbti && MBTI_TIP[p.mbti]) {
    tips.push({ label: `🧩 ${p.mbti}`, text: MBTI_TIP[p.mbti] });
  }
  const ll = p.loveLanguage
    ? LOVE_LANG_OPTIONS.find((x) => x.key === p.loveLanguage)
    : undefined;
  if (ll) tips.push({ label: ll.label, text: ll.idea });
  return tips;
}

/** Label ringkas Love Language untuk badge (tanpa deskripsi). */
export function loveLangLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return LOVE_LANG_OPTIONS.find((x) => x.key === key)?.label ?? null;
}

/** Simpan seluruh daftar CL (array kecil, ditulis utuh). */
export function saveCoreLeaders(uid: string, list: CoreLeader[]) {
  const ref = doc(db, 'users', uid, 'core', 'leaders');
  return setDoc(ref, { list });
}

/** Id unik untuk CL baru. */
export function newCoreLeaderId(): string {
  return `c${Date.now().toString(36)}`;
}

// ==================== Visitasi CORE 📅 ====================
// Jadwal MCL mengunjungi CORE para CL. Satu dokumen berisi array
// (users/{uid}/core/visitations) — reminder H-3 & hari-H muncul di Home.

export type Visitation = {
  id: string;
  leaderId: string; // CORE Leader yang CORE-nya divisit
  date: Timestamp;
  note: string; // tempat/agenda, boleh kosong
  done: boolean; // sudah divisit
};

export function subscribeVisitations(
  uid: string,
  onChange: (items: Visitation[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'visitations');
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.list as Visitation[]) ?? []);
    },
    onError,
  );
}

/** Simpan seluruh jadwal visitasi (array kecil, ditulis utuh). */
export function saveVisitations(uid: string, list: Visitation[]) {
  const ref = doc(db, 'users', uid, 'core', 'visitations');
  return setDoc(ref, { list });
}

/** Id unik untuk jadwal visitasi baru. */
export function newVisitationId(): string {
  return `v${Date.now().toString(36)}`;
}

/** Selisih hari ke jadwal visit (0 = hari ini, negatif = sudah lewat). */
export function visitDaysUntil(v: Visitation, today: Date): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = v.date.toDate();
  const visitDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((visitDay.getTime() - start.getTime()) / 86_400_000);
}

/** Reminder di Home: belum divisit & tinggal ≤3 hari (H-3 s/d hari-H). */
export function visitReminderWindow(v: Visitation, today: Date): boolean {
  const days = visitDaysUntil(v, today);
  return !v.done && days >= 0 && days <= 3;
}

export const VISIT_TIPS: string[] = [
  '📅 Kabari CORE Leader-nya minimal H-3 — pastikan jadwal & tempat fix.',
  '👂 Datang untuk mendengar dulu, bukan mengoreksi. Evaluasi belakangan.',
  '🍔 Bawa konsumsi kecil — perhatian sederhana yang selalu diingat.',
  '📖 Siapkan encouragement / firman singkat untuk CL & member.',
  '📸 Foto kegiatan CORE untuk dikirim ke WAG 😄',
  '🕐 Datang lebih awal, pulang jangan buru-buru — ngobrol dengan member.',
  '📝 Catat kondisi member yang butuh perhatian khusus untuk follow up.',
  '🙏 Tutup dengan mendoakan CL & CORE-nya secara spesifik.',
];

// ==================== Kategori topik follow up ====================
// Dari sheet Relationship 🤝: Life Update - Prayer Chain - Growth Partner.

export type CoreCategory = {
  key: string;
  label: string;
  icon: string;
  questions: string[];
};

export const CORE_CATEGORIES: CoreCategory[] = [
  {
    key: 'spirituality',
    label: 'Spirituality',
    icon: '✝️',
    questions: [
      'Gimana saat teduhmu minggu ini?',
      'Ada firman yang lagi ngena banget buat kamu?',
      'Apa pokok doa yang bisa aku doakan minggu ini?',
    ],
  },
  {
    key: 'health',
    label: 'Health',
    icon: '🍎',
    questions: [
      'Gimana kondisi badanmu akhir-akhir ini? Tidurnya cukup?',
      'Lagi rutin olahraga nggak? 😄',
      'Makannya gimana — sehat kan?',
    ],
  },
  {
    key: 'family',
    label: 'Family',
    icon: '👨‍👩‍👧‍👦',
    questions: [
      'Gimana kabar keluargamu?',
      'Ada yang bisa didoakan buat keluargamu?',
      'Hubungan sama orang tua / saudara lagi gimana?',
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: '💵',
    questions: [
      'Gimana kondisi keuanganmu bulan ini, aman?',
      'Ada beban finansial yang bisa kita doakan bareng?',
      'Lagi nabung buat sesuatu nggak?',
    ],
  },
  {
    key: 'ministry',
    label: 'Ministry',
    icon: '🙏',
    questions: [
      'Gimana pelayananmu, ada kendala?',
      'Gimana kabar CORE member-mu?',
      'Ada member yang lagi perlu perhatian khusus?',
    ],
  },
  {
    key: 'career',
    label: 'Career',
    icon: '💼',
    questions: [
      'Gimana kerjaan / kuliahmu minggu ini?',
      'Ada tantangan di tempat kerja yang bisa didoakan?',
      'Masih enjoy sama yang kamu kerjakan sekarang?',
    ],
  },
  {
    key: 'relationship',
    label: 'Relationship',
    icon: '🤝',
    questions: [
      'Gimana hubunganmu sama temen-temen dekat?',
      'Ada relasi yang lagi ngeganjel yang mau kamu ceritain?',
      'Gimana kabar orang spesialmu? 😆',
    ],
  },
  {
    key: 'fun',
    label: 'Fun Recreation',
    icon: '🎢',
    questions: [
      'Lagi stres nggak akhir-akhir ini? Cerita dong',
      'Weekend kemarin ngapain aja?',
      'Butuh waktu hangout bareng nggak? 😄',
    ],
  },
];

/** Hash sederhana → angka stabil (untuk "acak" yang sama sepanjang hari). */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Topik harian per CL: acak tapi deterministik (tetap sama seharian). */
export function dailyTopic(
  leaderId: string,
  dayId: string,
): { category: CoreCategory; question: string } {
  const category =
    CORE_CATEGORIES[hashString(dayId + leaderId) % CORE_CATEGORIES.length];
  const question =
    category.questions[
      hashString(leaderId + dayId + 'q') % category.questions.length
    ];
  return { category, question };
}

// ==================== Rotasi follow up harian ====================

/**
 * Pilih siapa yang di follow up hari ini: yang sudah ditandai hari ini
 * tetap tampil (daftar stabil), sisanya diisi dari yang PALING LAMA tidak
 * di follow up, dengan urutan diacak per hari — acak tapi merata.
 */
export function pickDailyFollowups<
  T extends { id: string; lastFollowupDayId: string | null },
>(people: T[], dayId: string, count: number): T[] {
  const doneToday = people.filter((p) => p.lastFollowupDayId === dayId);
  const rest = people
    .filter((p) => p.lastFollowupDayId !== dayId)
    .sort((a, b) => {
      const da = a.lastFollowupDayId ?? '';
      const db = b.lastFollowupDayId ?? '';
      if (da !== db) return da < db ? -1 : 1;
      return hashString(dayId + a.id) - hashString(dayId + b.id);
    });
  const need = Math.max(0, count - doneToday.length);
  return [...doneToday, ...rest.slice(0, need)];
}

// ==================== Ulang tahun ====================

// Berlaku untuk CORE Leader maupun Main Team (cukup punya tanggal lahir).
type HasBirthday = { birthYear: number; birthMonth: number; birthDay: number };

/** Berapa hari lagi ulang tahun berikutnya + umur yang akan dicapai. */
export function nextBirthday(
  person: HasBirthday,
  today: Date,
): { daysUntil: number; turningAge: number } {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let next = new Date(today.getFullYear(), person.birthMonth, person.birthDay);
  if (next < start) {
    next = new Date(today.getFullYear() + 1, person.birthMonth, person.birthDay);
  }
  const daysUntil = Math.round((next.getTime() - start.getTime()) / 86_400_000);
  return { daysUntil, turningAge: next.getFullYear() - person.birthYear };
}

/** Umur saat ini (sudah lewat ulang tahun tahun ini atau belum). */
export function currentAge(person: HasBirthday, today: Date): number {
  const hadBirthday =
    today.getMonth() > person.birthMonth ||
    (today.getMonth() === person.birthMonth &&
      today.getDate() >= person.birthDay);
  return today.getFullYear() - person.birthYear - (hadBirthday ? 0 : 1);
}
