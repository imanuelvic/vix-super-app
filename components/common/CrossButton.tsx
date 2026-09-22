import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tombol ✗ bulat: pasangan lingkaran centang (<CheckCircle/>) di baris yang
// punya DUA jawaban tegas, "ya" dan "tidak": lewati kebiasaan hari ini
// (Habits), puasa hari itu gagal (Hari per Hari). Tanpa tombol ini, lingkaran
// centang saja bikin ragu: apakah yang belum dicentang berarti "belum" atau
// "tidak"? Aktif = merah muda bergaris merah.
//
// Ukuran & bentuknya sama persis dengan tombol ✏️ di sebelahnya (EmojiButton
// 42×42), jadi pasangannya tidak timpang. Getaran "warning": tubuh ikut diberi
// tahu ini jalur "tidak", beda rasanya dari centang.
//
// <CrossMark/> = rupanya saja, tanpa Pressable — untuk baris yang SELURUHNYA
// sudah jadi tombol (Pressable bersarang di iOS bikin click tombol dalam ikut
// memicu pembungkusnya).
export function CrossMark({ on }: { on: boolean }) {
  return (
    <View style={[styles.button, on && styles.on]}>
      <IconSymbol name="xmark" size={19} color={on ? Color.DANGER : Color.TEXT_LABEL} />
    </View>
  );
}

export function CrossButton({
  on,
  onPress,
  disabled = false,
}: {
  on: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale onPress={onPress} disabled={disabled} hitSlop={8} haptic="warning">
      <CrossMark on={on} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: Color.ACCENT,
    backgroundColor: Color.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: {
    backgroundColor: Color.FINANCE_EXPENSE,
    borderColor: Color.DANGER,
  },
});
