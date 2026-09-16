import type { ViewStyle } from 'react-native';

import { Color } from '@/assets/style/color';

/**
 * Jarak TEGAK antar kartu blok yang bertumpuk di satu layar: kartu ringkasan
 * → hero → kartu pengingat → tombol tambah → daftar. Satu angka untuk seluruh
 * app; dulu tiap layar menulisnya sendiri (10, 12, 14, 16, 22 …) dan tak ada
 * dua layar yang sama.
 *
 * Pita header ke kartu pertama memakai angka yang sama: pita punya
 * marginBottom 6 (ScreenHeader), jadi paddingTop isi layar = 4.
 *
 * Kartu DAFTAR (baris yang berulang) sengaja TIDAK memakai ini — jaraknya 8,
 * lebih rapat, karena itu irama daftar, bukan tumpukan blok.
 */
export const CARD_GAP = 10;

// Bentuk baku KARTU DAFTAR — satu baris/kartu di dalam daftar: krem di atas
// latar krem muda, sudut 14, garis rambut, dan padding 14/12.
//
// Sebelum ini keenam angkanya disalin utuh di 43 tempat pada 32 berkas. Bukan
// cuma panjang: tiap salinan itu satu kesempatan lagi untuk meleset diam-diam.
// Satu berkas menulis radius 12, satu lagi padding 16, dan tidak ada yang
// menyadarinya sampai dua kartu kebetulan berdampingan di satu layar.
//
// Dipakai dengan disebar, lalu ditambahi yang memang khas kartunya:
//
//   const styles = StyleSheet.create({
//     card: { ...CARD, marginBottom: 8, gap: 4 },
//     row:  { ...CARD, flexDirection: 'row', alignItems: 'center', gap: 12 },
//   });
//
// Yang TIDAK ikut ke sini justru yang paling sering berbeda: `gap`,
// `marginBottom`, arah & perataan isinya, dan garis tepi kiri berwarna. Itu
// memang milik kartunya masing-masing — memaksakannya ke sini cuma membuat
// tiap pemakai harus menimpanya lagi.
export const CARD: ViewStyle = {
  backgroundColor: Color.CONTAINER,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: Color.BORDER,
  paddingHorizontal: 14,
  paddingVertical: 12,
};
