import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Sub-tab 🌱 Multiplication — pemekaran CORE: kapan satu CORE siap dibelah
// jadi dua, siapa calon CL berikutnya, dan bagaimana prosesnya dijaga.
// Belum dikerjakan; kartunya sengaja ada supaya tempatnya sudah jelas.
export function MultiplicationTab() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <VixText heading="header" additionalStyle={styles.emoji}>
          🌱
        </VixText>
        <VixText heading="title" additionalStyle={styles.title}>
          Coming Soon
        </VixText>
        <VixText heading="paragraph" additionalStyle={styles.text}>
          Pemekaran CORE — melacak kapan CORE siap dibelah, siapa calon CORE
          Leader berikutnya, dan sejauh mana persiapannya.
        </VixText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderStyle: 'dashed',
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  emoji: { color: Color.MAIN },
  title: { color: Color.TEXT_TITLE },
  text: { color: Color.TEXT_LABEL, textAlign: 'center' },
});
