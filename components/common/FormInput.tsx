import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Color } from '@/assets/style/color';
import { closePickers } from '@/components/common/pickerBus';

// Input teks standar app — gaya seragam, tinggal panggil.
// Saat difokus, otomatis menutup date picker yang mungkin sedang terbuka
// (biar tidak makan tempat / menumpuk di iOS).
export function FormInput({ style, onFocus, ...rest }: TextInputProps) {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={Color.TEXT_PLACEHOLDER}
      onFocus={(e) => {
        closePickers();
        onFocus?.(e);
      }}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Color.TEXT_TITLE,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    borderWidth: 1,
    borderColor: Color.BORDER,
  },
});
