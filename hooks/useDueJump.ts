import { useCallback, useRef, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

// Lompat ke baris yang menyalakan badge, begitu daftarnya selesai digambar.
//
// Dipakai SEMUA sub-tab berbadge. Badge merah di tab bar cuma bilang "ada",
// dan titik berdenyut (AttentionMark) baru menjawab "yang mana" — tapi hanya
// kalau barisnya kebetulan terlihat. Di daftar panjang (Car → Parts 20 baris,
// Stuff 61 barang) titiknya bisa ada di layar ketiga, dan kamu tetap harus
// menggulung sambil menebak. Jadi begitu sub-tabnya dibuka, daftarnya sendiri
// yang datang ke titiknya.
//
// Pemicunya MOUNT: konten memang di-mount ulang tiap tab ditekan (lihat
// `scrollKey` di components/common/useTabScroll.ts), jadi tidak perlu isyarat
// tambahan — menekan sub-tab mana pun, termasuk yang sedang aktif, selalu
// membawamu ke sana.
//
// Dulu ini bergantung `repress` (tekanan KEDUA pada tab yang sudah aktif).
// Syarat itu dibuang: yang tahu bahwa "tekan sekali lagi" akan melompat cuma
// yang menulis kodenya, dan untuk semua orang lain tombolnya sekadar terasa
// tidak melakukan apa-apa.
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
  /** Baris yang mau dituju (baris bertanda pertama). null = tidak ada. */
  dueKey: string | null,
  /**
   * ScrollView yang sudah punya ref sendiri (mis. dari `useScrollTop`).
   * Dioper ke sini supaya satu ScrollView tidak perlu dua ref — React cuma
   * memberi satu, dan menumpuknya lewat callback ref bikin dua hook saling
   * menimpa diam-diam.
   */
  external?: RefObject<ScrollView | null>,
) {
  const own = useRef<ScrollView>(null);
  const ref = external ?? own;
  const rowY = useRef<Record<string, number>>({});
  // Isi ScrollView sudah terukur? Sebelum ini scrollTo bakal dipangkas ke
  // tinggi konten yang masih kecil — melompatnya jadi meleset ke atas.
  const sized = useRef(false);
  const jumped = useRef(false);

  const tryJump = useCallback(() => {
    if (jumped.current || !dueKey || !sized.current) return;
    const y = rowY.current[dueKey];
    if (y === undefined) return; // barisnya belum terukur — tunggu onLayout-nya
    jumped.current = true;
    // −8 supaya barisnya tidak mepet ke tepi atas layar.
    ref.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [dueKey, ref]);

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
