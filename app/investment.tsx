import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { CryptoTab } from '@/components/investment/CryptoTab';
import { ForexTab } from '@/components/investment/ForexTab';
import { GoldTab } from '@/components/investment/GoldTab';
import { StockTab } from '@/components/investment/StockTab';

type InvestmentTab = 'crypto' | 'emas' | 'saham' | 'forex';

// Emas jadi default — fokus utama saat ini.
const TABS: BottomTab<InvestmentTab>[] = [
  { key: 'crypto', label: 'Crypto', icon: 'bitcoinsign.circle.fill' },
  { key: 'emas', label: 'Emas', icon: 'dollarsign.circle.fill' },
  { key: 'saham', label: 'Saham', icon: 'chart.bar.fill' },
  { key: 'forex', label: 'Forex', icon: 'arrow.left.arrow.right' },
];

// Investment 📈 — pantau & pelajari harga aset LIVE dari Yahoo Finance:
// Crypto (BTC), Emas, Saham (IHSG), & Forex (kurs Rupiah/USD).
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
        ) : tab === 'saham' ? (
          <StockTab />
        ) : (
          <ForexTab />
        )}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { flex: 1 },
});
