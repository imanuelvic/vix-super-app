import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import {
  doc,
  onSnapshot,
  setDoc,
  type FirestoreError,
  type Timestamp,
} from 'firebase/firestore';

import { Color } from '@/assets/style/color';
import { hashString } from './core';
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
  // Field khusus kategori Race (opsional) — tidak diisi untuk kategori lain.
  price?: number; // biaya pendaftaran (Rp)
  finishMinutes?: number; // waktu tempuh / catatan waktu (menit)
  medalPhoto?: string | null; // foto medali JPEG base64 (tanpa prefix data:)
  // Field khusus kategori Summit (opsional) — rincian anggaran pendakian (Rp).
  // Total tidak disimpan, dihitung otomatis dari komponen (lihat summitTotal).
  costOT?: number; // jasa Open Trip / guide
  costRent?: number; // sewa barang / alat
  costTransport?: number; // transportasi
  costOther?: number; // lain-lain
};

/** Total anggaran pendakian Summit = akumulasi semua komponen biaya. */
export function summitTotal(e: {
  costOT?: number;
  costRent?: number;
  costTransport?: number;
  costOther?: number;
}): number {
  return (
    (e.costOT ?? 0) +
    (e.costRent ?? 0) +
    (e.costTransport ?? 0) +
    (e.costOther ?? 0)
  );
}

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
    detailLabel: 'Ketinggian',
  },
  {
    key: 'race',
    label: 'Race',
    emoji: '🏃',
    bg: Color.FINANCE_EXPENSE,
    fg: Color.FINANCE_EXPENSE_DARK,
    titleLabel: 'Nama race',
    detailLabel: 'Jarak & hasil',
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

// ===================== Foto medali (khusus Race) =====================
/**
 * Pilih foto medali dari galeri lalu kompres kecil supaya hemat: lebar 360px →
 * JPEG 50% → base64 (±15–25 KB). Cukup jelas untuk kenang-kenangan, tapi tetap
 * ringan karena ikut tersimpan di dokumen arsip Fun (yang juga dibaca Home).
 */
export async function pickCompressedMedal(): Promise<string | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (res.canceled || !res.assets[0]) return null;
  const small = await ImageManipulator.manipulateAsync(
    res.assets[0].uri,
    [{ resize: { width: 360 } }],
    {
      compress: 0.5,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  return small.base64 ?? null;
}

// ===================== Reminder "waktunya refreshing" =====================
// Kerja terus tanpa jeda gampang burnout. Kalau sudah lama tidak mengisi
// kegiatan Fun, Home mengingatkan + kasih ide biar tidak bingung mau ngapain.

export const FUN_REMINDER_DAYS = 30;

/** Tanggal kegiatan Fun TERBARU (yang punya tanggal). null kalau belum ada. */
export function lastFunDate(data: FunData): Date | null {
  let latest: number | null = null;
  for (const e of data.entries) {
    if (!e.date) continue;
    const t = e.date.toMillis();
    if (latest === null || t > latest) latest = t;
  }
  return latest === null ? null : new Date(latest);
}

/**
 * Perlu diingatkan refreshing? True kalau kegiatan Fun terakhir sudah lebih
 * dari 30 hari lalu — atau belum pernah mengisi sama sekali.
 */
export function funReminderDue(data: FunData, now: Date): boolean {
  const last = lastFunDate(data);
  if (!last) return data.entries.length === 0; // belum pernah → ajak mulai
  return now.getTime() - last.getTime() > FUN_REMINDER_DAYS * 86_400_000;
}

/** Berapa hari sejak Fun terakhir (null kalau belum pernah). */
export function daysSinceLastFun(data: FunData, now: Date): number | null {
  const last = lastFunDate(data);
  if (!last) return null;
  return Math.floor((now.getTime() - last.getTime()) / 86_400_000);
}

// Ide kegiatan Fun — biar tidak bingung mau ngapain hari ini.
export const FUN_IDEAS: string[] = [
  '⛰️ Cari info & jadwalkan hiking ke gunung terdekat akhir pekan ini.',
  '🏃 Ikut fun run / lari santai 5K — target kecil yang seru.',
  '🏝️ Staycation atau ke pantai sehari — recharge total.',
  '🎬 Nonton film yang lagi hype di bioskop, sendiri atau bareng.',
  '☕ Coba coffee shop baru yang belum pernah kamu datangi.',
  '🚴 Sepedaan pagi keliling kota sebelum panas.',
  '🧘 Waktu hening di tempat tenang — journaling & refleksi.',
  '🍜 Food adventure: cari makanan khas yang belum pernah dicoba.',
  '📸 Jalan sambil foto (street photography) di spot estetik.',
  '🎮 Game night atau board game bareng teman.',
  '🏊 Berenang buat lepas penat sekaligus olahraga ringan.',
  '🌅 Kejar sunrise / sunset di spot bagus — reset pikiran.',
];

/** Beberapa ide Fun untuk hari ini — deterministik, ganti otomatis tiap hari. */
export function funIdeasToday(now: Date, count = 3): string[] {
  const seed = hashString(
    `fun-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`,
  );
  const out: string[] = [];
  for (let i = 0; i < count && i < FUN_IDEAS.length; i++) {
    out.push(FUN_IDEAS[(seed + i * 5) % FUN_IDEAS.length]);
  }
  return out;
}
