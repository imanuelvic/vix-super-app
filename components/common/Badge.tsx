import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Badge merah — SATU bentuk untuk seluruh app.
//
// Angka yang sama muncul di tiga tempat, dan dulu digambar tiga kali dengan
// tangan (tile Home, sub-tab bawah, tombol pojok kanan). Tiga salinan berarti
// tiga kesempatan untuk berbeda diam-diam: ukuran, tepi, ambang "9+".
//
// Aturannya cuma satu dan berlaku di semua tempat:
//   0  → tidak digambar sama sekali (tanda hari ini beres 🎉)
//   >9 → "9+", supaya lebarnya tidak pernah merusak susunan di sekitarnya.

/** Ambang angka yang masih ditulis apa adanya; lebih dari ini jadi "9+". */
const MAX = 9;

export function Badge({
  count,
  ring = Color.CONTAINER,
  style,
}: {
  count: number;
  /**
   * Warna garis tepi tipis di sekeliling badge — DISAMAKAN dengan latar tempat
   * ia berdiri, jadi badge selalu terpisah rapi dari ikon di belakangnya
   * (krem di Home, putih di tab bar).
   */
  ring?: string;
  /** Penempatannya diserahkan ke pemakainya (biasanya posisi mutlak). */
  style?: StyleProp<ViewStyle>;
}) {
  if (!count || count <= 0) return null;
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={[styles.badge, { borderColor: ring }, style]}>
      <VixText heading="label" additionalStyle={styles.badgeText}>
        {count > MAX ? `${MAX}+` : count}
      </VixText>
    </Animated.View>
  );
}

// ── Penanda penyebab ──────────────────────────────────────────────────────
// Badge memberi tahu ADA yang perlu dikerjakan; ia tidak memberi tahu YANG
// MANA. Dulu begitu kamu masuk ke fiturnya, angkanya hilang dari pandangan dan
// kamu harus menebak sendiri baris mana yang menyalakannya.
//
// AttentionMark ditempel PERSIS pada penyebabnya — baris daftar, tombol pojok
// kanan, atau chip kategori — dan berdenyut pelan supaya mata langsung
// tertarik ke sana tanpa perlu membaca semuanya dulu.

const DENYUT_MS = 900;

export function AttentionMark({
  style,
  size = 10,
}: {
  style?: StyleProp<ViewStyle>;
  /** Titiknya. Baris daftar 10; chip & tombol kecil boleh 8. */
  size?: number;
}) {
  const denyut = useSharedValue(0);

  // Dimulai sekali saat penandanya muncul, lalu berdenyut terus selama
  // penyebabnya masih ada. Begitu perkaranya beres, komponennya tidak
  // digambar lagi — jadi tak ada animasi yang tertinggal berjalan.
  useEffect(() => {
    denyut.value = withRepeat(
      withSequence(
        withTiming(1, { duration: DENYUT_MS, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, [denyut]);

  const gelombang = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - denyut.value),
    transform: [{ scale: 1 + denyut.value * 1.8 }],
  }));

  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}>
      {/* Gelombang yang melebar & memudar — di belakang titiknya, dan
          pointerEvents 'none' supaya tidak pernah mencuri tekanan jari. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.riak,
          { borderRadius: size / 2 },
          gelombang,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Color.DANGER,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: Color.TEXT_REVERSE, fontSize: 11, lineHeight: 16 },
  mark: { backgroundColor: Color.DANGER },
  riak: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Color.DANGER,
  },
});
