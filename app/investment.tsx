import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { VixText } from '@/components/common/VixText';
import { CryptoTab } from '@/components/investment/CryptoTab';
import { GoldTab } from '@/components/investment/GoldTab';

type InvestmentTab = 'crypto' | 'emas' | 'saham';

// Emas di TENGAH & jadi default — fokus utama saat ini.
const TABS: BottomTab<InvestmentTab>[] = [
  { key: 'crypto', label: 'Crypto', icon: 'bitcoinsign.circle.fill' },
  { key: 'emas', label: 'Emas', icon: 'dollarsign.circle.fill' },
  { key: 'saham', label: 'Saham', icon: 'chart.bar.fill' },
];

// Investment 📈 — pantau & pelajari harga aset LIVE dari Yahoo Finance. Emas &
// Crypto (BTC) aktif; Saham menyusul.
export default function InvestmentScreen() {
  const { tab, scrollKey, onTabPress } = useTabScroll<InvestmentTab>('emas');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Investment 📈"
        subtitle="Pantau & pelajari asetmu"
      />

      <View style={styles.content} key={scrollKey}>
        {tab === 'emas' ? (
          <GoldTab />
        ) : tab === 'crypto' ? (
          <CryptoTab />
        ) : (
          <ComingSoon label="Saham" />
        )}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <VixText additionalStyle={styles.csEmoji}>🚧</VixText>
      <VixText heading="subheader" additionalStyle={styles.csTitle}>
        {label} · Coming Soon
      </VixText>
      <VixText heading="label" additionalStyle={styles.csText}>
        Tracker {label} sedang disiapkan.{'\n'}Fokus dulu ke Emas 🏅
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  csEmoji: { fontSize: 60, lineHeight: 72 },
  csTitle: { color: Color.MAIN_DARK },
  csText: { textAlign: 'center' },
});
