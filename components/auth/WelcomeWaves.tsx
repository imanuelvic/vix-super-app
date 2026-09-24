import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Color } from '@/assets/style/color';

// 🌊 Ombak warna utama di kaki layar Masuk.
//
// Tiga lapis gelombang yang bergeser mendatar dengan kecepatan & arah berbeda.
// Yang membuatnya terasa "hidup" bukan satu gelombang cepat, melainkan selisih
// kecepatan antar lapis: mata membaca lapis depan bergerak di atas lapis
// belakang yang lebih lambat, dan itu terbaca sebagai kedalaman.
//
// Cara mengulangnya: tiap lapis digambar DUA KALI lebar layar dengan bentuk
// yang berulang tiap satu lebar layar, lalu digeser sejauh satu lebar layar.
// Begitu geserannya penuh, bentuknya persis sama dengan saat mulai, jadi
// lompatan baliknya tidak pernah kelihatan.
//
// Semuanya berjalan di utas UI (Reanimated), tidak menyentuh state React sama
// sekali, jadi mengetik email/password tetap ringan.

/** Tinggi seluruh tumpukan ombak. */
export const WAVE_HEIGHT = 200;

/**
 * Satu gelombang selebar `w * 2` yang berulang tiap `w`.
 *
 * `Q` menaikkan gelombang pertama, lalu tiap `T` mencerminkan titik kendali
 * sebelumnya sehingga naik-turunnya berselang-seling dengan sendirinya.
 */
function jalurOmbak(w: number, amplitudo: number, garisAir: number, tinggi: number): string {
  const y = garisAir;
  return (
    `M0 ${y} Q ${w * 0.25} ${y - amplitudo} ${w * 0.5} ${y} T ${w} ${y} ` +
    `T ${w * 1.5} ${y} T ${w * 2} ${y} V ${tinggi} H 0 Z`
  );
}

type LapisProps = {
  lebar: number;
  warna: string;
  opacity: number;
  /** Lama satu putaran penuh (milidetik). Makin besar makin tenang. */
  durasi: number;
  /** 1 = bergerak ke kanan, -1 = ke kiri. */
  arah: 1 | -1;
  amplitudo: number;
  garisAir: number;
};

function Lapis({ lebar, warna, opacity, durasi, arah, amplitudo, garisAir }: LapisProps) {
  const mulai = arah === 1 ? -lebar : 0;
  const akhir = arah === 1 ? 0 : -lebar;
  const geser = useSharedValue(mulai);

  useEffect(() => {
    geser.value = mulai;
    geser.value = withRepeat(
      withTiming(akhir, { duration: durasi, easing: Easing.linear }),
      -1,
      false,
    );
  }, [geser, mulai, akhir, durasi]);

  const gaya = useAnimatedStyle(() => ({ transform: [{ translateX: geser.value }] }));

  return (
    <Animated.View style={[styles.lapis, gaya, { width: lebar * 2 }]}>
      <Svg width={lebar * 2} height={WAVE_HEIGHT}>
        <Path
          d={jalurOmbak(lebar, amplitudo, garisAir, WAVE_HEIGHT)}
          fill={warna}
          opacity={opacity}
        />
      </Svg>
    </Animated.View>
  );
}

export function WelcomeWaves() {
  const { width } = useWindowDimensions();
  // Naik-turun pelan seluruh tumpukan: napasnya, bukan gerakannya.
  const napas = useSharedValue(0);

  useEffect(() => {
    napas.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [napas]);

  const gayaNapas = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - napas.value) * 6 }],
  }));

  return (
    // pointerEvents 'none': ini gambar, tidak boleh pernah mencuri sentuhan
    // dari kolom isian di atasnya.
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.napas, gayaNapas]}>
        <Lapis lebar={width} warna={Color.MAIN} opacity={0.22} durasi={15000} arah={1} amplitudo={18} garisAir={64} />
        <Lapis lebar={width} warna={Color.MAIN} opacity={0.45} durasi={10500} arah={-1} amplitudo={14} garisAir={96} />
        <Lapis lebar={width} warna={Color.MAIN} opacity={1} durasi={19000} arah={1} amplitudo={11} garisAir={126} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: WAVE_HEIGHT,
    overflow: 'hidden',
  },
  // Sedikit lebih tinggi dari wadahnya supaya naik-turunnya tidak pernah
  // memperlihatkan celah di kaki layar.
  napas: { position: 'absolute', left: 0, right: 0, bottom: -8, height: WAVE_HEIGHT },
  lapis: { position: 'absolute', left: 0, bottom: 0, height: WAVE_HEIGHT },
});
