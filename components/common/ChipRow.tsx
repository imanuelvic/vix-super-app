import { Children, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';

// Satu baris chip yang bisa digeser ke samping — kategori Reminder, sumber
// News, saringan Riwayat, kelompok topik Diskusi, dan seterusnya. Semuanya
// dulu menulis `<ScrollView horizontal>`-nya sendiri; sekarang satu bentuk,
// satu tempat memperbaikinya.
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
export function ChipRow({
  children,
  fit = 'start',
  additionalStyle,
  contentStyle,
}: {
  children: ReactNode;
  /**
   * `start` (bawaan) — menempel kiri, sisanya digeser. Bentuk yang dipakai
   * semua baris saringan: chip "ALL" harus tetap di pojok kiri.
   *
   * `spread` — kalau semuanya MUAT, lebar sisanya dibagi rata sehingga
   * chip-nya merata dari tepi ke tepi (di iPad semuanya kelihatan sekaligus);
   * kalau tidak muat, otomatis kembali bisa digeser. Tak perlu mengukur
   * apa pun: `flexGrow` pada wadah isinya hanya bekerja saat masih ada sisa.
   *
   * `wrap` — BUKAN baris yang digeser: chip-nya turun ke baris berikutnya
   * kalau tidak muat. Dipakai baris yang jumlah pilihannya sedikit & tetap
   * (sumber News: 5), di mana tidak ada satu pun yang boleh tersembunyi di
   * luar layar. Geseran menyembunyikan pilihan; kalau semua pilihan harus
   * terlihat sekaligus — apa pun ukuran huruf sistem yang dipakai pembacanya
   * — satu-satunya jawaban yang tidak bisa meleset adalah turun baris.
   */
  fit?: 'start' | 'spread' | 'wrap';
  /** Jarak kiri/kanan barisnya — biasanya `paddingHorizontal: 20` layarnya. */
  additionalStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  // Chip-nya masuk berurutan dari kanan dengan pantulan kecil — pola yang sama
  // dengan tile Home (berurutan, bukan berkedip sekaligus), cuma arahnya
  // menyamping mengikuti arah barisnya. Jedanya dibatasi 8 chip pertama supaya
  // baris panjang tidak terasa lambat.
  const isi = Children.map(children, (child, i) =>
    child == null ? null : (
      <Animated.View
        entering={FadeInRight.delay(Math.min(i, 8) * 45)
          .duration(280)
          .springify()
          .damping(14)}>
        {child}
      </Animated.View>
    ),
  );

  // Turun baris → tidak ada ScrollView sama sekali. View biasa yang membungkus,
  // jadi mustahil ada chip yang berada di luar layar.
  if (fit === 'wrap') {
    return (
      <View style={[styles.row, styles.wrap, additionalStyle, contentStyle]}>
        {isi}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, additionalStyle]}
      contentContainerStyle={[
        styles.row,
        fit === 'spread' && styles.spread,
        contentStyle,
      ]}>
      {isi}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  // `flexGrow` di WADAH ISI: saat isinya lebih sempit dari layarnya, wadahnya
  // melar selebar layar lalu `space-between` membagi sisanya rata. Saat
  // isinya sudah lebih lebar, tidak ada sisa untuk dibagi — jadi keduanya
  // otomatis tidak berpengaruh dan barisnya kembali digeser seperti biasa.
  spread: { flexGrow: 1, justifyContent: 'space-between' },
  // `rowGap` terpisah dari `gap` bawaan baris: jarak antar baris sengaja
  // sedikit lebih rapat daripada jarak antar chip, supaya dua baris chip
  // terbaca sebagai SATU kelompok, bukan dua baris yang tak berhubungan.
  wrap: { flexWrap: 'wrap', rowGap: 6 },
});
