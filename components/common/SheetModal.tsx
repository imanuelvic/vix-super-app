import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
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
import { DualButtons } from '@/components/common/DualButtons';
import { VixText } from '@/components/common/VixText';

// Celah minimal dari atas layar → backdrop SELALU terlihat & bisa ditekan untuk
// menutup; sheet tidak pernah menutupi layar penuh.
const TOP_GAP = 72;

// Bottom sheet standar: overlay gelap + panel dari bawah + judul.
// - Tinggi dibatasi MAKSIMAL 3/4 layar (dan tak melebihi ruang di atas keyboard),
//   jadi modal tidak pernah menutupi seluruh tampilan; isi pendek tetap ringkas.
// - Isi form digulir DI DALAM batas itu (ScrollView bawaan; matikan lewat
//   `scroll={false}` kalau modal sudah punya scroll/daftar sendiri).
// - `footer` = area tombol aksi (mis. Batal/Simpan) yang MENEMPEL di bawah —
//   selalu terlihat tanpa perlu scroll, dengan garis pemisah di atasnya.
// - `headerRight` = tombol kecil di kanan judul (mis. 📋 salin). Tanpa prop ini
//   tata letak judul persis seperti semula.
// - Bisa ditutup dengan menyeret gagang/judul ke bawah atau menekan area gelap.
export function SheetModal({
  visible,
  title,
  subtitle,
  onClose,
  scroll = true,
  children,
  footer,
  headerRight,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  scroll?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  headerRight?: ReactNode;
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

  // Batas tinggi sheet: MAKSIMAL 3/4 layar, dan tak melebihi ruang di atas
  // keyboard (biar backdrop tetap terlihat & tak menutup layar penuh).
  const maxSheetHeight = Math.max(
    220,
    Math.min(height * 0.75, height - keyboardHeight - TOP_GAP),
  );

  // Bar aksi (Batal/Simpan = DualButtons) OTOMATIS dipisah dari isi lalu dipin
  // di footer yang menempel — jadi selalu terlihat tanpa perlu scroll. `footer`
  // eksplisit (bila dioper) menang atas deteksi otomatis.
  const kids = Children.toArray(children);
  const autoBar =
    footer != null
      ? undefined
      : kids.find((c) => isValidElement(c) && c.type === DualButtons);
  const contentKids = autoBar ? kids.filter((c) => c !== autoBar) : kids;
  const footerContent = footer ?? autoBar;

  const body = scroll ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {contentKids}
    </ScrollView>
  ) : (
    contentKids
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
                {/* Judul memenuhi lebar seperti biasa; `headerRight` hanya
                    mengambil sisa ruang di kanan kalau memang dioper. */}
                <View style={styles.titleRow}>
                  <View style={styles.titleMain}>
                    <VixText heading="title" additionalStyle={styles.title}>
                      {title}
                    </VixText>
                    {subtitle ? (
                      <VixText heading="label" additionalStyle={styles.subtitle}>
                        {subtitle}
                      </VixText>
                    ) : null}
                  </View>
                  {headerRight}
                </View>
              </View>
            </GestureDetector>
            {body}
            {footerContent ? (
              <View style={styles.footer}>{footerContent}</View>
            ) : null}
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
  // Baris judul: teks di kiri (memuai), tombol opsional di kanan. Margin bawah
  // judul/subjudul tetap di dalam kolom teks → tinggi header tidak berubah.
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleMain: { flex: 1 },
  title: { marginBottom: 2 },
  subtitle: { marginBottom: 14 },
  // flexShrink:1 → ScrollView menyusut mengikuti batas sheet lalu menggulir isi.
  scroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  // Footer menempel di bawah: garis pemisah edge-to-edge + latar senada, jadi
  // tombol aksi (Batal/Simpan) selalu terlihat tanpa perlu scroll.
  // marginTop → SEMUA modal otomatis punya jarak antara isi paling bawah dan
  // garis pemisah, jadi tak ada tombol/kolom yang menempel ke Batal/Simpan.
  // Berlaku untuk mode scroll maupun `scroll={false}` (footer selalu sibling
  // dari isi), jadi tak perlu diatur satu-satu di tiap layar.
  footer: {
    marginTop: 12,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Color.BORDER,
    backgroundColor: Color.BACKGROUND,
  },
});
