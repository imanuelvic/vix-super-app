import { useEffect, useRef, useState } from 'react';

/**
 * Catatan harian satu fitur AI (jatah terpakai + hasil yang sudah didapat),
 * dibaca dari HP lalu dipegang selama layarnya hidup.
 *
 * Gudangnya ada di lib/aiDay.ts; yang diurus di sini cuma bagian React-nya,
 * dan itu pun karena satu hal yang gampang terlupa saat disalin: catatannya
 * dibaca SECARA ASINKRON, jadi jawabannya bisa datang sesudah layarnya
 * ditutup. Tanpa penjaga `hidup`, yang datang belakangan itu memanggil
 * setState pada layar yang sudah tidak ada. Lima layar menulis penjaga itu
 * sendiri-sendiri; sekarang satu kali.
 *
 * `null` = catatannya belum selesai dibaca. Selama itu, tombol AI-nya harus
 * mati: jatah yang belum diketahui tidak boleh dianggap masih utuh.
 *
 * - `muat` WAJIB fungsi yang stabil (mis. `loadCoachDay` dari modulnya
 *   langsung), bukan panah yang dibuat ulang tiap render. Panah baru tiap
 *   render = efeknya ikut berjalan tiap render. Aturan yang sama berlaku untuk
 *   `onError` di useLive/useLiveAll.
 * - `aktif` untuk layar yang baru perlu membacanya saat dibuka (mis. sheet
 *   Rekomendasi Budget). Selama false, nol pekerjaan.
 *
 * Pembacaan ulang terjadi hanya kalau `dayId`-nya memang BERGANTI (lewat
 * tengah malam), bukan tiap kali `aktif` menyala lagi. Jadi sheet yang ditutup
 * lalu dibuka lagi tidak menimpa catatan yang baru saja didapat dengan isi
 * penyimpanan yang mungkin belum sempat tertulis.
 */
export function useAiDay<T>(
  dayId: string,
  muat: (dayId: string) => Promise<T>,
  aktif = true,
): [T | null, (day: T) => void] {
  const [day, setDay] = useState<T | null>(null);
  // dayId yang catatannya sudah benar-benar dimuat ke `day`.
  const dimuat = useRef<string | null>(null);

  useEffect(() => {
    if (!aktif || dimuat.current === dayId) return;
    let hidup = true;
    muat(dayId).then((d) => {
      if (!hidup) return;
      dimuat.current = dayId;
      setDay(d);
    });
    return () => {
      hidup = false;
    };
  }, [dayId, aktif, muat]);

  return [day, setDay];
}
