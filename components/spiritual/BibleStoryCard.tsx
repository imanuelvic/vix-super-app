import { forwardRef } from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import {
  layoutStory,
  STORY_FOOT_Y,
  STORY_FRAME,
  STORY_H,
  STORY_HEAD_Y,
  STORY_MARGIN,
  STORY_REF_Y,
  STORY_RULE_BOTTOM_Y,
  STORY_RULE_TOP_Y,
  STORY_W,
} from '@/lib/bibleStory';
import { ARCHIVE_NAME, lineY, type ShareDesign } from '@/lib/shareImage';

// Kartu Story Instagram 1080×1920 (9:16) untuk ayat Alkitab — digambar sebagai
// SVG, cara yang sama persis dengan Feed refleksi (ReflectionFeedCard).
//
// react-native-svg SUDAH terpasang (dipakai grafik Investment & donat Finance)
// dan punya `toDataURL()` yang mengubahnya jadi PNG — jadi tidak ada modul
// native baru. Ukurannya ditulis dalam viewBox, jadi gambar yang keluar selalu
// tepat 1080×1920 berapa pun besar pratinjaunya di layar.
//
// Bedanya dengan Feed cuma tata letaknya, dan itu disengaja: bingkainya tidak
// memenuhi kanvas karena Instagram menaruh tombolnya di pita atas & bawah.
// Susunannya tetap satu keluarga — kop kecil, tulisan RATA KIRI, dan kaki
// berisi tanggal + vixtory.archive.
export const BibleStoryCard = forwardRef<
  Svg,
  {
    /** Bunyi ayatnya (boleh kosong — acuannya yang jadi tokoh utama). */
    verse: string;
    /** Acuan bacaannya, mis. "Mazmur 23:1-6". */
    reference: string;
    /** Kop kecil di atas, mis. "MORNING BIBLE READING". */
    sessionLabel: string;
    design: ShareDesign;
    /** Tanggal yang dicetak di kaki, mis. "Rabu, 26 Agustus 2026". */
    dateLabel: string;
    /** Nomor arsip hari itu, mis. "No. 238". */
    archiveLabel: string;
    /** Lebar tampil di layar; tingginya ikut proporsi 9:16. */
    width: number;
  }
>(function BibleStoryCard(
  { verse, reference, sessionLabel, design, dateLabel, archiveLabel, width },
  ref,
) {
  // Tanpa bunyi ayat, ACUANNYA yang naik jadi tulisan utama — jadi kartunya
  // tetap punya isi, bukan kotak kosong bertanggal.
  const hero = verse.trim() || reference;
  const layout = layoutStory(hero);
  const height = (width * STORY_H) / STORY_W;
  const kanan = STORY_W - STORY_MARGIN;
  const lebarGaris = STORY_W - STORY_MARGIN * 2;

  return (
    <Svg
      ref={ref}
      width={width}
      height={height}
      viewBox={`0 0 ${STORY_W} ${STORY_H}`}>
      <Rect x="0" y="0" width={STORY_W} height={STORY_H} fill={design.paper} />

      {/* Bingkai rambut — satu-satunya hiasan, dan sengaja tidak memenuhi
          kanvas supaya tidak tertutup tombol Instagram di atas & bawah. */}
      <Rect
        x={STORY_FRAME.x}
        y={STORY_FRAME.y}
        width={STORY_FRAME.w}
        height={STORY_FRAME.h}
        fill="none"
        stroke={design.rule}
        strokeWidth={2}
      />

      {/* Kop: sesi bacanya di kiri, nomor arsip di kanan */}
      <SvgText
        x={STORY_MARGIN}
        y={STORY_HEAD_Y}
        fill={design.muted}
        fontSize={26}
        fontFamily="Inter_600SemiBold"
        letterSpacing={8}>
        {sessionLabel}
      </SvgText>
      <SvgText
        x={kanan}
        y={STORY_HEAD_Y}
        fill={design.muted}
        fontSize={26}
        fontFamily="Inter_500Medium"
        letterSpacing={4}
        textAnchor="end">
        {archiveLabel}
      </SvgText>
      <Rect
        x={STORY_MARGIN}
        y={STORY_RULE_TOP_Y}
        width={lebarGaris}
        height={2}
        fill={design.rule}
      />

      {/* Ayatnya — apa adanya, cuma dipenggal per baris. */}
      {layout.lines.map((line, i) => (
        <SvgText
          key={`${i}-${line.slice(0, 12)}`}
          x={STORY_MARGIN}
          y={lineY(layout, i)}
          fill={design.ink}
          fontSize={layout.fontSize}
          fontFamily="Inter_500Medium">
          {line}
        </SvgText>
      ))}

      {/* Acuannya. Kalau tadi acuannya sendiri yang jadi tulisan utama
          (ayatnya belum diketik), baris ini tidak digambar lagi — percuma
          menulis hal yang sama dua kali. */}
      {verse.trim() ? (
        <SvgText
          x={STORY_MARGIN}
          y={STORY_REF_Y}
          fill={design.ink}
          fontSize={34}
          fontFamily="Inter_600SemiBold"
          letterSpacing={2}>
          — {reference}
        </SvgText>
      ) : null}

      {/* Kaki: tanggal di kiri, tanda arsip di kanan */}
      <Rect
        x={STORY_MARGIN}
        y={STORY_RULE_BOTTOM_Y}
        width={lebarGaris}
        height={2}
        fill={design.rule}
      />
      <SvgText
        x={STORY_MARGIN}
        y={STORY_FOOT_Y}
        fill={design.muted}
        fontSize={28}
        fontFamily="Inter_500Medium">
        {dateLabel}
      </SvgText>
      <SvgText
        x={kanan}
        y={STORY_FOOT_Y}
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
