import { StyleSheet } from 'react-native';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Tombol bundar kecil berisi emoji — untuk pojok kanan atas header
// (mis. 🕘 riwayat visitasi, 👛 Kantong).
export function EmojiButton({
  emoji,
  onPress,
}: {
  emoji: string;
  onPress: () => void;
}) {
  return (
    <PressableScale style={styles.button} onPress={onPress} hitSlop={6}>
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
  emoji: { fontSize: 19, lineHeight: 25 },
});
