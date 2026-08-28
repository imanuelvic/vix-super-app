import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  writeBatch,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { pickCompressedImage } from './photo';

// CORE — komunitas sel gereja. Pemilik app adalah MCL (Mentor CORE Leader)
// yang menggembalakan beberapa CORE Leader (CL). Fitur ini membantu:
// 1) menyimpan data CL (nama, warna hati CORE, tanggal lahir),
// 2) tugas follow up harian yang dibagi merata + ide topik chat.
//
// Penyimpanan: SATU dokumen (users/{uid}/core/leaders) berisi array CL —
// daftarnya kecil, jadi 1 read per buka dan tulis utuh saat berubah.

/** Cowok / cewek — penentu ucapan ulang tahun mana yang dipakai. */
export type Gender = 'm' | 'f';

export const GENDER_OPTIONS: { key: Gender; label: string }[] = [
  { key: 'm', label: '🙋🏻‍♂️ Cowok' },
  { key: 'f', label: '🙋🏻‍♀️ Cewek' },
];

export type CoreLeader = {
  id: string;
  name: string;
  heart: string; // emoji hati = warna CORE mereka
  birthYear: number;
  birthMonth: number; // 0–11 seperti Date JS
  birthDay: number;
  phone: string | null; // digit SETELAH +62 (semua CL orang Indonesia)
  lastFollowupDayId: string | null; // "YYYY-MM-DD" terakhir di follow up
  /** Cowok/cewek — dipakai memilih ucapan ulang tahun. null = belum diisi. */
  gender?: Gender | null;
  // Kepribadian (opsional) — bantu cara pendekatan & ide chat.
  disc?: string | null; // 'D' | 'I' | 'S' | 'C'
  mbti?: string | null; // mis. 'INFJ'
  loveLanguage?: string | null; // key dari LOVE_LANG_OPTIONS
  // Pendidikan & pekerjaan sekarang (opsional) — bahan obrolan visitasi, doa
  // yang tepat sasaran, & tahu kapan mereka sibuk (skripsi, lembur, ujian).
  school?: string | null; // kampus / sekolah
  major?: string | null; // jurusan
  job?: string | null; // profesi
  workplace?: string | null; // tempat kerja
  // Data tubuh (opsional) — lihat bagian "Data tubuh CL" di bawah.
  heightCm?: number | null;
  weightKg?: number | null;
  waistCm?: number | null;
  bodyUpdatedDayId?: string | null;
};

// ==================== Data tubuh CL 🧍 ====================
// SENGAJA cuma tiga angka: tinggi, berat, lingkar perut.
//
// Ini bukan salinan Data Tubuh di Profile (yang punya golongan darah, ukuran
// mata, ukuran baju, dst). Itu data DIRI SENDIRI; yang ini data orang lain
// yang kamu gembalakan, dan gunanya cuma satu: melihat apakah mereka bergerak
// menuju badan yang sehat. Tiga angka ini sudah cukup untuk BMI, rentang berat
// ideal, dan rasio perut/tinggi — tiga ukuran yang paling jujur soal itu.
// Menanyakan lebih dari ini ke CL juga mulai terasa tidak pantas.
//
// Persen lemak & BMR sengaja TIDAK dihitung: rumusnya di app ini khusus laki-
// laki (bmrMale / bodyFatMale), sedangkan CL ada yang perempuan — angka yang
// salah lebih buruk daripada angka yang tidak ada.

/** Isian form data tubuh (selalu string, ikut gaya StudyWork). */
export type LeaderBody = { height: string; weight: string; waist: string };

export const EMPTY_LEADER_BODY: LeaderBody = { height: '', weight: '', waist: '' };

type LeaderBodyFields = {
  heightCm: number | null;
  weightKg: number | null;
  waistCm: number | null;
};

/** Bagian data tubuh dari data tersimpan — untuk mengisi form. */
export function leaderBodyOf(p: Partial<LeaderBodyFields>): LeaderBody {
  const teks = (n: number | null | undefined) => (n != null ? String(n) : '');
  return {
    height: teks(p.heightCm),
    weight: teks(p.weightKg),
    waist: teks(p.waistCm),
  };
}

/** Angka dari isian form: kosong / bukan angka / ≤ 0 → null. */
function angka(t: string): number | null {
  const n = Number(t.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Bentuk simpannya, PLUS tanggal perubahannya.
 *
 * `bodyUpdatedDayId` hanya ikut berganti kalau salah satu ANGKANYA benar-benar
 * berubah. Kalau tidak, membetulkan nomor HP saja akan memajukan tanggalnya —
 * dan kartu data tubuhnya jadi mengaku "baru diperbarui hari ini" padahal
 * berat badannya masih angka dua bulan lalu.
 */
export function leaderBodyPayload(
  form: LeaderBody,
  prev: Partial<LeaderBodyFields & { bodyUpdatedDayId?: string | null }>,
  todayId: string,
): LeaderBodyFields & { bodyUpdatedDayId: string | null } {
  const next: LeaderBodyFields = {
    heightCm: angka(form.height),
    weightKg: angka(form.weight),
    waistCm: angka(form.waist),
  };
  const berubah =
    next.heightCm !== (prev.heightCm ?? null) ||
    next.weightKg !== (prev.weightKg ?? null) ||
    next.waistCm !== (prev.waistCm ?? null);
  const adaIsi =
    next.heightCm != null || next.weightKg != null || next.waistCm != null;
  return {
    ...next,
    bodyUpdatedDayId: berubah
      ? adaIsi
        ? todayId
        : null // semuanya dikosongkan → tanggalnya ikut hilang
      : (prev.bodyUpdatedDayId ?? null),
  };
}

/** Ada minimal satu angka yang terisi? */
export function hasLeaderBody(p: Partial<LeaderBodyFields>): boolean {
  return p.heightCm != null || p.weightKg != null || p.waistCm != null;
}

// ============ Pendidikan & pekerjaan (CL maupun Main Team) ============
// Empat kolom yang SEMUANYA opsional. Ditulis sebagai satu bagian tersendiri
// supaya form CL & form Main Team memakai aturan yang sama persis — dulu tiap
// kolom baru harus disalin ke dua tempat dan gampang jadi beda sendiri.

/** Isian form pendidikan & pekerjaan (selalu string, tak pernah null). */
export type StudyWork = {
  school: string;
  major: string;
  job: string;
  workplace: string;
};

export const EMPTY_STUDY_WORK: StudyWork = {
  school: '',
  major: '',
  job: '',
  workplace: '',
};

/** Bagian pendidikan/pekerjaan dari data tersimpan — untuk mengisi form. */
export function studyWorkOf(p: Partial<StudyWorkFields>): StudyWork {
  return {
    school: p.school ?? '',
    major: p.major ?? '',
    job: p.job ?? '',
    workplace: p.workplace ?? '',
  };
}

/** Bentuk simpannya: spasi dirapikan, yang kosong jadi null (bukan ""). */
export function studyWorkPayload(s: StudyWork): StudyWorkFields {
  const bersih = (t: string) => t.trim() || null;
  return {
    school: bersih(s.school),
    major: bersih(s.major),
    job: bersih(s.job),
    workplace: bersih(s.workplace),
  };
}

type StudyWorkFields = {
  school: string | null;
  major: string | null;
  job: string | null;
  workplace: string | null;
};

/** "🎓 Universitas Ciputra · Informatika" — null kalau dua-duanya kosong. */
export function studyLine(p: Partial<StudyWorkFields>): string | null {
  const isi = [p.school, p.major].filter(Boolean);
  return isi.length ? `🎓 ${isi.join(' · ')}` : null;
}

/** "💼 Software Engineer di NDC" — null kalau dua-duanya kosong. */
export function workLine(p: Partial<StudyWorkFields>): string | null {
  if (p.job && p.workplace) return `💼 ${p.job} di ${p.workplace}`;
  const satu = p.job || p.workplace;
  return satu ? `💼 ${satu}` : null;
}

// Data awal para CL — tampil sebelum dokumen pernah disimpan.
const DEFAULT_LEADERS: CoreLeader[] = [
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
  /** Cowok/cewek — dipakai memilih ucapan ulang tahun. null = belum diisi. */
  gender?: Gender | null;
  // Kepribadian (opsional).
  disc?: string | null;
  mbti?: string | null;
  loveLanguage?: string | null;
  // Pendidikan & pekerjaan sekarang (opsional) — sama seperti CoreLeader.
  school?: string | null;
  major?: string | null;
  job?: string | null;
  workplace?: string | null;
};

export function subscribeMainTeam(
  uid: string,
  onChange: (members: MainTeamMember[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'mainTeam');
  return liveDoc(
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
  return liveDoc(
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

// (Penyusun tautan WhatsApp-nya sendiri pindah ke lib/whatsapp.ts — tempatnya
// memang di sana, bukan di modul fitur CORE.)

// ==================== Ucapan ulang tahun 🎂 ====================
// Tiga templat: satu untuk dilempar ke GRUP, dua untuk chat PRIBADI
// (cowok/cewek). Ketiganya ditutup doa yang sama — empat pokok doa yang
// memang selalu didoakan, ditulis ulang jadi doa untuk yang berulang tahun.

/** Doa penutup yang ikut di setiap ucapan. */
function birthdayPrayer(name: string): string {
  return `🙏 Doaku buat ${name}:
Kiranya semua yang kamu kerjakan berkenan & menyenangkan hati Tuhan.
Kiranya kamu makin mengenal dan makin mengasihi Dia setiap hari.
Kiranya Tuhan kasih hikmat & perbesar kapasitasmu, biar makin jadi berkat buat orang-orang di sekitarmu.
Bukan kehendak kita, tapi kehendak-Nya yang jadi.
Dan Tuhan kirimkan orang-orang baik di sekelilingmu — yang mendukung, yang mendoakan, yang menemani.`;
}

/**
 * Ajakan penutup di tiap ucapan. Ulang tahun itu pintu masuk penggembalaan:
 * yang berulang tahun sering justru sedang ingin didengar, jadi ucapannya
 * ditutup dengan undangan bercerita — bukan berhenti di selamat saja.
 */
const BIRTHDAY_INVITE =
  'Kalau ada yang mau didoakan atau mau cerita-cerita, silakan yaa 🤗';

/**
 * Ucapan untuk GRUP. Sengaja dibuka tanpa nomor tujuan: WhatsApp akan
 * menanyakan mau dikirim ke chat/grup yang mana.
 */
export function birthdayGroupText(name: string): string {
  return `Selamatt ulang tahun ${name} 🔥💪 semakin dewasa rohani dan karakter, makin bijak, makin jadi berkat buat keluarga & teman2. Enjoy your special dayy! God bless you alwaysss 💛💜💚🤍💙🧡🩵🖤

${birthdayPrayer(name)}

${BIRTHDAY_INVITE}`;
}

/**
 * Ucapan untuk chat PRIBADI, menyesuaikan cowok/cewek.
 *
 * Yang belum diisi jenis kelaminnya memakai versi yang sama dengan cewek —
 * isinya memang netral (soal berkenalan & melayani bareng di CORE), jadi tetap
 * pantas dikirim ke siapa pun. Hanya versi cowok yang punya sapaan khas
 * ("ma bro"), makanya ia butuh penandanya lebih dulu.
 */
export function birthdayPersonalText(
  name: string,
  gender: Gender | null | undefined,
): string {
  const body =
    gender === 'm'
      ? `${name}, happy bday ma bro! 🎂🎉 tetap humble, sehat selalu, usaha & mimpi2 lancar jayaa, maju terus! Tuhan berkati habisss. Semoga makin kuat di dalam Tuhan 💪🙏`
      : `${name}, Happy birthdayy! bersyukur bisa kenal ${name}, gk kebetulan kita bisa bertemu di CORE ini, ada tujuan dari Tuhan✨ Senang bisa melayani bareng, semoga umur baru ini bawa banyak kemajuan di kerjaan, pelayanan, dan kehidupan pribadi! Tuhan sertaii selalu 🙏💛💜💚🤍💙🧡🩵🖤`;
  return `${body}

${birthdayPrayer(name)}

${BIRTHDAY_INVITE}`;
}

// ==================== Kepribadian 🧠 (DISC · MBTI · Love Language) ====================
// Dipakai untuk memahami tiap orang & memberi ide cara chat / pendekatan yang
// pas dengan kepribadiannya saat menggembalakan.

type HasPersonality = {
  phone?: string | null;
  gender?: Gender | null;
  disc?: string | null;
  mbti?: string | null;
  loveLanguage?: string | null;
};

/** Pastikan field opsional bernilai null (bukan undefined) — aman disimpan. */
function normalizePersonality(p: HasPersonality) {
  return {
    phone: p.phone ?? null,
    gender: p.gender ?? null,
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
  INFJ: 'Idealis & dalam. Diskusi makna & hati, dengarkan sungguh, jaga privasinya.',
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
  return liveDoc(
    ref,
    (snapshot) => {
      const list = (snapshot.data()?.list as ExLeader[]) ?? [];
      onChange(list.map((l) => ({ ...l, ...normalizePersonality(l) })));
    },
    onError,
  );
}

function saveExLeaders(uid: string, list: ExLeader[]) {
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
  | 'mentoringMclClMt'
  | 'gathering'
  | 'charity'
  | 'thanksgiving'
  | 'christmas'
  | 'coreGabungan'
  | 'fellowshipGabungan';

export const MEETING_KINDS: {
  key: MeetingKind;
  label: string;
  icon: string;
  /** Acara gabungan → boleh mencentang LEBIH DARI SATU CORE Leader. */
  multiLeader?: boolean;
  /** Acara besar → panduannya perlu dikirim jauh-jauh hari (lihat
      PDF_REMINDER_DAYS_BIG), bukan cuma H-3 seperti pertemuan biasa. */
  bigEvent?: boolean;
}[] = [
  { key: 'visitasi', label: 'Visitasi CORE', icon: '🔥' },
  { key: 'fellowship', label: 'Fellowship CORE', icon: '👥' },
  { key: 'oneOnOne', label: 'One-on-One', icon: '1️⃣' },
  { key: 'mentoringMclClMt', label: 'Mentoring MCL CL MT', icon: '✨' },
  { key: 'gathering', label: 'Gathering CORE', icon: '🏡', bigEvent: true },
  { key: 'charity', label: 'Charity CORE', icon: '💌', bigEvent: true },
  { key: 'thanksgiving', label: 'Thanksgiving', icon: '🎉', bigEvent: true },
  { key: 'christmas', label: 'Christmas CORE', icon: '🎄', bigEvent: true },
  { key: 'coreGabungan', label: 'CORE Gabungan', icon: '⛪', multiLeader: true },
  { key: 'fellowshipGabungan', label: 'Fellowship CORE Gabungan', icon: '👥', multiLeader: true, },
];

/** Meta satu jenis pertemuan — fallback ke Visitasi kalau tak dikenal. */
export function meetingKindMeta(kind: MeetingKind) {
  return MEETING_KINDS.find((k) => k.key === kind) ?? MEETING_KINDS[0];
}

/** Jenis acara gabungan → pemilih CORE-nya jadi centang banyak. */
export function isMultiLeaderKind(kind: MeetingKind): boolean {
  return !!meetingKindMeta(kind).multiLeader;
}

export type Visitation = {
  id: string;
  kind: MeetingKind; // jenis pertemuan
  // CORE Leader yang ditemui. Biasanya satu; jenis "gabungan" boleh banyak.
  leaderIds: string[];
  // Penanda TAMBAHAN: acara apa pun bisa sekalian jadi Thanksgiving, jadi ini
  // berdiri sendiri dari `kind` (Christmas CORE + Thanksgiving itu sah).
  // Kalau kind-nya sendiri 'thanksgiving', penanda ini tidak dipakai.
  thanksgiving: boolean;
  date: Timestamp;
  agenda: string; // agenda — apa yang akan dibahas ke mereka, boleh kosong
  note: string; // catatan pertemuan — hasil/observasi, boleh kosong
  done: boolean; // sudah selesai
  /** "YYYY-MM-DD" terakhir PDF-nya dibagikan — dipakai supaya badge reminder
      padam begitu hari itu sudah dikirim. null = belum pernah. */
  pdfSentDayId: string | null;
};

// ---- Reminder kirim PDF panduan ke CORE Leader -------------------------
// Pertemuan biasa cukup diingatkan H-3. Acara besar (Gathering, Charity,
// Thanksgiving, Christmas) butuh persiapan panjang, jadi diingatkan jauh
// lebih awal dan makin sering saat harinya mendekat.

export const PDF_REMINDER_DAYS_NORMAL = [3];
export const PDF_REMINDER_DAYS_BIG = [14, 7, 3, 2, 1];

/** Hari-hari (H-n) saat kamu diingatkan mengirim panduan acara ini. */
export function pdfReminderDays(kind: MeetingKind): number[] {
  return meetingKindMeta(kind).bigEvent
    ? PDF_REMINDER_DAYS_BIG
    : PDF_REMINDER_DAYS_NORMAL;
}

/**
 * Hari ini termasuk hari pengingat kirim PDF untuk pertemuan ini?
 * Yang sudah selesai, sudah lewat, atau PDF-nya SUDAH dikirim hari ini
 * tidak lagi menagih.
 */
export function needsPdfShare(
  v: Visitation,
  today: Date,
  todayId: string,
): boolean {
  if (v.done || v.pdfSentDayId === todayId) return false;
  return pdfReminderDays(v.kind).includes(visitDaysUntil(v, today));
}

/** Catat bahwa PDF pertemuan ini sudah dibagikan hari ini. */
export function markVisitationPdfSent(
  uid: string,
  list: Visitation[],
  id: string,
  dayId: string,
) {
  return saveVisitations(
    uid,
    list.map((v) => (v.id === id ? { ...v, pdfSentDayId: dayId } : v)),
  );
}

/** Semua label jenis acara satu pertemuan — termasuk penanda Thanksgiving. */
export function meetingKindLabels(v: Visitation): string {
  const meta = meetingKindMeta(v.kind);
  const utama = `${meta.icon} ${meta.label}`;
  const tg = meetingKindMeta('thanksgiving');
  return v.thanksgiving && v.kind !== 'thanksgiving'
    ? `${utama} · ${tg.icon} ${tg.label}`
    : utama;
}

/**
 * Nama CORE Leader yang ditemui, dirangkai jadi satu baris.
 * Acara gabungan bisa berisi banyak CL, jadi di tempat sempit (mis. reminder
 * Dashboard) pakai `maxNames` supaya sisanya diringkas jadi "+N lagi".
 */
export function meetingLeaderNames(
  v: Visitation,
  leaders: CoreLeader[],
  { fallback = '(CL tidak ditemukan)', maxNames = Infinity } = {},
): string {
  const nama = v.leaderIds
    .map((id) => leaders.find((l) => l.id === id))
    .filter((l): l is CoreLeader => !!l)
    .map((l) => `${l.heart} ${l.name}`);
  if (nama.length === 0) return fallback;
  if (nama.length <= maxNames) return nama.join(', ');
  const sisa = nama.length - maxNames;
  return `${nama.slice(0, maxNames).join(', ')} +${sisa} lagi`;
}

export function subscribeVisitations(
  uid: string,
  onChange: (items: Visitation[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'core', 'visitations');
  return liveDoc(
    ref,
    (snapshot) => {
      const list = (snapshot.data()?.list as Visitation[]) ?? [];
      // Data lama belum punya `kind`/`agenda`/`thanksgiving`, dan menyimpan
      // SATU CORE Leader di `leaderId` (bukan array `leaderIds`). Dinormalkan
      // di sini supaya seluruh app cukup membaca satu bentuk saja; `leaderId`
      // lama sengaja dibuang agar tidak ada dua sumber kebenaran.
      onChange(
        list.map((v) => {
          const { leaderId, ...rest } = v as Visitation & { leaderId?: string };
          return {
            ...rest,
            kind: v.kind ?? 'visitasi',
            agenda: v.agenda ?? '',
            thanksgiving: v.thanksgiving ?? false,
            leaderIds: v.leaderIds ?? (leaderId ? [leaderId] : []),
            pdfSentDayId: v.pdfSentDayId ?? null,
          };
        }),
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

// ===================== Mentoring Bulanan 🗒️ =====================
// Notulen rapat mentoring dari gereja. Susunannya SELALU 5 poin yang sama,
// jadi poin-poinnya dipatok di sini dan tinggal diisi tiap rapat.
//
// Beda penyimpanan dari Visitation: rapat menumpuk terus tiap bulan dan
// isinya panjang (5 blok teks), jadi SATU DOKUMEN PER RAPAT — bukan satu array
// besar yang harus ditulis ulang tiap kali salah satu poin diubah.
//   users/{uid}/coreMonthly/{id} → { title, date, points }

export type MonthlyPointKey =
  | 'mentorship'
  | 'leadersMessage'
  | 'ndcInfo'
  | 'core'
  | 'events';

export const MONTHLY_AGENDA_POINTS: {
  key: MonthlyPointKey;
  label: string;
  icon: string;
  hint: string;
}[] = [
  { key: 'mentorship', label: 'MENTORSHIP', icon: '🎓', hint: 'Pembekalan untuk para mentor' },
  { key: 'leadersMessage', label: "LEADER'S MESSAGE", icon: '📢', hint: 'Pesan dari gembala / pemimpin' },
  { key: 'ndcInfo', label: 'NDC INFORMATION', icon: 'ℹ️', hint: 'Info & pengumuman gereja' },
  { key: 'core', label: 'CORE', icon: '🙏', hint: 'Hal-hal seputar komunitas CORE' },
  { key: 'events', label: 'OUR EVENTS', icon: '📅', hint: 'Acara yang akan datang' },
];

export type MonthlyMeeting = {
  id: string;
  title: string;
  /** Tanggal SEKALIGUS jam mulai — satu Timestamp, tidak dipisah dua field. */
  date: Timestamp;
  /** Tempat rapat, mis. "Gereja NDC lt. 3". Notulen lama belum punya → "". */
  place: string;
  points: Record<string, string>; // key = MonthlyPointKey
  /** Dokumentasi rapat: JPEG base64 kecil (tanpa prefix `data:`), ikut ke PDF. */
  photos: string[];
};

// ---- Dokumentasi foto rapat -------------------------------------------
// Fotonya menumpang di dokumen rapatnya sendiri (pola yang sama dengan foto
// medali Race), jadi ukurannya sengaja ditekan: 640px · JPEG 50% ≈ 50–80 KB
// sesudah base64. Batasnya 4 foto → paling banter ±300 KB per rapat, aman di
// bawah batas keras Firestore 1 MB per dokumen.
//
// Batas itu juga menjaga ONGKOS BACA: subscribeMonthlyMeetings menarik sampai
// 60 notulen sekaligus tiap kali sub-tab Monthly dibuka, dan fotonya ikut
// terbawa. Kalau nanti fotonya terasa memberatkan, langkah berikutnya adalah
// memindahkan foto ke dokumen terpisah yang baru dibaca saat kartunya dibuka.

/** Paling banyak berapa foto dokumentasi per rapat. */
export const MAX_MEETING_PHOTOS = 4;

/** Pilih 1 foto dokumentasi rapat dari galeri → JPEG base64. */
export function pickMeetingPhoto(): Promise<string | null> {
  return pickCompressedImage({ width: 640, compress: 0.5 });
}

/** Semua poin kosong — bentuk awal rapat baru. */
export function emptyMonthlyPoints(): Record<string, string> {
  return Object.fromEntries(MONTHLY_AGENDA_POINTS.map((p) => [p.key, '']));
}

function monthlyCollection(uid: string) {
  return collection(db, 'users', uid, 'coreMonthly');
}

export function subscribeMonthlyMeetings(
  uid: string,
  onChange: (list: MonthlyMeeting[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // orderBy satu field saja → tidak butuh composite index.
  const q = query(monthlyCollection(uid), orderBy('date', 'desc'), limit(60));
  return onSnapshot(
    q,
    (snapshot) =>
      onChange(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: (data.title as string) ?? '',
            date: data.date as Timestamp,
            place: (data.place as string) ?? '',
            points: (data.points as Record<string, string>) ?? {},
            // Notulen lama belum punya dokumentasi foto → daftar kosong.
            photos: (data.photos as string[]) ?? [],
          };
        }),
      ),
    onError,
  );
}

export function saveMonthlyMeeting(
  uid: string,
  id: string,
  data: {
    title: string;
    date: Date; // tanggal + jam mulai
    place: string;
    points: Record<string, string>;
    photos: string[];
  },
) {
  return setDoc(doc(db, 'users', uid, 'coreMonthly', id), {
    title: data.title,
    date: Timestamp.fromDate(data.date),
    place: data.place,
    points: data.points,
    photos: data.photos,
  });
}

/** Hapus satu notulen rapat — PERMANEN. */
export function deleteMonthlyMeeting(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'coreMonthly', id));
}

export function newMonthlyMeetingId(): string {
  return `m${Date.now().toString(36)}`;
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
  return liveDoc(
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
function daysSinceLastIdea(
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

const CORE_CATEGORIES: CoreCategory[] = [
  {
    key: 'spirituality',
    label: 'Spirituality',
    icon: '✝️',
    questions: [
      'Gimana saat teduhmu minggu ini?',
      'Ada firman yang lagi ngena banget buat kamu?',
      'Lagi belajar percaya Tuhan di hal apa akhir-akhir ini?',
      'Doa apa yang lagi kamu bawa terus?',
      'Terakhir ngerasa Tuhan deket itu kapan?',
      'Lagu worship yang lagi kamu ulang-ulang apa? 🎧',
      'Ada hal yang bikin kamu ragu sama Tuhan nggak?',
      'Ibadah minggu kemarin gimana, ada yang nempel?',
      'Kamu lebih gampang doa pagi atau malam?',
      'Ada yang belum bisa kamu ampuni?',
      'Satu hal yang kamu syukurin hari ini apa?',
      'Bacaan Alkitabmu lagi di kitab apa?',
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
      'Tidur jam berapa biasanya? 😴',
      'Sehari minum air berapa gelas?',
      'Ada kebiasaan yang pengen kamu stop?',
      'Badanmu yang capek atau pikiranmu?',
      'Kapan terakhir kamu bener-bener istirahat?',
      'Screen time-mu parah nggak? 📱',
      'Olahraga favoritmu apa?',
      'Kamu tipe sarapan atau skip?',
      'Kesehatan mentalmu gimana akhir-akhir ini?',
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
      'Terakhir ngobrol lama sama ortu kapan?',
      'Di rumah kamu paling deket sama siapa?',
      'Ada hal yang belum bisa kamu omongin ke keluarga?',
      'Kamu anak ke berapa? 😄',
      'Kalau kumpul keluarga biasanya ngapain?',
      'Ada yang lagi sakit di keluarga?',
      'Harapanmu buat keluargamu apa?',
      'Kamu ngerasa dimengerti nggak di rumah?',
      'Kebiasaan keluarga yang kamu kangenin apa?',
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
      'Pengeluaran terbesarmu bulan ini apa?',
      'Kamu tipe nabung dulu atau jajan dulu? 😅',
      'Lagi ada cicilan yang bikin pusing?',
      'Target finansialmu tahun ini apa?',
      'Pernah nyoba investasi belum?',
      'Kamu nyatet pengeluaran nggak?',
      'Kalau dapet rezeki nomplok, buat apa dulu?',
      'Perpuluhan / persembahan gimana, lancar?',
      'Ada yang lagi kamu tahan beli karena mahal?',
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
      'Lagi capek pelayanan nggak? Jujur aja 😌',
      'Bagian pelayanan yang paling kamu nikmatin apa?',
      'Ada member yang susah dihubungi?',
      'Kamu butuh dibantu apa di CORE-mu?',
      'Terakhir ngerasa dipakai Tuhan itu kapan?',
      'Ada yang ngeganjel di tim?',
      'Kamu lagi mentoring siapa sekarang?',
      'Target CORE-mu bulan ini apa?',
      'Kamu ngerasa bertumbuh lewat pelayanan nggak?',
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
      'Bagian kerjaan yang paling bikin semangat apa?',
      'Bos / dosenmu gimana orangnya? 😆',
      'Ada rencana pindah kerja atau jurusan?',
      'Skill apa yang lagi kamu pelajarin?',
      'Kamu ngerasa burnout nggak?',
      'Mimpi kariermu 5 tahun lagi apa?',
      'Kerja remote atau ngantor? 💻',
      'Ada side hustle nggak?',
      'Hal paling susah dari kerjaanmu apa?',
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
      'Kamu lagi deket sama siapa? 👀',
      'Temen yang paling ngerti kamu siapa?',
      'Kamu gampang percaya orang nggak?',
      'Ada yang bikin kamu kecewa akhir-akhir ini?',
      'Kamu tipe sendirian atau rame-rame?',
      'Terakhir nongkrong sama temen kapan?',
      'Ada hubungan yang pengen kamu perbaiki?',
      'Kamu gampang minta maaf nggak?',
      'Kriteria pasangan idealmu apa? 😏',
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
      'Lagi nonton series apa? 🍿',
      'Playlist-mu isinya lagu apa aja? 🎶',
      'Kalau bete, kamu ngapain?',
      'Hobi baru yang mau kamu coba apa?',
      'Tempat healing favoritmu di mana?',
      'Terakhir ketawa ngakak gara-gara apa? 😂',
      'Kamu tipe rencana atau spontan?',
      'Comfort food kamu apa? 🍜',
      'Bucket list-mu tahun ini apa?',
    ],
  },
];

/** Label kategori pertanyaan random — sekaligus pembuka pesan WA-nya. */
export const RANDOM_QUESTION_LABEL = 'Random Question';

// Pertanyaan ringan pembuka diskusi (this-or-that / random / seru-seruan).
const OPEN_QUESTIONS: string[] = [
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
  'Kopi susu atau matcha? 🧋',
  'Chat atau telepon? 📞',
  'Introvert atau ekstrovert? 🙃',
  'iOS atau Android? 📱',
  'Hari ini mager atau produktif? 😴',
  'Nasi padang atau mie ayam? 🍛',
  'Konser atau bioskop? 🎤🎬',
  'Bangun subuh atau begadang? 🌚',
  'Belanja online atau ke mall? 🛍️',
  'Kalau jadi hewan, mau jadi apa? 🐼',
  'Superpower yang kamu mau apa? 🦸',
  'Skincare-an atau cuci muka doang? 🧴',
  'Traveling sendiri atau rame-rame? 🎒',
  'Pedes level berapa? 🌶️',
  'Motor atau mobil? 🛵🚗',
  'Drakor atau Marvel? 🍿',
  'Kalau libur seminggu, ke mana? 🗺️',
  'Lagu yang kamu ulang terus apa? 🔁',
  'Duit banyak atau waktu banyak? ⏳',
  'Sore di kafe atau malem di rooftop? ☕🌃',
  'Kalau hidupmu ada soundtrack-nya, lagunya apa? 🎵',
  'Skill random yang kamu punya apa? 🤯',
  'Kalau boleh makan 1 menu seumur hidup, apa? 🍽️',
  'Mandi pagi atau mandi malam? 🚿',
  'Barang termahal yang pernah kamu beli apa?',
  'Kalau ketemu kamu yang umur 10 tahun, mau bilang apa?',
  'Hal paling nekat yang pernah kamu lakuin apa? 😳',
  'Kalau menang undian, beli apa duluan?',
  'Nama panggilanmu waktu kecil apa? 😆',
  'Kamu percaya hantu nggak? 👻',
  'Film yang bikin kamu nangis apa? 😭',
  'Kalau boleh pindah ke satu kota, ke mana?',
  'Bakat terpendammu apa?',
  'Hal kecil yang bikin kamu happy seharian apa?',
  'Emoji yang paling sering kamu pakai apa?',
  'Kalau bisa balik ke satu hari, hari apa?',
  'Makanan yang kamu nggak sanggup makan apa? 🤢',
  'Kalau jadi karakter film, mau jadi siapa? 🎬',
  'Kamu ngerjain tugas mepet deadline atau jauh hari? ⏰',
  'Aplikasi yang paling sering kamu buka apa? 📲',
  'Kalau boleh punya hewan aneh, mau apa? 🦥',
  'Hal random yang bikin kamu kesel apa? 😤',
  'Kamu bisa masak apa? 🍳',
  'Tempat paling jauh yang pernah kamu datengin? 🌍',
  'Kalau dikasih libur sebulan tetap digaji, ngapain?',
  'Kebiasaan anehmu apa? 👀',
  'Lagu masa kecil yang masih kamu hafal apa? 🎤',
  'Lebih takut ketinggian atau kegelapan?',
  'Kalau punya toko sendiri, jualan apa? 🏪',
  'Chat-mu tipe panjang atau singkat? 💬',
  'Kamu tim rebahan atau tim jalan kaki? 🛋️',
  'Hal yang kamu pengen banget waktu kecil apa?',
  'Kalau bisa jago satu hal instan, apa? ✨',
];

/** Hash sederhana → angka stabil (untuk "acak" yang sama sepanjang hari). */
export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Ambil SATU isi daftar untuk satu hari — terasa acak, tapi tetap sama
 * sepanjang hari itu dan berganti sendiri besok. Dipakai untuk kata-kata
 * semangat Fitness, reminder & pertanyaan pemantik Revive, quote Finance.
 *
 * `salt` memisahkan undiannya: dua daftar dengan dayId sama tapi salt beda
 * tidak akan bergerak seirama (mis. pertanyaan Rhema & Aplikasi di Revive).
 */
export function pickOfDay<T>(list: T[], dayId: string, salt = ''): T {
  return list[hashString(dayId + salt) % list.length];
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

/**
 * Undian ulang fokus minggu ini — hasil tekan tombol 🎲 di kartu Follow Up
 * Mingguan. `weekIdx` menandai undian ini untuk MINGGU YANG MANA: begitu ganti
 * minggu, nomornya tidak cocok lagi dan rotasi bawaan otomatis berlaku lagi.
 * Jadi undiannya tidak perlu dibersihkan; dia kedaluwarsa sendiri.
 */
export type WeeklyFocus = { weekIdx: number; ids: string[] };

export const EMPTY_WEEKLY_FOCUS: WeeklyFocus = { weekIdx: -1, ids: [] };

export function subscribeWeeklyFocus(
  uid: string,
  onChange: (focus: WeeklyFocus) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'core', 'weeklyFocus'),
    (snapshot) => {
      const data = snapshot.data();
      onChange(
        data
          ? {
              weekIdx: Number(data.weekIdx) || -1,
              ids: (data.ids as string[]) ?? [],
            }
          : EMPTY_WEEKLY_FOCUS,
      );
    },
    onError,
  );
}

export function saveWeeklyFocus(uid: string, focus: WeeklyFocus) {
  return setDoc(doc(db, 'users', uid, 'core', 'weeklyFocus'), focus);
}

/**
 * Boleh mengundi ulang hari ini? HANYA SENIN.
 *
 * Fokus mingguan ditentukan di awal minggu lalu dikerjakan sampai Minggu.
 * Kalau bisa diganti di tengah minggu, orang yang sudah di-follow up bisa
 * terlempar keluar daftar dan penggantinya tidak kebagian waktu.
 */
export function canDrawWeeklyFocus(now: Date): boolean {
  return now.getDay() === 1;
}

/**
 * CL fokus minggu ini: hasil undian ulang kalau undiannya memang untuk minggu
 * ini, kalau tidak ya rotasi bawaan.
 *
 * CL yang sudah dihapus dari daftar otomatis gugur dari undian; kalau sampai
 * TIDAK ada yang tersisa, rotasi bawaannya yang dipakai lagi.
 */
export function focusLeaders<T extends { id: string }>(
  leaders: T[],
  now: Date,
  focus: WeeklyFocus,
): T[] {
  const idx = weekIndex(now);
  if (focus.weekIdx === idx) {
    const picked = focus.ids
      .map((id) => leaders.find((l) => l.id === id))
      .filter((l): l is T => l !== undefined);
    if (picked.length > 0) return picked;
  }
  return weeklyLeaders(leaders, idx, WEEKLY_FOCUS_COUNT);
}

/**
 * Undi ulang CL fokus minggu ini — sebisa mungkin BUKAN yang sedang dipakai,
 * jadi menekan tombolnya selalu benar-benar berganti orang. Kalau CL yang lain
 * kurang dari jatahnya, barulah semua ikut diundi lagi.
 *
 * `random` bisa dioper untuk pengujian.
 */
export function drawWeeklyFocus<T extends { id: string }>(
  leaders: T[],
  current: T[],
  now: Date,
  random: () => number = Math.random,
): WeeklyFocus {
  const lain = leaders.filter((l) => !current.some((c) => c.id === l.id));
  const kolam = lain.length >= WEEKLY_FOCUS_COUNT ? lain : leaders;
  const acak = [...kolam];
  for (let i = acak.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [acak[i], acak[j]] = [acak[j], acak[i]];
  }
  return {
    weekIdx: weekIndex(now),
    ids: acak.slice(0, WEEKLY_FOCUS_COUNT).map((l) => l.id),
  };
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

// Pertanyaan penggali kepribadian — dipakai kalau datanya belum diisi.
const PERSONALITY_QUESTIONS: {
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
 * Pertanyaan follow up acak untuk satu CL: dari 8 aspek hidup + random question
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
    pool.push({ icon: '🎲', label: RANDOM_QUESTION_LABEL, question: q });
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

/**
 * Teks WA untuk follow up mingguan: satu baris pembuka, baris kosong, lalu
 * pertanyaannya. Pertanyaan random dibuka "Random Question" supaya CL langsung
 * paham ini diskusi seru-seruan, bukan follow up serius.
 */
export function followupMessage(topic: FollowupTopic): string {
  const opener =
    topic.label === RANDOM_QUESTION_LABEL ? RANDOM_QUESTION_LABEL : 'Shalom! 🙏';
  return `${opener}\n\n${topic.question}`;
}

// ==================== Pokok Doa Bulanan 🙏 ====================
// Tiap awal bulan, MCL menanyakan pokok doa/pergumulan tiap CORE Leader untuk
// bulan ini. Pokok doa inilah yang menentukan follow up berkala Selasa & Kamis.
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
  return liveDoc(
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

/**
 * Tandai satu CORE Leader sudah didoakan & difollowup pokok doanya hari ini.
 *
 * Dipakai dari DUA tempat (gerbang doa pagi & tab Follow Up), jadi aturannya
 * ditaruh di sini: kalau dokumennya masih milik bulan lalu, penanda follow-up
 * direset — tapi poin pokok doa & tanggal pembaruannya TIDAK dihapus.
 */
export function markPrayerFollowed(
  uid: string,
  data: MonthlyPrayers,
  leaderId: string,
  now: Date,
  dayId: string,
) {
  const base = isCurrentMonthPrayers(data, now)
    ? data
    : { ...data, followedDayId: {} as Record<string, string> };
  return saveMonthlyPrayers(uid, {
    monthId: monthDocId(now),
    points: base.points,
    followedDayId: { ...base.followedDayId, [leaderId]: dayId },
    updatedAt: base.updatedAt,
  });
}

/**
 * Turunkan huruf depan supaya poin pokok doa menyambung mulus sesudah
 * "Gw doakan …". Kata yang memang HURUF BESAR SEMUA (CORE, NDC, PA)
 * dibiarkan apa adanya.
 */
function sambungKalimat(s: string): string {
  const kataPertama = s.split(/\s+/)[0] ?? '';
  if (kataPertama.length > 1 && kataPertama === kataPertama.toUpperCase()) {
    return s;
  }
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Pesan WhatsApp untuk mendoakan pokok doa bulanan satu CORE Leader.
 *
 * Poinnya diambil APA ADANYA dari yang kamu tulis sendiri di Doa Rantai, lalu
 * tiap poin jadi satu kalimat "Gw doakan …". App ini tidak menulis ulang atau
 * memparafrase kalimatmu — tidak ada AI di dalamnya. WhatsApp terbuka dengan
 * teks yang masih bisa kamu sunting dulu sebelum dikirim.
 */
export function prayerChainMessage(name: string, points: string[]): string {
  const bersih = points.map((p) => p.trim()).filter(Boolean);
  const isi = bersih
    .map(
      (p, i) =>
        `${i === 0 ? 'Gw doakan' : 'Gw doakan jg'} ${sambungKalimat(p)}`,
    )
    .join('\n\n');
  return [
    `Shalom ${name}! 🙏`,
    'Gw lagi mendoakan lu utk pokok doa bulan ini. Gimana kabar & perkembangan pergumulanmu?',
    isi,
    'Tuhan yang kuatkan & cukupkan di setiap musim hidup lu. Semangat, finish strong! 🙌',
  ]
    .filter(Boolean)
    .join('\n\n');
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
  return liveDoc(
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

// Follow up pokok doa berkala: Selasa (2) & Kamis (4).
//
// Jadwalnya SENGAJA dikunci sama dengan Doa Syafaat (lib/intercession.ts):
// Selasa & Kamis di sana memang bertopik "🔗 Doa Rantai CL". Dulu Sabtu ikut,
// padahal syafaat Sabtu bertopik ⛪ Gereja — akibatnya gerbang doa pagi Sabtu
// punya satu langkah lebih banyak dari hari lain. Sekarang jumlahnya selalu
// sama: Revive → (Doa Rantai ATAU Doa Syafaat) → Memuji & Menyembah →
// Bapa Kami.
const PRAYER_FOLLOWUP_DAYS = [2, 4];
const PRAYER_FOLLOWUP_COUNT = 4; // CL yang difokuskan tiap sesi (bergilir)

/**
 * Berapa CORE Leader yang WAJIB didoakan di gerbang doa PAGI supaya langkah
 * Doa Rantai tercentang. Sisanya sengaja ditinggalkan untuk malam hari —
 * ritmenya sama dengan Baca Alkitab: ada porsi pagi, ada porsi malam, jadi
 * sepanjang hari selalu ada yang didoakan. Sisanya diselesaikan lewat kartu
 * Doa Syafaat di Home (yang malam hari mengarah ke CORE › Follow Up).
 */
export const PRAYER_MORNING_QUOTA = 2;

/** Hari ini jadwal follow up pokok doa? (Selasa & Kamis) */
export function isPrayerFollowupDay(d: Date): boolean {
  return PRAYER_FOLLOWUP_DAYS.includes(d.getDay());
}

/** Index sesi — stabil sepanjang hari, berganti tiap hari (untuk rotasi). */
function prayerSessionIndex(d: Date): number {
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
