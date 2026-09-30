import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { PriceChart } from '@/components/investment/PriceChart';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { formatShortRupiah } from '@/lib/format';
import type { MarketPoint } from '@/lib/market';

// Grafik harga SATU LAYAR PENUH yang bisa dicubit untuk diperbesar.
//
// Kenapa perlu (30 Sep 2026): di kartu kecil, enam bulan harga emas cuma
// setinggi 162 px. Gerakan harian yang justru menentukan "beli kapan, jual
// kapan" tenggelam jadi getaran setebal garis. Di sini grafiknya memakai
// seluruh layar, lalu cubitan membesarkannya sampai 8 kali sehingga satu pekan
// pun bisa dibaca titik per titik.
//
// Yang diperbesar adalah GAMBARNYA, bukan datanya: deretnya sama persis dengan
// yang di kartu, tidak ada permintaan jaringan tambahan, dan menutup layar ini
// tidak mengubah apa pun.
//
// Tanpa modul native baru: react-native-gesture-handler & reanimated memang
// sudah dipakai SheetModal sejak lama, jadi ini tetap cukup `eas update`.

const SKALA_MIN = 1;
const SKALA_MAKS = 8;

export function ChartFullscreen({
  visible,
  onClose,
  title,
  sub,
  series,
  color,
  format = formatShortRupiah,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Baris kecil di bawah judul, mis. rentang tanggalnya. */
  sub: string;
  series: MarketPoint[];
  color?: string;
  format?: (n: number) => string;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const skala = useSharedValue(1);
  const skalaAwal = useSharedValue(1);
  const geserX = useSharedValue(0);
  const geserY = useSharedValue(0);
  const geserAwalX = useSharedValue(0);
  const geserAwalY = useSharedValue(0);

  const cubit = Gesture.Pinch()
    .onUpdate((e) => {
      const n = skalaAwal.value * e.scale;
      skala.value = n < SKALA_MIN ? SKALA_MIN : n > SKALA_MAKS ? SKALA_MAKS : n;
    })
    .onEnd(() => {
      skalaAwal.value = skala.value;
      // Kembali pas ke tengah begitu diperkecil habis, supaya tidak pernah
      // tertinggal di posisi geseran yang membuat grafiknya separuh keluar.
      if (skala.value <= SKALA_MIN) {
        geserX.value = withTiming(0, { duration: 160 });
        geserY.value = withTiming(0, { duration: 160 });
        geserAwalX.value = 0;
        geserAwalY.value = 0;
      }
    });

  // Menggeser hanya masuk akal SESUDAH diperbesar; selama masih 1x, seluruh
  // grafik memang sudah terlihat.
  const geser = Gesture.Pan()
    .onUpdate((e) => {
      if (skala.value <= SKALA_MIN) return;
      geserX.value = geserAwalX.value + e.translationX;
      geserY.value = geserAwalY.value + e.translationY;
    })
    .onEnd(() => {
      geserAwalX.value = geserX.value;
      geserAwalY.value = geserY.value;
    });

  // Click dua kali = kembali utuh. Jalan keluar yang pasti kalau tercubit
  // terlalu jauh dan bagian yang dicari sudah di luar layar.
  const clickGanda = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      skala.value = withTiming(1, { duration: 200 });
      skalaAwal.value = 1;
      geserX.value = withTiming(0, { duration: 200 });
      geserY.value = withTiming(0, { duration: 200 });
      geserAwalX.value = 0;
      geserAwalY.value = 0;
    });

  const gerak = Gesture.Simultaneous(cubit, geser, clickGanda);

  const gaya = useAnimatedStyle(() => ({
    transform: [
      { translateX: geserX.value },
      { translateY: geserY.value },
      { scale: skala.value },
    ],
  }));

  // Grafiknya memakai seluruh layar dikurangi kepala & kaki keterangannya.
  const tinggiGrafik = Math.max(220, height - insets.top - insets.bottom - 150);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      {/* GestureHandlerRootView wajib di dalam Modal (hierarki view terpisah) */}
      <GestureHandlerRootView style={styles.root}>
        <View style={[styles.head, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headText}>
            <VixText heading="title" additionalStyle={styles.title}>
              {title}
            </VixText>
            <VixText heading="label" additionalStyle={styles.sub}>
              {sub}
            </VixText>
          </View>
          <PressableScale style={styles.close} onPress={onClose}>
            <IconSymbol name="xmark" size={20} color={Color.TEXT_REVERSE} />
          </PressableScale>
        </View>

        <GestureDetector gesture={gerak}>
          {/* Pembungkusnya yang memotong (overflow hidden), isinya yang
              bergerak — jadi grafik yang sudah diperbesar tidak pernah
              menimpa kepala atau kaki layar ini. */}
          <View style={styles.panggung}>
            <Animated.View style={gaya}>
              <PriceChart
                series={series}
                width={width}
                height={tinggiGrafik}
                color={color}
                format={format}
              />
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={[styles.foot, { paddingBottom: insets.bottom + 12 }]}>
          <VixText heading="label" additionalStyle={styles.hint}>
            Cubit untuk memperbesar · geser untuk berpindah · click dua kali
            untuk mengembalikan
          </VixText>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Latar gelap, bukan gading: grafik tipis di atas layar terang jadi silau,
  // dan layar ini memang dibuka untuk dipelototi lama-lama.
  root: { flex: 1, backgroundColor: Color.MAIN_DARK },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headText: { flex: 1 },
  title: { color: Color.TEXT_REVERSE },
  sub: { color: Color.TEXT_ON_DARK_MUTED },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Color.OVERLAY,
  },
  panggung: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  foot: { paddingHorizontal: 20, paddingTop: 10 },
  hint: { color: Color.TEXT_ON_DARK_MUTED, textAlign: 'center' },
});
