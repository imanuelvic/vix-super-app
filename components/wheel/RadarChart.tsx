import { View } from 'react-native';
import Svg, { Line, Polygon, Text as SvgText } from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { radarGeometry } from '@/lib/wheel';

/**
 * Radar chart (jaring laba-laba) berbasis SVG — pengganti chart.js Radar
 * dari website lama. `values` = score 0–10 per sumbu; `secondary` opsional
 * (mis. target) digambar sebagai garis putus-putus.
 *
 * Letak titiknya dihitung `radarGeometry` di lib/wheel — rumus yang SAMA
 * dipakai PDF Wheel of Life, jadi roda di kertas tak mungkin beda bentuk dari
 * roda di layar.
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
  const g = radarGeometry(size, labels.length);
  const { cx, cy, r: R, point, ring } = g;
  const dataPoints = g.polygon;

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
        {/* Poligon score sekarang */}
        <Polygon
          points={dataPoints(values)}
          stroke={Color.MAIN}
          strokeWidth={2.5}
          fill={Color.MAIN}
          fillOpacity={0.25}
        />
        {/* Label emoji di ujung tiap sumbu */}
        {labels.map((label, i) => {
          const { x, y } = g.labelPos(i);
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
