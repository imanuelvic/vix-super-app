import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Tournament 🏆 — turnamen badminton sistem GUGUR (single-elimination).
// Peserta diisi bebas (1 nama per peserta: bisa orang, pasangan, atau tim),
// jumlah 4 / 8 / 16, undian babak pertama DIACAK. Tiap laga cukup pilih
// pemenang → otomatis maju ke babak berikutnya sampai ketemu juara.
//
// Penyimpanan: SATU dokumen per turnamen (users/{uid}/tournaments/{id}).
// Bracket disimpan sebagai daftar laga DATAR (bukan array-bersarang) karena
// Firestore tidak mendukung array di dalam array.

export type BracketSize = 4 | 8 | 16;

/** Satu laga: dua sisi (a/b) + pemenang. `null` = slot belum terisi (menunggu). */
export type Match = {
  round: number; // 0 = babak pertama
  slot: number; // indeks laga di dalam babak
  a: string | null;
  b: string | null;
  winner: 'a' | 'b' | null;
};

export type Tournament = {
  id: string;
  name: string;
  size: BracketSize;
  participants: string[]; // urutan hasil undian (acak), panjang = size
  matches: Match[]; // datar; kelompokkan per babak dengan roundsOf()
  champion: string | null; // terisi saat final selesai
  createdAt: number;
  updatedAt: number;
};

// ===================== Logika bracket (murni) =====================

/** Acak urutan (Fisher–Yates) — untuk undian babak pertama. */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Jumlah babak total (4→2, 8→3, 16→4). */
function totalRounds(size: BracketSize): number {
  return Math.log2(size);
}

/** Bangun semua laga kosong dari daftar peserta (sudah terurut/teracak). */
function buildMatches(participants: string[]): Match[] {
  const size = participants.length;
  const rounds = Math.log2(size);
  const matches: Match[] = [];
  // Babak pertama: pasangkan peserta berurutan.
  for (let s = 0; s < size / 2; s++) {
    matches.push({
      round: 0,
      slot: s,
      a: participants[2 * s],
      b: participants[2 * s + 1],
      winner: null,
    });
  }
  // Babak berikutnya: slot masih kosong (menunggu pemenang babak sebelumnya).
  for (let r = 1; r < rounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let s = 0; s < count; s++) {
      matches.push({ round: r, slot: s, a: null, b: null, winner: null });
    }
  }
  return matches;
}

/** Nama pemenang satu laga (atau null bila belum diputuskan). */
export function winnerName(m: Match | undefined): string | null {
  if (!m || !m.winner) return null;
  return m.winner === 'a' ? m.a : m.b;
}

/** Kelompokkan laga datar menjadi babak: rounds[r][slot]. */
export function roundsOf(t: Tournament): Match[][] {
  const rounds: Match[][] = [];
  for (const m of t.matches) {
    (rounds[m.round] ??= [])[m.slot] = m;
  }
  return rounds;
}

/** Sudah ada laga yang diputuskan? (untuk mengunci "acak ulang"). */
export function hasStarted(t: Tournament): boolean {
  return t.matches.some((m) => m.winner !== null);
}

/**
 * Tetapkan pemenang laga (round, slot) lalu propagasi ke depan: isi slot babak
 * berikutnya dengan para pemenang. Bila pengisi slot berubah (mis. pemenang
 * sebelumnya diganti), hasil di babak-babak setelahnya yang jadi tak konsisten
 * otomatis dibatalkan. Mengembalikan turnamen baru (immutable).
 */
export function applyWinner(
  t: Tournament,
  round: number,
  slot: number,
  side: 'a' | 'b',
): Tournament {
  const matches = t.matches.map((m) => ({ ...m }));
  const at = (r: number, s: number) =>
    matches.find((m) => m.round === r && m.slot === s)!;

  at(round, slot).winner = side;

  const rounds = totalRounds(t.size);
  for (let r = 1; r < rounds; r++) {
    const count = t.size / 2 ** (r + 1);
    for (let s = 0; s < count; s++) {
      const wA = winnerName(at(r - 1, 2 * s));
      const wB = winnerName(at(r - 1, 2 * s + 1));
      const m = at(r, s);
      // Pengisi slot berubah → hasil lama laga ini basi, batalkan.
      if (m.a !== wA || m.b !== wB) m.winner = null;
      m.a = wA;
      m.b = wB;
    }
  }

  const champion = winnerName(at(rounds - 1, 0));
  return { ...t, matches, champion, updatedAt: Date.now() };
}

/** Nama babak berdasarkan jumlah laga di dalamnya. */
export function roundLabel(matchCount: number): string {
  switch (matchCount) {
    case 1:
      return 'Final';
    case 2:
      return 'Semifinal';
    case 4:
      return 'Perempat Final';
    case 8:
      return '16 Besar';
    default:
      return `${matchCount * 2} Besar`;
  }
}

// ===================== Firestore =====================

function tournamentsCollection(uid: string) {
  return collection(db, 'users', uid, 'tournaments');
}

function newTournamentId(): string {
  return `t${Date.now().toString(36)}`;
}

/** Buat turnamen baru dari nama peserta (langsung diacak). */
export function createTournament(
  uid: string,
  name: string,
  size: BracketSize,
  names: string[],
): Tournament {
  const participants = shuffle(names);
  const t: Tournament = {
    id: newTournamentId(),
    name,
    size,
    participants,
    matches: buildMatches(participants),
    champion: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  return t;
}

/** Undi ulang babak pertama (hanya boleh sebelum ada laga diputuskan). */
export function reshuffle(t: Tournament): Tournament {
  const participants = shuffle(t.participants);
  return {
    ...t,
    participants,
    matches: buildMatches(participants),
    champion: null,
    updatedAt: Date.now(),
  };
}

export function subscribeTournaments(
  uid: string,
  onChange: (list: Tournament[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const q = query(tournamentsCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data() as Omit<Tournament, 'id'>;
          return {
            id: d.id,
            name: data.name ?? 'Turnamen',
            size: data.size ?? 8,
            participants: data.participants ?? [],
            matches: data.matches ?? [],
            champion: data.champion ?? null,
            createdAt: data.createdAt ?? 0,
            updatedAt: data.updatedAt ?? 0,
          };
        }),
      );
    },
    onError,
  );
}

/** Simpan/timpa satu turnamen (dipakai saat buat & tiap update bracket). */
export function saveTournament(uid: string, t: Tournament) {
  const { id, ...data } = t;
  return setDoc(doc(db, 'users', uid, 'tournaments', id), data);
}

export function deleteTournament(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'tournaments', id));
}
