import { useMemo, useState } from 'react';
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

/** Satu kelompok kitab (Perjanjian Lama / Baru) beserta isinya. */
type BookGroup = { t: BibleTestament; books: typeof BIBLE_BOOKS };

// Daftar kitabnya sendiri — sama persis di kedua rupa pemilih (dialog tengah
// layar & panel yang mengembang di tempat), jadi ditulis sekali di sini.
function BookList({
  grouped,
  picked,
  onPick,
}: {
  grouped: BookGroup[];
  picked: string;
  onPick: (name: string) => void;
}) {
  return (
    <>
      {grouped.map((g) => (
        <View key={g.t}>
          <VixText heading="label" additionalStyle={styles.groupTitle}>
            {TESTAMENT_LABEL[g.t]}
          </VixText>
          {g.books.map((b) => (
            <PressableScale
              key={b.name}
              style={[styles.bookRow, b.name === picked && styles.bookRowActive]}
              onPress={() => onPick(b.name)}>
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
    </>
  );
}

// Kolom acuan Alkitab: PILIH kitab dari daftar 66 kitab, lalu ketik pasal &
// ayat (dari–sampai). Hasilnya satu teks rapi seperti "Galatia 4:4-7" yang
// dikirim balik lewat `onChange` — jadi penyimpanannya tetap string biasa.
export function BibleRefField({
  value,
  onChange,
  editable = true,
  inlinePicker = false,
}: {
  value: string;
  onChange: (ref: string) => void;
  editable?: boolean;
  /**
   * Daftar kitabnya mengembang DI TEMPAT, bukan sebagai dialog tengah layar.
   *
   * Wajib dinyalakan kalau kolom ini dipakai di dalam modal (mis. sheet edit
   * catatan bacaan): dialog pemilih kitab itu sendiri sebuah Modal, dan modal
   * di atas modal tidak andal di iOS — persis alasan layar Baca Alkitab dibuat
   * halaman penuh, bukan sheet. Di halaman penuh biarkan mati: dialog tengah
   * layar memberi daftar yang jauh lebih lega.
   */
  inlinePicker?: boolean;
}) {
  // Keempat bagiannya DITURUNKAN dari `value`, tidak disimpan lagi sebagai
  // state sendiri. Tiap perubahan memang langsung dikirim ke atas lewat
  // `onChange` dan kembali sebagai `value` baru, jadi salinan lokalnya cuma
  // menduplikasi kebenaran yang sama — lengkap dengan satu efek untuk
  // menyamakannya lagi tiap `value` berganti dari luar (mis. buka catatan
  // lama). Sekarang tidak ada yang perlu disamakan: satu sumber saja.
  const { book, chapter, verseFrom, verseTo } = useMemo(
    () => parseBibleRef(value),
    [value],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  function emit(next: Partial<Record<string, string>>) {
    const b = next.book ?? book;
    const c = next.chapter ?? chapter;
    const f = next.verseFrom ?? verseFrom;
    const t = next.verseTo ?? verseTo;
    onChange(bibleRefText(b, c, f, t));
  }

  function pickBook(name: string) {
    tutupPemilih();
    emit({ book: name });
  }

  function tutupPemilih() {
    setPickerOpen(false);
    setQuery('');
  }

  const meta = bibleBook(book);
  const grouped: BookGroup[] = useMemo(() => {
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
        onPress={() =>
          editable && (pickerOpen ? tutupPemilih() : setPickerOpen(true))
        }
        disabled={!editable}>
        <VixText
          heading="bold"
          additionalStyle={book ? styles.bookText : styles.bookPlaceholder}>
          📖 {book || 'Pilih kitab…'}
        </VixText>
        <VixText heading="label" additionalStyle={styles.bookChevron}>
          {inlinePicker && pickerOpen ? '⌄' : '›'}
        </VixText>
      </PressableScale>

      {/* Daftar kitab yang mengembang di tempat — dipakai di dalam modal,
          tempat dialog tengah layar tidak bisa dipanggil. */}
      {inlinePicker && pickerOpen && (
        <View style={styles.inlinePanel}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Cari kitab…"
          />
          <ScrollView
            style={styles.inlineList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <BookList grouped={grouped} picked={book} onPick={pickBook} />
          </ScrollView>
        </View>
      )}

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
            onChangeText={(v) => emit({ chapter: v.replace(/\D/g, '') })}
            editable={editable && !!book}
          />
        </View>
        <View style={styles.numberBox}>
          <VixText heading="label" additionalStyle={styles.numberLabel}>
            Ayat dari
          </VixText>
          <FormInput
            placeholder="Ayat"
            keyboardType="number-pad"
            value={verseFrom}
            onChangeText={(v) => emit({ verseFrom: v.replace(/\D/g, '') })}
            editable={editable && !!chapter}
          />
        </View>
        <View style={styles.numberBox}>
          <VixText heading="label" additionalStyle={styles.numberLabel}>
            sampai
          </VixText>
          <FormInput
            placeholder="Ayat"
            keyboardType="number-pad"
            value={verseTo}
            onChangeText={(v) => emit({ verseTo: v.replace(/\D/g, '') })}
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
        visible={!inlinePicker && pickerOpen}
        onClose={tutupPemilih}>
        <VixText heading="title" additionalStyle={styles.modalTitle}>
          📖 Pilih Kitab
        </VixText>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Cari kitab…"
        />
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          <BookList grouped={grouped} picked={book} onPick={pickBook} />
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
  // Panel mengembang: dibingkai supaya jelas ia MILIK tombol di atasnya, bukan
  // bagian baru dari formulir. Tingginya dipatok — 66 kitab tak boleh mendorong
  // kolom Pasal & ayat keluar dari layar.
  inlinePanel: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    padding: 10,
    gap: 8,
  },
  inlineList: { maxHeight: 240 },
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
