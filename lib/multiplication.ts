import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    Timestamp,
    type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { MONTH_NAMES, monthIdOf } from './format';

// Multiplikasi CORE 🌱 — satu CORE dibelah jadi dua.
//
// Isinya DUA hal yang selama ini hidup di spreadsheet terpisah:
//   1. TIMELINE — urutan langkah dari "Training Calon CL" sampai "CORE
//      Perdana", lengkap dengan tanggal & status (✅ beres · ❌ batal/digeser).
//      Ini yang bikin multiplikasi tidak berantakan: tiap langkah punya
//      tanggalnya sendiri dan kelihatan mana yang belum.
//   2. PEMBAGIAN ANGGOTA — siapa ikut CORE mana, umurnya, dan ALASANNYA.
//      Alasan itu yang paling sering ditanya balik berbulan-bulan kemudian.
//
// Satu dokumen per multiplikasi: users/{uid}/multiplications/{id}.
// Langkah & anggota disimpan sebagai array di dalamnya — jumlahnya puluhan,
// jauh di bawah batas 1 MB per dokumen, dan sekali baca dapat semuanya.

/** Satu langkah di timeline. */
export type MultiStep = {
  id: string;
  date: Timestamp;
  title: string;
  /** Poin-poin kecil di bawah judulnya (yang di sheet ditulis pakai "*"). */
  notes: string[];
  done: boolean;
  /**
   * Batal / digeser ke tanggal lain. Sengaja BUKAN dihapus: rencana yang
   * bergeser itu bagian dari ceritanya, dan sering perlu dilihat lagi saat
   * multiplikasi berikutnya disusun.
   */
  cancelled: boolean;
};

/**
 * Anggota ada di kelompok mana:
 *   a     — CORE asal (yang ditinggali)
 *   b     — CORE baru (yang mekar)
 *   out   — tidak ikut multiplikasi (pindah gereja/kota/CORE lain)
 *   other — "Others" di sheet: nyantol tapi belum masuk hitungan
 */
export type MultiSide = 'a' | 'b' | 'out' | 'other';

export type MultiMember = {
  id: string;
  name: string;
  /** null = belum diisi. */
  age: number | null;
  reason: string;
  side: MultiSide;
};

export type Multiplication = {
  id: string;
  /** CORE asal — nama CL & emoji hatinya. */
  fromName: string;
  fromHeart: string;
  /** CORE baru hasil pemekaran. */
  toName: string;
  toHeart: string;
  /** Rapat penentuan multiplikasi. null = belum ditentukan. */
  meetingDate: Timestamp | null;
  /** CORE pertama si CL baru — puncak seluruh timeline-nya. */
  firstCoreDate: Timestamp | null;
  /** Hari & tempat CORE barunya berjalan, mis. "Rabu" · "NDC Soho Capital". */
  day: string;
  place: string;
  steps: MultiStep[];
  members: MultiMember[];
  createdAt: number;
};

export const SIDE_META: { key: MultiSide; label: string; emoji: string }[] = [
  { key: 'a', label: 'CORE asal', emoji: '🏠' },
  { key: 'b', label: 'CORE baru', emoji: '🌱' },
  { key: 'out', label: 'Tidak ikut', emoji: '🚪' },
  { key: 'other', label: 'Others', emoji: '❔' },
];

// ==================== Hitungan ====================

/**
 * Kemajuan timeline. Langkah yang ❌ batal TIDAK ikut dihitung — di penyebut
 * maupun pembilang — supaya rencana yang digeser tidak menurunkan angkanya.
 */
export function multiProgress(m: Multiplication): {
  done: number;
  total: number;
} {
  const live = m.steps.filter((s) => !s.cancelled);
  return { done: live.filter((s) => s.done).length, total: live.length };
}

export type MultiStatus = 'planned' | 'running' | 'done' | 'cancelled';

/**
 * Status DITURUNKAN dari langkahnya, bukan disimpan sendiri — supaya tidak
 * mungkin ada kartu bertulis "Selesai" padahal masih ada langkah menggantung.
 *
 * ❌ Batal: multiplikasi yang di dalamnya ADA langkah dibatalkan dan tidak
 * ada lagi langkah hidup yang menunggu. Sebelumnya keadaan ini terbaca
 * "✅ Selesai" — karena langkah batal memang tidak ikut dihitung, sisanya
 * jadi 16/16 dan tampak tuntas. Padahal justru langkah-langkah penutupnya
 * (mis. CORE Perdana) yang dicoret: rencananya berhenti di tengah jalan, dan
 * kartunya harus jujur mengatakan itu.
 *
 * Multiplikasi yang SELURUH langkahnya batal juga masuk sini — dulu ia
 * terbaca "🗓️ Rencana" karena penyebutnya nol.
 */
export function multiStatus(m: Multiplication): MultiStatus {
  const { done, total } = multiProgress(m);
  const adaYangBatal = m.steps.some((s) => s.cancelled);
  if (total === 0) return adaYangBatal ? 'cancelled' : 'planned';
  if (done === total) return adaYangBatal ? 'cancelled' : 'done';
  return done > 0 ? 'running' : 'planned';
}

export function multiStatusLabel(status: MultiStatus): string {
  return status === 'done'
    ? '✅ Selesai'
    : status === 'cancelled'
      ? '❌ Batal'
      : status === 'running'
        ? '⏳ Berjalan'
        : '🗓️ Rencana';
}

/** Langkah urut tanggal (terlama dulu) — urutan baca timeline. */
export function sortedSteps(m: Multiplication): MultiStep[] {
  return [...m.steps].sort((a, b) => a.date.toMillis() - b.date.toMillis());
}

/** Langkah berikutnya yang belum dikerjakan (null = semua beres). */
export function nextStep(m: Multiplication): MultiStep | null {
  return sortedSteps(m).find((s) => !s.done && !s.cancelled) ?? null;
}

/** Kunci pengelompokan timeline: "2026-05" → judul "Mei 2026". */
export function stepMonthKey(step: MultiStep): string {
  return monthIdOf(step.date.toDate());
}

export function monthKeyLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Timeline dikelompokkan per bulan, urut dari yang paling lama. */
export function stepsByMonth(
  m: Multiplication,
): { key: string; label: string; steps: MultiStep[] }[] {
  const groups: { key: string; label: string; steps: MultiStep[] }[] = [];
  for (const step of sortedSteps(m)) {
    const key = stepMonthKey(step);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.steps.push(step);
    else groups.push({ key, label: monthKeyLabel(key), steps: [step] });
  }
  return groups;
}

/** Anggota satu kelompok, urut umur termuda → tertua (yang kosong di akhir). */
export function membersOf(m: Multiplication, side: MultiSide): MultiMember[] {
  return m.members
    .filter((x) => x.side === side)
    .sort((a, b) => (a.age ?? 999) - (b.age ?? 999));
}

/** Nama kelompok yang siap tampil: "🧡 CORE Sarah" / "🚪 Tidak ikut". */
export function sideLabel(m: Multiplication, side: MultiSide): string {
  if (side === 'a') return `${m.fromHeart} CORE ${m.fromName}`.trim();
  if (side === 'b') return `${m.toHeart} CORE ${m.toName}`.trim();
  const meta = SIDE_META.find((s) => s.key === side)!;
  return `${meta.emoji} ${meta.label}`;
}

// ==================== Firestore ====================

function multiCollection(uid: string) {
  return collection(db, 'users', uid, 'multiplications');
}

export function newMultiplicationId(): string {
  return `m${Date.now().toString(36)}`;
}

export function newStepId(): string {
  return `s${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export function newMemberId(): string {
  return `p${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

function readDate(value: unknown): Timestamp | null {
  return value instanceof Timestamp ? value : null;
}

function readSteps(raw: unknown): MultiStep[] {
  return (Array.isArray(raw) ? raw : []).flatMap((s) => {
    const date = readDate((s as MultiStep)?.date);
    if (!date) return []; // tanpa tanggal tak bisa ditaruh di timeline
    const step = s as Partial<MultiStep>;
    return [
      {
        id: String(step.id ?? newStepId()),
        date,
        title: String(step.title ?? ''),
        notes: Array.isArray(step.notes) ? step.notes.map(String) : [],
        done: step.done === true,
        cancelled: step.cancelled === true,
      },
    ];
  });
}

function readMembers(raw: unknown): MultiMember[] {
  return (Array.isArray(raw) ? raw : []).map((x) => {
    const p = x as Partial<MultiMember>;
    return {
      id: String(p.id ?? newMemberId()),
      name: String(p.name ?? ''),
      age: typeof p.age === 'number' ? p.age : null,
      reason: String(p.reason ?? ''),
      side: SIDE_META.some((s) => s.key === p.side)
        ? (p.side as MultiSide)
        : 'a',
    };
  });
}

export function subscribeMultiplications(
  uid: string,
  onChange: (list: Multiplication[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // Terbaru di atas — multiplikasi yang sedang berjalan yang paling dicari.
  const q = query(multiCollection(uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onChange(
        snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            fromName: String(data.fromName ?? ''),
            fromHeart: String(data.fromHeart ?? ''),
            toName: String(data.toName ?? ''),
            toHeart: String(data.toHeart ?? ''),
            meetingDate: readDate(data.meetingDate),
            firstCoreDate: readDate(data.firstCoreDate),
            day: String(data.day ?? ''),
            place: String(data.place ?? ''),
            steps: readSteps(data.steps),
            members: readMembers(data.members),
            createdAt: Number(data.createdAt ?? 0),
          };
        }),
      );
    },
    onError,
  );
}

/** Simpan/timpa satu multiplikasi (dipakai saat buat & tiap perubahan). */
export function saveMultiplication(uid: string, m: Multiplication) {
  const { id, ...data } = m;
  return setDoc(doc(db, 'users', uid, 'multiplications', id), data);
}

/** Hapus PERMANEN — dokumennya benar-benar hilang, bukan ditandai. */
export function deleteMultiplication(uid: string, id: string) {
  return deleteDoc(doc(db, 'users', uid, 'multiplications', id));
}
