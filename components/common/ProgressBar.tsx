import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';

// Bar progres sederhana: track abu + isian berwarna sesuai persentase.
// Isiannya TIDAK langsung muncul penuh — ia menyapu dari kiri ke kanan
// (0,5 detik, melambat di ujung) setiap kali bar tampil atau angkanya berubah.
// Kemajuan jadi terasa "bergerak maju", bukan cuma gambar diam.
// Dipakai di Book (progres baca per-bab), Budgeting, & Tournament.
export function ProgressBar({
  value,
  total,
  color = Color.MAIN,
  height = 8,
}: {
  value: number;
  total: number;
  color?: string;
  height?: number;
}) {
  const pct = total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  const radius = height / 2;

  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withTiming(pct, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, grow]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${grow.value * 100}%`,
  }));

  return (
    <View style={[styles.track, { height, borderRadius: radius }]}>
      <Animated.View
        style={[
          { height: '100%', backgroundColor: color, borderRadius: radius },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: Color.BORDER, overflow: 'hidden' },
});
