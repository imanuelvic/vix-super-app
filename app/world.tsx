import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { VixText } from '@/components/common/VixText';
import { NewsTab } from '@/components/world/NewsTab';
import { PopulationTab } from '@/components/world/PopulationTab';
import { useAuth } from '@/contexts/auth';
import { LOAD_ERROR } from '@/lib/messages';
import {
  recordMonthlyPopulation,
  subscribePopulationLog,
  type PopulationSaved,
} from '@/lib/world';

type Tab = 'population' | 'news';

const TABS: BottomTab<Tab>[] = [
  { key: 'population', label: 'Population', icon: 'globe' },
  { key: 'news', label: 'News', icon: 'list.bullet' },
];

// World 🌏 — populasi dunia (catatan + perkiraan hidup) & berita terkini.
export default function WorldScreen() {
  const { user } = useAuth();
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('population');

  const [saved, setSaved] = useState<PopulationSaved>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribePopulationLog(user.uid, setSaved, () =>
      setError(LOAD_ERROR),
    );
  }, [user]);

  // Catat perkiraan bulan ini sekali saja (kalau sudah tanggal 10 ke atas &
  // bulan ini belum ada). Tidak ada server/background task di app ini, jadi
  // pencatatan terjadi saat layar ini dibuka.
  useEffect(() => {
    if (!user) return;
    recordMonthlyPopulation(user.uid, saved, new Date()).catch(() => {});
  }, [user, saved]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="World 🌏"
        subtitle="Populasi dunia & berita terkini"
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      <View style={styles.body} key={scrollKey}>
        {tab === 'population' ? <PopulationTab saved={saved} /> : <NewsTab />}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  body: { flex: 1 },
});
