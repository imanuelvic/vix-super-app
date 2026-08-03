import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';

// Bar progres sederhana: track abu + isian berwarna sesuai persentase.
// Dipakai di fitur Book (progres baca per-bab), bisa dipakai ulang di mana saja.
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
  return (
    <View style={[styles.track, { height, borderRadius: radius }]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height: '100%',
          backgroundColor: color,
          borderRadius: radius,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: Color.BORDER, overflow: 'hidden' },
});
