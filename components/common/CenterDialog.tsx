import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  View,
} from 'react-native';

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
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.overlay}>
          <View style={styles.box}>{children}</View>
        </View>
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
