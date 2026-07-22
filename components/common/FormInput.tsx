import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { Color } from '@/assets/style/color';

// Input teks standar app — gaya seragam, tinggal panggil.
export function FormInput({ style, ...rest }: TextInputProps) {
  return (
    <TextInput
      style={[styles.input, style]}
      placeholderTextColor={Color.TEXT_PLACEHOLDER}
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
