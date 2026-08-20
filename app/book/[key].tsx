import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import { openExternalUrl } from '@/lib/linking';
import {
  BOOKS,
  setChapterRead,
  subscribeReadingProgress,
  type ChaptersReadMap,
} from '@/lib/books';

// Halaman detail buku 📖 — checklist BAB + progres baca. Centang bab yang sudah
// dibaca; kalau semua bab dicentang, buku otomatis "selesai" di daftar Book.
export default function BookDetailScreen() {
  const { user } = useAuth();
  const { key } = useLocalSearchParams<{ key: string }>();
  const book = BOOKS.find((b) => b.key === key);

  const [chapters, setChapters] = useState<ChaptersReadMap>({});

  useEffect(() => {
    if (!user) return;
    return subscribeReadingProgress(user.uid, setChapters);
  }, [user]);

  if (!book) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScreenHeader backLabel="Book" title="Buku tidak ditemukan" />
        <VixText heading="label" additionalStyle={styles.notFound}>
          Buku ini tidak ada di daftar.
        </VixText>
      </SafeAreaView>
    );
  }

  const readMap = chapters[book.key] ?? {};
  const total = book.chapters.length;
  const readCount = book.chapters.reduce((n, _c, i) => (readMap[i] ? n + 1 : n), 0);
  const complete = total > 0 && readCount === total;

  function toggleChapter(i: number) {
    if (!user || !book) return;
    const next = !readMap[i];
    // Optimistis: langsung ubah tampilan, snapshot Firestore akan mengoreksi.
    setChapters((prev) => ({
      ...prev,
      [book.key]: { ...(prev[book.key] ?? {}), [i]: next },
    }));
    setChapterRead(user.uid, book.key, i, next).catch(() => {});
  }

  function openSource() {
    if (book) openExternalUrl(book.url);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Book"
        title={book.title}
        subtitle={`${book.author} · ${book.year}`}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Kartu progres baca */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <VixText heading="bold" additionalStyle={styles.progressTitle}>
              {complete ? '🎉 Selesai dibaca!' : 'Progres baca'}
            </VixText>
            <VixText heading="label" additionalStyle={styles.progressCount}>
              {readCount}/{total} bab
            </VixText>
          </View>
          <ProgressBar
            value={readCount}
            total={total}
            color={complete ? Color.SUCCESS : Color.MAIN}
            height={10}
          />
        </View>

        <VixText heading="paragraph" additionalStyle={styles.info}>
          {book.info}
        </VixText>

        {/* Link sumber bacaan (gratis & legal / info resmi) */}
        <PressableScale
          style={[
            styles.linkButton,
            book.linkKind === 'free' ? styles.linkFree : styles.linkInfo,
          ]}
          onPress={openSource}>
          <VixText
            heading="label"
            additionalStyle={
              book.linkKind === 'free' ? styles.linkFreeText : styles.linkInfoText
            }>
            {book.linkKind === 'free'
              ? '📖 Baca gratis (legal)'
              : '🔗 Info & ringkasan'}
          </VixText>
          <IconSymbol
            name="chevron.right"
            size={16}
            color={
              book.linkKind === 'free'
                ? Color.FINANCE_INCOME_DARK
                : Color.TEXT_LABEL
            }
          />
        </PressableScale>

        {/* Daftar bab — centang yang sudah dibaca */}
        <VixText heading="title" additionalStyle={styles.chaptersTitle}>
          Daftar Bab
        </VixText>
        {book.chapters.map((title, i) => {
          const done = !!readMap[i];
          return (
            <PressableScale
              key={i}
              style={styles.chapterRow}
              onPress={() => toggleChapter(i)}
              hitSlop={4}>
              <CheckCircle checked={done} size={22} />
              <VixText
                heading="label"
                additionalStyle={[
                  styles.chapterText,
                  done ? styles.chapterTextDone : undefined,
                ]}>
                {title}
              </VixText>
              <VixText heading="label" additionalStyle={styles.chapterNum}>
                #{i + 1}
              </VixText>
            </PressableScale>
          );
        })}

        <VixText heading="label" additionalStyle={styles.footer}>
          ⚖️ Kalau bukunya masih berhak cipta, dukung penulisnya dengan membeli /
          meminjam bukunya 🙏
        </VixText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  notFound: { paddingHorizontal: 20, marginTop: 12 },
  progressCard: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  progressTitle: { color: Color.TEXT_TITLE },
  progressCount: { color: Color.TEXT_LABEL },
  info: { color: Color.TEXT_PARAGRAPH, marginBottom: 12 },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  linkFree: {
    backgroundColor: Color.FINANCE_INCOME,
    borderWidth: 1,
    borderColor: Color.FINANCE_INCOME_DARK,
  },
  linkInfo: {
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  linkFreeText: { color: Color.FINANCE_INCOME_DARK },
  linkInfoText: { color: Color.TEXT_LABEL },
  chaptersTitle: { marginTop: 8, marginBottom: 8 },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  chapterText: { flex: 1, color: Color.TEXT_TITLE },
  chapterTextDone: {
    color: Color.TEXT_PLACEHOLDER,
    textDecorationLine: 'line-through',
  },
  chapterNum: { color: Color.TEXT_PLACEHOLDER },
  footer: { color: Color.TEXT_LABEL, marginTop: 12, lineHeight: 19.5 },
});
