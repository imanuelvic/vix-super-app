import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
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

// Celah minimal dari atas layar → backdrop SELALU terlihat & bisa ditekan untuk
// menutup; sheet tidak pernah menutupi layar penuh.
const TOP_GAP = 72;

// Bottom sheet standar: overlay gelap + panel dari bawah + judul.
// - Tinggi dibatasi (maksimal = layar − keyboard − celah atas), jadi walau
//   keyboard/date picker muncul, isinya tidak menutup seluruh layar.
// - Isi form digulir DI DALAM batas itu (ScrollView bawaan; matikan lewat
//   `scroll={false}` kalau modal sudah punya scroll/daftar sendiri).
// - Bisa ditutup dengan menyeret gagang/judul ke bawah atau menekan area gelap.
export function SheetModal({
  visible,
  title,
  subtitle,
  onClose,
  scroll = true,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  scroll?: boolean;
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  // `rendered` menjaga Modal tetap terpasang selama animasi keluar berjalan.
  const [rendered, setRendered] = useState(visible);
  const translateY = useSharedValue(height);

  // Tinggi keyboard → untuk membatasi tinggi sheet agar tetap ada celah backdrop
  // di atasnya walau keyboard muncul.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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

  // Batas tinggi sheet: sisakan celah di atas walau keyboard aktif.
  const maxSheetHeight = Math.max(220, height - keyboardHeight - TOP_GAP);

  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    children
  );

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

          <Animated.View
            style={[styles.sheet, { maxHeight: maxSheetHeight }, sheetStyle]}>
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
            {body}
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
  // flexShrink:1 → ScrollView menyusut mengikuti batas sheet lalu menggulir isi.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
});
