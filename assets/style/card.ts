import { Platform, type ViewStyle } from 'react-native';

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

// ═══════════════════════ Bayangan (versi 2.0, 22 Sep 2026) ═══════════════════
// Dua tingkat saja, supaya tidak semua kartu "mengambang":
//
//   SHADOW_SOFT   → kartu BLOK yang berdiri sendiri di layar Today (hero With
//                   God, bagian CORE/Work/Life, blok refleksi) & kartu
//                   ringkasan fitur. Halus: terasa sebagai kedalaman, bukan
//                   tepi hitam.
//   SHADOW_RAISED → yang benar-benar melayang di atas isi: tab bar utama,
//                   tombol mengambang (air putih, FAB), tombol utama.
//
// Kartu DAFTAR (CARD di atas) tetap garis rambut tanpa bayangan — puluhan
// baris berbayangan justru bikin layar berat & ramai.
//
// iOS memakai shadow*; Android memakai elevation (shadow* diabaikan di sana).
// Warna bayangannya TEXT_TITLE (hijau-hitam hangat), bukan #000: bayangan
// hitam murni di atas latar gading terlihat abu-abu kotor.
export const SHADOW_SOFT: ViewStyle = Platform.select({
  ios: {
    shadowColor: Color.TEXT_TITLE,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  default: { elevation: 2 },
});

export const SHADOW_RAISED: ViewStyle = Platform.select({
  ios: {
    shadowColor: Color.TEXT_TITLE,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  default: { elevation: 6 },
});

// Bentuk baku KARTU BLOK — kotak besar yang berdiri sendiri di layar Today &
// Work Focus: bagian CORE/Work/Life, "3 hal terpenting", "Harus dikirim".
//
// Bedanya dengan CARD di atas: CARD itu satu BARIS di dalam daftar (garis
// rambut, sudut 14), yang ini satu BAGIAN dari layar (lebih lega, bersudut
// 18, dan mengambang halus lewat SHADOW_SOFT alih-alih bergaris).
//
// Dipakai dengan disebar, lalu ditambahi yang khas bloknya (gap, warna latar
// yang memang beda seperti blok Refleksi):
//
//   const styles = StyleSheet.create({
//     card: { ...BLOCK_CARD, gap: 6 },
//   });
export const BLOCK_CARD: ViewStyle = {
  ...SHADOW_SOFT,
  backgroundColor: Color.CONTAINER,
  borderRadius: 18,
  paddingHorizontal: 18,
  paddingVertical: 14,
};
