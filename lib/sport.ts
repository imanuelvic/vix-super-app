import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { dayId, dayIdToDate } from './format';
import { db } from './firebase';
import { liveDoc } from './liveDoc';

// Sport ⚽ — pengurus futsal rutin (lihat components/friends/SportTab.tsx).
//
// Ini bukan sekadar catatan olahraga: ini alat seorang MANAGER. Yang membuat
// futsal rutin bubar hampir selalu tiga hal yang sama, dan ketiganya diurus di
// sini:
//   1. Jadwalnya tidak pernah dibuat → "kapan main lagi?" mengambang di grup.
//   2. Uangnya bocor → yang menalangi lapangan lupa siapa yang belum setor.
//   3. Tidak ada yang seru untuk dikenang → mainnya jadi terasa sia-sia.
// Karena itu tiap sesi memuat jadwal + lokasi, daftar setoran per orang, dan
// skor tiap game.
//
// Penyimpanan: SATU dokumen (users/{uid}/social/sport) berisi anggota &
// seluruh sesi. Sesinya cuma teks & angka — dua geng × 2 kali sebulan ≈ 50
// sesi setahun, jauh di bawah batas 1 MB per dokumen. Sekali baca, langsung
// hidup, dan tidak perlu composite index.

/** Geng yang rutin main bareng. */
export type SportGangKey = 'core' | 'f3';

export type SportGang = {
  key: SportGangKey;
  label: string;
  emoji: string;
  /** Kepanjangan / siapa mereka — muncul di bawah nama gengnya. */
  desc: string;
  /**
   * Jarak hari ke pertemuan berikutnya, dipakai tombol "🔁 Ulangi".
   * F3 memang dijadwalkan dua mingguan; CORE dipakai mingguan sebagai
   * ancang-ancang — tanggalnya tetap bisa kamu geser sebelum disimpan.
   */
  repeatDays: number;
};

export const SPORT_GANGS: SportGang[] = [
  {
    key: 'core',
    label: 'CORE',
    emoji: '⛪',
    desc: 'MCL Imanuel Victory',
    repeatDays: 30,
  },
  {
    key: 'f3',
    label: 'NDC F3',
    emoji: '⚽',
    desc: 'Fulltimer Fun Futsal',
    repeatDays: 14,
  },
];

export function gangMeta(key: SportGangKey): SportGang {
  return SPORT_GANGS.find((g) => g.key === key) ?? SPORT_GANGS[0];
}

/** Posisi futsal — 5 pemain, bukan 11. Istilahnya memang beda dari sepak bola. */
export type SportPosition = 'kiper' | 'anchor' | 'flank' | 'pivot';

export const SPORT_POSITIONS: {
  key: SportPosition;
  label: string;
  emoji: string;
  /** Tugasnya di lapangan — biar pembagian tim tidak asal comot. */
  tugas: string;
}[] = [
  { key: 'kiper', label: 'Kiper', emoji: '🧤', tugas: 'Penjaga gawang & pengatur serangan dari belakang' },
  { key: 'anchor', label: 'Anchor', emoji: '🛡️', tugas: 'Bek terakhir, pengatur tempo' },
  { key: 'flank', label: 'Flank', emoji: '⚡', tugas: 'Sayap kiri/kanan, paling banyak lari' },
  { key: 'pivot', label: 'Pivot', emoji: '🎯', tugas: 'Ujung tombak, pemantul bola & pencetak gol' },
];

export function positionMeta(key: SportPosition) {
  return SPORT_POSITIONS.find((p) => p.key === key) ?? SPORT_POSITIONS[1];
}

export type SportMember = {
  id: string;
  gang: SportGangKey;
  name: string;
  /** Nomor HP — dipakai tombol chat WhatsApp saat menagih. */
  phone: string;
  position: SportPosition;
  note: string;
};

/** Satu game di dalam sesi. Futsal tarkam: biasanya rompi vs non-rompi. */
export type SportGame = {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  /**
   * id anggota pencetak gol — SATU BARIS PER GOL, jadi id yang sama boleh
   * muncul dua kali kalau ia mencetak dua gol. Inilah dasar papan top skor.
   */
  scorers: string[];
};

export type SportSession = {
  id: string;
  gang: SportGangKey;
  /** Tanggal main, "YYYY-MM-DD". */
  dayId: string;
  /** Jam main, mis. "20.00". */
  time: string;
  venue: string;
  /** Iuran per orang (Rp). */
  fee: number;
  /** id anggota yang ikut main. */
  squad: string[];
  /** id anggota yang SUDAH setor. Selalu bagian dari `squad`. */
  paid: string[];
  games: SportGame[];
  note: string;
};

/** Uang masuk / keluar dari kas geng. */
export type SportCashDirection = 'in' | 'out';

/**
 * Satu mutasi kas tim — bentuknya sama dengan Saku 👛 di Finance, tapi uangnya
 * bukan uangmu: ini uang BERSAMA yang kamu pegang sebagai manager. Karena itu
 * tiap barisnya wajib punya judul; "keluar Rp 300.000" tanpa keterangan adalah
 * cara tercepat kehilangan kepercayaan satu geng.
 */
export type SportCashEntry = {
  id: string;
  gang: SportGangKey;
  /** Tanggal mutasi, "YYYY-MM-DD". */
  dayId: string;
  title: string;
  direction: SportCashDirection;
  amount: number;
  note: string;
  /**
   * Sesi asal uang ini — hanya diisi oleh tombol "Setor ke Kas" di layar sesi.
   * Dipakai untuk tahu berapa dari iuran sesi itu yang SUDAH masuk kas, jadi
   * uang yang sama tidak pernah tercatat dua kali.
   */
  sessionId?: string;
};

export type SportData = {
  members: SportMember[];
  sessions: SportSession[];
  cash: SportCashEntry[];
};

export const EMPTY_SPORT: SportData = { members: [], sessions: [], cash: [] };

/** Id baru — jam + acak, cukup unik untuk daftar sepanjang ini. */
export function newSportId(now: Date): string {
  return `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ===================== Hitungan uang =====================

/** Total iuran yang HARUS terkumpul dari sesi ini. */
export function sessionTotal(s: SportSession): number {
  return s.fee * s.squad.length;
}

/** Yang sudah masuk. */
export function sessionPaidTotal(s: SportSession): number {
  return s.fee * s.paid.filter((id) => s.squad.includes(id)).length;
}

/** Sisa yang belum masuk — ini angka yang bikin manager rugi diam-diam. */
export function sessionDueTotal(s: SportSession): number {
  return sessionTotal(s) - sessionPaidTotal(s);
}

/** Berapa orang yang belum setor. */
export function sessionUnpaidCount(s: SportSession): number {
  return s.squad.filter((id) => !s.paid.includes(id)).length;
}

// ===================== Kas tim =====================

/** Mutasi kas satu geng, TERBARU dulu. */
export function gangCash(
  data: SportData,
  gang: SportGangKey,
): SportCashEntry[] {
  return data.cash
    .filter((c) => c.gang === gang)
    .sort((a, b) => b.dayId.localeCompare(a.dayId) || b.id.localeCompare(a.id));
}

/** Saldo kas satu geng: yang masuk dikurangi yang keluar. */
export function cashBalance(data: SportData, gang: SportGangKey): number {
  return data.cash.reduce(
    (n, c) =>
      c.gang === gang ? n + (c.direction === 'in' ? c.amount : -c.amount) : n,
    0,
  );
}

/** Kas SELURUH geng dijumlahkan — angka yang dicari saat buka halaman kas. */
export function cashTotal(data: SportData): number {
  return SPORT_GANGS.reduce((n, g) => n + cashBalance(data, g.key), 0);
}

/**
 * Berapa rupiah dari iuran sesi ini yang SUDAH disetor ke kas.
 *
 * Dipakai supaya uang yang sama tak pernah masuk dua kali — dan supaya yang
 * telat setor tetap bisa disusulkan: tombol setornya cuma menawarkan SELISIH
 * antara yang sudah terkumpul di sesi dan yang sudah tercatat di kas.
 */
export function sessionCashIn(data: SportData, sessionId: string): number {
  return data.cash.reduce(
    (n, c) =>
      c.sessionId === sessionId && c.direction === 'in' ? n + c.amount : n,
    0,
  );
}

// ===================== Anggota =====================

/**
 * Anggota satu geng, URUT ABJAD nama.
 *
 * Urutan tambah-nya sendiri tidak berarti apa-apa buat siapa pun; yang kamu
 * lakukan di daftar ini selalu "cari si Anu", dan itu cuma cepat kalau
 * urutannya bisa ditebak. `localeCompare` dengan locale id + sensitivity base
 * → huruf besar/kecil & aksen tidak memisahkan nama yang sama.
 */
export function gangMembers(
  data: SportData,
  gang: SportGangKey,
): SportMember[] {
  return data.members
    .filter((m) => m.gang === gang)
    .sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
}

// ===================== Jadwal =====================

/** SEMUA sesi yang belum lewat, paling dekat dulu. */
export function upcomingSessions(
  sessions: SportSession[],
  gang: SportGangKey,
  todayId: string,
): SportSession[] {
  return sessions
    .filter((s) => s.gang === gang && s.dayId >= todayId)
    .sort((a, b) => a.dayId.localeCompare(b.dayId));
}

/**
 * Sesi BERIKUTNYA satu geng — yang tanggalnya hari ini atau sesudahnya, paling
 * dekat. `null` = belum dijadwalkan sama sekali.
 */
export function nextSession(
  sessions: SportSession[],
  gang: SportGangKey,
  todayId: string,
): SportSession | null {
  return upcomingSessions(sessions, gang, todayId)[0] ?? null;
}

/** Sesi yang sudah lewat, terbaru dulu. */
export function pastSessions(
  sessions: SportSession[],
  gang: SportGangKey,
  todayId: string,
): SportSession[] {
  return sessions
    .filter((s) => s.gang === gang && s.dayId < todayId)
    .sort((a, b) => b.dayId.localeCompare(a.dayId));
}

/** Sesi terakhir geng ini (lewat maupun akan datang) — acuan tombol Ulangi. */
export function lastSession(
  sessions: SportSession[],
  gang: SportGangKey,
): SportSession | null {
  return (
    sessions
      .filter((s) => s.gang === gang)
      .sort((a, b) => b.dayId.localeCompare(a.dayId))[0] ?? null
  );
}

/** Tanggal pertemuan berikutnya = tanggal ini + jarak rutin gengnya. */
export function repeatDayId(from: string, gang: SportGangKey): string {
  const d = dayIdToDate(from);
  d.setDate(d.getDate() + gangMeta(gang).repeatDays);
  return dayId(d);
}

/** Berapa hari lagi sampai sesi ini (negatif = sudah lewat). */
export function daysToSession(s: SportSession, now: Date): number {
  const target = dayIdToDate(s.dayId);
  return Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
}

// ===================== Skor & papan pencetak gol =====================

/** "12 – 9" dari seluruh game di satu sesi. */
export function sessionScoreLine(s: SportSession): string {
  if (s.games.length === 0) return '';
  const a = s.games.reduce((n, g) => n + g.scoreA, 0);
  const b = s.games.reduce((n, g) => n + g.scoreB, 0);
  return `${a} – ${b}`;
}

export type ScorerRow = { member: SportMember; goals: number; caps: number };

/**
 * Papan top skor satu geng: gol terbanyak dulu, lalu yang paling rajin datang.
 *
 * `caps` (berapa kali ikut main) sengaja ikut dihitung — tanpa itu, yang jarang
 * datang tapi sekali cetak 3 gol terlihat lebih hebat daripada yang tidak
 * pernah absen. Buat seorang manager, yang RAJIN DATANG justru yang bikin
 * kegiatannya tetap jalan.
 */
export function topScorers(
  data: SportData,
  gang: SportGangKey,
): ScorerRow[] {
  const sesi = data.sessions.filter((s) => s.gang === gang);
  return data.members
    .filter((m) => m.gang === gang)
    .map((member) => ({
      member,
      goals: sesi.reduce(
        (n, s) =>
          n + s.games.reduce((g, game) =>
            g + game.scorers.filter((id) => id === member.id).length, 0),
        0,
      ),
      caps: sesi.filter((s) => s.squad.includes(member.id)).length,
    }))
    .sort((a, b) => b.goals - a.goals || b.caps - a.caps);
}

// ===================== Badge =====================

/** Berapa hari sebelum hari-H sesinya mulai ditagih di badge. */
export const SPORT_ALERT_DAYS = 2;

/**
 * Angka badge Sport — dua hal yang benar-benar menuntut tindakanmu:
 *   • sesi yang tinggal ≤ 2 hari lagi (pastikan pemainnya cukup & lapangannya
 *     sudah dibooking), dan
 *   • sesi yang SUDAH LEWAT tapi masih ada yang belum setor.
 *
 * Sesi jauh di depan tidak dihitung: menagih dua minggu sebelumnya cuma
 * membuat badge-nya menyala terus dan akhirnya diabaikan.
 */
export function sportAttention(data: SportData, now: Date): number {
  return data.sessions.filter((s) => sessionNeedsAttention(s, now)).length;
}

/** Sesi INI yang menyalakan badge? Dipakai titik & garis merah di daftarnya. */
export function sessionNeedsAttention(s: SportSession, now: Date): boolean {
  const sisa = daysToSession(s, now);
  return sisa >= 0 ? sisa <= SPORT_ALERT_DAYS : sessionUnpaidCount(s) > 0;
}

// ===================== Firestore =====================

const sportRef = (uid: string) => doc(db, 'users', uid, 'social', 'sport');

export function subscribeSport(
  uid: string,
  onChange: (data: SportData) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    sportRef(uid),
    (snapshot) => {
      const d = snapshot.data() as Partial<SportData> | undefined;
      onChange({
        members: d?.members ?? [],
        sessions: d?.sessions ?? [],
        // Dokumen yang ditulis sebelum kas ada belum punya kolom ini.
        cash: d?.cash ?? [],
      });
    },
    onError,
  );
}

/** Tulis ulang seluruhnya. Hapus = tulis ulang tanpa barisnya (PERMANEN). */
export function saveSport(uid: string, data: SportData) {
  return setDoc(sportRef(uid), data);
}
