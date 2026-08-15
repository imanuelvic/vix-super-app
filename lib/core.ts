import {
  arrayUnion,
  doc,
  onSnapshot,
  setDoc,
  Timestamp,
  writeBatch,
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
    if (primary) tips.push({ label: `🎨 ${p.disc}`, text: primary.chat });
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

// ==================== Ex CORE Leader 🗂️ ====================
// CL yang sudah tidak digembalakan lagi (pindah/lepas pelayanan). Dipindah dari
// daftar aktif ke arsip beserta ALASAN & tanggalnya — supaya tidak ikut follow
// up/reminder, tapi riwayatnya tetap tersimpan. Dokumen terpisah:
// users/{uid}/core/exLeaders — { list: ExLeader[] }.

export type ExLeader = CoreLeader & {
  exReason: string; // alasan sudah tidak dipegang
  exDayId: string; // "YYYY-MM-DD" saat diarsipkan
};

export function subscribeExLeaders(
  uid: string,
  onChange: (list: ExLeader[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'exLeaders');
  return onSnapshot(
    ref,
    (snapshot) => {
      const list = (snapshot.data()?.list as ExLeader[]) ?? [];
      onChange(list.map((l) => ({ ...l, ...normalizePersonality(l) })));
    },
    onError,
  );
}

export function saveExLeaders(uid: string, list: ExLeader[]) {
  return setDoc(doc(db, 'users', uid, 'core', 'exLeaders'), { list });
}

/**
 * Pindahkan satu CL dari daftar aktif ke arsip Ex CORE Leader (dengan alasan &
 * tanggal). Satu batch: tulis ulang daftar aktif tanpa dia + tambahkan dia ke
 * arsip. Semua datanya (kepribadian, ultah, dll) ikut terbawa.
 */
export function archiveCoreLeader(
  uid: string,
  leaders: CoreLeader[],
  leader: CoreLeader,
  reason: string,
  dayId: string,
) {
  const ex: ExLeader = { ...leader, exReason: reason, exDayId: dayId };
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'core', 'leaders'), {
    list: leaders.filter((l) => l.id !== leader.id),
  });
  batch.set(
    doc(db, 'users', uid, 'core', 'exLeaders'),
    { list: arrayUnion(ex) },
    { merge: true },
  );
  return batch.commit();
}

/** Kembalikan Ex CORE Leader jadi CL aktif lagi (field arsipnya dibuang). */
export function restoreCoreLeader(
  uid: string,
  leaders: CoreLeader[],
  exLeaders: ExLeader[],
  id: string,
) {
  const ex = exLeaders.find((e) => e.id === id);
  if (!ex) return Promise.resolve();
  const { exReason, exDayId, ...leader } = ex; // buang field arsip
  const batch = writeBatch(db);
  batch.set(doc(db, 'users', uid, 'core', 'leaders'), {
    list: [...leaders, leader],
  });
  batch.set(doc(db, 'users', uid, 'core', 'exLeaders'), {
    list: exLeaders.filter((e) => e.id !== id),
  });
  return batch.commit();
}

/** Hapus PERMANEN satu Ex CORE Leader dari arsip. */
export function deleteExLeader(uid: string, exLeaders: ExLeader[], id: string) {
  return saveExLeaders(
    uid,
    exLeaders.filter((e) => e.id !== id),
  );
}

// ==================== Pertemuan CORE 📅 ====================
// Jadwal MCL bertemu CORE para CL — dua jenis: Visitasi CORE (berkunjung ke
// CORE-nya) & Fellowship CORE (hangout/kumpul bareng). Satu dokumen berisi
// array (users/{uid}/core/visitations) — reminder H-3 & hari-H muncul di Home.

export type MeetingKind =
  | 'visitasi'
  | 'fellowship'
  | 'oneOnOne'
  | 'mentoringMclClMt';

export const MEETING_KINDS: { key: MeetingKind; label: string; icon: string }[] =
  [
    { key: 'visitasi', label: 'Visitasi CORE', icon: '🔥' },
    { key: 'fellowship', label: 'Fellowship CORE', icon: '👥' },
    { key: 'oneOnOne', label: 'One-on-One', icon: '1️⃣' },
    { key: 'mentoringMclClMt', label: 'Mentoring MCL CL MT', icon: '✨' },
  ];

/** Meta satu jenis pertemuan — fallback ke Visitasi kalau tak dikenal. */
export function meetingKindMeta(kind: MeetingKind) {
  return MEETING_KINDS.find((k) => k.key === kind) ?? MEETING_KINDS[0];
}

export type Visitation = {
  id: string;
  kind: MeetingKind; // jenis pertemuan
  leaderId: string; // CORE Leader yang ditemui
  date: Timestamp;
  agenda: string; // agenda — apa yang akan dibahas ke mereka, boleh kosong
  note: string; // catatan pertemuan — hasil/observasi, boleh kosong
  done: boolean; // sudah selesai
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
      const list = (snapshot.data()?.list as Visitation[]) ?? [];
      // Data lama belum punya `kind`/`agenda` → beri default aman.
      onChange(
        list.map((v) => ({
          ...v,
          kind: v.kind ?? 'visitasi',
          agenda: v.agenda ?? '',
        })),
      );
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

// ==================== Idea For CORE 💡 ====================
// Masukan ide spontan dari MCL untuk CORE, rutin mingguan/bulanan. Sebagian
// mungkin langsung dikerjakan CL, sebagian tidak — tidak apa-apa. Tiap ide
// punya catatan yang bisa di-share ke grup Main Team.
// Satu dokumen kecil: users/{uid}/core/ideas — { ideas[], cadence }.

export type IdeaCadence = 'weekly' | 'monthly';

export const IDEA_CADENCE_LABEL: Record<IdeaCadence, string> = {
  weekly: 'Mingguan',
  monthly: 'Bulanan',
};

export type CoreIdea = {
  id: string;
  text: string; // isi idenya
  note: string; // catatan untuk di-share ke grup MT (opsional)
  date: Timestamp; // kapan ide dibuat
};

export type CoreIdeasData = {
  ideas: CoreIdea[];
  cadence: IdeaCadence;
};

export const EMPTY_CORE_IDEAS: CoreIdeasData = { ideas: [], cadence: 'weekly' };

export function newCoreIdeaId(): string {
  return `idea${Date.now().toString(36)}`;
}

export function subscribeCoreIdeas(
  uid: string,
  onChange: (data: CoreIdeasData) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'ideas');
  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      onChange({
        ideas: (data?.ideas as CoreIdea[]) ?? [],
        cadence: (data?.cadence as IdeaCadence) ?? 'weekly',
      });
    },
    onError,
  );
}

export function saveCoreIdeas(uid: string, data: CoreIdeasData) {
  return setDoc(doc(db, 'users', uid, 'core', 'ideas'), data);
}

/** Hari sejak ide terakhir dibuat (null kalau belum ada ide sama sekali). */
export function daysSinceLastIdea(
  data: CoreIdeasData,
  today: Date,
): number | null {
  if (data.ideas.length === 0) return null;
  const last = data.ideas.reduce((max, i) =>
    i.date.toMillis() > max.date.toMillis() ? i : max,
  );
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d = last.date.toDate();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((start.getTime() - day.getTime()) / 86_400_000);
}

/** Reminder Home: waktunya kasih ide baru (belum ada / sudah lewat 1 periode). */
export function ideaReminderDue(data: CoreIdeasData, today: Date): boolean {
  const days = daysSinceLastIdea(data, today);
  if (days === null) return true; // belum pernah → ajak mulai
  return days >= (data.cadence === 'weekly' ? 7 : 30);
}

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
      'Lagi belajar percaya Tuhan di hal apa akhir-akhir ini?',
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

// ==================== Follow up mingguan (fokus 2 CL) ====================
// Tiap minggu (Senin–Minggu) fokus ke 2 CORE Leader saja untuk membangun
// hubungan. Rotasi 2-per-minggu yang deterministik → bergilir & kebagian semua.

export const WEEKLY_FOCUS_COUNT = 2;

/** Nomor minggu global berbasis Senin — stabil sepanjang minggu, +1 tiap minggu. */
export function weekIndex(d: Date): number {
  const day = d.getDay(); // 0=Min … 6=Sab
  const backToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + backToMonday,
  );
  return Math.floor(monday.getTime() / 86_400_000 / 7);
}

/** CL fokus minggu ini: `count` orang, bergilir tiap minggu. */
export function weeklyLeaders<T>(
  leaders: T[],
  weekIdx: number,
  count: number,
): T[] {
  const n = leaders.length;
  if (n === 0) return [];
  const start = (((weekIdx * count) % n) + n) % n;
  const out: T[] = [];
  for (let i = 0; i < Math.min(count, n); i++) {
    out.push(leaders[(start + i) % n]);
  }
  return out;
}

// Pertanyaan ringan pembuka obrolan (this-or-that / random).
export const OPEN_QUESTIONS: string[] = [
  'Kopi atau teh? ☕🍵',
  'Kalau bisa liburan sekarang: Thailand atau Singapura? ✈️',
  'Pagi atau malam orangnya? 🌅🌙',
  'Gunung atau pantai? ⛰️🏖️',
  'Manis atau pedas? 🍫🌶️',
  'Nonton film atau baca buku? 🎬📖',
  'Kucing atau anjing? 🐱🐶',
  'Weekend: rebahan atau jalan-jalan? 🛋️🚶',
  'Masak sendiri atau jajan di luar? 🍳🍜',
  'Kalau ada waktu luang, paling suka ngapain? 😄',
];

// Pertanyaan penggali kepribadian — dipakai kalau datanya belum diisi.
export const PERSONALITY_QUESTIONS: {
  field: 'disc' | 'mbti' | 'loveLanguage';
  icon: string;
  label: string;
  question: string;
}[] = [
  {
    field: 'disc',
    icon: '🎨',
    label: 'DISC',
    question:
      'Kalau ngerjain sesuatu bareng tim, kamu lebih ke mimpin, meramaikan, jadi penopang yang setia, atau yang teliti ngecek detail? 😄',
  },
  {
    field: 'mbti',
    icon: '🧩',
    label: 'MBTI',
    question:
      'Kamu ngecas energi lebih dari rame-rame sama orang, atau dari waktu sendiri yang tenang?',
  },
  {
    field: 'loveLanguage',
    icon: '💞',
    label: 'Love Language',
    question:
      'Kamu paling ngerasa disayang lewat apa — kata-kata, waktu bareng, hadiah, dibantuin, atau pelukan?',
  },
];

export type FollowupTopic = { icon: string; label: string; question: string };

/**
 * Pertanyaan follow up acak untuk satu CL: dari 8 aspek hidup + obrolan ringan
 * + penggali kepribadian (HANYA yang datanya belum ada). `seed` opsional untuk
 * "ganti pertanyaan". (Pokok doa dipindah ke Pokok Doa Bulanan.)
 */
export function weeklyFollowupTopic(
  person: {
    disc?: string | null;
    mbti?: string | null;
    loveLanguage?: string | null;
  },
  personId: string,
  dayId: string,
  seed?: number,
): FollowupTopic {
  const pool: FollowupTopic[] = [];
  for (const c of CORE_CATEGORIES) {
    for (const q of c.questions) {
      pool.push({ icon: c.icon, label: c.label, question: q });
    }
  }
  for (const q of OPEN_QUESTIONS) {
    pool.push({ icon: '🎲', label: 'Obrolan Ringan', question: q });
  }
  for (const p of PERSONALITY_QUESTIONS) {
    if (!person[p.field]) {
      pool.push({ icon: p.icon, label: p.label, question: p.question });
    }
  }
  const idx =
    (seed !== undefined ? seed : hashString(dayId + personId)) % pool.length;
  return pool[idx];
}

// ==================== Pokok Doa Bulanan 🙏 ====================
// Tiap awal bulan, MCL menanyakan pokok doa/pergumulan tiap CORE Leader untuk
// bulan ini. Pokok doa inilah yang menentukan follow up berkala Sel/Kam/Sab.
// Poin TIDAK dihapus saat bulan berganti — tetap tersimpan (layar Pokok Doa
// menampilkannya untuk ditinjau). Untuk follow-up, monthlyPointsFor menganggap
// perlu diperbarui (kosong) sampai disimpan ulang di bulan berjalan. Satu dokumen
// kecil: users/{uid}/core/monthlyPrayers — { monthId, points, followedDayId }.

export type MonthlyPrayers = {
  monthId: string; // "YYYY-MM" pemilik data ini
  points: Record<string, string[]>; // leaderId -> daftar poin pokok doa
  followedDayId: Record<string, string>; // leaderId -> dayId terakhir difollowup
  updatedAt: Record<string, string>; // leaderId -> dayId terakhir poin diinput/diubah
};

export const EMPTY_MONTHLY_PRAYERS: MonthlyPrayers = {
  monthId: '',
  points: {},
  followedDayId: {},
  updatedAt: {},
};

// Pertanyaan pembuka untuk mengumpulkan pokok doa bulanan tiap CL.
export const MONTHLY_PRAYER_QUESTION =
  'Apa yang bisa aku doakan buat kamu bulan ini? 🙏';

/** "2026-08" — id bulan berjalan (dasar dokumen pokok doa bulanan). */
export function monthDocId(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function subscribeMonthlyPrayers(
  uid: string,
  onChange: (data: MonthlyPrayers) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'monthlyPrayers');
  return onSnapshot(
    ref,
    (snapshot) => {
      const d = snapshot.data();
      onChange({
        monthId: (d?.monthId as string) ?? '',
        points: (d?.points as Record<string, string[]>) ?? {},
        followedDayId: (d?.followedDayId as Record<string, string>) ?? {},
        updatedAt: (d?.updatedAt as Record<string, string>) ?? {},
      });
    },
    onError,
  );
}

/** Tulis ulang seluruh dokumen pokok doa bulanan (dokumen kecil). */
export function saveMonthlyPrayers(uid: string, data: MonthlyPrayers) {
  return setDoc(doc(db, 'users', uid, 'core', 'monthlyPrayers'), data);
}

// ==================== Ucapan ulang tahun 🎂 ====================
// users/{uid}/core/birthdayGreets — { greeted: { [personId]: dayId } }.
// Begitu ucapan dikirim, kartu ulang tahun hari itu hilang biar tidak
// mengganggu lagi. Tahun depan otomatis muncul lagi (dayId-nya beda).

export type BirthdayGreets = Record<string, string>;

export function subscribeBirthdayGreets(
  uid: string,
  onChange: (greets: BirthdayGreets) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    doc(db, 'users', uid, 'core', 'birthdayGreets'),
    (snapshot) =>
      onChange((snapshot.data()?.greeted as BirthdayGreets) ?? {}),
    onError,
  );
}

/** Tandai satu orang sudah diberi ucapan hari ini (merge — yang lain tetap). */
export function markBirthdayGreeted(
  uid: string,
  personId: string,
  dayId: string,
) {
  return setDoc(
    doc(db, 'users', uid, 'core', 'birthdayGreets'),
    { greeted: { [personId]: dayId } },
    { merge: true },
  );
}

/** Data ini milik bulan berjalan? Kalau beda bulan → perlu diperbarui. */
export function isCurrentMonthPrayers(data: MonthlyPrayers, now: Date): boolean {
  return data.monthId === monthDocId(now);
}

/**
 * Pengingat AWAL BULAN (tanggal 1–2 saja) di Home: ajak follow up tiap CORE
 * Leader & tanyakan pokok doa mereka untuk bulan baru. Aktif selama pokok doa
 * belum diperbarui untuk bulan berjalan (begitu diperbarui → hilang).
 */
export function monthlyPrayerStartReminder(
  data: MonthlyPrayers,
  now: Date,
): boolean {
  return now.getDate() <= 2 && !isCurrentMonthPrayers(data, now);
}

/** Poin pokok doa efektif bulan ini (kosong kalau dokumen milik bulan lain). */
export function monthlyPointsFor(
  data: MonthlyPrayers,
  now: Date,
): Record<string, string[]> {
  return isCurrentMonthPrayers(data, now) ? data.points : {};
}

/** Sudah ada minimal satu pokok doa terisi bulan ini? */
export function monthlyPrayersFilled(data: MonthlyPrayers, now: Date): boolean {
  const pts = monthlyPointsFor(data, now);
  return Object.values(pts).some((arr) => (arr?.length ?? 0) > 0);
}

// Follow up pokok doa berkala: Selasa (2), Kamis (4), Sabtu (6).
export const PRAYER_FOLLOWUP_DAYS = [2, 4, 6];
export const PRAYER_FOLLOWUP_COUNT = 3; // CL yang difokuskan tiap sesi (bergilir)

/** Hari ini jadwal follow up pokok doa? (Selasa/Kamis/Sabtu) */
export function isPrayerFollowupDay(d: Date): boolean {
  return PRAYER_FOLLOWUP_DAYS.includes(d.getDay());
}

/** Index sesi — stabil sepanjang hari, berganti tiap hari (untuk rotasi). */
export function prayerSessionIndex(d: Date): number {
  const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor(midnight.getTime() / 86_400_000);
}

/**
 * CL yang difollowup pokok doanya pada sesi ini (bergilir). Hanya CL yang
 * SUDAH punya pokok doa bulan ini yang ikut rotasi.
 */
export function prayerFollowupLeaders<T extends { id: string }>(
  leaders: T[],
  points: Record<string, string[]>,
  now: Date,
): T[] {
  const withPoints = leaders.filter((l) => (points[l.id]?.length ?? 0) > 0);
  return weeklyLeaders(withPoints, prayerSessionIndex(now), PRAYER_FOLLOWUP_COUNT);
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
