import { forwardRef } from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { fitKindMeta } from '@/lib/fitness';
import { ARCHIVE_NAME, lineY, type ShareDesign } from '@/lib/shareImage';
import {
  layoutCheer,
  workoutHeadline,
  workoutStats,
  WORKOUT_EMOJI_Y,
  WORKOUT_FOOT_Y,
  WORKOUT_H,
  WORKOUT_HEAD_Y,
  WORKOUT_MARGIN,
  WORKOUT_PLACE_Y,
  WORKOUT_RULE_BOTTOM_Y,
  WORKOUT_RULE_TOP_Y,
  WORKOUT_SALAM,
  WORKOUT_SALAM_Y,
  WORKOUT_STATS_Y,
  WORKOUT_TITLE_Y,
  WORKOUT_W,
  type WorkoutShare,
} from '@/lib/workoutShare';

// Kartu sesi olahraga 1080×1080 untuk grup WhatsApp — digambar sebagai SVG,
// cara yang sama persis dengan kartu Reminder 🕊️, Feed refleksi 📓, & Story
// ayat 📖. Tidak ada modul native baru: react-native-svg sudah terpasang dan
// punya `toDataURL()`.
//
// Bagian tengahnya RATA TENGAH, beda dari ketiga kartu lain yang rata kiri.
// Alasannya isi: yang di tengah cuma empat baris pendek (lambang, apa yang
// dijalani, angkanya, lokasinya) — rata kiri membuat keempatnya terbaca
// seperti potongan tabel, bukan satu kabar.
export const WorkoutShareCard = forwardRef<
  Svg,
  {
    share: WorkoutShare;
    design: ShareDesign;
    /** Lebar tampil di layar; tingginya ikut karena persegi. */
    width: number;
  }
>(function WorkoutShareCard({ share, design, width }, ref) {
  const { emoji } = fitKindMeta(share.kind);
  const layout = layoutCheer(share.cheer);
  const tengah = WORKOUT_W / 2;
  const kanan = WORKOUT_W - WORKOUT_MARGIN;
  const lebarGaris = WORKOUT_W - WORKOUT_MARGIN * 2;
  const tempat = share.place.trim();

  return (
    <Svg
      ref={ref}
      width={width}
      height={width}
      viewBox={`0 0 ${WORKOUT_W} ${WORKOUT_H}`}>
      <Rect x="0" y="0" width={WORKOUT_W} height={WORKOUT_H} fill={design.paper} />

      {/* Kop: sapaan jamnya di kiri (huruf besar berjarak), lambangnya di
          kanan. Lambangnya SENGAJA dipisah dari kata-katanya: jarak huruf yang
          membuat kop terbaca rapi justru merusak bentuk emoji. */}
      <SvgText
        x={WORKOUT_MARGIN}
        y={WORKOUT_HEAD_Y}
        fill={design.muted}
        fontSize={26}
        fontFamily="Inter_600SemiBold"
        letterSpacing={8}>
        {share.greeting.label.toUpperCase()}
      </SvgText>
      <SvgText x={kanan} y={WORKOUT_HEAD_Y + 6} fontSize={46} textAnchor="end">
        {share.greeting.emoji}
      </SvgText>
      <Rect
        x={WORKOUT_MARGIN}
        y={WORKOUT_RULE_TOP_Y}
        width={lebarGaris}
        height={2}
        fill={design.rule}
      />

      {/* Apa yang barusan dijalani */}
      <SvgText x={tengah} y={WORKOUT_EMOJI_Y} fontSize={110} textAnchor="middle">
        {emoji}
      </SvgText>
      <SvgText
        x={tengah}
        y={WORKOUT_TITLE_Y}
        fill={design.ink}
        fontSize={62}
        fontFamily="Inter_700Bold"
        textAnchor="middle">
        {workoutHeadline(share.kind, share.km)}
      </SvgText>
      <SvgText
        x={tengah}
        y={WORKOUT_STATS_Y}
        fill={design.ink}
        fontSize={36}
        fontFamily="Inter_500Medium"
        textAnchor="middle">
        {workoutStats(share.seconds, share.km)}
      </SvgText>
      {tempat ? (
        <SvgText
          x={tengah}
          y={WORKOUT_PLACE_Y}
          fill={design.muted}
          fontSize={30}
          fontFamily="Inter_400Regular"
          textAnchor="middle">
          {tempat}
        </SvgText>
      ) : null}

      {/* Kalimat penyemangatnya — apa adanya, cuma dipenggal per baris. */}
      {layout.lines.map((line, i) => (
        <SvgText
          key={`${i}-${line.slice(0, 12)}`}
          x={tengah}
          y={lineY(layout, i)}
          fill={design.ink}
          fontSize={layout.fontSize}
          fontFamily="Inter_500Medium"
          textAnchor="middle">
          {line}
        </SvgText>
      ))}

      <SvgText
        x={tengah}
        y={WORKOUT_SALAM_Y}
        fill={design.muted}
        fontSize={34}
        fontFamily="Inter_600SemiBold"
        textAnchor="middle">
        {WORKOUT_SALAM}
      </SvgText>

      <Rect
        x={WORKOUT_MARGIN}
        y={WORKOUT_RULE_BOTTOM_Y}
        width={lebarGaris}
        height={2}
        fill={design.rule}
      />

      {/* Kaki: tanggal di kiri, tanda arsip di kanan — sama dengan kartu lain,
          jadi semuanya terbaca sebagai satu keluarga. */}
      <SvgText
        x={WORKOUT_MARGIN}
        y={WORKOUT_FOOT_Y}
        fill={design.muted}
        fontSize={28}
        fontFamily="Inter_500Medium">
        {share.dateLabel}
      </SvgText>
      <SvgText
        x={kanan}
        y={WORKOUT_FOOT_Y}
        fill={design.muted}
        fontSize={28}
        fontFamily="Inter_500Medium"
        letterSpacing={2}
        textAnchor="end">
        {ARCHIVE_NAME}
      </SvgText>
    </Svg>
  );
});
