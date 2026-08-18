import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { type DeadlineTone } from '@/lib/deadline';

// Tampilan seragam untuk SEMUA daftar bertenggat. Warnanya diambil dari yang
// sudah dipakai Car → Sparepart & Residence → Perawatan (dua fitur yang
// tampilannya sudah benar), lalu dijadikan milik bersama:
//
//   🔴 merah  DANGER       — hari-H atau sudah lewat, kerjakan sekarang
//   🟡 kuning BUDGET_WARN  — tinggal sehari lagi
//   🟢 hijau  SUCCESS      — masih aman
//
// Dipakai dua-duanya bersamaan supaya satu baris punya DUA petunjuk sekaligus
// (garis tepi + tulisan), bukan cuma warna — jadi tetap terbaca sekilas.

/**
 * Garis tepi kartu. Disebar ke dalam `style` kartunya:
 *   <PressableScale style={[styles.card, deadlineBorder(tone)]}>
 * `unknown` tidak mengubah apa pun (kartu memakai garis tepi bawaannya).
 */
export function deadlineBorder(tone: DeadlineTone): StyleProp<ViewStyle> {
  return tone === 'unknown' ? null : borders[tone];
}

/** Tulisan sisa waktu, warnanya mengikuti nada yang sama. */
export function DeadlineTag({
  tone,
  label,
}: {
  tone: DeadlineTone;
  label: string;
}) {
  return (
    <VixText heading="label" additionalStyle={tags[tone]}>
      {label}
    </VixText>
  );
}

const borders = StyleSheet.create({
  over: { borderColor: Color.DANGER, borderWidth: 1.5 },
  warn: { borderColor: Color.BUDGET_WARN, borderWidth: 1.5 },
  ok: { borderColor: Color.SUCCESS, borderWidth: 1.5 },
});

// Kuningnya sengaja BUKAN BUDGET_WARN: warna itu terlalu terang untuk teks di
// atas latar putih. Dipakai WARNING (cokelat) — persis seperti Car & Residence.
const tags = StyleSheet.create({
  over: { color: Color.DANGER },
  warn: { color: Color.WARNING },
  ok: { color: Color.SUCCESS },
  unknown: { color: Color.TEXT_PLACEHOLDER },
});
