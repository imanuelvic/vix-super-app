import { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { PressableScale } from '@/components/common/PressableScale';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth';
import {
  BOOK_CATEGORIES,
  BOOKS,
  setBookRead,
  subscribeBooksRead,
  type Book,
  type BooksReadMap,
} from '@/lib/books';

// Book 📚 — daftar buku yang mau/lagi dibaca, dikelompokkan per tema. Tiap buku
// ada info singkat + link (gratis & legal / info resmi) + tanda "sudah dibaca".
export default function BookScreen() {
  const { user } = useAuth();
  const [read, setRead] = useState<BooksReadMap>({});

  useEffect(() => {
    if (!user) return;
    return subscribeBooksRead(user.uid, setRead);
  }, [user]);

  function toggleRead(book: Book) {
    if (!user) return;
    const next = !read[book.key];
    // Optimistis: langsung ubah tampilan, snapshot akan mengoreksi bila gagal.
    setRead((prev) => ({ ...prev, [book.key]: next }));
    setBookRead(user.uid, book.key, next).catch(() => {});
  }

  function openBook(book: Book) {
    Linking.openURL(book.url).catch(() => {});
  }

  const readCount = BOOKS.filter((b) => read[b.key]).length;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScreenHeader
        backLabel="Home"
        title="Book 📚"
        subtitle="Buku yang mau kubaca"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan progres baca */}
        <View style={styles.summaryCard}>
          <VixText heading="label" additionalStyle={styles.summaryLabel}>
            Progres baca
          </VixText>
          <VixText heading="subheader" additionalStyle={styles.summaryValue}>
            {readCount}/{BOOKS.length} buku selesai 📖
          </VixText>
        </View>

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
              const isRead = !!read[book.key];
              return (
                <View key={book.key} style={styles.row}>
                  <View style={styles.rowTop}>
                    <View style={styles.rowMain}>
                      <VixText
                        heading="bold"
                        additionalStyle={isRead ? styles.titleRead : undefined}>
                        {book.title}
                      </VixText>
                      <VixText heading="label" additionalStyle={styles.author}>
                        {book.author} · {book.year}
                      </VixText>
                    </View>
                    {/* Tandai sudah dibaca */}
                    <PressableScale onPress={() => toggleRead(book)} hitSlop={8}>
                      <CheckCircle checked={isRead} size={24} />
                    </PressableScale>
                  </View>

                  <VixText heading="paragraph" additionalStyle={styles.info}>
                    {book.info}
                  </VixText>

                  {/* Link baca — gratis & legal / info resmi */}
                  <PressableScale
                    style={[
                      styles.linkButton,
                      book.linkKind === 'free'
                        ? styles.linkFree
                        : styles.linkInfo,
                    ]}
                    onPress={() => openBook(book)}>
                    <VixText
                      heading="label"
                      additionalStyle={
                        book.linkKind === 'free'
                          ? styles.linkFreeText
                          : styles.linkInfoText
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
                </View>
              );
            })}
          </View>
        ))}

        {/* Catatan legalitas — dukung penulisnya */}
        <VixText heading="label" additionalStyle={styles.footer}>
          ⚖️ Untuk buku yang masih berhak cipta, link mengarah ke sumber gratis
          yang legal (esai/situs resmi penulis atau ringkasan), bukan salinan
          bajakan. Kalau cocok, dukung penulisnya dengan membeli / meminjam
          bukunya 🙏
        </VixText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  summaryCard: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: 10,
  },
  summaryLabel: { color: Color.TEXT_ON_DARK_MUTED },
  summaryValue: { color: Color.TEXT_REVERSE },
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
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkFree: {
    backgroundColor: Color.FINANCE_INCOME,
    borderWidth: 1,
    borderColor: Color.FINANCE_INCOME_DARK,
  },
  linkInfo: {
    backgroundColor: Color.BACKGROUND,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  linkFreeText: { color: Color.FINANCE_INCOME_DARK },
  linkInfoText: { color: Color.TEXT_LABEL },
  footer: {
    color: Color.TEXT_LABEL,
    marginTop: 12,
    lineHeight: 19.5,
  },
});
