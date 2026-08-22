import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { SegmentTabs } from '@/components/common/SegmentTabs';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { openExternalUrl } from '@/lib/linking';
import { subscribePrayerNews, type PrayerNews } from '@/lib/prayerNews';
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
  const { user } = useAuth();
  const [source, setSource] = useState<NewsSource>('bloomberg');
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Kliping doa syafaat minggu ini — dibaca saja; yang menyegarkannya Home
  // (sekali seminggu, lihat lib/prayerNews.ts).
  const [prayerNews, setPrayerNews] = useState<PrayerNews | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribePrayerNews(user.uid, setPrayerNews);
  }, [user]);

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
  // Gereja dulu, baru negara — urutan yang sama dengan jadwal syafaatnya
  // (Sabtu ⛪, lalu Minggu 🇮🇩).
  const prayerPoints = prayerNews
    ? [...prayerNews.points.church, ...prayerNews.points.nation]
    : [];

  return (
    <View style={styles.flex}>
      <View style={styles.tabsWrap}>
        <SegmentTabs
          tabs={NEWS_SOURCES.map((s) => ({
            key: s.key,
            label: `${s.emoji} ${s.label}`,
            sub: s.sub,
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
          {/* Kliping doa syafaat minggu ini 🙏 — hanya di tab Indonesia, karena
              isinya memang berita gereja & dalam negeri. Judul yang sama ini
              muncul lagi sebagai pokok doa tambahan di kartu Doa Syafaat
              (Sabtu ⛪ Gereja & Minggu 🇮🇩 Negara). Diperbarui sekali seminggu,
              tiap Senin. */}
          {source === 'indonesia' && prayerPoints.length > 0 && (
            <View style={styles.prayerCard}>
              <VixText heading="bold" additionalStyle={styles.prayerTitle}>
                🙏 Doa Syafaat Minggu Ini
              </VixText>
              {prayerPoints.map((p) => (
                <VixText
                  key={p}
                  heading="label"
                  additionalStyle={styles.prayerPoint}>
                  • {p}
                </VixText>
              ))}
              <VixText heading="label" additionalStyle={styles.prayerFoot}>
                Muncul juga di kartu Doa Syafaat — Sabtu ⛪ Gereja & Minggu 🇮🇩
                Negara.
              </VixText>
            </View>
          )}

          {(items ?? []).length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada berita yang masuk. Tarik ke bawah untuk muat ulang 📰
            </VixText>
          )}
          {(items ?? []).map((n) => (
            <PressableScale
              key={n.id}
              style={styles.card}
              onPress={() => openExternalUrl(n.link)}>
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
  // Kliping doa syafaat — sengaja berwarna Spiritual (ungu), bukan World,
  // supaya langsung terbaca "ini bagian doa", bukan sekadar berita lain.
  prayerCard: {
    backgroundColor: Color.SPIRITUAL,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 4,
  },
  prayerTitle: { color: Color.SPIRITUAL_DARK },
  prayerPoint: { color: Color.SPIRITUAL_DARK },
  prayerFoot: { color: Color.SPIRITUAL_DARK, marginTop: 4, opacity: 0.8 },
});
