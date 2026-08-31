import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { ScreenError } from '@/components/common/ScreenError';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { NewsCard } from '@/components/news/NewsCard';
import { useAuth } from '@/contexts/auth';
import { formatShortDayDate } from '@/lib/format';
import { openExternalUrl } from '@/lib/linking';
import { DELETE_ERROR, LOAD_ERROR } from '@/lib/messages';
import {
  BOOKMARK_MAX,
  removeBookmark,
  saveNewsBookmarks,
  subscribeNewsBookmarks,
  type NewsBookmark,
} from '@/lib/news';

// Berita tersimpan 🔖 — yang kamu tandai sendiri di tab News, dikumpulkan di
// satu tempat supaya bisa dibaca ulang & ditunjukkan lagi kalau ada yang
// menanyakan.
//
// Kenapa layarnya sendiri dan bukan sub-tab: daftar ini TIDAK ikut berganti
// tiap hari seperti daftar beritanya, dan tidak dibuka tiap kali News dibuka.
// Sebagai sub-tab ia akan menempati ruang tetap di kaki layar untuk sesuatu
// yang jarang dituju.
export default function NewsSavedScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<NewsBookmark[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeNewsBookmarks(
      user.uid,
      (next) => {
        setItems(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  function handleRemove(link: string) {
    if (!user || items === null) return;
    saveNewsBookmarks(user.uid, removeBookmark(items, link)).catch(() =>
      setError(DELETE_ERROR),
    );
  }

  const now = new Date();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="News"
        title="Tersimpan 🔖"
        subtitle={
          items === null
            ? 'Berita yang kamu tandai'
            : `${items.length} berita tersimpan · maksimal ${BOOKMARK_MAX}`
        }
      />

      <ScreenError message={error} />

      {items === null ? (
        <LoadingCenter />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {items.length === 0 ? (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada yang disimpan. Tekan lambang 🔖 di kanan sebuah berita
              untuk menyimpannya ke sini.
            </VixText>
          ) : (
            items.map((n) => (
              <NewsCard
                key={n.link}
                title={n.title}
                source={n.source}
                publishedAt={n.publishedAt === null ? null : new Date(n.publishedAt)}
                now={now}
                // Kapan KAMU menyimpannya — itulah yang menjawab "berita soal
                // apa yang kubaca waktu itu?", bukan kapan terbitnya.
                footer={`🔖 disimpan ${formatShortDayDate(new Date(n.savedAt))}`}
                saved
                onOpen={() => openExternalUrl(n.link)}
                onToggleSave={() => handleRemove(n.link)}
              />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  empty: { textAlign: 'center', marginTop: 24 },
});
