import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { NewsTab } from '@/components/news/NewsTab';
import { PopulationTab } from '@/components/news/PopulationTab';
import { useAuth } from '@/contexts/auth';
import { LOAD_ERROR } from '@/lib/messages';
import {
  recordMonthlyPopulation,
  subscribePopulationLog,
  type PopulationSaved,
} from '@/lib/news';

type Tab = 'news' | 'population';

const TABS: BottomTab<Tab>[] = [
  { key: 'news', label: 'News', icon: 'list.bullet' },
  { key: 'population', label: 'Population', icon: 'globe' },
];

// News 📰 — berita terkini (RSS publik) & populasi dunia.
//
// Dulu bernama "World 🌏". Yang berubah cuma namanya: isinya tetap dua tab
// yang sama, dengan Berita naik jadi tab pertama karena itu yang dibuka
// tiap hari (baris kebiasaan "Reading the News" mendarat di sini).
export default function NewsScreen() {
  const { user } = useAuth();
  // Baris kebiasaan "Reading the News" di Habits mendarat di ?tab=news.
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('news', {
    tabs: TABS,
  });

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
        title="News 📰"
        subtitle="Berita terkini & populasi dunia"
      />

      <ScreenError message={error} />

      <View style={styles.body} key={scrollKey}>
        {tab === 'news' ? <NewsTab /> : <PopulationTab saved={saved} />}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  body: { flex: 1 },
});
