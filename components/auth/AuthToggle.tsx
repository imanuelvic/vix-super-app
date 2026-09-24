import { useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

export type AuthMode = 'signin' | 'signup';

// Sakelar Masuk / Daftar di kepala kartu login: satu pil hijau yang BERGESER
// ke pilihan yang aktif, bukan dua tombol yang menyala bergantian.
//
// Kenapa digeser: pilihannya cuma dua dan selalu kelihatan dua-duanya, jadi
// yang perlu dijawab mata adalah "sekarang saya di mana", dan perpindahan pil
// menjawabnya tanpa satu kata pun. Lebarnya diukur lewat onLayout supaya
// pilnya selalu pas separuh, berapa pun lebar layarnya.
export function AuthToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
  disabled?: boolean;
}) {
  const [lebar, setLebar] = useState(0);
  const geser = useSharedValue(mode === 'signup' ? 1 : 0);

  useEffect(() => {
    geser.value = withTiming(mode === 'signup' ? 1 : 0, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [mode, geser]);

  const separuh = lebar > 0 ? (lebar - PADDING * 2) / 2 : 0;
  const gayaPil = useAnimatedStyle(() => ({
    transform: [{ translateX: geser.value * separuh }],
  }));

  function ukur(e: LayoutChangeEvent) {
    setLebar(e.nativeEvent.layout.width);
  }

  return (
    <View style={styles.wrap} onLayout={ukur}>
      {separuh > 0 && (
        <Animated.View style={[styles.pil, gayaPil, { width: separuh }]} pointerEvents="none" />
      )}
      {(
        [
          ['signin', 'Masuk'],
          ['signup', 'Daftar'],
        ] as const
      ).map(([key, label]) => (
        <PressableScale
          key={key}
          style={styles.separuh}
          onPress={() => onChange(key)}
          disabled={disabled}
          haptic="light">
          <VixText
            heading="bold"
            additionalStyle={mode === key ? styles.aktif : styles.diam}>
            {label}
          </VixText>
        </PressableScale>
      ))}
    </View>
  );
}

const PADDING = 4;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: Color.BACKGROUND,
    borderRadius: 14,
    padding: PADDING,
  },
  // Pil yang bergeser; duduk DI BAWAH kedua labelnya (digambar lebih dulu).
  pil: {
    position: 'absolute',
    top: PADDING,
    left: PADDING,
    bottom: PADDING,
    borderRadius: 11,
    backgroundColor: Color.MAIN,
  },
  separuh: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  aktif: { color: Color.TEXT_REVERSE },
  diam: { color: Color.TEXT_LABEL },
});
