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
/**
 * Bentuk kartu daftar TANPA paddingnya — untuk kotak bersudut 14 yang jarak
 * dalamnya memang harus beda.
 *
 * Kenapa perlu, dan ini ketahuan justru saat CARD diberlakukan ke seluruh app
 * (30 Sep 2026): sepuluh kotak memakai bentuk yang sama persis tapi jarak
 * dalamnya sengaja lain. Empat kartu rincian (App Info, System, Car, Residence)
 * memakai 16/6 karena BARISNYA sendiri yang punya jarak tegak; tabel rekap CORE
 * dan kartu kreator YouTube justru tidak boleh punya jarak dalam sama sekali,
 * karena isinya menempel penuh ke tepi kartu.
 *
 * Tanpa nama ini, kesepuluhnya cuma punya dua pilihan yang sama-sama buruk:
 * menulis ulang keempat propertinya (dan jadi salinan yang bisa meleset), atau
 * memakai CARD lalu menimpa paddingnya (dan berbohong bahwa ia baris daftar).
 *
 * Pakai CARD kalau ia memang BARIS DAFTAR; pakai ini kalau jarak dalamnya
 * milik kotak itu sendiri.
 */
export const CARD_SHAPE = {
  backgroundColor: Color.CONTAINER,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: Color.BORDER,
} satisfies ViewStyle;

export const CARD: ViewStyle = {
  ...CARD_SHAPE,
  paddingHorizontal: 14,
  paddingVertical: 12,
};

/**
 * Bentuk KOTAK BERGARIS sudut 16 — bentuk kartu yang paling banyak dipakai app
 * ini: kartu daftar di 30-an layar, kartu ringkasan Finance, kartu info, blok
 * catatan, sampai tile fakta.
 *
 * Keempat propertinya disalin utuh di 60 tempat pada 52 berkas sebelum 28 Sep
 * 2026. Sama seperti CARD di atas, yang berbahaya bukan panjangnya melainkan
 * bahwa tiap salinan adalah satu kesempatan lagi untuk meleset diam-diam.
 *
 * Yang TIDAK ikut ke sini justru yang memang beda-beda: padding (14 atau 16,
 * kadang terpisah horizontal/vertical), `gap`, `marginBottom`, arah isinya, dan
 * garis tepi kiri berwarna. Itu milik kartunya masing-masing.
 *
 *   const styles = StyleSheet.create({
 *     card: { ...PANEL, padding: 14, marginBottom: 10, gap: 6 },
 *   });
 *
 * ⚠️ Bedanya dengan CARD cuma DUA PIKSEL sudut (16 vs 14), dan itu memang
 * pertumbuhan yang tidak pernah diputuskan siapa pun: CARD lahir lebih dulu
 * dengan sudut 14, lalu layar-layar berikutnya menulis 16 sendiri sampai yang
 * 16 justru jadi mayoritas. Menyatukannya = keputusan TAMPILAN, bukan
 * kerapian, jadi ia sengaja tidak diambil di sini. Kalau suatu saat mau
 * disatukan, sekarang tempatnya cuma satu baris.
 */
export const PANEL: ViewStyle = {
  backgroundColor: Color.CONTAINER,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: Color.BORDER,
};

/**
 * Bentuk KOTAK ISIAN sudut 12 — yang paling sering disentuh jari di app ini:
 * kolom teks, pemilih tanggal & jam, kotak pencarian, kolom nominal, pemilih
 * ayat, tombol halaman, plus kotak-kotak kecil DI DALAM kartu (panel yang
 * mengembang, sub-kotak rincian).
 *
 * Kenapa sudutnya 12 dan bukan 14/16: ini bukan kartu yang berdiri sendiri di
 * layar, melainkan kotak yang duduk DI DALAM kartu atau formulir. Kotak kecil
 * bersudut lebar terlihat menggelembung, dan sudut yang lebih rapat itulah yang
 * membedakannya dari kartu di sekelilingnya. Jadi ini bukan pertumbuhan liar
 * seperti 14-vs-16, melainkan peran yang memang berbeda.
 *
 * Keempat propertinya ditulis tangan di 29 tempat pada 21 berkas sebelum 30 Sep
 * 2026 — tujuh di antaranya komponen bersama `components/common/` yang justru
 * dibuat supaya isian app ini seragam. Artinya mengganti rupa isian app berarti
 * menyunting tujuh berkas dan berharap tidak ada yang meleset; BibleRefField
 * sendiri sudah memuat tiga salinan.
 *
 * Yang TIDAK ikut ke sini, sama seperti CARD & PANEL: padding (16/12, 14/10,
 * 14/13, kadang cuma paddingLeft), `gap`, arah isinya, dan perataannya. Itu
 * memang beda-beda per kotak.
 *
 *   const styles = StyleSheet.create({
 *     field: { ...FIELD, flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
 *   });
 *
 * ⚠️ `satisfies`, bukan `: ViewStyle` seperti CARD & PANEL, dan itu bukan
 * selera. Salah satu pemakainya `<FormInput>` yang gayanya bertipe TextStyle,
 * dan menyebar sebuah ViewStyle UTUH ke sana membawa serta ~180 properti
 * opsional yang tipenya lebih longgar (mis. `userSelect: string`) sehingga tsc
 * menolaknya. Dengan `satisfies`, nilainya tetap diperiksa terhadap ViewStyle
 * tapi tipenya tinggal keempat properti ini saja, jadi ia cocok di kotak View
 * maupun di kolom teks.
 */
export const FIELD = {
  backgroundColor: Color.CONTAINER,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: Color.BORDER,
} satisfies ViewStyle;

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
