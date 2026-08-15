import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';

// Learning 🎓 — catatan ilmu-ilmu di luar bacaan buku: kursus, seminar,
// video, obrolan, pengalaman kerja. BELUM dibangun; halaman ini sengaja
// placeholder supaya tile-nya sudah ada tempatnya di Home.
export default function LearningScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Learning 🎓"
        subtitle="Catatan ilmu yang sudah kamu pelajari"
      />

      <View style={styles.center}>
        <View style={styles.card}>
          <VixText additionalStyle={styles.emoji}>🚧</VixText>
          <VixText heading="title" additionalStyle={styles.title}>
            Coming Soon
          </VixText>
          <VixText heading="label" additionalStyle={styles.text}>
            Tempat mencatat ilmu-ilmu dari luar — kursus, seminar, video,
            obrolan, sampai pelajaran dari pengalaman kerja. Sedang disiapkan 🎓
          </VixText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 6,
    backgroundColor: Color.LEARNING,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Color.LEARNING_DARK,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  emoji: { fontSize: 44, lineHeight: 54 },
  title: { color: Color.LEARNING_DARK },
  text: { color: Color.LEARNING_DARK, textAlign: 'center' },
});
