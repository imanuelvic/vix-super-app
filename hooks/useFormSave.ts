import { useState } from 'react';

import { SAVE_ERROR } from '@/lib/messages';

/**
 * Keadaan bersama untuk form di dalam sheet/modal: penanda sibuk + pesan gagal,
 * plus pembungkus penyimpanannya.
 *
 * Sembilan belas layar & tab menulis blok yang SAMA PERSIS:
 *
 *     const [formError, setFormError] = useState<string | null>(null);
 *     const [busy, setBusy] = useState(false);
 *     …
 *     async function handleSave() {
 *       if (!user || !editing || busy) return;
 *       if (!fTitle.trim()) { setFormError('Judul wajib diisi.'); return; }
 *       setBusy(true);
 *       setFormError(null);
 *       const data = { … };
 *       try {
 *         await simpan(data);
 *         setEditing(null);        // tutup sheet-nya HANYA kalau berhasil
 *       } catch {
 *         setFormError(SAVE_ERROR);
 *       } finally {
 *         setBusy(false);
 *       }
 *     }
 *
 * Yang paling gampang salah bukan `try`-nya, tapi `finally`: sekali lupa,
 * penanda sibuknya menyala selamanya — tombol Simpan berputar terus & mati
 * sampai layarnya ditutup. Di sini penyalaan, pemadaman, dan bunyi pesan
 * gagalnya jadi satu tempat, tak bisa lupa ditulis maupun berbeda-beda.
 *
 * Pemakaiannya:
 *
 *     const { busy, formError, setFormError, save } = useFormSave();
 *     …
 *     async function handleSave() {
 *       if (!user || !editing || busy) return;
 *       if (!fTitle.trim()) { setFormError('Judul wajib diisi.'); return; }
 *       const data = { … };
 *       await save(async () => {
 *         await simpan(data);
 *         setEditing(null);
 *       });
 *     }
 *
 * Pemeriksaan isian tetap di pemanggilnya — bunyinya beda-beda tiap form, dan
 * memang harus begitu. `save` baru mengambil alih sejak penyimpanan dimulai.
 *
 * Kenapa `setBusy` ikut dikembalikan: tombol 🗑️ Hapus di beberapa layar
 * memakai penanda sibuk yang sama tapi perilakunya BELUM seragam — ada yang
 * menutup sheet-nya hanya kalau berhasil, ada yang selalu menutup, dan ada
 * yang tidak menangkap kegagalan sama sekali (sheet-nya tertutup seolah
 * berhasil padahal datanya masih ada). Menyeragamkannya berarti mengubah
 * perilaku, jadi itu dibiarkan dulu apa adanya di sini.
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
} {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await task();
    } catch {
      setFormError(SAVE_ERROR);
    } finally {
      setBusy(false);
    }
  }

  return { busy, setBusy, formError, setFormError, save };
}
