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
// Posisi tiap baris dicatat lewat onLayout, dan lompatannya dijalankan di
// `onContentSizeChange` — isyarat bahwa seluruh isi sudah terukur. Kalau
// dipanggil lebih awal (mis. di useEffect saat mount) posisinya masih 0 semua
// dan lompatannya meleset ke atas.
export function useDueJump(
  /** Baris yang mau dituju (baris jatuh tempo pertama). null = tidak ada. */
  dueKey: string | null,
  /** Hanya melompat kalau true — biasanya `repress` dari useTabScroll. */
  enabled: boolean,
) {
  const ref = useRef<ScrollView>(null);
  const rowY = useRef<Record<string, number>>({});
  // Sekali saja per mount: tinggi konten bisa berubah lagi (gambar, teks
  // membungkus) dan lompatan kedua akan terasa seperti layar "kabur sendiri".
  const jumped = useRef(false);

  /** Pasang di tiap baris: onLayout={(e) => setRowY(key, e.nativeEvent.layout.y)} */
  const setRowY = useCallback((key: string, y: number) => {
    rowY.current[key] = y;
  }, []);

  const onContentSizeChange = useCallback(() => {
    if (!enabled || jumped.current || !dueKey) return;
    const y = rowY.current[dueKey];
    if (y === undefined) return;
    jumped.current = true;
    // −8 supaya barisnya tidak mepet ke tepi atas layar.
    ref.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [enabled, dueKey]);

  return { ref, setRowY, onContentSizeChange };
}
