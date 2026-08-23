import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Color } from '@/assets/style/color';
import { formatShortRupiah } from '@/lib/format';
import type { MarketPoint } from '@/lib/market';

const GOLD = '#C9A227'; // warna default garis & titik (emas)
// Tinggi total & ruang kosong di tiap sisi. PAD_B sengaja lebar: di bawah garis
// terendah ada DUA baris tulisan bertumpuk — label harga terendah lalu label
// bulan. Dulu PAD_B cuma 26 sehingga keduanya saling menimpa di iPhone
// ("Rp1 M" nabrak "Feb '26"). Tingginya ikut naik sebanyak tambahan PAD_B-nya,
// jadi bidang gambar garisnya tetap 162 px — bentuk grafiknya tidak berubah,
// yang bertambah hanya ruang napas di bawah.
const H = 224;
const PAD_L = 10;
const PAD_R = 10;
const PAD_T = 22;
const PAD_B = 40;
// Jarak baseline tiap baris tulisan bawah dari garis terendah / dasar grafik.
const LOW_LABEL_DY = 13; // label harga terendah, di bawah garis putus-putus
const AXIS_LABEL_DY = 8; // label bulan, menempel di dasar

// Bulan singkat + 2 digit tahun dari "YYYY-MM-DD" → mis. "Sep '24".
const M3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
function shortMonth(dateStr: string): string {
  const [y, m] = dateStr.split('-');
  return `${M3[Number(m) - 1]} '${y.slice(2)}`;
}

// Grafik garis harga berbasis SVG — untuk mempelajari tren aset. Dipakai Emas,
// Bitcoin, Forex & IHSG; `color` mengubah warna garis/label; `format` mengubah
// cara menulis nilai sumbu (default Rupiah singkat — IHSG memakai poin, bukan Rp).
export function PriceChart({
  series,
  width,
  color = GOLD,
  format = formatShortRupiah,
}: {
  series: MarketPoint[];
  width: number;
  color?: string;
  format?: (n: number) => string;
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
          stroke={color}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Titik terakhir saja (deret harian rapat, tak perlu titik tiap hari) */}
        <Circle cx={x(n - 1)} cy={y(last.price)} r={4.5} fill={color} />
        {/* Label harga tertinggi & terendah (kiri) */}
        <SvgText x={PAD_L} y={y(max) - 5} fontSize={10} fill={Color.TEXT_LABEL}>
          {format(max)}
        </SvgText>
        <SvgText
          x={PAD_L}
          y={y(min) + LOW_LABEL_DY}
          fontSize={10}
          fill={Color.TEXT_LABEL}>
          {format(min)}
        </SvgText>
        {/* Label harga terakhir (dekat titik terakhir) */}
        <SvgText
          x={width - PAD_R}
          y={y(last.price) - 8}
          fontSize={11}
          fontWeight="bold"
          fill={color}
          textAnchor="end">
          {format(last.price)}
        </SvgText>
        {/* Label bulan pertama & terakhir (sumbu X) — satu baris penuh di bawah
            label harga terendah, tidak lagi berdesakan dengannya. */}
        <SvgText
          x={PAD_L}
          y={H - AXIS_LABEL_DY}
          fontSize={10}
          fill={Color.TEXT_LABEL}>
          {shortMonth(series[0].date)}
        </SvgText>
        <SvgText
          x={width - PAD_R}
          y={H - AXIS_LABEL_DY}
          fontSize={10}
          fill={Color.TEXT_LABEL}
          textAnchor="end">
          {shortMonth(last.date)}
        </SvgText>
      </Svg>
    </View>
  );
}
