import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';
import { useFeatureTheme } from '@/hooks/useFeatureTheme';

// Tombol pil kecil bergaris — "Lihat semua", "+ Tambah", "🔗 Sumber",
// "💬 Share". Aksi SEKUNDER yang duduk di ujung kanan sebuah judul bagian,
// jadi ia sengaja tidak sebesar <PrimaryButton/>.
//
// WARNANYA IKUT FITUR tempat ia berdiri (useFeatureTheme) — sama seperti
// <EmojiButton/>. Sebelumnya tiap layar menulis pilnya sendiri LENGKAP dengan
// warnanya (FRIENDS_DARK di Fun Futsal, NEWS_DARK di Population), dan itulah
// yang membuat tombol sejenis di dua layar tidak pernah benar-benar sama.
export function MiniButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const theme = useFeatureTheme();
  return (
    <PressableScale
      style={[styles.button, { borderColor: theme.fg }]}
      onPress={onPress}
      hitSlop={8}>
      <VixText heading="bold" additionalStyle={{ color: theme.fg }}>
        {label}
      </VixText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
});
