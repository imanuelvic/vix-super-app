import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';

// Wheel of Life 🎡 — versi app dari assessment website lama:
// nilai 8 area hidup (1–10) per QUARTAL, lalu pilih minimal 3 area fokus
// dengan target skor + action plan, supaya tetap on track tiap 3 bulan.
//
// Penyimpanan: SATU dokumen per quartal (users/{uid}/wheel/{2026-Q3}).

export type WheelAreaKey =
  | 'spirituality'
  | 'health'
  | 'family'
  | 'finance'
  | 'ministry'
  | 'career'
  | 'relationship'
  | 'fun';

export const WHEEL_AREAS: {
  key: WheelAreaKey;
  label: string;
  icon: string;
  question: string;
}[] = [
  { key: 'spirituality', label: 'Spirituality', icon: '✝️', question: 'Apakah kamu benar-benar mengasihi Tuhan?' },
  { key: 'health', label: 'Health', icon: '🍎', question: 'Apakah kamu peduli terhadap kesehatanmu?' },
  { key: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', question: 'Seberapa penting keluarga bagimu?' },
  { key: 'finance', label: 'Finance', icon: '💵', question: 'Seberapa baik kamu mengelola keuanganmu?' },
  { key: 'ministry', label: 'Ministry', icon: '🙏', question: 'Apakah kamu melayani? Bagaimana kamu menilai pelayananmu?' },
  { key: 'career', label: 'Career', icon: '💼', question: 'Seberapa baik kamu dalam dunia kerja?' },
  { key: 'relationship', label: 'Relationship', icon: '🤝', question: 'Bagaimana hubunganmu dengan orang-orang di sekitarmu?' },
  { key: 'fun', label: 'Fun Recreation', icon: '🎢', question: 'Apakah kamu menikmati hidup? Atau waktumu habis untuk hal yang kurang menyenangkan?' },
];

/** Minimal area fokus per quartal. */
export const MIN_FOCUS = 3;

export type WheelFocus = {
  area: WheelAreaKey;
  targetScore: number; // 1–10
  plan: string; // action plan / tolok ukur keberhasilan
};

export type WheelData = {
  scores: Partial<Record<WheelAreaKey, number>>; // 1–10 per area
  notes: Partial<Record<WheelAreaKey, string>>; // alasan penilaian
  focus: WheelFocus[];
};

// ===================== Quartal =====================

export function quarterOf(d: Date): { year: number; q: number } {
  return { year: d.getFullYear(), q: Math.floor(d.getMonth() / 3) + 1 };
}

/** "2026-Q3" — id dokumen per quartal. */
export function quarterDocId(year: number, q: number): string {
  return `${year}-Q${q}`;
}

export function quarterLabel(year: number, q: number): string {
  return `Q${q} ${year}`;
}

export function shiftQuarter(
  year: number,
  q: number,
  delta: number,
): { year: number; q: number } {
  const total = year * 4 + (q - 1) + delta;
  return { year: Math.floor(total / 4), q: (total % 4) + 1 };
}

// ===================== Firestore =====================

export function subscribeWheel(
  uid: string,
  qid: string,
  onChange: (data: WheelData) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'wheel', qid);
  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.data();
      onChange({
        scores: (data?.scores as WheelData['scores']) ?? {},
        notes: (data?.notes as WheelData['notes']) ?? {},
        focus: (data?.focus as WheelFocus[]) ?? [],
      });
    },
    onError,
  );
}

/** Simpan hasil assessment (skor + alasan). merge: fokus tidak tersentuh. */
export function saveWheelScores(
  uid: string,
  qid: string,
  scores: WheelData['scores'],
  notes: WheelData['notes'],
) {
  const ref = doc(db, 'users', uid, 'wheel', qid);
  return setDoc(ref, { scores, notes }, { merge: true });
}

/** Simpan area fokus quartal ini. merge: skor tidak tersentuh. */
export function saveWheelFocus(uid: string, qid: string, focus: WheelFocus[]) {
  const ref = doc(db, 'users', uid, 'wheel', qid);
  return setDoc(ref, { focus }, { merge: true });
}
