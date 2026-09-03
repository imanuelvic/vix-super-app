import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// Ikon untuk lambang yang MEMANG TIDAK ADA di SF Symbols.
//
// Dua tile Home butuh lambang yang katalog Apple tidak punya, dan sudah dicek
// satu per satu di `sf-symbols-typescript`:
//   • jabat tangan (Friends) — yang ada cuma tangan melambai, bertepuk, dan
//     terangkat; tidak satu pun dua tangan berjabat.
//   • cincin kawin (Married) — semua nama berakhiran `.ring` di sana itu
//     lingkaran di SEKELILING lambang mata uang (`dollarsign.ring`), bukan
//     cincin.
//
// Jalan keluar sebelumnya emoji 🤝, dan justru itu masalahnya: emoji digambar
// sistem dengan warnanya sendiri yang warna-warni, jadi satu tile itu menonjol
// sendirian di antara ikon lain yang rata satu warna. Glif di sini sebaliknya —
// bentuk polos yang diwarnai `fg` tile-nya, persis seperti IconSymbol.
//
// Fontnya ikut @expo/vector-icons yang SUDAH terpasang (dipakai fallback
// Android di icon-symbol.tsx) → tidak ada dependensi baru. Sisa 18 tile lain
// tetap memakai IconSymbol/SF Symbols seperti biasa; berkas ini khusus untuk
// yang tak punya padanannya.
export type GlyphName = 'handshake' | 'ring';

export function IconGlyph({
  name,
  size = 24,
  color,
  style,
}: {
  name: GlyphName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
