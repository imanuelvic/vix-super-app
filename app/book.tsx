import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CARD } from '@/assets/style/card';
import { Color } from '@/assets/style/color';
import { CheckCircle } from '@/components/common/CheckCircle';
import { Chip } from '@/components/common/Chip';
import { DualButtons } from '@/components/common/DualButtons';
import { EmojiButton } from '@/components/common/EmojiButton';
import { EmptyText } from '@/components/common/EmptyText';
import { PressableScale } from '@/components/common/PressableScale';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { SheetModal } from '@/components/common/SheetModal';
import { SummaryCard } from '@/components/common/SummaryCard';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useLive } from '@/hooks/useLive';
import {
  BOOK_CATEGORIES,
  BOOKS,
  chapterReadCount,
  isBookComplete,
  subscribeReadingProgress,
  type Book,
  type ChaptersReadMap,
} from '@/lib/books';

// Urutan daftar: per kategori (bawaan, seperti daftar aslinya) atau rata
// menurut tahun rilis. Pilihannya di sheet 🎚️ Filter & Urutan.
type SortMode = 'category' | 'newest' | 'oldest';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'category', label: '📚 Per kategori' },
  { key: 'newest', label: '📅 Tahun terbaru' },
  { key: 'oldest', label: '📜 Tahun terlama' },
];

// Book 📚 — daftar buku per tema. Tiap buku punya halaman detail berisi
// checklist BAB + progres baca. Buku otomatis "selesai" di sini kalau semua
// babnya sudah dicentang di halaman detail.
export default function BookScreen() {
  const router = useRouter();
  const [chapters] = useLive<ChaptersReadMap>(subscribeReadingProgress, {
    initial: {},
  });

  // 🎚️ Filter & Urutan (16 Sep 2026): saring satu kategori dan/atau urutkan
  // menurut tahun rilis. Tanpa keduanya, daftarnya persis seperti semula.
  const [filterOpen, setFilterOpen] = useState(false);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const hasFilter = catFilter !== null || sortMode !== 'category';

  function openDetail(bookKey: string) {
    router.push({ pathname: '/book/[key]', params: { key: bookKey } });
  }

  const doneCount = BOOKS.filter((b) => isBookComplete(chapters, b)).length;
  const catLabel = (key: string) =>
    BOOK_CATEGORIES.find((c) => c.key === key)?.label ?? key;

  const tersaring = catFilter ? BOOKS.filter((b) => b.category === catFilter) : BOOKS;
  // Urut tahun: stabil (buku setahun tetap berurutan seperti di daftar).
  const urutTahun = [...tersaring].sort((a, b) =>
    sortMode === 'newest' ? b.year - a.year : a.year - b.year,
  );

  function renderBook(book: Book) {
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
              {/* Saat diurutkan rata menurut tahun, kategorinya ikut disebut
                  supaya tetap ketahuan bukunya golongan apa. */}
              {sortMode !== 'category' ? ` · ${catLabel(book.category)}` : ''}
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
            <IconSymbol name="chevron.right" size={16} color={Color.MAIN_DARK} />
          </View>
        </View>
      </PressableScale>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        backLabel="Home"
        title="Book 📚"
        subtitle="Buku yang mau kubaca"
        right={
          <EmojiButton
            emoji="🎚️"
            active={hasFilter}
            onPress={() => setFilterOpen(true)}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Ringkasan progres baca */}
        <SummaryCard
          label="Progres baca"
          value={`${doneCount}/${BOOKS.length} buku selesai 📖`}
        />

        {sortMode === 'category' ? (
          BOOK_CATEGORIES.filter((cat) => !catFilter || cat.key === catFilter).map(
            (cat) => (
              <View key={cat.key}>
                <VixText heading="title" additionalStyle={styles.catTitle}>
                  {cat.label}
                </VixText>
                {BOOKS.filter((b) => b.category === cat.key).map(renderBook)}
              </View>
            ),
          )
        ) : (
          <View>
            <VixText heading="title" additionalStyle={styles.catTitle}>
              {sortMode === 'newest' ? '📅 Tahun terbaru dulu' : '📜 Tahun terlama dulu'}
              {catFilter ? ` · ${catLabel(catFilter)}` : ''}
            </VixText>
            {urutTahun.length === 0 ? (
              <EmptyText>Tidak ada buku di kategori ini.</EmptyText>
            ) : (
              urutTahun.map(renderBook)
            )}
          </View>
        )}
      </ScrollView>

      {/* Sheet filter & urutan — bentuknya sama dengan 🎚️ Filter Jadwal di CORE */}
      <SheetModal
        visible={filterOpen}
        title="🎚️ Filter & Urutan"
        subtitle="Saring kategori atau urutkan menurut tahun rilis"
        onClose={() => setFilterOpen(false)}
        footer={
          <DualButtons
            cancelLabel="Bersihkan"
            confirmLabel="Selesai"
            onCancel={() => {
              setCatFilter(null);
              setSortMode('category');
            }}
            onConfirm={() => setFilterOpen(false)}
          />
        }>
        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          📚 Kategori
        </VixText>
        <View style={styles.chipWrap}>
          <Chip
            label="Semua"
            active={catFilter === null}
            onPress={() => setCatFilter(null)}
          />
          {BOOK_CATEGORIES.map((cat) => (
            <Chip
              key={cat.key}
              label={`${cat.label} (${BOOKS.filter((b) => b.category === cat.key).length})`}
              active={catFilter === cat.key}
              onPress={() => setCatFilter(catFilter === cat.key ? null : cat.key)}
            />
          ))}
        </View>

        <VixText heading="label" additionalStyle={styles.fieldLabel}>
          🔃 Urutkan
        </VixText>
        <View style={styles.chipWrap}>
          {SORT_OPTIONS.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              active={sortMode === o.key}
              onPress={() => setSortMode(o.key)}
            />
          ))}
        </View>
      </SheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Color.BACKGROUND },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  catTitle: { marginTop: 14, marginBottom: 8 },
  row: {
    ...CARD,
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
  // Sheet filter: chip-chipnya membungkus ke baris berikutnya (bukan digeser)
  // supaya semua pilihan terlihat sekaligus.
  fieldLabel: { marginBottom: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
});
