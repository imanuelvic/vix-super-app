import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Sepasang tombol modal: Batal + aksi utama (Simpan/Hapus/dll).
export function DualButtons({
  confirmLabel,
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  confirmLabel: string;
  danger?: boolean; // true = tombol merah (aksi destruktif)
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.cancel} onPress={onCancel} disabled={busy}>
        <VixText heading="bold">Batal</VixText>
      </Pressable>
      <Pressable
        style={[styles.confirm, danger && styles.danger, busy && styles.busy]}
        onPress={onConfirm}
        disabled={busy}>
        {busy ? (
          <ActivityIndicator color={Color.TEXT_REVERSE} />
        ) : (
          <VixText heading="bold" additionalStyle={styles.confirmText}>
            {confirmLabel}
          </VixText>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  confirm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Color.MAIN,
  },
  danger: { backgroundColor: Color.DANGER },
  busy: { opacity: 0.6 },
  confirmText: { color: Color.TEXT_REVERSE },
});
