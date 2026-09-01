import { useCallback, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { ChipRow } from '@/components/common/ChipRow';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { NewsCard } from '@/components/news/NewsCard';
import { useAsyncData } from '@/hooks/useAsyncData';
import { openExternalUrl } from '@/lib/linking';
import {
  fetchNews,
  isBookmarked,
  NEWS_ERROR,
  NEWS_SOURCE_DEFAULT,
  NEWS_SOURCES,
  type NewsBookmark,
  type NewsItem,
  type NewsSource,
} from '@/lib/news';

// Tab News 📰 — judul berita terbaru dari RSS publik (tanpa API key).
// Hanya JUDUL + TAUTAN yang ditampilkan; isi artikel dibuka di browser lewat
// tautan aslinya karena itu milik penerbitnya.
export function NewsTab({
  bookmarks,
  onToggleBookmark,
}: {
  bookmarks: NewsBookmark[];
  /** Simpan/lepas satu berita — penyimpanannya diurus layar News. */
  onToggleBookmark: (item: NewsItem) => void;
}) {
  const [source, setSource] = useState<NewsSource>(NEWS_SOURCE_DEFAULT);
  // Daftar beritanya — dipegang supaya bisa digulung balik ke atas saat chip
  // sumber yang sedang aktif ditekan lagi.
  const listRef = useRef<ScrollView>(null);

  // Ganti sumber = permintaan baru (fungsinya ikut berganti). Gagal ambil →
  // daftarnya ikut dikosongkan, biar "Coba lagi" mulai dari layar bersih.
  const load = useCallback(() => fetchNews(source), [source]);
  const {
    data: items,
    loading: busy,
    error,
    reload,
  } = useAsyncData(load, NEWS_ERROR, false);

  const now = new Date();
  const aktif = NEWS_SOURCES.find((s) => s.key === source)!;

  /**
   * Click chip sumber. Menekan sumber yang SUDAH aktif = minta yang terbaru:
   * daftarnya diambil ulang dan digulung balik ke paling atas.
   *
   * Pola yang sama dengan tab bawah di seluruh app (useTabScroll): tekan lagi
   * tab yang sedang dibuka → balik ke atas. Bedanya di sini sekalian memuat
   * ulang, karena isinya berita — yang "paling atas" hari ini belum tentu
   * yang paling atas satu jam lagi.
   */
  function pilihSumber(key: NewsSource) {
    if (key !== source) {
      setSource(key);
      return;
    }
    reload();
    listRef.current?.scrollTo({ y: 0, animated: true });
  }

  return (
    <View style={styles.flex}>
      {/* Pemilih sumber — keenamnya MUAT SEBARIS, lebarnya dibagi rata & nama
          sumbernya rata tengah. Jadi tak ada satu pun yang terpotong di tepi
          layar, dan semuanya terlihat sekaligus tanpa perlu digeser dulu.

          Dua percobaan sebelumnya gagal karena alasan yang berbeda: dibuat
          turun baris → baris keduanya tertimpa keterangan di bawahnya; dibuat
          bisa digeser → chip terakhir ("Kristen") selalu tergantung separuh di
          tepi kanan sampai barisnya disentuh.

          Nama dua sumber memang sudah dipendekkan (Indonesia → Indo,
          Bloomberg → Bisnis) & emojinya pindah ke baris keterangan, jadi
          keenamnya cukup. `fit={6}`: kalau nanti sumbernya bertambah jadi
          tujuh, barisnya balik jadi baris geser dengan sendirinya — chip yang
          dipaksa muat terus-menerus akhirnya cuma jadi titik tak terbaca. */}
      <ChipRow
        activeIndex={NEWS_SOURCES.findIndex((s) => s.key === source)}
        fit={6}
        contentStyle={styles.sourceRow}>
        {NEWS_SOURCES.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            active={s.key === source}
            onPress={() => pilihSumber(s.key)}
          />
        ))}
      </ChipRow>
      <VixText heading="label" additionalStyle={styles.sourceSub}>
        {aktif.emoji} {aktif.sub}
      </VixText>

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
            onPress={() => reload()}
          />
        </View>
      ) : (
        <ScrollView
          ref={listRef}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={busy}
              onRefresh={() => reload()}
              tintColor={Color.NEWS_DARK}
            />
          }>
          {(items ?? []).length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Belum ada berita yang masuk. Tarik ke bawah untuk muat ulang 📰
            </VixText>
          )}
          {(items ?? []).map((n) => (
            <NewsCard
              key={n.id}
              title={n.title}
              source={n.source}
              publishedAt={n.publishedAt}
              now={now}
              saved={isBookmarked(bookmarks, n.link)}
              onOpen={() => openExternalUrl(n.link)}
              onToggleSave={() => onToggleBookmark(n)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sourceRow: { paddingHorizontal: 20, paddingTop: 8 },
  sourceSub: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
    color: Color.TEXT_LABEL,
  },
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
});
