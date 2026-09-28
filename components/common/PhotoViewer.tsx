import { useEffect } from 'react';
import { Image, Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// 📸 Foto SATU LAYAR PENUH, bisa dicubit untuk memperbesar (27 Sep 2026).
//
// Sebelum ini foto dokumentasi cuma tampil sebesar kartunya, dipotong
// `resizeMode: 'cover'` — wajah di tepi foto bisa terpotong dan tidak ada cara
// melihat aslinya di dalam app sama sekali.
//
// Yang dipakai SUDAH ADA di proyek, jadi tidak ada modul native baru:
// react-native-gesture-handler (cubit & geser) + react-native-reanimated
// (gerakannya di UI thread, jadi mulus walau fotonya besar).
//
//   cubit / lepas cubit  → perbesar 1× sampai 5×
//   geser                → hanya SAAT sudah diperbesar (kalau tidak, ia cuma
//                          menutup layarnya tanpa sengaja)
//   click 2×             → langsung ke 2,5× di titik tengah, click 2× lagi balik
//   click 1×             → tutup, TAPI cuma saat belum diperbesar
//
// Aturan terakhir itu yang membuatnya tidak menyebalkan: waktu foto sedang
// diperbesar, click yang meleset tidak membuang posisi zoom yang sudah pas.

/** Sejauh mana boleh diperbesar. */
const MAKS_ZOOM = 5;
/** Perbesaran sekali click 2× — cukup untuk melihat wajah, belum pecah. */
const ZOOM_CEPAT = 2.5;

export function PhotoViewer({
  uri,
  onClose,
}: {
  /** Foto yang sedang dilihat; null = tidak ada yang dibuka. */
  uri: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const skala = useSharedValue(1);
  const skalaAwal = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const xAwal = useSharedValue(0);
  const yAwal = useSharedValue(0);

  // Foto lain dibuka → mulai lagi dari ukuran penuh, bukan mewarisi zoom &
  // posisi foto sebelumnya.
  useEffect(() => {
    skala.value = 1;
    skalaAwal.value = 1;
    x.value = 0;
    y.value = 0;
    xAwal.value = 0;
    yAwal.value = 0;
  }, [uri, skala, skalaAwal, x, y, xAwal, yAwal]);

  const cubit = Gesture.Pinch()
    .onUpdate((e) => {
      const nilai = skalaAwal.value * e.scale;
      skala.value = Math.min(Math.max(nilai, 1), MAKS_ZOOM);
    })
    .onEnd(() => {
      skalaAwal.value = skala.value;
      // Kembali ke ukuran penuh → fotonya ditengahkan lagi sendiri, supaya
      // tidak tertinggal separuh di luar layar.
      if (skala.value <= 1) {
        x.value = withTiming(0);
        y.value = withTiming(0);
        xAwal.value = 0;
        yAwal.value = 0;
      }
    });

  const geser = Gesture.Pan()
    .onUpdate((e) => {
      if (skala.value <= 1) return;
      x.value = xAwal.value + e.translationX;
      y.value = yAwal.value + e.translationY;
    })
    .onEnd(() => {
      xAwal.value = x.value;
      yAwal.value = y.value;
    });

  const dobel = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      const ke = skala.value > 1 ? 1 : ZOOM_CEPAT;
      skala.value = withTiming(ke, { duration: 180 });
      skalaAwal.value = ke;
      x.value = withTiming(0);
      y.value = withTiming(0);
      xAwal.value = 0;
      yAwal.value = 0;
    });

  const tunggal = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (skala.value <= 1) runOnJS(onClose)();
    });

  // Exclusive: click 1× baru berlaku sesudah dipastikan bukan awal click 2×.
  const gestur = Gesture.Simultaneous(
    cubit,
    geser,
    Gesture.Exclusive(dobel, tunggal),
  );

  const gaya = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { scale: skala.value },
    ],
  }));

  if (!uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      {/* GestureHandlerRootView wajib DI DALAM Modal: isinya hierarki view
          terpisah, jadi root di app/_layout.tsx tidak menjangkaunya (pola yang
          sama dipakai SheetModal). */}
      <GestureHandlerRootView style={styles.flex}>
        <View style={styles.backdrop}>
          <GestureDetector gesture={gestur}>
            <Animated.View style={[styles.stage, gaya]}>
              <Image
                source={{ uri }}
                style={{ width, height }}
                resizeMode="contain"
              />
            </Animated.View>
          </GestureDetector>

          <PressableScale
            style={[styles.close, { top: insets.top + 8 }]}
            hitSlop={10}
            onPress={onClose}>
            <VixText heading="bold" additionalStyle={styles.closeText}>
              ✕
            </VixText>
          </PressableScale>

          <VixText
            heading="label"
            additionalStyle={[styles.hint, { bottom: insets.bottom + 18 }]}>
            Cubit untuk memperbesar · click 2× untuk zoom cepat
          </VixText>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    flex: 1,
    backgroundColor: Color.PHOTO_BACKDROP,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Panggung foto: sebesar layar, jadi cubit & geser tetap tertangkap walau
  // fotonya sendiri (contain) menyisakan pita hitam di atas & bawah.
  stage: { justifyContent: 'center', alignItems: 'center' },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: Color.SURFACE_ON_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: Color.TEXT_REVERSE },
  hint: {
    position: 'absolute',
    color: Color.TEXT_ON_DARK_SOFT,
    textAlign: 'center',
  },
});
