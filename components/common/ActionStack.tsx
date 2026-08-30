import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ACTION_GAP, ACTION_TOP } from '@/assets/style/space';

// Tumpukan tombol aksi di bawah isi layar — Share ke WhatsApp, Simpan,
// Connect ke CORE, Ubah catatan, dan seterusnya.
//
// Jaraknya dipegang WADAHNYA, bukan tombol-tombolnya: satu `marginTop` untuk
// jarak dari isi di atasnya, satu `gap` untuk jarak antar tombol. Karena itu
// tombol yang muncul-hilang (mis. Share baru ada setelah keempat kolom terisi,
// Connect baru ada setelah tersimpan) tidak perlu tahu apa-apa soal jarak —
// yang tersisa tetap rapat sendiri, tanpa lubang bekas tombol yang hilang.
//
// Syaratnya satu: elemen TEPAT DI ATAS stack ini jangan punya `marginBottom`
// sendiri — keduanya akan dijumlahkan, dan jaraknya jadi lebih lebar dari yang
// lain tanpa kelihatan sebabnya.
export function ActionStack({ children }: { children: ReactNode }) {
  return <View style={styles.stack}>{children}</View>;
}

const styles = StyleSheet.create({
  stack: { marginTop: ACTION_TOP, gap: ACTION_GAP },
});
