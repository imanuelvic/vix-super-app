import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import { formatDecimal } from '@/lib/format';
import {
  fitBlockOf,
  FIT_BLOCK_ORDER,
  FIT_DAY_SHORT,
  FIT_PROGRAM,
  weightOf,
  type FitBlock,
  type FitWeights,
} from '@/lib/fitness';

// Tab Program 📅 — seluruh isi program dalam satu layar: Blok A & B, ketujuh
// hari beserta gerakan & beban tersimpannya. Blok berganti otomatis tiap 2
// minggu supaya tidak bosan tapi progres tetap terukur.
export function ProgramTab({ weights }: { weights: FitWeights }) {
  const activeBlock = fitBlockOf(new Date());
  const [block, setBlock] = useState<FitBlock>(activeBlock);

  // Daftar bloknya diambil dari lib (bukan ditulis ulang di sini) supaya
  // menambah blok baru cukup sekali di satu tempat.
  const activeAt = FIT_BLOCK_ORDER.indexOf(activeBlock);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SegmentTabs
        tabs={FIT_BLOCK_ORDER.map((b, i) => {
          // Berapa giliran lagi sampai blok ini jalan (0 = sedang jalan).
          const turns = (i - activeAt + FIT_BLOCK_ORDER.length) % FIT_BLOCK_ORDER.length;
          return {
            key: b,
            label: `Blok ${b}`,
            sub:
              turns === 0
                ? '● sekarang'
                : turns === 1
                  ? 'berikutnya'
                  : `${turns} giliran lagi`,
          };
        })}
        value={block}
        onChange={setBlock}
      />

      {FIT_PROGRAM[block].map((session) => (
        <View key={session.weekday} style={styles.dayBlock}>
          <VixText heading="title" additionalStyle={styles.dayTitle}>
            {FIT_DAY_SHORT[session.weekday]} — {session.emoji} {session.title}
          </VixText>
          <VixText heading="label" additionalStyle={styles.dayFocus}>
            {session.focus} · ±{session.minutes} menit
          </VixText>
          {session.exercises.map((ex) => {
            const kg = weightOf(ex, weights);
            return (
              <View key={ex.id} style={styles.exRow}>
                <View style={styles.exMain}>
                  <VixText heading="bold" additionalStyle={styles.exName}>
                    {ex.emoji} {ex.name}
                  </VixText>
                  <VixText heading="label">
                    {ex.sets} set × {ex.reps}
                  </VixText>
                </View>
                {/* Lari & jalan tidak punya beban — kolomnya dikosongkan. */}
                <VixText heading="label" additionalStyle={styles.exWeight}>
                  {ex.cardio
                    ? '⏱️'
                    : kg == null || kg === 0
                      ? 'BW'
                      : `${formatDecimal(kg)} kg`}
                </VixText>
              </View>
            );
          })}
        </View>
      ))}

      <View style={styles.restBlock}>
        <VixText heading="bold" additionalStyle={styles.restTitle}>
          🚶 Rabu & Minggu — Jalan Pagi
        </VixText>
        <VixText heading="label" additionalStyle={styles.restText}>
          Bukan bolos: otot dibangun saat istirahat. Jalan pagi boleh dicentang
          sebagai bonus, tapi tidak pernah memutus streak 🔥.
        </VixText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  dayBlock: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  dayTitle: { color: Color.TEXT_TITLE },
  dayFocus: { color: Color.FITNESS_DARK, marginBottom: 6 },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
  },
  exMain: { flex: 1, gap: 1 },
  exName: { color: Color.TEXT_TITLE },
  exWeight: { color: Color.FITNESS_DARK },
  restBlock: {
    backgroundColor: Color.CONTRAST_CONTAINER,
    borderRadius: 16,
    padding: 14,
    gap: 3,
  },
  restTitle: { color: Color.TEXT_TITLE },
  restText: { color: Color.TEXT_LABEL },
});
