import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Fitur Fitness 💪 — masih "coming soon". Halaman placeholder dulu sampai
// isinya (program latihan, catatan, dll.) dibangun nanti.
export default function FitnessScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Fitness 💪"
        subtitle="Catatan & program latihan"
      />

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <IconSymbol name="dumbbell.fill" size={44} color={Color.FITNESS_DARK} />
        </View>
        <VixText heading="subheader" additionalStyle={styles.title}>
          Coming Soon
        </VixText>
        <VixText heading="label" additionalStyle={styles.subtitle}>
          Fitur Fitness lagi disiapkan. Nantikan program latihan & catatan
          progresmu di sini ya! 🏋️
        </VixText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Color.FITNESS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: { color: Color.TEXT_TITLE },
  subtitle: { textAlign: 'center', color: Color.TEXT_LABEL },
});
