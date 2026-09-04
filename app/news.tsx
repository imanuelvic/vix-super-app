import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { BottomTabs, type BottomTab } from '@/components/common/BottomTabs';
import { EmojiButton } from '@/components/common/EmojiButton';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { useTabScroll } from '@/components/common/useTabScroll';
import { NewsTab } from '@/components/news/NewsTab';
import { PopulationTab } from '@/components/news/PopulationTab';
import { useAuth } from '@/contexts/auth';
import { unsubscribeAll } from '@/lib/liveDoc';
import { LOAD_ERROR, SAVE_ERROR } from '@/lib/messages';
import {
  saveNewsBookmarks,
  subscribeNewsBookmarks,
  subscribePopulationLog,
  toggleBookmark,
  type NewsBookmark,
  type NewsItem,
  type PopulationSaved,
} from '@/lib/news';

type Tab = 'news' | 'population';

const TABS: BottomTab<Tab>[] = [
  { key: 'news', label: 'News', icon: 'list.bullet' },
  { key: 'population', label: 'Population', icon: 'globe' },
];

export default function NewsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  // Baris kebiasaan "Reading the News" di Habits mendarat di ?tab=news.
  const { tab, scrollKey, onTabPress } = useTabScroll<Tab>('news', {
    tabs: TABS,
  });

  const [saved, setSaved] = useState<PopulationSaved>({});
  // Berita yang ditandai 🔖 — dilangganani DI SINI, bukan di dalam tabnya,
  // supaya tombol pojok kanan atas bisa menampilkan jumlahnya tanpa langganan
  // kedua ke dokumen yang sama.
  const [bookmarks, setBookmarks] = useState<NewsBookmark[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fail = () => setError(LOAD_ERROR);
    return unsubscribeAll([
      subscribePopulationLog(user.uid, setSaved, fail),
      subscribeNewsBookmarks(user.uid, setBookmarks, fail),
    ]);
  }, [user]);

  function handleToggleBookmark(item: NewsItem) {
    if (!user) return;
    saveNewsBookmarks(user.uid, toggleBookmark(bookmarks, item, new Date()))
      .then(() => setError(null))
      .catch(() => setError(SAVE_ERROR));
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="News 📰"
        subtitle="Berita terkini & populasi dunia"
        // 🔖 Berita tersimpan — hanya di tab News; di tab Population tak ada
        // yang bisa ditandai, jadi tombolnya pun tak perlu ada di sana.
        right={
          tab === 'news' ? (
            <EmojiButton
              icon="bookmark.fill"
              badge={bookmarks.length}
              onPress={() => router.push('/news-saved')}
            />
          ) : undefined
        }
      />

      <ScreenError message={error} />

      <View style={styles.body} key={scrollKey}>
        {tab === 'news' ? (
          <NewsTab
            bookmarks={bookmarks}
            onToggleBookmark={handleToggleBookmark}
          />
        ) : (
          <PopulationTab saved={saved} />
        )}
      </View>

      <BottomTabs tabs={TABS} value={tab} onChange={onTabPress} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  body: { flex: 1 },
});
