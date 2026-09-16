import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CARD_GAP } from '@/assets/style/card';
import { Color } from '@/assets/style/color';

// Baris yang DIPATOK di atas daftar — tetap kelihatan walau daftarnya digulung
// ke bawah. Isinya tombol utama sub-tab (mis. "+ Buat Rapat Bulanan"), yang
// dulu ikut naik hilang begitu daftarnya panjang.
//
// Ini BUKAN posisi absolute: dia saudara dari ScrollView, jadi kartu-kartunya
// mulai persis di bawah baris ini — tampilannya sama seperti sebelum dipatok,
// bukan ketutupan.
//
// Jarak atas-bawahnya DIPEGANG DI SINI, bukan oleh anaknya (16 Sep 2026):
// paddingTop 4 + marginBottom 6 milik pita header = CARD_GAP di atas tombol,
// dan paddingBottom CARD_GAP di bawahnya — sama persis dengan irama kartu di
// seluruh app, dan sama di tiap sub-tab yang memakainya. Isi ScrollView di
// bawahnya memakai paddingTop 0. Anaknya jangan menambah margin sendiri lagi.
export function StickyTop({ children }: { children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: CARD_GAP,
    backgroundColor: Color.BACKGROUND,
  },
});
