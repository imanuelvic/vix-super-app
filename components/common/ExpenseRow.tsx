import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { formatRupiah } from '@/lib/transactions';

// Satu baris catatan pengeluaran: judul + keterangan di kiri, nominal di kanan.
//
// Dipakai bersama Car → Log 🚗 dan Residence → Log 🏠. Keduanya dulu punya
// blok JSX & keempat gaya ini (row, rowLeft, rowTitle, rowCost) sama persis
// baris per baris — menambah satu kolom berarti mengubah dua tempat.
//
// Yang TIDAK di sini: baris keterangannya. Tiap fitur menyusun sendiri (Car
// menampilkan liter & Rp/L, Rumah menampilkan jenis & catatan), jadi dioper
// lewat `children`.
export function ExpenseRow({
  title,
  cost,
  onPress,
  disabled,
  active,
  children,
}: {
  /** Sudah termasuk emoji jenisnya, mis. "🔧 Ganti oli". */
  title: string;
  cost: number;
  onPress?: () => void;
  disabled?: boolean;
  /**
   * true = garis tepi HIJAU, penanda barisnya bisa ditekan. Dipakai Car untuk
   * membedakan catatan miliknya sendiri dari catatan yang datang dari Finance
   * (yang memang tidak menanggapi click) — supaya tidak ada baris yang
   * kelihatan bisa ditekan tapi diam.
   */
  active?: boolean;
  children?: ReactNode;
}) {
  return (
    <PressableScale
      style={[styles.row, active && styles.rowActive]}
      disabled={disabled}
      onPress={onPress}>
      <View style={styles.left}>
        <VixText heading="bold" additionalStyle={styles.title}>
          {title}
        </VixText>
        {children}
      </View>
      <VixText heading="bold" additionalStyle={styles.cost}>
        {formatRupiah(cost)}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Color.CONTAINER,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  rowActive: { borderColor: Color.MAIN },
  left: { flex: 1, gap: 2 },
  title: { color: Color.TEXT_TITLE },
  cost: { color: Color.MAIN_DARK },
});
