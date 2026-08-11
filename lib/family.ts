import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  type FirestoreError
} from 'firebase/firestore';

import { db } from './firebase';

// Family Tree 👨‍👩‍👧‍👦 — silsilah keluarga ala The Sims:
// tiap anggota punya nama, tanggal lahir, foto kecil, status meninggal,
// dan relasi lewat parentIds. Anak & pasangan DITURUNKAN dari parentIds
// (pasangan = sesama orang tua dari anak yang sama) — satu sumber
// kebenaran, tidak ada data relasi ganda yang bisa tidak sinkron.
//
// Penyimpanan: SATU dokumen per anggota (users/{uid}/familyMembers/{id})
// karena foto base64 (~5 KB) ikut di dalamnya — kalau satu dokumen berisi
// semua anggota, batas 1 MB Firestore cepat tersentuh.

// Lingkar keluarga: 'inti' = keluarga inti (3 generasi) yang dapat reminder
// ultah di Home; 'saudara' = saudara/kerabat, border beda & TANPA reminder.
export type FamilyCircle = 'inti' | 'saudara';

export type FamilyMember = {
  id: string;
  name: string; // nama lengkap
  nickname: string; // nama panggilan — dipakai untuk tampilan di pohon & daftar
  birthYear: number;
  birthMonth: number; // 0–11 seperti Date JS
  birthDay: number;
  deceased: boolean; // ✝ — tampil hitam-putih di pohon
  circle: FamilyCircle; // keluarga inti vs saudara (beda warna border & reminder)
  isSelf: boolean; // "saya" — jadi pusat pohon & default saat buka layar
  parentIds: string[]; // maksimal 2
  partnerIds: string[]; // pasangan (suami/istri) — relasi dianggap 2 arah
  photo: string | null; // JPEG base64 kecil (tanpa prefix data:)
};

/** Nama untuk ditampilkan: nama panggilan kalau ada, kalau tidak nama lengkap. */
export function displayName(m: { name: string; nickname?: string }): string {
  return (m.nickname ?? '').trim() || m.name;
}

/** Nama pemilik app — dipakai untuk sapaan Home & mengenali "saya" di Family. */
export const OWNER_NAME = 'Imanuel Victory Rumayar';

export function selfMember(members: FamilyMember[]): FamilyMember | undefined {
  const norm = (s: string) => s.trim().toLowerCase();
  return (
    members.find((m) => m.isSelf) ??
    members.find((m) => norm(m.name) === norm(OWNER_NAME))
  );
}

function membersCollection(uid: string) {
  return collection(db, 'users', uid, 'familyMembers');
}

export function subscribeFamily(
  uid: string,
  onChange: (members: FamilyMember[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  // Urut dari yang paling tua — enak untuk memilih akar pohon.
  const q = query(membersCollection(uid), orderBy('birthYear', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      onChange(
        snapshot.docs.map((d) => {
          const data = d.data() as Omit<FamilyMember, 'id'>;
          return {
            id: d.id,
            ...data,
            nickname: data.nickname ?? '',
            // Data lama belum punya circle/isSelf → anggap keluarga inti, bukan saya.
            circle: data.circle ?? 'inti',
            isSelf: data.isSelf ?? false,
            parentIds: data.parentIds ?? [],
            partnerIds: data.partnerIds ?? [],
            photo: data.photo ?? null,
          };
        }),
      );
    },
    onError,
  );
}

/**
 * Simpan satu anggota. Kalau dia ditandai "saya" (isSelf) dan daftar anggota
 * lain diberikan, penanda "saya" pada anggota lain otomatis dimatikan supaya
 * hanya SATU orang yang jadi "saya" (satu batch, tetap sinkron).
 */
export function saveFamilyMember(
  uid: string,
  member: FamilyMember,
  allMembers?: FamilyMember[],
) {
  const { id, ...data } = member;
  if (member.isSelf && allMembers) {
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', uid, 'familyMembers', id), data);
    for (const m of allMembers) {
      if (m.id !== id && m.isSelf) {
        batch.update(doc(db, 'users', uid, 'familyMembers', m.id), {
          isSelf: false,
        });
      }
    }
    return batch.commit();
  }
  return setDoc(doc(db, 'users', uid, 'familyMembers', id), data);
}

/**
 * Hapus anggota + bersihkan dirinya dari parentIds anak-anaknya
 * (satu batch, biar tidak ada relasi yatim).
 */
export function deleteFamilyMember(
  uid: string,
  id: string,
  members: FamilyMember[],
) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'users', uid, 'familyMembers', id));
  // Bersihkan referensi ke orang ini dari relasi anggota lain (parent/pasangan).
  for (const m of members) {
    const inParents = m.parentIds.includes(id);
    const inPartners = (m.partnerIds ?? []).includes(id);
    if (!inParents && !inPartners) continue;
    const payload: Record<string, string[]> = {};
    if (inParents) payload.parentIds = m.parentIds.filter((p) => p !== id);
    if (inPartners) {
      payload.partnerIds = (m.partnerIds ?? []).filter((p) => p !== id);
    }
    batch.update(doc(db, 'users', uid, 'familyMembers', m.id), payload);
  }
  return batch.commit();
}

/** Id unik anggota baru. */
export function newFamilyId(): string {
  return `f${Date.now().toString(36)}`;
}

// ===================== Relasi (diturunkan) =====================

export function parentsOf(
  m: FamilyMember,
  all: FamilyMember[],
): FamilyMember[] {
  return m.parentIds
    .map((id) => all.find((x) => x.id === id))
    .filter((x): x is FamilyMember => !!x);
}

export function childrenOf(id: string, all: FamilyMember[]): FamilyMember[] {
  return all.filter((m) => m.parentIds.includes(id));
}

/**
 * Pasangan (suami/istri) = gabungan dari:
 *   1. yang ditandai eksplisit sebagai pasangan (2 arah — cek kedua sisi),
 *   2. sesama orang tua dari anak yang sama (otomatis).
 * Disimpan satu arah saja, tapi dibaca dua arah supaya selalu sinkron.
 */
export function partnersOf(id: string, all: FamilyMember[]): FamilyMember[] {
  const self = all.find((m) => m.id === id);
  const ids = new Set<string>();
  // Eksplisit: yang saya tandai, ATAU yang menandai saya.
  self?.partnerIds?.forEach((p) => ids.add(p));
  for (const m of all) {
    if (m.partnerIds?.includes(id)) ids.add(m.id);
  }
  // Otomatis: sesama orang tua dari anak yang sama.
  for (const child of childrenOf(id, all)) {
    for (const p of child.parentIds) {
      if (p !== id) ids.add(p);
    }
  }
  ids.delete(id);
  return [...ids]
    .map((x) => all.find((m) => m.id === x))
    .filter((x): x is FamilyMember => !!x);
}

/**
 * Jumlah generasi di dalam satu himpunan anggota = kedalaman terdalam rantai
 * orang tua→anak + 1. Hanya orang tua yang ADA di himpunan yang dihitung
 * (mis. lewati saudara). Ada penjaga siklus supaya tak pernah loop tak henti.
 */
export function countGenerations(members: FamilyMember[]): number {
  if (members.length === 0) return 0;
  const byId = new Map(members.map((m) => [m.id, m]));
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  function level(id: string): number {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // penjaga siklus
    visiting.add(id);
    const parentLevels = (byId.get(id)?.parentIds ?? [])
      .filter((p) => byId.has(p))
      .map((p) => level(p));
    const lvl = parentLevels.length ? Math.max(...parentLevels) + 1 : 0;
    visiting.delete(id);
    memo.set(id, lvl);
    return lvl;
  }
  let max = 0;
  for (const m of members) max = Math.max(max, level(m.id));
  return max + 1;
}

// ===================== Foto =====================

/**
 * Pilih foto dari galeri lalu kompres SANGAT kecil tapi tetap jelas
 * untuk avatar: crop kotak → 144px → JPEG 50% → base64 (±4–8 KB).
 */
export async function pickCompressedPhoto(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return null;
  const small = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width: 144 } }],
    {
      compress: 0.5,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  return small.base64 ?? null;
}
