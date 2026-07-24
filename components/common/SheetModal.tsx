import { useEffect, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
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

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Bottom sheet standar: overlay gelap + panel dari bawah + judul.
// Bisa ditutup dengan menyeret gagang/judul ke bawah (drag-to-dismiss) atau
// menekan area gelap di atasnya. Isi form-nya diberikan lewat `children`.
export function SheetModal({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  // `rendered` menjaga Modal tetap terpasang selama animasi keluar berjalan.
  const [rendered, setRendered] = useState(visible);
  const translateY = useSharedValue(height);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.value = withTiming(0, { duration: 260 });
    } else if (rendered) {
      translateY.value = withTiming(height, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setRendered)(false);
      });
    }
    // Hanya bereaksi saat `visible` berubah — `rendered`/`height` sengaja
    // tidak jadi dependency biar animasi tidak ter-trigger ulang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  // Backdrop ikut memudar seiring sheet turun.
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - translateY.value / height),
  }));

  // Seret gagang/judul ke bawah untuk menutup. activeOffsetY(12) supaya
  // ketukan biasa tidak langsung dianggap menyeret.
  const pan = Gesture.Pan()
    .activeOffsetY(12)
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 110 || e.velocityY > 800) {
        runOnJS(onClose)();
      } else {
        translateY.value = withTiming(0, { duration: 160 });
      }
    });

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      {/* GestureHandlerRootView wajib di dalam Modal (hierarki view terpisah) */}
      <GestureHandlerRootView style={styles.flex}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.overlay, overlayStyle]}>
            <Pressable style={styles.flex} onPress={onClose} />
          </Animated.View>

          <Animated.View style={[styles.sheet, sheetStyle]}>
            {/* Zona seret: gagang + judul (tidak menghalangi form di bawah) */}
            <GestureDetector gesture={pan}>
              <View style={styles.grabZone}>
                <View style={styles.handle} />
                <VixText heading="title" additionalStyle={styles.title}>
                  {title}
                </VixText>
                {subtitle ? (
                  <VixText heading="label" additionalStyle={styles.subtitle}>
                    {subtitle}
                  </VixText>
                ) : null}
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'flex-end' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Color.OVERLAY,
  },
  sheet: {
    backgroundColor: Color.BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
  grabZone: { paddingBottom: 4 },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: Color.BORDER,
    marginBottom: 12,
  },
  title: { marginBottom: 2 },
  subtitle: { marginBottom: 14 },
});
