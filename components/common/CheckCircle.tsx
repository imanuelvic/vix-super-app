import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Lingkaran ceklis — dipakai di Task, kebiasaan Habits, Timeline, dll.
// Momen mencentang adalah momen paling sering & paling memuaskan di app ini,
// jadi dibuat tiga lapis animasi sekaligus:
//   1. isian mint memudar masuk (warna),
//   2. seluruh lingkaran "meletup" sekali lalu memantul balik (skala),
//   3. tanda centang masuk sambil menegak dari posisi miring (spring + rotasi),
// seolah baru saja digoreskan pakai spidol.
export function CheckCircle({
  checked,
  size = 26,
}: {
  checked: boolean;
  size?: number;
}) {
  const progress = useSharedValue(checked ? 1 : 0); // isian mint
  const mark = useSharedValue(checked ? 1 : 0); // tanda centang
  const pop = useSharedValue(1); // letupan lingkaran

  // Letupan HANYA saat pengguna mencentang, bukan saat layar pertama dibuka —
  // kalau tidak, semua kebiasaan yang sudah tercentang akan meletup berjamaah.
  const mounted = useRef(false);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: 160 });
    mark.value = checked
      ? withSpring(1, { damping: 10, stiffness: 320 })
      : withTiming(0, { duration: 120 });
    if (checked && mounted.current) {
      pop.value = withSequence(
        withTiming(1.18, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 260 }),
      );
    }
    mounted.current = true;
  }, [checked, progress, mark, pop]);

  // Isian & warna border ikut progress (transparan → mint), plus letupan.
  const circleStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['transparent', Color.MAIN_LIGHT],
    ),
    transform: [{ scale: pop.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [
      { scale: mark.value },
      // Mulai miring lalu tegak — kesannya "digoreskan", bukan sekadar muncul.
      { rotate: `${(1 - mark.value) * -30}deg` },
    ],
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
