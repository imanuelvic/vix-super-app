import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { StreakPill } from '@/components/common/StreakPill';
import { VixText, type VixHeading } from '@/components/common/VixText';
import { DAYPART } from '@/lib/daypart';
import { formatGreetingDate } from '@/lib/format';

/**
 * Teks sapaan sesuai jam perangkat (pagi/siang/sore/malam).
 *
 * Lambangnya ikut DAYPART supaya sama dengan sesi di Habits & Bacaan
 * Alkitab. Sore memang bukan salah satu sesi itu, jadi tetap 🌇.
 */
export function greetingText(): string {
  const h = new Date().getHours();
  if (h < 11) return `Selamat pagi ${DAYPART.morning}`;
  if (h < 15) return `Selamat siang ${DAYPART.daytime}`;
  if (h < 19) return 'Selamat sore 🌇';
  return `Selamat malam ${DAYPART.night}`;
}

// Sapaan personal sesuai jam — teks saja (dipakai di kartu welcome Home yang
// punya layout khusus). Untuk baris sapaan + tanggal standar, pakai
// <GreetingHeader/> di bawah.
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

// Baris standar SAPAAN + TANGGAL — SATU tampilan untuk semua layar berdate
// (Health Summary & Habits, CORE Follow Up, Spiritual). Kalau layar punya
// streak, oper `streak` supaya muncul pil 🔥 di samping tanggal. Ubah di sini
// = semua ikut berubah, biar konsisten & rapi.
export function GreetingHeader({ streak }: { streak?: string | number }) {
  return (
    // Satu baris: sapaan di kiri, tanggal (+ streak bila ada) di kanan.
    <View style={styles.row}>
      <Greeting heading="title" style={styles.greeting} />
      <View style={styles.right}>
        {streak != null && <StreakPill streak={streak} />}
        <VixText heading="label">📆 {formatGreetingDate(new Date())}</VixText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  greeting: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
