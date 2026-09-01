import {
  collection,
  doc,
  getDocs,
  setDoc,
  type FirestoreError,
} from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import { WHEEL_AREAS, type WheelAreaKey } from './wheel';

// Timeline hidup — versi app dari sheet "TIME LIST 📍" & "Timeline 📋":
// wishlist/target per tahun, bisa ditempel ke bulan tertentu atau jadi
// target tahunan, dengan kategori bidang hidup.
//
// Penyimpanan: SATU dokumen per tahun (users/{uid}/timeline/{year}) berisi
// array item — wishlist setahun itu kecil, jadi 1 read per tahun dibuka.

/** Tanggal lahir pemilik app: 1 Januari 1998 → umur = tahun − 1998. */
export const BIRTH_YEAR = 1998;

/**
 * Kategori wishlist = KEDELAPAN area Wheel of Life, ditambah "Future Plan".
 *
 * Dulu cuma enam, dan tiga area hidup (Spirituality, Health, Family) tidak
 * punya tempat sama sekali — padahal justru di situ banyak kerinduan tinggal.
 * Sekarang daftarnya diambil langsung dari WHEEL_AREAS, jadi mustahil meleset
 * dari roda: menambah area di sana otomatis muncul di sini.
 *
 * "Future Plan" TETAP ada di ekornya. Ia bukan area Wheel of Life, tapi
 * wishlist lama sudah memakainya — membuangnya akan membuat item-item itu
 * kehilangan nama & ikonnya.
 */
export type TimelineCategoryKey = WheelAreaKey | 'future';

export const TIMELINE_CATEGORIES: {
  key: TimelineCategoryKey;
  label: string;
  icon: string;
}[] = [
  ...WHEEL_AREAS.map(({ key, label, icon }) => ({ key, label, icon })),
  { key: 'future', label: 'Future Plan', icon: '🎓' },
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

/**
 * Timeline ini punya SIAPA.
 *
 * `null`/tak diisi = punyaku sendiri (users/{uid}/timeline/{year}) — persis
 * seperti sebelumnya, jadi wishlist yang sudah tersimpan tetap di tempatnya.
 *
 * Diisi id CORE Leader = timeline CL itu, disimpan terpisah di
 * users/{uid}/coreTimeline/{leaderId}/years/{year}. Bentuknya sengaja sama
 * persis dengan `coreWheel` (lihat lib/wheel.ts): tetap di dalam data pemilik
 * app — aturan Firestore `users/{uid}/**` sudah menutupinya — tapi satu CL
 * satu cabang sendiri, jadi mustahil tercampur dengan wishlist-ku.
 */
export type TimelineOwner = string | null | undefined;

function timelineRef(uid: string, year: number, owner: TimelineOwner) {
  return owner
    ? doc(db, 'users', uid, 'coreTimeline', owner, 'years', String(year))
    : doc(db, 'users', uid, 'timeline', String(year));
}

export function subscribeTimelineYear(
  uid: string,
  year: number,
  onChange: (items: TimelineItem[]) => void,
  onError?: (error: FirestoreError) => void,
  owner?: TimelineOwner,
) {
  return liveDoc(
    timelineRef(uid, year, owner),
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
  owner?: TimelineOwner,
) {
  return setDoc(timelineRef(uid, year, owner), { items });
}

/** Id unik untuk item baru. */
export function newTimelineId(): string {
  return `t${Date.now().toString(36)}`;
}

// ============ Rekap & PDF: SELURUH tahun sekaligus ============
// Layarnya bekerja per tahun (1 dokumen = 1 read), dan itu memang benar untuk
// dipakai sehari-hari. Tapi rekap & PDF harus melihat semuanya sekaligus —
// yang sudah berlalu maupun yang akan datang.

/** Satu tahun beserta isinya. */
export type TimelineYear = { year: number; items: TimelineItem[] };

function timelineCollection(uid: string, owner: TimelineOwner) {
  return owner
    ? collection(db, 'users', uid, 'coreTimeline', owner, 'years')
    : collection(db, 'users', uid, 'timeline');
}

/**
 * Ambil SEMUA tahun milik satu orang — sekali jalan, bukan langganan.
 *
 * Murah: satu dokumen per TAHUN, jadi isinya sebanyak tahun yang pernah kamu
 * isi (hari ini segelintir), bukan sebanyak wishlist-nya.
 *
 * Tahun tanpa isi dibuang & hasilnya urut menaik — rekap dan PDF sama-sama
 * membacanya sebagai garis waktu, jadi urutannya diputuskan di sini sekali
 * saja, bukan di dua tempat.
 */
export async function fetchTimelineAll(
  uid: string,
  owner?: TimelineOwner,
): Promise<TimelineYear[]> {
  const snapshot = await getDocs(timelineCollection(uid, owner));
  return snapshot.docs
    .map((d) => ({
      year: Number(d.id),
      items: (d.data()?.items as TimelineItem[]) ?? [],
    }))
    .filter((t) => Number.isFinite(t.year) && t.items.length > 0)
    .sort((a, b) => a.year - b.year);
}

/** Jumlah wishlist & yang sudah tercapai dari seluruh tahun. */
export function timelineTotals(years: TimelineYear[]): {
  total: number;
  done: number;
} {
  const semua = years.flatMap((y) => y.items);
  return { total: semua.length, done: semua.filter((i) => i.done).length };
}

/**
 * Pecah satu tahun jadi kelompok-kelompok yang punya isi, urut waktu:
 * target tahunan dulu (`month: null`), baru Januari → Desember.
 *
 * Bulan kosong TIDAK ikut — di garis waktu, bulan tanpa wishlist cuma jadi
 * titik kosong yang memanjangkan halaman tanpa menceritakan apa pun.
 */
export function timelineGroups(
  items: TimelineItem[],
): { month: number | null; items: TimelineItem[] }[] {
  const kelompok: { month: number | null; items: TimelineItem[] }[] = [];
  const tahunan = items.filter((i) => i.month === null);
  if (tahunan.length > 0) kelompok.push({ month: null, items: tahunan });
  for (let m = 0; m < 12; m++) {
    const isi = items.filter((i) => i.month === m);
    if (isi.length > 0) kelompok.push({ month: m, items: isi });
  }
  return kelompok;
}
