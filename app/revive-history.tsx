import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { Pagination } from '@/components/common/Pagination';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { usePagination } from '@/hooks/usePagination';
import { formatFullDate } from '@/lib/format';
import { LOAD_ERROR } from '@/lib/messages';
import { subscribeReviveEntries, type ReviveEntry } from '@/lib/spiritual';

// Riwayat Revive 📖 — seluruh Revive yang pernah ditulis, dengan pencarian
// (judul/isi) & pagination 10 per halaman. Tap Revive → editor untuk baca/ubah.
export default function ReviveHistoryScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [entries, setEntries] = useState<ReviveEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    return subscribeReviveEntries(
      user.uid,
      (next) => {
        setEntries(next);
        setError(null);
      },
      () => setError(LOAD_ERROR),
    );
  }, [user]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? (entries ?? []).filter((e) =>
        `${e.title} ${e.rhema} ${e.reflection} ${e.passage} ${e.verse}`
          .toLowerCase()
          .includes(q),
      )
    : (entries ?? []);

  const { setPage, currentPage, pageCount, pageItems } = usePagination(filtered);

  // Ganti kata kunci → balik ke halaman 1.
  useEffect(() => setPage(1), [query, setPage]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Spiritual"
        title="Riwayat Revive 📖"
        subtitle={
          entries ? `${entries.length} Revive — satu rhema sehari 🌱` : undefined
        }
      />

      {error && (
        <VixText heading="label" additionalStyle={styles.error}>
          {error}
        </VixText>
      )}

      {entries === null ? (
        <LoadingCenter />
      ) : (
        <>
          {/* Pencarian tetap terlihat saat menggulir hasil */}
          <View style={styles.searchWrap}>
            <SearchBar
              value={query}
              onChangeText={setQuery}
              placeholder="Cari judul Revive"
            />
            {q !== '' && (
              <VixText heading="label" additionalStyle={styles.resultCount}>
                {filtered.length} judul Revive yang cocok
              </VixText>
            )}
          </View>

          {/* key=currentPage → scroll balik ke atas tiap ganti halaman */}
          <ScrollView key={currentPage} contentContainerStyle={styles.content}>
            {filtered.length === 0 ? (
              <VixText heading="label" additionalStyle={styles.empty}>
                {q !== ''
                  ? 'Tidak ada Revive yang cocok dengan pencarianmu.'
                  : 'Belum ada Revive — mulai hari ini ✍️'}
              </VixText>
            ) : (
              <>
                {pageItems.map((e) => (
                  <PressableScale
                    key={e.id}
                    style={styles.card}
                    onPress={() =>
                      router.push({ pathname: '/revive', params: { day: e.id } })
                    }>
                    <VixText heading="label">
                      {formatFullDate(e.date.toDate())}
                      {e.passage ? ` · 📖 ${e.passage}` : ''}
                    </VixText>
                    <VixText heading="bold" additionalStyle={styles.cardTitle}>
                      {e.title}
                    </VixText>
                    <VixText heading="paragraph" numberOfLines={3}>
                      {e.rhema}
                    </VixText>
                  </PressableScale>
                ))}

                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onChange={setPage}
                />
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  error: { color: Color.DANGER, paddingHorizontal: 20, marginBottom: 6 },
  searchWrap: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6, gap: 4 },
  resultCount: { color: Color.TEXT_LABEL, paddingHorizontal: 2 },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 3,
  },
  cardTitle: { color: Color.TEXT_TITLE },
});
