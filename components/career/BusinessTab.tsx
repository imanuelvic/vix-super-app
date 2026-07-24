import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Tab Business 🍧: masih coming soon — mimpi yang menunggu waktunya:
// es cendol & sambal roa khas Manado, masakan mama.
export function BusinessTab() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <VixText additionalStyle={styles.emoji}>🍧🐟</VixText>
        <VixText heading="title" additionalStyle={styles.title}>
          Coming Soon 🚧
        </VixText>
        <VixText heading="paragraph" additionalStyle={styles.text}>
          Rencana bisnis: <VixText heading="bold">Es Cendol</VixText> &{' '}
          <VixText heading="bold">Roa khas Manado</VixText> — resep masakan
          mama sendiri 💛
        </VixText>
        <VixText heading="label" additionalStyle={styles.hint}>
          Belum gerak dulu, dan itu tidak apa-apa. Kalau sudah siap mulai
          (resep, modal, uji rasa, jualan pertama) — bilang saja, fitur
          bisnisnya kita bangun bareng: HPP, stok, sampai catatan penjualan.
        </VixText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  emoji: { fontSize: 52, lineHeight: 64 },
  title: { textAlign: 'center' },
  text: { textAlign: 'center' },
  hint: { textAlign: 'center' },
});
