import type { ReactNode } from 'react';
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { haptic, type HapticKind } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Konfigurasi pegas dipakai bersama biar semua tombol terasa sama enaknya.
const SPRING = { damping: 15, stiffness: 320, mass: 0.5 };

// Pressable dengan umpan balik sentuh: sedikit mengecil saat ditekan lalu
// memantul balik, DITAMBAH getaran halus (haptic) — dua indra sekaligus, itu
// yang bikin sentuhan terasa "berbunyi" walau layarnya diam.
//
// Jadi fondasi tombol & kartu supaya terasa hidup dan modern — ringan karena
// animasi jalan di UI thread (Reanimated), tanpa re-render React.
//
// CATATAN untuk yang memakai: JANGAN kirim `transform` lewat prop `style`.
// Transform di sini dipakai untuk animasi tekan; kalau ditimpa dari luar,
// efek mengecilnya hilang. Kirim warna/ukuran saja.
export function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  haptic: hapticKind = 'light',
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  /** Jenis getaran saat disentuh. `false` = diam. */
  haptic?: HapticKind | false;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        // Tombol nonaktif tidak boleh terasa hidup: sebelumnya ia tetap
        // mengecil & bergetar seolah bisa ditekan padahal tidak melakukan apa
        // pun — itu bikin bingung.
        if (!rest.disabled) {
          scale.value = withSpring(scaleTo, SPRING);
          if (hapticKind) haptic(hapticKind);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, SPRING);
        onPressOut?.(e);
      }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
