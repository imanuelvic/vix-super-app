import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Judul bagian yang bisa DIBUKA-TUTUP, dengan tombol aksi opsional di kanan.
//
// Bentuknya sengaja sama persis dengan judul bagian biasa (heading "title" +
// jarak yang sama), jadi bagian yang bisa ditutup dan yang tidak tetap terbaca
// satu keluarga — yang membedakan hanya panah di sebelah judulnya.
//
// Tombol `right` (mis. "+ Tambah") berdiri DI LUAR area yang bisa ditekan
// untuk membuka-tutup: menambah anggota lalu bagiannya ikut menutup sendiri
// adalah persis kejutan yang tidak diinginkan.
export function SectionToggle({
  title,
  open,
  onToggle,
  right,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Tombol kecil di ujung kanan — tidak ikut membuka/menutup. */
  right?: ReactNode;
  /** Isi bagiannya; hanya dirender saat terbuka. */
  children: ReactNode;
}) {
  return (
    <>
      <View style={styles.row}>
        <PressableScale
          style={styles.head}
          onPress={onToggle}
          hitSlop={8}
          haptic="light">
          <VixText heading="title" additionalStyle={styles.title}>
            {title}
          </VixText>
          <IconSymbol
            name={open ? 'chevron.down' : 'chevron.right'}
            size={18}
            color={Color.TEXT_LABEL}
          />
        </PressableScale>
        {right}
      </View>
      {open ? children : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    marginBottom: 8,
  },
  // Judul + panah memakan sisa lebar, jadi seluruh baris judulnya bisa ditekan
  // — bukan cuma panah kecil di ujungnya.
  head: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1 },
});
