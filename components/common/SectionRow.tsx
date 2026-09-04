import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SECTION_SPACE } from '@/assets/style/section';
import { VixText } from '@/components/common/VixText';

// Judul bagian dengan sesuatu di ujung kanannya — tombol "Lihat semua",
// "+ Tambah", atau keterangan kecil seperti "Per Sab, 5 Sep 26".
//
// Jarak atas-bawahnya SECTION_SPACE, sama persis dengan judul bagian biasa
// (<VixText heading="title">) dan dengan judul yang bisa dibuka-tutup
// (<SectionToggle/>). Ketiganya memang judul yang sama, cuma beda isi ujung
// kanannya — jadi jaraknya tidak boleh berbeda.
//
// Judulnya MENGISI sisa lebar (`flex: 1`) supaya isi kanannya selalu menempel
// ke tepi kanan, berapa pun panjang judulnya; `minWidth: 0` membuat judul
// panjang memendek sendiri alih-alih mendorong tombolnya keluar layar.
export function SectionRow({
  title,
  right,
}: {
  title: string;
  /** Tombol/keterangan di ujung kanan. Kosong = judul biasa. */
  right?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <VixText heading="title" additionalStyle={styles.title}>
        {title}
      </VixText>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...SECTION_SPACE,
  },
  title: { flex: 1, minWidth: 0 },
});
