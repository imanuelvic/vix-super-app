import { StyleSheet, useWindowDimensions, View } from 'react-native';

// Pratinjau kartu yang akan dijadikan gambar (Story 9:16, Feed 4:5, Reminder
// 1:1). Kartunya SELALU digambar pada ukuran aslinya (1080 px) lalu dikecilkan
// dengan transform, dan kotak ini yang memotongnya jadi sebesar pratinjau.
// Alasan kenapa tidak dirender langsung sebesar pratinjau ada di catatan
// panjang lib/shareImage.ts: yang tertangkap `toDataURL` itu ukuran TATA LETAK
// view-nya, bukan kanvas yang diminta.
//
// Lebarnya selebar layar dikurangi tepi, dibatasi `max` supaya lembarnya tetap
// muat utuh di layar mana pun (termasuk iPhone 15 yang tingginya pas).
export function CardPreview({
  width,
  height,
  max = 320,
  pad = 14,
  children,
}: {
  /** Lebar kanvas aslinya, mis. 1080. */
  width: number;
  /** Tinggi kanvas aslinya, mis. 1920. */
  height: number;
  /** Batas lebar pratinjau di layar. */
  max?: number;
  /** Napas atas-bawah pratinjau. */
  pad?: number;
  children: React.ReactNode;
}) {
  const { width: layar } = useWindowDimensions();
  const lebar = Math.min(layar - 40, max);
  const tinggi = (lebar * height) / width;
  return (
    <View style={[styles.wrap, { paddingVertical: pad }]}>
      <View style={[styles.clip, { width: lebar, height: tinggi }]}>
        <View
          style={[
            styles.full,
            { width, height, transform: [{ scale: lebar / width }] },
          ]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  clip: { overflow: 'hidden' },
  full: { transformOrigin: 'top left' },
});
