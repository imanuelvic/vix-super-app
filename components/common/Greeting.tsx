import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { StreakPill } from '@/components/common/StreakPill';
import { VixText, type VixHeading } from '@/components/common/VixText';
import { greetingOfHour } from '@/lib/daypart';
import { formatGreetingDate } from '@/lib/format';

/**
 * Teks sapaan sesuai jam perangkat (pagi/siang/sore/malam).
 *
 * Aturannya sendiri ada di `greetingOfHour` (lib/daypart.ts) — di sini cuma
 * dirangkai jadi satu kalimat. Dipisah begitu sejak kartu olahraga yang
 * dikirim ke grup keluarga butuh kata & lambangnya terpisah; dengan satu
 * aturan bersama, batas jamnya mustahil melenceng antar-layar.
 */
export function greetingText(): string {
  const { label, emoji } = greetingOfHour(new Date().getHours());
  return `${label} ${emoji}`;
}

// Sapaan personal sesuai jam — teks saja. Dipakai <GreetingHeader/> di bawah
// (baris sapaan + tanggal standar); dulu juga kartu welcome Home, yang sudah
// diganti hero With God di layar Today.
function Greeting({
  heading = 'subheader',
  style,
}: {
  heading?: VixHeading;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <VixText heading={heading} additionalStyle={style}>
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
