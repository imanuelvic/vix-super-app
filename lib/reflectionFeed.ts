import { doc, serverTimestamp, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { liveDoc } from './liveDoc';
import {
  ARCHIVE_NAME,
  layoutText,
  type TextLayout,
  type TextStep,
} from './shareImage';

// Daily Reflection Journal 📓 → gambar Instagram FEED
//
// Refleksi harian yang kamu tulis di Habits diubah jadi selembar gambar 4:5
// (1080×1350) bertanda `vixtory.archive`, lalu bisa disimpan atau dibagikan.
//
// Rupa/warna, nomor arsip, pemenggal baris, & cara menyimpan-membagikannya
// DIPAKAI BERSAMA dengan Story ayat Alkitab 📖 — semuanya tinggal di
// lib/shareImage.ts (termasuk alasan kenapa gambarnya dibuat di HP, bukan AI).
// Yang di berkas ini cuma yang khas Feed: ukuran 4:5 & tata letaknya.
//
// ── Kenapa bukan template kutipan ─────────────────────────────────────────
// Tulisannya rata KIRI, bukan di tengah, dan diberi kop kecil + nomor arsip.
// Rata tengah + tanda kutip besar itu bahasa visual "quote card"; rata kiri
// dengan nomor arsip terbaca sebagai halaman jurnal — persis yang dituju.

/** Ukuran Feed Instagram potret — 4:5. */
export const FEED_W = 1080;
export const FEED_H = 1350;

// Nama lamanya dipertahankan supaya layar & kartu yang sudah ada tidak perlu
// ikut diubah — isinya kini satu sumber dengan Story ayat Alkitab.
export {
  ARCHIVE_NAME,
  archiveNo,
  designOf,
  wrapLines,
  SHARE_DESIGNS as FEED_DESIGNS,
  sharePng as shareFeedPng,
  type ShareDesign as FeedDesign,
} from './shareImage';

// ===================== Menata teksnya =====================

/** Hasil penataan teks, siap digambar ke SVG. */
export type FeedLayout = TextLayout;

/** Tepi kiri-kanan tulisan (px). Lebar tulisan = 1080 − 2×96 = 888. */
export const FEED_MARGIN = 96;

/** Batas atas & bawah badan tulisan — di antara garis kop & garis kaki. */
const BODY_TOP = 300;
const BODY_BOTTOM = 1120;

// Ukuran huruf menyesuaikan panjang refleksi: makin panjang, makin kecil,
// supaya SELALU muat tanpa pernah terpotong. `maxChars` dihitung dari lebar
// 888 px dibagi lebar rata-rata huruf Inter (±0,52 × ukuran huruf).
const FEED_STEPS: TextStep[] = [
  { maxChars: 22, fontSize: 76, perLine: 108 },
  { maxChars: 26, fontSize: 64, perLine: 92 },
  { maxChars: 31, fontSize: 54, perLine: 78 },
  { maxChars: 38, fontSize: 44, perLine: 64 },
  { maxChars: 47, fontSize: 36, perLine: 53 },
  { maxChars: 56, fontSize: 30, perLine: 45 },
];

/** Tata refleksi jadi baris + ukuran huruf yang pas di badan kartu 4:5. */
export function layoutFeed(text: string): FeedLayout {
  return layoutText(text, FEED_STEPS, BODY_TOP, BODY_BOTTOM);
}

export { lineY } from './shareImage';

// ===================== Menyimpan & membagikan =====================

/** Nama berkas yang enak dibaca di Foto/Files. */
export function feedFileName(dayId: string): string {
  return `${ARCHIVE_NAME} ${dayId}.png`;
}

// ===================== Sudah dibuat hari ini? =====================
// Tombol "Generate Feed" di Home harus TETAP ADA sampai feed hari itu benar
// dibuat — jadi keadaannya perlu diingat, bukan sekadar disembunyikan sesaat.
//
// Satu dokumen mungil per hari: users/{uid}/reflectionFeed/{YYYY-MM-DD}
// Hari baru = dokumen baru yang belum ada → tombolnya muncul lagi sendiri,
// tanpa perlu tugas latar apa pun untuk mengosongkannya.

function feedRef(uid: string, dayId: string) {
  return doc(db, 'users', uid, 'reflectionFeed', dayId);
}

export function subscribeFeedGenerated(
  uid: string,
  dayId: string,
  onChange: (generated: boolean) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    feedRef(uid, dayId),
    (snapshot) => onChange(snapshot.data()?.generated === true),
    onError,
  );
}

/** Tandai feed hari ini sudah dibuat — dipanggil SESUDAH gambarnya jadi. */
export function markFeedGenerated(uid: string, dayId: string) {
  return setDoc(feedRef(uid, dayId), {
    generated: true,
    at: serverTimestamp(),
  });
}
