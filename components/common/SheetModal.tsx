import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Bottom sheet standar: overlay gelap + panel dari bawah + judul.
// Isi form-nya diberikan lewat `children`.
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
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <VixText heading="title" additionalStyle={styles.title}>
            {title}
          </VixText>
          {subtitle ? (
            <VixText heading="label" additionalStyle={styles.subtitle}>
              {subtitle}
            </VixText>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: Color.OVERLAY },
  sheet: {
    backgroundColor: Color.BACKGROUND,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
  },
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
