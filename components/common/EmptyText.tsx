import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { VixText } from '@/components/common/VixText';

// Teks pengganti daftar yang masih kosong ("Belum ada catatan…"): label kecil
// di tengah, dengan jarak 10 atas-bawah supaya tidak menempel ke tombol
// tambah di atasnya maupun ke seksi di bawahnya.
//
// Dulu tiap layar menyalin `empty: { textAlign: 'center', marginVertical: 10 }`
// ke StyleSheet-nya sendiri (18 file). Nilainya sama persis, jadi tidak ada
// jarak yang bergeser. Layar yang jaraknya memang lain (marginTop 20, dsb.)
// tetap memakai gayanya sendiri lewat `additionalStyle`.
export function EmptyText({
  children,
  additionalStyle,
}: {
  children: ReactNode;
  additionalStyle?: StyleProp<TextStyle>;
}) {
  return (
    <VixText heading="label" additionalStyle={[styles.empty, additionalStyle]}>
      {children}
    </VixText>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', marginVertical: 10 },
});
