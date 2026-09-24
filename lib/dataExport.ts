import { File, Paths } from 'expo-file-system';
import { collection, getDocs } from 'firebase/firestore';
import * as Sharing from 'expo-sharing';

import { db } from './firebase';
import { encodeTimestamps } from './liveDoc';

// ========================= 📦 Ekspor Data =========================
//
// Satu tombol yang menyalin SELURUH isi `users/{uid}/…` jadi satu berkas JSON,
// lalu menyerahkannya ke share sheet iOS (Files, iCloud, WhatsApp, e-mail).
//
// ── Kenapa fitur ini ada ──────────────────────────────────────────────────
// Di dalam Firestore ini ada NIK, NPWP, paspor, seluruh transaksi keuangan,
// data pribadi belasan CORE Leader, jurnal refleksi harian, Revive
// bertahun-tahun, janji Tuhan, dan timeline hidup. Semuanya di SATU proyek
// dengan SATU akun, dan di app ini semua hapus bersifat PERMANEN.
//
// Sampai sekarang tidak ada satu pun jalan keluar untuk data itu: kalau
// akunnya terkunci, passwordnya hilang, atau ada satu penulisan yang salah,
// tidak ada yang bisa dipulihkan. Berkas ini menutup lubang itu.
//
// ── Biayanya ──────────────────────────────────────────────────────────────
// Sekali ekspor = satu kali baca untuk TIAP dokumen. Itu satu-satunya operasi
// di app ini yang sengaja membaca semuanya sekaligus, jadi jangan dipasang di
// layar yang terbuka sendiri: ia hanya jalan kalau tombolnya di-click. Jumlah
// dokumen yang terbaca ikut dilaporkan supaya angkanya tidak pernah jadi
// misteri. Sebulan sekali lebih dari cukup, dan tetap jauh di bawah jatah
// harian Spark.
//
// ── Bentuk berkasnya ──────────────────────────────────────────────────────
//   { app, version, exportedAt, uid, docCount, collections: { <nama>: {
//       <idDokumen>: { data: {…}, sub?: { <namaSub>: { <id>: {…} } } } } } }
//
// `data` & `sub` selalu dipisah, walau lebih panjang, supaya tidak pernah ada
// pertanyaan "ini kolom dokumen atau nama subkoleksi?" saat dibaca lagi
// bertahun-tahun kemudian, mungkin oleh orang yang bukan pemiliknya.
//
// Timestamp disandikan memakai fungsi yang SAMA dengan cache disk
// (`encodeTimestamps` di lib/liveDoc.ts), bukan salinan sendiri.

/**
 * SEMUA koleksi di bawah `users/{uid}/`.
 *
 * Ditulis tangan, dan memang harus: Firestore dari sisi klien TIDAK bisa
 * mendaftar koleksi apa saja yang dimiliki sebuah dokumen. Jadi daftar ini
 * satu-satunya yang tahu, dan ia disusun dengan memindai setiap pemanggilan
 * `doc(db, 'users', uid, …)` / `collection(db, 'users', uid, …)` di lib/.
 *
 * ⚠️ Menambah fitur dengan koleksi BARU? Tambahkan namanya di sini juga, kalau
 * tidak data fitur itu diam-diam tidak pernah ikut tercadangkan. Suite
 * cek-ekspor.js menjaga daftar ini tetap lengkap.
 */
export const EXPORT_COLLECTIONS: string[] = [
  'app', 'bibleRead', 'bills', 'budgets', 'car', 'carLogs', 'career',
  'checkups', 'core', 'coreMonthly', 'coreRules', 'coreTimeline', 'coreWheel',
  'dataPlans', 'debts', 'diseases', 'donor', 'familyMembers', 'fasting',
  'fitness', 'fitnessDays', 'fun', 'funds', 'gratitude', 'habitDays', 'health',
  'house', 'houseLogs', 'learning', 'multiplications', 'otherTasks', 'priority',
  'promises', 'reading', 'reflectionFeed', 'revive', 'rewards', 'sermons',
  'social', 'tasks', 'timeline', 'tournaments', 'transactions', 'usage',
  'wheel', 'world',
];

/**
 * Koleksi yang dokumennya MASIH punya koleksi lagi di dalamnya.
 *
 * Empat saja, dan semuanya memang disengaja begitu: foto nota dipisah dari
 * tagihannya supaya daftar tagihan tetap ringan dibaca, Timeline & Wheel milik
 * tiap CORE Leader dipisah per tahun/kuartal, dan mutasi Saku dipisah dari
 * saldonya supaya saldonya bisa ditulis atomik.
 */
export const EXPORT_SUBCOLLECTIONS: Record<string, string[]> = {
  bills: ['media'],
  coreTimeline: ['years'],
  coreWheel: ['quarters'],
  funds: ['entries'],
};

export type ExportProgress = {
  /** Koleksi yang sedang dibaca (untuk ditulis di tombol). */
  label: string;
  /** Sudah berapa koleksi beres. */
  done: number;
  total: number;
};

export type ExportResult = {
  /** Isi berkasnya, siap ditulis. */
  json: string;
  /** Berapa dokumen benar-benar terbaca (= berapa read Firestore terpakai). */
  docCount: number;
  /** Koleksi yang ADA isinya. Koleksi kosong tidak dihitung. */
  filledCount: number;
  /** Koleksi yang gagal dibaca, kalau ada. Ekspornya tetap diteruskan. */
  errors: string[];
  /** Perkiraan ukuran berkasnya (byte). */
  bytes: number;
};

type DocEntry = { data: unknown; sub?: Record<string, Record<string, unknown>> };

/** Nama berkas cadangan untuk satu hari, mis. "vix-cadangan-2026-09-24.json". */
export function exportFileName(dayId: string): string {
  return `vix-cadangan-${dayId}.json`;
}

/**
 * Baca seluruh data pemilik jadi satu JSON.
 *
 * Satu koleksi yang gagal (offline di tengah jalan, aturan menolak) TIDAK
 * membatalkan seluruhnya: namanya dicatat di `errors` dan sisanya jalan terus.
 * Cadangan yang kurang satu koleksi masih jauh lebih berguna daripada tidak
 * punya cadangan sama sekali, asal kekurangannya disebutkan dengan jujur.
 */
export async function exportAllData(
  uid: string,
  appVersion: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<ExportResult> {
  const collections: Record<string, Record<string, DocEntry>> = {};
  const errors: string[] = [];
  let docCount = 0;
  let filledCount = 0;

  const total = EXPORT_COLLECTIONS.length;
  for (let i = 0; i < total; i++) {
    const nama = EXPORT_COLLECTIONS[i];
    onProgress?.({ label: nama, done: i, total });
    try {
      const snap = await getDocs(collection(db, 'users', uid, nama));
      if (snap.empty) continue;

      const isi: Record<string, DocEntry> = {};
      for (const d of snap.docs) {
        docCount++;
        const entry: DocEntry = { data: encodeTimestamps(d.data()) };

        for (const namaSub of EXPORT_SUBCOLLECTIONS[nama] ?? []) {
          const subSnap = await getDocs(
            collection(db, 'users', uid, nama, d.id, namaSub),
          );
          if (subSnap.empty) continue;
          const subIsi: Record<string, unknown> = {};
          for (const s of subSnap.docs) {
            docCount++;
            subIsi[s.id] = encodeTimestamps(s.data());
          }
          entry.sub = { ...entry.sub, [namaSub]: subIsi };
        }
        isi[d.id] = entry;
      }
      collections[nama] = isi;
      filledCount++;
    } catch {
      errors.push(nama);
    }
  }
  onProgress?.({ label: 'selesai', done: total, total });

  const json = JSON.stringify(
    {
      app: 'vix-super-app',
      version: appVersion,
      exportedAt: new Date().toISOString(),
      uid,
      docCount,
      // Disebut terang-terangan di dalam berkasnya sendiri, supaya yang
      // membukanya nanti tahu ada yang kurang tanpa harus menghitung.
      missing: errors,
      collections,
    },
    null,
    2,
  );

  return {
    json,
    docCount,
    filledCount,
    errors,
    bytes: json.length,
  };
}

/**
 * Serahkan hasil ekspor ke share sheet iOS.
 *
 * Ditulis ke folder cache, bukan folder dokumen: begitu sudah disimpan ke
 * Files atau iCloud, salinan di dalam app tidak perlu ikut memakan ruang HP
 * selamanya. Pola berkas & share-nya sama dengan `sharePng` di lib/shareImage.
 */
export async function shareExport(
  json: string,
  fileName: string,
): Promise<void> {
  const file = new File(Paths.cache, fileName);
  // Mengekspor dua kali di hari yang sama akan bentrok nama → yang lama dibuang.
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing off');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Simpan cadangan data vix',
    UTI: 'public.json',
  });
}

/** "1,4 MB" / "812 KB" — ukuran berkas yang enak dibaca. */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}
