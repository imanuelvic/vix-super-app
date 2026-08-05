import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Color } from '@/assets/style/color';
import { closePickers } from '@/components/common/pickerBus';
import { VixText } from '@/components/common/VixText';

// Input NOMINAL UANG — sama persis dengan FormInput, tapi ada awalan "Rp"
// permanen di kiri biar jelas ini mengisi harga/biaya (selalu terlihat, bukan
// cuma placeholder). Keyboard angka & otomatis menutup date picker saat difokus
// (seperti FormInput). Pakai `value`/`onChangeText`/`placeholder` seperti biasa;
// format ribuan tetap ditangani pemanggil (mis. groupDigits).
export function MoneyInput({
  style,
  onFocus,
  ...rest
}: Omit<TextInputProps, 'style'> & { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.wrap, style]}>
      <VixText heading="paragraph" additionalStyle={styles.prefix}>
        Rp
      </VixText>
      <TextInput
        style={styles.input}
        placeholderTextColor={Color.TEXT_PLACEHOLDER}
        keyboardType="number-pad"
        onFocus={(e) => {
          closePickers();
          onFocus?.(e);
        }}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingLeft: 16,
  },
  prefix: { color: Color.TEXT_LABEL, marginRight: 6, fontSize: 16 },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 16,
    color: Color.TEXT_TITLE,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
  },
});
