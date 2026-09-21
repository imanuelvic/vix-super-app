import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import {
  JOURNEY_STEPS,
  journeyStepIndex,
  type JourneyStepKey,
} from '@/lib/journey';

/**
 * Jejak perjalanan 🌅 📖 💭 ❤️ 🎵 🙏 🌤️ di atas kartu — penunjuk yang sangat
 * halus: langkah yang sudah dilalui & yang sedang dijalani terang, yang belum
 * pudar; yang sedang dijalani diberi titik kecil di bawahnya. SENGAJA tanpa
 * angka ("3/7") atau persen: itu bahasa daftar tugas, bukan perjalanan.
 *
 * Langkah yang sudah dilalui bisa di-click untuk kembali (mis. menambah
 * tulisan refleksi); yang belum, tidak — urutannya memang mengalir ke depan.
 */
export function JourneyTrail({
  current,
  onJump,
}: {
  current: JourneyStepKey;
  onJump: (step: JourneyStepKey) => void;
}) {
  const now = journeyStepIndex(current);
  return (
    <View style={styles.row}>
      {JOURNEY_STEPS.map((s, i) => {
        const passed = i < now;
        const active = i === now;
        return (
          <PressableScale
            key={s.key}
            style={styles.stop}
            onPress={() => onJump(s.key)}
            disabled={!passed}
            hitSlop={6}
            accessibilityLabel={s.label}>
            <VixText
              additionalStyle={[
                styles.emoji,
                !passed && !active && styles.emojiFuture,
              ]}>
              {s.emoji}
            </VixText>
            <View style={[styles.dot, active && styles.dotActive]} />
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginTop: 8,
    marginBottom: 18,
  },
  stop: { alignItems: 'center', gap: 5, minWidth: 34 },
  emoji: { fontSize: 20, lineHeight: 26 },
  emojiFuture: { opacity: 0.35 },
  // Titik penanda langkah aktif; yang lain tetap memakan tempat yang sama
  // (transparan) supaya barisnya tidak melompat saat berpindah.
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: Color.TEXT_REVERSE },
});
