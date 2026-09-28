import type { ViewStyle } from 'react-native';

/**
 * Kolom isi yang DIBATASI lebarnya & ditengahkan — di HP memenuhi layar, di
 * iPad/layar lebar berhenti di 680 dan duduk di tengah (bukan melar sampai
 * tepi, yang membuat satu baris teks jadi selebar dua telapak tangan).
 *
 * Dipakai layar berkolom tunggal: baris kepala & isi Today, Life, Semua
 * Pengingat, Habits. Sebelum ini keempatnya menulis tiga angka yang sama
 * sendiri-sendiri di tujuh tempat; sekali salah satu digeser, kepala &
 * isinya tidak lagi sejajar.
 *
 * Dipakai dengan disebar, lalu ditambahi yang memang khas layarnya:
 *
 *   const styles = StyleSheet.create({
 *     header: { ...CONTENT_COLUMN, flexDirection: 'row', paddingVertical: 12 },
 *     contentInner: { ...CONTENT_COLUMN, paddingHorizontal: 20 },
 *   });
 *
 * `alignSelf` sengaja ikut: kepala layar adalah anak langsung SafeAreaView
 * (yang meregangkan anaknya), jadi tanpa itu ia tidak pernah di tengah. Di
 * dalam ScrollView yang isinya sudah `alignItems: 'center'` nilainya cuma
 * mengulang yang sudah berlaku, jadi aman dipakai di keduanya.
 */
export const CONTENT_COLUMN: ViewStyle = {
  width: '100%',
  maxWidth: 680,
  alignSelf: 'center',
};

/**
 * Napas ISI LAYAR — dua angka yang muncul di hampir setiap layar app ini.
 *
 *   paddingHorizontal 20  jarak kiri-kanan isi dari tepi layar. Ini satu-satunya
 *                         angka yang menentukan lebar semua kartu, jadi satu
 *                         layar yang menulis 18 atau 24 langsung terlihat
 *                         "geser" begitu berdampingan dengan layar lain.
 *   paddingTop 4          jarak isi dari pita header. Bukan angka karangan:
 *                         ScreenHeader punya marginBottom 6, jadi 6 + 4 = 10 =
 *                         CARD_GAP — jarak yang sama dengan antar-kartu di
 *                         bawahnya (lihat assets/style/card.ts).
 *
 * `paddingBottom` SENGAJA tidak ikut: ia memang beda per layar, dan bedanya
 * punya alasan (layar ber-FAB butuh 40 supaya kartu terakhir tidak tertutup,
 * layar biasa cukup 24). Jadi ia tetap ditulis di layarnya masing-masing.
 *
 * Dipakai dengan disebar, sama seperti CARD & BLOCK_CARD:
 *
 *   const styles = StyleSheet.create({
 *     content: { ...SCREEN_CONTENT, paddingBottom: 24 },
 *   });
 *
 * Sebelum 28 Sep 2026 kedua angkanya ditulis tangan di 100 tempat pada 96
 * berkas. Tidak ada satu pun yang salah sendirian — yang berbahaya justru itu:
 * mengubah napas layar berarti menyunting seratus berkas, jadi dalam praktiknya
 * ia tidak pernah bisa diubah lagi.
 */
export const SCREEN_CONTENT: ViewStyle = {
  paddingHorizontal: 20,
  paddingTop: 4,
};

/**
 * Napas isi layar untuk daftar yang tombolnya DIPATOK di atas (`<StickyTop>`).
 *
 * Bedanya cuma satu: `paddingTop` 0. Jarak atasnya sudah dipegang StickyTop
 * (paddingTop 4 + paddingBottom CARD_GAP), jadi kalau ScrollView di bawahnya
 * masih menambah 4 lagi, kartu pertama berdiri 4 piksel lebih rendah daripada
 * di layar yang tombolnya ikut tergulung — beda kecil yang langsung terasa
 * begitu dua sub-tab dibandingkan berdampingan.
 *
 * Dipakai dengan disebar, sama seperti SCREEN_CONTENT:
 *
 *   const styles = StyleSheet.create({
 *     content: { ...SCREEN_CONTENT_PINNED, paddingBottom: 24 },
 *   });
 *
 * 28 Sep 2026: dibuat saat tombol tambah di sembilan sub-tab (CORE, Walk,
 * Work) disamakan jadi dipatok. Sebelumnya tiga di antaranya menulis sendiri
 * `paddingHorizontal: 20, paddingTop: 0`, dan yang lain belum dipatok sama
 * sekali.
 */
export const SCREEN_CONTENT_PINNED: ViewStyle = {
  ...SCREEN_CONTENT,
  paddingTop: 0,
};
