import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { Color } from '@/assets/style/color';

export type DonutSlice = {
  value: number;
  color: string;
};

/**
 * Grafik donat sederhana berbasis SVG (tanpa library chart).
 * Teknik: tiap irisan = lingkaran dengan strokeDasharray sepanjang porsinya,
 * digeser dengan strokeDashoffset, lalu seluruhnya diputar -90° agar mulai
 * dari atas. `children` dirender di tengah lubang donat (mis. total).
 */
export function DonutChart({
  slices,
  size = 220,
  thickness = 34,
  children,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  children?: React.ReactNode;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulated = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {total === 0 ? (
            // Belum ada data: tampilkan cincin abu-abu kosong.
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={Color.CONTRAST_CONTAINER}
              strokeWidth={thickness}
              fill="none"
            />
          ) : (
            slices
              .filter((s) => s.value > 0)
              .map((s, index) => {
                const fraction = s.value / total;
                const element = (
                  <Circle
                    key={index}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={s.color}
                    strokeWidth={thickness}
                    strokeDasharray={`${fraction * circumference} ${circumference}`}
                    strokeDashoffset={-accumulated * circumference}
                    fill="none"
                  />
                );
                accumulated += fraction;
                return element;
              })
          )}
        </G>
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
