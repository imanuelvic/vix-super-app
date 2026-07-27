import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { PressableScale } from '@/components/common/PressableScale';
import { VixText } from '@/components/common/VixText';

// Kartu reminder di Home: latar pastel + border & teks gelap senada, judul
// tebal lalu daftar baris teks. Semua reminder memakai ini biar seragam
// (satu tempat mengatur bentuk & jarak kartunya).
export function ReminderCard({
  bg,
  fg,
  title,
  texts,
  onPress,
  children,
}: {
  bg: string; // warna latar pastel
  fg: string; // warna border + teks (versi gelap senada)
  title: string;
  texts?: (string | { id: string; text: string })[];
  onPress?: () => void;
  children?: ReactNode; // isi khusus (mis. kutipan yang di-clamp)
}) {
  const color: StyleProp<TextStyle> = { color: fg };
  return (
    <PressableScale
      style={[styles.card, { backgroundColor: bg, borderColor: fg }]}
      onPress={onPress}>
      <VixText heading="bold" additionalStyle={color}>
        {title}
      </VixText>
      {texts?.map((t, i) => (
        <VixText
          key={typeof t === 'string' ? i : t.id}
          heading="label"
          additionalStyle={color}>
          {typeof t === 'string' ? t : t.text}
        </VixText>
      ))}
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 3,
    marginTop: -12,
    marginBottom: 24,
  },
});
