import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';

import { Color } from '@/assets/style/color';
import { db } from './firebase';

// Fitur Fun & Recreation 🎉 — arsip tempat & pencapaian yang sudah dikunjungi:
// Summit gunung, Race, tempat refleksi, dan tempat rekreasi.
//
// Semua disimpan dalam SATU dokumen kecil: users/{uid}/fun/data — { entries[] }.
// Tiap entri kecil & tanpa foto, jadi cukup 1 listener & hemat baca Firestore
// (1 read untuk seluruh arsip). Menambah/ubah menulis ulang array-nya.
// Path ini otomatis tercakup Security Rules users/{userId}/{document=**}.

export type FunCategory = 'summit' | 'race' | 'reflection' | 'recreation';

export type FunEntry = {
  id: string;
  category: FunCategory;
  title: string; // nama gunung / race / tempat
  place: string; // lokasi (opsional)
  detail: string; // Summit: ketinggian; Race: jarak & hasil; lainnya: kesan
  note: string; // catatan bebas (opsional)
  date: Timestamp | null; // kapan dikunjungi / didaki
};

export type FunData = { entries: FunEntry[] };

export const EMPTY_FUN: FunData = { entries: [] };

export const newFunId = () => `fun${Date.now().toString(36)}`;

// Meta tiap kategori: label, emoji, warna aksen (bg/fg), & label field form
// yang menyesuaikan konteks (mis. "Ketinggian" untuk Summit).
export const FUN_CATEGORIES: {
  key: FunCategory;
  label: string;
  emoji: string;
  bg: string;
  fg: string;
  titleLabel: string;
  detailLabel: string;
}[] = [
  {
    key: 'summit',
    label: 'Summit',
    emoji: '⛰️',
    bg: Color.MAIN_LIGHT,
    fg: Color.MAIN_DARK,
    titleLabel: 'Nama gunung',
    detailLabel: 'Ketinggian (mis. 2.930 mdpl)',
  },
  {
    key: 'race',
    label: 'Race',
    emoji: '🏃',
    bg: Color.FINANCE_EXPENSE,
    fg: Color.FINANCE_EXPENSE_DARK,
    titleLabel: 'Nama race',
    detailLabel: 'Jarak & hasil (mis. 10K · 1:05:20)',
  },
  {
    key: 'reflection',
    label: 'Refleksi',
    emoji: '🧘',
    bg: Color.SPIRITUAL,
    fg: Color.SPIRITUAL_DARK,
    titleLabel: 'Nama tempat',
    detailLabel: 'Kesan / makna (opsional)',
  },
  {
    key: 'recreation',
    label: 'Rekreasi',
    emoji: '🏝️',
    bg: Color.FINANCE_INVESTMENT,
    fg: Color.FINANCE_INVESTMENT_DARK,
    titleLabel: 'Nama tempat',
    detailLabel: 'Jenis / kesan (opsional)',
  },
];

/** Meta kategori — fallback ke Summit kalau key tidak dikenal. */
export function funCategoryMeta(key: FunCategory) {
  return FUN_CATEGORIES.find((c) => c.key === key) ?? FUN_CATEGORIES[0];
}

function funDoc(uid: string) {
  return doc(db, 'users', uid, 'fun', 'data');
}

/** Dengarkan seluruh arsip Fun & Recreation (real-time, 1 dokumen). */
export function subscribeFun(
  uid: string,
  onChange: (data: FunData) => void,
  onError?: (error: FirestoreError) => void,
) {
  return onSnapshot(
    funDoc(uid),
    (snapshot) => {
      onChange(snapshot.exists() ? (snapshot.data() as FunData) : EMPTY_FUN);
    },
    onError,
  );
}

/** Tulis ulang seluruh arsip (dipakai untuk tambah/ubah/hapus entri). */
export function saveFun(uid: string, data: FunData) {
  return setDoc(funDoc(uid), data);
}
