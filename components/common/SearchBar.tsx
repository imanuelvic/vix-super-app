import { StyleSheet, TextInput, View } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { closePickers } from '@/components/common/pickerBus';
import { IconSymbol } from '@/components/ui/icon-symbol';

// Kotak pencarian standar: ikon 🔍 + input + tombol hapus (✕) saat ada teks.
// Reusable untuk daftar mana pun yang butuh cari cepat.
// `autoFocus` → langsung terfokus & keyboard muncul begitu kotaknya dipasang
// (dipakai saat mode cari dibuka lewat tombol, biar tak perlu ketuk dua kali).
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Cari…',
  autoFocus = false,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.wrap}>
      <IconSymbol name="magnifyingglass" size={18} color={Color.TEXT_LABEL} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Color.TEXT_PLACEHOLDER}
        returnKeyType="search"
        autoFocus={autoFocus}
        autoCorrect={false}
        clearButtonMode="never"
        onFocus={closePickers}
      />
      {value.length > 0 && (
        <PressableScale onPress={() => onChangeText('')} hitSlop={10}>
          <IconSymbol name="xmark" size={16} color={Color.TEXT_LABEL} />
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Color.CONTAINER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Color.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: Color.TEXT_TITLE,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    padding: 0,
  },
});
