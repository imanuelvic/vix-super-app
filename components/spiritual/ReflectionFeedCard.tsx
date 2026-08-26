import { forwardRef } from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import {
  ARCHIVE_NAME,
  FEED_H,
  FEED_MARGIN,
  FEED_W,
  layoutFeed,
  lineY,
  type FeedDesign,
} from '@/lib/reflectionFeed';

// Kartu Feed Instagram 1080×1350 (4:5) untuk Daily Reflection Journal —
// digambar sebagai SVG.
//
// Kenapa SVG, bukan menangkap tampilan biasa: react-native-svg SUDAH terpasang
// (dipakai grafik Investment & donat Finance) dan punya `toDataURL()` yang
// mengubahnya jadi PNG. Jadi tidak ada modul native baru sama sekali — dan
// karena ukurannya ditulis dalam viewBox, gambar yang keluar selalu tepat
// 1080×1350 berapa pun besar pratinjaunya di layar.
//
// Susunannya sengaja seperti selembar halaman arsip, bukan kartu kutipan:
//   · bingkai rambut tipis        → terasa selembar kertas, bukan latar penuh
//   · kop kecil + nomor arsip     → "ini lembar ke sekian", bukan poster
//   · tulisan RATA KIRI           → jurnal; rata tengah itu bahasa quote card
//   · kaki: tanggal & vixtory.archive
//
// `ref` diteruskan supaya layar pemakainya bisa memanggil toDataURL().
export const ReflectionFeedCard = forwardRef<
  Svg,
  {
    text: string;
    design: FeedDesign;
    /** Tanggal yang dicetak di kaki, mis. "Rabu, 26 Agustus 2026". */
    dateLabel: string;
    /** Nomor arsip hari itu, mis. "No. 238". */
    archiveLabel: string;
    /** Lebar tampil di layar; tingginya ikut proporsi 4:5. */
    width: number;
  }
>(function ReflectionFeedCard(
  { text, design, dateLabel, archiveLabel, width },
  ref,
) {
  const layout = layoutFeed(text);
  const height = (width * FEED_H) / FEED_W;
  const kanan = FEED_W - FEED_MARGIN;

  return (
    <Svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${FEED_W} ${FEED_H}`}>
      <Rect x="0" y="0" width={FEED_W} height={FEED_H} fill={design.paper} />

      {/* Bingkai rambut — satu-satunya hiasan. Tidak ada gradien, bulatan,
          maupun tanda kutip besar: yang harus menonjol itu tulisannya. */}
      <Rect
        x={48}
        y={48}
        width={FEED_W - 96}
        height={FEED_H - 96}
        fill="none"
        stroke={design.rule}
        strokeWidth={2}
      />

      {/* Kop: nama jurnalnya di kiri, nomor arsip di kanan */}
      <SvgText
        x={FEED_MARGIN}
        y={190}
        fill={design.muted}
        fontSize={26}
        fontFamily="Inter_600SemiBold"
        letterSpacing={8}>
        DAILY REFLECTION
      </SvgText>
      <SvgText
        x={kanan}
        y={190}
        fill={design.muted}
        fontSize={26}
        fontFamily="Inter_500Medium"
        letterSpacing={4}
        textAnchor="end">
        {archiveLabel}
      </SvgText>
      <Rect
        x={FEED_MARGIN}
        y={224}
        width={FEED_W - FEED_MARGIN * 2}
        height={2}
        fill={design.rule}
      />

      {/* Refleksinya — apa adanya, cuma dipenggal per baris. Ukurannya
          menyesuaikan panjang tulisan (lihat layoutFeed). */}
      {layout.lines.map((line, i) => (
        <SvgText
          key={`${i}-${line.slice(0, 12)}`}
          x={FEED_MARGIN}
          y={lineY(layout, i)}
          fill={design.ink}
          fontSize={layout.fontSize}
          fontFamily="Inter_500Medium">
          {line}
        </SvgText>
      ))}

      {/* Kaki: tanggal di kiri, tanda arsip di kanan */}
      <Rect
        x={FEED_MARGIN}
        y={FEED_H - 200}
        width={FEED_W - FEED_MARGIN * 2}
        height={2}
        fill={design.rule}
      />
      <SvgText
        x={FEED_MARGIN}
        y={FEED_H - 140}
        fill={design.muted}
        fontSize={28}
        fontFamily="Inter_500Medium">
        {dateLabel}
      </SvgText>
      <SvgText
        x={kanan}
        y={FEED_H - 140}
        fill={design.muted}
        fontSize={28}
        fontFamily="Inter_600SemiBold"
        letterSpacing={2}
        textAnchor="end">
        {ARCHIVE_NAME}
      </SvgText>
    </Svg>
  );
});
