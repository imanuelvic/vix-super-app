import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';

// Modal kecil di tengah layar (dialog). Isinya diberikan lewat `children`.
export function CenterDialog({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Latar memudar masuk, kotak dialog memantul kecil (zoom) */}
        <Animated.View
          entering={FadeIn.duration(150)}
          style={styles.overlay}>
          {/* Tekan area gelap di luar kotak → tutup (di belakang kotak) */}
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <Animated.View entering={ZoomIn.duration(180)} style={styles.box}>
            {children}
          </Animated.View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: Color.OVERLAY,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  box: {
    alignSelf: 'stretch',
    backgroundColor: Color.BACKGROUND,
    borderRadius: 18,
    padding: 20,
  },
});
