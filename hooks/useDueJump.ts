import { useCallback, useRef } from 'react';
import type { ScrollView } from 'react-native';

// Lompat ke baris yang JATUH TEMPO begitu daftarnya selesai digambar.
//
// Dipakai daftar bertenggat yang tab-nya berbadge (Car → Parts, Residence →
// Maintenance, Pinjaman): menekan sub-tab yang sedang aktif LAGI = "bawa aku
// ke yang harus dikerjakan sekarang", tidak perlu menggulung sendiri mencari
// baris merah di tengah daftar panjang.
//
// Polanya sama dengan tab sesi di Habits (loncat ke kebiasaan pertama yang
// belum dicentang), cuma di sini pemicunya mount: konten memang di-mount ulang
// tiap tab ditekan (lihat `scrollKey` di components/common/useTabScroll.ts),
// jadi `enabled` cukup dibaca sekali saat itu.
//
// DUA hal harus sudah diketahui sebelum melompat:
//   1. posisi baris tujuannya (dari onLayout tiap baris), dan
//   2. tinggi seluruh isi ScrollView (dari onContentSizeChange).
//
// Yang mana duluan TIDAK bisa diandalkan — urutan kejadian layout berbeda-beda
// antar versi & arsitektur React Native. Dulu lompatannya cuma dicoba di
// onContentSizeChange; kalau isi terukur lebih dulu daripada barisnya (persis
// yang terjadi di iPhone), posisi barisnya masih kosong, percobaannya batal,
// dan tidak ada percobaan kedua — jadi tombolnya terasa tidak melakukan apa-apa.
//
// Sekarang kedua isyarat itu sama-sama memicu percobaan, dan percobaannya baru
// jadi kalau dua-duanya sudah ada. Urutan mana pun, hasilnya sama.
//
// Tetap SEKALI saja per mount: tinggi konten bisa berubah lagi (teks
// membungkus, gambar termuat) dan lompatan kedua akan terasa seperti layar
// "kabur sendiri".
export function useDueJump(
  /** Baris yang mau dituju (baris jatuh tempo pertama). null = tidak ada. */
  dueKey: string | null,
  /** Hanya melompat kalau true — biasanya `repress` dari useTabScroll. */
  enabled: boolean,
) {
  const ref = useRef<ScrollView>(null);
  const rowY = useRef<Record<string, number>>({});
  // Isi ScrollView sudah terukur? Sebelum ini scrollTo bakal dipangkas ke
  // tinggi konten yang masih kecil — melompatnya jadi meleset ke atas.
  const sized = useRef(false);
  const jumped = useRef(false);

  const tryJump = useCallback(() => {
    if (!enabled || jumped.current || !dueKey || !sized.current) return;
    const y = rowY.current[dueKey];
    if (y === undefined) return; // barisnya belum terukur — tunggu onLayout-nya
    jumped.current = true;
    // −8 supaya barisnya tidak mepet ke tepi atas layar.
    ref.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [enabled, dueKey]);

  /** Pasang di tiap baris: onLayout={(e) => setRowY(key, e.nativeEvent.layout.y)} */
  const setRowY = useCallback(
    (key: string, y: number) => {
      rowY.current[key] = y;
      if (key === dueKey) tryJump();
    },
    [dueKey, tryJump],
  );

  const onContentSizeChange = useCallback(() => {
    sized.current = true;
    tryJump();
  }, [tryJump]);

  return { ref, setRowY, onContentSizeChange };
}
