import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { CenterDialog } from '@/components/common/CenterDialog';
import { FormInput } from '@/components/common/FormInput';
import { PressableScale } from '@/components/common/PressableScale';
import { SearchBar } from '@/components/common/SearchBar';
import { VixText } from '@/components/common/VixText';
import {
  BIBLE_BOOKS,
  bibleBook,
  bibleRefText,
  parseBibleRef,
  TESTAMENT_LABEL,
  type BibleTestament,
} from '@/lib/bible';

// Kolom acuan Alkitab: PILIH kitab dari daftar 66 kitab, lalu ketik pasal &
// ayat (dari–sampai). Hasilnya satu teks rapi seperti "Galatia 4:4-7" yang
// dikirim balik lewat `onChange` — jadi penyimpanannya tetap string biasa.
export function BibleRefField({
  value,
  onChange,
  editable = true,
}: {
  value: string;
  onChange: (ref: string) => void;
  editable?: boolean;
}) {
  const parsed = useMemo(() => parseBibleRef(value), [value]);

  const [book, setBook] = useState(parsed.book);
  const [chapter, setChapter] = useState(parsed.chapter);
  const [verseFrom, setVerseFrom] = useState(parsed.verseFrom);
  const [verseTo, setVerseTo] = useState(parsed.verseTo);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Nilai dari luar berubah (mis. buka catatan lama) → isi ulang bagiannya.
  useEffect(() => {
    setBook(parsed.book);
    setChapter(parsed.chapter);
    setVerseFrom(parsed.verseFrom);
    setVerseTo(parsed.verseTo);
    // Hanya saat teks acuannya benar-benar berganti dari luar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function emit(next: Partial<Record<string, string>>) {
    const b = next.book ?? book;
    const c = next.chapter ?? chapter;
    const f = next.verseFrom ?? verseFrom;
    const t = next.verseTo ?? verseTo;
    onChange(bibleRefText(b, c, f, t));
  }

  function pickBook(name: string) {
    setBook(name);
    setPickerOpen(false);
    setQuery('');
    emit({ book: name });
  }

  const meta = bibleBook(book);
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? BIBLE_BOOKS.filter((b) => b.name.toLowerCase().includes(q))
      : BIBLE_BOOKS;
    return (['pl', 'pb'] as BibleTestament[])
      .map((t) => ({ t, books: list.filter((b) => b.testament === t) }))
      .filter((g) => g.books.length > 0);
  }, [query]);

  return (
    <View style={styles.wrap}>
      {/* Pilih kitab */}
      <PressableScale
        style={styles.bookButton}
        onPress={() => editable && setPickerOpen(true)}
        disabled={!editable}>
        <VixText
          heading="bold"
          additionalStyle={book ? styles.bookText : styles.bookPlaceholder}>
          📖 {book || 'Pilih kitab…'}
        </VixText>
        <VixText heading="label" additionalStyle={styles.bookChevron}>
          ›
        </VixText>
      </PressableScale>

      {/* Pasal & ayat */}
      <View style={styles.numberRow}>
        <View style={styles.numberBox}>
          <VixText heading="label" additionalStyle={styles.numberLabel}>
            Pasal
          </VixText>
          <FormInput
            placeholder={meta ? `1–${meta.chapters}` : '—'}
            keyboardType="number-pad"
            value={chapter}
            onChangeText={(v) => {
              const clean = v.replace(/\D/g, '');
              setChapter(clean);
              emit({ chapter: clean });
            }}
            editable={editable && !!book}
          />
        </View>
        <View style={styles.numberBox}>
          <VixText heading="label" additionalStyle={styles.numberLabel}>
            Ayat dari
          </VixText>
          <FormInput
            placeholder="mis. 4"
            keyboardType="number-pad"
            value={verseFrom}
            onChangeText={(v) => {
              const clean = v.replace(/\D/g, '');
              setVerseFrom(clean);
              emit({ verseFrom: clean });
            }}
            editable={editable && !!chapter}
          />
        </View>
        <View style={styles.numberBox}>
          <VixText heading="label" additionalStyle={styles.numberLabel}>
            sampai
          </VixText>
          <FormInput
            placeholder="mis. 7"
            keyboardType="number-pad"
            value={verseTo}
            onChangeText={(v) => {
              const clean = v.replace(/\D/g, '');
              setVerseTo(clean);
              emit({ verseTo: clean });
            }}
            editable={editable && !!verseFrom}
          />
        </View>
      </View>

      {/* Pratinjau hasil */}
      {value ? (
        <VixText heading="label" additionalStyle={styles.preview}>
          ✍️ {value}
        </VixText>
      ) : null}

      {/* Daftar 66 kitab — bisa dicari */}
      <CenterDialog
        visible={pickerOpen}
        onClose={() => {
          setPickerOpen(false);
          setQuery('');
        }}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          📖 Pilih Kitab
        </VixText>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Cari kitab…"
        />
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {grouped.map((g) => (
            <View key={g.t}>
              <VixText heading="label" additionalStyle={styles.groupTitle}>
                {TESTAMENT_LABEL[g.t]}
              </VixText>
              {g.books.map((b) => (
                <PressableScale
                  key={b.name}
                  style={[styles.bookRow, b.name === book && styles.bookRowActive]}
                  onPress={() => pickBook(b.name)}>
                  <VixText heading="bold" additionalStyle={styles.bookRowText}>
                    {b.name}
                  </VixText>
                  <VixText heading="label">{b.chapters} pasal</VixText>
                </PressableScale>
              ))}
            </View>
          ))}
          {grouped.length === 0 && (
            <VixText heading="label" additionalStyle={styles.empty}>
              Kitab tidak ditemukan.
            </VixText>
          )}
        </ScrollView>
      </CenterDialog>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  bookText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  bookPlaceholder: { color: Color.TEXT_PLACEHOLDER, flexShrink: 1 },
  bookChevron: { color: Color.TEXT_LABEL },
  numberRow: { flexDirection: 'row', gap: 8 },
  numberBox: { flex: 1, gap: 4 },
  numberLabel: { marginLeft: 2 },
  preview: { color: Color.MAIN_DARK },
  modalTitle: { color: Color.TEXT_TITLE, marginBottom: 10 },
  list: { maxHeight: 380, marginTop: 8 },
  groupTitle: { color: Color.MAIN_DARK, marginTop: 8, marginBottom: 4 },
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  bookRowActive: {
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderColor: Color.MAIN,
  },
  bookRowText: { color: Color.TEXT_TITLE, flexShrink: 1 },
  empty: { textAlign: 'center', marginVertical: 14 },
});
