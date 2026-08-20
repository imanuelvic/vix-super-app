import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';

// Baris yang DIPATOK di atas daftar — tetap kelihatan walau daftarnya digulung
// ke bawah. Isinya tombol utama sub-tab (mis. "+ Buat Rapat Bulanan"), yang
// dulu ikut naik hilang begitu daftarnya panjang.
//
// Ini BUKAN posisi absolute: dia saudara dari ScrollView, jadi kartu-kartunya
// mulai persis di bawah baris ini — tampilannya sama seperti sebelum dipatok,
// bukan ketutupan. Padding-nya sengaja sama dengan `content` tiap sub-tab
// (paddingHorizontal 20 · paddingTop 8) supaya tombolnya tidak bergeser
// sedikit pun; jarak ke kartu pertama tetap diatur margin tombolnya sendiri.
export function StickyTop({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: Color.BACKGROUND,
  },
});
