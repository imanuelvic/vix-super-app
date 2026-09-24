import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

// Loading di tengah — dipakai saat data belum termuat.
//
// Sejak 23 Sep 2026 yang berputar bukan lagi spinner bawaan iOS, melainkan
// animasi vix (assets/gif/vix_loading_animation.gif). Alasannya sederhana:
// spinner abu-abu itu milik sistem, sedangkan jeda memuat data adalah saat
// app paling sering dilihat diam. Karena animasinya berlatar hijau tergelap
// (sudutnya #0B3D36), ia DIPOTONG BULAT — di atas layar krem ia terbaca
// sebagai satu keping merek yang berputar, bukan kotak hijau yang nyasar.
//
// GIF diputar sendiri oleh iOS lewat <Image>, jadi tidak ada pustaka animasi
// baru. Ukurannya kecil di layar; berkasnya dipakai ulang dari cache gambar,
// jadi ratusan pemakaian LoadingCenter tetap satu gambar yang sama.
export function LoadingCenter({
  style,
  size = 'small',
}: {
  style?: StyleProp<ViewStyle>;
  /** 'small' = jeda di dalam kartu/daftar · 'large' = satu layar penuh. */
  size?: 'small' | 'large';
}) {
  const sisi = size === 'large' ? 96 : 52;
  return (
    <View style={[styles.center, style]}>
      <Image
        source={require('@/assets/gif/vix_loading_animation.gif')}
        style={{ width: sisi, height: sisi, borderRadius: sisi / 2 }}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
