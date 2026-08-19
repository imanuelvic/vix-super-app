import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { ProgressBar } from '@/components/common/ProgressBar';

/** Skor Wheel of Life selalu 1–10. */
const MAX_SCORE = 10;

/**
 * Meteran skor area fokus: SATU bar yang memuat dua angka sekaligus —
 * isian mint pucat sampai TARGET, lalu isian warna nada skor sampai posisi
 * SEKARANG ditumpuk di atasnya. Sekali lihat langsung terbaca "aku di sini,
 * targetku sampai sana", tanpa perlu membaca dua angka terpisah.
 *
 * Keduanya ikut animasi sapuan bawaan ProgressBar, jadi saat kartu muncul
 * bar target dan bar sekarang tumbuh bareng.
 */
export function ScoreMeter({
  value,
  target,
  color,
  height = 10,
}: {
  value: number;
  target: number;
  color: string;
  height?: number;
}) {
  return (
    <View style={{ height }}>
      <ProgressBar
        value={target}
        total={MAX_SCORE}
        color={Color.MAIN_LIGHT}
        height={height}
      />
      {/* Isian "sekarang" ditumpuk di atas — alurnya transparan supaya isian
          target di bawahnya tetap kelihatan. pointerEvents none: kartunya
          bisa ditekan, lapisan ini jangan menelan sentuhan. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <ProgressBar
          value={value}
          total={MAX_SCORE}
          color={color}
          height={height}
          track="transparent"
        />
      </View>
    </View>
  );
}
