import { useScrollToTop } from '@react-navigation/native';
import { useCallback, useRef, type RefObject } from 'react';
import { type ScrollView } from 'react-native';

// Satu daftar yang bisa "balik ke paling atas". Dipakai di semua tempat yang
// punya baris pilihan di atas daftarnya — chip kategori Reminder, FilterChips,
// deretan hari di Fitness — plus kelima tab utama di bawah.
//
// Cara pakai:
//   const { ref, toTop } = useScrollTop();
//   <ScrollView ref={ref} …>
//   onPress={() => (sudahAktif ? toTop() : pilih(kunci))}
//
// Dua jalan menuju atas, satu ref:
// 1. `toTop()` — dipanggil sendiri saat tombol yang SEDANG aktif ditekan lagi
//    (tekanan kedua). Ini yang dipakai chip kategori.
// 2. Tab utama (Dashboard · Habits · Home · Profile · System) — `useScrollToTop`
//    bawaan react-navigation memasang pendengar `tabPress` dan hanya bekerja
//    kalau layarnya MEMANG sedang dibuka, jadi persis "tekan tab yang sama lagi
//    → ke atas". Di layar yang bukan anak tab bar (mis. layar fitur), hook itu
//    tidak menemukan tab navigator dan diam saja — jadi aman dipakai di mana pun.
export function useScrollTop() {
  const ref = useRef<ScrollView>(null);

  const toTop = useCallback(() => {
    ref.current?.scrollTo({ y: 0, animated: true });
  }, []);

  useScrollToTop(ref as RefObject<ScrollView>);

  return { ref, toTop };
}
