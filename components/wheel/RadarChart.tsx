import { View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

import { Color } from '@/assets/style/color';

/**
 * Radar chart (jaring laba-laba) berbasis SVG — pengganti chart.js Radar
 * dari website lama. `values` = skor 0–10 per sumbu; `secondary` opsional
 * (mis. target) digambar sebagai garis putus-putus.
 */
export function RadarChart({
  size = 300,
  values,
  secondary,
  labels,
}: {
  size?: number;
  values: number[];
  secondary?: number[];
  labels: string[]; // emoji per sumbu
}) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 26; // sisakan ruang untuk label emoji
  const N = labels.length;

  const angle = (i: number) => ((-90 + (360 / N) * i) * Math.PI) / 180;
  const point = (i: number, r: number) =>
    `${cx + r * Math.cos(angle(i))},${cy + r * Math.sin(angle(i))}`;
  const ring = (frac: number) =>
    labels.map((_, i) => point(i, R * frac)).join(' ');
  const dataPoints = (vals: number[]) =>
    vals
      .map((v, i) => point(i, (R * Math.max(0, Math.min(v, 10))) / 10))
      .join(' ');

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Cincin grid: nilai 2, 4, 6, 8, 10 */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((frac) => (
          <Polygon
            key={frac}
            points={ring(frac)}
            stroke={Color.BORDER}
            strokeWidth={1}
            fill="none"
          />
        ))}
        {/* Garis sumbu dari pusat ke tiap area */}
        {labels.map((_, i) => {
          const [x, y] = point(i, R).split(',');
          return (
            <Line
              key={i}
              x1={cx}
              y1={cy}
              x2={Number(x)}
              y2={Number(y)}
              stroke={Color.BORDER}
              strokeWidth={1}
            />
          );
        })}
        {/* Poligon target (putus-putus) */}
        {secondary && (
          <Polygon
            points={dataPoints(secondary)}
            stroke={Color.ACCENT_DARK}
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="none"
          />
        )}
        {/* Poligon skor sekarang */}
        <Polygon
          points={dataPoints(values)}
          stroke={Color.MAIN}
          strokeWidth={2.5}
          fill={Color.MAIN}
          fillOpacity={0.25}
        />
        {/* Label emoji di ujung tiap sumbu */}
        {labels.map((label, i) => {
          const r = R + 15;
          const x = cx + r * Math.cos(angle(i));
          const y = cy + r * Math.sin(angle(i));
          return (
            <SvgText
              key={i}
              x={x}
              y={y + 5}
              fontSize={15}
              textAnchor="middle">
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}
