import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate, dayNumber } from './format';
import { activeStreak, setHabitDone, yesterdayId, type HabitDay } from './health';
import { intercessionToday, type IntercessionTopic } from './intercession';
import { liveDoc } from './liveDoc';
import { type LoginStreak as DayStreak } from './reward';
import { alreadyCounted, nextStreak } from './streak';

// ========================= 🌙 Night Prayer =========================
//
// Doa sebelum tidur, empat bagian, persis urutan catatan "Prayer List 🙏 ·
// every night (pray this)" milik pemiliknya sendiri:
//
//   🙌 Doa Pengucapan Syukur   12 pokok
//   🕊️ Doa Pengakuan Dosa       7 pokok
//   🤲 Doa Permohonan          16 pokok
//   🙏 Doa Syafaat             jadwal per hari (lib/intercession.ts)
//
// ── Kenapa tidak semuanya sekaligus ───────────────────────────────────────
// 12 + 7 + 16 pokok tiap malam itu daftar, bukan doa: dibaca cepat lalu
// berhenti dipakai dalam seminggu. Jadi tiap malam cuma dibawa SEPOTONG, dan
// potongannya BERPUTAR berurutan (bukan acak):
//
//   syukur     3 per malam  → seluruhnya kebagian tiap 4 malam
//   pengakuan  2 per malam  → seluruhnya kebagian tiap 7 malam
//   permohonan 4 per malam  → seluruhnya kebagian tiap 4 malam
//
// Total 9 pokok pribadi + syafaat hari itu: kira-kira lima menit, muat
// sebelum tidur, dan tidak ada satu pun pokok yang hilang selamanya.
//
// Putarannya ditentukan TANGGALNYA, jadi: satu malam selalu dapat potongan
// yang sama (buka-tutup layar tidak pernah mengocok ulang), dan isinya bisa
// diuji apa adanya tanpa mengunci jam.
//
// ── Di mana disimpannya ───────────────────────────────────────────────────
// Centang tiap bagian menumpang di dokumen harian yang SUDAH dilanggan layar
// Today & Habits (`habitDays/{dayId}.done`), dengan id "night-prayer:…". Jadi
// fitur ini TIDAK menambah satu pun read Firestore. Yang punya dokumen sendiri
// cuma streaknya: `users/{uid}/app/nightPrayer`, sebuah dokumen kecil yang
// bentuknya sama dengan streak Revive & doa pagi.

export type NightKey = 'syukur' | 'dosa' | 'permohonan' | 'syafaat';

export type NightSection = {
  key: NightKey;
  emoji: string;
  /** Nama bagiannya, memakai kata pemiliknya sendiri. */
  label: string;
  /** Satu kalimat pengarah, bukan doanya. */
  hint: string;
};

export const NIGHT_SECTIONS: NightSection[] = [
  {
    key: 'syukur',
    emoji: '🙌',
    label: 'Doa Pengucapan Syukur',
    hint: 'Sebut satu per satu, jangan buru-buru.',
  },
  {
    key: 'dosa',
    emoji: '🕊️',
    label: 'Doa Pengakuan Dosa',
    hint: 'Akui yang memang terjadi hari ini, lalu terima pengampunan.',
  },
  {
    key: 'permohonan',
    emoji: '🤲',
    label: 'Doa Permohonan',
    hint: 'Minta untuk dirimu sendiri, sejujur-jujurnya.',
  },
  {
    key: 'syafaat',
    emoji: '🙏',
    label: 'Doa Syafaat',
    hint: 'Giliran orang lain, sesuai jadwal hari ini.',
  },
];

/** 🙌 Pengucapan Syukur — 12 pokok, urutan aslinya. */
export const SYUKUR: string[] = [
  'Sepanjang hari ini & nafas',
  'Godaan dosa',
  'Masalah & pergumulan',
  'Pola berpikir',
  'Kesehatan',
  'Bisa makan & minum',
  'Bakat',
  'Keluarga',
  'Saudara',
  'Teman',
  'Kuliah, komunitas, organisasi, pelayanan',
  'Barang',
];

/** 🕊️ Pengakuan Dosa — 7 pokok, urutan aslinya. */
export const PENGAKUAN: string[] = [
  'Pikiran kotor',
  'Berkata kotor',
  'Berbohong',
  'Iri dan dendam',
  'Menghina dan mengkritik',
  'Sombong',
  'Menipu dan mencuri',
];

/** 🤲 Permohonan untuk diri sendiri — 16 pokok, urutan aslinya. */
export const PERMOHONAN: string[] = [
  'Apa yang harus kuperbuat',
  'Iman yang kuat kepada Tuhan',
  'Hidup kudus',
  'Menjadi dampak',
  'Masa depan & karunia',
  'Pola berpikir',
  'Cara berbicara',
  'Pasangan hidup',
  'Beli barang',
  'Pekerjaan',
  'CORE Leader',
  'HIM Youth',
  'Kuliah S2',
  'Pelayanan KK, Usher & Dansek',
  'Tidur dan bangun pagi',
  'Doa yang benar',
];

/** Berapa pokok yang dibawa tiap malam per bagian. */
export const PER_MALAM: Record<'syukur' | 'dosa' | 'permohonan', number> = {
  syukur: 3,
  dosa: 2,
  permohonan: 4,
};

// ----------------------------- putaran malam -----------------------------

/**
 * Ambil `jumlah` butir BERURUTAN dari daftar, memutar ke awal kalau habis.
 * Bukan acak: hari yang sama selalu memberi potongan yang sama, dan tidak ada
 * butir yang terlewat lebih lama daripada yang lain.
 */
export function putaran<T>(daftar: T[], hari: number, jumlah: number): T[] {
  if (daftar.length === 0) return [];
  const ambil = Math.min(jumlah, daftar.length);
  const panjang = daftar.length;
  const mulai = (((hari * ambil) % panjang) + panjang) % panjang;
  return Array.from({ length: ambil }, (_, i) => daftar[(mulai + i) % panjang]);
}

export type NightPlan = {
  syukur: string[];
  dosa: string[];
  permohonan: string[];
  /** Syafaat hari ini, sumbernya jadwal yang sama dengan Morning Journey. */
  syafaat: IntercessionTopic;
};

/** Potongan doa untuk malam ini. Murni: tanggal sama = hasil sama. */
export function nightPlan(dayId: string, now: Date): NightPlan {
  const hari = dayNumber(dayIdToDate(dayId));
  return {
    syukur: putaran(SYUKUR, hari, PER_MALAM.syukur),
    dosa: putaran(PENGAKUAN, hari, PER_MALAM.dosa),
    permohonan: putaran(PERMOHONAN, hari, PER_MALAM.permohonan),
    syafaat: intercessionToday(now),
  };
}

/** Isi satu bagian malam ini, sebagai daftar baris. */
export function nightPoints(plan: NightPlan, key: NightKey): string[] {
  if (key === 'syukur') return plan.syukur;
  if (key === 'dosa') return plan.dosa;
  if (key === 'permohonan') return plan.permohonan;
  return plan.syafaat.points;
}

/**
 * Satu baris ringkas isi malam ini, untuk kartu Today & notifikasi:
 * "3 syukur · 2 pengakuan · 4 permohonan · 🇮🇩 Bangsa dan Negara Indonesia".
 */
export function nightSummary(plan: NightPlan): string {
  return [
    `${plan.syukur.length} syukur`,
    `${plan.dosa.length} pengakuan`,
    `${plan.permohonan.length} permohonan`,
    `${plan.syafaat.emoji} ${plan.syafaat.label}`,
  ].join(' · ');
}

// ------------------------------ jendela malam ------------------------------

/** Mulai jam berapa Night Prayer muncul di Today & diingatkan. */
export const NIGHT_FROM_HOUR = 19;

export function nightWindow(now: Date): boolean {
  return now.getHours() >= NIGHT_FROM_HOUR;
}

// ------------------------------ centang malam ------------------------------
//
// Menumpang di dokumen harian kebiasaan, jadi tanpa read tambahan. Id-nya
// diberi awalan supaya tidak mungkin bentrok dengan id kebiasaan buatan
// sendiri, dan supaya jelas siapa pemiliknya saat dokumennya dibaca orang.

export function nightDoneId(key: NightKey): string {
  return `night-prayer:${key}`;
}

export function nightSectionDone(day: HabitDay | null, key: NightKey): boolean {
  return day?.done?.[nightDoneId(key)] === true;
}

/** Berapa bagian yang sudah didoakan malam ini (0 sampai 4). */
export function nightDoneCount(day: HabitDay | null): number {
  return NIGHT_SECTIONS.filter((s) => nightSectionDone(day, s.key)).length;
}

/** Keempat bagiannya sudah didoakan malam ini? */
export function nightAllDone(day: HabitDay | null): boolean {
  return nightDoneCount(day) === NIGHT_SECTIONS.length;
}

export function setNightSectionDone(
  uid: string,
  dayId: string,
  key: NightKey,
  done: boolean,
) {
  return setHabitDone(uid, dayId, nightDoneId(key), done);
}

// ------------------------------ streak malam ------------------------------

export type NightStreak = DayStreak;

export function subscribeNightStreak(
  uid: string,
  onChange: (streak: NightStreak | null) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'app', 'nightPrayer'),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as NightStreak) : null),
    onError,
  );
}

/**
 * Panggil saat bagian KEEMPAT malam ini baru saja dicentang. Naik maksimal
 * sekali sehari, aturannya sama dengan streak Revive & doa pagi.
 */
export function bumpNightStreak(
  uid: string,
  current: NightStreak | null,
  todayId: string,
) {
  if (alreadyCounted(current, todayId)) return Promise.resolve();
  return setDoc(
    doc(db, 'users', uid, 'app', 'nightPrayer'),
    nextStreak(current, todayId, yesterdayId()),
  );
}

/**
 * Streak yang masih hidup: putus kalau malam terakhir bukan hari ini/kemarin.
 * Aturannya SAMA dengan streak kebiasaan & Revive, jadi hitungannya pun sama
 * persis (lib/health `activeStreak`), bukan salinan yang bisa menyimpang.
 */
export function nightStreakAlive(
  streak: NightStreak | null,
  todayId: string,
): number {
  return activeStreak(streak, todayId);
}
