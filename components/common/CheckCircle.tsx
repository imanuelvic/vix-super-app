import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Lingkaran ceklis — dipakai di Task, kebiasaan Habits, Timeline, dll.
// Momen mencentang adalah momen paling sering & paling memuaskan di app ini,
// jadi dibuat tiga lapis animasi sekaligus:
//   1. isian mint memudar masuk (warna),
//   2. seluruh lingkaran "meletup" sekali lalu memantul balik (skala),
//   3. tanda centang masuk sambil menegak dari posisi miring (spring + rotasi),
// seolah baru saja digoreskan pakai spidol.
// `skipped` = baris ini sengaja DILEWATI. Lingkarannya terisi ✕ MERAH dengan
// animasi yang sama persis seperti centang (letup + goresan miring), cuma
// miringnya ke arah berlawanan supaya rasanya beda: centang = "berhasil",
// ✕ = "dilewati". Bentuk & ukurannya identik, jadi baris tidak bergeser.
// `locked` = lingkaran ini BUKAN tombol: isinya terisi sendiri dari data lain
// (mis. langkah "Revive" di gerbang doa pagi yang tercentang otomatis begitu
// Revive tersimpan). Bedanya dibuat kelihatan supaya tidak ada yang menekan
// lingkaran yang memang tidak akan menanggapi:
//   • cincinnya ABU-ABU, bukan mint — mint = "silakan tekan"
//   • saat masih kosong, dalamnya diberi isian krem samar → terlihat "belum
//     waktunya", bukan kotak kosong yang menunggu ditekan
//   • saat tercentang, tanda centangnya ABU-ABU (bukan teal pekat) → kebaca
//     "tercentang, tapi bukan olehmu"
//   • tidak pernah meletup saat berubah (letupan itu umpan balik sentuhan)
export function CheckCircle({
  checked,
  size = 26,
  skipped = false,
  locked = false,
}: {
  checked: boolean;
  size?: number;
  skipped?: boolean;
  locked?: boolean;
}) {
  const progress = useSharedValue(checked ? 1 : 0); // isian mint
  const mark = useSharedValue(checked ? 1 : 0); // tanda centang
  const cross = useSharedValue(skipped ? 1 : 0); // tanda ✕
  const pop = useSharedValue(1); // letupan lingkaran

  // Letupan HANYA saat pengguna menekan, bukan saat layar pertama dibuka —
  // kalau tidak, semua kebiasaan yang sudah tercentang akan meletup berjamaah.
  const mounted = useRef(false);

  useEffect(() => {
    progress.value = withTiming(checked ? 1 : 0, { duration: 160 });
    mark.value = checked
      ? withSpring(1, { damping: 10, stiffness: 320 })
      : withTiming(0, { duration: 120 });
    cross.value = skipped
      ? withSpring(1, { damping: 10, stiffness: 320 })
      : withTiming(0, { duration: 120 });
    if ((checked || skipped) && mounted.current && !locked) {
      pop.value = withSequence(
        withTiming(1.18, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 260 }),
      );
    }
    mounted.current = true;
  }, [checked, skipped, locked, progress, mark, cross, pop]);

  // Isian lingkaran + letupan. ✕ menang atas centang: isiannya merah muda,
  // bukan mint. Warna garis tepi diatur statis di bawah (Reanimated hanya
  // menyentuh properti yang ditulis di sini).
  const circleStyle = useAnimatedStyle(() => {
    const empty = locked ? Color.CONTRAST_CONTAINER : 'transparent';
    const fill =
      cross.value > 0
        ? interpolateColor(
            cross.value,
            [0, 1],
            ['transparent', Color.FINANCE_EXPENSE],
          )
        : interpolateColor(progress.value, [0, 1], [empty, Color.MAIN_LIGHT]);
    return { backgroundColor: fill, transform: [{ scale: pop.value }] };
  });

  const checkStyle = useAnimatedStyle(() => ({
    opacity: mark.value,
    transform: [
      { scale: mark.value },
      // Mulai miring lalu tegak — kesannya "digoreskan", bukan sekadar muncul.
      { rotate: `${(1 - mark.value) * -30}deg` },
    ],
  }));

  const crossStyle = useAnimatedStyle(() => ({
    opacity: cross.value,
    transform: [
      { scale: cross.value },
      // Miring ke arah sebaliknya — goresan "coret", bukan goresan centang.
      { rotate: `${(1 - cross.value) * 30}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2 },
        circleStyle,
        locked && styles.circleLocked,
        skipped && styles.circleSkipped,
      ]}>
      {/* Dua tanda ditumpuk (absolut) supaya yang tersembunyi tidak memakan
          ruang & menggeser yang tampil — pergantiannya jadi mulus. */}
      <Animated.View style={[styles.mark, checkStyle]}>
        <IconSymbol
          name="checkmark"
          size={Math.round(size * 0.62)}
          // Abu-abu untuk centang otomatis — pembeda kedua setelah cincinnya,
          // supaya "dicentang sendiri" tidak tertukar dengan "aku yang centang".
          color={locked ? Color.TEXT_LABEL : Color.MAIN_DARK}
        />
      </Animated.View>
      <Animated.View style={[styles.mark, crossStyle]}>
        <IconSymbol
          name="xmark"
          size={Math.round(size * 0.56)}
          color={Color.DANGER}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 2,
    borderColor: Color.MAIN_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Hanya garis tepinya yang diubah: isian lingkaran diatur animasi (Reanimated)
  // dan akan menimpa gaya statis apa pun, jadi jangan diatur dari sini.
  // Cincin abu-abu = terisi otomatis, bukan tombol. Isian dalamnya diatur di
  // `circleStyle` (animasi), jadi jangan ditulis di sini.
  circleLocked: { borderColor: Color.TEXT_PLACEHOLDER },
  circleSkipped: { borderColor: Color.DANGER },
  mark: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
