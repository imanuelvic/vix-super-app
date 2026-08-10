import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Tombol bundar kecil berisi emoji — untuk pojok kanan atas header
// (mis. 🕘 riwayat visitasi, 👛 Saku). `active` = sedang aktif (mis. filter
// menyala) → latar hijau muda sebagai penanda.
export function EmojiButton({
  emoji,
  onPress,
  active = false,
}: {
  emoji: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <PressableScale
      style={[styles.button, active && styles.buttonActive]}
      onPress={onPress}
      hitSlop={6}>
      <VixText additionalStyle={styles.emoji}>{emoji}</VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Color.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: Color.MAIN_LIGHT,
    borderWidth: 1.5,
    borderColor: Color.MAIN,
  },
  emoji: { fontSize: 19, lineHeight: 25 },
});
