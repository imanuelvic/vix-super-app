import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';

// Married 💍 — masih Coming Soon, sengaja dibiarkan kosong dulu.
// Tile-nya sudah ada di Home supaya tempatnya jelas & tidak lupa; isinya
// menyusul saat memang sudah waktunya. Bentuk kartunya mengikuti tab Business
// di Career (components/career/BusinessTab.tsx) supaya "coming soon" di app ini
// selalu terasa sama.
export default function MarriedScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Married 💍"
        subtitle="Menuju rumah tangga yang dibangun di atas Kristus"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <VixText additionalStyle={styles.emoji}>💍</VixText>
          <VixText heading="title" additionalStyle={styles.title}>
            Coming Soon 🚧
          </VixText>
          <VixText heading="paragraph" additionalStyle={styles.text}>
            Tempatnya sudah disiapkan — isinya menyusul.
          </VixText>
          <VixText heading="label" additionalStyle={styles.hint}>
            Kalau nanti sudah waktunya, bilang saja apa yang mau dicatat di sini
            (persiapan, tabungan nikah, daftar undangan, konseling pranikah,
            rencana rumah tangga) — fiturnya kita bangun bareng.
          </VixText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
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
