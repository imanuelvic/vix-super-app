import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Banner pesan gagal satu baris — bentuk & jaraknya sama di seluruh app:
// merah, sejajar isi layar (padding 20), lalu sedikit jarak ke bawah.
//
// Sebelumnya blok JSX + gaya ini disalin apa adanya di 22 file. Nilainya
// dipertahankan persis supaya tidak ada tampilan yang bergeser.
//
// Tidak merender apa pun kalau pesannya kosong — jadi pemanggilnya tidak perlu
// lagi menulis `{error && (…)}`.
export function ScreenError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <VixText heading="label" additionalStyle={styles.error}>
      {message}
    </VixText>
  );
}

const styles = StyleSheet.create({
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
});
