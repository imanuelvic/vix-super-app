import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Lingkaran ceklis — dipakai di Task, kebiasaan Health, Timeline, dll.
// Saat dicentang, isian mint memudar masuk & tanda centang memantul kecil
// (spring) biar terasa memuaskan. Mint terang butuh ikon gelap agar kontras.
export function CheckCircle({
  checked,
  size = 26,
}: {
  checked: boolean;
  size?: number;
}) {
  const progress = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: 160 });
  }, [checked, progress]);

  // Isian & warna border ikut progress (transparan → mint).
  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['transparent', Color.MAIN_LIGHT],
    ),
  }));

  // Centang memantul masuk dengan spring saat dicentang.
  const checkStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: withSpring(checked ? 1 : 0, { damping: 12 }) }],
  }));

  return (
    <Animated.View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        circleStyle,
      ]}>
      <Animated.View style={checkStyle}>
        <IconSymbol
          name="checkmark"
          size={Math.round(size * 0.62)}
          color={Color.MAIN_DARK}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
    borderColor: Color.MAIN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
