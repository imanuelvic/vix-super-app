import { View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';

import { Color } from '@/assets/style/color';

// Kolom mingguan 📊 (3 Okt 2026) — dipakai kartu Konsistensi di Fitness ›
// Progress: hari angkat beban & langkah per minggu, delapan minggu terakhir.
//
// SATU deret, satu warna — ini bukan grafik kategori, jadi tidak perlu legenda
// (judul kartunya sudah menyebut apa yang digambar). Bentuknya dibuat tenang:
//   • kolom paling lebar 24 px, ujung atas membulat 4 px, dasarnya persegi;
//   • garis dasar & garis patokan berupa garis rambut, bukan garis tebal;
//   • angka cuma ditulis di kolom MINGGU INI — tujuh minggu lainnya dibaca
//     dari tingginya terhadap garis patokan, bukan dari deretan angka.
// Teks memakai warna teks, bukan warna kolomnya.

const H = 112;
const PAD_T = 18; // ruang angka di atas kolom minggu ini
const PAD_B = 18; // ruang label minggu di bawah garis dasar
const PAD_X = 2;
const R = 4; // jari-jari ujung atas kolom

/** Kolom dengan ujung atas membulat & dasar persegi (bukan Rect ber-rx). */
function columnPath(x: number, w: number, top: number, base: number): string {
  const h = base - top;
  if (h <= 0) return '';
  const r = Math.min(R, w / 2, h);
  return [
    `M ${x} ${base}`,
    `L ${x} ${top + r}`,
    `Q ${x} ${top} ${x + r} ${top}`,
    `L ${x + w - r} ${top}`,
    `Q ${x + w} ${top} ${x + w} ${top + r}`,
    `L ${x + w} ${base}`,
    'Z',
  ].join(' ');
}

export function WeekBars({
  data,
  width,
  color,
  format,
  goal,
  goalLabel,
}: {
  /** Urut LAMA → BARU; yang terakhir = minggu berjalan. */
  data: { label: string; value: number }[];
  width: number;
  color: string;
  /** Tulisan angka di atas kolom minggu ini, mis. "3 hari", "52rb". */
  format: (n: number) => string;
  /** Garis patokan (mis. anjuran 2 hari); kosong = tanpa garis. */
  goal?: number;
  goalLabel?: string;
}) {
  if (width <= 0 || data.length === 0) return null;

  const plotW = width - PAD_X * 2;
  const plotH = H - PAD_T - PAD_B;
  const base = PAD_T + plotH;
  const max = Math.max(goal ?? 0, ...data.map((d) => d.value), 1);
  const slot = plotW / data.length;
  const barW = Math.min(24, slot * 0.6);
  const y = (v: number) => PAD_T + (1 - v / max) * plotH;
  const xOf = (i: number) => PAD_X + i * slot + (slot - barW) / 2;
  const last = data.length - 1;

  return (
    <View style={{ width, height: H }}>
      <Svg width={width} height={H}>
        {/* Garis dasar */}
        <Line
          x1={PAD_X}
          y1={base}
          x2={width - PAD_X}
          y2={base}
          stroke={Color.BORDER}
          strokeWidth={1}
        />
        {/* Garis patokan — di belakang kolom, labelnya di kiri atas garis
            (angka minggu ini ada di kanan, jadi keduanya tidak bertabrakan). */}
        {goal ? (
          <>
            <Line
              x1={PAD_X}
              y1={y(goal)}
              x2={width - PAD_X}
              y2={y(goal)}
              stroke={Color.TEXT_PLACEHOLDER}
              strokeWidth={1}
            />
            {goalLabel ? (
              <SvgText
                x={PAD_X}
                y={y(goal) - 4}
                fontSize={10}
                fill={Color.TEXT_LABEL}>
                {goalLabel}
              </SvgText>
            ) : null}
          </>
        ) : null}
        {data.map((d, i) => (
          <Path
            key={`${d.label}-${i}`}
            d={columnPath(xOf(i), barW, y(d.value), base)}
            fill={color}
          />
        ))}
        {/* Angka minggu ini saja, di atas kolomnya */}
        <SvgText
          x={xOf(last) + barW / 2}
          y={y(data[last].value) - 5}
          fontSize={11}
          fontWeight="bold"
          fill={Color.TEXT_TITLE}
          textAnchor="middle">
          {format(data[last].value)}
        </SvgText>
        {/* Label minggu pertama & minggu berjalan */}
        <SvgText x={xOf(0)} y={H - 4} fontSize={10} fill={Color.TEXT_LABEL}>
          {data[0].label}
        </SvgText>
        <SvgText
          x={xOf(last) + barW}
          y={H - 4}
          fontSize={10}
          fill={Color.TEXT_LABEL}
          textAnchor="end">
          {data[last].label}
        </SvgText>
      </Svg>
    </View>
  );
}
