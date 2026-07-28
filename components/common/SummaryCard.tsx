import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Kartu ringkasan gelap (hijau tua) — dipakai banyak tab (Car, Home, Finance,
// Career, Book, dll). Satu tempat mengatur warna & bentuknya biar SERAGAM.
//
// Ringkas: <SummaryCard label="Judul" value="Rp1.000" sub="Bulan ini: …" />
// Isi khusus (mis. ada tombol / beberapa baris): pakai `children` + gaya teks
// `summaryText` supaya warnanya tetap sama.
export function SummaryCard({
  label,
  value,
  sub,
  center,
  children,
  style,
}: {
  label?: string;
  value?: string;
  sub?: ReactNode;
  center?: boolean; // konten di tengah (mis. kartu identitas dengan emoji)
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.card, center && styles.center, style]}>
      {children ?? (
        <>
          {label != null && (
            <VixText heading="label" additionalStyle={summaryText.label}>
              {label}
            </VixText>
          )}
          {value != null && (
            <VixText heading="subheader" additionalStyle={summaryText.value}>
              {value}
            </VixText>
          )}
          {sub != null && (
            <VixText heading="label" additionalStyle={summaryText.label}>
              {sub}
            </VixText>
          )}
        </>
      )}
    </View>
  );
}

// Gaya teks di dalam kartu — diekspor supaya isi via `children` tetap seragam.
export const summaryText = StyleSheet.create({
  label: { color: Color.TEXT_ON_DARK_MUTED },
  value: { color: Color.TEXT_REVERSE },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Color.MAIN_DARK,
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: 10,
  },
  center: { alignItems: 'center' },
});
