import { BottomTabBarButtonProps } from "expo-router/js-tabs";
import { PlatformPressable } from "expo-router/react-navigation";
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Animated } from 'react-native';

// Pegas yang sama dengan PressableScale (components/common) — supaya tab utama
// terasa persis seperti tombol lain di app ini.
const SPRING = { damping: 15, stiffness: 320, mass: 0.5, useNativeDriver: true };

/**
 * Tombol tab utama di kaki app: getaran halus + sedikit MENGECIL saat disentuh
 * lalu memantul balik (15 Sep 2026; sebelumnya cuma bergetar), sama dengan
 * sub-tab di dalam fitur (PressableScale di BottomTabs). Lompatan ikonnya
 * sendiri ada di BounceTabIcon.
 *
 * Skalanya lewat Animated bawaan RN, bukan Reanimated: PlatformPressable
 * menerima style ber-Animated.Value, jadi tidak perlu membungkus isinya
 * (ikon + label yang tata letaknya diatur navigator) dengan View tambahan.
 */
export function HapticTab({ style, onPressIn, onPressOut, ...rest }: BottomTabBarButtonProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const pegas = (toValue: number) =>
    Animated.spring(scale, { toValue, ...SPRING }).start();
  return (
    <PlatformPressable
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(ev) => {
        pegas(0.94);
        if (process.env.EXPO_OS === 'ios') {
          // Add a soft haptic feedback when pressing down on the tabs.
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(ev);
      }}
      onPressOut={(ev) => {
        pegas(1);
        onPressOut?.(ev);
      }}
    />
  );
}
