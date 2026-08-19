import {
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tombol ➕ hijau di samping kanan sebuah kolom isian — aksi "catat/tambah"
// yang tidak memakan satu baris sendiri. Lebarnya tetap 48; tingginya sengaja
// tidak diatur supaya meregang mengikuti kolom di sebelahnya (perilaku bawaan
// baris flex), jadi selalu sejajar. Taruh di dalam View berarah 'row'.
// Dipakai di Transaksi Finance, Saku, & modal Bayar Pinjaman.
export function AddButton({
  onPress,
  busy = false,
  additionalStyle,
}: {
  onPress: () => void;
  busy?: boolean;
  additionalStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      style={[styles.button, busy && styles.busy, additionalStyle]}
      onPress={onPress}
      disabled={busy}>
      {busy ? (
        <ActivityIndicator color={Color.TEXT_REVERSE} />
      ) : (
        <IconSymbol name="plus" size={24} color={Color.TEXT_REVERSE} />
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 48,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { opacity: 0.6 },
});
