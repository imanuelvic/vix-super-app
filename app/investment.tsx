import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SCREEN_SAFE } from '@/assets/style/layout';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { AnalysisTab } from '@/components/investment/AnalysisTab';
import { CryptoTab } from '@/components/investment/CryptoTab';
import { ForexTab } from '@/components/investment/ForexTab';
import { GoldTab } from '@/components/investment/GoldTab';
import { StockTab } from '@/components/investment/StockTab';

type InvestmentTab = 'analysis' | 'crypto' | 'emas' | 'saham' | 'forex';

// Emas jadi default — fokus utama saat ini.
//
// ✨ Analysis ditaruh PALING KIRI (30 Sep 2026): keempat tab lain menjawab
// "berapa harganya sekarang", dan itu pertanyaan yang jawabannya sudah
// kelihatan sekilas. Yang tidak pernah terjawab justru "jadi ini lagi naik
// atau turun, dan kenapa" — dan itu yang dibaca di sini.
const TABS: BottomTab<InvestmentTab>[] = [
  { key: 'analysis', label: 'Analysis', icon: 'sparkles' },
  { key: 'crypto', label: 'Crypto', icon: 'bitcoinsign.circle.fill' },
  { key: 'emas', label: 'Gold', icon: 'dollarsign.circle.fill' },
  { key: 'saham', label: 'Stocks', icon: 'chart.bar.fill' },
  { key: 'forex', label: 'Forex', icon: 'arrow.left.arrow.right' },
];

// Investment 📈 — pantau & pelajari harga aset LIVE dari Yahoo Finance:
// Crypto (BTC), Emas, Saham (IHSG), & Forex (kurs Rupiah/USD), plus bacaan
// AI ✨ atas emas & Bitcoin.
export default function InvestmentScreen() {
  // `tabs` dioper supaya pencarian fitur bisa menuju sub-tabnya lewat ?tab=.
  const { tab, scrollKey, onTabPress } = useTabScroll<InvestmentTab>('emas', {
    tabs: TABS,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Investment 📈"
        subtitle="Pantau & pelajari asetmu"
      />

      <View style={styles.content} key={scrollKey}>
        {tab === 'analysis' ? (
          <AnalysisTab />
        ) : tab === 'emas' ? (
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
  safe: { ...SCREEN_SAFE },
  content: { flex: 1 },
});
