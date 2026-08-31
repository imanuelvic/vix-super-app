import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate, formatMonthsDays } from './format';
import { liveDoc } from './liveDoc';

// Stuff 📦 — daftar barang milik sendiri, versi app dari spreadsheet
// "My Stuff": apa yang kamu punya, dibeli kapan, harganya berapa, di mana
// taruhnya, dan masih layak atau sudah dibuang.
//
// Gunanya bukan sekadar mencatat. Tiga pertanyaan yang tidak bisa dijawab
// ingatan sendiri:
//   • "barang ini sudah kupakai berapa lama?"  → menilai layak beli ulang atau
//     tidak, dan itulah kolom terakhir di spreadsheet aslinya
//   • "garansinya masih berlaku?"               → sebelum telanjur beli baru
//   • "totalnya berapa?"                        → nilai barang yang dimiliki
//
// SATU dokumen berisi array, bukan satu dokumen per barang: 68 barang × ±200
// byte masih jauh di bawah batas 1 MB, sekali baca, dan urutannya ikut apa
// adanya. Kalau nanti tembus ratusan barang, barulah pindah ke koleksi.

export type StuffCondition = 'good' | 'problematic' | 'broken' | 'dispose';

export const STUFF_CONDITIONS: {
  key: StuffCondition;
  label: string;
  emoji: string;
}[] = [
  { key: 'good', label: 'Baik', emoji: '🟢' },
  { key: 'problematic', label: 'Bermasalah', emoji: '🟡' },
  { key: 'broken', label: 'Rusak', emoji: '🔴' },
  { key: 'dispose', label: 'Sudah dibuang', emoji: '⚫' },
];

export function conditionMeta(key: StuffCondition) {
  return STUFF_CONDITIONS.find((c) => c.key === key) ?? STUFF_CONDITIONS[0];
}

/** Kategori barang — sama persis dengan kolom Category di spreadsheet. */
export const STUFF_CATEGORIES = [
  'Electronics',
  'Clothing & Accessories',
  'Outdoor & Sports',
  'Furniture',
  'Kitchenware',
  'Office Supplies',
  'Bags & Luggage',
  'Appliances',
  'Tools & Hardware',
  'Personal Care',
  'Health & Wellness',
  'Cleaning Supplies',
  'Emergency Supplies',
  'Gardening Supplies',
];

/** Tempat menaruhnya — kolom Location. */
export const STUFF_LOCATIONS = [
  'Bedroom 1',
  'Bedroom 2',
  'Living Room',
  'Dining Room',
  'Kitchen',
  'Bathroom',
  'Balcony',
  'Office',
  'Car',
];

export type StuffItem = {
  id: string;
  name: string;
  category: string;
  brand: string;
  location: string;
  /** Tanggal beli "YYYY-MM-DD"; kosong = tidak diingat. */
  buyDay: string;
  price: number;
  /** Beli di mana — Shopee, Tokopedia, nama tokonya. */
  store: string;
  /** Warna/ukuran/varian — kolom Description. */
  note: string;
  condition: StuffCondition;
  /** Garansi sampai kapan; kosong = tidak ada/tidak dicatat. */
  warrantyDay: string;
  /** Tanggal dibuang/dilepas; kosong = MASIH dimiliki. */
  goneDay: string;
};

export const EMPTY_STUFF: Omit<StuffItem, 'id'> = {
  name: '',
  category: STUFF_CATEGORIES[0],
  brand: '',
  location: STUFF_LOCATIONS[0],
  buyDay: '',
  price: 0,
  store: '',
  note: '',
  condition: 'good',
  warrantyDay: '',
  goneDay: '',
};

/** Barang yang MASIH dimiliki — yang sudah dibuang tidak ikut dihitung. */
export function stuffOwned(items: StuffItem[]): StuffItem[] {
  return items.filter((i) => !i.goneDay);
}

/** Total harga beli barang yang masih dimiliki. */
export function stuffTotalValue(items: StuffItem[]): number {
  return stuffOwned(items).reduce((sum, i) => sum + i.price, 0);
}

/**
 * Sudah dipakai berapa lama — kolom "Duration of Use" di spreadsheet.
 *
 * Barang yang sudah dibuang dihitung sampai TANGGAL DIBUANGNYA, bukan sampai
 * hari ini: yang ingin diketahui "kemarin awet berapa lama", bukan "sudah
 * berapa lama sejak dibeli".
 */
export function stuffUseLabel(item: StuffItem, now: Date): string | null {
  if (!item.buyDay) return null;
  const dari = dayIdToDate(item.buyDay);
  const sampai = item.goneDay ? dayIdToDate(item.goneDay) : now;
  return formatMonthsDays(dari, sampai);
}

/**
 * Sisa hari garansi. null = tidak ada garansi tercatat, negatif = sudah lewat.
 */
export function stuffWarrantyDays(item: StuffItem, now: Date): number | null {
  if (!item.warrantyDay) return null;
  const sampai = dayIdToDate(item.warrantyDay);
  return Math.round(
    (new Date(sampai.getFullYear(), sampai.getMonth(), sampai.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000,
  );
}

/** Berapa barang yang garansinya MASIH berlaku — angka badge sub-tab. */
export function stuffUnderWarranty(items: StuffItem[], now: Date): number {
  return stuffOwned(items).filter((i) => {
    const sisa = stuffWarrantyDays(i, now);
    return sisa !== null && sisa >= 0;
  }).length;
}

/** Id barang baru — jam + acak, cukup unik untuk daftar sepanjang ini. */
export function newStuffId(now: Date): string {
  return `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Urutan tampil: yang MASIH dimiliki dulu (terbaru dibeli di atas), lalu yang
 * sudah dibuang di bawahnya. Barang yang sudah tidak ada tak perlu ikut
 * memenuhi layar, tapi juga tidak dihapus — riwayatnya justru yang menjawab
 * "merek ini dulu awet berapa lama?".
 */
export function sortStuff(items: StuffItem[]): StuffItem[] {
  return [...items].sort((a, b) => {
    const adaA = a.goneDay ? 1 : 0;
    const adaB = b.goneDay ? 1 : 0;
    if (adaA !== adaB) return adaA - adaB;
    return (b.buyDay || '').localeCompare(a.buyDay || '');
  });
}

export function subscribeStuff(
  uid: string,
  onChange: (items: StuffItem[]) => void,
  onError?: (error: FirestoreError) => void,
) {
  const ref = doc(db, 'users', uid, 'app', 'stuff');
  return liveDoc(
    ref,
    (snapshot) => {
      const data = snapshot.data() as { items?: StuffItem[] } | undefined;
      onChange(data?.items ?? []);
    },
    onError,
  );
}

export function saveStuff(uid: string, items: StuffItem[]) {
  return setDoc(doc(db, 'users', uid, 'app', 'stuff'), { items });
}
