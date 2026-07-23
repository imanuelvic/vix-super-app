import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Lingkaran ceklis — dipakai di Task, kebiasaan Health, Timeline, dll.
// Mint terang butuh ikon gelap agar kontras.
export function CheckCircle({
  checked,
  size = 26,
}: {
  checked: boolean;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        checked && styles.done,
      ]}>
      {checked && (
        <IconSymbol
          name="checkmark"
          size={Math.round(size * 0.62)}
          color={Color.MAIN_DARK}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
    borderColor: Color.MAIN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { backgroundColor: Color.MAIN_LIGHT },
});
