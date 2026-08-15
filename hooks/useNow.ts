import { useEffect, useState } from 'react';

import { dayDocId } from '@/lib/health';

/**
 * Jam berjalan yang di-segarkan tiap MENIT, plus id hari ini ("YYYY-MM-DD")
 * yang diturunkan darinya.
 *
 * Dipakai layar-layar yang isinya bergantung waktu (Home, Dashboard, Habits,
 * Health, tab bar) supaya tidak menyalin blok `setInterval` yang sama.
 *
 * Kenapa `todayId` HARUS diturunkan dari `now`, bukan `new Date()` lepas:
 * lewat tengah malam id-nya ikut berganti, sehingga listener Firestore yang
 * memakainya sebagai dependency otomatis pindah ke dokumen hari BARU — ceklis
 * kebiasaan, air putih, dan catatan harian kembali kosong sendiri walau app
 * dibiarkan terbuka semalaman.
 */
export function useNow(): { now: Date; todayId: string } {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return { now, todayId: dayDocId(now) };
}
