import {
  StyleSheet,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Pesan gagal DI DALAM kartu / sheet / modal — beda dari `ScreenError` yang
// dipasang di bawah judul layar (yang itu ikut padding 20 layar).
//
// Jaraknya punya tiga rasa, mengikuti letak pesannya di dalam form:
// • `gap="bottom"` (bawaan) — pesan masih diikuti isian/tombol di bawahnya.
// • `gap="top"`             — pesan menempel di bawah isian terakhir.
// • `gap="none"`            — jaraknya diatur sendiri lewat `additionalStyle`,
//   untuk layar yang jaraknya memang tidak standar (mis. ikut padding 20 layar,
//   atau marginTop 10). Warna & ukuran teksnya tetap dari sini, jadi merahnya
//   cuma didefinisikan di satu tempat.
//
// Nilainya sama persis dengan gaya yang tadinya disalin di tiap file, jadi
// tidak ada jarak yang bergeser.
export function FormError({
  message,
  gap = 'bottom',
  additionalStyle,
}: {
  message: string | null | undefined;
  gap?: 'bottom' | 'top' | 'none';
  additionalStyle?: StyleProp<TextStyle>;
}) {
  if (!message) return null;
  return (
    <VixText
      heading="label"
      additionalStyle={[styles.text, GAP_STYLE[gap], additionalStyle]}>
      {message}
    </VixText>
  );
}

const styles = StyleSheet.create({
  text: { color: Color.DANGER },
  bottom: { marginBottom: 8 },
  top: { marginTop: 8 },
  none: {},
});

const GAP_STYLE = {
  bottom: styles.bottom,
  top: styles.top,
  none: styles.none,
};
