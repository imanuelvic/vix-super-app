import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Chip pilihan (pill) — kategori, bulan, jenis, dll. Aktif = hijau MAIN.
export function Chip({
  label,
  active,
  onPress,
  additionalStyle,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  additionalStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      style={[styles.chip, active && styles.active, additionalStyle]}
      onPress={onPress}>
      <VixText heading="label" numberOfLines={1} additionalStyle={styles.text}>
        {label}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: Color.BORDER,
    backgroundColor: Color.CONTAINER,
  },
  active: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN,
  },
  text: { color: Color.TEXT_TITLE },
});
