import { Pressable, StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { VixText } from '@/components/common/VixText';

// Tombol bundar kecil berisi emoji — untuk pojok kanan atas header
// (mis. 🕘 riwayat visitasi, 💼 Budget Khusus).
export function EmojiButton({
  emoji,
  onPress,
}: {
  emoji: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress} hitSlop={6}>
      <VixText additionalStyle={styles.emoji}>{emoji}</VixText>
    </Pressable>
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
  emoji: { fontSize: 19, lineHeight: 25 },
});
