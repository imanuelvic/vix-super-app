import type { ComponentProps } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    type StyleProp,
    type ViewStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { IconSymbol } from '@/components/ui/icon-symbol';

type IconName = ComponentProps<typeof IconSymbol>['name'];

// Tombol aksi utama (lebar penuh) — dipakai di semua layar biar seragam.
// Default hijau MAIN; bisa diganti (mis. background ACCENT untuk sekunder).
export function PrimaryButton({
  label,
  onPress,
  icon,
  busy = false,
  disabled = false,
  background = Color.MAIN,
  textColor = Color.TEXT_REVERSE,
  additionalStyle,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  busy?: boolean;
  /**
   * Belum boleh ditekan — syaratnya belum terpenuhi (28 Sep 2026).
   *
   * Beda dari `busy`: `busy` berarti "sedang dikerjakan, tunggu", `disabled`
   * berarti "masih ada yang harus kamu isi/pilih dulu". Rupanya sama-sama
   * diredupkan, tapi tanpa spinner — dan itu benar: tidak ada yang sedang
   * berjalan, jadi memutar lingkaran cuma membohongi.
   */
  disabled?: boolean;
  background?: string;
  textColor?: string;
  additionalStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      style={[
        styles.button,
        { backgroundColor: background },
        (busy || disabled) && styles.busy,
        additionalStyle,
      ]}
      onPress={onPress}
      disabled={busy || disabled}
      // Aksi utama terasa lebih "berbobot" daripada click kartu biasa.
      haptic="medium">
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon && <IconSymbol name={icon} size={20} color={textColor} />}
          <VixText heading="bold" additionalStyle={{ color: textColor }}>
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
    gap: 8,
    borderRadius: 12,
    paddingVertical: 12,
  },
  busy: { opacity: 0.6 },
});
