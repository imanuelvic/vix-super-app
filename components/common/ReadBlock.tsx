import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Satu bagian TAMPILAN BACA — label kecil di atas, isinya di bawah, tanpa
// kotak isian sama sekali.
//
// Dipakai layar yang punya dua keadaan: selama masih boleh diubah isinya kolom
// ketik, sesudah dikunci isinya ini. Bedanya HARUS terbaca sekali pandang —
// kotak isian yang cuma dimatikan tetap terlihat seperti kotak yang menunggu
// diketik, dan itu yang bikin orang mencobanya berkali-kali lalu mengira
// app-nya rusak.
//
// Teksnya tidak dipotong (tanpa `numberOfLines`) dan enter yang dulu diketik
// ikut terbaca sebagai ganti baris: ini memang tempat membacanya utuh.
//
// Kosong → tidak digambar sama sekali, jadi tak ada label menggantung tanpa
// isi.
//
// Warna labelnya SPIRITUAL_DARK karena kedua pemakainya layar Spiritual
// (Catatan Khotbah & Puasa) dan bentuknya memang harus sama persis. Kalau
// suatu saat fitur berwarna lain memakainya, warnanya yang jadi prop — bukan
// komponennya yang disalin.
export function ReadBlock({ label, text }: { label?: string; text: string }) {
  if (!text.trim()) return null;
  return (
    <View>
      {label ? (
        <VixText heading="label" additionalStyle={styles.label}>
          {label}
        </VixText>
      ) : null}
      <VixText heading="paragraph" additionalStyle={styles.text}>
        {text}
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: Color.SPIRITUAL_DARK, marginBottom: 4 },
  text: { color: Color.TEXT_PARAGRAPH },
});
