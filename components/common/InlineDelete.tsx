import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Konfirmasi hapus DI DALAM modal yang sama — iOS tidak mendukung modal
// bertumpuk (ConfirmDialog di atas SheetModal tidak muncul).
// Langkah 1: link "Hapus…". Langkah 2: kotak konfirmasi inline.
// Beri `key` per item di pemanggil supaya state konfirmasi ikut reset.
export function InlineDelete({
  label,
  busy = false,
  onDelete,
}: {
  label: string;
  busy?: boolean;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <PressableScale onPress={() => setConfirming(true)} disabled={busy}>
        <VixText heading="bold" additionalStyle={styles.link}>
          {label}
        </VixText>
      </PressableScale>
    );
  }

  return (
    <View style={styles.confirmBox}>
      <VixText heading="label" additionalStyle={styles.confirmText}>
        Yakin mau menghapus? Tindakan ini permanen.
      </VixText>
      <View style={styles.row}>
        <PressableScale
          style={styles.cancel}
          onPress={() => setConfirming(false)}
          disabled={busy}>
          <VixText heading="bold">Batal</VixText>
        </PressableScale>
        <PressableScale style={styles.delete} onPress={onDelete} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={Color.TEXT_REVERSE} />
          ) : (
            <VixText heading="bold" additionalStyle={styles.deleteText}>
              Ya, Hapus
            </VixText>
          )}
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Jarak ke footer (tombol Batal/Simpan) sudah diatur global lewat
  // `footer.marginTop` di SheetModal — di sini cukup jarak kecil saja.
  link: {
    color: Color.DANGER,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  confirmBox: {
    borderWidth: 1,
    borderColor: Color.DANGER,
    borderRadius: 12,
    padding: 10,
    marginTop: 6,
    marginBottom: 4,
    gap: 8,
  },
  confirmText: { color: Color.DANGER, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 8 },
  cancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  delete: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Color.DANGER,
  },
  deleteText: { color: Color.TEXT_REVERSE },
});
