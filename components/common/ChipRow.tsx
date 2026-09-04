import { Children, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

// Satu baris chip yang bisa digeser ke samping — kategori Reminder, sumber
// News, pemilih kreator Fun, saringan Riwayat, kelompok topik Diskusi.
// Semuanya dulu menulis `<ScrollView horizontal>`-nya sendiri.
//
// SATU bentuk saja: chip yang benar itu KOTAKNYA yang mengikuti hurufnya,
// bukan sebaliknya (varian "lebar dibagi rata" bikin satu baris berisi enam
// ukuran huruf berbeda).
//
// ⚠️ `flexGrow: 0` WAJIB, bukan selera: ScrollView RN memasang `flexGrow: 1`
// pada dirinya sendiri, jadi di dalam kolom `flex: 1` yang tetangganya juga
// `flex: 1` (susunan tab News) baris chipnya ikut melar jadi ratusan pt dan
// chipnya berubah bentuk seperti kapsul raksasa saat isinya belum ada.

/**
 * Nafas tepi: chip yang sedang aktif disisakan sejauh ini dari tepi layar,
 * jadi ia tidak pernah pas-pasan menempel di pinggir — apalagi terpotong.
 */
const EDGE = 14;

export function ChipRow({
  children,
  activeIndex,
  additionalStyle,
  contentStyle,
}: {
  children: ReactNode;
  /**
   * Chip ke berapa yang sedang aktif (0 = yang pertama).
   *
   * Baris yang digeser punya satu masalah bawaan: chip yang dipilih bisa
   * berada DI LUAR layar — di Reminder Prioritas & Riwayat Visitasi, "ALL"
   * yang sedang menyala tinggal terlihat separuh di tepi kiri, dan di News
   * sumber ke-6 tak kelihatan sama sekali. Dengan ini barisnya menggeser
   * dirinya secukupnya supaya chip aktif selalu utuh.
   *
   * Hanya menggeser kalau perlu: yang sudah kelihatan utuh tidak diusik, jadi
   * menekan chip tidak membuat barisnya melompat-lompat sendiri.
   */
  activeIndex?: number;
  /** Jarak kiri/kanan barisnya — biasanya `paddingHorizontal: 20` layarnya. */
  additionalStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const scroller = useRef<ScrollView>(null);
  // Ketiganya ref, BUKAN state: isinya cuma dipakai saat menghitung geseran,
  // dan menyimpannya sebagai state berarti tiap piksel geseran jari memicu
  // render ulang seluruh baris.
  const lebarLayar = useRef(0);
  const geseran = useRef(0);
  const tempat = useRef<Record<number, { x: number; w: number }>>({});

  const tampakkan = useCallback((i: number) => {
    const t = tempat.current[i];
    const lebar = lebarLayar.current;
    // Belum sempat diukur (chip-nya belum digambar) → nanti dipanggil lagi
    // dari onLayout-nya.
    if (!t || lebar === 0) return;
    const kiri = geseran.current;
    const kanan = kiri + lebar;
    // Sudah utuh di dalam layar beserta nafas tepinya → jangan diusik.
    if (t.x >= kiri + EDGE && t.x + t.w <= kanan - EDGE) return;
    const x =
      t.x < kiri + EDGE
        ? t.x - EDGE // tersembunyi di kiri → tarik ke kanan
        : t.x + t.w - lebar + EDGE; // …di kanan → tarik ke kiri
    scroller.current?.scrollTo({ x: Math.max(0, x), animated: true });
  }, []);

  useEffect(() => {
    if (activeIndex !== undefined) tampakkan(activeIndex);
  }, [activeIndex, tampakkan]);

  const anak = Children.toArray(children).filter((x) => x != null);
  const masukPelan = (i: number) =>
    FadeInRight.delay(Math.min(i, 8) * 45).duration(280).springify().damping(14);

  // Chip-nya masuk berurutan dari kanan dengan pantulan kecil — pola yang sama
  // dengan tile Home (berurutan, bukan berkedip sekaligus), cuma arahnya
  // menyamping mengikuti arah barisnya. Jedanya dibatasi 8 chip pertama supaya
  // baris panjang tidak terasa lambat.
  const isi = anak.map((child, i) => (
    <Animated.View
      key={i}
      onLayout={(e) => {
        const { x, width } = e.nativeEvent.layout;
        tempat.current[i] = { x, w: width };
        // Letaknya baru diketahui SESUDAH digambar — saat layar pertama kali
        // dibuka, efek di atas sudah lewat sebelum ukurannya ada. Jadi
        // geseran awalnya dihitung di sini.
        if (i === activeIndex) tampakkan(i);
      }}
      entering={masukPelan(i)}>
      {child}
    </Animated.View>
  ));

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(e) => {
        lebarLayar.current = e.nativeEvent.layout.width;
      }}
      onScroll={(e) => {
        geseran.current = e.nativeEvent.contentOffset.x;
      }}
      scrollEventThrottle={16}
      style={[styles.scroll, additionalStyle]}
      contentContainerStyle={[styles.row, contentStyle]}>
      {isi}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
