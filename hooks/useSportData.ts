import { useEffect, useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { LOAD_ERROR } from '@/lib/messages';
import { EMPTY_SPORT, subscribeSport, type SportData } from '@/lib/sport';

/**
 * Langganan dokumen Fun Sport (anggota + sesi + kas) — dipakai TIGA layar:
 * Kas Tim 💰, Jadwal Main 📅, dan rincian satu sesi ⚽.
 *
 * Ketiganya dulu menulis blok yang sama persis, dan yang paling gampang beda
 * sendiri bukan langganannya, tapi PERILAKU SAAT GAGAL: jatuh ke `EMPTY_SPORT`
 * (bukan dibiarkan `null`) supaya layarnya berhenti memutar spinner selamanya
 * dan menampilkan pesan galat di atas daftar kosong — bukan layar abu-abu tanpa
 * keterangan apa pun.
 *
 * Dua bentuk data yang dikembalikan, dan bedanya penting:
 *   • `data` — `null` selama BELUM ada jawaban. Ini yang dipakai memutuskan
 *     kapan <LoadingCenter /> tampil.
 *   • `isi`  — sama, tapi `null` sudah diganti dokumen kosong. Ini yang dipakai
 *     menghitung & menggambar, jadi tak ada `?.` bertebaran di seluruh layar.
 *
 * `setError` ikut dikembalikan karena layar rincian sesi memakai kotak galat
 * yang sama untuk kegagalan MENYIMPAN (SAVE_ERROR), bukan cuma memuat.
 */
export function useSportData(): {
  data: SportData | null;
  isi: SportData;
  error: string | null;
  setError: (value: string | null) => void;
} {
  const { user } = useAuth();
  const [data, setData] = useState<SportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeSport(user.uid, setData, () => {
      setData(EMPTY_SPORT);
      setError(LOAD_ERROR);
    });
  }, [user]);

  return { data, isi: data ?? EMPTY_SPORT, error, setError };
}
