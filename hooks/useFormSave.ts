import { useState } from 'react';

import { DELETE_ERROR, SAVE_ERROR } from '@/lib/messages';

/**
 * Keadaan bersama form di dalam sheet: penanda sibuk + pesan gagal, plus
 * pembungkus penyimpanannya. Dipakai 19 layar & tab.
 *
 * Yang paling gampang salah bukan `try`-nya tapi `finally`: sekali lupa,
 * penanda sibuknya menyala selamanya — tombol Simpan berputar terus & mati
 * sampai layarnya ditutup.
 *
 *     const { busy, formError, setFormError, save } = useFormSave();
 *     await save(async () => { await simpan(data); setEditing(null); });
 */
export function useFormSave(): {
  /** true = penyimpanan sedang berjalan (tombolnya berputar & mati). */
  busy: boolean;
  setBusy: (value: boolean) => void;
  /** Pesan gagal di dalam form; `null` = tidak ada. */
  formError: string | null;
  setFormError: (message: string | null) => void;
  /**
   * Jalankan penyimpanannya. Selama berjalan `busy` menyala, pesan lama
   * dibersihkan, dan apa pun hasilnya `busy` pasti padam lagi.
   *
   * Kalau `task` melempar, pesannya jadi `SAVE_ERROR` — dan `task` TIDAK
   * sampai selesai, jadi taruh `setEditing(null)` di dalamnya kalau sheet-nya
   * memang hanya boleh tertutup saat berhasil.
   */
  save: (task: () => Promise<void>) => Promise<void>;
  /**
   * Sama persis dengan `save`, HANYA bunyi pesan gagalnya yang beda:
   * "Gagal menghapus" (DELETE_ERROR), bukan "Gagal menyimpan".
   *
   * Dipisah karena tombol 🗑️ yang memakai `save` akan berkata "Gagal
   * menyimpan" saat penghapusannya gagal — kalimat yang menunjuk perbuatan
   * yang tidak sedang kamu lakukan, jadi kamu mengira isianmu yang hilang
   * padahal barangnya yang masih ada.
   */
  remove: (task: () => Promise<void>) => Promise<void>;
} {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function jalankan(task: () => Promise<void>, gagal: string) {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await task();
    } catch {
      setFormError(gagal);
    } finally {
      setBusy(false);
    }
  }

  const save = (task: () => Promise<void>) => jalankan(task, SAVE_ERROR);
  const remove = (task: () => Promise<void>) => jalankan(task, DELETE_ERROR);

  return { busy, setBusy, formError, setFormError, save, remove };
}
