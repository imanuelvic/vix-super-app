import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  BOOK_CATEGORIES,
  BOOKS,
  chapterReadCount,
  isBookComplete,
  subscribeReadingProgress,
  type ChaptersReadMap,
} from '@/lib/books';

// Book 📚 — daftar buku per tema. Tiap buku punya halaman detail berisi
// checklist BAB + progres baca. Buku otomatis "selesai" di sini kalau semua
// babnya sudah dicentang di halaman detail.
export default function BookScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [chapters, setChapters] = useState<ChaptersReadMap>({});

  useEffect(() => {
    if (!user) return;
    return subscribeReadingProgress(user.uid, setChapters);
  }, [user]);

  function openDetail(bookKey: string) {
    router.push({ pathname: '/book/[key]', params: { key: bookKey } });
  }

  const doneCount = BOOKS.filter((b) => isBookComplete(chapters, b)).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Book 📚"
        subtitle="Buku yang mau kubaca"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan progres baca */}
        <SummaryCard
          label="Progres baca"
          value={`${doneCount}/${BOOKS.length} buku selesai 📖`}
        />

        {/* Waktu baca — nyambung ke Morning Task */}
        <View style={styles.noteCard}>
          <VixText heading="label" additionalStyle={styles.noteText}>
            🌅 Waktu bacamu: tiap pagi setelah worship, doa & olahraga — lihat
            checklist Morning Task di Home.
          </VixText>
        </View>

        {BOOK_CATEGORIES.map((cat) => (
          <View key={cat.key}>
            <VixText heading="title" additionalStyle={styles.catTitle}>
              {cat.label}
            </VixText>
            {BOOKS.filter((b) => b.category === cat.key).map((book) => {
              const total = book.chapters.length;
              const readCount = chapterReadCount(chapters, book);
              const complete = isBookComplete(chapters, book);
              return (
                <PressableScale
                  key={book.key}
                  style={styles.row}
                  onPress={() => openDetail(book.key)}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowMain}>
                      <VixText
                        heading="bold"
                        additionalStyle={complete ? styles.titleRead : undefined}>
                        {book.title}
                      </VixText>
                      <VixText heading="label" additionalStyle={styles.author}>
                        {book.author} · {book.year}
                      </VixText>
                    </View>
                    {/* Indikator selesai (otomatis dari centang bab) — `locked`
                        karena ini penanda status, bukan tombol centang. */}
                    <CheckCircle checked={complete} size={24} locked />
                  </View>

                  <VixText heading="paragraph" additionalStyle={styles.info}>
                    {book.info}
                  </VixText>

                  {/* Progres baca per-bab */}
                  <ProgressBar
                    value={readCount}
                    total={total}
                    color={complete ? Color.SUCCESS : Color.MAIN}
                  />

                  {/* Tombol ke halaman detail: baca & checklist bab */}
                  <View style={styles.openRow}>
                    <VixText heading="label" additionalStyle={styles.progressText}>
                      {complete ? '🎉 Selesai' : `${readCount}/${total} bab`}
                    </VixText>
                    <View style={styles.openButton}>
                      <VixText heading="label" additionalStyle={styles.openText}>
                        📖 Baca & Checklist Bab
                      </VixText>
                      <IconSymbol
                        name="chevron.right"
                        size={16}
                        color={Color.MAIN_DARK}
                      />
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ))}

        {/* Catatan legalitas — dukung penulisnya */}
        <VixText heading="label" additionalStyle={styles.footer}>
          ⚖️ Untuk buku yang masih berhak cipta, link di halaman detail mengarah
          ke sumber gratis yang legal (esai/situs resmi penulis atau ringkasan),
          bukan salinan bajakan. Kalau cocok, dukung penulisnya dengan membeli /
          meminjam bukunya 🙏
        </VixText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  noteCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderLeftWidth: 3,
    borderLeftColor: Color.MAIN,
    padding: 14,
    marginBottom: 6,
  },
  noteText: { color: Color.TEXT_PARAGRAPH },
  catTitle: { marginTop: 14, marginBottom: 8 },
  row: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    gap: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowMain: { flex: 1, gap: 2 },
  titleRead: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  author: { color: Color.TEXT_LABEL },
  info: { color: Color.TEXT_PARAGRAPH },
  openRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressText: { color: Color.TEXT_LABEL },
  openButton: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openText: { color: Color.MAIN_DARK },
  footer: {
    color: Color.TEXT_LABEL,
    marginTop: 12,
    lineHeight: 19.5,
  },
});
