import { View } from 'react-native';
import Svg, {
  Circle,
  Line,
  Polyline,
  Text as SvgText,
} from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { formatShortRupiah } from '@/lib/format';
import type { GoldPoint } from '@/lib/investment';

const GOLD = '#C9A227'; // warna emas untuk garis & titik
const H = 210;
const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 22;
const PAD_B = 26;

// Bulan singkat + 2 digit tahun dari "YYYY-MM-DD" → mis. "Sep '24".
const M3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function shortMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-');
  return `${M3[Number(m) - 1]} '${y.slice(2)}`;
}

// Grafik garis harga emas berbasis SVG — untuk mempelajari tren tiap tanggal 3.
export function GoldChart({
  series,
  width,
}: {
  series: GoldPoint[];
  width: number;
}) {
  if (series.length < 2 || width <= 0) return null;

  const prices = series.map((s) => s.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const n = series.length;

  const plotW = width - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (i / (n - 1)) * plotW;
  const y = (p: number) => PAD_T + (1 - (p - min) / range) * plotH;

  const points = series.map((s, i) => `${x(i)},${y(s.price)}`).join(' ');
  const last = series[n - 1];

  return (
    <View style={{ width, height: H }}>
      <Svg width={width} height={H}>
        {/* Garis grid atas & bawah (max & min) */}
        {[max, min].map((p) => (
          <Line
            key={p}
            x1={PAD_L}
            y1={y(p)}
            x2={width - PAD_R}
            y2={y(p)}
            stroke={Color.BORDER}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
        {/* Garis harga */}
        <Polyline
          points={points}
          fill="none"
          stroke={GOLD}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Titik tiap bulan */}
        {series.map((s, i) => (
          <Circle
            key={s.date}
            cx={x(i)}
            cy={y(s.price)}
            r={i === n - 1 ? 4.5 : 2.5}
            fill={i === n - 1 ? GOLD : Color.CONTAINER}
            stroke={GOLD}
            strokeWidth={1.5}
          />
        ))}
        {/* Label harga tertinggi & terendah (kiri) */}
        <SvgText x={PAD_L} y={y(max) - 5} fontSize={10} fill={Color.TEXT_LABEL}>
          {formatShortRupiah(max)}
        </SvgText>
        <SvgText x={PAD_L} y={y(min) + 13} fontSize={10} fill={Color.TEXT_LABEL}>
          {formatShortRupiah(min)}
        </SvgText>
        {/* Label harga terakhir (dekat titik terakhir) */}
        <SvgText
          x={width - PAD_R}
          y={y(last.price) - 8}
          fontSize={11}
          fontWeight="bold"
          fill={GOLD}
          textAnchor="end">
          {formatShortRupiah(last.price)}
        </SvgText>
        {/* Label bulan pertama & terakhir (sumbu X) */}
        <SvgText x={PAD_L} y={H - 8} fontSize={10} fill={Color.TEXT_LABEL}>
          {shortMonth(series[0].date)}
        </SvgText>
        <SvgText
          x={width - PAD_R}
          y={H - 8}
          fontSize={10}
          fill={Color.TEXT_LABEL}
          textAnchor="end">
          {shortMonth(last.date)}
        </SvgText>
      </Svg>
    </View>
  );
}
