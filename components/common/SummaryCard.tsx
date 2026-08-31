import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';

// Kartu ringkasan gelap — dipakai banyak tab (Car, Finance, Career, Book,
// Device, Residence, Social, dll). Satu tempat mengatur warna & bentuknya biar
// SERAGAM.
//
// Warnanya IKUT FITUR tempat kartunya berdiri: versi tergelap dari warna tile
// fitur itu di grid Home (cokelat di Car, merah tua di Health, grafit di
// Device, …). Dulu semuanya hijau tua yang sama, jadi satu-satunya kartu
// terbesar di tiap layar justru tidak menandakan sedang di fitur mana. Layar
// di luar fitur (Riwayat, Timeline) tetap hijau tua merek seperti sebelumnya.
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
  const theme = useFeatureTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.deep },
        center && styles.center,
        style,
      ]}>
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
//
// Keterangannya putih redup NETRAL, bukan TEXT_ON_DARK_MUTED yang bersemu
// mint: latar kartunya kini bisa cokelat, merah tua, atau grafit, dan di atas
// warna-warna itu semu mint terbaca kehijauan.
export const summaryText = StyleSheet.create({
  label: { color: Color.TEXT_ON_DARK_SOFT },
  value: { color: Color.TEXT_REVERSE },
});

const styles = StyleSheet.create({
  card: {
    // backgroundColor diisi di komponennya (warna tergelap fitur berjalan).
    borderRadius: 20,
    padding: 18,
    gap: 4,
    marginBottom: 10,
  },
  center: { alignItems: 'center' },
});
