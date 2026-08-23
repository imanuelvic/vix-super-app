import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Pil streak 🔥 → buka halaman Achievements (streak & pencapaian).
// Dipakai di baris sapaan (<GreetingHeader/>) dan di pojok kanan atas
// header layar (mis. tab Habits). Satu tampilan, satu tempat ubah.
//
// Saat angkanya NAIK, pil ini meletup sekali — hadiah kecil yang langsung
// terlihat begitu streak hari bertambah.
export function StreakPill({ streak }: { streak: string | number }) {
  const router = useRouter();

  const count = Number(streak);
  const previous = useRef(count);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (Number.isFinite(count) && count > previous.current) {
      pop.value = withSequence(
        withTiming(1.25, { duration: 140 }),
        withSpring(1, { damping: 8, stiffness: 240 }),
      );
    }
    previous.current = count;
  }, [count, pop]);

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  // Letupan dipasang di pembungkus luar supaya tidak bentrok dengan animasi
  // mengecil milik PressableScale (satu view hanya boleh punya satu transform).
  return (
    <Animated.View style={popStyle}>
      <PressableScale
        style={styles.pill}
        onPress={() => router.push('/achievements')}
        hitSlop={8}>
        <VixText heading="bold" additionalStyle={styles.text}>
          🔥 {streak}
        </VixText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: Color.ACCENT,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  text: { color: Color.ACCENT_DARK },
});
