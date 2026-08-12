import { useCallback, useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import {
  fetchNews,
  newsAge,
  NEWS_ERROR,
  NEWS_SOURCES,
  type NewsItem,
  type NewsSource,
} from '@/lib/world';

// Tab News 📰 — judul berita terbaru dari RSS publik (tanpa API key).
// Hanya JUDUL + TAUTAN yang ditampilkan; isi artikel dibuka di browser lewat
// tautan aslinya karena itu milik penerbitnya.
export function NewsTab() {
  const [source, setSource] = useState<NewsSource>('bloomberg');
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (key: NewsSource) => {
    setBusy(true);
    setError(null);
    try {
      setItems(await fetchNews(key));
    } catch {
      setItems(null);
      setError(NEWS_ERROR);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load(source);
  }, [source, load]);

  const now = new Date();

  return (
    <View style={styles.flex}>
      <View style={styles.tabsWrap}>
        <SegmentTabs
          tabs={NEWS_SOURCES.map((s) => ({
            key: s.key,
            label: `${s.emoji} ${s.label}`,
            sub: s.key === 'bloomberg' ? 'bisnis & pasar' : 'berita umum',
          }))}
          value={source}
          onChange={setSource}
        />
      </View>

      {items === null && busy ? (
        <LoadingCenter />
      ) : error ? (
        <View style={styles.center}>
          <VixText heading="label" additionalStyle={styles.error}>
            {error}
          </VixText>
          <PrimaryButton
            label="Coba lagi"
            icon="arrow.triangle.2.circlepath"
            onPress={() => load(source)}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => load(source)}
              tintColor={Color.WORLD_DARK}
            />
          }>
          {(items ?? []).length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada berita yang masuk. Tarik ke bawah untuk muat ulang 📰
            </VixText>
          )}
          {(items ?? []).map((n) => (
            <PressableScale
              key={n.id}
              style={styles.card}
              onPress={() => Linking.openURL(n.link)}>
              <VixText heading="bold" additionalStyle={styles.cardTitle}>
                {n.title}
              </VixText>
              <View style={styles.metaRow}>
                <VixText heading="label" additionalStyle={styles.source}>
                  📰 {n.source}
                </VixText>
                {n.publishedAt && (
                  <VixText heading="label">
                    {newsAge(n.publishedAt, now)}
                  </VixText>
                )}
              </View>
            </PressableScale>
          ))}
          <VixText heading="label" additionalStyle={styles.footer}>
            Ketuk judul untuk membuka artikel aslinya di browser.
          </VixText>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tabsWrap: { paddingHorizontal: 20, paddingTop: 8 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  error: { color: Color.DANGER, textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  empty: { textAlign: 'center', marginTop: 20 },
  card: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 6,
  },
  cardTitle: { color: Color.TEXT_TITLE },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  source: { color: Color.WORLD_DARK, flexShrink: 1 },
  footer: { textAlign: 'center', marginTop: 6 },
});
