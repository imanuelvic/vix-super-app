import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Timeline hidup — versi app dari sheet "TIME LIST 📍" & "Timeline 📋":
// wishlist/target per tahun, bisa ditempel ke bulan tertentu atau jadi
// target tahunan, dengan kategori bidang hidup.
//
// Penyimpanan: SATU dokumen per tahun (users/{uid}/timeline/{year}) berisi
// array item — wishlist setahun itu kecil, jadi 1 read per tahun dibuka.

/** Tanggal lahir pemilik app: 1 Januari 1998 → umur = tahun − 1998. */
export const BIRTH_YEAR = 1998;

export type TimelineCategoryKey =
  | 'future'
  | 'relationship'
  | 'ministry'
  | 'career'
  | 'finance'
  | 'fun';

export const TIMELINE_CATEGORIES: {
  key: TimelineCategoryKey;
  label: string;
  icon: string;
}[] = [
  { key: 'future', label: 'Future Plan', icon: '🎓' },
  { key: 'relationship', label: 'Relationship', icon: '🤝' },
  { key: 'ministry', label: 'Ministry', icon: '🙏' },
  { key: 'career', label: 'Career', icon: '💼' },
  { key: 'finance', label: 'Finance', icon: '💵' },
  { key: 'fun', label: 'Fun & Recreation', icon: '🎢' },
];

export const TIMELINE_CATEGORY_META = Object.fromEntries(
  TIMELINE_CATEGORIES.map((c) => [c.key, c]),
) as Record<TimelineCategoryKey, (typeof TIMELINE_CATEGORIES)[number]>;

export type TimelineItem = {
  id: string;
  title: string;
  category: TimelineCategoryKey;
  month: number | null; // 0–11; null = target tahunan
  done: boolean;
};

export function subscribeTimelineYear(
  uid: string,
  year: number,
  onChange: (items: TimelineItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'timeline', String(year));
  return onSnapshot(
    ref,
    (snapshot) => {
      onChange((snapshot.data()?.items as TimelineItem[]) ?? []);
    },
    onError,
  );
}

/** Simpan seluruh wishlist satu tahun (array kecil, ditulis utuh). */
export function saveTimelineYear(
  uid: string,
  year: number,
  items: TimelineItem[],
) {
  const ref = doc(db, 'users', uid, 'timeline', String(year));
  return setDoc(ref, { items });
}

/** Id unik untuk item baru. */
export function newTimelineId(): string {
  return `t${Date.now().toString(36)}`;
}
