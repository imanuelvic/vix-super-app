import { Children, useCallback, useEffect, useRef, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

// Satu baris chip yang bisa digeser ke samping — kategori Reminder, sumber
// News, pemilih kreator Fun, saringan Riwayat, kelompok topik Diskusi, dan
// seterusnya. Semuanya dulu menulis `<ScrollView horizontal>`-nya sendiri;
// sekarang satu bentuk, satu tempat memperbaikinya.
//
// SATU bentuk saja, sengaja. Dulu ada dua pilihan lain — `spread` (melebar
// kalau muat) & `wrap` (turun baris kalau tidak muat) — dan keduanya dibuang:
//   • `wrap` (sumber News & kreator Fun) memang menampilkan semua chip
//     sekaligus, tapi baris KEDUA-nya tertimpa isi di bawahnya sampai chip
//     terakhir ("Kristen") terpotong separuh. Barisnya juga jadi satu-satunya
//     baris chip di app yang bentuknya beda sendiri.
//   • `spread` tidak dipakai satu layar pun.
// Sekarang semua baris chip berkelakuan sama persis seperti di Reminder.
//
// ── Kenapa `flexGrow: 0` itu WAJIB, bukan selera ──────────────────────────
// ScrollView bawaan React Native memasang `flexGrow: 1` pada dirinya sendiri
// (lihat ScrollView.js: baseHorizontal). Di dalam kolom `flex: 1` yang
// tetangganya juga `flex: 1` — persis susunan tab News: baris chip di atas,
// isi/loading/pesan gagal di bawah — ruang sisanya dibagi DUA, jadi baris
// chip yang seharusnya setinggi 40pt ikut melar jadi ratusan pt dan chip-nya
// berubah bentuk seperti kapsul raksasa. Baru kelihatan saat isinya belum ada
// (sedang memuat / gagal), karena saat daftarnya penuh ruang sisanya habis.
// Dengan `flexGrow: 0` barisnya selalu setinggi isinya, apa pun tetangganya.
//
// Tingginya sengaja TIDAK dipatok di sini — tiap baris punya jarak bawahnya
// sendiri yang sudah pas di layarnya. Yang butuh tinggi tetap (Reminder:
// ScrollView horizontal di Android pernah salah mengukur tinggi kontennya
// sampai chip terpotong) cukup mengopernya lewat `additionalStyle`.

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

  // Chip-nya masuk berurutan dari kanan dengan pantulan kecil — pola yang sama
  // dengan tile Home (berurutan, bukan berkedip sekaligus), cuma arahnya
  // menyamping mengikuti arah barisnya. Jedanya dibatasi 8 chip pertama supaya
  // baris panjang tidak terasa lambat.
  const isi = Children.map(children, (child, i) =>
    child == null ? null : (
      <Animated.View
        onLayout={(e) => {
          const { x, width } = e.nativeEvent.layout;
          tempat.current[i] = { x, w: width };
          // Letaknya baru diketahui SESUDAH digambar — saat layar pertama kali
          // dibuka, efek di atas sudah lewat sebelum ukurannya ada. Jadi
          // geseran awalnya dihitung di sini.
          if (i === activeIndex) tampakkan(i);
        }}
        entering={FadeInRight.delay(Math.min(i, 8) * 45)
          .duration(280)
          .springify()
          .damping(14)}>
        {child}
      </Animated.View>
    ),
  );

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
