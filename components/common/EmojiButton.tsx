import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Color } from '@/assets/style/color';
import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Tombol bundar kecil berisi emoji — untuk pojok kanan atas header
// (mis. 🕘 riwayat visitasi, 👛 Saku). `active` = sedang aktif (mis. filter
// menyala) → latar hijau muda sebagai penanda, dan perpindahannya memudar
// halus.
//
// Garis tepinya SELALU ada (saat nonaktif warnanya disamakan dengan latar) —
// dulu garis itu baru muncul saat aktif, jadi tombolnya sempat "berkedut"
// mengecil setiap kali dinyalakan.
export function EmojiButton({
  emoji,
  onPress,
  active = false,
}: {
  emoji: string;
  onPress: () => void;
  active?: boolean;
}) {
  const on = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    on.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active, on]);

  const skin = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      on.value,
      [0, 1],
      [Color.ACCENT, Color.MAIN_LIGHT],
    ),
    borderColor: interpolateColor(on.value, [0, 1], [Color.ACCENT, Color.MAIN]),
  }));

  return (
    <PressableScale style={[styles.button, skin]} onPress={onPress} hitSlop={6}>
      <VixText additionalStyle={styles.emoji}>{emoji}</VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: Color.ACCENT,
    backgroundColor: Color.ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 19, lineHeight: 25 },
});
