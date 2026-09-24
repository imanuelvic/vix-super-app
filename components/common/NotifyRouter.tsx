import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { todayHref } from '@/components/today/todayLink';
import { langgananTap, tapTerakhir } from '@/lib/notify';

// 📳 Notifikasi di-click → layar yang memang sedang dibicarakan.
//
// Tidak menggambar apa pun. Ia cuma duduk di atas seluruh layar (dipasang di
// app/_layout.tsx, sebelah MorningJourneyGate) dan mendengarkan dua hal:
//   1. notifikasi yang di-click SELAGI app hidup,
//   2. notifikasi yang membuka app ini dari keadaan mati.
//
// Tujuannya tidak dihitung di sini: ia sudah dititipkan di notifikasinya saat
// dijadwalkan (lib/notify.ts), dan bentuknya sama persis dengan href baris
// Today — jadi click notifikasi & click barisnya di dalam app selalu mendarat
// di layar yang sama, lengkap dengan sub-tab dan isian yang mau dibuka.
//
// Di Expo Go / build lama (modul native belum ada) keduanya diam: `langgananTap`
// mengembalikan pelepas kosong dan `tapTerakhir` mengembalikan null.
export function NotifyRouter() {
  const router = useRouter();

  useEffect(() => {
    let hidup = true;
    // navigate, bukan push: kalau layarnya sudah terbuka, ia tidak ditumpuk
    // dua kali (tombol kembali tetap masuk akal).
    const pergi = (tujuan: Parameters<typeof todayHref>[0]) => {
      if (hidup) router.navigate(todayHref(tujuan));
    };
    (async () => {
      const tujuan = await tapTerakhir();
      if (tujuan) pergi(tujuan);
    })();
    const lepas = langgananTap(pergi);
    return () => {
      hidup = false;
      lepas();
    };
  }, [router]);

  return null;
}
