import { doc, setDoc, type FirestoreError } from 'firebase/firestore';

import { db } from './firebase';
import { dayIdToDate, formatShortDayDate } from './format';
import { liveDoc } from './liveDoc';

// ================= 📦 Kapan terakhir dicadangkan =================
//
// Tombolnya sendiri ada di lib/dataExport.ts. Yang di sini cuma CATATANNYA:
// tanggal ekspor terakhir, dan apakah sudah waktunya diulang.
//
// ── Kenapa dipisah dari lib/dataExport ────────────────────────────────────
// dataExport menarik `expo-file-system` & `expo-sharing` (menulis berkas &
// membuka share sheet). Penagihnya perlu dibaca Today Engine, dan Today Engine
// itu fungsi MURNI yang dijalankan suite tanpa satu pun modul native. Kalau
// catatan tanggalnya menumpang di sana, seluruh mesin Today ikut menyeret dua
// modul native itu hanya demi satu angka hari.
//
// ── Kenapa perlu dicatat sama sekali ──────────────────────────────────────
// Ekspornya dikerjakan SENDIRI: tidak ada server yang menjalankannya otomatis.
// Yang tidak pernah dicatat tanggalnya akan selalu terasa "baru kemarin", dan
// begitu benar-benar dibutuhkan barulah ketahuan cadangan terakhirnya empat
// bulan lalu.
//
// Satu dokumen kecil: users/{uid}/app/backup. Koleksi `app` sudah terdaftar di
// EXPORT_COLLECTIONS, jadi catatan ini pun ikut tercadangkan.

/** Sesudah sekian hari, cadangannya dianggap sudah waktunya diulang. */
export const BACKUP_EVERY_DAYS = 30;

export type BackupInfo = {
  /** "YYYY-MM-DD" ekspor terakhir. Kosong = belum pernah sekali pun. */
  lastDayId: string;
  /** Berapa dokumen ikut di ekspor terakhir itu. */
  docCount: number;
};

export const EMPTY_BACKUP: BackupInfo = { lastDayId: '', docCount: 0 };

export function subscribeBackupInfo(
  uid: string,
  onChange: (info: BackupInfo) => void,
  onError?: (error: FirestoreError) => void,
) {
  return liveDoc(
    doc(db, 'users', uid, 'app', 'backup'),
    (snapshot) => {
      const d = snapshot.data();
      onChange({
        lastDayId: typeof d?.lastDayId === 'string' ? d.lastDayId : '',
        docCount: typeof d?.docCount === 'number' ? d.docCount : 0,
      });
    },
    onError,
  );
}

/** Catat bahwa cadangan hari ini sudah jadi. Dipanggil SESUDAH share sheet. */
export function recordBackup(uid: string, dayId: string, docCount: number) {
  return setDoc(doc(db, 'users', uid, 'app', 'backup'), { lastDayId: dayId, docCount });
}

/** Umur cadangan terakhir dalam hari. null = belum pernah diekspor. */
export function backupAgeDays(info: BackupInfo, todayId: string): number | null {
  if (!info.lastDayId) return null;
  const selisih =
    dayIdToDate(todayId).getTime() - dayIdToDate(info.lastDayId).getTime();
  return Math.max(0, Math.round(selisih / 86_400_000));
}

/**
 * Sudah waktunya dicadangkan lagi?
 *
 * Belum pernah sama sekali JUGA dihitung "sudah waktunya" — justru itu keadaan
 * yang paling berbahaya, dan diam soal itu sama saja membiarkannya.
 */
export function backupDue(info: BackupInfo, todayId: string): boolean {
  const umur = backupAgeDays(info, todayId);
  return umur === null || umur >= BACKUP_EVERY_DAYS;
}

/**
 * Satu baris keadaan cadangan untuk layar System.
 *
 * TANGGALNYA yang ditulis duluan, bukan cuma "30 hari lalu": tanggal bisa
 * dicocokkan dengan berkas yang benar-benar ada di Files, angka hari tidak.
 */
export function backupLine(info: BackupInfo, todayId: string): string {
  const umur = backupAgeDays(info, todayId);
  if (umur === null) return '📦 Belum pernah diekspor';
  const kapan =
    umur === 0 ? 'hari ini' : umur === 1 ? 'kemarin' : `${umur} hari lalu`;
  const tanggal = formatShortDayDate(dayIdToDate(info.lastDayId));
  return `📦 Terakhir diekspor\n${tanggal} (${kapan}) · ${info.docCount} dokumen`;
}

/** Ajakan mencadangkan lagi — dipakai kartu System & baris Today. */
export function backupDueLine(info: BackupInfo, todayId: string): string {
  const umur = backupAgeDays(info, todayId);
  return umur === null
    ? 'Datamu belum pernah dicadangkan. Semua hapus di app ini permanen, jadi berkas itu satu-satunya jalan pulang.'
    : `Cadangan terakhir ${umur} hari lalu. Waktunya ekspor lagi ya.`;
}
