import { forwardRef } from 'react';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import {
  layoutStory,
  lineY,
  STORY_H,
  STORY_W,
  type StoryDesign,
} from '@/lib/rhemaStory';

// Kartu Story 1080×1920 untuk rhema pagi — digambar sebagai SVG.
//
// Kenapa SVG, bukan menangkap tampilan biasa: react-native-svg SUDAH terpasang
// (dipakai grafik Investment & donat Finance) dan punya `toDataURL()` yang
// mengubahnya jadi PNG. Jadi tidak ada modul native baru sama sekali — dan
// karena ukurannya ditulis dalam viewBox, gambar yang keluar selalu tepat
// 1080×1920 berapa pun besar pratinjaunya di layar.
//
// `ref` diteruskan supaya layar pemakainya bisa memanggil toDataURL().
export const RhemaStoryCard = forwardRef<
  Svg,
  {
    text: string;
    design: StoryDesign;
    /** Tanggal yang dicetak di bawah, mis. "Minggu, 23 Agustus 2026". */
    dateLabel: string;
    /** Lebar tampil di layar; tingginya ikut proporsi 9:16. */
    width: number;
  }
>(function RhemaStoryCard({ text, design, dateLabel, width }, ref) {
  const layout = layoutStory(text);
  const height = (width * STORY_H) / STORY_W;

  return (
    <Svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${STORY_W} ${STORY_H}`}>
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={design.from} />
          <Stop offset="1" stopColor={design.to} />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width={STORY_W} height={STORY_H} fill="url(#bg)" />

      {/* Dua bulatan samar — memberi kedalaman tanpa mengganggu tulisannya */}
      <Circle cx={STORY_W - 60} cy={280} r={340} fill={design.glow} opacity={0.12} />
      <Circle cx={80} cy={STORY_H - 260} r={300} fill={design.glow} opacity={0.1} />

      {/* Kop atas */}
      <SvgText
        x={STORY_W / 2}
        y={330}
        fill={design.muted}
        fontSize={34}
        fontFamily="Inter_700Bold"
        letterSpacing={10}
        textAnchor="middle">
        RHEMA PAGI INI
      </SvgText>

      {/* Isi rhema — ukurannya menyesuaikan panjang teks (lihat layoutStory) */}
      {layout.lines.map((line, i) => (
        <SvgText
          key={`${i}-${line.slice(0, 12)}`}
          x={STORY_W / 2}
          y={lineY(layout, i)}
          fill={design.text}
          fontSize={layout.fontSize}
          fontFamily="Inter_700Bold"
          textAnchor="middle">
          {line}
        </SvgText>
      ))}

      {/* Kaki: garis tipis, tanggal, lalu tanda tangan app */}
      <Rect
        x={STORY_W / 2 - 90}
        y={STORY_H - 430}
        width={180}
        height={4}
        rx={2}
        fill={design.muted}
        opacity={0.6}
      />
      <SvgText
        x={STORY_W / 2}
        y={STORY_H - 350}
        fill={design.muted}
        fontSize={36}
        fontFamily="Inter_500Medium"
        textAnchor="middle">
        {dateLabel}
      </SvgText>
      <SvgText
        x={STORY_W / 2}
        y={STORY_H - 250}
        fill={design.muted}
        fontSize={30}
        fontFamily="Inter_600SemiBold"
        letterSpacing={6}
        textAnchor="middle">
        ✍️ vix
      </SvgText>
    </Svg>
  );
});
