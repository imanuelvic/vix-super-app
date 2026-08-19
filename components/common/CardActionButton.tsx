import { type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Tombol aksi di kaki kartu — dipakai pasangan "Ubah …" & "Share PDF" di
// Monthly, Rules & Suggestions, dan Pertemuan.
//
// Dua rupa:
//   outline → garis putus, teks hijau (aksi tenang / sekunder)
//   filled  → isi hijau, teks putih (aksi utama)
//
// Keduanya bertepi 1px supaya tingginya sama persis saat berdampingan dalam
// satu baris; pada rupa `filled` warna tepinya sama dengan latarnya, jadi
// tidak terlihat.

type IconName = ComponentProps<typeof IconSymbol>['name'];

export function CardActionButton({
  icon,
  label,
  onPress,
  variant = 'outline',
  busy = false,
  disabled = false,
  additionalStyle,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'outline' | 'filled';
  /** Sedang bekerja → tampilkan spinner menggantikan ikon & label. */
  busy?: boolean;
  disabled?: boolean;
  /** Mis. `flex: 1` saat tombol berada di dalam baris dua tombol. */
  additionalStyle?: StyleProp<ViewStyle>;
}) {
  const filled = variant === 'filled';
  const tint = filled ? Color.TEXT_REVERSE : Color.MAIN;
  return (
    <PressableScale
      style={[styles.button, filled ? styles.filled : styles.outline, additionalStyle]}
      onPress={onPress}
      disabled={disabled || busy}>
      {busy ? (
        <ActivityIndicator color={tint} />
      ) : (
        <>
          <IconSymbol name={icon} size={16} color={tint} />
          <VixText heading="bold" additionalStyle={filled ? styles.textFilled : styles.textOutline}>
            {label}
          </VixText>
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  outline: { borderStyle: 'dashed', borderColor: Color.MAIN_LIGHT },
  filled: {
    backgroundColor: Color.MAIN,
    borderStyle: 'solid',
    borderColor: Color.MAIN,
  },
  textOutline: { color: Color.MAIN },
  textFilled: { color: Color.TEXT_REVERSE },
});
