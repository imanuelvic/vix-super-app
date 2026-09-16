import type { BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { useState } from 'react';
import { Animated, type GestureResponderEvent } from 'react-native';

import { haptic } from '@/lib/haptics';

// Pegas yang sama dengan PressableScale (components/common) — supaya tab utama
// terasa persis seperti tombol lain di app ini.
const SPRING = { damping: 15, stiffness: 320, mass: 0.5, useNativeDriver: true };

type Sentuhan = BottomTabBarButtonProps['onPressIn'];

/**
 * Rasa sentuh tab utama di kaki app (HapticTab & RaisedHomeTab): mengecil ke
 * 0,94 + getar halus saat disentuh, memantul balik saat dilepas. Dulu kedua
 * tombol itu menulis pegas, Animated.Value, dan getarannya masing-masing.
 *
 * Skalanya lewat Animated bawaan RN, bukan Reanimated: PlatformPressable
 * menerima style ber-Animated.Value, jadi tidak perlu membungkus isinya
 * (ikon + label yang tata letaknya diatur navigator) dengan View tambahan.
 *
 * `onPressIn`/`onPressOut` bawaan navigator tetap diteruskan sesudah
 * animasinya dimulai, jadi tabPress & sejenisnya tidak hilang.
 */
export function useTabPress(
  onPressIn: Sentuhan,
  onPressOut: Sentuhan,
): {
  /** Dipasang ke `style` PlatformPressable, bersama gaya tombolnya sendiri. */
  scaleStyle: { transform: { scale: Animated.Value }[] };
  onPressIn: (ev: GestureResponderEvent) => void;
  onPressOut: (ev: GestureResponderEvent) => void;
} {
  const [scale] = useState(() => new Animated.Value(1));
  const pegas = (toValue: number) =>
    Animated.spring(scale, { toValue, ...SPRING }).start();
  return {
    scaleStyle: { transform: [{ scale }] },
    onPressIn: (ev) => {
      pegas(0.94);
      haptic('light');
      onPressIn?.(ev);
    },
    onPressOut: (ev) => {
      pegas(1);
      onPressOut?.(ev);
    },
  };
}
