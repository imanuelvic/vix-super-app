import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// 📋 Salin isi form yang sedang dibuka jadi DATA BARU.
//
// Dua bagian yang selalu berpasangan, jadi keduanya tinggal di satu berkas:
//   <CopyChip/>    tombol kecil di kanan judul modal (`headerRight`)
//   <CopyConfirm/> kotak konfirmasi INLINE di dalam modal
//
// Kenapa konfirmasinya inline dan bukan dialog: modal di atas modal tidak
// muncul di iOS. Sekali ketahuan begitu, semua tombol salin di app ini memakai
// bentuk yang sama — dan sekarang bentuk itu tinggal ditulis sekali.

export function CopyChip({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <PressableScale
      style={styles.chip}
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}>
      <VixText heading="label" additionalStyle={styles.chipText}>
        📋
      </VixText>
    </PressableScale>
  );
}

export function CopyConfirm({
  title,
  busy = false,
  onCancel,
  onConfirm,
}: {
  /** Pertanyaannya, mis. "📋 Salin jadi paket baru?" */
  title: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={styles.box}>
      <VixText heading="bold" additionalStyle={styles.boxTitle}>
        {title}
      </VixText>
      <View style={styles.row}>
        <PressableScale
          style={styles.cancel}
          onPress={onCancel}
          disabled={busy}>
          <VixText heading="bold">Batal</VixText>
        </PressableScale>
        <PressableScale
          style={styles.confirm}
          onPress={onConfirm}
          disabled={busy}
          haptic="medium">
          {busy ? (
            <ActivityIndicator color={Color.TEXT_REVERSE} />
          ) : (
            <VixText heading="bold" additionalStyle={styles.chipText}>
              Ya, Salin
            </VixText>
          )}
        </PressableScale>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Color.MAIN,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { color: Color.TEXT_REVERSE },
  box: {
    borderWidth: 1,
    borderColor: Color.MAIN,
    backgroundColor: Color.MAIN_TRANSPARENT,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    gap: 6,
  },
  boxTitle: { color: Color.MAIN_DARK },
  row: { flexDirection: 'row', gap: 8, marginTop: 2 },
  cancel: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
  confirm: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Color.MAIN,
  },
});
