import { useCallback, useRef, type RefObject } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';

// Lompat ke baris yang menyalakan badge, begitu daftarnya selesai digambar.
//
// Dipakai semua sub-tab berbadge: badge cuma bilang "ada", dan titik
// berdenyutnya baru menjawab "yang mana" — kalau kebetulan terlihat. Di daftar
// panjang titiknya bisa di layar ketiga, jadi daftarnya yang datang ke titiknya.
//
// Pemicunya MOUNT: konten memang di-mount ulang tiap tab ditekan (`scrollKey`
// di useTabScroll), jadi menekan sub-tab mana pun selalu membawamu ke sana.
//
// DUA isyarat harus sudah tiba: posisi baris tujuan (onLayout) & tinggi isi
// (onContentSizeChange). Urutannya TIDAK bisa diandalkan antar-versi RN, jadi
// keduanya sama-sama memicu percobaan dan percobaannya baru jadi kalau
// dua-duanya ada. Tetap SEKALI per mount: tinggi konten masih bisa berubah
// lagi, dan lompatan kedua terasa seperti layar kabur sendiri.
// Berapa tinggi baris yang harus SUDAH terlihat supaya ia dianggap "kelihatan"
// dan tidak perlu dilompati. Kira-kira setinggi satu kartu daftar.
const CUKUP_TERLIHAT = 72;

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
  // Tinggi jendela ScrollView-nya sendiri (onLayout). Tanpa angka ini, hook
  // ini tidak bisa tahu apakah barisnya memang di luar layar.
  const viewH = useRef(0);

  const tryJump = useCallback(() => {
    if (jumped.current || !dueKey || !sized.current) return;
    const y = rowY.current[dueKey];
    if (y === undefined) return; // barisnya belum terukur — tunggu onLayout-nya
    if (viewH.current === 0) return; // jendelanya belum terukur
    // 28 Sep 2026: lompatannya cuma jalan kalau barisnya memang DI LUAR layar.
    //
    // Dulu ia selalu jalan, termasuk saat baris tujuannya sudah jadi kartu
    // paling atas. Di sub-tab Fulltime akibatnya kelihatan jelas: kartu P1 ada
    // di urutan pertama, tapi di atasnya masih ada pemilih papan, jadi "lompat
    // ke kartu P1" menggeser pemilih papan itu masuk ke balik bar sub-tab dan
    // kartu pertamanya ikut terpotong. Tidak ada yang dibawa ke layar; yang
    // terjadi cuma puncak daftarnya hilang.
    jumped.current = true;
    if (y + CUKUP_TERLIHAT <= viewH.current) return; // sudah kelihatan
    // −8 supaya barisnya tidak mepet ke tepi atas layar.
    ref.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
  }, [dueKey, ref]);

  /** Pasang di ScrollView-nya: onLayout={onLayout} */
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewH.current = e.nativeEvent.layout.height;
      tryJump();
    },
    [tryJump],
  );

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

  return { ref, setRowY, onContentSizeChange, onLayout };
}
