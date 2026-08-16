import { useEffect } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Chip pilihan (pill) — kategori, bulan, jenis, dll. Aktif = hijau MAIN.
// Perpindahan aktif↔nonaktif TIDAK langsung ganti warna, tapi memudar 180 ms
// (latar & garis tepi sekaligus) — mata jadi bisa mengikuti chip mana yang
// barusan berpindah, bukan cuma "tiba-tiba beda".
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
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, on]);

  const skin = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      [Color.CONTAINER, Color.MAIN_TRANSPARENT],
    ),
    borderColor: interpolateColor(on.value, [0, 1], [Color.BORDER, Color.MAIN]),
  }));

  return (
    <PressableScale
      style={[styles.chip, skin, additionalStyle]}
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
  text: { color: Color.TEXT_TITLE },
});
