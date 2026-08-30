import { forwardRef } from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import {
  layoutReminder,
  REMINDER_FOOT_Y,
  REMINDER_H,
  REMINDER_HEAD_Y,
  REMINDER_MARGIN,
  REMINDER_RULE_BOTTOM_Y,
  REMINDER_RULE_TOP_Y,
  REMINDER_W,
  splitLeadingEmoji,
} from '@/lib/reminderImage';
import { ARCHIVE_NAME, lineY, type ShareDesign } from '@/lib/shareImage';

// Kartu Reminder 1080×1080 (persegi) — digambar sebagai SVG, cara yang sama
// persis dengan Feed refleksi & Story ayat. Tidak ada modul native baru:
// react-native-svg sudah terpasang dan punya `toDataURL()`.
//
// Sengaja PALING SEDERHANA dari ketiganya. Ini kartu yang dilempar ke grup
// WhatsApp untuk dibaca sekilas, jadi isinya cuma: kop kecil, kalimatnya, dan
// tanggal. Tidak ada bingkai, tidak ada hiasan — apa pun yang ditambahkan di
// sini cuma mengurangi ruang untuk kalimatnya sendiri.
export const ReminderShareCard = forwardRef<
  Svg,
  {
    /** Kalimat reminder-nya, boleh diawali emoji. */
    text: string;
    design: ShareDesign;
    /** Tanggal yang dicetak di kaki, mis. "Minggu, 30 Agustus 2026". */
    dateLabel: string;
    /** Lebar tampil di layar; tingginya ikut karena persegi. */
    width: number;
  }
>(function ReminderShareCard({ text, design, dateLabel, width }, ref) {
  // Emoji pembuka dipajang besar sendiri di atas — bukan sekadar rupa: kalau
  // ikut masuk badan teks, pemenggal barisnya (yang menghitung per karakter)
  // salah mengukur lebarnya dan barisnya melar keluar kartu.
  const { emoji, body } = splitLeadingEmoji(text);
  const layout = layoutReminder(body);
  const kanan = REMINDER_W - REMINDER_MARGIN;
  const lebarGaris = REMINDER_W - REMINDER_MARGIN * 2;

  return (
    <Svg
      ref={ref}
      width={width}
      height={width}
      viewBox={`0 0 ${REMINDER_W} ${REMINDER_H}`}>
      <Rect
        x="0"
        y="0"
        width={REMINDER_W}
        height={REMINDER_H}
        fill={design.paper}
      />

      {/* Kop: judulnya di kiri, emoji hari itu di kanan */}
      <SvgText
        x={REMINDER_MARGIN}
        y={REMINDER_HEAD_Y}
        fill={design.muted}
        fontSize={26}
        fontFamily="Inter_600SemiBold"
        letterSpacing={8}>
        REMINDER
      </SvgText>
      {emoji ? (
        <SvgText
          x={kanan}
          y={REMINDER_HEAD_Y + 6}
          fontSize={46}
          textAnchor="end">
          {emoji}
        </SvgText>
      ) : null}
      <Rect
        x={REMINDER_MARGIN}
        y={REMINDER_RULE_TOP_Y}
        width={lebarGaris}
        height={2}
        fill={design.rule}
      />

      {/* Kalimatnya — apa adanya, cuma dipenggal per baris. */}
      {layout.lines.map((line, i) => (
        <SvgText
          key={`${i}-${line.slice(0, 12)}`}
          x={REMINDER_MARGIN}
          y={lineY(layout, i)}
          fill={design.ink}
          fontSize={layout.fontSize}
          fontFamily="Inter_500Medium">
          {line}
        </SvgText>
      ))}

      <Rect
        x={REMINDER_MARGIN}
        y={REMINDER_RULE_BOTTOM_Y}
        width={lebarGaris}
        height={2}
        fill={design.rule}
      />

      {/* Kaki: tanggal di kiri, tanda arsip di kanan */}
      <SvgText
        x={REMINDER_MARGIN}
        y={REMINDER_FOOT_Y}
        fill={design.muted}
        fontSize={28}
        fontFamily="Inter_500Medium">
        {dateLabel}
      </SvgText>
      <SvgText
        x={kanan}
        y={REMINDER_FOOT_Y}
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
