import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Kutipan di DALAM kartu — "kartu di dalam kartu".
//
// Bentuknya lahir di daftar Catatan Khotbah (kutipan khotbahnya), dan ternyata
// menjawab hal yang sama di dua tempat lain: satu kalimat yang paling berharga
// di antara isi kartu lainnya, yang harus menonjol tanpa membuat kartunya jadi
// dua kali lebih tinggi. Sekarang satu bentuk untuk ketiganya:
//
//   • Catatan Khotbah → kutipan khotbah
//   • Puasa           → jawaban doa ✨
//   • Revive          → rhema hari ini
//
// Garis tepi KIRI yang tebal, bukan bingkai penuh: matanya langsung tahu ini
// kutipan (pola yang sama dipakai kutipan di mana-mana), dan garis satu sisi
// tidak berebut perhatian dengan garis tepi kartu pembungkusnya.
export function QuoteBox({
  text,
  /** Batas baris. Kosong = tampil utuh. */
  lines,
  /** Warna garis tepi & lambangnya. Bawaannya ungu Spiritual. */
  accent = Color.SPIRITUAL_DARK,
  /** Lambang kecil di depan kalimatnya, mis. "✨". */
  prefix,
}: {
  text: string;
  lines?: number;
  accent?: string;
  prefix?: string;
}) {
  if (!text.trim()) return null;
  return (
    <View style={[styles.box, { borderLeftColor: accent }]}>
      <VixText
        heading="paragraph"
        numberOfLines={lines}
        additionalStyle={styles.text}>
        {prefix ? `${prefix} ` : ''}“{text.trim()}”
      </VixText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Color.BACKGROUND,
    borderLeftWidth: 3,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: { color: Color.TEXT_TITLE, fontStyle: 'italic' },
});
