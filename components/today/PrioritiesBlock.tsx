import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BLOCK_CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { priorityFilled, savePriorityDay, type PriorityDay } from '@/lib/priority';

// 💡 3 HAL TERPENTING HARI INI — jawabanmu sendiri, bukan hitungan mesin.
// Today Engine menyarankan; blok ini yang kamu putuskan tiap pagi. Dicoret
// langsung dari sini (1 tulis); mengisi/mengubah teksnya di layar Daily
// Priority (click judulnya atau baris kosong).
export function PrioritiesBlock({ day, todayId }: { day: PriorityDay; todayId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const filled = priorityFilled(day.items);
  const buka = () => router.push('/daily-priority');

  function toggle(index: number) {
    if (!user) return;
    const it = day.items[index];
    if (!it.text.trim()) return buka();
    const next = day.items.map((x, i) => (i === index ? { ...x, done: !x.done } : x));
    savePriorityDay(user.uid, todayId, next).catch(() => undefined);
  }

  return (
    <View style={styles.card}>
      <PressableScale style={styles.head} onPress={buka} hitSlop={6}>
        <View style={styles.headMain}>
          <VixText heading="eyebrow">3 hal terpenting hari ini</VixText>
          <VixText heading="label">
            {day.skipped
              ? 'Hari ini sengaja dilewati'
              : filled === 0
                ? 'Pilih tiga, bukan sepuluh. Sisanya menunggu.'
                : filled < 3
                  ? `${filled} dari 3 terisi`
                  : 'Milikmu, bukan hitungan mesin'}
          </VixText>
        </View>
        <IconSymbol name="chevron.right" size={18} color={Color.TEXT_PLACEHOLDER} />
      </PressableScale>
      {!day.skipped && (
        <View style={styles.rows}>
          {day.items.map((it, i) => {
            const kosong = !it.text.trim();
            return (
              <PressableScale
                key={i}
                style={styles.row}
                onPress={() => toggle(i)}
                haptic={kosong ? 'light' : 'success'}>
                <CheckCircle checked={it.done} size={24} />
                <VixText
                  heading={kosong ? 'label' : 'paragraph'}
                  numberOfLines={2}
                  additionalStyle={[
                    styles.rowText,
                    kosong && styles.rowEmpty,
                    it.done && styles.rowDone,
                  ]}>
                  {kosong ? `Prioritas ${i + 1}` : it.text}
                </VixText>
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...BLOCK_CARD, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headMain: { flex: 1, gap: 2 },
  rows: { marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  rowText: { flex: 1, color: Color.TEXT_TITLE },
  rowEmpty: { color: Color.TEXT_PLACEHOLDER },
  rowDone: { color: Color.TEXT_LABEL, textDecorationLine: 'line-through' },
});
