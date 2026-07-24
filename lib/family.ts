import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  writeBatch,
  type FirestoreError,
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

export type FamilyMember = {
  id: string;
  name: string;
  birthYear: number;
  birthMonth: number; // 0–11 seperti Date JS
  birthDay: number;
  deceased: boolean; // ✝ — tampil hitam-putih di pohon
  parentIds: string[]; // maksimal 2
  photo: string | null; // JPEG base64 kecil (tanpa prefix data:)
};

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
            parentIds: data.parentIds ?? [],
            photo: data.photo ?? null,
          };
        }),
      );
    },
    onError,
  );
}

export function saveFamilyMember(uid: string, member: FamilyMember) {
  const { id, ...data } = member;
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
  for (const m of members) {
    if (m.parentIds.includes(id)) {
      batch.update(doc(db, 'users', uid, 'familyMembers', m.id), {
        parentIds: m.parentIds.filter((p) => p !== id),
      });
    }
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

/** Pasangan = sesama orang tua dari anak yang sama (bisa lebih dari satu). */
export function partnersOf(id: string, all: FamilyMember[]): FamilyMember[] {
  const ids = new Set<string>();
  for (const child of childrenOf(id, all)) {
    for (const p of child.parentIds) {
      if (p !== id) ids.add(p);
    }
  }
  return [...ids]
    .map((x) => all.find((m) => m.id === x))
    .filter((x): x is FamilyMember => !!x);
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
