import type { StyleProp, TextStyle } from 'react-native';

import { VixText, type VixHeading } from '@/components/common/VixText';

/** Teks sapaan sesuai jam perangkat (pagi/siang/sore/malam). */
export function greetingText(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Selamat pagi ☀️';
  if (h < 15) return 'Selamat siang 🌤️';
  if (h < 19) return 'Selamat sore 🌇';
  return 'Selamat malam 🌙';
}

// Sapaan personal sesuai jam — dipakai di atas tanggal pada halaman yang
// punya tanggal (Home, Health, To-do, CORE Follow Up, Spiritual).
export function Greeting({
  heading = 'subheader',
  color,
  style,
}: {
  heading?: VixHeading;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <VixText
      heading={heading}
      additionalStyle={[color ? { color } : null, style]}>
      {greetingText()}
    </VixText>
  );
}
