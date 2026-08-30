import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { Chip } from '@/components/common/Chip';
import { ChipRow } from '@/components/common/ChipRow';
import { LoadingCenter } from '@/components/common/LoadingCenter';
import { PressableScale } from '@/components/common/PressableScale';
import { PrimaryButton } from '@/components/common/PrimaryButton';
import { VixText } from '@/components/common/VixText';
import { useAuth } from '@/contexts/auth';
import { useAsyncData } from '@/hooks/useAsyncData';
import { openExternalUrl } from '@/lib/linking';
import { subscribePrayerNews, type PrayerNews } from '@/lib/prayerNews';
import {
  fetchNews,
  newsAge,
  NEWS_ERROR,
  NEWS_SOURCE_DEFAULT,
  NEWS_SOURCES,
  type NewsSource,
} from '@/lib/news';

// Tab News 📰 — judul berita terbaru dari RSS publik (tanpa API key).
// Hanya JUDUL + TAUTAN yang ditampilkan; isi artikel dibuka di browser lewat
// tautan aslinya karena itu milik penerbitnya.
export function NewsTab() {
  const { user } = useAuth();
  const [source, setSource] = useState<NewsSource>(NEWS_SOURCE_DEFAULT);
  // Kliping doa syafaat minggu ini — dibaca saja; yang menyegarkannya Home
  // (sekali seminggu, lihat lib/prayerNews.ts).
  const [prayerNews, setPrayerNews] = useState<PrayerNews | null>(null);
  // Daftar beritanya — dipegang supaya bisa digulung balik ke atas saat chip
  // sumber yang sedang aktif ditekan lagi.
  const listRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!user) return;
    return subscribePrayerNews(user.uid, setPrayerNews);
  }, [user]);

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
  // Gereja dulu, baru negara — urutan yang sama dengan jadwal syafaatnya
  // (Sabtu ⛪, lalu Minggu 🇮🇩).
  const prayerPoints = prayerNews
    ? [...prayerNews.points.church, ...prayerNews.points.nation]
    : [];
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
      {/* Pemilih sumber — kelimanya harus terlihat SEKALIGUS, tanpa ada yang
          terpotong di tepi.

          Emojinya sudah pindah ke baris keterangan di bawah (tiap emoji +
          spasinya makan ±20 pt; kelimanya saja seperlima baris), dan dua nama
          dipendekkan — Indonesia → Indo, Bloomberg → Bisnis. Itu membuat
          kelimanya muat 323 pt di ruang 353 pt iPhone 15.

          Tapi 30 pt sisa itu tipis, dan yang menghabiskannya bukan cuma
          namanya: ukuran huruf sistem bisa diperbesar sendiri oleh pembacanya.
          Karena itu barisnya TIDAK lagi digeser, melainkan `fit="wrap"` —
          chip yang tidak muat turun ke baris berikutnya. Baris yang digeser
          menyembunyikan pilihan di luar layar; baris yang turun tidak pernah
          menyembunyikan apa pun, berapa pun besar hurufnya. */}
      <ChipRow fit="wrap" contentStyle={styles.sourceRow}>
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
  source: { color: Color.NEWS_DARK, flexShrink: 1 },
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
