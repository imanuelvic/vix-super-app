import {
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Pil sekunder berlatar CONTAINER: aksi pelengkap yang duduk DI DALAM form
// atau sheet (✨ Rapihkan dengan AI di notulen CORE, ✨ Generate with AI di
// jurnal harian). Bukan tombol utama, jadi sengaja tidak sebesar
// <PrimaryButton/>; beda dari <MiniButton/> yang bergaris & berwarna fitur.
//
// `busy` = spinner kecil di kiri labelnya (label biasanya ikut berganti, mis.
// "Merapihkan…"). Peredupan saat nonaktif TIDAK diatur di sini: tiap pemakai
// punya artinya sendiri (sudah dipakai vs belum boleh), jadi dioper lewat
// `additionalStyle` bersama jarak luarnya.
export function SoftPill({
  label,
  onPress,
  busy = false,
  disabled = false,
  additionalStyle,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  additionalStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <PressableScale
      style={[styles.pill, additionalStyle]}
      onPress={onPress}
      disabled={disabled || busy}>
      {busy ? <ActivityIndicator size="small" color={Color.MAIN_DARK} /> : null}
      <VixText heading="label" additionalStyle={styles.text}>
        {label}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Color.CONTAINER,
    borderWidth: 1,
    borderColor: Color.BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: { color: Color.MAIN_DARK },
});
