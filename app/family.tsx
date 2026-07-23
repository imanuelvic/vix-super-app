import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';

// Family — halaman placeholder. Isi fiturnya menyusul.
export default function FamilyScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader backLabel="Home" title="Family 👨‍👩‍👧‍👦" />

      <View style={styles.center}>
        <VixText additionalStyle={styles.emoji}>👨‍👩‍👧‍👦</VixText>
        <VixText heading="subheader" additionalStyle={styles.title}>
          Coming Soon 🚧
        </VixText>
        <VixText heading="label" additionalStyle={styles.text}>
          Fitur family sedang disiapkan.{'\n'}Nantikan di update berikutnya!
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
    gap: 8,
    paddingHorizontal: 40,
    paddingBottom: 80, // sedikit naik biar terasa di tengah layar
  },
  emoji: { fontSize: 64, lineHeight: 76 },
  title: { color: Color.ACCENT_DARK },
  text: { textAlign: 'center' },
});
