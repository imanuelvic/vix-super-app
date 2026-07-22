import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';

// Komponen teks standar vix-super-app.
//
// ATURAN:
// 1. Semua teks WAJIB pakai <VixText heading="...">, JANGAN <Text> langsung.
// 2. JANGAN atur fontSize/fontWeight manual di screen — pilih `heading` yang
//    sesuai. Override kecil (warna, margin, textAlign) lewat `additionalStyle`.
//
// Contoh:
//   <VixText heading="label" additionalStyle={styles.separatorText}>atau</VixText>

export type VixHeading =
  | 'header'     // judul layar besar
  | 'subheader'  // judul bagian besar / nama
  | 'title'      // judul seksi
  | 'bold'       // teks biasa tapi tebal (tombol, penekanan)
  | 'paragraph'  // teks isi biasa (default)
  | 'label';     // keterangan kecil

// Ukuran & warna tiap jenis teks. lineHeight = fontSize × 1.5.
const HEADING_STYLE: Record<VixHeading, TextStyle> = {
  header: { fontSize: 30, lineHeight: 45, fontWeight: '800', color: Color.TEXT_TITLE },
  subheader: { fontSize: 22, lineHeight: 33, fontWeight: '700', color: Color.TEXT_TITLE },
  title: { fontSize: 17, lineHeight: 25.5, fontWeight: '700', color: Color.TEXT_TITLE },
  bold: { fontSize: 15, lineHeight: 22.5, fontWeight: '700', color: Color.TEXT_TITLE },
  paragraph: { fontSize: 15, lineHeight: 22.5, fontWeight: '400', color: Color.TEXT_PARAGRAPH },
  label: { fontSize: 13, lineHeight: 19.5, fontWeight: '500', color: Color.TEXT_LABEL },
};

// Tiap ketebalan Inter adalah file font terpisah — dipetakan otomatis.
const INTER_BY_WEIGHT: Record<string, string> = {
  '100': 'Inter_400Regular',
  '200': 'Inter_400Regular',
  '300': 'Inter_400Regular',
  '400': 'Inter_400Regular',
  normal: 'Inter_400Regular',
  '500': 'Inter_500Medium',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  bold: 'Inter_700Bold',
  '800': 'Inter_800ExtraBold',
  '900': 'Inter_800ExtraBold',
};

type VixTextProps = TextProps & {
  heading?: VixHeading;
  additionalStyle?: StyleProp<TextStyle>;
};

export function VixText({
  heading = 'paragraph',
  additionalStyle,
  style,
  ...rest
}: VixTextProps) {
  const merged: StyleProp<TextStyle> = [HEADING_STYLE[heading], style, additionalStyle];
  const flat = StyleSheet.flatten(merged) as TextStyle;
  const fontFamily = INTER_BY_WEIGHT[String(flat.fontWeight ?? '400')] ?? 'Inter_400Regular';

  return (
    <Text
      {...rest}
      // fontWeight dihapus karena ketebalan sudah ditentukan oleh fontFamily.
      style={[merged, { fontFamily, fontWeight: undefined }]}
    />
  );
}
