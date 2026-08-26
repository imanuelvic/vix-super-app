import { useState } from 'react';

/**
 * Satu tugas async yang TIDAK BOLEH jalan dobel — cetak PDF, ambil foto dari
 * galeri, dan sejenisnya.
 *
 * Sembilan tempat menulis blok yang sama persis:
 *
 *     if (sharingId) return;              // sedang jalan → abaikan tekanan kedua
 *     setSharingId(m.id);
 *     setError(null);
 *     try { await shareMonthlyPdf(m); }
 *     catch { setError('Gagal … Coba lagi.'); }
 *     finally { setSharingId(null); }
 *
 * Yang gampang salah bukan bagian `try`-nya, tapi `finally`: sekali lupa,
 * penanda sibuknya menyala selamanya — spinner tombolnya berputar terus dan
 * tombol itu mati sampai layarnya ditutup. Di sini penjaga & pemadamnya jadi
 * satu tempat, tak bisa lupa ditulis.
 *
 * `key` menandai BAGIAN MANA yang sedang bekerja, supaya di daftar cuma
 * tombol baris itu yang berputar (`busy === m.id`), bukan semua baris.
 * Untuk layar yang cuma punya satu tombol, pakai nama tetap seperti `'pdf'`
 * atau `'foto'` lalu baca `busy !== null`.
 */
export function useBusyTask<K extends string = string>(): {
  /** Key tugas yang sedang berjalan; `null` = sedang tidak ada. */
  busy: K | null;
  run: (job: {
    key: K;
    /** Pekerjaannya. Kalau melempar error, `fail` yang dipanggil. */
    task: () => Promise<void>;
    /** Dijalankan saat gagal — biasanya menampilkan pesan. */
    fail: () => void;
    /** Dijalankan tepat sebelum mulai — biasanya membersihkan pesan lama. */
    start?: () => void;
  }) => Promise<void>;
} {
  const [busy, setBusy] = useState<K | null>(null);

  async function run({
    key,
    task,
    fail,
    start,
  }: {
    key: K;
    task: () => Promise<void>;
    fail: () => void;
    start?: () => void;
  }) {
    if (busy !== null) return;
    setBusy(key);
    start?.();
    try {
      await task();
    } catch {
      fail();
    } finally {
      setBusy(null);
    }
  }

  return { busy, run };
}
