import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Pesan gagal DI DALAM kartu / sheet / modal — beda dari `ScreenError` yang
// dipasang di bawah judul layar (yang itu ikut padding 20 layar).
//
// Jaraknya cuma dua rasa, mengikuti letak pesannya di dalam form:
// • `gap="bottom"` (bawaan) — pesan masih diikuti isian/tombol di bawahnya.
// • `gap="top"`            — pesan menempel di bawah isian terakhir.
//
// Nilainya sama persis dengan gaya yang tadinya disalin di tiap file, jadi
// tidak ada jarak yang bergeser.
export function FormError({
  message,
  gap = 'bottom',
}: {
  message: string | null | undefined;
  gap?: 'bottom' | 'top';
}) {
  if (!message) return null;
  return (
    <VixText
      heading="label"
      additionalStyle={gap === 'top' ? styles.top : styles.bottom}>
      {message}
    </VixText>
  );
}

const styles = StyleSheet.create({
  bottom: { color: Color.DANGER, marginBottom: 8 },
  top: { color: Color.DANGER, marginTop: 8 },
});
