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
